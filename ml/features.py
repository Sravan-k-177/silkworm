"""Deterministic color/texture features shared with browser; no learned preprocessing.
64x64 center-nearest samples, RGB histograms, 4x4 spatial mean/std, gradient histogram.
"""
import numpy as np
from PIL import Image
VERSION='rgb-texture-153-v1'
def features(image):
 a=np.asarray(image.convert('RGB'));h,w=a.shape[:2]
 ys=np.minimum(((np.arange(64)+.5)*h/64).astype(int),h-1)
 xs=np.minimum(((np.arange(64)+.5)*w/64).astype(int),w-1)
 a=a[ys[:,None],xs[None,:]].astype(np.float64)/255
 result=[]
 for c in range(3):result.extend(np.bincount(np.minimum((a[:,:,c]*16).astype(int),15).ravel(),minlength=16)/4096)
 for gy in range(4):
  for gx in range(4):
   tile=a[gy*16:(gy+1)*16,gx*16:(gx+1)*16]
   for c in range(3):result.extend([tile[:,:,c].mean(),tile[:,:,c].std()])
 gray=a[:,:,0]*.299+a[:,:,1]*.587+a[:,:,2]*.114
 dx=gray[1:-1,2:]-gray[1:-1,:-2];dy=gray[2:,1:-1]-gray[:-2,1:-1]
 mag=np.sqrt(dx*dx+dy*dy);angle=np.mod(np.arctan2(dy,dx)+np.pi,np.pi)
 bins=np.minimum((angle/np.pi*9).astype(int),8)
 hist=np.bincount(bins.ravel(),weights=mag.ravel(),minlength=9);hist=hist/(hist.sum()+1e-12)
 result.extend(hist)
 return np.array(result,dtype=np.float64)
def dhash(image):
 a=np.asarray(image.convert('L').resize((9,8),Image.Resampling.LANCZOS))
 return sum(int(v)<<i for i,v in enumerate((a[:,1:]>a[:,:-1]).ravel()))
