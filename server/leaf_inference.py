"""Actual execution of the exported trained mulberry model, independently of browser JS."""
import hashlib
import io
import json
import sys
import time
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'ml'))
from features import features

MODEL_BYTES = (ROOT / 'public/models/mulberry-baseline.json').read_bytes()
MODEL = json.loads(MODEL_BYTES)
MODEL_HASH = hashlib.sha256(MODEL_BYTES).hexdigest()
if MODEL['type'] != 'logistic' or MODEL['classes'] != ['Healthy', 'Leaf rust', 'Leaf spot']:
    raise RuntimeError('Unsupported trained leaf model')
WEIGHTS = np.array(MODEL['weights'], dtype=np.float64)
BIAS = np.array(MODEL['bias'], dtype=np.float64)
MEAN = np.array(MODEL['mean'], dtype=np.float64)
SCALE = np.array(MODEL['scale'], dtype=np.float64)
if WEIGHTS.shape != (3, 153) or BIAS.shape != (3,) or MEAN.shape != (153,) or SCALE.shape != (153,) or not all(np.isfinite(a).all() for a in [WEIGHTS, BIAS, MEAN, SCALE]) or (SCALE <= 0).any():
    raise RuntimeError('Invalid leaf model weights')


def predict_leaf(pixels):
    x = features(Image.fromarray(pixels))
    logits = WEIGHTS @ ((x - MEAN) / SCALE) + BIAS
    exp = np.exp(logits - logits.max())
    return exp / exp.sum()


def infer_leaf(raw):
    # Browser sends its decoded, metadata-free 224x224 PNG. Identical pixels in both runtimes.
    with Image.open(io.BytesIO(raw)) as image:
        if image.size != (224, 224) or image.format != 'PNG':
            raise ValueError('Leaf inference requires a prepared 224x224 PNG')
        pixels = np.array(image.convert('RGB'))
    runs = 0
    def run(image_pixels):
        nonlocal runs
        runs += 1
        return predict_leaf(image_pixels)
    start = time.perf_counter()
    scores = run(pixels)
    inference_ms = (time.perf_counter() - start) * 1000
    winner = int(scores.argmax())
    start = time.perf_counter()
    mean = np.floor(pixels.mean(axis=(0, 1)) + .5).astype(np.uint8)
    influence = []
    for row in range(4):
        for col in range(4):
            masked = pixels.copy()
            masked[row*56:(row+1)*56, col*56:(col+1)*56] = mean
            influence.append(float(scores[winner] - run(masked)[winner]))
    return {
        'execution': 'backend', 'runtime': 'Python / NumPy logistic regression',
        'modelSha256': MODEL_HASH, 'inputSha256': hashlib.sha256(pixels.tobytes()).hexdigest(),
        'scores': scores.tolist(), 'influence': influence,
        'inferenceMs': inference_ms, 'explanationMs': (time.perf_counter()-start)*1000,
        'modelRuns': runs,
    }
