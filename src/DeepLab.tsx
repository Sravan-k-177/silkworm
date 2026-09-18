import { t } from "./i18n";
import { useEffect, useRef, useState } from "react";
import LarvalEvidence from "./LarvalEvidence";
import type { LarvalVisual } from "../shared/domain";
import { inferTray, type TrayCapture } from "./tray-inference";
type Result = LarvalVisual;
export default function DeepLab({
  back,
  onUse,
}: {
  back: () => void;
  onUse?: (capture: TrayCapture) => void;
}) {
  const [execution, setExecution] = useState<"backend" | "device">("backend");
  const [captured, setCaptured] = useState<TrayCapture | null>(null);
  const [result, setResult] = useState<Result | null>(null),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [camera, setCamera] = useState(false);
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    file = useRef<HTMLInputElement>(null),
    mounted = useRef(true);
  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamera(false);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  async function startCamera() {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw Error(
          "Camera requires localhost or HTTPS and a supported browser.",
        );
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (!mounted.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      setCamera(true);
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = s;
          void video.current
            .play()
            .catch(() => setError("Could not start camera preview."));
        }
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function analyze(blob: Blob) {
    setBusy(true);
    setError("");
    setResult(null);
    setCaptured(null);
    try {
      const output = await inferTray(blob, execution);
      if (!mounted.current) return;
      setPreview(output.capture.thumbnail);
      setCaptured(output.capture);
      setResult(output.result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function capture() {
    if (!video.current?.videoWidth) return;
    const c = document.createElement("canvas");
    const scale = Math.min(1, 1280 / video.current.videoWidth);
    c.width = Math.round(video.current.videoWidth * scale);
    c.height = Math.round(video.current.videoHeight * scale);
    c.getContext("2d")!.drawImage(video.current, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      c.toBlob(resolve, "image/jpeg", 0.9),
    );
    stop();
    if (blob) await analyze(blob);
  }
  return (
    <>
      <button
        className="back-link"
        onClick={() => {
          stop();
          back();
        }}
      >
        {t("Back to today")}
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {t("MOBILENETV3 ·")}{" "}
            {execution === "backend"
              ? t("SERVER INFERENCE")
              : t("ON-DEVICE INFERENCE")}
          </div>
          <h1>{t("Deep-learning tray check")}</h1>
          <p>
            {t(
              "Use the trained MobileNetV3 model on the server or on this device, then link its evidence to a batch.",
            )}
          </p>
        </div>
      </div>
      <div className="result-layout">
        <section>
          <div className="card form-card">
            <h2>{t("Take or upload a photo")}</h2>
            <label className="field">
              <span>{t("Run model on")}</span>
              <select
                value={execution}
                disabled={busy || camera}
                onChange={(e) => {
                  setExecution(e.target.value as "backend" | "device");
                  setResult(null);
                  setCaptured(null);
                }}
              >
                <option value="backend">{t("Backend server")}</option>
                <option value="device">
                  {t("This device · works offline after installation")}
                </option>
              </select>
            </label>
            <p>
              {execution === "backend"
                ? t(
                    "The prepared photo is sent to the inference server and processed in memory. It is not saved there.",
                  )
                : t(
                    "The photo stays on this device. The installed model runs locally; reconnect once if it has not been cached.",
                  )}
            </p>
            <input
              ref={file}
              type="file"
              className="visually-hidden"
              aria-label={t("Upload image for backend inference")}
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void analyze(f);
                e.target.value = "";
              }}
            />
            <div className="button-row">
              <button
                className="button primary"
                onClick={() => file.current?.click()}
                disabled={busy || camera}
              >
                {t("Upload & analyze")}
              </button>
              <button
                className="button secondary"
                onClick={() => void startCamera()}
                disabled={busy || camera}
              >
                {t("Start camera")}
              </button>
            </div>
            {camera && (
              <>
                <video
                  ref={video}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: "100%", marginTop: 16 }}
                  aria-label={t("Live camera preview")}
                />
                <div className="button-row">
                  <button
                    className="button primary"
                    onClick={() => void capture()}
                  >
                    {t("Take photo & analyze")}
                  </button>
                  <button className="button secondary" onClick={stop}>
                    {t("Stop camera")}
                  </button>
                </div>
              </>
            )}
            {busy && (
              <p role="status">
                {t(
                  "Running neural network and 16 image occlusion checks on the selected runtime…",
                )}
              </p>
            )}
            {error && (
              <p role="alert" className="error">
                {t(error)}
              </p>
            )}
            <p className="reference-note">
              {t(
                "This model compares dataset appearance classes. Unsupported objects may still score highly. “Healthy” does not certify health or feed quality.",
              )}
            </p>
          </div>
          {result && (
            <>
              <LarvalEvidence visual={result} thumbnail={preview} />
              <div className="card form-card">
                <h2>{t("Turn this check into care")}</h2>
                <p>
                  {result.decision === "review"
                    ? t(
                        "Request a trained officer’s review and record the affected tray. This image cannot confirm a disease.",
                      )
                    : result.decision === "no-visible-alert"
                      ? t(
                          "Continue checking actual feeding, deaths and shed conditions. A healthy-looking image does not clear other concerns.",
                        )
                      : t(
                          "Retake a clear, separate view of the larvae. Record any unusual feeding or deaths even when the image is uncertain.",
                        )}
                </p>
                <p>
                  {t(
                    "Add the batch, instar and measured shed conditions to get the existing care guide and conservative feed scenario.",
                  )}
                </p>
                {onUse && captured && (
                  <button
                    className="button primary"
                    onClick={() => onUse(captured)}
                  >
                    {t("Use this result in a batch assessment")}
                  </button>
                )}
              </div>
            </>
          )}
        </section>
        <aside>
          <div className="card form-card">
            <h2>{t("Proof of execution")}</h2>
            {result ? (
              <>
                <p>
                  <strong>
                    {t("Executed on: ")}
                    {result.execution}
                  </strong>
                </p>
                <p>{result.architecture}</p>
                <p>{result.runtime}</p>
                <p>
                  {t("Inference: ")}
                  {result.inferenceMs.toFixed(1)}
                  {t(" ms")}
                  <br />
                  {t("Occlusion: ")}
                  {result.explanationMs.toFixed(1)}
                  {t(" ms")}
                </p>
                <p
                  className="reference-note"
                  style={{ overflowWrap: "anywhere" }}
                >
                  {t("Loaded model SHA-256: ")}
                  {result.modelSha256}
                </p>
              </>
            ) : (
              <p>
                {t(
                  "After inference, this panel shows the model checksum, selected runtime, and measured execution time.",
                )}
              </p>
            )}
            <a href="/api/model/health" target="_blank" rel="noreferrer">
              {t("Inspect backend model health ↗")}
            </a>
          </div>
          <div className="care-card">
            <h3>{t("Research sample")}</h3>
            <p>
              {t(
                "For a reproducible demonstration, download this held-out dataset image and upload it above. It is a research example, not an independent farm test.",
              )}
            </p>
            <a href="/demo/larval-heldout.png" download>
              {t("Download test image")}
            </a>
          </div>
        </aside>
      </div>
    </>
  );
}
