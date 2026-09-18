import type { LeafEvidence, Risk, RiskInput } from "./domain.ts";
export const RULE_VERSION = "priority-rules-0.4";
export const SOP_URL = "https://csrtiber.res.in/Technologies_descriptor.pdf";
export const profiles = {
  I: { temperature: [27, 28], humidity: [85, 90] },
  II: { temperature: [26, 28], humidity: [85, 90] },
  III: { temperature: [26, 27], humidity: [80, 80] },
  IV: { temperature: [24, 25], humidity: [75, 75] },
  V: { temperature: [23, 24], humidity: [70, 70] },
} as const;
export function assessRisk(input: RiskInput): Risk {
  const factors: Risk["factors"] = [];
  const missing: string[] = [];
  const p = profiles[input.instar];
  const add = (
    key: string,
    label: string,
    points: number,
    action: string,
    source = "Prototype checklist policy",
  ) => factors.push({ key, label, points, action, source });
  for (const [key, label, range, unit] of [
    ["temperature", "Temperature", p.temperature, "°C"],
    ["humidity", "Relative humidity", p.humidity, "%"],
  ] as const) {
    const value = input[key];
    if (value === null) {
      missing.push(label);
      continue;
    }
    if (value < range[0] || value > range[1])
      add(
        key,
        `${label} ${value}${unit} is outside ${range[0]}–${range[1]}${unit}`,
        Math.min(
          20,
          Math.max(
            1,
            Math.ceil(
              (20 * Math.max(range[0] - value, value - range[1])) /
                (key === "temperature" ? 5 : 15),
            ),
          ),
        ),
        `Recheck the reading at tray height. Review ${label.toLowerCase()} with the local rearing guidance before adjusting.`,
        SOP_URL,
      );
  }
  if (input.ventilation === "unknown") missing.push("Ventilation");
  if (input.hygiene === "unknown") missing.push("Hygiene");
  if (input.feed === "unknown") missing.push("Feed quality");
  if (input.ventilation === "stuffy")
    add(
      "ventilation",
      "Stuffy or poorly ventilated shed",
      15,
      "Improve air exchange without directing strong draughts at larvae.",
    );
  if (input.hygiene === "litter")
    add(
      "hygiene",
      "Wet litter or unclean rearing bed",
      20,
      "Arrange appropriate bed cleaning and keep equipment clean. Follow local instructions during moulting.",
    );
  const leaf = input.visual.leaf;
  const leafState = leafReviewState(leaf);
  if (!leaf) missing.push("Mulberry leaf photo");
  else if (leafState === "uncertain")
    missing.push("Usable, confirmed mulberry leaf photo");
  if (input.feed === "poor" || leafState === "review")
    add(
      "feed",
      leafState === "review"
        ? "Mulberry leaf photo warrants feed review"
        : "Wilted, wet or suspect feed reported",
      20,
      "Review leaf quality and handling with field staff before using suspect leaves. A leaf photo cannot verify contamination, pesticide residues or nutritional quality.",
      "https://csrtimys.res.in/diseases-pests",
    );
  if (input.symptoms.includes("mortality"))
    add(
      "mortality",
      "Unusual mortality reported",
      60,
      "Contact the sericulture extension officer promptly. Record affected trays and follow departmental containment instructions.",
    );
  if (input.symptoms.includes("discoloration"))
    add(
      "discoloration",
      "Unusual appearance reported",
      25,
      "Request a trained field review; a photograph cannot confirm a disease.",
    );
  if (input.symptoms.includes("uneven-growth"))
    add(
      "uneven-growth",
      "Uneven growth reported",
      15,
      "Review feeding, spacing and batch stage with field staff.",
    );
  if (input.symptoms.includes("reduced-feeding") && !input.moulting)
    add(
      "feeding",
      "Reduced feeding outside moulting reported",
      20,
      "Recheck larvae and feed quality, record changes, and seek field review if persistent.",
    );
  // Positive image evidence can raise review priority but never lower environmental concerns.
  const v = input.visual.larval;
  if (
    v?.task === "silkworm-appearance-only" &&
    v.version === "larval-appearance-v1" &&
    v.decision === "review" &&
    ["Flacherie", "Grasserie", "Pebrine"].includes(v.label) &&
    (v.scores.find((s) => s.label === v.label)?.score ?? 0) >= 0.7 &&
    v.frameAgreement >= 0.6 &&
    !input.visual.warnings.length &&
    !v.qualityWarnings?.length
  )
    add(
      "larval-appearance",
      "Image appearance warrants a field review",
      input.symptoms.includes("discoloration") ? 0 : 25,
      "Retake a clear close view and request an officer review. This image comparison does not confirm a disease.",
      "Larval appearance v1 + engineering review policy; image dataset: doi:10.17632/g4b89vpp9c.1",
    );
  if (v?.decision === "overlap")
    missing.push("Separate view of overlapping larvae");
  if (v?.decision === "uncertain")
    missing.push("Confident in-scope visual comparison");
  // Internal appearance classification is not prospective health validation.

  missing.push("Validated visual health assessment");
  if (input.visual.warnings.length) missing.push("Clear, usable media");
  const score = Math.min(
    100,
    factors.reduce((n, f) => n + f.points, 0),
  );
  return {
    score,
    level: score >= 50 ? "high" : score >= 20 ? "medium" : "low",
    factors,
    missing,
    version: RULE_VERSION,
    profile: "CSR&TI Berhampore • Eastern & Northeastern India • v0.1",
  };
}
export function outcomeMetrics(o: {
  countScope?: "whole-cycle" | "partial" | "unknown";
  larvaeBrushed: number | null;
  cocoonsHarvested: number | null;
  sampleCocoonG: number | null;
  sampleShellG: number | null;
}) {
  return {
    err:
      o.countScope === "whole-cycle" &&
      o.larvaeBrushed &&
      o.cocoonsHarvested !== null
        ? (100 * o.cocoonsHarvested) / o.larvaeBrushed
        : null,
    shellRatio:
      o.sampleCocoonG && o.sampleShellG !== null
        ? (100 * o.sampleShellG) / o.sampleCocoonG
        : null,
  };
}

// Engineering abstention gate, not calibrated disease confidence or plant identification.
export function leafReviewState(
  leaf?: LeafEvidence,
): "missing" | "uncertain" | "review" | "no-visible-alert" {
  if (!leaf) return "missing";
  const ordered = [...leaf.scores].sort((a, b) => b - a);
  const index = ["Healthy", "Leaf rust", "Leaf spot"].indexOf(leaf.label);
  if (
    leaf.task !== "mulberry-leaf-only" ||
    leaf.version !== "mulberry-baseline-v1" ||
    !leaf.confirmedMulberry ||
    leaf.qualityWarnings.length ||
    leaf.scores[index] !== ordered[0] ||
    ordered[0] < 0.8 ||
    ordered[0] - ordered[1] < 0.2
  )
    return "uncertain";
  return leaf.label === "Healthy" ? "no-visible-alert" : "review";
}
