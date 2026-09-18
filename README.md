# SilkSense

Offline-first sericulture field demo: record batch conditions and tray media, review non-diagnostic priority flags, track care and outcomes, and synchronize structured records to a local supervisor service.

The larval risk score is a transparent, unvalidated checklist policy. It is not a trained disease classifier or a probability of future loss. A separate, real mulberry leaf classifier runs locally for experimental feed review. Its internal test accuracy must not be presented as silkworm health accuracy.

## Latest release: Telugu, mobile and accounts

Choose **తెలుగు** in the top-bar language selector. Navigation, capture, care guidance, follow-ups, reviews, outcomes and settings are translated; language and the bundled Telugu font work offline. The current copy has not received independent Telugu/SOP approval. Browser tests cover 320–1440 px layouts; physical-device testing is excluded from this iteration.

The refreshed anonymous app runs at **http://127.0.0.1:8787/**. A separate account-enabled workspace runs at **http://127.0.0.1:8790/**. Its generated local login is in `.data/accounts-local/ACCESS.txt` (owner-readable only); it starts with farm `F-001`. Existing anonymous records are preserved separately. Services: `silksense` and `silksense-accounts`.

Account mode provides server-enforced farm permissions and supervisor review privileges, persistent sessions, local account separation and offline expiry. The existing localhost service stays in anonymous demo mode. See [account provisioning, HTTPS and recovery](docs/DEPLOYMENT.md) to activate accounts on a real host. No public address has been provisioned.

The [printable evidence report](artifacts/silksense-evidence-report.pdf), [HTML report](artifacts/silksense-evidence-report.html), [release readiness](artifacts/release-readiness.json) and [independent evaluation input guide](docs/evaluation/README.md) distinguish implemented software from external validation. Current verification: 42 unit, 20 general browser/API, 9 account browser/API and 8 Python evaluator tests pass, plus backup recovery and Caddy configuration checks.

## Scoring and field leaf photos

Mulberry leaf photos now attach directly to assessments and contribute a single feed-review factor when usable and confirmed. Use **Photograph the mulberry feed** in an assessment or **Use this leaf result in a batch assessment** from the leaf screen. Both tray and leaf evidence persist separately, including offline. Poor photos request a retake; a healthy-looking leaf never overrides reported feed problems.

Scoring v0.4 scales environmental points with deviation, avoids duplicate appearance/feed points and highlights missing checks. It remains a transparent review policy, not disease probability. Existing saved scores are preserved. See [scoring rules, leaf-model limits and provenance](docs/SCORING.md).

## Local end-to-end use

Open **http://127.0.0.1:8787/** for the complete workflow without signing in, or **http://127.0.0.1:8790/** for account/farm permissions. Local account credentials are in `.data/accounts-local/ACCESS.txt`.

The verified account workflow covers backend image inference → offline assessment and care → synchronization → supervisor review and follow-up → return to the field account → harvest outcome and export. Open, visible screens pull updates every 15 seconds and when brought into focus. Queued writes automatically retry after temporary server outages.

On this machine, restart the installed services with `systemctl --user restart silksense-model silksense silksense-accounts`. Run `npm run check:local` to verify both live apps, account login, authenticated inference, Telugu layout and logout. This check does not create batch records. If an existing browser tab shows an older build, reload after the service worker installs the update.

## Run

Use Node 22.23 or later with support for experimental SQLite and TypeScript stripping.

```bash
npm ci
npm run build
npm start
```

Open http://127.0.0.1:8787. For a second local instance, choose another port with `PORT=8790 npm start`. The database defaults to `.data/silksense.sqlite`; `DATA_DIR` selects another directory. Browser records persist separately in IndexedDB.

For development, `npm run dev` serves the UI at http://127.0.0.1:5173 and proxies API requests to port 8787. Offline service-worker behavior should be demonstrated from the production build.

## Demonstrate the field cycle

1. Open the production app online and wait for its initial load. Reload once so the installed service worker controls the page.
2. Add an anonymous batch with farm, shed and tray codes and a known larvae-brushed count.
3. Disable networking using the browser's offline control. Record an assessment with instar, temperature, humidity, ventilation, bed hygiene, feed and reported observations. A photograph or short video is optional; media remains on this device.
4. Save and inspect the score, contributing factors, missing information and reference scope. An unusual-deaths report triggers high review priority through explicit prototype rules.
5. Open the batch. Record an intervention, a review/correction note and a harvest outcome. Unmeasured values should remain blank. Use matching shell and cocoon samples.
6. Reload while offline to demonstrate persistence. Reconnect, open Settings and select Sync now. Check the pending count and supervisor overview.
7. In Today, open Experimental feed-leaf check. Use a real mulberry image. For a reproducible pipeline demonstration, `artifacts/mulberry-heldout-parity.png` is a held-out source image; disclose its internal-dataset origin. The screen displays model scores, measured device inference time and actual occlusion influence.
8. Export structured records from Settings for inspection. Export does not include media. A second browser can synchronize records to the same local server, but cannot retrieve another device's photos.

## Evidence and tests

```bash
npm test
npm run test:e2e
```

Browser tests use the Chromium path in `playwright.config.ts`; set `CHROMIUM_PATH` to an installed Chromium executable on another machine. Build before browser tests so they exercise current code. The E2E server uses port 8788 and a fresh `.data/test-<process>-<timestamp>` directory for each run.

- [Research and source audit](docs/RESEARCH.md)
- [Structured source inventory](docs/SOURCES.csv)
- [Requirement coverage](docs/REQUIREMENTS.md)
- [Current status](docs/STATUS.md)
- [Testing record](docs/TESTING.md)
- [Model report](artifacts/mulberry-model-report.json)
- [Split manifest](artifacts/mulberry-split-manifest.json)

The source acquisition and training scripts are in `ml/`. Training requires NumPy, Pillow and scikit-learn. The existing `ml/.venv` contains the local research environment; observed baseline dependency versions are recorded in `ml/requirements-lock.txt`, with clean-environment reproduction still pending. The exported 20.9 KB model is already in `public/models/` and is cached with the app shell.

## Deployment boundary

This is a local demo. Navigation between field and supervisor screens is not authorization. `SYNC_TOKEN` optionally protects the shared sync API; it does not establish individual identities or farm-level permissions. Exposing the server beyond localhost now requires account mode and an HTTPS public origin; the shared demo token is insufficient. Account/farm controls are implemented; hosted HTTPS activation and an operator retention policy remain external setup requirements.

No departmental longitudinal corpus, approved Andhra Pradesh SOP, calibrated confidence, prospective warning lead time or yield improvement has been established. Telugu/English software support and account authorization are implemented. Reviewed Telugu field guidance, independently validated larval computer vision and public production activation remain unfinished. See the coverage matrix before using this as a deployment or competition-readiness claim.

## Deployed demonstration and explainable care

The local production deployment is managed by the user service `silksense.service`:

- Application: http://127.0.0.1:8787/
- Interactive fictional scenario: http://127.0.0.1:8787/?demo=1
- Backend health: http://127.0.0.1:8787/api/health
- Status / restart: `systemctl --user status silksense` / `systemctl --user restart silksense`
- Logs: `journalctl --user -u silksense`
- Stop: `systemctl --user stop silksense`

The service serves the production frontend and API at the same origin, with SQLite in `.data/deployed`. It starts with the user service manager. This is a localhost deployment; a public host has not been configured.

Every assessment now includes ranked care steps, the observations behind them, regional reference ranges, missing information and a hypothetical care comparison. The simulation recomputes the same checklist rules, retains symptoms and visual concerns, and never overwrites observations or fills missing measurements. It does not estimate treatment effect or yield improvement. General care context was checked against [CSB SILKS regional rearing guidance](https://silks.csb.gov.in/anjaw/wp-content/themes/Common_District/trs-frame.html); regional applicability still needs officer confirmation.

`POST /api/explain` accepts `{ "input": <RiskInput>, "adjustments": ["temperature", "humidity", "ventilation", "hygiene", "feed"] }` and returns the same explanation as the offline frontend. It follows the API's existing token protection when enabled.

`node scripts/demo-check.mjs` verifies the live deployment and captures `artifacts/deployed-care-demo.png`. The supplied mulberry model works offline. The trained MobileNetV3 larval model is installed; see the deep-learning deployment below.

Feed answers are explicitly self-reported. The care guide and explanation API also return a conservative feed-only scenario that assumes suspect feed, including after simulated improvements. This is a checklist sensitivity check, not a worst-case bound on real harm or a verification of farmer honesty. The installed leaf model is logistic regression on color/texture features in the browser, not backend deep learning. Checklist capture uses the device file picker. The deep-learning tray screen also supports a live camera stream.


## Real deep-learning backend (15 September 2026)

Open **http://127.0.0.1:8787/?deep=1**. Choose **Start camera**, grant camera permission, and choose **Take photo & analyze**, or upload a JPEG/PNG/WebP. The research-sample link supplies a labelled held-out test image. This screen sends the image to the backend; it does not silently fall back to browser inference. Images are processed in memory and not stored by this inference endpoint. The existing offline checklist capture continues to run the exported model in the browser.

Architecture: React → Express `/api/model/predict` → Python HTTP service → ONNX Runtime → complete MobileNetV3-Small convolutional network plus trained five-class head. ImageNet convolutional weights are frozen; the supervised head was fitted on 2,305 source-family representatives. This is transfer learning, not end-to-end fine-tuning. Selection (384), temperature calibration (385) and test (769) partitions are separate. The exported graph is 3,732,850 bytes. Test accuracy is 98.83% on the internal single-source split. No independent farm validation is claimed.

The 5,529 source images are attributed to Kajal Mungase and Shwetambari Chiwhane, [Silkworm_Diseases_Dataset, v1](https://data.mendeley.com/datasets/g4b89vpp9c/1), CC BY 4.0. The audit retained 3,843 representatives and quarantined conflicting duplicate groups. See `artifacts/larval-model-report.json`, `artifacts/larval-test-predictions.json`, and `artifacts/larval-training.log` for measured evidence. `Overlap` is a scene condition; it does not represent a disease.

Commands:

```bash
# Existing research environment; pinned observed dependencies:
cat ml/requirements-deep-lock.txt
# Reproduce training from the existing audited source manifest:
ml/.venv/bin/python ml/train_larval.py
# Run the model service manually (separate terminal from npm start):
ml/.venv/bin/python server/inference.py
# Inspect the deployed service:
systemctl --user status silksense-model silksense
journalctl --user -u silksense-model
```

The model service listens only on `127.0.0.1:8791`. Express proxies inference at the main application origin and applies its existing sync-token protection if configured. `/api/model/health` confirms the actual loaded model checksum and runtime. Health fails with 503 if the inference service is down. Oversized, invalid and unsupported uploads are rejected; concurrent inference gets a busy response.

Both user services are enabled. Example unit files are in `deployment/` and contain this machine's absolute paths; adjust them on another machine. Browser E2E tests require the model service running at the default port. Camera tests use Chromium's synthetic camera device and verify permission denial separately; physical webcam quality remains a user check.


## Connected workflow and model reuse

The [architecture overview](docs/ARCHITECTURE.md) describes the established open-source components and remaining evidence gaps. On the deep-learning screen, choose **Backend server** or **This device**. After inference, select **Use this result in a batch assessment**, choose/create a batch and fill actual measurements. Saving carries the image, runtime, model checksum and quality warnings into the existing care-guide, review, outcome and sync workflow. Low-quality images request retaking; the same neural network is checksum-verified on both runtimes. Offline mode requires one initial installation while connected.
