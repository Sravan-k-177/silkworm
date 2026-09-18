# Decisions

Recorded 2026-09-08.

1. **Measured fact:** The workspace was empty on inspection. **Decision:** Do not describe any existing implementation or claim recovery of an architecture.
2. **Observed input:** The original project requirements are replaced by a bracketed placeholder. **Decision:** Record missing scope explicitly; a complete product cannot be assessed against absent acceptance criteria. This is a requirements blocker, not a permission request.
3. **Engineering assumption:** Dataset source discovery is useful independent work because the user explicitly requests real silkworm and mulberry dataset research.
4. **Engineering rule for future training:** Audit downloaded originals, corrupt images, label definitions, provenance, exact duplicates and perceptual near-duplicates before splitting. Group related specimens, sessions and augmentation families together; keep a held-out test set untouched by model selection. A publisher-provided split alone does not establish absence of leakage.
5. **Engineering rule:** Cultivar labels cannot be silently reinterpreted as disease labels. Image disease classification cannot establish longitudinal environmental risk or causal outcomes.
6. **Temporary fallback:** Documentation and preliminary source audit only; no placeholder model or static interface masquerades as functional product delivery.
7. **Unverified hypotheses:** Suitability for the intended deployment population, generalization to smartphone capture, annotation reliability, and device inference performance all remain untested.

## Implementation decisions after receipt of brief

- Earlier requirements blocker is resolved. Implement an offline-first PWA and local SQLite sync server; anonymous codes by default. No paid/external hosted service is required.
- Select the fully retrievable CSR&TI Berhampore regional reference (Eastern/Northeastern India), not the initially considered partially accessible Mysore table. Scope and contradictions must be visible. Single-valued RH targets are represented without inventing scientific tolerances.
- Risk points: temperature deviation20, RH deviation20, stuffiness15, damp/unclean bed20, suspect feed15, reported deaths60, unusual appearance25, uneven growth15, reduced feeding outside moult20. Sum capped100; low<20, medium20–49, high≥50. These are **engineering assumptions**, never probabilities or validated thresholds.
- Missing measurements remain null, and missing visual assessment is always shown. “Low” explicitly means no recorded trigger, not disease-free.
- Image brightness/edge clarity thresholds are **capture heuristics**, not silkworm disease cues. No fabricated heatmap is displayed.
- Photos are re-encoded with max dimension1280; videos currently retain metadata and remain local. Structured events sync, media does not. This tradeoff is visible in settings and result views.
- Event IDs are immutable; conflicting repeated IDs fail with409 rather than silently overwriting. Device data remains after sync failure. Server binds localhost unless a token is configured.

## Rule version 0.2

Inspection found a dormant generic `visual.status === model` branch that could suppress the missing validated-visual warning and award points for any non-Healthy label, including an unrelated leaf class. No larval model is accepted or prospectively validated. Version 0.2 always preserves the missing validated-visual warning and removes generic model-label points. A future larval integration needs an explicit task/version contract and evaluated risk policy. Historical stored assessments retain their original rule version and score.

## Outcome denominator metadata

New outcome records store optional harvest date, explicit whole-cycle/partial/unknown count scope, and optional cocoon weight-sample size. These fields remain optional in the event schema so historical imports retain their exact shape and immutable-event comparisons do not conflict. Derived ERR is withheld unless whole-cycle scope is explicitly recorded; historical raw counts and stored events remain unchanged. Shell ratio remains a matched-sample ratio. Actual disease-onset timestamps and transfers still require a future structured workflow.
