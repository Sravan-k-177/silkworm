import { test, expect } from "@playwright/test";
test("offline assessment, intervention, outcome and deferred synchronization", async ({
  page,
  context,
}) => {
  await page.clock.install();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A little care. A healthier harvest." }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/mobile-home-390.png",
    fullPage: true,
  });
  await context.setOffline(true);
  await expect(
    page.getByText(
      "You’re offline. Keep working; records stay on this device.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add your first batch" }).click();
  await page.getByLabel("Batch name").fill("Offline test batch");
  await page.getByLabel("Farm code").fill("F-TEST");
  await page.getByLabel("Shed code").fill("S-TEST");
  await page.getByLabel("Larvae brushed (optional)").fill("100");
  await page.getByRole("button", { name: "Save batch", exact: true }).click();
  await page
    .getByRole("button", { name: "New assessment", exact: true })
    .click();
  await page.getByLabel("Current instar").selectOption("V");
  await page.getByLabel("Temperature (°C)").fill("29");
  await page.getByLabel("Relative humidity (%)").fill("85");
  await page.getByLabel("Air and ventilation").selectOption("stuffy");
  await page.getByLabel("Rearing bed hygiene").selectOption("clean");
  await page.getByLabel("Mulberry feed").selectOption("fresh");
  await page.getByLabel("Unusual deaths").check();
  await page.screenshot({
    path: "artifacts/mobile-capture-390.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save & assess" }).click();
  await expect(
    page.getByRole("heading", { name: "Arrange a prompt field review" }),
  ).toBeVisible();
  await expect(
    page.getByText("Unusual mortality reported", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What can I do next?" }),
  ).toBeVisible();
  await page
    .getByLabel("Bring temperature into the confirmed reference range")
    .check();
  await page
    .getByLabel("Bring humidity into the confirmed reference range")
    .check();
  await page.getByLabel("Improve ventilation").check();
  await expect(page.getByText("Checklist comparison:")).toContainText(
    "100 → 60",
  );
  await page.screenshot({
    path: "artifacts/mobile-result-390.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Open batch & record action" })
    .click();
  await page.getByRole("tab", { name: "Care log" }).click();
  await page.getByRole("button", { name: "Record action" }).click();
  await page
    .getByLabel("Action taken or planned")
    .fill("Contacted field officer; reviewed tray ventilation");
  await page.getByRole("button", { name: "Save action" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Contacted field officer; reviewed tray ventilation",
    }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Outcomes" }).click();
  await page.getByRole("button", { name: "Record outcome" }).click();
  await page.getByLabel("Count scope").selectOption("whole-cycle");
  await page.getByLabel("Cocoons harvested").fill("80");
  await page.getByLabel("Total deaths recorded").fill("20");
  await page.getByLabel("Total cocoon yield (kg)").fill("0.16");
  await page.getByLabel("Sample cocoon weight (g)").fill("2");
  await page.getByLabel("Same sample shell (g)").fill("0.4");
  await page.getByRole("button", { name: "Save outcome" }).click();
  await expect(page.getByText("80.0%")).toBeVisible();
  await expect(page.getByText("20.0%")).toBeVisible();
  await page.getByRole("tab", { name: "Follow-ups", exact: true }).click();
  await expect(
    page.getByText("Needs acknowledgement", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Update follow-up" }).click();
  await page.getByLabel("Follow-up status").selectOption("scheduled");
  await page.getByLabel("Responsible staff code").fill("OFFICER-TEST");
  const due = await page.evaluate(() => {
    const d = new Date(Date.now() + 120_000);
    d.setSeconds(0, 0);
    return {
      local: new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16),
    };
  });
  await page.getByLabel("Follow-up due (local time)").fill(due.local);
  await page
    .getByLabel("Follow-up evidence and next step")
    .fill("Visit scheduled to verify ventilation and counts.");
  await page.getByRole("button", { name: "Save follow-up" }).click();
  await expect(page.locator(".alert-entry .badge")).toHaveText(
    "Follow-up scheduled",
  );
  await page.clock.fastForward(180_000);
  await expect(page.getByText("Overdue", { exact: true })).toBeVisible();
  await page.getByText("Follow-up history (1)", { exact: true }).click();
  await expect(page.locator(".audit-history")).toContainText("Due ");
  await page.getByRole("tab", { name: "Observed health", exact: true }).click();
  await page.getByLabel("Observer code", { exact: true }).fill("OFFICER-TEST");
  await page.getByLabel("Observed finding").selectOption("mortality");
  await page.getByLabel("Larvae examined", { exact: true }).fill("100");
  await page.getByLabel("Affected in this examination").fill("2");
  await page
    .getByLabel("Observation evidence", { exact: true })
    .fill("Two deaths observed in a count of 100; onset unknown.");
  await page.getByRole("button", { name: "Save health observation" }).click();
  await expect(
    page.getByRole("heading", { name: "Mortality observed" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Reviews" }).click();
  await page.getByLabel("Reviewer code").fill("OFFICER-TEST");
  await page.getByLabel("Review decision").selectOption("correction");
  await page
    .getByLabel("Review evidence or correction")
    .fill("Humidity reading needs a calibrated meter recheck.");
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Correction note" }),
  ).toBeVisible();
  await expect(
    page.getByText("Humidity reading needs a calibrated meter recheck.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A little care. A healthier harvest." }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Batches" })
    .click();
  await expect(
    page.getByRole("button", { name: /Offline test batch/ }),
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
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Overview" })
    .click();
  await page.screenshot({
    path: "artifacts/mobile-supervisor-390.png",
    fullPage: true,
  });
  await page.getByLabel("Filter by farm").selectOption("F-TEST");
  await page.getByLabel("Filter by latest risk").selectOption("low");
  await expect(
    page.getByRole("heading", { name: "No matching batches" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Risk and outcome comparison" })
      .getByRole("button", { name: "Offline test batch" }),
  ).toHaveCount(0);
  await page.getByLabel("Filter by latest risk").selectOption("high");
  await expect(
    page
      .getByRole("region", { name: "Risk and outcome comparison" })
      .getByRole("button", { name: "Offline test batch" }),
  ).toBeVisible();
  await page.getByLabel("Latest assessment from").fill("2099-01-01");
  await expect(
    page.getByRole("heading", { name: "No matching batches" }),
  ).toBeVisible();
  await page.getByLabel("Latest assessment through").fill("2000-01-01");
  await expect(page.getByRole("alert")).toHaveText(
    "The end date must be on or after the start date.",
  );
  await page.getByRole("button", { name: "Clear supervisor filters" }).click();
  await expect(
    page
      .getByRole("region", { name: "Risk and outcome comparison" })
      .getByRole("button", { name: "Offline test batch" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("360 and 430 px shell layout", async ({ page }) => {
  await page.goto("/");
  for (const width of [360, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.screenshot({
      path: `artifacts/mobile-home-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
test("API rejects malformed records and conflicting immutable IDs", async ({
  request,
}) => {
  const id = crypto.randomUUID();
  const record = {
    id,
    createdAt: new Date().toISOString(),
    deviceId: "api-test",
    kind: "batch",
    payload: {
      id: "api-batch-" + id,
      name: "API batch",
      farm: "F",
      shed: "S",
      tray: "",
      started: "2026-09-08",
      initialLarvae: 10,
      species: "Bombyx mori",
    },
  };
  expect(
    (
      await request.post("/api/sync", {
        data: { events: [{ invalid: true }], cursor: 0 },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/sync", { data: { events: [record], cursor: 0 } })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post("/api/sync", { data: { events: [record], cursor: 0 } })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post("/api/sync", {
        data: {
          events: [
            { ...record, payload: { ...record.payload, name: "Overwrite" } },
          ],
          cursor: 0,
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.post("/api/sync", {
        headers: { Origin: "https://untrusted.example" },
        data: { events: [], cursor: 0 },
      })
    ).status(),
  ).toBe(403);
});
test("home accessibility audit", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  await test
    .info()
    .attach("axe-results", {
      body: JSON.stringify(results.violations, null, 2),
      contentType: "application/json",
    });
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});

test("trained leaf inference works after an offline reload", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  const cached = await page.evaluate(async () =>
    Boolean(await caches.match("/models/mulberry-baseline.json")),
  );
  expect(cached).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("button", { name: "Experimental feed-leaf check" })
    .click();
  await page
    .getByLabel("Choose mulberry leaf photo")
    .setInputFiles("artifacts/mulberry-heldout-parity.png");
  await expect(
    page.getByRole("heading", { name: /Closest trained class:/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Model evidence" }),
  ).toBeVisible();
  await expect(
    page.getByText("1091 real images", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/mobile-leaf-offline-390.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("secondary screens accessibility", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await page.goto("/");
  for (const screen of ["leaf", "settings", "supervisor"]) {
    if (screen === "leaf")
      await page
        .getByRole("button", { name: "Experimental feed-leaf check" })
        .click();
    if (screen === "settings")
      await page.getByRole("button", { name: "Open settings" }).click();
    if (screen === "supervisor")
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("button", { name: "Overview" })
        .click();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        screen,
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
});

test("offline video capture samples five frames and retains media", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Add your first batch" }).click();
  await page.getByLabel("Batch name").fill("Video capture test");
  await page.getByLabel("Farm code").fill("F-VIDEO");
  await page.getByLabel("Shed code").fill("S-VIDEO");
  await page.getByRole("button", { name: "Save batch", exact: true }).click();
  await page
    .getByRole("button", { name: "New assessment", exact: true })
    .click();
  await page
    .getByLabel("Choose tray photo or video")
    .setInputFiles("tests/fixtures/capture-test.webm");
  await expect(page.getByText("Video · 5 frames checked")).toBeVisible();
  await page.getByRole("button", { name: "Save & assess" }).click();
  await expect(
    page.getByText(/5 frames sampled. Mean frame change:/),
  ).toBeVisible();
  await expect(
    page.getByText(/it is not larval activity or a health score/),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Batches" })
    .click();
  await page.getByRole("button", { name: /Video capture test/ }).click();
  await page.locator(".timeline-item").first().click();
  await expect(page.getByAltText("Assessment tray capture")).toBeVisible();
  await expect(
    page.getByText(/5 frames sampled. Mean frame change:/),
  ).toBeVisible();
});

test("batch discovery and keyboard record navigation", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start your first batch", exact: true })
    .click();
  await page.getByLabel("Batch name").fill("Tray search fixture");
  await page.getByLabel("Farm code").fill("UX-FARM");
  await page.getByLabel("Shed code").fill("UX-SHED");
  await page.getByLabel("Tray code (optional)").fill("TRAY-42");
  await page.getByRole("button", { name: "Save batch", exact: true }).click();
  const observations = page.getByRole("tab", {
    name: "Observations",
    exact: true,
  });
  await observations.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Care log", exact: true }),
  ).toBeFocused();
  await expect(page.getByRole("tabpanel")).toHaveAccessibleName("Care log");
  await page.keyboard.press("End");
  await expect(
    page.getByRole("tab", { name: "Observed health", exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: "artifacts/mobile-batch-tabs-390.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "All batches", exact: true }).click();
  await page.getByLabel("Search batches", { exact: true }).fill("  tray-42  ");
  await page
    .getByLabel("Filter by risk", { exact: true })
    .selectOption("unassessed");
  await expect(
    page.getByRole("button", { name: /Tray search fixture/ }),
  ).toBeVisible();
  await page.getByLabel("Search batches", { exact: true }).fill("no-such-tray");
  await expect(
    page.getByRole("heading", { name: "No matching batches" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Show all batches", exact: true })
    .click();
  await expect(page.getByLabel("Search batches", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByLabel("Filter by risk", { exact: true })).toHaveValue(
    "all",
  );
  await page.screenshot({
    path: "artifacts/mobile-batch-search-390.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
