import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("standalone leaf result is saved offline with its photo and survives sync and export", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Experimental feed-leaf check" })
    .click();
  await page
    .getByLabel("Choose mulberry leaf photo")
    .setInputFiles("tests/fixtures/mulberry-rust.png");
  await page
    .getByLabel("I confirm this is a mulberry leaf from this batch’s feed")
    .check();
  await expect(
    page.getByText("Leaf photo needs feed review · 20 feed priority points", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Use this leaf result in a batch assessment" })
    .click();
  await page.getByRole("button", { name: "Add a new batch" }).click();
  await page.getByLabel("Batch name").fill("Leaf photo field cycle");
  await page.getByLabel("Farm code").fill("F-LEAF");
  await page.getByLabel("Shed code").fill("S-LEAF");
  await page.getByRole("button", { name: "Save batch", exact: true }).click();
  await expect(
    page.getByLabel("I confirm this is a mulberry leaf from this batch’s feed"),
  ).toBeChecked();
  await page.getByLabel("Current instar").selectOption("V");
  await page.getByLabel("Temperature (°C)").fill("24");
  await page.getByLabel("Relative humidity (%)").fill("70");
  await page.getByLabel("Mulberry feed").selectOption("fresh");
  await page.getByRole("button", { name: "Save & assess" }).click();
  await expect(
    page.getByRole("heading", { name: "Mulberry leaf evidence" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Uploaded mulberry leaf" }),
  ).toBeVisible();
  await expect(page.locator(".score strong")).toHaveText("20");
  await page.reload();
  await page.getByRole("button", { name: "Batches", exact: true }).click();
  await page.getByRole("button", { name: /Leaf photo field cycle/ }).click();
  await page.locator(".timeline-item").first().click();
  await expect(
    page.getByRole("img", { name: "Uploaded mulberry leaf" }),
  ).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(
    page
      .getByText("Waiting to sync")
      .locator("..")
      .getByText("0", { exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const data = JSON.parse(
    readFileSync((await (await downloadPromise).path())!, "utf8"),
  );
  const batch = data.events.find((e: any) => e.kind === "batch" && e.payload.name === "Leaf photo field cycle").payload;
  const a = data.events.find((e: any) => e.kind === "assessment" && e.payload.batchId === batch.id).payload;
  expect(a.visual.leaf.version).toBe("mulberry-baseline-v1");
  expect(a.visual.leaf.confirmedMulberry).toBe(true);
  expect(a.visual.leaf.mediaId).toBeTruthy();
  expect(a.mediaId).toBeNull();
  expect(a.risk.version).toBe("priority-rules-0.4");
  const explanation = await (
    await page.request.post("/api/explain", {
      data: { input: a, adjustments: ["feed"] },
    })
  ).json();
  expect(explanation.risk.score).toBe(20);
  expect(explanation.projected.score).toBe(20);
  expect(a.risk.factors.filter((f: any) => f.key === "feed")).toHaveLength(1);
  const synced = await (
    await page.request.post("/api/sync", { data: { events: [], cursor: 0 } })
  ).json();
  expect(
    synced.events.find(
      (e: any) => e.kind === "assessment" && e.payload.id === a.id,
    ).payload.visual.leaf,
  ).toEqual(a.visual.leaf);
});

test("a dark leaf image requests a retake rather than adding image-based feed points", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Experimental feed-leaf check" })
    .click();
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 224;
    c.getContext("2d")!.fillRect(0, 0, 224, 224);
    return c.toDataURL().split(",")[1];
  });
  await page
    .getByLabel("Choose mulberry leaf photo")
    .setInputFiles({
      name: "dark.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await page
    .getByLabel("I confirm this is a mulberry leaf from this batch’s feed")
    .check();
  await expect(
    page.getByText(
      "Leaf photo uncertain · confirm the plant or retake the photo",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Leaf photo lighting is unsuitable. Retake in even light."),
  ).toBeVisible();
  await expect(
    page.getByText("Leaf photo needs feed review · 20 feed priority points", {
      exact: true,
    }),
  ).toHaveCount(0);
});
