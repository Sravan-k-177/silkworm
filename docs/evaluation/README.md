# Independent evaluation input

Use `external-manifest.template.json` as the structure, not as data. Each image entry needs `path` relative to the manifest, `label` (Flacherie, Grasserie, Healthy, Overlap or Pebrine), `farm_id`, `batch_id` and `capture_group`. Obtain the actual data licence and label-method description. Keep source/farm identifiers anonymous.

Run `ml/.venv/bin/python ml/evaluate_external.py /path/to/manifest.json --output artifacts/external-evaluation.json`. It uses the frozen ONNX graph, checks exact training-source overlap and duplicate images, reports class confusion, per-farm metrics, calibration error and score-only abstention. It does not retrain or tune thresholds. The command rejects an empty manifest. No external-evaluation result is shipped because independent images have not been supplied.

Before publishing independent accuracy, review acquisition groups, near duplicates and label provenance. A new download of the existing training source is not independent validation. For early-warning and yield claims, use the separate prospective protocol: image labels cannot substitute for independently timed onset and complete outcome cohorts.

## Departmental access check — 16 September 2026

The IndiaAI announcement's redirect resolves to:
https://aikosh.indiaai.gov.in/home/datasets/details/silkworm_datasets_of_sericulture_department_government_of_andhra_pradesh.html

The official page currently states that the requested resource is unavailable. No archive, licence or longitudinal join has been verified from it. Access to a replacement listing or an authorized download is needed before acquisition, audit or training on this corpus. No authentication or access-control bypass was attempted.
