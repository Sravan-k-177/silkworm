# Reused components and attribution

Observed installed versions for this release; `package-lock.json` is the dependency lock. This inventory describes upstream licences, not a licence grant for the application's original code or third-party datasets.

| Component | Installed version | Upstream licence | Use |
|---|---|---|---|
| React | 19.2.8 | MIT | UI |
| Vite | 6.4.3 | MIT | Build and offline shell |
| Dexie | 4.4.5 | Apache-2.0 | IndexedDB |
| Express | 5.2.1 | MIT | API |
| Zod | 3.25.76 | MIT | Record validation |
| ONNX Runtime Web | 1.22.0 | MIT | Offline neural inference |
| i18next | 26.4.2 | MIT | Translation catalogue |
| react-i18next | 17.0.14 | MIT | Reactive language selection |
| express-session | 1.19.0 | MIT | Server session lifecycle |
| express-rate-limit | 8.7.0 | MIT | Login throttling |
| Noto Sans Telugu | Bundled variable font | SIL OFL 1.1 | Offline Telugu rendering |
| Caddy | 2.11.4 validated locally | Apache-2.0 | HTTPS reverse-proxy configuration |

The Noto font's original licence is bundled at `public/fonts/OFL-NotoSansTelugu.txt`; source: https://github.com/google/fonts/tree/main/ofl/notosanstelugu. Font redistribution does not imply that the UI translations have been reviewed by the font project.

The model reuses Torchvision MobileNetV3-Small with ImageNet-pretrained weights; the backbone stays frozen and the supervised head is fitted on the audited source. Python dependencies are recorded in `ml/requirements-deep-lock.txt`. ONNX Runtime's model format does not grant rights to input datasets.

Larval image source: Kajal Mungase and Shwetambari Chiwhane, Silkworm_Diseases_Dataset v1, https://data.mendeley.com/datasets/g4b89vpp9c/1, CC BY 4.0. Preserve source/version/author attribution with redistributed research samples. The mulberry appearance source is attributed in README and its model report. New departmental or external datasets require their own verified access and licence records.
