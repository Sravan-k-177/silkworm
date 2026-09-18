import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("real backend neural network matches held-out Python probabilities", async ({
  request,
}) => {
  const health = await request.get("/api/model/health");
  expect(health.status()).toBe(200);
  const info = await health.json();
  expect(info.architecture).toBe("MobileNetV3-Small");
  const response = await request.post("/api/model/predict", {
    headers: { "Content-Type": "image/png" },
    data: readFileSync("artifacts/larval-heldout-parity.png"),
  });
  expect(response.status()).toBe(200);
  const result = await response.json();
  const parity = JSON.parse(
    readFileSync("artifacts/larval-parity.json", "utf8"),
  );
  expect(result.execution).toBe("backend");
  expect(result.modelSha256).toBe(info.modelSha256);
  expect(result.influence).toHaveLength(16);
  for (let i = 0; i < 5; i++)
    expect(result.scores[i].score).toBeCloseTo(parity.probabilities[i], 4);
  expect(
    (
      await request.post("/api/model/predict", {
        headers: { "Content-Type": "image/png" },
        data: Buffer.from("not an image"),
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/model/predict", { data: { fake: true } })
    ).status(),
  ).toBe(415);
});
test("browser uploads image to real backend and shows execution evidence", async ({
  page,
}) => {
  await page.goto("/?deep=1");
  await page
    .getByLabel("Upload image for backend inference")
    .setInputFiles("artifacts/larval-heldout-parity.png");
  await expect(page.getByText("Executed on: backend")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Visual appearance needs field review" }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/deployed-deep-learning.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("camera denial is shown without inventing a prediction", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        throw new DOMException("Camera permission denied", "NotAllowedError");
      },
    });
  });
  await page.goto("/?deep=1");
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Camera permission denied",
  );
  await expect(page.getByText("Executed on: backend")).toHaveCount(0);
});
test("live camera stream captures a frame and calls the neural backend", async ({
  playwright,
}) => {
  const browser = await playwright.chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      "/home/sravan/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  try {
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:8788/?deep=1");
    await page
      .getByRole("button", { name: "Start camera", exact: true })
      .click();
    await expect
      .poll(() =>
        page.locator("video").evaluate((v: HTMLVideoElement) => v.videoWidth),
      )
      .toBeGreaterThan(0);
    await page.getByRole("button", { name: "Take photo & analyze" }).click();
    await expect(page.getByText("Executed on: backend")).toBeVisible();
    await expect(page.locator("video")).toHaveCount(0);
  } finally {
    await browser.close();
  }
});
test("backend result remains attached to a saved batch with model provenance", async ({
  page,
}) => {
  await page.goto("/?deep=1");
  await page
    .getByLabel("Upload image for backend inference")
    .setInputFiles("artifacts/larval-heldout-parity.png");
  await expect(page.getByText("Executed on: backend")).toBeVisible();
  await page
    .getByRole("button", { name: "Use this result in a batch assessment" })
    .click();
  await page.getByRole("button", { name: "Add a new batch" }).click();
  await page.getByLabel("Batch name").fill("Neural workflow");
  await page.getByLabel("Farm code").fill("F-DEEP");
  await page.getByLabel("Shed code").fill("S-DEEP");
  await page.getByRole("button", { name: "Save batch", exact: true }).click();
  await page.getByLabel("Current instar").selectOption("V");
  await page.getByLabel("Temperature (°C)").fill("29");
  await page.getByLabel("Relative humidity (%)").fill("85");
  await page.getByLabel("Unusual deaths").check();
  await page.getByRole("button", { name: "Save & assess" }).click();
  await expect(
    page.getByRole("heading", { name: "Arrange a prompt field review" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What can I do next?" }),
  ).toBeVisible();
  await page
    .getByText("Class scores and visual evidence", { exact: true })
    .click();
  await expect(
    page.getByText("Execution: backend · ONNX Runtime CPU"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(
    page
      .getByText("Waiting to sync")
      .locator("..")
      .getByText("0", { exact: true }),
  ).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloaded;
  const path = await download.path();
  const exported = JSON.parse(readFileSync(path!, "utf8"));
  const a = exported.events.find((e: any) => e.kind === "assessment").payload;
  expect(a.visual.larval.execution).toBe("backend");
  expect(a.visual.larval.modelSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(a.mediaId).toBeTruthy();
  expect(a.risk.level).toBe("high");
});
test("same network runs offline with matching prediction and explanation", async ({
  page,
  context,
  request,
}) => {
  const response = await request.post("/api/model/predict", {
    headers: { "Content-Type": "image/png" },
    data: readFileSync("artifacts/larval-heldout-parity.png"),
  });
  const backend = await response.json();
  await page.goto("/?deep=1");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.getByLabel("Run model on").selectOption("device");
  await page
    .getByLabel("Upload image for backend inference")
    .setInputFiles("artifacts/larval-heldout-parity.png");
  await expect(page.getByText("Executed on: device")).toBeVisible();
  await page
    .getByText("Class scores and visual evidence", { exact: true })
    .click();
  const displayed = await page.locator(".summary-row strong").allTextContents();
  expect(displayed).toHaveLength(5);
  for (let i = 0; i < 5; i++)
    expect(parseFloat(displayed[i])).toBeCloseTo(
      backend.scores[i].score * 100,
      0,
    );
  const influence = await page
    .getByRole("region", { name: "Visual influence values" })
    .locator("td")
    .allTextContents();
  for (let i = 0; i < 16; i++)
    expect(parseFloat(influence[i])).toBeCloseTo(backend.influence[i] * 100, 0);
  await expect(
    page.getByText("Loaded model SHA-256: " + backend.modelSha256),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Use this result in a batch assessment" })
    .click();
  // The form carries the actual result; verify the existing offline runtime directly too.
  const cached = await page.evaluate(
    async () => !!(await caches.match("/models/larval-appearance.onnx")),
  );
  expect(cached).toBe(true);
  await expect(
    page.getByText("Capture checked. Model execution: this device."),
  ).toBeVisible();
  expect(backend.modelSha256).toMatch(/^[a-f0-9]{64}$/);
});
test("unusable dark photo is marked uncertain by the backend", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const base64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 224;
    c.getContext("2d")!.fillRect(0, 0, 224, 224);
    return c.toDataURL("image/png").split(",")[1];
  });
  const response = await request.post("/api/model/predict", {
    headers: { "Content-Type": "image/png" },
    data: Buffer.from(base64, "base64"),
  });
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.decision).toBe("uncertain");
  expect(result.qualityWarnings).toContain(
    "Photo is too dark. Retake in even light.",
  );
});
