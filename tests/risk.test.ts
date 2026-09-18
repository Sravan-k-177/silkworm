import { describe,expect,it } from 'vitest';
import { assessRisk,outcomeMetrics,profiles } from '../shared/risk';
import type { RiskInput } from '../shared/domain';
const normal:RiskInput={instar:'V',moulting:false,temperature:24,humidity:70,ventilation:'adequate',hygiene:'clean',feed:'fresh',symptoms:[],visual:{status:'not-assessed',warnings:[]}};
describe('transparent priority rules',()=>{
 it('does not turn arbitrary experimental labels into validated larval evidence',()=>{
  for(const label of ['Healthy','Leaf rust','Grasserie']){
   const result=assessRisk({...normal,visual:{status:'model',warnings:[],label,score:.99,modelVersion:'unverified'}});
   expect(result.missing).toContain('Validated visual health assessment');
   expect(result.score).toBe(0);expect(result.version).toBe('priority-rules-0.4');
  }
 });
 it('does not mistake missing measurements for zero or health assurance',()=>{const r=assessRisk({...normal,temperature:null,humidity:null});expect(r.factors).toEqual([]);expect(r.missing).toContain('Temperature');expect(r.missing).toContain('Relative humidity');expect(r.missing).toContain('Validated visual health assessment');});
 it('always escalates unusual mortality even if conditions are in range',()=>{const r=assessRisk({...normal,symptoms:['mortality']});expect(r.level).toBe('high');expect(r.factors[0].key).toBe('mortality');});
 it('does not flag normal feeding cessation in moult',()=>{expect(assessRisk({...normal,symptoms:['reduced-feeding'],moulting:true}).score).toBe(0);expect(assessRisk({...normal,symptoms:['reduced-feeding']}).score).toBe(20);});
 it('caps score and retains all explanations',()=>{const r=assessRisk({...normal,temperature:40,humidity:99,ventilation:'stuffy',hygiene:'litter',feed:'poor',symptoms:['mortality','discoloration','reduced-feeding','uneven-growth']});expect(r.score).toBe(100);expect(r.factors).toHaveLength(9);});
 it('uses stage-specific reference conditions with inclusive boundaries',()=>{for(const stage of ['I','II','III','IV','V'] as const){for(const t of profiles[stage].temperature){expect(assessRisk({...normal,instar:stage,temperature:t,humidity:profiles[stage].humidity[0]}).score).toBe(0);}}});
 it('does not report comparable ERR for unspecified or partial counts',()=>{
  const counts={larvaeBrushed:100,cocoonsHarvested:80,sampleCocoonG:2,sampleShellG:.4};
  for(const countScope of [undefined,'partial','unknown'] as const)expect(outcomeMetrics({...counts,countScope}).err).toBeNull();
 });
 it('distinguishes missing outcomes from zero harvest',()=>{expect(outcomeMetrics({countScope:'whole-cycle',larvaeBrushed:100,cocoonsHarvested:0,sampleCocoonG:2,sampleShellG:0})).toEqual({err:0,shellRatio:0});expect(outcomeMetrics({countScope:'whole-cycle',larvaeBrushed:null,cocoonsHarvested:0,sampleCocoonG:null,sampleShellG:0})).toEqual({err:null,shellRatio:null});});
});
