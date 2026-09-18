"""Resume the public archive URL observed from the publisher's normal download link.
No credentials, generated images, or labels are introduced. Parts persist across interruptions.
"""
from pathlib import Path
import concurrent.futures,hashlib,json,urllib.request,time
ROOT=Path(__file__).resolve().parent.parent
DATA=ROOT/'ml/data/larval';DATA.mkdir(parents=True,exist_ok=True)
redirects=[json.loads(x) for x in (DATA/'redirects.jsonl').read_text().splitlines()]
url=next(x['next'] for x in redirects if 'file_downloaded' in x['url'])
with urllib.request.urlopen(urllib.request.Request(url,method='HEAD'),timeout=60) as r:
 size=int(r.headers['Content-Length']);etag=r.headers.get('ETag')
if not 0<size<1_000_000_000:raise ValueError('Unexpected archive size')
chunk=8*1024*1024
manifest={'source':'https://data.mendeley.com/datasets/g4b89vpp9c/1','doi':'10.17632/g4b89vpp9c.1','authors':['Kajal Mungase','Shwetambari Chiwhane'],'license':'CC BY 4.0','public_archive_url':url,'bytes':size,'etag':etag}
metadata=DATA/'transfer.json'
if metadata.exists() and json.loads(metadata.read_text())!=manifest:raise ValueError('Remote archive changed; do not mix download versions')
metadata.write_text(json.dumps(manifest,indent=2))
def part(i):
 start=i*chunk;end=min(size,start+chunk)-1;p=DATA/f'part-{i:04d}'
 if p.exists() and p.stat().st_size==end-start+1:return
 for attempt in range(4):
  try:
   headers={'Range':f'bytes={start}-{end}',**({'If-Match':etag} if etag else {})}
   with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=90) as r:
    if r.status!=206 or r.headers.get('Content-Range')!=f'bytes {start}-{end}/{size}':raise ValueError('Range response mismatch')
    with p.with_suffix('.partial').open('wb') as f:
     while data:=r.read(256*1024):f.write(data)
   if p.with_suffix('.partial').stat().st_size!=end-start+1:raise ValueError('Incomplete range')
   p.with_suffix('.partial').replace(p);print('Completed part',i,flush=True);return
  except Exception:
   if attempt==3:raise
   time.sleep(2*(attempt+1))
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(part,range((size+chunk-1)//chunk)))
sha=hashlib.sha256()
with (DATA/'source.zip.partial').open('wb') as out:
 for i in range((size+chunk-1)//chunk):
  with (DATA/f'part-{i:04d}').open('rb') as f:
   while data:=f.read(1024*1024):out.write(data);sha.update(data)
(DATA/'source.zip.partial').replace(DATA/'source.zip')
manifest.update({'sha256':sha.hexdigest(),'downloadedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'status':'complete'})
(ROOT/'artifacts/larval-download.json').write_text(json.dumps(manifest,indent=2))
# Parts are our own redundant intermediate files; the verified archive is retained.
for p in DATA.glob('part-*'):p.unlink()
print('Verified archive assembled',size,sha.hexdigest(),flush=True)
