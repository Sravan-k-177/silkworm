import {describe,it,expect} from 'vitest';
import {appearanceDecision,larvalTensor,sampleLarvalPixels,softmax} from '../src/larval-model';
import {assessRisk} from '../shared/risk';
import {larvalVisualSchema,type LarvalVisual,type RiskInput} from '../shared/domain';
const classes=['Flacherie','Grasserie','Healthy','Overlap','Pebrine'];
const normal:RiskInput={instar:'V',moulting:false,temperature:24,humidity:70,ventilation:'adequate',hygiene:'clean',feed:'fresh',symptoms:[],visual:{status:'not-assessed',warnings:[]}};
const visual:LarvalVisual={task:'silkworm-appearance-only',version:'larval-appearance-v1',decision:'review',label:'Grasserie',scores:classes.map(label=>({label,score:label==='Grasserie'?.8:.05})),inferenceMs:10,explanationMs:100,influence:Array(16).fill(0),frameAgreement:1,sampledFrames:1};
describe('larval model integration contract',()=>{
 it('withholds overlap, weak scores and video disagreement',()=>{
  expect(appearanceDecision(classes,[.01,.01,.01,.96,.01],1,.7)).toBe('overlap');
  expect(appearanceDecision(classes,[.2,.3,.2,.1,.2],1,.7)).toBe('uncertain');
  expect(appearanceDecision(classes,[.01,.96,.01,.01,.01],.4,.7)).toBe('uncertain');
  expect(appearanceDecision(classes,[.01,.01,.96,.01,.01],1,.7)).toBe('no-visible-alert');
 });
 it('adds only accepted positive visual evidence without suppressing validation limits',()=>{
  const risk=assessRisk({...normal,visual:{status:'model',warnings:[],larval:visual}});
  expect(risk.score).toBe(25);expect(risk.level).toBe('medium');expect(risk.missing).toContain('Validated visual health assessment');
  expect(assessRisk({...normal,symptoms:['mortality'],visual:{status:'model',warnings:[],larval:{...visual,decision:'no-visible-alert',label:'Healthy'}}}).score).toBe(60);
  for(const decision of ['uncertain','overlap'] as const)expect(assessRisk({...normal,visual:{status:'model',warnings:[],larval:{...visual,decision}}}).score).toBe(0);
  expect(assessRisk({...normal,visual:{status:'model',warnings:['Capture too dark'],larval:visual}}).score).toBe(0);
 });
 it('rejects malformed evidence and normalizes tensor channels correctly',()=>{
  expect(larvalVisualSchema.safeParse({...visual,influence:[0]}).success).toBe(false);
  const one=new Uint8ClampedArray([255,0,128,255]);const pixels=sampleLarvalPixels(one,1,1);expect(Array.from(pixels.slice(-4))).toEqual([255,0,128,255]);
  const tensor=larvalTensor(pixels);expect(tensor[0]).toBeCloseTo((1-.485)/.229,5);expect(tensor[224*224]).toBeCloseTo(-.456/.224,5);expect(tensor[2*224*224]).toBeCloseTo((128/255-.406)/.225,5);
  expect(softmax([1000,1000])).toEqual([.5,.5]);
 });
});
