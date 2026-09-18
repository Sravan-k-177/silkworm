import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
test("Telugu capture, care, record tabs and settings remain usable on narrow screens", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await page.getByLabel("Language / భాష").selectOption("te");
  await expect(page.locator("html")).toHaveAttribute("lang", "te");
  await fits(page);
  await page.getByRole("button", { name: "బ్యాచ్‌లు", exact: true }).click();
  await page
    .getByRole("button", { name: "బ్యాచ్‌ను జోడించండి", exact: true })
    .click();
  await fits(page);
  await page.getByLabel("బ్యాచ్ పేరు").fill("తెలుగు పరీక్ష బ్యాచ్");
  await page.getByLabel("ఫారం కోడ్").fill("TE-TEST");
  await page.getByLabel("షెడ్ కోడ్").fill("S-TE");
  await page
    .getByRole("button", { name: "బ్యాచ్‌ను భద్రపరచండి", exact: true })
    .click();
  await page.getByRole("button", { name: "కొత్త అంచనా", exact: true }).click();
  await page.getByLabel("ప్రస్తుత వయో దశ").selectOption("V");
  await page.getByLabel("ఉష్ణోగ్రత (°C)").fill("29");
  await page.getByLabel("సాపేక్ష తేమ (%)").fill("85");
  await page.getByLabel("అసాధారణ మరణాలు", { exact: true }).check();
  await fits(page);
  // Changing languages must retain the assessment draft.
  await page.getByLabel("Language / భాష").selectOption("en");
  await expect(page.getByLabel("Temperature (°C)")).toHaveValue("29");
  await page.getByLabel("Language / భాష").selectOption("te");
  await page
    .getByRole("button", { name: "భద్రపరచి అంచనా వేయండి", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "త్వరగా క్షేత్ర సమీక్ష ఏర్పాటు చేయండి" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "ఇప్పుడు నేను ఏమి చేయాలి?" }),
  ).toBeVisible();
  await expect(page.locator("body")).toContainText("ఉష్ణోగ్రత 29°C");
  await fits(page);
  await page
    .getByRole("button", { name: "బ్యాచ్ తెరిచి చర్యను నమోదు చేయండి" })
    .click();
  for (const name of [
    "సంరక్షణ చిట్టా",
    "ఫలితాలు",
    "సమీక్షలు",
    "తదుపరి పరిశీలనలు",
    "గమనించిన ఆరోగ్యం",
  ]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await fits(page);
  }
  await page.getByRole("tab", { name: "ఫలితాలు", exact: true }).click();
  await page
    .getByRole("button", { name: "ఫలితాన్ని నమోదు చేయండి", exact: true })
    .click();
  await fits(page);
  await page.getByRole("button", { name: "విండోను మూసివేయండి" }).click();
  await page.getByRole("button", { name: "అవలోకనం", exact: true }).click();
  await fits(page);
  await page.getByRole("button", { name: "సెట్టింగులు తెరవండి" }).click();
  await fits(page);
  await page.screenshot({
    path: "artifacts/telugu-settings-320.png",
    fullPage: true,
  });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "te");
  await expect(
    page.getByRole("heading", { name: "కొద్దిపాటి శ్రద్ధ." }),
  ).toBeVisible();
  await fits(page);
  await context.setOffline(false);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
});
test("all main screens fit phone, tablet and desktop widths in both languages", async ({
  page,
}) => {
  for (const lang of ["en", "te"])
    for (const width of [360, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await page.getByLabel("Language / భాష").selectOption(lang);
      await fits(page);
      const nav =
        width <= 760
          ? page.locator(".mobile-nav")
          : page.locator(".sidebar nav");
      for (const name of lang === "en"
        ? ["Batches", "Assess", "Overview"]
        : ["బ్యాచ్‌లు", "అంచనా", "అవలోకనం"]) {
        await nav.getByRole("button", { name, exact: true }).click();
        await fits(page);
      }
      await page
        .getByRole("button", {
          name: lang === "en" ? "Open settings" : "సెట్టింగులు తెరవండి",
        })
        .click();
      await fits(page);
      await page.goto("/?deep=1");
      await expect(
        page.getByRole("heading", {
          name: lang === "en" ? "Deep-learning tray check" : "AI ట్రే పరిశీలన",
          exact: true,
        }),
      ).toBeVisible();
      await fits(page);
    }
});
