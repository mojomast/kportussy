// Runs the production HTTP entrypoint and real CLI against an isolated local DB.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { benchmarkHash, BENCHMARK_VERSION } from '../server/benchmark-receipt.mjs';
const root=resolve(import.meta.dirname,'..');
const base=join(root,'artifacts/eval');mkdirSync(base,{recursive:true});
const dir=mkdtempSync(join(base,'local-mvp-')),db=join(dir,'store.json');
const save=(name,value)=>writeFileSync(join(dir,name),JSON.stringify(value,null,2));
const workload=()=>{const p=spawnSync(process.execPath,['scripts/benchmark-workload.mjs'],{cwd:root,encoding:'utf8'});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);};
const measured=workload();assert.deepEqual(measured,workload());save('workload.json',measured);
const id='demo-search-work';
const spec={metric:'search_work',unit:'element_probes',direction:'lower_is_better',minimumSamples:6,baselineSha256:benchmarkHash(measured.baseline),datasetSha256:measured.datasetSha256};
const artifact={schemaVersion:BENCHMARK_VERSION,claimId:id,metric:spec.metric,unit:spec.unit,direction:spec.direction,baseline:measured.baseline,candidate:measured.candidate,provenance:{runner:'local-mvp-self-test',environment:`Node ${process.version}`,command:'node scripts/benchmark-workload.mjs',datasetSha256:measured.datasetSha256}};
const receipt={artifact,sha256:benchmarkHash(artifact)};save('benchmark-contract.json',spec);save('receipt.json',receipt);
const server=spawn(process.execPath,['server/index.mjs'],{cwd:root,env:{...process.env,KPORTUSSY_DB_PATH:db,KPORTUSSY_API_HOST:'127.0.0.1',KPORTUSSY_API_PORT:'0'},stdio:['ignore','pipe','pipe']});
let stderr='',stdout='';server.stderr.on('data',b=>{stderr+=b;});
const transcript=[];
try {
  const url=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error(`Server readiness timeout: ${stderr}`)),10000);
    server.once('exit',code=>{clearTimeout(timer);reject(new Error(`Server exited ${code}: ${stderr}`));});
    server.stdout.on('data',b=>{stdout+=b;const match=stdout.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});
  });
  const html=await fetch(url);assert.equal(html.status,200);const page=await html.text();assert.match(page,/assets\/index-.*\.js/);
  for(const path of page.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g))assert.equal((await fetch(url+path[1])).status,200);
  async function request(path,body,expected=200){const response=await fetch(`${url}/api${path}`,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const result=await response.json();transcript.push({method:body===undefined?'GET':'POST',path,status:response.status,result});save('http-transcript.json',transcript);assert.equal(response.status,expected,JSON.stringify(result));return result;}
  await request('/health');
  const claim={id,subject:{id:'local-search',name:'Local search workload',type:'tool'},domain:'deterministic-search-work',type:'performance',risk:'low',statement:'Binary search uses no more mean probes than linear search for the six declared queries on pre-sorted integers. Excludes sorting and elapsed time.',benchmarkSpec:spec,trustApplication:'Local policy demo only; no external routing authority'};
  await request('/claims',claim,201);
  const path=`/claims/${id}`;
  await request(`${path}/status`,{status:'submitted'});await request(`${path}/status`,{status:'under_review'});
  assert.equal((await request(`${path}/verification-gate`)).pass,false);
  const before=readFileSync(db,'utf8');await request(`${path}/status`,{status:'verified'},400);assert.equal(readFileSync(db,'utf8'),before);
  const evidence={id:'measured',type:'benchmark_result',relation:'supports',summary:'Actual deterministic search workload receipt',sourceRef:'local:private-receipt',sensitivity:'restricted',benchmarkReceipt:receipt};
  const tampered=structuredClone(evidence);tampered.benchmarkReceipt.artifact.candidate.samples[0]++;
  await request(`${path}/evidence-links`,tampered,400);assert.equal(readFileSync(db,'utf8'),before);
  await request(`${path}/evidence-links`,evidence,201);
  await request(`${path}/verifications`,{decision:'accepted',confidence:'medium',verifier:'local-self-test',rationale:'Self-review of measured operation counts; not independent approval.',evidenceIds:['measured']},201);
  assert.equal((await request(`${path}/verification-gate`)).pass,true);
  assert.equal((await request(`${path}/status`,{status:'verified'})).status,'verified');
  const verified=await request(path);assert.equal(verified.benchmarks[0].pass,true);assert.equal(verified.gates.verified.pass,true);save('verified-projection.json',verified);
  const negative=structuredClone(receipt);negative.artifact.candidate.id='synthetic-regression-control';negative.artifact.candidate.samples=measured.baseline.samples.map(x=>x+1);negative.sha256=benchmarkHash(negative.artifact);save('synthetic-negative-receipt.json',negative);
  const disputed=await request(`${path}/evidence-links`,{...evidence,id:'negative-control',relation:'contextualizes',summary:'Synthetic below-baseline control, NOT a measured regression',benchmarkReceipt:negative},201);assert.equal(disputed.status,'disputed');assert.equal(disputed.trust.score,0);
  for(const target of ['verified','partially_verified']){const bytes=readFileSync(db,'utf8');const gate=await request(`${path}/verification-gate?target=${target}`);assert.ok(gate.reasons.includes('benchmark_below_baseline'));await request(`${path}/status`,{status:target},400);assert.equal(readFileSync(db,'utf8'),bytes);}
  await request(`${path}/status`,{status:'revoked'});
  const cli=spawnSync(process.execPath,['server/cli.mjs','claim',id],{cwd:root,env:{...process.env,KPORTUSSY_DB_PATH:db},encoding:'utf8'});assert.equal(cli.status,0,cli.stderr);const reopened=JSON.parse(cli.stdout);assert.equal(reopened.status,'revoked');assert.equal(reopened.evidence.length,2);assert.equal(reopened.verifications.length,1);save('cli-projection.json',reopened);
  const dashboard=await request('/dashboard');const audit=await request('/audit');assert.equal(audit.valid,true);
  const events=dashboard.events.filter(e=>e.subjectRefs.claim_id===id);assert.deepEqual(events.map(e=>e.type),['claim.created','claim.status_changed','claim.status_changed','evidence.linked','verification.created','claim.status_changed','evidence.linked','claim.status_changed','claim.status_changed']);
  assert.ok(!JSON.stringify({dashboard,reopened}).includes('local:private-receipt'));assert.ok(!JSON.stringify({dashboard,reopened}).includes('node scripts/benchmark-workload.mjs'));
  const report={passed:true,artifactDir:dir,httpRequests:transcript.length,productionAssetsServed:true,deterministicRerunIdentical:true,scoreOnlyAndTamperedPromotionsBlocked:true,verifiedThenDisputedThenRevoked:true,cliReopen:true,audit,claimEvents:events.length,limitations:['Synthetic negative control; not a measured regression.','Local self-review is not independent policy approval.','Hashes do not prove provenance. No real-data adoption is authorized.'],restart:`KPORTUSSY_DB_PATH=${db} npm start`};save('report.json',report);console.log(JSON.stringify(report,null,2));
} finally {
  server.kill('SIGTERM');await new Promise(resolve=>{if(server.exitCode!==null || server.signalCode!==null)resolve();else server.once('exit',resolve);});
}
