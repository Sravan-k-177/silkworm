# Testing

Recorded 2026-09-08.

## Executed inspection

- `pwd`: confirmed `/home/sravan/Desktop/tuffLikeSilk`.
- `rg --files` with project-document and manifest filters: no matches; exit 1 means no matches, not an application failure.
- `ls -la`: confirmed the directory initially contained only dot entries.
- `find .. -name AGENTS.md -print`: no matching instruction files.

## Validation limits

No application build, unit/integration tests, mobile screenshots, accessibility tests, model training, evaluation, or offline inference measurement was possible against existing code because none exists. This documentation handoff does not satisfy the requested functional-product acceptance goal.

## Required future checks

Once actual scope is present: validate core workflows and persistence, loading/error/empty states, keyboard and screen-reader access, layout at 360/390/430 pixels, network loss and reconnect, and browser inference on representative devices. Record exact commands and observed outputs. For ML, retain immutable split manifests, data attribution, baseline results, per-class metrics, confusion matrices, export parity checks, artifact sizes and measured device latency. Do not report estimates as measurements.

## Active implementation checks

- Node22.23.1, npm10.9.8, Python3.12.3 observed locally.
- Dependency installation succeeded:212 packages.
- First `npm run build` failed on unavailable Lucide CloudCheck export; replaced with CloudUpload. Rerun pending.
- Added meaningful risk behavior tests (moult, death escalation, missing values, stage boundaries, score cap, true zero outcomes) and sync tests (offline retention, acknowledgement/cursor, immutable conflicts).
- No model accuracy or browser latency result exists yet.

## Verified continuation, 9 September 2026

The earlier inspection-only limitations above are historical. Current checks:

- `npm run build`: passes after repairing nested JSX in LeafLab.
- `npm test`: 11 tests pass, including trained Python-to-JavaScript probability parity.
- `npm run test:e2e`: 5 pass: complete offline field cycle/deferred sync, mobile width checks, API validation/conflict/origin checks, home accessibility, real leaf inference after offline reload.
- `ml/.venv/bin/python ml/acquire_mulberry.py`: retry completed 1,091 images, zero failures.
- `ml/.venv/bin/python ml/train_baseline.py`: completed full-corpus baseline experiment. Split manifest, fitted-model report, original provenance hashes, held-out fixture and exported model retained.
- Selected model: color/texture logistic regression, 20,915 bytes. Test accuracy 0.9357798165. This is internal leaf classification, not larval risk accuracy.

Screenshots: artifacts/mobile-home-{360,390,430}.png, mobile-capture-390.png, mobile-result-390.png, mobile-supervisor-390.png, mobile-leaf-offline-390.png. Screenshot capture alone does not imply complete visual review. Automated accessibility currently covers home only. Browser probability parity uses a feature fixture; full pixel-preprocessing parity still requires verification.

Traceability iteration: build and 11 unit tests pass. The existing complete offline workflow was extended to create an assessment-linked correction review before reconnecting and synchronizing; all 5 E2E tests pass. Review records are additive; old assessment JSON is not rewritten. Full server-side reference-integrity validation and authenticated reviewer identity remain deployment work.

Demo-readiness iteration: added axe checks for leaf upload, settings and supervisor screens. Initial runs found low contrast in the back link, supervisor label and table headings, plus an unfocusable horizontal table region. Fixed the colors and added a named, keyboard-focusable scroll region with visible focus. Production build and all 6 E2E tests now pass. These checks cover the tested screen states, not every form/result or assistive-technology combination.

Model-preprocessing iteration: exported the actual held-out image's RGBA bytes with independently computed Python features. JavaScript matches all 153 features to ten decimal places; all 15 unit tests pass. This closes feature-extraction parity for identical decoded pixels. It does not establish equivalence between browser resampling of arbitrary originals and Pillow Lanczos acquisition preprocessing. The real-pixel fixture is reproducible with `ml/.venv/bin/python ml/make_feature_fixture.py`.

Supervisor filter assertions exposed test-server state retained across runs: repeated fixtures synchronized back as multiple batches with the same display name. Playwright now allocates a fresh database directory per invocation, without deleting user or earlier test data. The added assertions check that low-risk filtering removes the high-risk outcome row and switching to high restores it.

Rule 0.2: added regression coverage for Healthy, Leaf rust and Grasserie labels from an unverified model. None changes checklist score or implies validated larval evidence. All 16 unit tests and production build pass.

Video iteration: a two-second VP9 test-pattern clip now exercises actual browser decoding, five-frame sampling, saving an offline assessment, reload and reopening the persisted media/result. The targeted test passes. This establishes the tested Chromium/VP9 workflow only; smartphone MP4/HEVC support and real larval activity inference remain unverified. Synthetic clip provenance is in tests/fixtures/README.md and is excluded from research/training use.

## Chronology and populated-screen verification — 10 September 2026

Outcome comparisons now sort parsed instants instead of timestamp text. Accepted UTC timestamps with different fractional-second precision select the correct latest outcome and preceding assessment; equal instants use deterministic ID ties. Added regression tests for precision, ties and preserving input order. No stored records are rewritten.

Full browser verification exposed insufficient contrast in the populated supervisor screen’s unassessed badge and observation chart labels. Darkened those foregrounds. Production build, all 22 unit tests and all 7 browser/API tests pass, including secondary-screen accessibility, offline field/sync, leaf inference and video capture. Accessibility evidence remains limited to tested states.

## Continuation verification — 11 September 2026

Production build, all 30 unit tests and all 7 browser/API tests pass. The offline field test now covers scheduling a persistent high-risk follow-up, advancing the browser clock to verify overdue state, displaying its dated history, and saving an independent health observation. Unit tests cover alert persistence, resolution/reopening chronology, cross-batch exclusion and onset/count validation.

Larval inference integration code exists, but `public/models/larval-appearance.json` and its ONNX artifact are absent. Passing tests do not establish working larval inference; the installed leaf model remains the only available model artifact. Requirement coverage was refreshed to reflect implemented follow-ups and outcome metadata. Real-device validation, multilingual flows and larval model completion remain open.

## Field UI/UX iteration — 11 September 2026

Home now directs an empty workspace to first-batch creation. Batch discovery has visible labels, tray-code search, whitespace-tolerant matching, an unassessed filter, result counts and clear-filter recovery. Mobile record navigation exposes all six tabs in two rows, with arrow/Home/End keyboard support and a labelled tab panel. Narrow-phone forms use a single column, mobile controls use larger text, and reduced-motion preferences are respected. Capture describes offline capability without claiming an unsaved form is already saved.

Production build, 30 unit tests and all 8 browser/API tests pass. New browser coverage verifies first-batch entry, keyboard tab navigation, tray search, unassessed filtering, empty-result recovery, mobile overflow and batch-browser axe checks. Inspected screenshots: `artifacts/mobile-batch-tabs-390.png` and `artifacts/mobile-batch-search-390.png`.

## Reuse-first scope and supervisor dates — 16 September 2026

Production build, all 35 unit tests and all 16 browser/API tests pass. Supervisor filters now support inclusive UTC dates for the latest assessment, open bounds, invalid-range feedback and clearing all filters. Selected batches retain full histories. Regression checks cover date boundaries and unassessed batches; the browser field cycle checks exclusion, invalid-range feedback and recovery. Existing backend/browser model parity, offline inference, camera, video and synchronization checks pass.

## Telugu, mobile and account release — 16 September 2026

- `npm run build`: passed; application and vendor chunks separated; fonts and language catalogue precached.
- `npm test`: 37 tests passed, including catalogue completeness, interpolation preservation and stored risk-evidence translation.
- `npm run test:e2e`: 18 passed. Includes a populated Telugu capture/care/history/supervisor/settings workflow at 320 px, offline Telugu reload and English/Telugu screen sweeps at 360/430/768/1024/1440 px. Existing model parity, camera, video, accessibility and offline sync checks pass.
- `npm run test:auth`: 7 passed. Anonymous/invalid-login/origin denial; farm isolation and transactional rejection; supervisor-only reviews and parent links; local account separation; bounded offline sessions; offline sign-out; stale-tab identity checks.
- `ml/.venv/bin/python -m unittest discover -s ml -p test_external_evaluation.py -v`: 8 passed. Includes frozen ONNX/Python parity, empty data rejection, duplicate/source overlap checks and metric mechanics. Synthetic fixtures are not field evidence.
- `node scripts/test-backup.mjs`: online WAL snapshot restores with integrity `ok`; post-snapshot writes are absent.
- Caddy 2.11.4 validates `deployment/Caddyfile` with a placeholder domain; no public TLS issuance is claimed.

Screenshots include `artifacts/telugu-settings-320.png`. Physical-phone and real-shed testing were excluded by request. No independent translation review or independent data validation was performed.

Live services verified: anonymous app on 8787 and separate accounts on 8790; login, Telugu page, 390 px layout, authenticated model health and logout denial pass. See `artifacts/local-deployment-verification.json`. Generated credentials remain in the owner-readable `.data/accounts-local/ACCESS.txt`, outside reports and version control.

## Local end-to-end repair — 16 September 2026

The new cross-account workflow initially failed because an already-open supervisor never fetched new field records without a manual sync. After adding periodic/focus refresh, the complete flow passes: real inference → offline assessment/care → supervisor review/follow-up → field receipt → outcome/export. A separate HTTP 503 recovery test verifies automatic retry and server persistence of queued records.

Current run: production build, 37 unit tests, 18 general browser/API tests and 9 account browser/API tests pass. Live `demo-check.mjs`, `deep-demo-check.mjs` and `npm run check:local` pass against the restarted deployment. Python/model code was unchanged; evaluator tests were not rerun in this repair. The local verification artifact contains no credentials.

## Leaf scoring integration — 16 September 2026

Production build, 42 unit tests, 20 general browser/API tests and 9 account browser/API tests pass. Five new unit checks cover graded environmental deviations, feed evidence without double counting, healthy-leaf non-cancellation, leaf abstention and schema preservation. New browser checks cover a real internal rust-test image passed from standalone leaf inference into an offline batch, a saved/reopened local photo, score persistence, backend explanation parity, sync/export and dark-photo retake. The account workflow now saves both tray inference and leaf evidence offline. The fixture provenance is documented; it is not independent field evidence.

The full-suite leaf-export test initially selected another previously synchronized assessment; it now selects its own named batch explicitly. All 20 general tests pass together after that correction. Live app/account services were restarted and `npm run check:local` passes. No model retraining or external field evaluation was performed. See SCORING.md for the numeric policy and limitations.
