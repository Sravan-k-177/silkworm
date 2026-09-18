import { t, locale } from "./i18n";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, saveEvent } from "./db";
import { alertQueue } from "../shared/alerts";
import type { Assessment, Batch, Followup } from "../shared/domain";
const labels = {
  open: "Needs acknowledgement",
  acknowledged: "Acknowledged",
  scheduled: "Follow-up scheduled",
  resolved: "Resolved",
  reopened: "Reopened",
};
export default function Followups({
  assessments,
  batches,
}: {
  assessments: Assessment[];
  batches?: Batch[];
}) {
  const followups =
    useLiveQuery(
      async () =>
        (await db.events.where("kind").equals("followup").toArray()).map(
          (e) => e.payload as Followup,
        ),
      [],
    ) || [];
  const [includeResolved, setIncludeResolved] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const queue = alertQueue(assessments, followups, now),
    active = queue.filter((x) => x.status !== "resolved");
  return (
    <section className="spaced" aria-label={t("High-risk follow-up queue")}>
      <div className="section-heading">
        <h2>{t("High-risk follow-ups")}</h2>
        <span className="subtle-tag">
          {active.length}
          {t(" open")}
        </span>
      </div>
      <div className="card form-card">
        <p className="muted">
          {t(
            "Each high-risk observation stays here until someone records a resolution. A lower score on a later visit does not close an earlier alert.",
          )}
        </p>
        <label className="check-row">
          <input
            type="checkbox"
            checked={includeResolved}
            onChange={(e) => setIncludeResolved(e.target.checked)}
          />{" "}
          {t("Show resolved alerts")}
        </label>
        {!queue.filter((x) => includeResolved || x.status !== "resolved")
          .length && (
          <p role="status" className="muted">
            {t("No ")}
            {includeResolved ? t("recorded") : t("open")}
            {t(" high-risk alerts in this selection.")}
          </p>
        )}
        {queue
          .filter((x) => includeResolved || x.status !== "resolved")
          .map((item) => (
            <Alert
              key={item.assessment.id}
              item={item}
              name={
                batches?.find((b) => b.id === item.assessment.batchId)?.name
              }
            />
          ))}
      </div>
    </section>
  );
}
function Alert({
  item,
  name,
}: {
  item: ReturnType<typeof alertQueue>[number];
  name?: string;
}) {
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const a = item.assessment;
  return (
    <article className="alert-entry">
      <div className="section-heading">
        <div>
          <h3>
            {name ? `${name} · ` : ""}
            {a.risk.score}
            {t(" priority points")}
          </h3>
          <p className="muted">
            {t("Alert recorded ")}
            {new Date(a.capturedAt).toLocaleString(locale())}
            {t(" · Instar ")}
            {a.instar}
          </p>
        </div>
        <span className={`badge ${item.overdue ? "high" : "neutral"}`}>
          {item.overdue ? t("Overdue") : t(labels[item.status])}
        </span>
      </div>
      {item.latest && (
        <p className="muted">
          {item.latest.staffCode} · {item.latest.notes}
          {item.status === "scheduled" && item.latest.dueAt && (
            <>
              {t(" · Due ")}
              {new Date(item.latest.dueAt).toLocaleString(locale())}
            </>
          )}
        </p>
      )}
      <button
        className="button secondary"
        onClick={() => setEditing(!editing)}
        aria-expanded={editing}
      >
        {editing ? t("Cancel update") : t("Update follow-up")}
      </button>
      {editing && (
        <form
          className="spaced"
          onSubmit={async (e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              const due = String(d.get("dueAt") || "");
              await saveEvent("followup", {
                id: crypto.randomUUID(),
                batchId: a.batchId,
                assessmentId: a.id,
                recordedAt: new Date().toISOString(),
                status: d.get("status") as Followup["status"],
                staffCode: String(d.get("staffCode")),
                dueAt: due ? new Date(due).toISOString() : null,
                notes: String(d.get("notes")),
              });
              setEditing(false);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="field-grid">
            <label className="field">
              <span>{t("Follow-up status")}</span>
              <select
                name="status"
                defaultValue={
                  item.status === "resolved" ? "reopened" : "acknowledged"
                }
              >
                {Object.entries(labels)
                  .filter(([k]) => k !== "open")
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {t(v)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>{t("Responsible staff code")}</span>
              <input
                name="staffCode"
                required
                maxLength={80}
                defaultValue={item.latest?.staffCode}
              />
            </label>
            <label className="field">
              <span>{t("Follow-up due (local time)")}</span>
              <input type="datetime-local" name="dueAt" />
            </label>
          </div>
          <label className="field">
            <span>{t("Follow-up evidence and next step")}</span>
            <textarea name="notes" required maxLength={2000} rows={3} />
          </label>
          <p className="reference-note">
            {t(
              "Staff codes are self-reported. Resolution records a completed follow-up, not a declaration that larvae are disease-free.",
            )}
          </p>
          {error && (
            <p className="error" role="alert">
              {t(error)}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? t("Saving…") : t("Save follow-up")}
          </button>
        </form>
      )}
      {!!item.history.length && (
        <details className="spaced">
          <summary>
            {t("Follow-up history (")}
            {item.history.length})
          </summary>
          <ol className="audit-history">
            {item.history.map((h) => (
              <li key={h.id}>
                <strong>{t(labels[h.status])}</strong> · {h.staffCode} ·{" "}
                {new Date(h.recordedAt).toLocaleString(locale())}
                {h.status === "scheduled" && h.dueAt && (
                  <p>
                    {t("Due ")}
                    {new Date(h.dueAt).toLocaleString(locale())}
                  </p>
                )}
                <p>{h.notes}</p>
              </li>
            ))}
          </ol>
        </details>
      )}
    </article>
  );
}
