import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync, chmodSync } from "node:fs";
import { resolve, dirname } from "node:path";
const source = resolve(process.env.DATA_DIR || ".data", "silksense.sqlite");
const destination = process.argv[2];
if (!destination)
  throw new Error("Usage: backup-db.ts /absolute/path/to/new-backup.sqlite");
const target = resolve(destination);
if (existsSync(target))
  throw new Error("Backup destination already exists; choose a new file.");
mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
const db = new DatabaseSync(source, { readOnly: true });
db.prepare("VACUUM INTO ?").run(target);
db.close();
chmodSync(target, 0o600);
const backup = new DatabaseSync(target, { readOnly: true });
const result = backup.prepare("PRAGMA integrity_check").get();
backup.close();
if (result?.integrity_check !== "ok")
  throw new Error("Backup integrity check failed.");
console.log("Verified backup written to " + target);
