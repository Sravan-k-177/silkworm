# Prospective validation protocol

This is a proposed study design for the requested early, non-diagnostic silkworm health-risk system. It is not an approved departmental protocol and does not establish effectiveness of the current demo.

## Intended use and endpoints

The intended decision is prioritization of field review and preventive care for a defined Bombyx mori batch. Disease diagnosis is outside the product claim. Define a prediction horizon and an adverse-outcome endpoint with departmental experts before collecting evaluation data or selecting risk thresholds. Candidate endpoints include independently reviewed abnormal mortality over a fixed future interval and a specified decline in survival. A label assigned from the same photograph is insufficient to measure future risk.

Record the first observed abnormality, first confirmed adverse event, harvest date, assessor, confirmation method and any uncertainty in timestamps. Keep recording time separate from event time. Repeated negative inspections are valuable because the absence of a recorded adverse event is not automatically evidence of a healthy batch.

## Sampling and ground truth

Recruit farms spanning the intended district, breeds, instars, seasons, shed construction, lighting and smartphone classes. Capture consecutive eligible batches rather than selecting only visibly diseased worms. Retain failed captures, missing environmental readings and assessments without media; otherwise the evaluation will overstate operational coverage.

Use anonymous farm, shed, tray and batch identifiers with stable linkage. Record camera/session identity, image bursts, video source and frame timestamps. Assign related specimens, frames, crops and augmentations to the same group. Hash-based duplicate detection complements this metadata but cannot replace it.

Field adjudication should be independent of model output where practical. Record specialist examination or laboratory confirmation separately from farmer-reported appearance. Label uncertainty and disagreement explicitly. Do not convert scene classes such as Overlap into pathology classes or apply leaf disease labels to larvae.

## Model comparison and data partitions

Compare environment-only, image-only and combined models against a simple stage-aware checklist baseline. Also evaluate the combined model when one modality is missing. Use farm/batch grouped development partitions and a later prospective external test period. Model selection, calibration and priority thresholds belong entirely to development data. Freeze the tested artifact and retain its checksum before examining test outcomes.

For video, evaluate static frames and temporal features separately. Camera movement, light changes, moulting and feeding can confound apparent motion. Dense-tray counting errors need their own evaluation before count-derived mortality or survival measures are trusted.

## Reporting

Report sensitivity, specificity, precision, false alerts per batch-day, alert burden per officer, coverage/abstention, calibration and confidence intervals. Include confusion matrices and per-farm, instar, breed, season and device breakdowns when sample sizes permit. Estimate uncertainty at the batch or farm level rather than treating correlated frames as independent samples.

Lead time is the interval between a qualifying warning and an independently recorded adverse-event onset. Hours before outcome entry or harvest are different quantities. Report the fraction of adverse events warned early, false alerts in batches without events and the distribution of lead times. A title containing “early” or high image classification accuracy does not establish this endpoint.

## Intervention and impact

Logging an intervention after a warning does not prove it improved the harvest. Intervention effectiveness needs a prospective comparison that addresses differences in baseline risk, breed, season, staff attention and feed. A phased deployment with an agreed comparison strategy may be practical, but its design requires departmental ownership. Define ERR using confirmed whole-cycle counts; report transfers, excluded larvae, missing harvests and matching cocoon/shell sample definitions.

## Operational acceptance

Measure cold-start loading, inference and explanation latency, peak memory, battery cost, storage pressure, interrupted capture recovery and synchronization on representative Android devices. Test offline reopening after device restart and service-worker updates. Verify account, role and farm restrictions with real deployment authentication before supervisory rollout.

Maintain versioned SOP provenance, model/task contracts, immutable assessment history, reviewer corrections and rollback procedures. Preventive recommendations require local scope and approval; an unvalidated model should not silently change chemical treatment instructions.

## Evidence basis

The design addresses gaps identified in the [research audit](RESEARCH.md) and [source inventory](SOURCES.csv), particularly single-source image classification, augmentation/crop dependence, limited tracking sequences and the distinction between Muga environmental warnings and indoor Bombyx mori health risk. The proposed metrics and study gates are engineering/research recommendations, not quoted departmental acceptance thresholds.
