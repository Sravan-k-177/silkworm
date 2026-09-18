import session from "express-session";
import { rateLimit } from "express-rate-limit";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { DatabaseSync } from "node:sqlite";
import type { Express } from "express";
import { z } from "zod";
const scrypt = promisify(scryptCallback);
export type Account = {
  id: string;
  username: string;
  role: "field" | "supervisor" | "admin";
  farms: string[];
};
declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}
export function initAccounts(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS user_farms(user_id TEXT NOT NULL REFERENCES users(id), farm TEXT NOT NULL, PRIMARY KEY(user_id,farm));
 CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY, body TEXT NOT NULL, expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS event_receipts(event_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, received_at TEXT NOT NULL);`);
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [, salt, hash] = encoded.split(":");
  if (!salt || !hash) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function accountFor(db: DatabaseSync, id: string): Account | null {
  const user = db
    .prepare("SELECT id,username,role FROM users WHERE id=? AND disabled=0")
    .get(id) as Omit<Account, "farms"> | undefined;
  if (!user) return null;
  return {
    ...user,
    farms: (
      db
        .prepare("SELECT farm FROM user_farms WHERE user_id=? ORDER BY farm")
        .all(id) as { farm: string }[]
    ).map((x) => x.farm),
  };
}
class SQLiteSessions extends session.Store {
  database: DatabaseSync;
  constructor(database: DatabaseSync) {
    super();
    this.database = database;
  }
  get(
    sid: string,
    callback: (error: unknown, value?: session.SessionData | null) => void,
  ) {
    try {
      const row = this.database
        .prepare("SELECT body FROM sessions WHERE sid=? AND expires>?")
        .get(sid, Date.now()) as { body: string } | undefined;
      callback(null, row ? JSON.parse(row.body) : null);
    } catch (e) {
      callback(e);
    }
  }
  set(
    sid: string,
    value: session.SessionData,
    callback?: (error?: unknown) => void,
  ) {
    try {
      this.database
        .prepare("DELETE FROM sessions WHERE expires<=?")
        .run(Date.now());
      this.database
        .prepare("INSERT OR REPLACE INTO sessions VALUES(?,?,?)")
        .run(
          sid,
          JSON.stringify(value),
          value.cookie.expires
            ? new Date(value.cookie.expires).getTime()
            : Date.now() + 86400000,
        );
      callback?.();
    } catch (e) {
      callback?.(e);
    }
  }
  destroy(sid: string, callback?: (error?: unknown) => void) {
    try {
      this.database.prepare("DELETE FROM sessions WHERE sid=?").run(sid);
      callback?.();
    } catch (e) {
      callback?.(e);
    }
  }
}
export function installAuth(app: Express, db: DatabaseSync) {
  const enabled = process.env.AUTH_MODE === "accounts";
  initAccounts(db);
  if (!enabled) {
    app.get("/api/auth/session", (_req, res) =>
      res.json({ enabled: false, user: null }),
    );
    return;
  }
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith("REPLACE_"))
    throw new Error(
      "Account mode needs SESSION_SECRET of at least 32 characters.",
    );
  const publicOrigin = process.env.PUBLIC_ORIGIN;
  if (publicOrigin) {
    if (!/^https:\/\/[^/]+$/.test(publicOrigin))
      throw new Error(
        "PUBLIC_ORIGIN must be an HTTPS origin without a trailing slash.",
      );
    app.set("trust proxy", "loopback");
  }
  app.use(
    session({
      name: "silksense.sid",
      secret,
      store: new SQLiteSessions(db),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: !!publicOrigin,
        sameSite: "strict",
        maxAge: 12 * 60 * 60 * 1000,
      },
    }),
  );
  app.get("/api/auth/session", (req, res) =>
    res.json({
      enabled: true,
      user: req.session.userId ? accountFor(db, req.session.userId) : null,
      expiresAt: req.session.cookie.expires,
    }),
  );
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Try again in 15 minutes." },
  });
  // Same-cost verification also for unknown usernames.
  const dummyHash = hashPassword(randomBytes(32).toString("hex"));
  app.post("/api/auth/login", limiter, async (req, res, next) => {
    try {
      const parsed = z
        .object({
          username: z.string().trim().min(1).max(80),
          password: z.string().min(1).max(200),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Enter a username and password." });
        return;
      }
      const row = db
        .prepare("SELECT id,password_hash,disabled FROM users WHERE username=?")
        .get(parsed.data.username) as
        { id: string; password_hash: string; disabled: number } | undefined;
      const valid = await verifyPassword(
        parsed.data.password,
        row?.password_hash || (await dummyHash),
      );
      if (!row || row.disabled || !valid) {
        res.status(401).json({ error: "Username or password is incorrect." });
        return;
      }
      req.session.regenerate((error) => {
        if (error) {
          next(error);
          return;
        }
        req.session.userId = row.id;
        req.session.save((error) => {
          if (error) {
            next(error);
            return;
          }
          res.json({
            user: accountFor(db, row.id),
            expiresAt: req.session.cookie.expires,
          });
        });
      });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/auth/logout", (req, res, next) =>
    req.session.destroy((error) => {
      if (error) {
        next(error);
        return;
      }
      res.clearCookie("silksense.sid", {
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        secure: !!publicOrigin,
      });
      res.json({ ok: true });
    }),
  );
  app.use("/api", (req, res, next) => {
    const user = req.session.userId ? accountFor(db, req.session.userId) : null;
    if (!user) {
      res
        .status(401)
        .json({ error: "Sign in to synchronize or use the server." });
      return;
    }
    if (
      req.headers["x-silksense-account"] &&
      req.headers["x-silksense-account"] !== user.id
    ) {
      res
        .status(401)
        .json({
          error: "The signed-in account changed. Reload before synchronizing.",
        });
      return;
    }
    res.locals.account = user;
    next();
  });
}
