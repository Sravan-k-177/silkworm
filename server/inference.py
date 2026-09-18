"""Local CPU deep-learning service. Uploaded images are processed in memory only."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import hashlib,io,json,time,threading,os
from leaf_inference import infer_leaf, MODEL_HASH as LEAF_MODEL_HASH
import numpy as np
from PIL import Image,ImageOps,UnidentifiedImageError
import onnxruntime as ort
ROOT=Path(__file__).resolve().parent.parent
MODEL=ROOT/'public/models/larval-appearance.onnx'
metadata=json.loads((ROOT/'public/models/larval-appearance.json').read_text())
if metadata['kind']!='mobilenet_v3':raise RuntimeError('A MobileNetV3 neural network is required')
options=ort.SessionOptions();options.intra_op_num_threads=2;options.inter_op_num_threads=1
session=ort.InferenceSession(str(MODEL),sess_options=options,providers=['CPUExecutionProvider'])
model_hash=hashlib.sha256(MODEL.read_bytes()).hexdigest()
if model_hash!=metadata['report']['onnx_sha256']:raise RuntimeError('Model checksum mismatch')
lock=threading.BoundedSemaphore(1)
Image.MAX_IMAGE_PIXELS=20_000_000

def predict(pixels):
 x=(pixels.astype(np.float32)/255-np.array([.485,.456,.406],np.float32))/np.array([.229,.224,.225],np.float32)
 logits=session.run(['logits'],{'image':np.ascontiguousarray(x.transpose(2,0,1)[None])})[0][0]
 values=np.exp(logits-logits.max());return values/values.sum()

def infer(raw):
 with Image.open(io.BytesIO(raw)) as original:
  if original.width*original.height>20_000_000:raise ValueError('Image exceeds 20 megapixels')
  original=ImageOps.exif_transpose(original).convert('RGB');original.load()
  if min(original.size)<32:raise ValueError('Image is too small; use a clear close photo')
  pixels=np.asarray(original);h,w=pixels.shape[:2]
  ys=np.minimum(((np.arange(224)+.5)*h/224).astype(int),h-1);xs=np.minimum(((np.arange(224)+.5)*w/224).astype(int),w-1)
  pixels=pixels[ys[:,None],xs[None,:]].copy()
 warnings=[]
 gray=pixels.astype(np.float32).mean(axis=2)
 if float(gray.mean())<35:warnings.append('Photo is too dark. Retake in even light.')
 if float(gray.mean())>235:warnings.append('Photo is overexposed. Retake without glare.')
 if float(gray.std())<8:warnings.append('Too little image detail. Retake a clear close view.')
 if min(w,h)<224:warnings.append('Photo resolution is low. Retake a higher-resolution image.')
 start=time.perf_counter();scores=predict(pixels);inference_ms=(time.perf_counter()-start)*1000
 winner=int(scores.argmax());label=metadata['classes'][winner]
 start=time.perf_counter();influence=[];mean=np.floor(pixels.mean(axis=(0,1))+.5).astype(np.uint8)
 for row in range(4):
  for col in range(4):
   masked=pixels.copy();masked[row*56:(row+1)*56,col*56:(col+1)*56]=mean
   influence.append(float(scores[winner]-predict(masked)[winner]))
 decision='uncertain' if warnings else 'overlap' if label=='Overlap' else 'uncertain' if float(scores[winner])<metadata['abstainThreshold'] else 'no-visible-alert' if label=='Healthy' else 'review'
 return {'qualityWarnings':warnings,'task':'silkworm-appearance-only','version':'larval-appearance-v1','decision':decision,'label':label,'scores':[{'label':c,'score':float(s)} for c,s in zip(metadata['classes'],scores)],'inferenceMs':inference_ms,'explanationMs':(time.perf_counter()-start)*1000,'influence':influence,'frameAgreement':1,'sampledFrames':1,'execution':'backend','architecture':'MobileNetV3-Small + trained classification head','modelSha256':model_hash,'runtime':'ONNX Runtime CPU','scope':'Dataset appearance classes; not confirmed diagnosis or validated field confidence'}

class Handler(BaseHTTPRequestHandler):
 def reply(self,status,data):
  body=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
 def do_GET(self):
  if self.path=='/leaf/health':return self.reply(200,{'ok':True,'modelSha256':LEAF_MODEL_HASH,'runtime':'Python / NumPy logistic regression'})
  if self.path!='/health':return self.reply(404,{'error':'Not found'})
  self.reply(200,{'ok':True,'execution':'backend','architecture':'MobileNetV3-Small','modelSha256':model_hash,'providers':session.get_providers(),'report':metadata['report']})
 def do_POST(self):
  if self.path not in ['/predict','/leaf/predict']:return self.reply(404,{'error':'Not found'})
  try:size=int(self.headers.get('Content-Length','0'))
  except ValueError:return self.reply(400,{'error':'Invalid content length'})
  if size<1 or size>8*1024*1024:return self.reply(413,{'error':'Image must be between 1 byte and 8 MB'})
  if not lock.acquire(blocking=False):return self.reply(429,{'error':'Model is busy; try again shortly'})
  try:
   self.connection.settimeout(15)
   raw=self.rfile.read(size)
   if len(raw)!=size:raise ValueError('Incomplete image')
   self.reply(200,infer_leaf(raw) if self.path=='/leaf/predict' else infer(raw))
  except (ValueError,UnidentifiedImageError,OSError,Image.DecompressionBombError):self.reply(400,{'error':'Invalid or oversized image. Use a JPEG, PNG or WebP photo.'})
  except Exception as e:
   print(type(e).__name__,str(e),flush=True);self.reply(500,{'error':'Inference failed'})
  finally:lock.release()

if __name__=='__main__':
 print('Loaded MobileNetV3 neural network',model_hash,flush=True)
 ThreadingHTTPServer(('127.0.0.1',int(os.environ.get('MODEL_PORT','8791'))),Handler).serve_forever()
