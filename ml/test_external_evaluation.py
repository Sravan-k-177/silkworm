"""Regression checks for evaluation mechanics; fixtures are not field evidence."""
import hashlib,json,tempfile,unittest
from pathlib import Path
import numpy as np
from PIL import Image
import onnxruntime as ort
from evaluate_external import validate_manifest,predict,metrics,ROOT
class EvaluationTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.base=Path(self.tmp.name);self.image=Image.new('RGB',(32,24),(40,120,60));self.image.save(self.base/'sample.png')
  self.training={'source':'training-source','classes':['Healthy','Overlap'],'records':[]}
  self.data={'source':'independent-fixture','license':'synthetic-test-only','label_method':'generated test fixture','images':[{'path':'sample.png','label':'Healthy','farm_id':'test-farm','batch_id':'test-batch','capture_group':'test-capture'}]}
 def tearDown(self):self.tmp.cleanup()
 def test_empty_data_cannot_be_validation(self):
  self.data['images']=[]
  with self.assertRaisesRegex(ValueError,'No independent images'):validate_manifest(self.data,self.base,self.training)
 def test_same_source_rejected(self):
  self.data['source']='training-source'
  with self.assertRaisesRegex(ValueError,'training source'):validate_manifest(self.data,self.base,self.training)
 def test_exact_training_pixels_rejected(self):
  self.training['records']=[{'source_sha256':'different-encoding','pixel_sha256':hashlib.sha256(self.image.tobytes()+str(self.image.size).encode()).hexdigest()}]
  with self.assertRaisesRegex(ValueError,'overlap'):validate_manifest(self.data,self.base,self.training)
 def test_duplicate_evaluation_images_rejected(self):
  self.data['images']*=2
  with self.assertRaisesRegex(ValueError,'Duplicate'):validate_manifest(self.data,self.base,self.training)
 def test_missing_provenance_rejected(self):
  del self.data['images'][0]['farm_id']
  with self.assertRaisesRegex(ValueError,'Every image'):validate_manifest(self.data,self.base,self.training)
 def test_path_escape_rejected(self):
  self.data['images'][0]['path']='../outside.png'
  with self.assertRaisesRegex(ValueError,'within manifest'):validate_manifest(self.data,self.base,self.training)
 def test_confusion_and_abstention(self):
  result=metrics(np.array([0,1,0]),np.array([[.9,.1],[.6,.4],[.4,.6]]),['Healthy','Overlap'])
  self.assertEqual(result['confusion_matrix'],[[1,1],[1,0]]);self.assertAlmostEqual(result['score_coverage'],1/3);self.assertEqual(result['accepted_accuracy'],1)
 def test_frozen_graph_matches_existing_python_fixture(self):
  options=ort.SessionOptions();options.intra_op_num_threads=2
  session=ort.InferenceSession(str(ROOT/'public/models/larval-appearance.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
  expected=json.loads((ROOT/'artifacts/larval-parity.json').read_text())['probabilities']
  with Image.open(ROOT/'artifacts/larval-heldout-parity.png') as image:actual=predict(session,image.convert('RGB'))
  np.testing.assert_allclose(actual,expected,rtol=1e-4,atol=1e-6)
if __name__=='__main__':unittest.main()
