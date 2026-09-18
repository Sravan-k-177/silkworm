import type { Assessment, Outcome } from "./domain";
/** Inclusive UTC day filter for a batch's latest assessment; histories remain intact. */
export function latestAssessmentInRange(
  capturedAt: string | undefined,
  from: string,
  through: string,
) {
  if (!from && !through) return true;
  if (from && through && from > through) return false;
  if (!capturedAt || !Number.isFinite(Date.parse(capturedAt))) return false;
  const day = new Date(capturedAt).toISOString().slice(0, 10);
  return (!from || day >= from) && (!through || day <= through);
}
/** Compare against information captured strictly before outcome entry, never later observations. */
export function outcomeComparison(
  batchId: string,
  assessments: Assessment[],
  outcomes: Outcome[],
) {
  const outcome = outcomes
    .filter((o) => o.batchId === batchId)
    .sort(
      (a, b) =>
        Date.parse(b.recordedAt) - Date.parse(a.recordedAt) ||
        b.id.localeCompare(a.id),
    )[0];
  if (!outcome)
    return {
      outcome: undefined,
      assessment: undefined,
      hoursBeforeEntry: null,
    };
  const assessment = assessments
    .filter(
      (a) =>
        a.batchId === batchId &&
        Date.parse(a.capturedAt) < Date.parse(outcome.recordedAt),
    )
    .sort(
      (a, b) =>
        Date.parse(b.capturedAt) - Date.parse(a.capturedAt) ||
        b.id.localeCompare(a.id),
    )[0];
  return {
    outcome,
    assessment,
    hoursBeforeEntry: assessment
      ? (Date.parse(outcome.recordedAt) - Date.parse(assessment.capturedAt)) /
        3600000
      : null,
  };
}
