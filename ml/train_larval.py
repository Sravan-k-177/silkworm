"""Train real larval appearance classifiers with a frozen MobileNetV3 backbone.
Selection/calibration/test partitions are frozen by audit_larval.py. No invented
weather or future-loss targets. Source labels remain observational dataset labels.
"""
from pathlib import Path
import hashlib,json,time,copy
import numpy as np
from PIL import Image
from scipy.optimize import minimize_scalar
from scipy.special import softmax
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score,balanced_accuracy_score,f1_score,confusion_matrix,classification_report,log_loss
import torch
from torchvision.models import mobilenet_v3_small,MobileNet_V3_Small_Weights
from features import features
ROOT=Path(__file__).resolve().parent.parent;ART=ROOT/'artifacts';DATA=ROOT/'ml/data/larval';PUBLIC=ROOT/'public/models'
torch.set_num_threads(4);torch.manual_seed(20260910);np.random.seed(20260910)
manifest=json.loads((ART/'larval-split-manifest.json').read_text());records=manifest['records'];classes=manifest['classes'];n=len(records);k=len(classes)
y=np.array([classes.index(r['label']) for r in records]);splits={name:np.array([i for i,r in enumerate(records) if r['split']==name]) for name in ['train','selection','calibration','test']}
backbone=mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.IMAGENET1K_V1).eval();backbone.classifier=torch.nn.Identity()
for p in backbone.parameters():p.requires_grad_(False)
mean=np.array([.485,.456,.406],dtype=np.float32);std=np.array([.229,.224,.225],dtype=np.float32)
def tensor_image(path):
 pixels=np.asarray(Image.open(path).convert('RGB'),dtype=np.float32)/255
 return torch.from_numpy(np.ascontiguousarray(((pixels-mean)/std).transpose(2,0,1)))
cache=DATA/'features.npz';signature=hashlib.sha256((ART/'larval-split-manifest.json').read_bytes()).hexdigest()
if cache.exists() and (DATA/'features-signature.txt').read_text()==signature:
 values=np.load(cache);deep=values['deep'];classic=values['classic']
else:
 deep=[];classic=[];start=time.perf_counter()
 with torch.inference_mode():
  for offset in range(0,n,32):
   batch=records[offset:offset+32];inputs=torch.stack([tensor_image(ROOT/r['path']) for r in batch]);deep.extend(backbone(inputs).numpy())
   classic.extend(features(Image.open(ROOT/r['path'])) for r in batch)
   if offset%320==0:print('Features',min(offset+32,n),'/',n,round(time.perf_counter()-start,1),'seconds',flush=True)
 deep=np.array(deep);classic=np.array(classic);np.savez_compressed(cache,deep=deep,classic=classic);(DATA/'features-signature.txt').write_text(signature)
def metrics(probs,indices):
 pred=probs.argmax(1);truth=y[indices]
 bins=[];confidence=probs.max(1)
 for lo in np.arange(0,1,.1):
  mask=(confidence>=lo)&(confidence<(lo+.1) if lo<.9 else confidence<=1)
  if mask.any():bins.append({'count':int(mask.sum()),'mean_score':float(confidence[mask].mean()),'accuracy':float((pred[mask]==truth[mask]).mean())})
 return {'n':len(indices),'accuracy':float(accuracy_score(truth,pred)),'balanced_accuracy':float(balanced_accuracy_score(truth,pred)),'macro_f1':float(f1_score(truth,pred,average='macro',zero_division=0)),'negative_log_likelihood':float(log_loss(truth,probs,labels=range(k))),'brier':float(np.mean(np.sum((probs-np.eye(k)[truth])**2,axis=1))),'ece_10_bins':sum(b['count']*abs(b['mean_score']-b['accuracy']) for b in bins)/len(indices),'reliability_bins':bins,'confusion_matrix':confusion_matrix(truth,pred,labels=range(k)).tolist(),'per_class':classification_report(truth,pred,labels=range(k),target_names=classes,output_dict=True,zero_division=0)}
models={};results={};train=splits['train'];selection=splits['selection'];cal=splits['calibration'];test=splits['test']
for kind,X in [('color_texture',classic),('mobilenet_v3',deep)]:
 for C in [.01,.1,1.0]:
  name=f'{kind}_C{C}';m=make_pipeline(StandardScaler(),LogisticRegression(C=C,max_iter=3000,class_weight='balanced',random_state=20260910))
  start=time.perf_counter();m.fit(X[train],y[train]);models[name]=(m,X,kind)
  results[name]={'fit_seconds':time.perf_counter()-start,'selection':metrics(m.predict_proba(X[selection]),selection)}
  print(name,'selection macro-F1',results[name]['selection']['macro_f1'],flush=True)
selected=max((name for name in results if name.startswith('mobilenet_v3_')),key=lambda name:results[name]['selection']['macro_f1']);model,X,kind=models[selected]
# Temperature is fitted only on the calibration set, not model-selection or test data.
cal_logits=model.decision_function(X[cal]);temperature=float(minimize_scalar(lambda t:log_loss(y[cal],softmax(cal_logits/t,axis=1),labels=range(k)),bounds=(.25,4),method='bounded').x)
test_logits=model.decision_function(X[test]);probs=softmax(test_logits/temperature,axis=1)
results[selected]['calibration']=metrics(softmax(cal_logits/temperature,axis=1),cal)
results[selected]['test']=metrics(probs,test)
majority=np.bincount(y[train],minlength=k).argmax();majority_probs=np.eye(k)[np.repeat(majority,len(test))]
results['majority']={'test':metrics(majority_probs,test)}
# Report sampling uncertainty on the deduplicated internal test images only.
rng=np.random.default_rng(20260910);correct=(probs.argmax(1)==y[test]);bootstrap=np.array([rng.choice(correct,len(correct),replace=True).mean() for _ in range(2000)])
ci=np.quantile(bootstrap,[.025,.975]).tolist()
# Fixed engineering abstention policy. No test-set threshold selection.
threshold=.70;accepted=(probs.max(1)>=threshold)&(probs.argmax(1)!=classes.index('Overlap'))
selective={'score_threshold':threshold,'coverage':float(accepted.mean()),'accepted':int(accepted.sum()),'accuracy':float(correct[accepted].mean()) if accepted.any() else None,'interpretation':'Internal selective classification only; threshold is not a validated field-safety cutoff.'}
scaler,clf=model.steps[0][1],model.steps[1][1]
report={'task':'Silkworm image appearance classification; not diagnosis or future mortality prediction','version':'larval-appearance-v1','source':manifest['source'],'license':'CC BY 4.0','authors':['Kajal Mungase','Shwetambari Chiwhane'],'classes':classes,'selected':selected,'model_family':kind,'acquired_images':len(manifest['all_images']),'representative_images':n,'partition_sizes':{s:len(v) for s,v in splits.items()},'selection':'Highest macro-F1 among MobileNetV3 deep models on selection partition only; color/texture candidates retained as comparators; temperature fitted on separate calibration partition; held-out test evaluated once after selection.','temperature':temperature,'test_accuracy_bootstrap_95_interval':ci,'selective_test':selective,'results':results,'preprocessing':'EXIF transpose; RGB; 224x224 nearest-centre full-image sampling; RGB /255 then ImageNet mean/std for MobileNet. Deliberately no crop to retain tray context.','backbone':'torchvision MobileNet_V3_Small_Weights.IMAGENET1K_V1; frozen, new supervised multinomial logistic head' if kind=='mobilenet_v3' else '153 deterministic color/texture features with supervised multinomial logistic head','limitations':['Dataset folder labels are not independently confirmed diagnoses.','No linked onset, environmental or mortality data: no early-warning lead time or yield benefit established.','One source, heuristic duplicate groups; hidden shared specimens/capture sessions and background confounding remain possible.','Overlap is not a disease; its output is withheld from health interpretation.','Temperature calibration is internal to this source; not validated field confidence.','Unsupported objects may still receive high scores. No universal out-of-distribution detector.','Random image-group holdout is not an independent farm or regional validation.']}
PUBLIC.mkdir(exist_ok=True)
export={'version':report['version'],'task':'silkworm-appearance-only','classes':classes,'kind':kind,'temperature':temperature,'abstainThreshold':threshold,'report':report}
if kind=='mobilenet_v3':
 class Classifier(torch.nn.Module):
  def __init__(self):
   super().__init__();self.backbone=backbone
   self.head=torch.nn.Linear(deep.shape[1],k)
   with torch.no_grad():
    self.head.weight.copy_(torch.tensor(clf.coef_/scaler.scale_[None,:],dtype=torch.float32));self.head.bias.copy_(torch.tensor(clf.intercept_-(clf.coef_*scaler.mean_[None,:]/scaler.scale_[None,:]).sum(axis=1),dtype=torch.float32))
  def forward(self,image):return self.head(self.backbone(image))/temperature
 net=Classifier().eval();example=tensor_image(ROOT/records[int(test[0])]['path'])[None]
 # Portable ONNX with fixed batch=1 for low-memory browser execution.
 torch.onnx.export(net,example,str(PUBLIC/'larval-appearance.onnx'),input_names=['image'],output_names=['logits'],opset_version=17,dynamo=False)
 import onnxruntime as ort
 session=ort.InferenceSession(str(PUBLIC/'larval-appearance.onnx'),providers=['CPUExecutionProvider']);runtime=session.run(None,{'image':example.numpy()})[0]
 np.testing.assert_allclose(runtime,test_logits[:1]/temperature,rtol=1e-4,atol=1e-4)
 export['onnxPath']='/models/larval-appearance.onnx';report['onnx_bytes']=(PUBLIC/'larval-appearance.onnx').stat().st_size;report['onnx_sha256']=hashlib.sha256((PUBLIC/'larval-appearance.onnx').read_bytes()).hexdigest();report['python_onnx_max_logit_error']=float(np.max(np.abs(runtime-test_logits[:1]/temperature)))
 torch.save(net.state_dict(),DATA/'trained-state.pt')
else:
 export.update({'type':'logistic','featureVersion':'rgb-texture-153-v1','mean':scaler.mean_.tolist(),'scale':scaler.scale_.tolist(),'weights':clf.coef_.tolist(),'bias':clf.intercept_.tolist()})
fixture=records[int(test[0])];Image.open(ROOT/fixture['path']).save(ART/'larval-heldout-parity.png')
(ART/'larval-parity.json').write_text(json.dumps({'source_id':fixture['id'],'split':'test','classes':classes,'probabilities':probs[0].tolist(),'label':fixture['label']},indent=2))
(PUBLIC/'larval-appearance.json').write_text(json.dumps(export,separators=(',',':')))
(ART/'larval-model-report.json').write_text(json.dumps(report,indent=2))
# Every test prediction retained, including errors and abstentions.
(ART/'larval-test-predictions.json').write_text(json.dumps([{'id':records[int(i)]['id'],'label':records[int(i)]['label'],'predicted':classes[int(p.argmax())],'scores':p.tolist(),'accepted':bool(ok)} for i,p,ok in zip(test,probs,accepted)],indent=2))
print('SELECTED',selected,'TEST',report['results'][selected]['test']['accuracy'],'CI',ci,'coverage',selective['coverage'],flush=True)
