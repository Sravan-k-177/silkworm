import { installAuth } from "./auth.ts";
import { initializeSync, syncRecords, SyncError } from "./sync.ts";
import { explainCare, adjustableKeys } from "../shared/explain.ts";
import express from "express";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { assessmentSchema, eventSchema } from "../shared/domain.ts";
const app = express();
const dir = process.env.DATA_DIR || ".data";
mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(resolve(dir, "silksense.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, body TEXT NOT NULL)",
);
app.disable("x-powered-by");
if (process.env.PUBLIC_ORIGIN && process.env.AUTH_MODE !== "accounts")
  throw new Error("Public deployment requires account mode.");
if (
  process.env.AUTH_MODE === "accounts" &&
  (db.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number }).n > 0
) {
  const duplicates = db
    .prepare(
      "SELECT COUNT(*) AS n FROM (SELECT json_extract(body,'$.kind'),json_extract(body,'$.payload.id') FROM events GROUP BY 1,2 HAVING COUNT(*)>1)",
    )
    .get() as { n: number };
  if (duplicates.n)
    throw new Error(
      "Existing records contain duplicate entity IDs. Resolve before enabling account mode.",
    );
}
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    version: "0.1.0",
    authRequired:
      process.env.AUTH_MODE === "accounts" || !!process.env.SYNC_TOKEN,
  }),
);
app.use("/api", (req, res, next) => {
  const origin = req.headers.origin;
  const permitted = process.env.PUBLIC_ORIGIN
    ? [process.env.PUBLIC_ORIGIN]
    : [
        `http://${req.headers.host}`,
        `https://${req.headers.host}`,
        ...(process.env.NODE_ENV === "production"
          ? []
          : ["http://127.0.0.1:5173", "http://localhost:5173"]),
      ];
  if (
    (origin && !permitted.includes(origin)) ||
    req.headers["sec-fetch-site"] === "cross-site"
  ) {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }
  next();
});
app.use(express.json({ limit: "2mb" }));
installAuth(app, db);
initializeSync(db);
app.use("/api", (req, res, next) => {
  const token =
    process.env.AUTH_MODE === "accounts" ? undefined : process.env.SYNC_TOKEN;
  if (token) {
    const actual = Buffer.from(req.headers.authorization || ""),
      expected = Buffer.from(`Bearer ${token}`);
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      res.status(401).json({ error: "Sync token required" });
      return;
    }
  }
  next();
});
const modelUrl = process.env.MODEL_URL || "http://127.0.0.1:8791";
app.get("/api/model/health", async (_req, res) => {
  try {
    const response = await fetch(modelUrl + "/health", {
      signal: AbortSignal.timeout(5000),
    });
    res.status(response.status).json(await response.json());
  } catch {
    res
      .status(503)
      .json({ ok: false, error: "Deep-learning backend is unavailable" });
  }
});
app.post(
  "/api/model/predict",
  express.raw({
    type: ["image/jpeg", "image/png", "image/webp"],
    limit: "8mb",
  }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) {
      res.status(415).json({ error: "Upload a JPEG, PNG or WebP image" });
      return;
    }
    try {
      const response = await fetch(modelUrl + "/predict", {
        method: "POST",
        headers: {
          "Content-Type": req.headers["content-type"] || "image/jpeg",
        },
        body: new Uint8Array(req.body),
        signal: AbortSignal.timeout(30000),
      });
      res.status(response.status).json(await response.json());
    } catch {
      res.status(503).json({
        error:
          "Deep-learning backend unavailable or timed out; no prediction was generated",
      });
    }
  },
);
app.post(
  "/api/model/leaf/predict",
  express.raw({ type: "image/png", limit: "1mb" }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) {
      res.status(415).json({ error: "Prepare a leaf PNG before inference" });
      return;
    }
    try {
      const response = await fetch(modelUrl + "/leaf/predict", {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: new Uint8Array(req.body),
        signal: AbortSignal.timeout(60000),
      });
      res.status(response.status).json(await response.json());
    } catch {
      res
        .status(503)
        .json({
          error:
            "Leaf model server unavailable or timed out. No prediction was generated.",
        });
    }
  },
);
app.use(express.json({ limit: "2mb" }));
app.post("/api/explain", (req, res) => {
  const parsed = z
    .object({
      input: assessmentSchema.pick({
        instar: true,
        moulting: true,
        temperature: true,
        humidity: true,
        ventilation: true,
        hygiene: true,
        feed: true,
        symptoms: true,
        visual: true,
      }),
      adjustments: z.array(z.enum(adjustableKeys)).max(5).default([]),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid explanation input" });
    return;
  }
  res.json(explainCare(parsed.data.input, parsed.data.adjustments));
});
app.post("/api/sync", (req, res) => {
  const parsed = z
    .object({
      events: z.array(eventSchema).max(100),
      cursor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid records", details: parsed.error.flatten() });
    return;
  }
  try {
    res.json(
      syncRecords(
        db,
        parsed.data.events,
        parsed.data.cursor,
        res.locals.account,
      ),
    );
  } catch (error) {
    if (error instanceof SyncError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Could not store records" });
  }
});
if (process.env.NODE_ENV === "production") {
  app.use(
    express.static(resolve("dist"), {
      setHeaders: (res) => res.setHeader("Cache-Control", "no-cache"),
    }),
  );
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
}
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) =>
    res.status(400).json({
      error: err.message.includes("large")
        ? "Request too large"
        : "Invalid request",
    }),
);
const host = process.env.HOST || "127.0.0.1";
if (
  host !== "127.0.0.1" &&
  host !== "localhost" &&
  process.env.AUTH_MODE !== "accounts"
)
  throw new Error(
    "Account mode is required before exposing the server beyond localhost.",
  );
if (
  !["127.0.0.1", "localhost", "::1"].includes(host) &&
  !process.env.PUBLIC_ORIGIN
)
  throw new Error(
    "Public account listeners require PUBLIC_ORIGIN and an HTTPS reverse proxy.",
  );
app.listen(Number(process.env.PORT || 8787), host, () =>
  console.log(`SilkSense server http://${host}:${process.env.PORT || 8787}`),
);
