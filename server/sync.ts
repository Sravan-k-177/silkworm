import type { DatabaseSync } from "node:sqlite";
import type { Account } from "./auth.ts";
import type { RecordEvent } from "../shared/domain.ts";
export class SyncError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function initializeSync(db: DatabaseSync) {
  db.exec(
    `CREATE INDEX IF NOT EXISTS event_entity ON events(json_extract(body,'$.kind'),json_extract(body,'$.payload.id'));`,
  );
}
export function syncRecords(
  db: DatabaseSync,
  events: RecordEvent[],
  cursor: number,
  account?: Account,
) {
  const get = db.prepare("SELECT body FROM events WHERE id=?");
  const entity = db.prepare(
    "SELECT body FROM events WHERE json_extract(body,'$.kind')=? AND json_extract(body,'$.payload.id')=? LIMIT 1",
  );
  const insert = db.prepare("INSERT INTO events(id,body) VALUES(?,?)");
  if (new Set(events.map((e) => e.id)).size !== events.length)
    throw new SyncError(422, "Duplicate event IDs in upload.");
  const pending = new Map<string, RecordEvent>();
  for (const event of events) {
    const key = `${event.kind}:${event.payload.id}`;
    const duplicate = pending.get(key);
    if (duplicate && JSON.stringify(duplicate) !== JSON.stringify(event))
      throw new SyncError(409, "Conflicting entity ID in this upload.");
    pending.set(key, event);
  }
  function lookup(kind: string, id: string): RecordEvent | undefined {
    const value = pending.get(`${kind}:${id}`);
    if (value) return value;
    const row = entity.get(kind, id) as { body: string } | undefined;
    return row ? JSON.parse(row.body) : undefined;
  }
  function farmOf(event: RecordEvent) {
    if (event.kind === "batch") return event.payload.farm;
    const batch = lookup("batch", event.payload.batchId);
    if (!batch || batch.kind !== "batch")
      throw new SyncError(
        422,
        "Sync the parent batch before its observations.",
      );
    return batch.payload.farm;
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const event of events) {
      const old = get.get(event.id) as { body: string } | undefined;
      const body = JSON.stringify(event);
      if (old && old.body !== body)
        throw new SyncError(
          409,
          "Immutable event ID conflict; local records retained.",
        );
      if (account) {
        const farm = farmOf(event);
        if (!account.farms.includes(farm))
          throw new SyncError(
            403,
            "This account does not have access to that farm.",
          );
        const sameEntity = entity.get(event.kind, event.payload.id) as
          { body: string } | undefined;
        if (sameEntity && sameEntity.body !== body)
          throw new SyncError(
            409,
            "An immutable record already uses this entity ID.",
          );
        if (!old && event.kind === "review" && account.role === "field")
          throw new SyncError(
            403,
            "A supervisor account is required to submit reviews.",
          );
        if ("assessmentId" in event.payload && event.payload.assessmentId) {
          const a = lookup("assessment", event.payload.assessmentId);
          if (
            !a ||
            a.kind !== "assessment" ||
            !("batchId" in event.payload) ||
            a.payload.batchId !== event.payload.batchId
          )
            throw new SyncError(
              422,
              "Linked assessment must belong to the same batch.",
            );
        }
      }
      if (!old) {
        insert.run(event.id, body);
        if (account)
          db.prepare("INSERT INTO event_receipts VALUES(?,?,?)").run(
            event.id,
            account.id,
            new Date().toISOString(),
          );
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  // Filter on the server before pagination. A global cursor may contain gaps from other farms.
  const rows = (
    account
      ? db
          .prepare(
            `SELECT e.seq,e.body FROM events e WHERE e.seq>? AND (
 CASE WHEN json_extract(e.body,'$.kind')='batch' THEN json_extract(e.body,'$.payload.farm')
 ELSE (SELECT json_extract(b.body,'$.payload.farm') FROM events b WHERE json_extract(b.body,'$.kind')='batch' AND json_extract(b.body,'$.payload.id')=json_extract(e.body,'$.payload.batchId') LIMIT 1) END
 ) IN (SELECT farm FROM user_farms WHERE user_id=?) ORDER BY e.seq LIMIT 200`,
          )
          .all(cursor, account.id)
      : db
          .prepare(
            "SELECT seq,body FROM events WHERE seq>? ORDER BY seq LIMIT 200",
          )
          .all(cursor)
  ) as { seq: number; body: string }[];
  return {
    accepted: events.map((e) => e.id),
    events: rows.map((r) => JSON.parse(r.body)),
    cursor: rows.length ? rows[rows.length - 1].seq : cursor,
    hasMore: rows.length === 200,
  };
}
