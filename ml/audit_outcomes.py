"""Audit a small real outcomes dataset without inventing units or supervised targets."""
import csv,hashlib,json,statistics
from pathlib import Path
root=Path(__file__).resolve().parent.parent
metadata=json.loads((root/'artifacts/figshare-outcomes-metadata.json').read_text())
checks=[]
for f in metadata['files']:
 raw=(root/'artifacts'/f['name']).read_bytes()
 checks.append({'file':f['name'],'bytes':len(raw),'md5_matches_publisher':hashlib.md5(raw).hexdigest()==f['computed_md5'],'sha256':hashlib.sha256(raw).hexdigest()})
rows=list(csv.DictReader((root/'artifacts/analysis.csv').open()))
differences=[abs(float(r['Shell Ratio'])-100*float(r['Shell Weight'])/float(r['Cocoon Weight'])) for r in rows]
report={'source':'https://doi.org/10.6084/m9.figshare.29214152','author':'Soniya Thapa','posted':'2025-06-02','license':'CC BY 4.0','files':checks,'observed_rows':len(rows),'observed_treatments':sorted({r['Treatment'] for r in rows}),'replications':sorted({r['Replication'] for r in rows}),'columns':list(rows[0]),'shell_ratio_recomputed_absolute_difference':{'max_percentage_points':max(differences),'mean_percentage_points':statistics.mean(differences)},'limitations':['CSV weight columns do not specify units or sample denominators. Do not map to single-cocoon grams without author clarification.','Source-reported shell ratio differs from ratio of tabulated shell/cocoon values; possible aggregation/sample differences are unverified.','Temperature workbook has five instar-level rows, not treatment-specific longitudinal observations.','No disease or future loss labels; no independent batches across time/farms.','Not suitable for training a calibrated environmental early-risk model.'],'decision':'Retain as a real research audit artifact; do not seed operational batch records or train an unsupported risk model.'}
(root/'artifacts/outcomes-audit.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
