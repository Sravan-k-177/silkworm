import type { RiskInput } from "./domain.ts";
import { assessRisk, profiles } from "./risk.ts";
export const adjustableKeys = [
  "temperature",
  "humidity",
  "ventilation",
  "hygiene",
  "feed",
] as const;
export type Adjustment = (typeof adjustableKeys)[number];
export function explainCare(input: RiskInput, adjustments: Adjustment[] = []) {
  const risk = assessRisk(input),
    simulated = { ...input };
  for (const key of adjustments) {
    if (key === "temperature" || key === "humidity") {
      // Missing readings must be measured, not silently filled by a simulation.
      if (input[key] !== null)
        simulated[key] =
          (profiles[input.instar][key][0] + profiles[input.instar][key][1]) / 2;
    } else if (key === "ventilation" && input[key] !== "unknown")
      simulated[key] = "adequate";
    else if (key === "hygiene" && input[key] !== "unknown")
      simulated[key] = "clean";
    else if (key === "feed" && input[key] !== "unknown")
      simulated[key] = "fresh";
  }
  const projected = assessRisk(simulated);
  const actions = [...risk.factors]
    .sort((a, b) =>
      a.key === "mortality"
        ? -1
        : b.key === "mortality"
          ? 1
          : b.points - a.points,
    )
    .map((f) => ({
      ...f,
      adjustable: adjustableKeys.includes(f.key as Adjustment),
      when:
        f.key === "mortality"
          ? "Contact an officer promptly"
          : "Review at the next tray check",
    }));
  const feedWorstCase = assessRisk({ ...input, feed: "poor" });
  const projectedFeedWorstCase = assessRisk({ ...simulated, feed: "poor" });
  return {
    risk,
    projected,
    actions,
    feedWorstCase,
    projectedFeedWorstCase,
    pointsRemoved: risk.score - projected.score,
  };
}
