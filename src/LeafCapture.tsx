import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  classifyLeaf,
  type LeafCapture,
  type LeafExecution,
} from "./leaf-model";
import type { LeafEvidence } from "../shared/domain";
import { leafReviewState } from "../shared/risk";
import { db } from "./db";
import { t } from "./i18n";
export function LeafExecutionPicker({
  value,
  onChange,
  disabled,
}: {
  value: LeafExecution;
  onChange: (v: LeafExecution) => void;
  disabled: boolean;
}) {
  return (
    <label className="field">
      <span>{t("Run leaf model on")}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as LeafExecution)}
      >
        <option value="auto">
          {t("Automatic: local server online, this device offline")}
        </option>
        <option value="backend">{t("Local server")}</option>
        <option value="device">{t("This device")}</option>
      </select>
      <small>
        {t(
          "Server mode sends the prepared photo to your local model service. It does not fall back if the server fails.",
        )}
      </small>
    </label>
  );
}
export function LeafResult({
  evidence,
  thumbnail,
}: {
  evidence: LeafEvidence;
  thumbnail?: string;
}) {
  const media = useLiveQuery(
    () => (evidence.mediaId ? db.media.get(evidence.mediaId) : undefined),
    [evidence.mediaId],
  );
  const state = leafReviewState(evidence);
  return (
    <section className="card form-card">
      <h3>{t("Mulberry leaf evidence")}</h3>
      {(thumbnail || media?.thumbnail) && (
        <img
          src={thumbnail || media?.thumbnail}
          alt={t("Uploaded mulberry leaf")}
          style={{ width: 160, maxWidth: "100%", borderRadius: 12 }}
        />
      )}
      <p>
        {t(
          state === "review"
            ? "Leaf photo needs feed review · 20 feed priority points"
            : state === "no-visible-alert"
              ? "No visible leaf alert · feed safety is not established"
              : "Leaf photo uncertain · confirm the plant or retake the photo",
        )}
      </p>
      <p>
        {t("Closest trained class: ")}
        {t(evidence.label)}
      </p>
      {evidence.qualityWarnings.map((w) => (
        <p className="warning-note" key={w}>
          {t(w)}
        </p>
      ))}
      {evidence.executionReceipt && (
        <div className="spaced">
          <p>
            <strong>
              {t("Leaf model executed on:")}{" "}
              {evidence.executionReceipt.execution}
            </strong>
          </p>
          <p>{evidence.executionReceipt.runtime}</p>
          <p>
            {t("Measured inference:")}{" "}
            {evidence.executionReceipt.inferenceMs.toFixed(1)} ms ·{" "}
            {t("Masking checks:")}{" "}
            {evidence.executionReceipt.explanationMs.toFixed(1)} ms
          </p>
          <details>
            <summary>{t("Inspect leaf execution evidence")}</summary>
            <p>
              {t("Actual model executions:")}{" "}
              {evidence.executionReceipt.modelRuns}
            </p>
            <p style={{ overflowWrap: "anywhere" }}>
              {t("Model SHA-256:")} {evidence.executionReceipt.modelSha256}
            </p>
            <p style={{ overflowWrap: "anywhere" }}>
              {t("Prepared photo SHA-256:")}{" "}
              {evidence.executionReceipt.inputSha256}
            </p>
            <p>
              {t(
                "Each row is a measured score change after masking that tile and rerunning the model. These are not detected disease regions.",
              )}
            </p>
            <table
              style={{
                whiteSpace: "normal",
                tableLayout: "fixed",
                overflowWrap: "anywhere",
              }}
              aria-label={t("Measured leaf masking results")}
            >
              <thead>
                <tr>
                  <th>{t("Tile (row, column)")}</th>
                  <th>{t("Score change (percentage points)")}</th>
                </tr>
              </thead>
              <tbody>
                {evidence.executionReceipt.influence.map((v, i) => (
                  <tr key={i}>
                    <td>
                      {Math.floor(i / 4) + 1}, {(i % 4) + 1}
                    </td>
                    <td>{(v * 100).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}
      <details>
        <summary>{t("Leaf class scores")}</summary>
        {["Healthy", "Leaf rust", "Leaf spot"].map((name, i) => (
          <p key={name}>
            {t(name)}: {(evidence.scores[i] * 100).toFixed(1)}%
          </p>
        ))}
        <p>
          {t(
            "Leaf model scores are uncalibrated; they are not disease probabilities.",
          )}
        </p>
        <p>
          {evidence.version} · {evidence.capturedAt}
        </p>
      </details>
    </section>
  );
}
export default function LeafPhotoInput({
  value,
  onChange,
  onBusy,
}: {
  value: LeafCapture | null;
  onChange: (v: LeafCapture | null) => void;
  onBusy: (b: boolean) => void;
}) {
  const [execution, setExecution] = useState<LeafExecution>("auto");
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="card form-card">
      <h2>{t("Photograph the mulberry feed")}</h2>
      <p>
        {t(
          "Use a close, well-lit photo of one mulberry leaf from the feed for this batch. Leaf and tray photos are recorded separately.",
        )}
      </p>
      <LeafExecutionPicker
        value={execution}
        onChange={setExecution}
        disabled={busy}
      />
      <label className="field">
        <span>{t("Mulberry leaf photo")}</span>
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            onBusy(true);
            setError("");
            onChange(null);
            try {
              onChange(await classifyLeaf(file, execution, setProgress));
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
              onBusy(false);
            }
          }}
        />
      </label>
      {busy && <p role="status">{t(progress)}</p>}
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      {value && (
        <>
          <label className="check-row">
            <input
              type="checkbox"
              checked={value.evidence.confirmedMulberry}
              onChange={(e) =>
                onChange({
                  ...value,
                  evidence: {
                    ...value.evidence,
                    confirmedMulberry: e.target.checked,
                  },
                })
              }
            />
            {t("I confirm this is a mulberry leaf from this batch’s feed")}
          </label>
          <LeafResult evidence={value.evidence} thumbnail={value.thumbnail} />
          <button
            type="button"
            className="text-button"
            onClick={() => onChange(null)}
          >
            {t("Remove leaf photo")}
          </button>
        </>
      )}
    </section>
  );
}
