"""Export actual held-out pixels to test independent JS feature extraction."""
from pathlib import Path
import json
import numpy as np
from PIL import Image
from features import features
root=Path(__file__).resolve().parent.parent
im=Image.open(root/'artifacts/mulberry-heldout-parity.png').convert('RGBA')
(root/'artifacts/feature-parity.json').write_text(json.dumps({'width':im.width,'height':im.height,'pixels':np.asarray(im).ravel().tolist(),'features':features(im).tolist()},separators=(',',':')))
