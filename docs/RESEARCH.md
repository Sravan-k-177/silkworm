# Research

Current release synthesis: [printable report](../artifacts/silksense-evidence-report.pdf). The chronology below preserves earlier access findings; the source inventory now records the acquired Mendeley corpus and the unavailable AIKosh target. Earlier statements that models or archives were absent are historical.

Preliminary metadata audit, 2026-09-08. Counts and licenses below are publisher statements, not locally measured or legal conclusions. No archive was downloaded or inspected. No performance claim is adopted.

## Mulberry cultivar images

Primary record: https://data.mendeley.com/datasets/ds45yy9jrc/3

Source-backed facts: Version 3 reports 5,262 images across ten cultivars, collected in Thailand using DSLR and smartphone cameras; the record lists CC BY 4.0. It describes expert annotation and sunny-day acquisition without seasonal considerations.

Implication: Candidate for cultivar classification, not disease diagnosis. Deployment across regions and lighting needs independent evaluation. Preserve contributor attribution and version if used. Local archive checks and specimen/session metadata are still needed.

## Mulberry disease images

Author dataset listing: https://www.kaggle.com/datasets/nahiduzzaman13/mulberry-leaf-dataset/data

Related primary paper: https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2023.1175515/full

The dataset listing reports 1,091 images: 440 healthy, 489 leaf rust, and 162 leaf spot, expert annotated and captured in Bangladesh. It lists CC0 and links the paper. The paper page was reachable; a full methods audit was not performed.

Implication: Relevant candidate for disease classification. Download access, archive license, original/augmented image separation, acquisition groups and annotation evidence remain unverified. Neither these counts nor published metrics constitute this project's measurements.

## Silkworm disease images

Primary record discovered through search: https://data.mendeley.com/datasets/g4b89vpp9c/1

Search-returned publisher metadata reports version 1, 5,529 images, CC BY 4.0, and labels Flacherie, Grasserie, Healthy Silkworm, Overlap and Pebrine. Direct opening subsequently failed with a cache miss. Treat this as a candidate, not an approved training corpus.

Engineering concern: Overlap describes scene composition rather than a disease; label semantics need inspection before defining a diagnostic task. The train/test/split folder description does not demonstrate independent specimen groups.

## Contradictions and exclusions

The phrase “mulberry leaf dataset” refers to distinct cultivar and disease datasets; their tasks and labels are not interchangeable. A search result for a GitHub silkworm segmentation project describes only a sample and restricted full-data access: https://github.com/hokhoi02new/silkworm_disease_segmentation_using_deeplearning_and_computer_vision_technology . A repository code license must not be assumed to grant rights to unavailable images.

## Evidence gaps

No verified longitudinal environment/outcome data, operational SOP thresholds, or target-region clinical validation. No evidence-based environmental rules have been implemented. Future SOP logic must record issuing authority, species/instar, locale, units, effective date and supported action before use.

## Research expansion after full brief (8 September 2026)

The previous requirements blocker is resolved. Two bounded research lanes reviewed science/SOPs and original datasets/projects. This is a targeted, evolving review, not a claim to cover every sericulture paper.

### Consequential official evidence

| Source | Evidence and scope | Implementation consequence |
|---|---|---|
| [CSR&TI Berhampore Technology Descriptor](https://csrtiber.res.in/Technologies_descriptor.pdf), CSB, undated; printed pp55/58 | Regional Eastern/Northeastern India guidance: I27–28°C/85–90%RH; II26–28/85–90; III26–27/80; IV24–25/75; V23–24/70. Full PDF accessible. | Selected named regional reference; SOP deviations do not mean infection. Point weights and priority cutoffs remain engineering assumptions. |
| [CSR&TI Berhampore Chawki pamphlet](https://www.csrtiber.res.in/Brochure_pamphlets/Publications/91%20Pamphlet%20(Chawki%20Rearing_English).pdf), undated | II instar26–27°C differs from descriptor26–28. | Preserve contradiction; local approval needed, avoid fabricated precision. |
| [CSB SILKS: Rearing of Mulberry Silkworm](https://silks.csb.gov.in/pilibhit/rearing-of-mulberry-silkworm/), credited to CSR&TI Mysore, undated | Chawki27–28°C/80–90%RH; hygiene, nutritious leaf, cross ventilation and moulting care. | General preventive action wording; no chemical doses or diagnostic claims. |
| [Mysore rearing houses pamphlet](https://csrtimys.res.in/sites/default/files/phamplets/en-00-rh.pdf), undated | Indexed table differs: IV/V25–26°C/70–75%RH. Direct source retrieval404; indexed text only. | Not selected as authoritative local default; discrepancy remains material. |
| [CSB SSTL FAQ](https://csb.gov.in/about-us/faq/sstl-bengaluru), undated | Indexed late-age24±1°C/65%RH; direct access failed. | More evidence that breed/rearing purpose/locale matter. |
| [Nosema qPCR original study](https://doi.org/10.1016/j.mimet.2015.12.003), 2016 | Molecular detection studied in eggs/newly hatched larvae. | External appearance cannot substitute for pathogen confirmation. No smartphone sensitivity inferred. |
| [Thermotolerance experiment](https://pmc.ncbi.nlm.nih.gov/articles/PMC3281324/), 2011 |24 breeds, controlled exposure study; indexed methods, direct CAPTCHA. | Temperature effects depend on breed and exposure; no universal disease cutoff adopted. |
| [Das et al. experimental paper](https://doi.org/10.1007/s44372-025-00130-6), 20Feb2025 | Methods define ERR as harvested cocoons/larvae brushed×100, shell ratio as corresponding shell/cocoon weight×100. Fifth-instar experiment complicates denominator interpretation. | Store raw counts/masses and denominator scope. Do not adopt experimental nanoparticle treatments. |

### Original AI papers and existing products

| Work | What it actually establishes | Limits relevant to this demo |
|---|---|---|
| [Binson & Manju, Automated Disease Detection in Silkworms](https://journal2.upgris.ac.id/index.php/asset/article/download/965/387), ASSET2024 | Source reports1,242 images, HOG/KPCA/SVM,93.16% accuracy; black background, one day, Namakkal. Diseased worms selected from fifth day after infection. | The paper's experiment is not evidence of pre-symptomatic warning or diverse tray/shed performance. No archive located. |
| [Nahiduzzaman et al., mulberry classification](https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2023.1175515/full), 19Sep2023 |1,091 expert-labeled originals; train augmentation only; compact0.53M-parameter PDS-CNN, source-reported three-class95.05±2.86%. | Leaf disease task, not larval health. No farm-held-out validation. DenseNet binary prose/table disagree (accuracy vs AUC); do not quote the higher AUC as accuracy. |
| [Salam et al., smart Android application](https://doi.org/10.1109/ACCESS.2024.3407153), IEEE Access2024 | Original dataset card links this mobile application paper. | Full primary methods not retrieved; MobileNetV3/TFLite performance discovered elsewhere remains unverified. |
| [CNN–ViT with XAI](https://pmc.ncbi.nlm.nih.gov/articles/PMC12136458/), 2025 | Reuses the same1,091 images; source reports95.60% accuracy and Grad-CAM. | Reuse is not independent dataset corroboration. Reported author-machine latency is not browser latency. |
| [CNN-based silkworm early prediction](https://www.mdpi.com/2813-0324/12/1/14), 25Dec2025 | Indexed publisher abstract:492 images, frozen ResNet backbones. | Primary full page unavailable; original Kaggle corpus identity/rights unresolved. “Early” in title is not measured lead time. |
| [YOLOv8-DSRI dense segmentation](https://www.sciencedirect.com/science/article/abs/pii/S0031320325016802), Pattern Recognition2026 | Primary preview describes dense larval counting/segmentation. | Counting helps denominator collection; does not establish health classification. Dataset rights unresolved. |
| [silkworm-fpga-ml](https://github.com/yoctocandela/silkworm-fpga-ml), May2026 term project | MIT code, classical features/RF; source reports91.54% on520crops. FPGA implementation explicitly absent. | Preserving exporter splits does NOT by itself eliminate leakage; crop/source family audit needed. |
| [SilkLDP project](https://github.com/hokhoi02new/silkworm_disease_segmentation_using_deeplearning_and_computer_vision_technology), 2025 | MIT code, segmentation sample, full dataset described as proprietary/contact-only. | README4,063 images differs from paper-discovery4,029. Code license does not grant full dataset rights. |
| [Silkworm-disease-detection](https://github.com/manoj122001/Silkworm-disease-detection), date unverified | Flask/Keras/TFLite prototype files. | No verified provenance, license grant or evaluation; weights not adopted. |
| [ZHAGARAM – Smart Sericulture System](https://devpost.com/software/zhagaram-smart-sericulture-system), 20Oct2024 | Creator describes YOLOv8, IoT and React Native. | Pilot and multilingual support future work; no verified metrics or yield improvement. Indexed project evidence, direct retrieval failed. |

All paper/project metrics above are **source-reported**, not this project's measured results. Papers reusing one image collection do not provide independent field validation.

### Dataset access audit (measured locally)

- Kaggle anonymous API listing succeeded. Dataset `nahiduzzaman13/mulberry-leaf-dataset` reports CC0 and11,438,896,802bytes. Six paginated requests enumerated exactly1,091 files:440 Disease Free leaves,489 Leaf Rust,162 Leaf spot, matching the author card.
- One original per-file ZIP downloaded successfully (9,317,959bytes). Individual acquisition avoids storing an11GB archive on a machine with6.8GB initially available. The acquisition script hashes original image bytes and retains224×224PNG derivatives, source paths, dimensions and transformation details.
- Mendeley metadata/page/public-api access returned403 locally. No circumvention attempted. Browser indexed metadata remains a discovery record, not a verified archive.
- Other Kaggle silkworm candidates returned license Unknown. They are not accepted for training based solely on public visibility.
- Official [Kaggle CLI dataset documentation](https://github.com/Kaggle/kaggle-cli/blob/main/docs/datasets.md) documents pagination and per-file downloads.

### New departmental-data lead: AI Kosh

[IndiaAI's official announcement](https://www.linkedin.com/posts/indiaai_sericulture-opendata-aikosh-activity-7449837970519404544-cvI8) advertises an Andhra Pradesh silkworm dataset containing images, environment readings and rearing outcomes. This is evidence of an advertised release, **not verification of downloadable contents, longitudinal linkage, license, sample size or label quality**. It invalidates any blanket assertion that departmental data does not exist. The exact access route is under investigation. Local workspace still has no verified departmental corpus.

### Claim gaps / next actions

| Claim family | Current confidence | Missing evidence / next step |
|---|---|---|
| Regional environment reference | High for chosen document, applicability unverified | Obtain department/region/hybrid-approved SOP; retain source version. |
| Early health prediction | Unsupported in this demo | Audit AI Kosh; prospective batch/time split and independently confirmed outcomes. |
| Visual model usefulness | Pending local training | Acquire real images, group duplicates before splitting, compare baselines, test browser parity. |
| Real-world generalization | Unknown | Farm/breed/instar holdouts; low-light/occluded trays; no leakage between video frames. |
| Yield/ERR impact | Unmeasured | Prospective intervention/outcome study with explicit denominators and confounders. |

### Search record

First pass: silkworm disease datasets/licensing, mulberry original datasets, official CSB/CSR&TI guidance, original image-classification papers, GitHub and Devpost sericulture implementations. Follow-up: conflicting SOP tables, ERR/sample definitions, actual early-detection sampling, license/access limits, legitimate single-file APIs and AI Kosh departmental release. Stop each lane when further broad search is redundant; continue targeted gaps that can change architecture or validation.

### Tracking and recent-source update (9 September 2026)

Shi et al., [WormSORT](https://doi.org/10.1371/journal.pcbi.1014410), PLOS Computational Biology, 15 June 2026, provides a directly relevant video-method lead. The authors describe two sequences with approximately 50/100 individuals and 1,000/1,200 sampled frames, acquired at one Sichuan institute on one date. The detector uses 1,526 images; the methods describe a 70:30 training/validation division. They deliberately reduced leaf occlusion in a relatively low-density breeding setting. These conditions limit transfer to crowded farmer trays. The [OSF deposit](https://osf.io/fxz4a/) is linked by the paper but could not be retrieved in this pass. Tracking could support future activity features; this experiment does not establish pre-mortality health prediction. Source-reported sequence counts are not independent farm counts.

[CLH-DETR](https://www.mdpi.com/2079-9292/15/16/3583), Electronics 2026, is a new leaf-detection lead. Indexed publisher text points to PaddlePaddle dataset 265143 and corrected annotations at https://github.com/wke0234-netizen/Mulberry-Disease-Corrected-Annotations . Full methods retrieval failed; no metrics adopted.

The Mendeley [Silkworm_Diseases_Dataset](https://data.mendeley.com/datasets/g4b89vpp9c/1) record now explicitly identifies publication on 6 September 2026 and contributors Kajal Mungase and Shwetambari Chiwhane. Its recent availability merits another archive-access audit. Five folder categories include Overlap; that category still cannot be treated as a disease.

Local acquisition completed all 1,091 mulberry images after retrying the single missing download. Original byte hashes and transformed-image provenance are recorded in artifacts/mulberry-acquisition.json. Baseline training is now running; results will be reported separately from published performance claims.

### Project audit continuation: environmental monitoring and larval export

The original [Silkwormincubator/SilkWorm repository](https://github.com/Silkwormincubator/SilkWorm) describes Raspberry Pi temperature, humidity and luminosity capture with cloud storage. Its associated [F1000Research article](https://f1000research.com/articles/7-248) was discovered, but direct full-text access returned 403 in this pass. This is an environmental instrumentation comparator; the repository description is not evidence of trained multimodal disease prediction or measured early-warning lead time.

The [Roboflow Silkworm Diseases v1 publisher page](https://universe.roboflow.com/silkworm-annotation-y6ztu/silkworm-diseases-y0bro/dataset/1) is reachable and identifies a November 2024 version. The [FPGA project data README](https://github.com/yoctocandela/silkworm-fpga-ml/blob/main/data/README.md) points to this source and explicitly says images are not redistributed in GitHub. Its claim that preserving the original export split eliminates leakage is too strong: augmentation families, shared specimens and capture sessions still require audit. The authors also document a prior reversed class-label bug. Reuse therefore requires explicit class-map parity, not assumptions based on folder order.

Devpost searches continue to identify [ZHAGARAM](https://devpost.com/software/zhagaram-smart-sericulture-system) and its [TiE U 2024 gallery entry](https://hackathon24.devpost.com/project-gallery?page=3). The creator lists predictive warnings, multilingual support and farmer pilot testing as future work. Those are proposed features, not demonstrated field outcomes. No additional verified Devpost implementation emerged from this pass; this is not evidence that none exist.

On 9 September, the Mendeley larval metadata endpoint again returned HTTP403. The readable publisher landing page establishes the listing and license statement but does not verify the image archive, class balance or acquisition independence.

### Government early-warning precedent and non-image modalities

The [Muga Disease Early Warning System](https://apps.nesdr.gov.in/MDEWS/index.php), NESAC and CMER&TI (site copyright 2020), is a consequential existing government decision-support project. It uses fifteen-day averages of maximum temperature and maximum humidity and reports models five and ten days before harvest, with R² values 0.776 and 0.623 respectively. These are source-reported regression statistics, not disease-classification accuracy. The page describes a restricted-user mobile application for collection and model validation; an independent prospective evaluation and downloadable training data were not established here. The species is Antheraea assamensis, reared outdoors. Transfer to indoor Bombyx mori batches, smartphone images and local SOP thresholds is unvalidated. This precedent supports investigating environmental time histories rather than asserting that one snapshot can predict future losses. It also requires novelty claims to acknowledge existing departmental early-warning work.

Two 2026 primary publisher leads broaden the sensor landscape: [E-Nose-Based VOC Analysis for Rapid Detection of Grasserie Disease in Silkworms](https://www.sciencedirect.com/science/article/pii/S2590123026033839) and [Rapid detection of Bombyx mori Nucleopolyhedrovirus using Fourier transform infrared spectroscopy and chemometric modelling](https://www.sciencedirect.com/science/article/pii/S1386142526001708). Indexed abstracts mention machine learning and infrared analysis of blood respectively. Direct pages returned 403; full methods, sampling independence and lead-time definitions remain unverified. Neither modality can be represented as smartphone RGB capability. No performance claims from these leads are adopted.

Product consequence: outcome comparisons now exclude assessments captured at or after outcome entry and choose outcomes by their recorded timestamps rather than import order. The UI names the time interval as hours before outcome entry. Harvest date and first confirmed adverse-event onset are still needed before this can measure early-warning lead time.

### Roboflow version-level count reconciliation

The [original Silkworm Diseases v1 version page](https://universe.roboflow.com/silkworm-annotation-y6ztu/silkworm-diseases-y0bro/dataset/1) lists 4,986 images in the project navigation and 8,975 images in the generated version: 7,978 train, 499 validation and 498 test. It specifies 640×640 stretching, orientation normalization and two outputs per training example with exposure augmentation between −22% and +22%. These are different counting units, not necessarily contradictory records. The FPGA project's 9,207 total crops are another unit: annotated bounding-box crops. Do not report any of these as independent silkworm specimens. A usable acquisition manifest must link augmentation outputs and crops back to original source-image families before splitting. Publisher license is displayed as CC BY 4.0; the full export still needs a local content audit.

### Silk Shield project paper audit

Salamath et al., [Silk Shield: AI-powered Sericulture Disease Detection and Climate-based Cocoon Optimization](https://iarjset.com/wp-content/uploads/2025/05/IARJSET.2025.125345.pdf), May 2025, describes EfficientNetB3 classification, climate suggestions and a Streamlit interface. The five-page paper does not supply an auditable image count, numerical evaluation table, independent test partition or downloadable corpus. It mentions cross-validation and evaluation metrics without reporting reproducible numerical results. Environmental input is described inconsistently: the framing emphasizes a single image, while the design permits user/sensor readings and future work proposes sensor integration. Regional-language, offline and explainability capabilities also appear in future enhancements. Treat this as a project/architecture comparator, not verified diagnostic performance or a usable training-data release. Its reference list requires independent bibliographic verification before citing those works as evidence.
