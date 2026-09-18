import { expect, it } from "vitest";
import { assessRisk, leafReviewState } from "../shared/risk";
import { explainCare } from "../shared/explain";
import {
  assessmentSchema,
  type LeafEvidence,
  type RiskInput,
} from "../shared/domain";
const leaf: LeafEvidence = {
  task: "mulberry-leaf-only",
  version: "mulberry-baseline-v1",
  label: "Leaf rust",
  scores: [0.02, 0.95, 0.03],
  qualityWarnings: [],
  confirmedMulberry: true,
  capturedAt: "2026-09-16T00:00:00Z",
  mediaId: null,
};
const normal: RiskInput = {
  instar: "V",
  moulting: false,
  temperature: 24,
  humidity: 70,
  ventilation: "adequate",
  hygiene: "clean",
  feed: "fresh",
  symptoms: [],
  visual: { status: "not-assessed", warnings: [], leaf },
};
it("scales environmental severity rather than giving tiny deviations maximum points", () => {
  const scores = [24, 24.1, 25, 27, 29, 40].map(
    (temperature) =>
      assessRisk({
        ...normal,
        temperature,
        visual: { status: "not-assessed", warnings: [] },
      }).score,
  );
  expect(scores).toEqual([0, 1, 4, 12, 20, 20]);
  expect(
    assessRisk({
      ...normal,
      humidity: 70.1,
      visual: { status: "not-assessed", warnings: [] },
    }).score,
  ).toBe(1);
});
it("leaf warnings raise feed review despite a fresh-feed answer, without double counting poor feed", () => {
  expect(assessRisk(normal).level).toBe("medium");
  expect(assessRisk(normal).score).toBe(20);
  expect(assessRisk({ ...normal, feed: "poor" }).score).toBe(20);
  expect(explainCare(normal, ["feed"]).projected.score).toBe(20);
});
it("healthy-looking leaves do not cancel poor feed or mortality", () => {
  const visual = {
    ...normal.visual,
    leaf: { ...leaf, label: "Healthy" as const, scores: [0.95, 0.03, 0.02] },
  };
  expect(assessRisk({ ...normal, visual }).score).toBe(0);
  expect(assessRisk({ ...normal, visual, feed: "poor" }).score).toBe(20);
  expect(assessRisk({ ...normal, visual, symptoms: ["mortality"] }).level).toBe(
    "high",
  );
});
it("abstains on unconfirmed, poor-quality, ambiguous and inconsistent leaf results", () => {
  for (const variant of [
    { ...leaf, confirmedMulberry: false },
    { ...leaf, qualityWarnings: ["Too dark"] },
    { ...leaf, scores: [0.3, 0.4, 0.3] },
    { ...leaf, scores: [0.9, 0.05, 0.05] },
  ]) {
    expect(leafReviewState(variant)).toBe("uncertain");
    const risk = assessRisk({
      ...normal,
      visual: { ...normal.visual, leaf: variant },
    });
    expect(risk.score).toBe(0);
    expect(risk.missing).toContain("Usable, confirmed mulberry leaf photo");
  }
});
it("keeps leaf provenance through schema validation used by save, import and sync", () => {
  const a = assessmentSchema.parse({
    ...normal,
    id: "assessment",
    batchId: "batch",
    capturedAt: leaf.capturedAt,
    notes: "",
    mediaId: null,
    mediaKind: null,
    risk: assessRisk(normal),
  });
  expect(a.visual.leaf).toEqual(leaf);
});
