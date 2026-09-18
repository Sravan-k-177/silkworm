import { t, locale } from "./i18n";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, saveEvent } from "./db";
import { onsetComparison } from "../shared/alerts";
import type { Assessment, HealthObservation } from "../shared/domain";
const findings = {
  "no-unusual-signs": "No unusual signs observed",
  "stress-signs": "Stress or unusual signs",
  mortality: "Mortality observed",
};
function localNow() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export default function HealthHistory({
  batchId,
  assessments,
}: {
  batchId: string;
  assessments: Assessment[];
}) {
  const records =
    useLiveQuery(
      async () =>
        (await db.events.where("kind").equals("health-observation").toArray())
          .map((e) => e.payload as HealthObservation)
          .filter((x) => x.batchId === batchId)
          .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt)),
      [batchId],
    ) || [];
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  return (
    <section>
      <div className="section-heading">
        <h2>{t("Observed health & onset")}</h2>
      </div>
      <div className="card form-card">
        <p className="muted">
          {t(
            "Record what was actually observed and when. This evidence is kept separately from the risk score. Unknown onset stays unknown.",
          )}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              d = new FormData(form);
            setBusy(true);
            setError("");
            setMessage("");
            try {
              const onset = String(d.get("onsetAt") || ""),
                number = (key: string) =>
                  d.get(key) === "" ? null : Number(d.get(key));
              await saveEvent("health-observation", {
                id: crypto.randomUUID(),
                batchId,
                recordedAt: new Date().toISOString(),
                observedAt: new Date(String(d.get("observedAt"))).toISOString(),
                onsetAt: onset ? new Date(onset).toISOString() : null,
                onsetPrecision: d.get(
                  "onsetPrecision",
                ) as HealthObservation["onsetPrecision"],
                observerCode: String(d.get("observerCode")),
                finding: d.get("finding") as HealthObservation["finding"],
                examinedCount: number("examinedCount"),
                affectedCount: number("affectedCount"),
                evidence: d.get("evidence") as HealthObservation["evidence"],
                notes: String(d.get("notes")),
              });
              form.reset();
              setMessage("Health observation saved on this device.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="field-grid">
            <label className="field">
              <span>{t("Observation time (local)")}</span>
              <input
                required
                type="datetime-local"
                name="observedAt"
                defaultValue={localNow()}
              />
            </label>
            <label className="field">
              <span>{t("Observer code")}</span>
              <input required name="observerCode" maxLength={80} />
            </label>
            <label className="field">
              <span>{t("Observed finding")}</span>
              <select name="finding">
                {Object.entries(findings).map(([k, v]) => (
                  <option value={k} key={k}>
                    {t(v)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("Evidence source")}</span>
              <select name="evidence">
                <option value="field-observation">
                  {t("Field observation")}
                </option>
                <option value="officer-review">{t("Officer review")}</option>
                <option value="laboratory">
                  {t("Laboratory report (describe in notes)")}
                </option>
              </select>
            </label>
            <label className="field">
              <span>{t("Larvae examined")}</span>
              <input
                type="number"
                min="1"
                max="10000000"
                step="1"
                name="examinedCount"
              />
            </label>
            <label className="field">
              <span>{t("Affected in this examination")}</span>
              <input
                type="number"
                min="0"
                max="10000000"
                step="1"
                name="affectedCount"
              />
            </label>
            <label className="field">
              <span>{t("First onset time, if known (local)")}</span>
              <input type="datetime-local" name="onsetAt" />
            </label>
            <label className="field">
              <span>{t("Onset timing evidence")}</span>
              <select name="onsetPrecision">
                <option value="unknown">{t("Unknown")}</option>
                <option value="estimated">{t("Retrospective estimate")}</option>
                <option value="observed">{t("Observed at the time")}</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>{t("Observation evidence")}</span>
            <textarea
              name="notes"
              required
              rows={3}
              maxLength={2000}
              placeholder={t(
                "Signs seen, sampling method, and report reference where available",
              )}
            />
          </label>
          <p className="reference-note">
            {t(
              "Counts describe this examination; they are not automatically whole-batch mortality. Evidence and observer codes are self-reported.",
            )}
          </p>
          {error && (
            <p role="alert" className="error">
              {t(error)}
            </p>
          )}
          {message && <p role="status">{t(message)}</p>}
          <button className="button primary" disabled={busy}>
            {busy ? t("Saving…") : t("Save health observation")}
          </button>
        </form>
      </div>
      {records.map((o) => {
        const comparison = onsetComparison(o, assessments);
        return (
          <article key={o.id} className="card form-card">
            <div className="eyebrow">
              {new Date(o.observedAt).toLocaleString(locale())} ·{" "}
              {o.observerCode}
            </div>
            <h3>{t(findings[o.finding])}</h3>
            <p>{o.notes}</p>
            <p className="muted">
              {o.affectedCount ?? t("Unmeasured")}
              {t(" affected /")} {o.examinedCount ?? t("unmeasured")}
              {t(" examined · ")}
              {t(o.evidence)}
              <br />
              {t("Onset:")}{" "}
              {o.onsetAt
                ? new Date(o.onsetAt).toLocaleString(locale())
                : t("unknown")}{" "}
              · {t(o.onsetPrecision)}
            </p>
            <p className="reference-note">
              {comparison
                ? t(
                    "Latest preceding high-risk observation: {{v0}} hours before reported onset. Descriptive interval, not validated early-warning performance.",
                    { v0: comparison.hours.toFixed(1) },
                  )
                : t("No comparable high-risk observation before known onset.")}
            </p>
          </article>
        );
      })}
    </section>
  );
}
