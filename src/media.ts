import { analyzeLarvalFrames, sampleLarvalPixels } from "./larval-model";
import type { Visual } from "../shared/domain";
function quality(canvas: HTMLCanvasElement) {
  const q = document.createElement("canvas");
  q.width = q.height = 128;
  const ctx = q.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(canvas, 0, 0, 128, 128);
  const pixels = ctx.getImageData(0, 0, 128, 128).data;
  const gray = new Float32Array(128 * 128);
  let sum = 0;
  for (let i = 0; i < gray.length; i++) {
    gray[i] =
      pixels[i * 4] * 0.299 +
      pixels[i * 4 + 1] * 0.587 +
      pixels[i * 4 + 2] * 0.114;
    sum += gray[i];
  }
  let edges = 0,
    n = 0;
  for (let y = 1; y < 127; y++)
    for (let x = 1; x < 127; x++) {
      const i = y * 128 + x;
      const lap =
        4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - 128] - gray[i + 128];
      edges += lap * lap;
      n++;
    }
  return { brightness: sum / gray.length, sharpness: edges / n, gray };
}
export async function processMedia(file: File): Promise<{
  blob: Blob;
  thumbnail: string;
  kind: "image" | "video";
  visual: Visual;
}> {
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/"))
    throw new Error("Choose a photo or video.");
  if (file.size > 30 * 1024 * 1024)
    throw new Error("Choose a file smaller than 30 MB.");
  const kind = file.type.startsWith("video/") ? "video" : "image";
  const url = URL.createObjectURL(file);
  const el = kind === "image" ? new Image() : document.createElement("video");
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    if (el instanceof HTMLVideoElement) {
      el.muted = true;
      el.preload = "auto";
      el.playsInline = true;
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              "Media could not be decoded. Try a JPEG photo or MP4 video.",
            ),
          ),
        12000,
      );
      el.addEventListener(
        kind === "image" ? "load" : "loadeddata",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      el.addEventListener(
        "error",
        () => {
          clearTimeout(timer);
          reject(
            new Error(
              "Unsupported or damaged media. Try a JPEG photo or MP4 video.",
            ),
          );
        },
        { once: true },
      );
      el.src = url;
    });
    if (
      el instanceof HTMLVideoElement &&
      (!Number.isFinite(el.duration) || el.duration > 30)
    )
      throw new Error("Use a short video up to 30 seconds.");
    const width =
      el instanceof HTMLImageElement ? el.naturalWidth : el.videoWidth;
    const height =
      el instanceof HTMLImageElement ? el.naturalHeight : el.videoHeight;
    if (!width || !height) throw new Error("Media has no usable picture.");
    const scale = Math.min(1, 1280 / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
    const thumbnail = canvas.toDataURL("image/jpeg", 0.72);
    const blob =
      kind === "image"
        ? await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
              (b) =>
                b ? resolve(b) : reject(new Error("Unable to store photo.")),
              "image/jpeg",
              0.85,
            ),
          )
        : file;
    const checks = [quality(canvas)];
    const frameTimes = [0];
    const framePixels = [
      sampleLarvalPixels(
        ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        canvas.width,
        canvas.height,
      ),
    ];
    if (el instanceof HTMLVideoElement && el.duration > 0.2) {
      for (let i = 1; i < 5; i++) {
        const time = Math.min(el.duration - 0.05, (el.duration * i) / 5);
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () =>
              reject(
                new Error(
                  "Could not sample video frames. Try a shorter MP4 clip.",
                ),
              ),
            8000,
          );
          el.addEventListener(
            "seeked",
            () => {
              clearTimeout(timer);
              resolve();
            },
            { once: true },
          );
          el.currentTime = time;
        });
        ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
        checks.push(quality(canvas));
        frameTimes.push(time);
        framePixels.push(
          sampleLarvalPixels(
            ctx.getImageData(0, 0, canvas.width, canvas.height).data,
            canvas.width,
            canvas.height,
          ),
        );
      }
    }
    const brightness =
      checks.reduce((s, c) => s + c.brightness, 0) / checks.length;
    const sharpness =
      checks.reduce((s, c) => s + c.sharpness, 0) / checks.length;
    const warnings: string[] = [];
    if (checks.some((c) => c.brightness < 45))
      warnings.push(
        "Some capture frames are dark. Retake in even, natural light.",
      );
    if (checks.some((c) => c.brightness > 220))
      warnings.push("Some capture frames may be overexposed. Avoid glare.");
    if (checks.some((c) => c.sharpness < 70))
      warnings.push(
        "Some frames have few clear edges. Move closer and hold the camera steady.",
      );
    if (Math.min(width, height) < 224)
      warnings.push(
        "Resolution is low. Capture a closer, higher-resolution image.",
      );
    let frameDifference: number | undefined;
    if (checks.length > 1) {
      let sum = 0;
      for (let i = 1; i < checks.length; i++)
        for (let p = 0; p < checks[i].gray.length; p++)
          sum += Math.abs(checks[i].gray[p] - checks[i - 1].gray[p]);
      frameDifference = sum / ((checks.length - 1) * checks[0].gray.length);
    }
    let larval: Visual["larval"];
    try {
      larval = await analyzeLarvalFrames(framePixels);
    } catch (e) {
      warnings.push((e as Error).message.slice(0, 300));
    }
    return {
      blob,
      thumbnail,
      kind,
      visual: {
        status: larval ? "model" : "quality-only",
        ...(larval ? { larval } : {}),
        brightness,
        sharpness,
        warnings,
        frames: checks.length,
        frameTimes,
        ...(frameDifference !== undefined ? { frameDifference } : {}),
      },
    };
  } finally {
    if (el instanceof HTMLVideoElement) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    URL.revokeObjectURL(url);
  }
}
