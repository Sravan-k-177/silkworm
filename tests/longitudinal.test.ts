import {describe,it,expect} from 'vitest';
import {latestAssessmentInRange,outcomeComparison} from '../shared/longitudinal';
import {assessmentSchema} from '../shared/domain';
import type {Assessment,Outcome} from '../shared/domain';
const a=(id:string,time:string,batchId='b')=>({id,batchId,capturedAt:time} as Assessment);
const o=(id:string,time:string)=>({id,batchId:'b',recordedAt:time} as Outcome);
it('filters inclusive UTC days with open bounds and preserves unassessed batches only without dates',()=>{
 expect(latestAssessmentInRange(undefined,'','')).toBe(true);
 expect(latestAssessmentInRange(undefined,'2026-09-09','')).toBe(false);
 expect(latestAssessmentInRange('invalid','','2026-09-09')).toBe(false);
 expect(latestAssessmentInRange('2026-09-09T23:59:59.999Z','2026-09-09','2026-09-09')).toBe(true);
 expect(latestAssessmentInRange('2026-09-10T00:00:00Z','','2026-09-09')).toBe(false);
 expect(latestAssessmentInRange('2026-09-08T23:59:59Z','2026-09-09','')).toBe(false);
 expect(latestAssessmentInRange('2026-09-09T00:00:00Z','2026-09-10','2026-09-08')).toBe(false);
});
describe('outcome chronology',()=>{
 it('excludes future and simultaneous assessments and other batches',()=>{
 const result=outcomeComparison('b',[a('future','2026-09-09T12:00:00Z'),a('earlier','2026-09-09T08:00:00Z'),a('same','2026-09-09T10:00:00Z'),a('other','2026-09-09T09:00:00Z','x')],[o('outcome','2026-09-09T10:00:00Z')]);
 expect(result.assessment?.id).toBe('earlier');expect(result.hoursBeforeEntry).toBe(2);
 });
 it('selects latest outcome by timestamp regardless of import order',()=>{
 expect(outcomeComparison('b',[],[o('new','2026-09-09T10:00:00Z'),o('old','2026-09-08T10:00:00Z')]).outcome?.id).toBe('new');
 });
 it('preserves absence of evidence',()=>{expect(outcomeComparison('b',[],[]).hoursBeforeEntry).toBeNull();expect(outcomeComparison('b',[],[o('one','2026-09-09T10:00:00Z')]).assessment).toBeUndefined();});
});

it('orders accepted UTC timestamps by instant across fractional precision',()=>{
 const exact='2026-09-09T10:00:00Z';
 const later='2026-09-09T10:00:00.500Z';
 expect(assessmentSchema.shape.capturedAt.safeParse(exact).success).toBe(true);
 expect(assessmentSchema.shape.capturedAt.safeParse(later).success).toBe(true);
 const result=outcomeComparison('b',[
 a('exact',exact),a('fraction',later)
 ],[o('exact',exact),o('later','2026-09-09T10:00:00.900Z')]);
 expect(result.outcome?.id).toBe('later');
 expect(result.assessment?.id).toBe('fraction');
 expect(result.hoursBeforeEntry).toBeCloseTo(0.4/3600);
});
it('breaks equal-instant ties by ID without mutating source arrays',()=>{
 const assessments=[a('a','2026-09-09T09:00:00Z'),a('z','2026-09-09T09:00:00.000Z')];
 const outcomes=[o('a','2026-09-09T10:00:00Z'),o('z','2026-09-09T10:00:00.000Z')];
 const result=outcomeComparison('b',assessments,outcomes);
 expect(result.outcome?.id).toBe('z');expect(result.assessment?.id).toBe('z');
 expect(assessments.map(x=>x.id)).toEqual(['a','z']);
 expect(outcomes.map(x=>x.id)).toEqual(['a','z']);
});
