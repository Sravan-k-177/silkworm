# Status

## Leaf scoring integration — 16 September 2026

The assessment form and standalone leaf check now connect mulberry photos to saved feed-review evidence. Rules v0.4 grade environmental deviations, count feed concern once, avoid duplicate visual discoloration points and keep mortality escalation. Offline leaf-image storage, sync/export provenance and poor-photo abstention are covered by new tests. Existing records keep their old rule version; care previews explain version differences. See [SCORING.md](SCORING.md). The leaf classifier itself was not retrained; independent field accuracy remains unknown. Final verification: build, 42 unit tests, 20 general browser/API tests, 9 account browser/API tests and live deployment checks pass.

## Current workspace — 16 September 2026

English and Telugu support is implemented with i18next, including care explanations, alerts, forms, settings and validation messages. The bundled Noto Sans Telugu font works offline. Switching languages preserves drafts. Browser checks cover the complete Telugu workflow at 320 px and main screens at 360, 430, 768, 1024 and 1440 px in both languages.

Account mode now supports persisted Express sessions, scrypt passwords, login throttling, server-enforced farm access, supervisor-only reviews, parent-link validation, immutable entity IDs and authenticated submission receipts. Local workspaces are separate per account/assignment; offline sessions expire, offline sign-out locks the app, and stale-tab sync checks prevent account confusion. The existing localhost service on port 8787 remains an anonymous demo. A separate account service on port 8790 is running and its live login/Telugu/model/logout smoke check passes. Public activation needs a domain and host.

The existing MobileNetV3 backend/device workflow remains intact. The external evaluator checks source overlap, computes per-farm/class metrics and calibration, and includes farm-cluster bootstrap intervals. It cannot establish external accuracy without independent data. AIKosh's resolved official departmental link currently reports resource unavailable.

Verification before leaf integration: production build, 37 unit tests, 18 general browser/API tests, 9 account browser/API tests and 8 Python evaluator tests pass. Online SQLite snapshot/restore verification passes; Caddy 2.11.4 validates the HTTPS configuration. The report is available as HTML/PDF in artifacts. Physical-phone and real-shed tests were excluded by the user.

Remaining external requirements: public host/domain access, authorized independent and longitudinal data, independent Telugu/departmental SOP review, and the operator's retention policy. Disease diagnosis, future warning lead time and yield benefit are not validated. See [deployment](DEPLOYMENT.md), [evaluation inputs](evaluation/README.md) and [release evidence](../artifacts/release-readiness.json).

## Local end-to-end repair — 16 September 2026

Fixed stale cross-account screens: automatic synchronization now pulls every 15 seconds while visible and on focus/visibility return, even with no local writes. Temporary server failures retry without a network toggle. A synchronous in-flight guard prevents overlapping UI sync attempts.

A new two-browser account test covers real backend inference, offline assessment and intervention, automatic supervisor pickup, review and follow-up, automatic return to the field account, outcome calculation and export. A second regression test verifies queued-write recovery after HTTP 503. Build, 37 unit and all 27 browser/API tests pass. Both live services were restarted; `npm run check:local` verifies deployed login, authenticated inference, Telugu layout and logout without creating batch records. The existing demo care and deep-inference smoke checks also pass.

## Historical progress notes

Updated 2026-09-09. Continuing research and implementation until stopped by the user. Existing workspace changes preserved.

## Working and verified

- React/TypeScript field app: anonymous batch identifiers, photo/video capture, environment/checklist assessments, transparent priority factors and preventive actions, care log, outcome metrics, timeline and supervisor summaries.
- IndexedDB capture, immutable events, local SQLite sync, retry retention, idempotent acknowledgement, conflicting-ID rejection, JSON export/import.
- Production offline app shell; full assessment → intervention → outcome → reload → deferred-sync workflow passed in Chromium.
- Video capture samples up to five frames, records brightness/clarity and raw frame difference. This is capture quality, not trained larval activity detection.
- Real auxiliary mulberry model acquired/trained/exported from all 1,091 source images. Duplicate heuristics yield 1,072 groups. Selected logistic baseline has 93.58% test accuracy on 218 internal holdout images; target-shed generalization unknown.
- Model JavaScript probability parity passed against Python fixture. Browser classification after offline reload passed. Model precached and included in service-worker version hash.
- Build passed; 11 unit tests and 5 browser/API tests passed. Mobile layouts checked at 360/390/430 px. Home axe WCAG A/AA check passed.
- Fixed invalid JSX nesting in the unfinished LeafLab screen.

## Next iterations

1. Audit larval datasets and AI Kosh access; expand cited research report and project comparison.
2. Strengthen image feature/decode parity, video browser coverage and model evidence display; inspect screenshots.
3. Implement traceable validation/correction records and clearer outcome denominator metadata.
4. Improve supervisor longitudinal comparisons, visit prioritization, multilingual field usability and accessible secondary screens.
5. Expand report into comprehensive shareable research artifact and document deployment/demo walkthrough.

## Limits

No trained larval risk model or prospective lead-time validation. Risk scores remain explicit engineering priority rules, not probabilities. Auxiliary leaf classification does not alter larval risk. No departmental corpus or locally approved SOP supplied. Media remains on the capture device. Server is a local demo, not production multi-tenant authorization. Current interface is not fully multilingual.

## Latest traceability iteration

Added batch Reviews tab with assessment-linked, append-only validation/recheck/correction notes and anonymous reviewer codes. Original observations and scores remain intact; correction notes explicitly request a new assessment for revised measurements. Records use the existing offline persistence, sync and export pipeline. Reviewer identity is self-reported, not authenticated. Build and unit tests pass; browser workflow now exercises offline correction-note capture before deferred sync.

## Chronology iteration

Supervisor outcome comparisons now select the latest outcome by recorded time and only use an assessment strictly earlier than that entry. They no longer display a later risk score beside an earlier harvest record. Hours before entry are explicitly not lead time to mortality or harvest. Added regression tests for future/simultaneous measurements, cross-batch exclusion, unsorted imports and absent evidence. New official NESAC/CMER&TI Muga warning precedent and 2026 VOC/infrared leads recorded in research.

## Demo readiness iteration

Added README with local run commands, an eight-step offline demonstration, evidence links and deployment limits. Added docs/REQUIREMENTS.md mapping the complete brief to actual evidence and outstanding work. Recorded observed baseline Python dependency versions (clean-environment reproduction pending). Inspected the leaf screenshot and extended accessibility tests to secondary screens; fixed observed contrast and keyboard scrolling issues. Build and all 6 browser/API tests pass.

## Supervisor filter iteration

Added farm and latest-risk filters, including unassessed batches. Queue, risk counts, trend observations, intervention/outcome summaries and comparison rows use the same selected batch set. Empty results explain how to recover. Build and existing six E2E checks pass; targeted filter recovery assertions added to the offline field cycle.

## Visual evidence contract iteration

Rule version 0.2 removes dormant generic model-label risk points and always retains the missing validated larval-visual assessment warning. An unverified or unrelated image model cannot establish health coverage. Existing stored assessments remain unchanged. Build and 16 unit tests pass. Added a full-text Silk Shield project-methods audit to research.

## Outcome metadata iteration

Added harvest date, count scope and weight-sample count to outcome capture/history. New records default to unknown scope; ERR requires an explicit whole-cycle declaration. Legacy events remain readable with original payloads, but unconfirmed denominator scope no longer produces a comparable ERR. Added regression coverage for missing/partial scope and updated the offline field workflow to confirm its known whole-cycle fixture.

## Video verification iteration

Added and passed an end-to-end offline video test using an explicitly synthetic, encoded VP9 fixture. The test confirms five-frame processing and capture/result persistence after reload. It does not validate larval activity or disease detection. The browser suite now contains seven tests (the new video test was run independently after the prior six passed).

## Research synthesis iteration

Created a 16-source CSV/JSON evidence inventory with source owner, task, access state and critical limits, plus a prospective validation protocol covering batch/farm splits, independent onset times, missing modalities, alert burden and outcome-impact studies. Source inventory is curated and not exhaustive. Additional SilkLDP DOI and dense-recognition publisher retrievals failed; no inaccessible methods were treated as verified.

## Sync reliability iteration

Synchronization now rejects foreign/duplicate acknowledgements, invalid pagination flags and responses that make no cursor or queue progress. Reaching the bounded round limit while more work remains reports incomplete synchronization instead of writing a successful last-sync timestamp. Added regression tests for stalled responses and unsent IDs; local queued records remain intact.

## Chronology and populated-screen verification — 10 September 2026

Outcome comparisons now sort parsed instants instead of timestamp text. Accepted UTC timestamps with different fractional-second precision select the correct latest outcome and preceding assessment; equal instants use deterministic ID ties. Added regression tests for precision, ties and preserving input order. No stored records are rewritten.

Full browser verification exposed insufficient contrast in the populated supervisor screen’s unassessed badge and observation chart labels. Darkened those foregrounds. Production build, all 22 unit tests and all 7 browser/API tests pass, including secondary-screen accessibility, offline field/sync, leaf inference and video capture. Accessibility evidence remains limited to tested states.

## Continuation verification — 11 September 2026

Production build, all 30 unit tests and all 7 browser/API tests pass. The offline field test now covers scheduling a persistent high-risk follow-up, advancing the browser clock to verify overdue state, displaying its dated history, and saving an independent health observation. Unit tests cover alert persistence, resolution/reopening chronology, cross-batch exclusion and onset/count validation.

Larval inference integration code exists, but `public/models/larval-appearance.json` and its ONNX artifact are absent. Passing tests do not establish working larval inference; the installed leaf model remains the only available model artifact. Requirement coverage was refreshed to reflect implemented follow-ups and outcome metadata. Real-device validation, multilingual flows and larval model completion remain open.

## Field UI/UX iteration — 11 September 2026

Home now directs an empty workspace to first-batch creation. Batch discovery has visible labels, tray-code search, whitespace-tolerant matching, an unassessed filter, result counts and clear-filter recovery. Mobile record navigation exposes all six tabs in two rows, with arrow/Home/End keyboard support and a labelled tab panel. Narrow-phone forms use a single column, mobile controls use larger text, and reduced-motion preferences are respected. Capture describes offline capability without claiming an unsaved form is already saved.

Production build, 30 unit tests and all 8 browser/API tests pass. New browser coverage verifies first-batch entry, keyboard tab navigation, tray search, unassessed filtering, empty-result recovery, mobile overflow and batch-browser axe checks. Inspected screenshots: `artifacts/mobile-batch-tabs-390.png` and `artifacts/mobile-batch-search-390.png`.
