"""Evaluate a frozen exported appearance model on independently supplied images.
Usage: ml/.venv/bin/python ml/evaluate_external.py manifest.json --output report.json
This never trains a model or treats source-folder labels as laboratory diagnoses.
"""
import argparse, hashlib, json
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps
import onnxruntime as ort
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, log_loss
ROOT=Path(__file__).resolve().parent.parent
REQUIRED=('path','label','farm_id','batch_id','capture_group')

def validate_manifest(data,base,training):
    if not data.get('source') or not data.get('license') or not data.get('label_method'):
        raise ValueError('Provide source, license and label_method; do not infer diagnostic labels.')
    if data['source']==training['source']:
        raise ValueError('This is the training source; use independent acquisition for external evaluation.')
    rows=data.get('images',[])
    if not rows: raise ValueError('No independent images supplied. Evaluation remains pending.')
    source_rows=training.get('all_images',training['records'])
    known_bytes={r['source_sha256'] for r in source_rows}
    known_pixels={r['pixel_sha256'] for r in source_rows}
    seen=set();valid=[]
    for row in rows:
        if any(not isinstance(row.get(k),str) or not row[k].strip() for k in REQUIRED):
            raise ValueError('Every image needs path, label, farm_id, batch_id and capture_group.')
        if row['label'] not in training['classes']: raise ValueError('Unsupported evaluation class: '+row['label'])
        path=(base/row['path']).resolve()
        if not path.is_relative_to(base.resolve()): raise ValueError('Image path must stay within manifest directory.')
        digest=hashlib.sha256(path.read_bytes()).hexdigest()
        with Image.open(path) as original: image=ImageOps.exif_transpose(original).convert('RGB')
        pixel_hash=hashlib.sha256(image.tobytes()+str(image.size).encode()).hexdigest()
        if digest in known_bytes or pixel_hash in known_pixels: raise ValueError('Training-source image overlap detected: '+row['path'])
        if pixel_hash in seen: raise ValueError('Duplicate image in external evaluation: '+row['path'])
        seen.add(pixel_hash);valid.append((row,image,digest))
    # Farm/batch provenance is supplied by the evaluator; this code cannot authenticate it.
    return valid

def predict(session,image):
    array=np.asarray(image);h,w=array.shape[:2]
    ys=np.minimum(((np.arange(224)+.5)*h/224).astype(int),h-1)
    xs=np.minimum(((np.arange(224)+.5)*w/224).astype(int),w-1)
    rgb=array[ys[:,None],xs[None,:]].astype(np.float32)/255
    x=((rgb-np.array([.485,.456,.406],dtype=np.float32))/np.array([.229,.224,.225],dtype=np.float32)).transpose(2,0,1)[None]
    logits=np.asarray(session.run(['logits'],{'image':np.ascontiguousarray(x)})[0]).reshape(-1)
    weights=np.exp(logits-logits.max());return weights/weights.sum()

def metrics(y,p,classes):
    pred=np.argmax(p,axis=1);confidence=np.max(p,axis=1);accepted=confidence>=.7
    ece=0.
    for lo in np.arange(0,1,.1):
        mask=(confidence>=lo)&(confidence<(lo+.1) if lo<.9 else confidence<=1)
        if mask.any(): ece+=mask.mean()*abs((pred[mask]==y[mask]).mean()-confidence[mask].mean())
    return {'images':len(y),'accuracy':float(accuracy_score(y,pred)),
        'macro_f1':float(f1_score(y,pred,labels=np.arange(len(classes)),average='macro',zero_division=0)),
        'class_support':np.bincount(y,minlength=len(classes)).tolist(),
        'confusion_matrix':confusion_matrix(y,pred,labels=np.arange(len(classes))).tolist(),
        'log_loss':float(log_loss(y,p,labels=np.arange(len(classes)))),
        'brier_multiclass':float(np.mean(np.sum((p-np.eye(len(classes))[y])**2,axis=1))),
        'expected_calibration_error_10_bins':float(ece),'score_threshold':.7,
        'score_coverage':float(accepted.mean()),'accepted_accuracy':float((pred[accepted]==y[accepted]).mean()) if accepted.any() else None}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('manifest',type=Path);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    data=json.loads(args.manifest.read_text());training=json.loads((ROOT/'artifacts/larval-split-manifest.json').read_text());meta=json.loads((ROOT/'public/models/larval-appearance.json').read_text())
    rows=validate_manifest(data,args.manifest.parent,training)
    model=ROOT/'public/models/larval-appearance.onnx'
    if hashlib.sha256(model.read_bytes()).hexdigest()!=meta['report']['onnx_sha256']: raise ValueError('Model checksum does not match metadata.')
    session=ort.InferenceSession(str(model),providers=['CPUExecutionProvider'])
    # Exported logits already include temperature scaling; apply softmax once.
    probs=np.stack([predict(session,image) for _,image,_ in rows])
    if not np.isfinite(probs).all() or (probs<0).any() or not np.allclose(probs.sum(axis=1),1,atol=1e-4): raise ValueError('Expected probability outputs from frozen model.')
    classes=training['classes'];y=np.array([classes.index(row['label']) for row,_,_ in rows]);farms=np.array([r['farm_id'] for r,_,_ in rows])
    report={'status':'external appearance evaluation; provenance supplied by evaluator','source':data['source'],'license':data['license'],'label_method':data['label_method'],'model_sha256':hashlib.sha256(model.read_bytes()).hexdigest(),'classes':classes,'overall':metrics(y,probs,classes),'per_farm':{f:metrics(y[farms==f],probs[farms==f],classes) for f in sorted(set(farms))},'farm_count':len(set(farms)),'predictions':[dict(row,sha256=digest,scores=p.tolist()) for (row,_,digest),p in zip(rows,probs)],'limitations':['Metadata provenance and diagnoses are not authenticated by this script.','Exact byte/pixel overlap checks do not catch every crop or near duplicate; acquisition-group review remains required.','Score-only abstention here excludes UI image-quality and multi-frame gates.','Image classification does not establish disease diagnosis, future warning lead time, or yield benefit.']}
    unique_farms=sorted(set(farms));interval=None
    if len(unique_farms)>1:
        rng=np.random.default_rng(20260916);correct=np.argmax(probs,axis=1)==y;estimates=[]
        for _ in range(1000):
            sampled=rng.choice(unique_farms,size=len(unique_farms),replace=True)
            estimates.append(np.concatenate([correct[farms==f] for f in sampled]).mean())
        interval=np.quantile(estimates,[.025,.975]).tolist()
    report['farm_cluster_bootstrap_accuracy_95_interval']=interval
    report['limitations'].append('Farm-cluster bootstrap intervals require multiple farms and remain unstable for small farm counts; missing-class support must be inspected.')
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,indent=2));print('Wrote external appearance evaluation:',args.output)
if __name__=='__main__':main()
