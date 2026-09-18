import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const modelSha256=createHash('sha256').update(readFileSync('public/models/mulberry-baseline.json')).digest('hex');
const results=[];
for(const fixture of ['artifacts/mulberry-heldout-parity.png','tests/fixtures/mulberry-rust.png']) {
  const response=await fetch('http://127.0.0.1:8787/api/model/leaf/predict',{method:'POST',headers:{'Content-Type':'image/png'},body:readFileSync(fixture),signal:AbortSignal.timeout(65000)});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.execution,'backend');assert.equal(result.modelSha256,modelSha256);
  assert.equal(result.modelRuns,17);assert.equal(result.influence.length,16);
  assert.ok(result.inferenceMs>0);assert.ok(result.explanationMs>0);
  results.push({fixture,...result});
}
assert.notEqual(results[0].inputSha256,results[1].inputSha256);
assert.notDeepEqual(results[0].scores,results[1].scores);
assert.notDeepEqual(results[0].influence,results[1].influence);
writeFileSync('artifacts/leaf-execution-verification.json',JSON.stringify({checkedAt:new Date().toISOString(),scope:'Real local execution on internal dataset fixtures; not independent field accuracy',results},null,2)+'\n');
console.log('Verified real leaf model execution: two distinct photos, model checksum, image checksums and 17 executions per photo.');
