import type { LarvalVisual } from "../shared/domain";
import { extractFeatures, predict, type LeafModel } from "./leaf-model";
export type LarvalModel = {
  version: "larval-appearance-v1";
  task: "silkworm-appearance-only";
  classes: LarvalVisual["label"][];
  kind: "mobilenet_v3" | "color_texture";
  temperature: number;
  abstainThreshold: number;
  onnxPath?: string;
  report: {
    acquired_images: number;
    representative_images: number;
    selected: string;
    model_family: string;
    onnx_sha256?: string;
    partition_sizes: Record<string, number>;
    results: Record<string, { test?: { accuracy: number; macro_f1: number } }>;
  };
} & Partial<Omit<LeafModel, "classes">>;
let loaded:
  | Promise<{
      model: LarvalModel;
      run: (rgba: Uint8ClampedArray) => Promise<number[]>;
    }>
  | undefined;
export function softmax(logits: number[]) {
  const m = Math.max(...logits),
    ex = logits.map((x) => Math.exp(x - m)),
    sum = ex.reduce((a, b) => a + b, 0);
  return ex.map((x) => x / sum);
}
/** Identical nearest-centre sampling used in audit_larval.py; no browser-dependent resize. */
export function sampleLarvalPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) {
  if (width < 1 || height < 1 || pixels.length !== width * height * 4)
    throw new Error("Invalid image pixels.");
  const out = new Uint8ClampedArray(224 * 224 * 4);
  for (let y = 0; y < 224; y++)
    for (let x = 0; x < 224; x++) {
      const sy = Math.min(Math.floor(((y + 0.5) * height) / 224), height - 1),
        sx = Math.min(Math.floor(((x + 0.5) * width) / 224), width - 1);
      for (let c = 0; c < 4; c++)
        out[(y * 224 + x) * 4 + c] = pixels[(sy * width + sx) * 4 + c];
    }
  return out;
}
export function larvalTensor(pixels: Uint8ClampedArray) {
  if (pixels.length !== 224 * 224 * 4)
    throw new Error("Expected a 224-pixel square.");
  const out = new Float32Array(3 * 224 * 224),
    mean = [0.485, 0.456, 0.406],
    std = [0.229, 0.224, 0.225];
  for (let i = 0; i < 224 * 224; i++)
    for (let c = 0; c < 3; c++)
      out[c * 224 * 224 + i] = (pixels[i * 4 + c] / 255 - mean[c]) / std[c];
  return out;
}
export function loadLarvalModel() {
  return (loaded ??= (async () => {
    const response = await fetch("/models/larval-appearance.json");
    if (!response.ok)
      throw new Error(
        "Larval model is unavailable on this device. Reconnect once to install it.",
      );
    const model = (await response.json()) as LarvalModel;
    if (
      model.task !== "silkworm-appearance-only" ||
      model.version !== "larval-appearance-v1" ||
      !Array.isArray(model.classes) ||
      model.classes.join("|") !==
        "Flacherie|Grasserie|Healthy|Overlap|Pebrine" ||
      !Number.isFinite(model.temperature) ||
      model.temperature <= 0
    )
      throw new Error("Unsupported larval model contract.");
    if (model.kind === "color_texture")
      return {
        model,
        run: async (p: Uint8ClampedArray) => {
          const scores = predict(
            model as LeafModel,
            extractFeatures(p, 224, 224),
          );
          return softmax(
            scores.map((x) => Math.log(Math.max(x, 1e-30)) / model.temperature),
          );
        },
      };
    if (
      model.kind !== "mobilenet_v3" ||
      model.onnxPath !== "/models/larval-appearance.onnx"
    )
      throw new Error("Unsupported larval model artifact.");
    const ort = await import("onnxruntime-web/wasm");
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = "/runtime/";
    const weights = await fetch(model.onnxPath);
    if (!weights.ok) throw new Error("Neural network weights are unavailable.");
    const bytes = await weights.arrayBuffer();
    const checksum = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    if (checksum !== model.report.onnx_sha256)
      throw new Error(
        "Model checksum mismatch. Reconnect to install a consistent model.",
      );
    const session = await ort.InferenceSession.create(bytes, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    return {
      model,
      run: async (p: Uint8ClampedArray) => {
        const input = new ort.Tensor(
          "float32",
          larvalTensor(p),
          [1, 3, 224, 224],
        );
        const output = await session.run({ image: input });
        try {
          return softmax(Array.from(output.logits.data as Float32Array));
        } finally {
          input.dispose();
          Object.values(output).forEach((t) => t.dispose());
        }
      },
    };
  })().catch((e) => {
    loaded = undefined;
    throw e;
  }));
}
export function appearanceDecision(
  classes: string[],
  scores: number[],
  agreement: number,
  threshold: number,
) {
  const winner = scores.indexOf(Math.max(...scores));
  if (classes[winner] === "Overlap") return "overlap" as const;
  if (scores[winner] < threshold || agreement < 0.6)
    return "uncertain" as const;
  return classes[winner] === "Healthy"
    ? ("no-visible-alert" as const)
    : ("review" as const);
}
export async function analyzeLarvalFrames(
  frames: Uint8ClampedArray[],
): Promise<LarvalVisual> {
  if (!frames.length || frames.length > 5)
    throw new Error("Expected one to five sampled frames.");
  const { model, run } = await loadLarvalModel();
  const start = performance.now(),
    perFrame: number[][] = [];
  for (const frame of frames) {
    perFrame.push(await run(frame));
    await new Promise((r) => setTimeout(r, 0));
  }
  const scores = model.classes.map(
      (_, i) => perFrame.reduce((s, p) => s + p[i], 0) / frames.length,
    ),
    winner = scores.indexOf(Math.max(...scores));
  const agreement =
    perFrame.filter((p) => p.indexOf(Math.max(...p)) === winner).length /
    frames.length;
  const inferenceMs = performance.now() - start;
  // Explain first sampled frame, using its score for the pooled winning class as reference.
  const influence: number[] = [],
    pixels = frames[0],
    mean = [0, 0, 0];
  for (let i = 0; i < 224 * 224; i++)
    for (let c = 0; c < 3; c++) mean[c] += pixels[i * 4 + c] / (224 * 224);
  for (let gy = 0; gy < 4; gy++)
    for (let gx = 0; gx < 4; gx++) {
      const altered = new Uint8ClampedArray(pixels);
      for (let y = gy * 56; y < (gy + 1) * 56; y++)
        for (let x = gx * 56; x < (gx + 1) * 56; x++)
          for (let c = 0; c < 3; c++)
            altered[(y * 224 + x) * 4 + c] = Math.round(mean[c]);
      const p = await run(altered);
      influence.push(perFrame[0][winner] - p[winner]);
      await new Promise((r) => setTimeout(r, 0));
    }
  return {
    execution: "device",
    modelSha256: model.report.onnx_sha256,
    runtime:
      model.kind === "mobilenet_v3" ? "ONNX Runtime Web / WASM" : "JavaScript",
    architecture:
      model.kind === "mobilenet_v3"
        ? "MobileNetV3-Small + trained classification head"
        : "Color and texture classifier",
    task: "silkworm-appearance-only",
    version: model.version,
    decision: appearanceDecision(
      model.classes,
      scores,
      agreement,
      model.abstainThreshold,
    ),
    label: model.classes[winner],
    scores: model.classes.map((label, i) => ({ label, score: scores[i] })),
    inferenceMs,
    explanationMs: performance.now() - start - inferenceMs,
    influence,
    frameAgreement: agreement,
    sampledFrames: frames.length,
  };
}
