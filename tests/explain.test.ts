import {expect,it} from 'vitest';
import {explainCare} from '../shared/explain';
import type {RiskInput} from '../shared/domain';
const input:RiskInput={instar:'V',moulting:false,temperature:29,humidity:85,ventilation:'stuffy',hygiene:'clean',feed:'fresh',symptoms:['mortality'],visual:{status:'not-assessed',warnings:[]}};
it('retains urgent mortality when all environmental concerns are corrected',()=>{const r=explainCare(input,['temperature','humidity','ventilation']);expect(r.risk.score).toBe(100);expect(r.projected.score).toBe(60);expect(r.projected.level).toBe('high');expect(r.actions[0].key).toBe('mortality');expect(input.temperature).toBe(29);});
it('keeps missing measurements unknown',()=>{const r=explainCare({...input,temperature:null,humidity:null,ventilation:'unknown'},['temperature','humidity','ventilation']);expect(r.projected.missing).toEqual(r.risk.missing);expect(r.pointsRemoved).toBe(0);});
it('does not treat normal moult feeding changes as a concern',()=>{const r=explainCare({...input,moulting:true,symptoms:['reduced-feeding']});expect(r.actions.some(f=>f.key==='feeding')).toBe(false);});
it('does not let reported fresh feed lower the conservative feed scenario',()=>{
 const scores=['fresh','unknown','poor'].map(feed=>explainCare({...input,temperature:24,humidity:70,ventilation:'adequate',symptoms:[],feed:feed as RiskInput['feed']},['feed']));
 expect(scores.map(r=>r.feedWorstCase.score)).toEqual([20,20,20]);
 expect(scores.map(r=>r.projectedFeedWorstCase.score)).toEqual([20,20,20]);
});
