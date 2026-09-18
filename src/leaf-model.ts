import { leafExecutionSchema, type LeafEvidence } from "../shared/domain";
export type LeafModel = {
  modelSha256?: string;
  version: string;
  task: string;
  classes: string[];
  featureVersion: string;
  type: "forest" | "logistic";
  trees?: {
    left: number[];
    right: number[];
    feature: number[];
    threshold: number[];
    value: number[][];
  }[];
  mean?: number[];
  scale?: number[];
  weights?: number[][];
  bias?: number[];
  report: {
    partial_corpus: boolean;
    acquired_images: number;
    selected: string;
    results: Record<string, { test?: { accuracy: number; macro_f1: number } }>;
  };
};
export function extractFeatures(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const a = new Float64Array(4096 * 3);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const sy = Math.min(Math.floor(((y + 0.5) * height) / 64), height - 1),
        sx = Math.min(Math.floor(((x + 0.5) * width) / 64), width - 1);
      for (let c = 0; c < 3; c++)
        a[(y * 64 + x) * 3 + c] = pixels[(sy * width + sx) * 4 + c] / 255;
    }
  const result: number[] = [];
  for (let c = 0; c < 3; c++) {
    const hist = new Float64Array(16);
    for (let i = 0; i < 4096; i++)
      hist[Math.min(Math.floor(a[i * 3 + c] * 16), 15)]++;
    result.push(...Array.from(hist, (n) => n / 4096));
  }
  for (let gy = 0; gy < 4; gy++)
    for (let gx = 0; gx < 4; gx++)
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let y = gy * 16; y < (gy + 1) * 16; y++)
          for (let x = gx * 16; x < (gx + 1) * 16; x++)
            sum += a[(y * 64 + x) * 3 + c];
        const mean = sum / 256;
        let variance = 0;
        for (let y = gy * 16; y < (gy + 1) * 16; y++)
          for (let x = gx * 16; x < (gx + 1) * 16; x++)
            variance += (a[(y * 64 + x) * 3 + c] - mean) ** 2;
        result.push(mean, Math.sqrt(variance / 256));
      }
  const gray = new Float64Array(4096);
  for (let i = 0; i < 4096; i++)
    gray[i] = a[i * 3] * 0.299 + a[i * 3 + 1] * 0.587 + a[i * 3 + 2] * 0.114;
  const hist = new Float64Array(9);
  let total = 0;
  for (let y = 1; y < 63; y++)
    for (let x = 1; x < 63; x++) {
      const i = y * 64 + x,
        dx = gray[i + 1] - gray[i - 1],
        dy = gray[i + 64] - gray[i - 64],
        mag = Math.sqrt(dx * dx + dy * dy);
      const angle = (Math.atan2(dy, dx) + Math.PI) % Math.PI;
      hist[Math.min(Math.floor((angle / Math.PI) * 9), 8)] += mag;
      total += mag;
    }
  result.push(...Array.from(hist, (n) => n / (total + 1e-12)));
  return result;
}
export function predict(model: LeafModel, features: number[]) {
  if (features.length !== 153 || features.some((x) => !Number.isFinite(x)))
    throw new Error("Invalid image features.");
  const probabilities = new Array(model.classes.length).fill(0) as number[];
  if (model.type === "forest") {
    const f = new Float32Array(features);
    for (const t of model.trees!) {
      let i = 0;
      while (t.left[i] !== -1)
        i = f[t.feature[i]] <= t.threshold[i] ? t.left[i] : t.right[i];
      for (let c = 0; c < probabilities.length; c++)
        probabilities[c] += t.value[i][c] / model.trees!.length;
    }
  } else {
    const scaled = features.map(
      (x, i) => (x - model.mean![i]) / model.scale![i],
    );
    const logits = model.weights!.map((row, c) =>
      row.reduce((n, w, i) => n + w * scaled[i], model.bias![c]),
    );
    const maximum = Math.max(...logits);
    const exp = logits.map((l) => Math.exp(l - maximum));
    const sum = exp.reduce((a, b) => a + b, 0);
    for (let c = 0; c < probabilities.length; c++)
      probabilities[c] = exp[c] / sum;
  }
  return probabilities;
}
let modelPromise: Promise<LeafModel> | undefined;
export function loadLeafModel() {
  return (modelPromise ??= (async () => {
    const response = await fetch("/models/mulberry-baseline.json");
    if (!response.ok)
      throw new Error(
        "The trained feed-leaf model is not installed yet. Capture and checklist assessments still work.",
      );
    const bytes = await response.arrayBuffer();
    const model = JSON.parse(new TextDecoder().decode(bytes));
    model.modelSha256 = await digest(new Uint8Array(bytes));
    if (
      model.task !== "mulberry-leaf-only" ||
      model.version !== "mulberry-baseline-v1" ||
      JSON.stringify(model.classes) !==
        JSON.stringify(["Healthy", "Leaf rust", "Leaf spot"]) ||
      model.featureVersion !== "rgb-texture-153-v1" ||
      !Array.isArray(model.classes) ||
      !["forest", "logistic"].includes(model.type)
    )
      throw new Error("Unsupported model file.");
    return model as LeafModel;
  })().catch((e) => {
    modelPromise = undefined;
    throw e;
  }));
}
export type LeafExecution = "auto" | "backend" | "device";
async function digest(bytes: Uint8Array<ArrayBuffer>) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function classifyLeaf(
  file: File,
  execution: LeafExecution = "auto",
  onProgress: (message: string) => void = () => {},
) {
  if (!file.type.startsWith("image/"))
    throw new Error("Choose a leaf photograph.");
  if (file.size > 30 * 1024 * 1024)
    throw new Error("Choose an image under 30 MB.");
  onProgress("Loading trained leaf model…");
  const model = await loadLeafModel();
  onProgress("Decoding leaf photo…");
  const image = await createImageBitmap(file);
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 224;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, 224, 224);
    const pixels = ctx.getImageData(0, 0, 224, 224);
    const mode =
      execution === "auto"
        ? navigator.onLine
          ? "backend"
          : "device"
        : execution;
    const rgb = new Uint8Array(224 * 224 * 3);
    for (let i = 0; i < 224 * 224; i++)
      for (let ch = 0; ch < 3; ch++) rgb[i * 3 + ch] = pixels.data[i * 4 + ch];
    const inputSha256 = await digest(rgb);
    let receipt;
    if (mode === "backend") {
      onProgress(
        "Running leaf model and 16 masking checks on the local server…",
      );
      const png = await new Promise<Blob>((resolve, reject) =>
        c.toBlob(
          (b) =>
            b ? resolve(b) : reject(Error("Unable to prepare leaf photo")),
          "image/png",
        ),
      );
      const token = sessionStorage.getItem("syncToken");
      const response = await fetch("/api/model/leaf/predict", {
        method: "POST",
        headers: {
          "Content-Type": "image/png",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: png,
        signal: AbortSignal.timeout(65000),
      });
      const body = await response.json();
      if (!response.ok)
        throw Error(
          body.error || "Leaf inference failed. No result was generated.",
        );
      receipt = leafExecutionSchema.parse(body);
      if (
        receipt.execution !== "backend" ||
        receipt.modelSha256 !== model.modelSha256 ||
        receipt.inputSha256 !== inputSha256
      )
        throw Error(
          "Leaf inference verification failed. Model or photo does not match.",
        );
    } else {
      onProgress("Running trained leaf model on this device…");
      let modelRuns = 0;
      const run = (data: Uint8ClampedArray) => {
        modelRuns++;
        return predict(model, extractFeatures(data, 224, 224));
      };
      const start = performance.now();
      const scores = run(pixels.data);
      const inferenceMs = performance.now() - start;
      const winner = scores.indexOf(Math.max(...scores));
      const mean = [0, 0, 0];
      for (let i = 0; i < 224 * 224; i++)
        for (let ch = 0; ch < 3; ch++)
          mean[ch] += pixels.data[i * 4 + ch] / (224 * 224);
      const influence: number[] = [];
      const explanationStart = performance.now();
      for (let row = 0; row < 4; row++)
        for (let col = 0; col < 4; col++) {
          onProgress("Measuring leaf image influence…");
          const altered = new Uint8ClampedArray(pixels.data);
          for (let y = row * 56; y < (row + 1) * 56; y++)
            for (let x = col * 56; x < (col + 1) * 56; x++)
              for (let ch = 0; ch < 3; ch++)
                altered[(y * 224 + x) * 4 + ch] = Math.round(mean[ch]);
          influence.push(scores[winner] - run(altered)[winner]);
          // Yield between actual model executions so the browser can paint progress.
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      receipt = leafExecutionSchema.parse({
        execution: "device",
        runtime: "JavaScript logistic regression",
        modelSha256: model.modelSha256,
        inputSha256,
        scores,
        influence,
        inferenceMs,
        explanationMs: performance.now() - explanationStart,
        modelRuns,
      });
    }
    if (Math.abs(receipt.scores.reduce((a, b) => a + b, 0) - 1) > 1e-6)
      throw Error("Invalid leaf model probabilities");
    const probabilities = receipt.scores,
      influence = receipt.influence,
      elapsed = receipt.inferenceMs;
    const winner = probabilities.indexOf(Math.max(...probabilities));
    const gray = Array.from(
      { length: 224 * 224 },
      (_, i) =>
        pixels.data[i * 4] * 0.299 +
        pixels.data[i * 4 + 1] * 0.587 +
        pixels.data[i * 4 + 2] * 0.114,
    );
    const brightness = gray.reduce((a, b) => a + b, 0) / gray.length;
    let edges = 0;
    for (let y = 1; y < 223; y++)
      for (let x = 1; x < 223; x++) {
        const i = y * 224 + x;
        edges +=
          (4 * gray[i] -
            gray[i - 1] -
            gray[i + 1] -
            gray[i - 224] -
            gray[i + 224]) **
          2;
      }
    const qualityWarnings: string[] = [];
    if (Math.min(image.width, image.height) < 128)
      qualityWarnings.push("Leaf photo is too small. Retake a close view.");
    if (brightness < 35 || brightness > 225)
      qualityWarnings.push(
        "Leaf photo lighting is unsuitable. Retake in even light.",
      );
    if (edges / (222 * 222) < 10)
      qualityWarnings.push("Leaf photo lacks detail. Retake in focus.");
    const evidence: LeafEvidence = {
      executionReceipt: receipt,
      task: "mulberry-leaf-only",
      version: "mulberry-baseline-v1",
      label: model.classes[winner] as LeafEvidence["label"],
      scores: probabilities,
      qualityWarnings,
      confirmedMulberry: false,
      capturedAt: new Date().toISOString(),
      mediaId: null,
    };
    const stored = document.createElement("canvas");
    const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
    stored.width = Math.round(image.width * scale);
    stored.height = Math.round(image.height * scale);
    stored
      .getContext("2d")!
      .drawImage(image, 0, 0, stored.width, stored.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      stored.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Unable to store photo."))),
        "image/jpeg",
        0.9,
      ),
    );
    const thumbnail = c.toDataURL("image/jpeg", 0.85);
    return {
      model,
      probabilities,
      winner,
      thumbnail,
      elapsed,
      influence,
      evidence,
      blob,
    };
  } finally {
    image.close();
  }
}

export type LeafCapture = Awaited<ReturnType<typeof classifyLeaf>>;
