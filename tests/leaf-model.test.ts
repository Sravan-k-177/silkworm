import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {extractFeatures,predict,type LeafModel} from '../src/leaf-model';

describe('exported leaf model',()=>{
 it('extracts the same features from held-out RGBA pixels as Python',()=>{
  const fixture=JSON.parse(readFileSync('artifacts/feature-parity.json','utf8'));
  const actual=extractFeatures(new Uint8ClampedArray(fixture.pixels),fixture.width,fixture.height);
  expect(actual).toHaveLength(153);
  actual.forEach((value,i)=>expect(value).toBeCloseTo(fixture.features[i],10));
 });
 it('matches held-out scikit-learn probabilities',()=>{
  const model=JSON.parse(readFileSync('public/models/mulberry-baseline.json','utf8')) as LeafModel;
  const fixture=JSON.parse(readFileSync('artifacts/model-parity.json','utf8'));
  expect(model.classes).toEqual(fixture.classes);
  const actual=predict(model,fixture.features);
  actual.forEach((value,i)=>expect(value).toBeCloseTo(fixture.probabilities[i],10));
  expect(actual.reduce((a,b)=>a+b,0)).toBeCloseTo(1,12);
 });
 it('rejects corrupt input rather than emitting a class',()=>{
  expect(()=>predict({} as LeafModel,[NaN])).toThrow('Invalid image features');
 });
});
