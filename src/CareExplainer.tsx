import { t } from "./i18n";
import { useState } from "react";
import type { RiskInput } from "../shared/domain";
import { explainCare, type Adjustment } from "../shared/explain";
import { profiles, SOP_URL } from "../shared/risk";
export default function CareExplainer({ input }: { input: RiskInput }) {
  const [selected, setSelected] = useState<Adjustment[]>([]);
  const { risk, projected, actions, feedWorstCase, projectedFeedWorstCase } =
      explainCare(input, selected),
    p = profiles[input.instar];
  return (
    <section
      className="card form-card care-explainer"
      aria-label={t("Farmer care explanation")}
    >
      <div className="eyebrow">
        {t("EXPLAINABLE CARE GUIDE · WORKS OFFLINE")}
      </div>
      <h2>{t("What can I do next?")}</h2>
      {"risk" in input &&
        (input.risk as { version?: string }).version !== risk.version && (
          <p className="warning-note">
            {t(
              "This care preview uses the current scoring rules. The original saved score remains unchanged; record a new assessment for an updated score.",
            )}
          </p>
        )}
      <p>
        {t(
          "These suggestions come from your recorded observations and the checklist rules. Image influence is explained separately under visual cues.",
        )}
      </p>
      <p className="reference-note">
        {t("Instar ")}
        {input.instar}
        {t(" reference: ")}
        {p.temperature.join("–")}
        {t("°C and")} {p.humidity.join("–")}
        {t(
          "% humidity. Confirm the range for your region and hybrid with your extension officer.",
        )}{" "}
        <a href={SOP_URL} target="_blank" rel="noreferrer">
          {t("Regional reference ↗")}
        </a>
      </p>
      {input.moulting && (
        <p className="warning-note">
          {t(
            "Moulting recorded: reduced feeding alone does not add priority points. Confirm stage-specific care before disturbing or cleaning the bed.",
          )}
        </p>
      )}
      {actions.length ? (
        <ol className="care-actions">
          {actions.map((f) => (
            <li key={f.key}>
              <h3>
                {f.key === "mortality"
                  ? t("Unusual deaths need prompt review")
                  : t(f.key + " check")}
              </h3>
              <p>
                <strong>{t("Why:")}</strong> {t(f.label)} (+{f.points}
                {t(" checklist points).")}
              </p>
              <p>
                <strong>{t("Next step:")}</strong> {t(f.action)}
              </p>
              <small>{t(f.when)}</small>
            </li>
          ))}
        </ol>
      ) : (
        <p>
          {t(
            "No checklist trigger was recorded. Continue observations and fill in missing measurements; a low score does not confirm healthy larvae.",
          )}
        </p>
      )}
      <div className="warning-note">
        <div>
          <strong>{t("Feed quality is self-reported, not verified.")}</strong>
          <p>
            {t(
              "A “fresh” answer or a healthy-looking leaf image cannot establish the quality of all leaves actually fed. Check a sample from the feed being used and record handling and any suspect leaves.",
            )}
          </p>
          <p>
            {t("Conservative feed-only scenario:")}{" "}
            <strong>
              {feedWorstCase.score}/100 · {t(feedWorstCase.level)}
              {t(" review priority")}
            </strong>
            {t(
              ", assuming suspect feed regardless of the answer. After your selected changes:",
            )}{" "}
            <strong>
              {projectedFeedWorstCase.score}/100 ·{" "}
              {t(projectedFeedWorstCase.level)}
            </strong>
            .
          </p>
          <p>
            {t(
              "This is the worst feed assumption in this checklist, not a bound on real harm. Other self-reported inputs may also be wrong. Neither score guarantees safety.",
            )}
          </p>
        </div>
      </div>
      <h3 className="spaced">{t("Explore a care scenario")}</h3>
      <p className="muted">
        {t(
          "Select conditions you could improve and remeasure. This changes a hypothetical checklist, without editing the saved observation.",
        )}
      </p>
      {actions
        .filter((f) => f.adjustable)
        .map((f) => (
          <label className="scenario-option" key={f.key}>
            <input
              type="checkbox"
              checked={selected.includes(f.key as Adjustment)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, f.key as Adjustment]
                    : selected.filter((k) => k !== f.key),
                )
              }
            />
            <span>
              {f.key === "temperature" || f.key === "humidity"
                ? t("Bring {{v0}} into the confirmed reference range", {
                    v0: t(f.key),
                  })
                : t("Improve {{v0}}", { v0: t(f.key) })}
            </span>
          </label>
        ))}
      <p role="status" className="scenario-result">
        {t("Checklist comparison:")}{" "}
        <strong>
          {risk.score} → {projected.score}
        </strong>{" "}
        {t("/ 100 priority points · ")}
        {t(projected.level)}
        {t(" review priority")}
      </p>
      <p className="reference-note">
        {t(
          "This is rule recalculation, not a prediction of recovery or yield. Reported symptoms and image concerns stay in the scenario. Points are capped at 100, so correcting one factor may leave the displayed score unchanged.",
        )}
      </p>
      {risk.missing.length > 0 && (
        <p>
          <strong>{t("Still unknown:")}</strong>{" "}
          {risk.missing.map((x) => t(x)).join("; ")}.
        </p>
      )}
      <p>
        <strong>{t("Check whether care helped:")}</strong>
        {t(
          " record the action in the batch care log, then take a new assessment with fresh readings and observed feeding, appearance and deaths. Seek officer review for persistent or worsening signs.",
        )}
      </p>
    </section>
  );
}
