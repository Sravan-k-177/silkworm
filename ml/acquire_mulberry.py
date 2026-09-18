"""Acquire publisher-listed CC0 mulberry originals individually; retain hashes + resized copies.
No fabricated samples. This is a feed-leaf task, not larval disease prediction.
"""
import concurrent.futures, hashlib, io, json, time, urllib.request, urllib.parse, zipfile
from pathlib import Path
from PIL import Image, ImageOps
ROOT=Path(__file__).resolve().parent
DATA=ROOT/'data'/'mulberry';DATA.mkdir(parents=True,exist_ok=True)
ART=ROOT.parent/'artifacts';ART.mkdir(exist_ok=True)
BASE='https://www.kaggle.com/api/v1/datasets/'
DATASET='nahiduzzaman13/mulberry-leaf-dataset'
def get(url):
 for attempt in range(2):
  try:
   with urllib.request.urlopen(url,timeout=90) as r:return r.read()
  except Exception:
   if attempt:raise
   time.sleep(2)
def list_files():
 cached=ART/'mulberry-source-files.json'
 if cached.exists():return json.loads(cached.read_text())['files']
 files=[];token=''
 while True:
  q=urllib.parse.urlencode({'pageSize':200,**({'pageToken':token} if token else {})})
  page=json.loads(get(BASE+'list/'+DATASET+'?'+q));files.extend(page['datasetFiles']);print('Listed',len(files),flush=True)
  token=page.get('nextPageToken','')
  if not page.get('hasNextPageToken') or not token:break
 cached.write_text(json.dumps({'dataset':DATASET,'source':'https://www.kaggle.com/datasets/'+DATASET+'/data','license':'CC0: Public Domain (dataset card and API)','files':files},indent=2))
 return files
def acquire(f):
 name=f['name'];folder=name.split('/')[-2]
 labels={'Disease Free leaves':'Healthy','Leaf Rust':'Leaf rust','Leaf spot':'Leaf spot'}
 # Folder names are audited and mapped explicitly; unknown labels are never inferred.
 if folder not in labels:raise ValueError('Unknown source folder: '+folder)
 label=labels[folder];key=hashlib.sha256(name.encode()).hexdigest()[:20]
 meta=DATA/(key+'.json');target=DATA/(key+'.png')
 if meta.exists() and target.exists():return json.loads(meta.read_text())
 payload=get(BASE+'download/'+DATASET+'/'+urllib.parse.quote(name,safe=''))
 if payload[:2]==b'PK':
  with zipfile.ZipFile(io.BytesIO(payload)) as z:
   entries=[x for x in z.infolist() if not x.is_dir()]
   if len(entries)!=1:raise ValueError('Expected one image in per-file archive')
   if entries[0].file_size>80_000_000:raise ValueError('Unexpected image size')
   raw=z.read(entries[0])
 else:raw=payload
 image=ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGB');w,h=image.size
 image=image.resize((224,224),Image.Resampling.LANCZOS);image.save(target)
 record={'id':key,'source_path':name,'label':label,'source_sha256':hashlib.sha256(raw).hexdigest(),'source_bytes':len(raw),'source_width':w,'source_height':h,'derived_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'path':str(target.relative_to(ROOT)),'transform':'EXIF transpose; RGB; stretch 224x224 Lanczos PNG; original bytes not retained due disk budget'}
 meta.write_text(json.dumps(record,indent=2));return record
if __name__=='__main__':
 files=[f for f in list_files() if f['name'].lower().endswith(('.jpg','.jpeg','.png'))]
 from collections import Counter
 print('Source folders:',dict(Counter(f['name'].split('/')[-2] for f in files)),flush=True)
 # Print provenance before downloads; run only after labels have been audited.
 import sys
 if '--list-only' in sys.argv:raise SystemExit(0)
 import random
 rng=random.Random(20260908)
 groups={}
 for f in files:groups.setdefault(f['name'].split('/')[-2],[]).append(f)
 for group in groups.values():rng.shuffle(group)
 files=[g[i] for i in range(max(map(len,groups.values()))) for g in groups.values() if i<len(g)]
 records=[];failures=[];started=time.monotonic()
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  jobs={pool.submit(acquire,f):f for f in files}
  for job in concurrent.futures.as_completed(jobs):
   try:records.append(job.result())
   except Exception as e:failures.append({'source_path':jobs[job]['name'],'error':str(e)});print('Failed',jobs[job]['name'],repr(e),flush=True)
   if (len(records)+len(failures))%5==0:print(f'{len(records)} acquired, {len(failures)} failures, {time.monotonic()-started:.0f}s',flush=True)
 result={'dataset':DATASET,'records':sorted(records,key=lambda r:r['source_path']),'failures':failures,'elapsed_seconds':time.monotonic()-started}
 (ART/'mulberry-acquisition.json').write_text(json.dumps(result,indent=2));print('DONE',len(records),'images',len(failures),'failures',flush=True)
