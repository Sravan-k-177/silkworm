"""Real mulberry leaf baseline experiment. No larval/early-risk inference claims.
Reads locally acquired source metadata. Exact + conservative dHash clusters grouped
before deterministic train/validation/test splits. No augmentation. Test evaluated
only after model selection by validation macro-F1.
"""
from pathlib import Path
import argparse,hashlib,json,time
from collections import Counter
import numpy as np
from PIL import Image
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.dummy import DummyClassifier
from sklearn.metrics import accuracy_score,balanced_accuracy_score,f1_score,confusion_matrix,classification_report
from features import features,dhash,VERSION
ROOT=Path(__file__).resolve().parent;ART=ROOT.parent/'artifacts';PUBLIC=ROOT.parent/'public'/'models'
parser=argparse.ArgumentParser();parser.add_argument('--minimum-per-class',type=int,default=40);parser.add_argument('--allow-partial',action='store_true');args=parser.parse_args()
records=sorted([json.loads(p.read_text()) for p in (ROOT/'data'/'mulberry').glob('*.json')],key=lambda r:r['source_path'])
counts=Counter(r['label'] for r in records)
if len(counts)!=3 or min(counts.values())<args.minimum_per_class:raise SystemExit('Insufficient samples: '+str(counts))
if len(records)!=1091 and not args.allow_partial:raise SystemExit('Acquisition incomplete. Use --allow-partial only for explicitly labeled pilot experiments.')
classes=sorted(counts);X=[];y=[];hashes=[];parents=list(range(len(records)))
def root(i):
 while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
 return i
def union(i,j):parents[root(j)]=root(i)
for i,r in enumerate(records):
 img=Image.open(ROOT/r['path']);X.append(features(img));y.append(classes.index(r['label']));hashes.append(dhash(img))
for i in range(len(records)):
 for j in range(i):
  if records[i]['source_sha256']==records[j]['source_sha256'] or (hashes[i]^hashes[j]).bit_count()<=4:union(i,j)
X=np.array(X);y=np.array(y);groups=np.array([root(i) for i in range(len(records))]);conflicting=[]
for g in set(groups):
 inds=np.flatnonzero(groups==g)
 if len(set(y[inds]))>1:conflicting.extend(inds.tolist())
# Quarantine groups with contradictory labels, rather than leak or relabel them.
keep=np.array([i for i in range(len(records)) if i not in conflicting]);X=X[keep];y=y[keep];groups=groups[keep];kept=[records[i] for i in keep]
outer=StratifiedGroupKFold(n_splits=5,shuffle=True,random_state=20260908)
trainval,test=next(outer.split(X,y,groups));inner=StratifiedGroupKFold(n_splits=4,shuffle=True,random_state=20260909)
tr,va=next(inner.split(X[trainval],y[trainval],groups[trainval]));train=trainval[tr];val=trainval[va]
assert not(set(groups[train])&set(groups[val]) or set(groups[train])&set(groups[test]) or set(groups[val])&set(groups[test]))
for subset in [train,val,test]:
 if len(set(y[subset]))!=3:raise SystemExit('Split missing class; acquire more independent groups.')
manifest=[]
for split,indices in [('train',train),('validation',val),('test',test)]:
 for i in indices:manifest.append({**kept[i],'group':int(groups[i]),'split':split,'dhash':f'{hashes[keep[i]]:016x}'})
(ART/'mulberry-split-manifest.json').write_text(json.dumps(manifest,indent=2))
def metrics(model,indices):
 pred=model.predict(X[indices]);return {'accuracy':float(accuracy_score(y[indices],pred)),'balanced_accuracy':float(balanced_accuracy_score(y[indices],pred)),'macro_f1':float(f1_score(y[indices],pred,average='macro')),'confusion_matrix':confusion_matrix(y[indices],pred,labels=range(3)).tolist(),'per_class':classification_report(y[indices],pred,target_names=classes,output_dict=True,zero_division=0)}
models={'majority':DummyClassifier(strategy='most_frequent'),'color_texture_logistic':make_pipeline(StandardScaler(),LogisticRegression(C=1,max_iter=2000,class_weight='balanced')),'color_texture_forest':RandomForestClassifier(n_estimators=80,max_depth=10,min_samples_leaf=3,max_features='sqrt',class_weight='balanced',random_state=20260908,n_jobs=2)}
results={}
for name,model in models.items():
 started=time.perf_counter();model.fit(X[train],y[train]);results[name]={'fit_seconds':time.perf_counter()-started,'validation':metrics(model,val)};print(name,results[name],flush=True)
selected=max([n for n in models if n!='majority'],key=lambda n:results[n]['validation']['macro_f1']);model=models[selected]
# Holdout results do not alter selection or hyperparameters.
for name in [selected,'majority']:results[name]['test']=metrics(models[name],test)
report={'task':'Mulberry leaf appearance classification; auxiliary feed review only','dataset':'nahiduzzaman13/mulberry-leaf-dataset','license':'CC0 per original publisher card/API','partial_corpus':len(records)!=1091,'acquired_images':len(records),'class_counts':dict(counts),'quarantined_conflicting_images':len(conflicting),'unique_duplicate_groups':len(set(groups)),'near_duplicate_rule':'dHash Hamming distance <=4 OR exact original SHA256; engineering heuristic, not exhaustive semantic deduplication','split_counts':{n:{classes[c]:int(sum(y[idx]==c)) for c in range(3)} for n,idx in [('train',train),('validation',val),('test',test)]},'selected':selected,'selection':'Highest validation macro-F1; no test-based tuning; seed20260908/20260909','features':VERSION,'results':results,'limitations':['Single-source Bangladesh DSLR leaf collection; no farm/specimen/session identifiers available.','Exact and perceptual duplicates grouped, but unknown shared plants/acquisition sessions cannot be ruled out.','No held-out farm, pathogen confirmation, field smartphone validation, calibration or early-warning lead time.','Model always assigns a known class; unsupported inputs must not be interpreted as diagnosis.','No relationship to larval health or future cocoon yield was trained.']}
PUBLIC.mkdir(parents=True,exist_ok=True)
export={'version':'mulberry-baseline-v1','task':'mulberry-leaf-only','classes':classes,'featureVersion':VERSION,'selected':selected,'report':report}
if selected=='color_texture_logistic':
 scaler,clf=model.steps[0][1],model.steps[1][1];export.update({'type':'logistic','mean':scaler.mean_.tolist(),'scale':scaler.scale_.tolist(),'weights':clf.coef_.tolist(),'bias':clf.intercept_.tolist()})
else:
 trees=[]
 for estimator in model.estimators_:
  t=estimator.tree_;values=t.value[:,0,:];values=values/values.sum(axis=1,keepdims=True)
  trees.append({'left':t.children_left.tolist(),'right':t.children_right.tolist(),'feature':t.feature.tolist(),'threshold':t.threshold.tolist(),'value':values.tolist()})
 export.update({'type':'forest','trees':trees})
path=PUBLIC/'mulberry-baseline.json';path.write_text(json.dumps(export,separators=(',',':')))
report['artifact_bytes']=path.stat().st_size;report['artifact_sha256']=hashlib.sha256(path.read_bytes()).hexdigest()
(ART/'mulberry-model-report.json').write_text(json.dumps(report,indent=2))
# A real held-out image and fitted probabilities provide a browser parity fixture.
fixture=int(test[0]);(ART/'model-parity.json').write_text(json.dumps({'source_id':kept[fixture]['id'],'features':X[fixture].tolist(),'probabilities':model.predict_proba(X[fixture:fixture+1])[0].tolist(),'classes':classes},indent=2))
Image.open(ROOT/kept[fixture]['path']).save(ART/'mulberry-heldout-parity.png')
print('SELECTED',selected,'TEST',results[selected]['test']['accuracy'],'BYTES',path.stat().st_size,flush=True)
