import io
import json
from pathlib import Path
import unittest
import numpy as np
from PIL import Image
from leaf_inference import infer_leaf
ROOT = Path(__file__).resolve().parent.parent

class LeafExecutionTests(unittest.TestCase):
    def test_matches_original_scikit_learn_prediction(self):
        actual = infer_leaf((ROOT/'artifacts/mulberry-heldout-parity.png').read_bytes())
        expected = json.loads((ROOT/'artifacts/model-parity.json').read_text())
        np.testing.assert_allclose(actual['scores'], expected['probabilities'], atol=1e-12, rtol=0)
        self.assertEqual(actual['modelRuns'], 17)
        self.assertEqual(len(actual['influence']), 16)

    def test_different_pixels_produce_different_outputs_and_measurements(self):
        healthy = infer_leaf((ROOT/'artifacts/mulberry-heldout-parity.png').read_bytes())
        rust = infer_leaf((ROOT/'tests/fixtures/mulberry-rust.png').read_bytes())
        self.assertNotEqual(healthy['inputSha256'], rust['inputSha256'])
        self.assertNotEqual(healthy['scores'], rust['scores'])
        self.assertNotEqual(healthy['influence'], rust['influence'])

    def test_invalid_input_never_returns_a_result(self):
        with self.assertRaises(Exception): infer_leaf(b'not an image')
        image = io.BytesIO()
        Image.new('RGB', (10, 10)).save(image, format='PNG')
        with self.assertRaises(ValueError): infer_leaf(image.getvalue())
