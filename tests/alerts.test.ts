import {describe,it,expect} from 'vitest';
import {alertQueue,onsetComparison} from '../shared/alerts';
import {healthObservationSchema,followupSchema,type Assessment,type Followup,type HealthObservation} from '../shared/domain';
const a=(id:string,capturedAt:string,level='high',batchId='b')=>({id,batchId,capturedAt,risk:{level,score:70}} as Assessment);
const f=(id:string,status:Followup['status'],recordedAt='2026-09-10T09:00:00Z',batchId='b')=>({id,batchId,assessmentId:'a',recordedAt,status,dueAt:'2026-09-10T10:00:00Z',staffCode:'S',notes:'Field review'});
const health={id:'h',batchId:'b',recordedAt:'2026-09-10T12:00:00Z',observedAt:'2026-09-10T11:00:00Z',onsetAt:'2026-09-10T10:00:00Z',onsetPrecision:'estimated',observerCode:'S',finding:'mortality',examinedCount:100,affectedCount:2,evidence:'field-observation',notes:'Two deaths during examination'} as HealthObservation;
describe('durable high-risk alerts',()=>{
 it('does not silently close an alert when a later assessment is low',()=>{
  const q=alertQueue([a('a','2026-09-10T08:00:00Z'),a('low','2026-09-10T09:00:00Z','low')],[]);expect(q).toHaveLength(1);expect(q[0].status).toBe('open');
 });
 it('keeps cross-batch and pre-alert updates out; applies resolution and reopening in time order',()=>{
  const aa=[a('a','2026-09-10T08:00:00Z')];
  expect(alertQueue(aa,[f('foreign','resolved',undefined,'other'),f('old','resolved','2026-09-10T07:00:00Z')])[0].status).toBe('open');
  expect(alertQueue(aa,[f('resolved','resolved'),f('reopen','reopened','2026-09-10T09:30:00Z')])[0].status).toBe('reopened');
 });
 it('marks only scheduled, elapsed follow-ups overdue',()=>{
  const aa=[a('a','2026-09-10T08:00:00Z')],now=Date.parse('2026-09-10T11:00:00Z');
  expect(alertQueue(aa,[f('s','scheduled')],now)[0].overdue).toBe(true);
  expect(alertQueue(aa,[f('s','resolved')],now)[0].overdue).toBe(false);
  expect(followupSchema.safeParse({...f('s','scheduled'),dueAt:null}).success).toBe(false);
 });
});
describe('independent onset evidence',()=>{
 it('compares only earlier high alerts from the same batch and retains estimated timing',()=>{
  const c=onsetComparison(health,[a('a','2026-09-10T08:00:00Z'),a('future','2026-09-10T12:00:00Z'),a('same','2026-09-10T10:00:00Z'),a('other','2026-09-10T09:00:00Z','high','other')]);
  expect(c?.assessment.id).toBe('a');expect(c?.hours).toBe(2);expect(c?.precision).toBe('estimated');
  expect(onsetComparison({...health,onsetAt:null},[])).toBeNull();
 });
 it('rejects inconsistent counts, onset, and future observation timestamps',()=>{
  expect(healthObservationSchema.safeParse(health).success).toBe(true);
  for(const update of [{examinedCount:null},{affectedCount:101},{onsetPrecision:'unknown'},{onsetAt:'2026-09-10T12:00:00Z'},{observedAt:'2026-09-11T12:00:00Z'},{finding:'no-unusual-signs'}])expect(healthObservationSchema.safeParse({...health,...update}).success).toBe(false);
 });
});
