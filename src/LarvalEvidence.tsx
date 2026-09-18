import { t } from "./i18n";
import { useEffect, useState } from "react";
import { loadLarvalModel, type LarvalModel } from "./larval-model";
import type { LarvalVisual } from "../shared/domain";
const decisions = {
  review: "Visual appearance needs field review",
  uncertain: "Visual result is uncertain",
  overlap: "Overlapping larvae: retake a closer view",
  "no-visible-alert": "No visual alert from this model",
};
export default function LarvalEvidence({
  visual,
  thumbnail,
}: {
  visual: LarvalVisual;
  thumbnail?: string;
}) {
  return (
    <div className="card form-card">
      <div className="eyebrow">{t("LARVAL IMAGE MODEL")}</div>
      <h3>{t(decisions[visual.decision])}</h3>
      <p className="muted">
        {t(
          "A comparison with labelled research images, not a diagnosis. A low visual signal does not establish health.",
        )}
      </p>
      {thumbnail && (
        <>
          <div className="influence-image">
            <img
              src={thumbnail}
              alt={t("First sampled tray frame with model influence overlay")}
            />
            <div className="influence-grid" aria-hidden="true">
              {visual.influence.map((v, i) => (
                <span
                  key={i}
                  style={{
                    background:
                      v > 0
                        ? `rgba(219,124,41,${Math.min(0.7, v * 3)})`
                        : "transparent",
                  }}
                />
              ))}
            </div>
          </div>
          <p className="reference-note">
            {t(
              "Orange tiles reduced the selected class score when replaced with the first frame’s average color. This is model influence, not a lesion map.",
            )}
          </p>
        </>
      )}
      {visual.qualityWarnings?.map((w) => (
        <p className="warning-note" key={w}>
          {t(w)}
        </p>
      ))}
      <details>
        <summary>{t("Class scores and visual evidence")}</summary>
        <p className="reference-note">
          {t("Closest dataset label: ")}
          {t(visual.label)}
          {t(
            ". Scores are calibrated on an internal image set, not validated field confidence.",
          )}
        </p>
        {visual.scores.map((s) => (
          <div className="summary-row" key={s.label}>
            <span>{t(s.label)}</span>
            <strong>{(s.score * 100).toFixed(1)}%</strong>
          </div>
        ))}
        <p className="muted">
          {visual.sampledFrames}
          {t(" sampled frame")}
          {visual.sampledFrames === 1 ? "" : t("s")} ·{" "}
          {(visual.frameAgreement * 100).toFixed(0)}
          {t(
            "% class agreement. Video scores average sampled images; no trained activity model is used.",
          )}
        </p>
        <p className="reference-note">
          {t("Execution: ")}
          {visual.execution || t("not recorded")} ·{" "}
          {visual.runtime || t("runtime not recorded")}
        </p>
        {visual.modelSha256 && (
          <p className="reference-note" style={{ overflowWrap: "anywhere" }}>
            {t("Model SHA-256: ")}
            {visual.modelSha256}
          </p>
        )}
        <p className="reference-note">
          {t("Measured inference: ")}
          {visual.inferenceMs.toFixed(0)}
          {t(" ms; occlusion explanation: ")}
          {visual.explanationMs.toFixed(0)}
          {t(" ms. Model loading and media decoding excluded. Model: ")}
          {visual.version}.
        </p>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label={t("Visual influence values")}
        >
          <table>
            <caption>
              {t("First-frame occlusion score decrease (percentage points)")}
            </caption>
            <tbody>
              {[0, 1, 2, 3].map((row) => (
                <tr key={row}>
                  {[0, 1, 2, 3].map((col) => (
                    <td key={col}>
                      {(visual.influence[row * 4 + col] * 100).toFixed(1)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
export function LarvalModelEvidence() {
  const [model, setModel] = useState<LarvalModel | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadLarvalModel()
      .then((x) => {
        if (active) setModel(x.model);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="card form-card">
      <h2>{t("Larval model evidence")}</h2>
      {model ? (
        <>
          <p className="muted">
            {model.report.acquired_images.toLocaleString()}
            {t(" source images;")}{" "}
            {model.report.representative_images.toLocaleString()}{" "}
            {t("representatives after duplicate-family audit.")}{" "}
            {model.kind === "mobilenet_v3"
              ? t("MobileNetV3 with a trained classification head.")
              : t("Trained color and texture classifier.")}
          </p>
          <div className="summary-row">
            <span>{t("Internal held-out accuracy")}</span>
            <strong>
              {(
                (model.report.results[model.report.selected].test?.accuracy ??
                  0) * 100
              ).toFixed(1)}
              %
            </strong>
          </div>
          <div className="summary-row">
            <span>{t("Internal macro F1")}</span>
            <strong>
              {(
                model.report.results[model.report.selected].test?.macro_f1 ?? 0
              ).toFixed(3)}
            </strong>
          </div>
          <p className="reference-note">
            {t(
              "Single-source evaluation with heuristic duplicate grouping. Farm generalization, diagnostic accuracy and warning lead time remain unmeasured. Operational records start empty; research samples are not farm data.",
            )}
          </p>
        </>
      ) : (
        <p className="muted" role="status">
          {t(error) || t("Loading installed model evidence…")}
        </p>
      )}
      <a
        href="https://data.mendeley.com/datasets/g4b89vpp9c/1"
        target="_blank"
        rel="noreferrer"
      >
        {t("Mungase & Chiwhane · source dataset · CC BY 4.0 ↗")}
      </a>
    </section>
  );
}
