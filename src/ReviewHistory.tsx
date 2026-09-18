import { t, locale } from "./i18n";
import { useAccount } from "./AuthGate";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, saveEvent } from "./db";
import type { Assessment, Review } from "../shared/domain";
const decisions = {
  supported: "Observations supported",
  "needs-recheck": "Field recheck needed",
  correction: "Correction note",
};
export default function ReviewHistory({
  batchId,
  assessments,
}: {
  batchId: string;
  assessments: Assessment[];
}) {
  const { user } = useAccount();
  const reviews =
    useLiveQuery(
      async () =>
        (await db.events.where("kind").equals("review").toArray())
          .map((e) => e.payload as Review)
          .filter((r) => r.batchId === batchId)
          .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
      [batchId],
    ) || [];
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  return (
    <section>
      <div className="section-heading">
        <h2>{t("Validation & correction history")}</h2>
      </div>
      <div className="card form-card">
        <h3>{t("Review an observation")}</h3>
        <p className="muted">
          {t(
            "Record a field review or explain a correction. The original assessment and score remain visible. A correction note does not recalculate risk; capture a new assessment with the corrected readings.",
          )}
        </p>
        {user?.role === "field" ? (
          <p>{t("A supervisor account is required to submit reviews.")}</p>
        ) : !assessments.length ? (
          <p>{t("Add an assessment before recording a review.")}</p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const d = new FormData(form);
              setBusy(true);
              setError("");
              setMessage("");
              try {
                const assessmentId = String(d.get("assessmentId"));
                if (!assessments.some((a) => a.id === assessmentId))
                  throw new Error("Choose an assessment in this batch.");
                await saveEvent("review", {
                  id: crypto.randomUUID(),
                  batchId,
                  assessmentId,
                  recordedAt: new Date().toISOString(),
                  reviewerCode: String(d.get("reviewerCode")),
                  decision: d.get("decision") as Review["decision"],
                  notes: String(d.get("notes")),
                });
                form.reset();
                setMessage("Review saved on this device.");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              <span>{t("Observation to review")}</span>
              <select name="assessmentId">
                {assessments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {new Date(a.capturedAt).toLocaleString(locale())}
                    {t(" · Instar")} {a.instar} · {t(a.risk.level)} (
                    {a.risk.score})
                  </option>
                ))}
              </select>
            </label>
            <div className="field-grid">
              <label className="field">
                <span>{t("Reviewer code")}</span>
                <input
                  name="reviewerCode"
                  required
                  maxLength={80}
                  placeholder={t("Anonymous staff code")}
                />
              </label>
              <label className="field">
                <span>{t("Review decision")}</span>
                <select name="decision">
                  {Object.entries(decisions).map(([value, label]) => (
                    <option value={value} key={value}>
                      {t(label)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>{t("Review evidence or correction")}</span>
              <textarea
                name="notes"
                required
                maxLength={2000}
                rows={3}
                placeholder={t(
                  "What was checked, what differs, and the follow-up needed",
                )}
              />
            </label>
            <p className="reference-note">
              {t(
                "Reviewer codes are self-reported in this local demo. A review is not a laboratory diagnosis.",
              )}
            </p>
            {error && (
              <p className="error" role="alert">
                {t(error)}
              </p>
            )}
            {message && <p role="status">{t(message)}</p>}
            <button className="button primary" disabled={busy}>
              {busy ? t("Saving…") : t("Save review")}
            </button>
          </form>
        )}
      </div>
      {reviews.map((r) => {
        const a = assessments.find((a) => a.id === r.assessmentId);
        return (
          <article className="card form-card" key={r.id}>
            <div className="eyebrow">
              {new Date(r.recordedAt).toLocaleString(locale())} ·{" "}
              {r.reviewerCode}
            </div>
            <h3>{t(decisions[r.decision])}</h3>
            <p>{r.notes}</p>
            <p className="muted">
              {t("Linked observation:")}{" "}
              {a
                ? t("{{v0}} · Instar {{v1}} · {{v2}} priority points", {
                    v0: new Date(a.capturedAt).toLocaleString(locale()),
                    v1: a.instar,
                    v2: a.risk.score,
                  })
                : r.assessmentId}
            </p>
          </article>
        );
      })}
    </section>
  );
}
