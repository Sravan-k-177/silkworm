"""Audit publisher archive and freeze source-family grouped partitions before modelling.
CC BY 4.0: Kajal Mungase and Shwetambari Chiwhane, DOI 10.17632/g4b89vpp9c.1.
"""
from pathlib import Path
import hashlib,io,json,re,zipfile
from collections import Counter,defaultdict
import numpy as np
from PIL import Image,ImageOps,ImageDraw
from scipy.fft import dctn
from sklearn.model_selection import StratifiedGroupKFold
from features import dhash
ROOT=Path(__file__).resolve().parent.parent;DATA=ROOT/'ml/data/larval';ART=ROOT/'artifacts'
LABELS={'flacherie':'Flacherie','grasserie':'Grasserie','healthy_silkworm':'Healthy','healthy silkworm':'Healthy','healthy':'Healthy','overlap':'Overlap','pebrine':'Pebrine'}
records=[];excluded=[]
with zipfile.ZipFile(DATA/'source.zip') as archive:
 for info in archive.infolist():
  if info.is_dir() or not info.filename.lower().endswith(('.jpg','.jpeg','.png','.webp')):continue
  parts=info.filename.split('/');labels={LABELS[p.lower()] for p in parts[:-1] if p.lower() in LABELS}
  if len(labels)!=1:raise ValueError('Unrecognized/ambiguous class path: '+info.filename)
  if info.file_size>40_000_000:raise ValueError('Oversized image: '+info.filename)
  raw=archive.read(info);key=hashlib.sha256(info.filename.encode()).hexdigest()[:24]
  try:
   im=ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGB');im.load()
   if min(im.size)<16:raise ValueError('Image too small')
   gray=np.asarray(im.convert('L').resize((32,32),Image.Resampling.LANCZOS),dtype=float)
   freq=dctn(gray,norm='ortho')[:8,:8].ravel();phash=sum(int(v)<<i for i,v in enumerate(freq>np.median(freq[1:])))
   # RF export IDs differ between augmented copies: preserve the common source stem.
   stem=re.split(r'\.rf\.',parts[-1],flags=re.I)[0].lower()
   stem=re.sub(r'([._-](jpg|jpeg|png))+$','',stem)
   out=DATA/'images'/(key+'.png');out.parent.mkdir(exist_ok=True)
   # Canonical nearest-centre 224x224 sampling reproduced exactly in browser code.
   pixels=np.asarray(im);h,w=pixels.shape[:2];ys=np.minimum(((np.arange(224)+.5)*h/224).astype(int),h-1);xs=np.minimum(((np.arange(224)+.5)*w/224).astype(int),w-1)
   Image.fromarray(pixels[ys[:,None],xs[None,:]]).save(out)
   records.append({'id':key,'source_path':info.filename,'label':next(iter(labels)),'source_sha256':hashlib.sha256(raw).hexdigest(),'pixel_sha256':hashlib.sha256(im.tobytes()+str(im.size).encode()).hexdigest(),'width':w,'height':h,'source_family':stem,'dhash':dhash(im),'phash':phash,'path':str(out.relative_to(ROOT))})
  except Exception as e:excluded.append({'source_path':info.filename,'reason':str(e)})
  if len(records)%500==0:print('Decoded',len(records),flush=True)
# Union exact copies, common export families and conservative perceptual neighbours.
parents=list(range(len(records)))
def root(i):
 while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
 return i
def union(i,j):
 a,b=root(i),root(j)
 if a!=b:parents[max(a,b)]=min(a,b)
for field in ['source_sha256','pixel_sha256','source_family']:
 seen={}
 for i,r in enumerate(records):
  if r[field] in seen:union(i,seen[r[field]])
  else:seen[r[field]]=i
for i,r in enumerate(records):
 for j in range(i):
  s=records[j]
  if (r['dhash']^s['dhash']).bit_count()<=4 or (r['phash']^s['phash']).bit_count()<=6:union(i,j)
 if i%1000==0:print('Duplicate audit',i,flush=True)
groups=defaultdict(list)
for i in range(len(records)):groups[root(i)].append(i)
conflicts={g for g,ix in groups.items() if len({records[i]['label'] for i in ix})>1}
# One representative per duplicate/source family prevents augmented copies dominating either fit or metrics.
selected=[];quarantine=[]
for g,ix in groups.items():
 if g in conflicts:
  quarantine.extend({**records[i],'reason':'Conflicting labels within duplicate/source-family group'} for i in ix);continue
 representative=min(ix,key=lambda i:records[i]['source_path'])
 for i in ix:records[i]['group']=records[g]['id'];records[i]['representative']=i==representative
 selected.append(representative)
kept=[records[i] for i in selected];classes=sorted({r['label'] for r in kept});y=np.array([classes.index(r['label']) for r in kept]);gs=np.array([r['group'] for r in kept]);X=np.zeros((len(kept),1))
counts=Counter(r['label'] for r in kept)
if len(classes)<2 or min(counts.values())<15:raise ValueError('Insufficient independent groups after audit: '+str(counts))
trainval,test=next(StratifiedGroupKFold(5,shuffle=True,random_state=20260910).split(X,y,gs))
tr,va=next(StratifiedGroupKFold(4,shuffle=True,random_state=20260911).split(X[trainval],y[trainval],gs[trainval]));train=trainval[tr];validation=trainval[va]
se,ca=next(StratifiedGroupKFold(2,shuffle=True,random_state=20260912).split(X[validation],y[validation],gs[validation]));selection=validation[se];calibration=validation[ca]
partitions={'train':train,'selection':selection,'calibration':calibration,'test':test}
for name,ix in partitions.items():
 if len(set(y[ix]))!=len(classes):raise ValueError('A partition is missing a class: '+name)
 for i in ix:kept[i]['split']=name
mapping={r['group']:r['split'] for r in kept}
for r in records:
 if 'group' in r:r['split']=mapping[r['group']]
manifest={'source':'https://data.mendeley.com/datasets/g4b89vpp9c/1','classes':classes,'records':kept,'all_images':records,'quarantine':quarantine,'decode_failures':excluded}
(ART/'larval-split-manifest.json').write_text(json.dumps(manifest,indent=2))
report={'source':manifest['source'],'archive_sha256':hashlib.sha256((DATA/'source.zip').read_bytes()).hexdigest(),'decoded_images':len(records),'source_class_counts':dict(Counter(r['label'] for r in records)),'independent_heuristic_groups':len(kept),'representative_class_counts':dict(counts),'conflicting_groups':len(conflicts),'quarantined_images':len(quarantine),'decode_failures':excluded,'partitions':{n:dict(Counter(kept[i]['label'] for i in ix)) for n,ix in partitions.items()},'grouping':'Union source filename before .rf., exact original bytes, exact decoded pixels, dHash distance <=4, or pHash distance <=6; one representative per group.','limitations':['Perceptual grouping is a heuristic; no farm, specimen or session IDs are supplied.','Source disease folder labels are not independently verified laboratory diagnoses.','Overlap is a scene condition, not a disease; model must withhold health interpretation.','No linked environmental readings, onset times, or outcomes; future mortality prediction cannot be trained from this corpus.']}
(ART/'larval-data-audit.json').write_text(json.dumps(report,indent=2))
# Class-balanced contact sheet from training only, for visual audit before model fitting.
canvas=Image.new('RGB',(5*150,len(classes)*170),'white');draw=ImageDraw.Draw(canvas)
for row,label in enumerate(classes):
 candidates=[r for r in kept if r['label']==label and r['split']=='train'][:5]
 for col,r in enumerate(candidates):
  im=Image.open(ROOT/r['path']);im.thumbnail((145,140));canvas.paste(im,(col*150,row*170+25));draw.text((col*150+3,row*170+3),label,fill='black')
canvas.save(ART/'larval-training-contact-sheet.jpg');print(json.dumps(report,indent=2),flush=True)
