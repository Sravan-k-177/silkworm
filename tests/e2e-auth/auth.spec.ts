import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
const password = "Test-only-password-2026";
const batch = (farm: string) => ({
  id: randomUUID(),
  kind: "batch",
  createdAt: new Date().toISOString(),
  deviceId: "auth-test",
  payload: {
    id: randomUUID(),
    farm,
    name: "Batch " + farm,
    shed: "S1",
    tray: "T1",
    started: "2026-09-01",
    initialLarvae: 100,
    species: "Bombyx mori",
  },
});
async function login(api: APIRequestContext, username: string) {
  expect(
    (
      await api.post("/api/auth/login", { data: { username, password } })
    ).status(),
  ).toBe(200);
}
test("anonymous access, invalid password, origin protection, session cookie and logout", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/sync", { data: { events: [], cursor: 0 } })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/auth/login", {
        data: { username: "alice", password: "wrong" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/auth/login", {
        headers: { Origin: "https://evil.example" },
        data: { username: "alice", password },
      })
    ).status(),
  ).toBe(403);
  const signed = await request.post("/api/auth/login", {
    data: { username: "alice", password },
  });
  expect(signed.status()).toBe(200);
  expect(signed.headers()["set-cookie"]).toContain("HttpOnly");
  expect(signed.headers()["set-cookie"]).toContain("SameSite=Strict");
  expect((await request.get("/api/auth/session")).status()).toBe(200);
  await request.post("/api/auth/logout");
  expect(
    (
      await request.post("/api/sync", { data: { events: [], cursor: 0 } })
    ).status(),
  ).toBe(401);
});
test("farm isolation, multi-farm supervisor, immutable entity conflicts and transactional denial", async ({
  playwright,
}) => {
  const alice = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:8793",
    }),
    bob = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:8793",
    }),
    officer = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:8793",
    });
  try {
    await login(alice, "alice");
    await login(bob, "bob");
    await login(officer, "officer");
    const a = batch("F-A"),
      b = batch("F-B");
    expect(
      (
        await alice.post("/api/sync", { data: { events: [a], cursor: 0 } })
      ).status(),
    ).toBe(200);
    expect(
      (
        await bob.post("/api/sync", { data: { events: [b], cursor: 0 } })
      ).status(),
    ).toBe(200);
    const own = await (
      await alice.post("/api/sync", { data: { events: [], cursor: 0 } })
    ).json();
    expect(own.events.some((e: any) => e.id === a.id)).toBe(true);
    expect(own.events.some((e: any) => e.id === b.id)).toBe(false);
    const both = await (
      await officer.post("/api/sync", { data: { events: [], cursor: 0 } })
    ).json();
    expect(both.events.some((e: any) => e.id === a.id)).toBe(true);
    expect(both.events.some((e: any) => e.id === b.id)).toBe(true);
    const allowed = batch("F-A"),
      forbidden = batch("F-B");
    expect(
      (
        await alice.post("/api/sync", {
          data: { events: [allowed, forbidden], cursor: 0 },
        })
      ).status(),
    ).toBe(403);
    const after = await (
      await alice.post("/api/sync", { data: { events: [], cursor: 0 } })
    ).json();
    expect(after.events.some((e: any) => e.id === allowed.id)).toBe(false);
    expect(
      (
        await alice.post("/api/sync", {
          data: {
            events: [
              {
                ...a,
                id: randomUUID(),
                payload: { ...a.payload, name: "Replacement" },
              },
            ],
            cursor: 0,
          },
        })
      ).status(),
    ).toBe(409);
  } finally {
    await alice.dispose();
    await bob.dispose();
    await officer.dispose();
  }
});
test("server validates parent links and supervisor-only review writes", async ({
  request,
}) => {
  await login(request, "alice");
  const a = batch("F-A");
  await request.post("/api/sync", { data: { events: [a], cursor: 0 } });
  const review = {
    id: randomUUID(),
    kind: "review",
    createdAt: new Date().toISOString(),
    deviceId: "auth-test",
    payload: {
      id: randomUUID(),
      batchId: a.payload.id,
      assessmentId: "absent",
      recordedAt: new Date().toISOString(),
      reviewerCode: "claim-officer",
      decision: "supported",
      notes: "Test review",
    },
  };
  expect(
    (
      await request.post("/api/sync", { data: { events: [review], cursor: 0 } })
    ).status(),
  ).toBe(403);
  await login(request, "officer");
  expect(
    (
      await request.post("/api/sync", { data: { events: [review], cursor: 0 } })
    ).status(),
  ).toBe(422);
});
test("account UI isolates local workspaces and supports Telugu offline reload", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByLabel("Language / భాష").selectOption("te");
  await expect(
    page.getByRole("heading", { name: "సిల్క్‌సెన్స్‌లో ప్రవేశించండి" }),
  ).toBeVisible();
  await page.getByLabel("వినియోగదారు పేరు").fill("alice");
  await page.getByLabel("పాస్‌వర్డ్").fill(password);
  await page.getByRole("button", { name: "ప్రవేశించండి", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "కొద్దిపాటి శ్రద్ధ." }),
  ).toBeVisible();
  await page.getByLabel("Language / భాష").selectOption("en");
  await page.getByRole("button", { name: "Batches", exact: true }).click();
  await page.getByRole("button", { name: "Add batch", exact: true }).click();
  await page.getByLabel("Batch name").fill("Private local Alice");
  await page.getByLabel("Farm code").selectOption("F-A");
  await expect(page.getByLabel("Farm code").locator("option")).toHaveCount(1);
  await page.getByLabel("Shed code").fill("S1");
  await page.getByRole("button", { name: "Save batch", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Private local Alice" }),
  ).toBeVisible();
  await page.getByLabel("Language / భాష").selectOption("te");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "te");
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "కొద్దిపాటి శ్రద్ధ." }),
  ).toBeVisible();
  await expect(page.locator("body")).toContainText("Private local Alice");
  await context.setOffline(false);
  await page
    .getByRole("button", { name: "నిష్క్రమించండి", exact: true })
    .click();
  await page.getByLabel("వినియోగదారు పేరు").fill("bob");
  await page.getByLabel("పాస్‌వర్డ్").fill(password);
  await page.getByRole("button", { name: "ప్రవేశించండి", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "కొద్దిపాటి శ్రద్ధ." }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Private local Alice");
});

test("offline session expires and reload cannot extend it", async ({
  page,
  context,
}) => {
  await page.clock.install({ time: new Date() });
  await page.goto("/");
  await page.getByLabel("Username").fill("alice");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A little care." }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A little care." }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.clock.fastForward(13 * 3600000);
  await expect(
    page.getByRole("heading", { name: "Sign in to SilkSense" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Sign in to SilkSense" }),
  ).toBeVisible();
});

test('offline sign-out locks local records across reload and completes after reconnect',async({page,context})=>{
 await page.goto('/');await page.getByLabel('Username').fill('bob');await page.getByLabel('Password').fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'A little care.'})).toBeVisible();await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await expect(page.getByRole('heading',{name:'A little care.'})).toBeVisible();await context.setOffline(true);await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('heading',{name:'Sign in to SilkSense'})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Sign in to SilkSense'})).toBeVisible();await context.setOffline(false);await page.reload();await expect(page.getByRole('heading',{name:'Sign in to SilkSense'})).toBeVisible();
});
test('a stale tab cannot synchronize under another signed-in account',async({request})=>{
 await login(request,'bob');expect((await request.post('/api/sync',{headers:{'X-SilkSense-Account':'alice'},data:{events:[],cursor:0}})).status()).toBe(401);
});
