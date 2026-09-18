import { z } from "zod";
export const instars = ["I", "II", "III", "IV", "V"] as const;
const id = z.string().min(1).max(100);
const text = z.string().trim().max(2000);
const date = z.string().datetime();
export const batchSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  farm: z.string().trim().min(1).max(80),
  shed: z.string().trim().min(1).max(80),
  tray: z.string().trim().max(80),
  started: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  initialLarvae: z.number().int().positive().max(10000000).nullable(),
  species: z.literal("Bombyx mori"),
});
export const larvalVisualSchema = z.object({
  execution: z.enum(["backend", "device"]).optional(),
  modelSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  runtime: z.string().max(100).optional(),
  architecture: z.string().max(150).optional(),
  qualityWarnings: z.array(z.string().max(300)).max(10).optional(),
  task: z.literal("silkworm-appearance-only"),
  version: z.literal("larval-appearance-v1"),
  decision: z.enum(["review", "uncertain", "overlap", "no-visible-alert"]),
  label: z.enum(["Flacherie", "Grasserie", "Healthy", "Overlap", "Pebrine"]),
  scores: z
    .array(
      z.object({
        label: z.enum([
          "Flacherie",
          "Grasserie",
          "Healthy",
          "Overlap",
          "Pebrine",
        ]),
        score: z.number().min(0).max(1),
      }),
    )
    .length(5),
  inferenceMs: z.number().nonnegative(),
  explanationMs: z.number().nonnegative(),
  influence: z.array(z.number().min(-1).max(1)).length(16),
  frameAgreement: z.number().min(0).max(1),
  sampledFrames: z.number().int().min(1).max(5),
});
export type LarvalVisual = z.infer<typeof larvalVisualSchema>;
export const leafExecutionSchema = z.object({
  execution: z.enum(["backend", "device"]),
  runtime: z.string().min(1).max(100),
  modelSha256: z.string().regex(/^[a-f0-9]{64}$/),
  inputSha256: z.string().regex(/^[a-f0-9]{64}$/),
  inferenceMs: z.number().nonnegative().finite(),
  explanationMs: z.number().nonnegative().finite(),
  modelRuns: z.literal(17),
  scores: z.array(z.number().min(0).max(1)).length(3),
  influence: z.array(z.number().min(-1).max(1)).length(16),
});
export const leafEvidenceSchema = z.object({
  executionReceipt: leafExecutionSchema.optional(),
  task: z.literal("mulberry-leaf-only"),
  version: z.literal("mulberry-baseline-v1"),
  label: z.enum(["Healthy", "Leaf rust", "Leaf spot"]),
  scores: z.array(z.number().min(0).max(1)).length(3),
  qualityWarnings: z.array(z.string().max(300)).max(10),
  confirmedMulberry: z.boolean(),
  capturedAt: date,
  mediaId: id.nullable(),
});
export type LeafEvidence = z.infer<typeof leafEvidenceSchema>;
export const visualSchema = z.object({
  leaf: leafEvidenceSchema.optional(),
  status: z.enum(["not-assessed", "quality-only", "model"]),
  larval: larvalVisualSchema.optional(),
  brightness: z.number().min(0).max(255).optional(),
  sharpness: z.number().nonnegative().optional(),
  warnings: z.array(z.string().max(300)).max(10),
  modelVersion: z.string().max(100).optional(),
  label: z.string().max(80).optional(),
  score: z.number().min(0).max(1).optional(),
  frames: z.number().int().positive().max(12).optional(),
  frameTimes: z.array(z.number().nonnegative()).max(12).optional(),
  frameDifference: z.number().min(0).max(255).optional(),
});
export const assessmentSchema = z.object({
  id,
  batchId: id,
  capturedAt: date,
  instar: z.enum(instars),
  moulting: z.boolean(),
  temperature: z.number().min(0).max(60).nullable(),
  humidity: z.number().min(0).max(100).nullable(),
  ventilation: z.enum(["adequate", "stuffy", "unknown"]),
  hygiene: z.enum(["clean", "litter", "unknown"]),
  feed: z.enum(["fresh", "poor", "unknown"]),
  symptoms: z
    .array(
      z.enum([
        "mortality",
        "discoloration",
        "reduced-feeding",
        "uneven-growth",
      ]),
    )
    .max(4),
  notes: text,
  visual: visualSchema,
  mediaId: id.nullable(),
  mediaKind: z.enum(["image", "video"]).nullable(),
  risk: z.object({
    score: z.number().min(0).max(100),
    level: z.enum(["low", "medium", "high"]),
    version: z.string().max(100),
    factors: z
      .array(
        z.object({
          key: z.string(),
          label: z.string(),
          points: z.number(),
          action: z.string(),
          source: z.string(),
        }),
      )
      .max(15),
    missing: z.array(z.string()).max(10),
    profile: z.string(),
  }),
});
export const interventionSchema = z.object({
  id,
  batchId: id,
  assessmentId: id.nullable(),
  action: z.string().trim().min(1).max(500),
  status: z.enum(["planned", "completed"]),
  notes: text,
  recordedAt: date,
});
export const outcomeSchema = z
  .object({
    id,
    batchId: id,
    recordedAt: date,
    harvestDate: z.string().date().nullable().optional(),
    countScope: z.enum(["whole-cycle", "partial", "unknown"]).optional(),
    sampleSize: z.number().int().positive().max(10000).nullable().optional(),
    larvaeBrushed: z.number().int().positive().max(10000000).nullable(),
    cocoonsHarvested: z.number().int().nonnegative().max(10000000).nullable(),
    mortality: z.number().int().nonnegative().max(10000000).nullable(),
    cocoonKg: z.number().nonnegative().max(100000).nullable(),
    sampleCocoonG: z.number().positive().max(100).nullable(),
    sampleShellG: z.number().nonnegative().max(100).nullable(),
    notes: text,
  })
  .superRefine((x, c) => {
    if (
      x.sampleShellG !== null &&
      x.sampleCocoonG !== null &&
      x.sampleShellG > x.sampleCocoonG
    )
      c.addIssue({
        code: "custom",
        message: "Shell weight cannot exceed whole cocoon weight.",
      });
    if (
      x.cocoonsHarvested !== null &&
      x.larvaeBrushed !== null &&
      x.cocoonsHarvested > x.larvaeBrushed
    )
      c.addIssue({
        code: "custom",
        message: "Cocoons cannot exceed larvae brushed.",
      });
    if (
      x.mortality !== null &&
      x.larvaeBrushed !== null &&
      x.mortality > x.larvaeBrushed
    )
      c.addIssue({
        code: "custom",
        message: "Mortality cannot exceed larvae brushed.",
      });
  });
export const reviewSchema = z.object({
  id,
  batchId: id,
  assessmentId: id,
  recordedAt: date,
  reviewerCode: z.string().trim().min(1).max(80),
  decision: z.enum(["supported", "needs-recheck", "correction"]),
  notes: z.string().trim().min(1).max(2000),
});
export type Review = z.infer<typeof reviewSchema>;
export const followupSchema = z
  .object({
    id,
    batchId: id,
    assessmentId: id,
    recordedAt: date,
    status: z.enum(["acknowledged", "scheduled", "resolved", "reopened"]),
    staffCode: z.string().trim().min(1).max(80),
    dueAt: date.nullable(),
    notes: z.string().trim().min(1).max(2000),
  })
  .superRefine((x, c) => {
    if (x.status === "scheduled" && !x.dueAt)
      c.addIssue({
        code: "custom",
        message: "A scheduled follow-up needs a due date.",
      });
  });
export type Followup = z.infer<typeof followupSchema>;
export const healthObservationSchema = z
  .object({
    id,
    batchId: id,
    recordedAt: date,
    observedAt: date,
    onsetAt: date.nullable(),
    onsetPrecision: z.enum(["unknown", "estimated", "observed"]),
    observerCode: z.string().trim().min(1).max(80),
    finding: z.enum(["no-unusual-signs", "stress-signs", "mortality"]),
    examinedCount: z.number().int().positive().max(10000000).nullable(),
    affectedCount: z.number().int().nonnegative().max(10000000).nullable(),
    evidence: z.enum(["field-observation", "officer-review", "laboratory"]),
    notes: z.string().trim().min(1).max(2000),
  })
  .superRefine((x, c) => {
    if (Date.parse(x.observedAt) > Date.parse(x.recordedAt))
      c.addIssue({
        code: "custom",
        message: "Observation time cannot be after recording time.",
      });
    if (x.onsetAt && Date.parse(x.onsetAt) > Date.parse(x.observedAt))
      c.addIssue({
        code: "custom",
        message: "Onset cannot be after the observation.",
      });
    if ((x.onsetPrecision === "unknown") !== !x.onsetAt)
      c.addIssue({
        code: "custom",
        message: "Onset time and its precision must agree.",
      });
    if (
      x.finding === "no-unusual-signs" &&
      (x.onsetAt || (x.affectedCount ?? 0) > 0)
    )
      c.addIssue({
        code: "custom",
        message:
          "A no-unusual-signs observation cannot include onset or affected larvae.",
      });
    if (
      x.affectedCount !== null &&
      (x.examinedCount === null || x.affectedCount > x.examinedCount)
    )
      c.addIssue({
        code: "custom",
        message:
          "Affected count needs a matching examined count and cannot exceed it.",
      });
  });
export type HealthObservation = z.infer<typeof healthObservationSchema>;
const base = { id, createdAt: date, deviceId: id };
export const eventSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("batch"), payload: batchSchema }),
  z.object({
    ...base,
    kind: z.literal("assessment"),
    payload: assessmentSchema,
  }),
  z.object({
    ...base,
    kind: z.literal("intervention"),
    payload: interventionSchema,
  }),
  z.object({ ...base, kind: z.literal("outcome"), payload: outcomeSchema }),
  z.object({ ...base, kind: z.literal("review"), payload: reviewSchema }),
  z.object({ ...base, kind: z.literal("followup"), payload: followupSchema }),
  z.object({
    ...base,
    kind: z.literal("health-observation"),
    payload: healthObservationSchema,
  }),
]);
export type Batch = z.infer<typeof batchSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
export type Visual = z.infer<typeof visualSchema>;
export type Intervention = z.infer<typeof interventionSchema>;
export type Outcome = z.infer<typeof outcomeSchema>;
export type RecordEvent = z.infer<typeof eventSchema>;
export type Risk = Assessment["risk"];
export type RiskInput = Pick<
  Assessment,
  | "instar"
  | "moulting"
  | "temperature"
  | "humidity"
  | "ventilation"
  | "hygiene"
  | "feed"
  | "symptoms"
  | "visual"
>;
