import { test, expect } from "@playwright/test";
test("backend care explanation preserves urgent review and validates inputs", async ({
  request,
}) => {
  const input = {
    instar: "V",
    moulting: false,
    temperature: 29,
    humidity: 85,
    ventilation: "stuffy",
    hygiene: "clean",
    feed: "fresh",
    symptoms: ["mortality"],
    visual: { status: "not-assessed", warnings: [] },
  };
  const response = await request.post("/api/explain", {
    data: { input, adjustments: ["temperature", "humidity", "ventilation"] },
  });
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.projected.score).toBe(60);
  expect(result.actions[0].key).toBe("mortality");
  expect(
    (
      await request.post("/api/explain", {
        data: { input: { ...input, temperature: 1000 } },
      })
    ).status(),
  ).toBe(400);
});
