import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

test("real leaf server runs distinct photos and matches the device masking measurements", async ({
  page,
  request,
}) => {
  const hash = createHash("sha256")
    .update(readFileSync("public/models/mulberry-baseline.json"))
    .digest("hex");
  const predictions = [];
  for (const file of [
    "artifacts/mulberry-heldout-parity.png",
    "tests/fixtures/mulberry-rust.png",
  ]) {
    const response = await request.post("/api/model/leaf/predict", {
      headers: { "Content-Type": "image/png" },
      data: readFileSync(file),
    });
    expect(response.status()).toBe(200);
    const result = await response.json();
    predictions.push(result);
    expect(result.modelSha256).toBe(hash);
    expect(result.modelRuns).toBe(17);
    expect(result.inferenceMs).toBeGreaterThan(0);
    expect(result.explanationMs).toBeGreaterThan(0);
    expect(result.influence).toHaveLength(16);
  }
  expect(predictions[0].inputSha256).not.toBe(predictions[1].inputSha256);
  expect(
    predictions[0].scores.indexOf(Math.max(...predictions[0].scores)),
  ).toBe(0);
  expect(
    predictions[1].scores.indexOf(Math.max(...predictions[1].scores)),
  ).toBe(1);
  expect(predictions[0].influence).not.toEqual(predictions[1].influence);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Experimental feed-leaf check" })
    .click();
  await page.getByLabel("Run leaf model on").selectOption("backend");
  const network = page.waitForResponse((r) =>
    r.url().endsWith("/api/model/leaf/predict"),
  );
  await page
    .getByLabel("Choose mulberry leaf photo")
    .setInputFiles("tests/fixtures/mulberry-rust.png");
  const server = await (await network).json();
  await expect(
    page.getByText("Leaf model executed on: backend", { exact: true }),
  ).toBeVisible();
  expect(server.inputSha256).toBe(predictions[1].inputSha256);
  await page.getByLabel("Run leaf model on").selectOption("device");
  // Device mode must run without calling an inference endpoint.
  await page.route("**/api/model/leaf/predict", () => {
    throw new Error("Device execution unexpectedly called server");
  });
  await page
    .getByLabel("Choose mulberry leaf photo")
    .setInputFiles("tests/fixtures/mulberry-rust.png");
  await expect(
    page.getByText("Leaf model executed on: device", { exact: true }),
  ).toBeVisible();
  await page
    .getByText("Inspect leaf execution evidence", { exact: true })
    .click();
  await expect(
    page.getByText("Prepared photo SHA-256: " + server.inputSha256, {
      exact: true,
    }),
  ).toBeVisible();
  const changes = await page
    .getByRole("table", { name: "Measured leaf masking results" })
    .locator("tbody tr td:last-child")
    .allTextContents();
  expect(changes).toHaveLength(16);
  changes.forEach((value, i) =>
    expect(Number(value)).toBeCloseTo(server.influence[i] * 100, 3),
  );
  const probabilities = await page
    .locator(".factor-head strong")
    .allTextContents();
  probabilities.forEach((value, i) =>
    expect(parseFloat(value)).toBeCloseTo(server.scores[i] * 100, 0),
  );
  await expect(page.locator(".influence-grid")).toHaveCount(0);
});

test("a failed or mismatched model response clears previous results instead of fabricating output", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Experimental feed-leaf check" })
    .click();
  await page.getByLabel("Run leaf model on").selectOption("backend");
  await page
    .getByLabel("Choose mulberry leaf photo")
    .setInputFiles("tests/fixtures/mulberry-rust.png");
  await expect(
    page.getByText("Leaf model executed on: backend", { exact: true }),
  ).toBeVisible();
  await page.route("**/api/model/leaf/predict", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Leaf server stopped. No prediction generated." },
    }),
  );
  await page
    .getByLabel("Choose mulberry leaf photo")
    .setInputFiles("artifacts/mulberry-heldout-parity.png");
  await expect(page.getByRole("alert")).toContainText(
    "No prediction generated",
  );
  await expect(
    page.getByRole("button", {
      name: "Use this leaf result in a batch assessment",
    }),
  ).toHaveCount(0);
  await expect(page.getByText(/Leaf model executed on:/)).toHaveCount(0);
  const real = await (
    await request.post("/api/model/leaf/predict", {
      headers: { "Content-Type": "image/png" },
      data: readFileSync("tests/fixtures/mulberry-rust.png"),
    })
  ).json();
  await page.unroute("**/api/model/leaf/predict");
  await page.route("**/api/model/leaf/predict", (route) =>
    route.fulfill({ json: real }),
  );
  // A valid result for a different photo must also be rejected.
  await page
    .getByLabel("Choose mulberry leaf photo")
    .setInputFiles("artifacts/mulberry-heldout-parity.png");
  await expect(page.getByRole("alert")).toContainText("photo does not match");
  await expect(
    page.getByRole("button", {
      name: "Use this leaf result in a batch assessment",
    }),
  ).toHaveCount(0);
});
