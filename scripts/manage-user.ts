/** Local operator command; password comes from stdin, never a CLI argument. */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { hashPassword, initAccounts } from "../server/auth.ts";
const [command, username, role, ...farms] = process.argv.slice(2);
if (
  !["create", "disable", "enable", "password", "farms"].includes(command) ||
  !username
)
  throw new Error(
    "Usage: manage-user.ts create USER field|supervisor|admin FARM... (password on stdin); disable|enable|password USER; farms USER replace FARM...",
  );
const dir = process.env.DATA_DIR || ".data";
mkdirSync(dir, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(resolve(dir, "silksense.sqlite"));
initAccounts(db);
const existing = db
  .prepare("SELECT id FROM users WHERE username=?")
  .get(username) as { id: string } | undefined;
if (command === "create") {
  if (existing) throw new Error("Username already exists.");
  if (
    !["field", "supervisor", "admin"].includes(role) ||
    !farms.length ||
    farms.some((f) => !f.trim() || f.length > 80)
  )
    throw new Error("Choose a valid role and at least one farm.");
  const password = readFileSync(0, "utf8").trimEnd();
  if (password.length < 12 || password.length > 200)
    throw new Error("Password must have 12–200 characters.");
  const hash = await hashPassword(password);
  const id = randomUUID();
  db.exec("BEGIN");
  try {
    db.prepare(
      "INSERT INTO users(id,username,password_hash,role) VALUES(?,?,?,?)",
    ).run(id, username, hash, role);
    for (const farm of new Set(farms))
      db.prepare("INSERT INTO user_farms VALUES(?,?)").run(id, farm);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
} else {
  if (!existing) throw new Error("Unknown username.");
  if (command === "password") {
    const password = readFileSync(0, "utf8").trimEnd();
    if (password.length < 12 || password.length > 200)
      throw new Error("Password must have 12–200 characters.");
    db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(
      await hashPassword(password),
      existing.id,
    );
  } else if (command === "farms") {
    if (role !== "replace" || !farms.length)
      throw new Error("Use farms USER replace FARM...");
    db.exec("BEGIN");
    db.prepare("DELETE FROM user_farms WHERE user_id=?").run(existing.id);
    for (const farm of new Set(farms))
      db.prepare("INSERT INTO user_farms VALUES(?,?)").run(existing.id, farm);
    db.exec("COMMIT");
  } else
    db.prepare("UPDATE users SET disabled=? WHERE id=?").run(
      command === "disable" ? 1 : 0,
      existing.id,
    );
  // Revoke existing sessions after any account change.
  db.prepare("DELETE FROM sessions WHERE json_extract(body,'$.userId')=?").run(
    existing.id,
  );
}
console.log("Account updated.");
db.close();
