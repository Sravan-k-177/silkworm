# Deep-learning deployment evidence

As of 15 September 2026, `/api/model/predict` executes a complete MobileNetV3-Small network in a separate Python process using ONNX Runtime CPU. This is a frozen pretrained convolutional feature extractor with a supervised, trained five-class head. It is not a handcrafted-feature classifier, and it is not end-to-end fine-tuning. CPU execution is intentional: the installed PyTorch is CPU-only and the machine has limited disk space; measured inference is already a few milliseconds per image.

- Demo: http://127.0.0.1:8787/?deep=1
- Health: http://127.0.0.1:8787/api/model/health
- Training: `ml/train_larval.py`
- Inference: `server/inference.py`
- Graph: `public/models/larval-appearance.onnx`
- Exported model report: `artifacts/larval-model-report.json`
- Every held-out prediction: `artifacts/larval-test-predictions.json`
- Graph operator audit: `artifacts/larval-network-audit.json`
- Live execution evidence: `artifacts/deployed-inference-evidence.json`
- Recheck live app: `node scripts/deep-demo-check.mjs`

## Data provenance and scope

Mungase and Chiwhane's [Mendeley dataset v1](https://data.mendeley.com/datasets/g4b89vpp9c/1) has 5,529 source images, licensed CC BY 4.0. The existing local acquisition was available, so no user download was required to get the model running. The audit selected 3,843 image-family representatives. Partitions: 2,305 training / 384 selection / 385 calibration / 769 test. Internal test accuracy: 98.83%. Grouping uses image/filename heuristics; farm and specimen identities are unavailable, so field generalization and clinical accuracy remain unmeasured.

## AIKosh investigation

The live public portal search for `silkworm` returned two directly relevant Andhra Pradesh departmental datasets. The portal response is saved in `artifacts/aikosh-sericulture-list.json`:

1. [SILKWORM DATASETS OF SERICULTURE DEPARTMENT GOVERNMENT OF ANDHRA PRADESH](https://aikosh.indiaai.gov.in/home/datasets/details/silkworm_datasets_of_sericulture_department_government_of_andhra_pradesh.html), ID `cb983403-3956-4702-9e12-c1e06616941d`, 207,303,745 bytes.
2. Mulberry dataset, ID `63969126-2e03-44ae-a731-32271633184c`, slug `mulberry_datasets_of_sericulture_department_government_of_andhra_pradesh_1`, 13,277,055 bytes.

The descriptions advertise images/videos, environment/agronomic metadata and cocoon outcomes. The silkworm detail page displays Open visibility and License Control NA. These listings are verified; actual file contents and usable longitudinal joins are not yet verified. They have not been used in the deployed model. Download into `ml/data/aikosh/`, preserve licence and metadata, then audit labels, specimen/batch/time relationships, duplicates and split eligibility before adding any training data. An independent Andhra Pradesh evaluation is preferable before pooling it into training.

[AI4Bharat](https://ai4bharat.iitm.ac.in/) provides Indian-language resources. Its language/translation/speech datasets are relevant to a future farmer-language interface, not substitutes for labelled silkworm images. No AI4Bharat model or dataset is claimed in the deployed visual classifier.

## Verification

34 unit tests and 13 browser/API tests passed. Tests cover backend score parity against held-out Python probabilities, loaded model checksum, invalid uploads, frontend upload and execution evidence, live camera API capture using Chromium's synthetic camera device, camera-denial handling, offline browser inference and existing record synchronization. The physical camera has not been tested by the agent.

This deployment is on localhost. Both `silksense` and `silksense-model` run as enabled user services. Public hosting and individual farm authorization are separate from this local working model deployment.

The silkworm portal's **Download Dataset** action was tested: it redirects to `https://aikosh.indiaai.gov.in/account/login`, offering Email OTP / Jan Parichay / Meri Pehchaan. The user has been asked to download through their account. No login or access restriction was bypassed.

## Link correction after user-reported failure

The direct AIKosh detail URLs can show “The requested resource is unavailable”; the web retrieval reproduced that error. A fresh interactive-browser check successfully used https://aikosh.indiaai.gov.in/home/datasets/all → type `silkworm` in “Search for datasets” → wait for the two sericulture results → View Details. The silkworm page showed Download Dataset, and reloading worked in that browser session. This does not establish that the direct link works for every session. Use the directory navigation route instead of distributing the fragile detail link. Evidence: `artifacts/aikosh-via-search.png` and `artifacts/aikosh-verified-route.txt`.

The original Mendeley ZIP endpoint was independently rechecked with HTTP HEAD and returned 200, application/x-zip-compressed, 247,151,747 bytes:
https://prod-dcd-datasets-public-files-eu-west-1.s3.eu-west-1.amazonaws.com/c78383b0-3f8e-49a1-b28a-5a82fe05c476
This archive is already present at `ml/data/larval/source.zip`; downloading it again is unnecessary.
