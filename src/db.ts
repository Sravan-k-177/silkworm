import Dexie, { type Table } from "dexie";
import { eventSchema, type RecordEvent } from "../shared/domain";
export type LocalEvent = RecordEvent & { synced: 0 | 1 };
export type Media = {
  id: string;
  blob: Blob;
  thumbnail: string;
  kind: "image" | "video";
  name: string;
};
class SilkDB extends Dexie {
  events!: Table<LocalEvent, string>;
  media!: Table<Media, string>;
  settings!: Table<{ key: string; value: string }, string>;
  constructor(name = "silksense-v1") {
    super(name);
    this.version(1).stores({
      events: "id,kind,createdAt,synced",
      media: "id",
      settings: "key",
    });
  }
}
export let db = new SilkDB();
let workspaceAccountId: string | null = null;
export async function selectWorkspace(account: string | null) {
  const name = account
    ? "silksense-account-" + encodeURIComponent(account)
    : "silksense-v1";
  if (db.name === name) return;
  if (syncing) await syncing.catch(() => {});
  workspaceAccountId = account?.split(":")[0] || null;
  db.close();
  db = new SilkDB(name);
}
export async function deviceId() {
  let entry = await db.settings.get("deviceId");
  if (!entry) {
    entry = { key: "deviceId", value: crypto.randomUUID() };
    await db.settings.put(entry);
  }
  return entry.value;
}
export async function saveEvent(
  kind: RecordEvent["kind"],
  payload: RecordEvent["payload"],
) {
  const event = eventSchema.parse({
    id: crypto.randomUUID(),
    kind,
    payload,
    createdAt: new Date().toISOString(),
    deviceId: await deviceId(),
  });
  await db.events.add({ ...event, synced: 0 });
  return event;
}
let syncing: Promise<number> | null = null;
export function synchronize(token = "") {
  if (syncing) return syncing;
  syncing = (async () => {
    let total = 0,
      more = true,
      round = 0;
    let cursor = Number((await db.settings.get("cursor"))?.value || 0);
    while (more && round++ < 100) {
      const rank = (kind: string) =>
        kind === "batch" ? 0 : kind === "assessment" ? 1 : 2;
      const pending = (await db.events.where("synced").equals(0).toArray())
        .sort(
          (a, b) =>
            rank(a.kind) - rank(b.kind) ||
            Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
            a.id.localeCompare(b.id),
        )
        .slice(0, 100);
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(workspaceAccountId
            ? { "X-SilkSense-Account": workspaceAccountId }
            : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          events: pending.map(({ synced: _, ...event }) => event),
          cursor,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Sign in again or check the sync token in settings."
            : `Sync failed (${response.status}). Your local records are safe.`,
        );
      const data = await response.json();
      if (
        !Array.isArray(data.events) ||
        !Array.isArray(data.accepted) ||
        !Number.isSafeInteger(data.cursor) ||
        data.cursor < cursor
      )
        throw new Error("Invalid server response. Local records retained.");
      if (
        typeof data.hasMore !== "boolean" ||
        data.accepted.some(
          (id: unknown) =>
            typeof id !== "string" || !pending.some((e) => e.id === id),
        ) ||
        new Set(data.accepted).size !== data.accepted.length
      )
        throw new Error("Invalid acknowledgement. Local records retained.");
      if (data.hasMore && data.cursor === cursor)
        throw new Error(
          "Synchronization stalled. Server cursor did not advance.",
        );
      if (
        pending.length &&
        data.accepted.length === 0 &&
        data.cursor === cursor
      )
        throw new Error(
          "Synchronization stalled. Local records remain queued.",
        );
      const records = data.events.map((e: unknown) =>
        eventSchema.parse(e),
      ) as RecordEvent[];
      await db.transaction("rw", db.events, db.settings, async () => {
        for (const event of records) {
          const existing = await db.events.get(event.id);
          if (existing) {
            const { synced: _, ...body } = existing;
            if (JSON.stringify(body) !== JSON.stringify(event))
              throw new Error("Conflicting record from server.");
          }
          await db.events.put({ ...event, synced: 1 });
        }
        for (const id of data.accepted) {
          if (pending.some((e) => e.id === id))
            await db.events.update(id, { synced: 1 });
        }
        await db.settings.put({ key: "cursor", value: String(data.cursor) });
      });
      cursor = data.cursor;
      total += data.accepted.length;
      more =
        data.hasMore || (await db.events.where("synced").equals(0).count()) > 0;
    }
    if (more)
      throw new Error(
        "Synchronization is incomplete. Retry to continue; local records are safe.",
      );
    await db.settings.put({ key: "lastSync", value: new Date().toISOString() });
    return total;
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}
export async function exportRecords() {
  const events = await db.events.toArray();
  return new Blob(
    [
      JSON.stringify(
        {
          format: "silksense-events-v1",
          exportedAt: new Date().toISOString(),
          mediaIncluded: false,
          events: events.map(({ synced: _, ...e }) => e),
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
}
export async function importRecords(file: File) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Import must be under 10 MB.");
  const raw = JSON.parse(await file.text());
  if (
    raw.format !== "silksense-events-v1" ||
    !Array.isArray(raw.events) ||
    raw.events.length > 10000
  )
    throw new Error("Not a supported SilkSense export.");
  const events: RecordEvent[] = raw.events.map((e: unknown) =>
    eventSchema.parse(e),
  );
  await db.transaction("rw", db.events, async () => {
    for (const e of events) {
      const old = await db.events.get(e.id);
      if (old) {
        const { synced: _, ...body } = old;
        if (JSON.stringify(body) !== JSON.stringify(e))
          throw new Error("Import contains a conflicting record.");
      } else await db.events.add({ ...e, synced: 0 });
    }
  });
  return events.length;
}
