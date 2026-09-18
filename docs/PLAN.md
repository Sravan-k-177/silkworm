# Two-night delivery plan

Updated 16 September 2026. Improve the existing application using established open-source models and frameworks. Preserve the existing feature scope; prioritize a coherent, verifiable demonstration within two nights.

## Existing foundation

Reuse Torchvision ImageNet-pretrained MobileNetV3-Small with the trained appearance head, ONNX Runtime on backend and browser, React/Vite/TypeScript, Express, Dexie and SQLite. Camera/upload inference already connects to assessments, explainable care, conservative feed scenarios, follow-ups, reviews, outcomes and deferred synchronization. No new neural architecture is required.

## Night one: strengthen the connected workflow

- Verify camera/upload → inference → batch assessment → explanation → follow-up → supervisor → outcome/export.
- Preserve model identity, runtime, image-quality checks and uncertainty throughout the workflow.
- Check offline capture/inference, reload and deferred sync against the existing browser suite.
- Add supervisor date filtering alongside farm/risk filters. Implemented: inclusive UTC dates select batches by latest assessment; full selected-batch histories remain available.

## Night two: field usability and demonstrable evidence

- Prioritize local-language capture and care copy; obtain translation review before claiming field-ready multilingual support.
- Exercise the complete demonstration on physical Android devices and real shed photos; record latency, retake cases and offline behavior.
- Polish the demonstration and evidence report around traceable observations, human review and outcomes.
- Keep all remaining requirements tracked in REQUIREMENTS.md. Public deployment requires actual account/farm authorization and HTTPS; do not equate localhost navigation with roles.

## Model selection gate

Use the installed pretrained backbone as the baseline. Compare another established model only when measured failure cases justify it, with recorded licensing, training data provenance, size, device latency and independent evaluation. Never select models using the held-out test partition. Departmental data acquisition, reviewed translations and field validation depend on external access and cannot be promised within two nights.

Primary references checked: [Torchvision MobileNetV3 implementation](https://github.com/pytorch/vision/blob/main/torchvision/models/mobilenetv3.py), [ONNX Runtime Web deployment](https://onnxruntime.ai/docs/tutorials/web/deploy.html).

## Implemented in the Telugu/mobile iteration

Telugu software support, mobile workflows, account/farm authorization, external evaluation tooling, HTTPS configuration, backup/restore checks and the printable evidence report are implemented and tested. Physical-phone and real-shed tests are excluded by the user's latest scope. Independent datasets, public host/domain access, translation/SOP approval and retention decisions remain externally blocked; no deployment or scientific performance claim substitutes for those requirements.
