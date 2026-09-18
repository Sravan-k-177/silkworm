import { t } from "./i18n";
import { useRef, useState } from "react";
import { ArrowLeft, CircleHelp, Leaf, LoaderCircle } from "lucide-react";
import { LeafResult, LeafExecutionPicker } from "./LeafCapture";
import type { LeafCapture, LeafExecution } from "./leaf-model";
import { classifyLeaf } from "./leaf-model";
export default function LeafLab({
  back,
  onUse,
}: {
  back: () => void;
  onUse?: (leaf: LeafCapture) => void;
}) {
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof classifyLeaf>
  > | null>(null);
  const [execution, setExecution] = useState<LeafExecution>("auto");
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button className="back-link" onClick={back}>
        <ArrowLeft size={17} />
        {t("Back to today")}
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {t("AUXILIARY FEED REVIEW · EXPERIMENTAL")}
          </div>
          <h1>{t("Look at the leaf, too.")}</h1>
          <p>
            {t(
              "Check mulberry feed locally, then attach the photo and result to a batch assessment for feed-review scoring.",
            )}
          </p>
        </div>
      </div>
      <div className="result-layout">
        <section>
          <div className="card form-card">
            <h2>{t("Check a mulberry leaf")}</h2>
            <p className="muted">
              {t(
                "Photograph one leaf in clear light. This model is limited to healthy-looking, rust-labeled and spot-labeled images from one research collection.",
              )}
            </p>
            <LeafExecutionPicker
              value={execution}
              onChange={setExecution}
              disabled={busy}
            />
            <input
              disabled={busy}
              className="visually-hidden"
              aria-label={t("Choose mulberry leaf photo")}
              ref={ref}
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setBusy(true);
                setError("");
                setResult(null);
                try {
                  setResult(await classifyLeaf(f, execution, setProgress));
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                  e.target.value = "";
                }
              }}
            />
            <button
              className="capture-zone"
              onClick={() => ref.current?.click()}
              disabled={busy}
            >
              <span className="camera-circle">
                {busy ? <LoaderCircle className="spin" /> : <Leaf />}
              </span>
              <strong>
                {busy ? t(progress) : t("Choose a leaf photograph")}
              </strong>
              <span>
                {t("Runs the trained leaf classifier on your selected runtime")}
              </span>
            </button>
            {error && (
              <div className="error" role="alert">
                {t(error)}
              </div>
            )}
          </div>
          {result && (
            <>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={result.evidence.confirmedMulberry}
                  onChange={(e) =>
                    setResult({
                      ...result,
                      evidence: {
                        ...result.evidence,
                        confirmedMulberry: e.target.checked,
                      },
                    })
                  }
                />
                {t("I confirm this is a mulberry leaf from this batch’s feed")}
              </label>
              <LeafResult
                evidence={result.evidence}
                thumbnail={result.thumbnail}
              />
              {onUse && (
                <button
                  className="button primary"
                  onClick={() => onUse(result)}
                >
                  {t("Use this leaf result in a batch assessment")}
                </button>
              )}
              <div className="card form-card">
                <div className="eyebrow">{t("EXPERIMENTAL MODEL OUTPUT")}</div>
                <h2>
                  {t("Closest trained class: ")}
                  {t(result.model.classes[result.winner])}
                </h2>
                <p className="muted">
                  {t(
                    "A class assignment, not a confirmed disease or feed-safety decision.",
                  )}
                </p>
                {result.model.classes.map((c, i) => (
                  <div className="factor" key={c}>
                    <div className="factor-head">
                      <span>{t(c)}</span>
                      <strong>
                        {(result.probabilities[i] * 100).toFixed(1)}%
                      </strong>
                    </div>
                    <div className="factor-track">
                      <span
                        style={{ width: `${result.probabilities[i] * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                <p className="reference-note spaced">
                  {t(
                    "Model scores are uncalibrated. Unsupported plants, backgrounds and larvae can still receive a confident-looking class assignment.",
                  )}
                </p>
              </div>
            </>
          )}
        </section>
        <aside>
          <div className="care-card">
            <CircleHelp />
            <h3 className="spaced">{t("What the leaf model measures")}</h3>
            <p>
              {t(
                "This trained logistic-regression classifier compares color and texture with its three training classes. It does not locate lesions. Inspect execution evidence for the actual masking measurements.",
              )}
            </p>
          </div>
          {result && (
            <div className="card form-card">
              <h3>{t("Model evidence")}</h3>
              <p className="muted">
                {result.model.report.acquired_images}
                {t(" real images")}{" "}
                {result.model.report.partial_corpus
                  ? t("from a partial download")
                  : t("from the original collection")}
                {t(
                  ". Duplicate groups separated before training, validation and test.",
                )}
              </p>
              <p className="muted">
                {t("Held-out accuracy:")}{" "}
                {(
                  (result.model.report.results[result.model.report.selected]
                    .test?.accuracy || 0) * 100
                ).toFixed(1)}
                {t(
                  "%. Single-source internal evaluation; field performance unmeasured.",
                )}
              </p>
              <a
                href="https://www.kaggle.com/datasets/nahiduzzaman13/mulberry-leaf-dataset/data"
                target="_blank"
                rel="noreferrer"
              >
                {t("Original dataset · CC0 ↗")}
              </a>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
