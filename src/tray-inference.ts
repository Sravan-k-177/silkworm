import { analyzeLarvalFrames, sampleLarvalPixels } from "./larval-model";
import {
  larvalVisualSchema,
  type LarvalVisual,
  type Visual,
} from "../shared/domain";
export type TrayCapture = {
  blob: Blob;
  thumbnail: string;
  kind: "image";
  name: string;
  visual: Visual;
};
export async function inferTray(
  blob: Blob,
  execution: "backend" | "device",
): Promise<{ result: LarvalVisual; capture: TrayCapture }> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type))
    throw Error("Choose a JPEG, PNG or WebP photo.");
  if (blob.size > 8 * 1024 * 1024) throw Error("Choose an image under 8 MB.");
  const decoded = await createImageBitmap(blob);
  try {
    if (decoded.width * decoded.height > 20_000_000)
      throw Error("Image is too large. Choose a photo under 20 megapixels.");
    const c = document.createElement("canvas"),
      scale = Math.min(1, 1280 / Math.max(decoded.width, decoded.height));
    c.width = Math.round(decoded.width * scale);
    c.height = Math.round(decoded.height * scale);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(decoded, 0, 0, c.width, c.height);
    // Inference and the retained photo use the same metadata-free pixels.
    const cleaned = await new Promise<Blob>((resolve, reject) =>
      c.toBlob(
        (b) => (b ? resolve(b) : reject(Error("Could not prepare photo"))),
        "image/png",
      ),
    );
    const thumbnail = c.toDataURL("image/jpeg", 0.8);
    let result: LarvalVisual;
    if (execution === "backend") {
      const token = sessionStorage.getItem("syncToken");
      const response = await fetch("/api/model/predict", {
        method: "POST",
        headers: {
          "Content-Type": cleaned.type,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: cleaned,
        signal: AbortSignal.timeout(35000),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || "Backend inference failed");
      result = larvalVisualSchema.parse(body);
      if (result.execution !== "backend")
        throw Error("Backend execution was not confirmed");
    } else {
      const pixels = sampleLarvalPixels(
        ctx.getImageData(0, 0, c.width, c.height).data,
        c.width,
        c.height,
      );
      result = await analyzeLarvalFrames([pixels]);
      let sum = 0,
        squares = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const gray = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        sum += gray;
        squares += gray * gray;
      }
      const n = pixels.length / 4,
        mean = sum / n,
        std = Math.sqrt(Math.max(0, squares / n - mean * mean)),
        warnings: string[] = [];
      if (mean < 35) warnings.push("Photo is too dark. Retake in even light.");
      if (mean > 235)
        warnings.push("Photo is overexposed. Retake without glare.");
      if (std < 8)
        warnings.push("Too little image detail. Retake a clear close view.");
      if (Math.min(c.width, c.height) < 224)
        warnings.push(
          "Photo resolution is low. Retake a higher-resolution image.",
        );
      result = {
        ...result,
        qualityWarnings: warnings,
        ...(warnings.length ? { decision: "uncertain" as const } : {}),
      };
    }
    return {
      result,
      capture: {
        blob: cleaned,
        thumbnail,
        kind: "image",
        name: "tray-check.png",
        visual: {
          status: "model",
          larval: result,
          warnings: result.qualityWarnings || [],
          modelVersion: result.version,
        },
      },
    };
  } finally {
    decoded.close();
  }
}
