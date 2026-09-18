import type { Assessment, Followup, HealthObservation } from "./domain";

/** Every high assessment is a durable alert, even when a later score is lower. */
export function alertQueue(
  assessments: Assessment[],
  followups: Followup[],
  now = Date.now(),
) {
  return assessments
    .filter((a) => a.risk.level === "high")
    .map((assessment) => {
      const history = followups
        .filter(
          (f) =>
            f.batchId === assessment.batchId &&
            f.assessmentId === assessment.id &&
            Date.parse(f.recordedAt) >= Date.parse(assessment.capturedAt),
        )
        .sort(
          (a, b) =>
            Date.parse(b.recordedAt) - Date.parse(a.recordedAt) ||
            b.id.localeCompare(a.id),
        );
      const latest = history[0];
      return {
        assessment,
        history,
        status: latest?.status ?? "open",
        latest,
        overdue:
          latest?.status === "scheduled" &&
          !!latest.dueAt &&
          Date.parse(latest.dueAt) < now,
      };
    })
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        Date.parse(a.assessment.capturedAt) -
          Date.parse(b.assessment.capturedAt) ||
        a.assessment.id.localeCompare(b.assessment.id),
    );
}

/** Descriptive interval only. Retrospective/estimated onset is never labelled measured warning lead time. */
export function onsetComparison(
  observation: HealthObservation,
  assessments: Assessment[],
) {
  if (!observation.onsetAt || observation.finding === "no-unusual-signs")
    return null;
  const onset = Date.parse(observation.onsetAt);
  const earlier = assessments
    .filter(
      (a) =>
        a.batchId === observation.batchId &&
        a.risk.level === "high" &&
        Date.parse(a.capturedAt) < onset,
    )
    .sort(
      (a, b) =>
        Date.parse(b.capturedAt) - Date.parse(a.capturedAt) ||
        b.id.localeCompare(a.id),
    )[0];
  return earlier
    ? {
        assessment: earlier,
        hours: (onset - Date.parse(earlier.capturedAt)) / 3600000,
        precision: observation.onsetPrecision,
      }
    : null;
}
