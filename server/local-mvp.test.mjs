import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { get } from 'node:http';
import { spawnSync } from 'node:child_process';
import { createStore } from './store.mjs';
import { createHttpServer } from './http.mjs';
const dirs=[];
function setup(){const base=resolve('artifacts/test');mkdirSync(base,{recursive:true});const dir=mkdtempSync(join(base,'mvp-'));dirs.push(dir);const path=join(dir,'store.json');return {dir,path,store:createStore(path)};}
afterEach(()=>{vi.restoreAllMocks();for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true});});
const claim={id:'local',subject:{id:'tool'},statement:'Scoped assertion',domain:'test',risk:'low'};

describe('local storage safety',()=>{
  it('seed command honors the selected database and never deletes existing history',()=>{const {path,store}=setup();store.createClaim(claim);const before=readFileSync(path,'utf8');const command=spawnSync(process.execPath,['server/seed.mjs'],{env:{...process.env,KPORTUSSY_DB_PATH:path},encoding:'utf8'});expect(command.status).toBe(0);expect(readFileSync(path,'utf8')).toBe(before);});
  it.each(['{broken','{}','null'])('refuses malformed store without reseeding: %s',bytes=>{const {path}=setup();writeFileSync(path,bytes);expect(()=>createStore(path)).toThrow();expect(readFileSync(path,'utf8')).toBe(bytes);});
  it('refuses audit tampering without replacing history',()=>{const {path,store}=setup();store.state.events[0].payload.status='forged';const bytes=JSON.stringify(store.state);writeFileSync(path,bytes);expect(()=>createStore(path)).toThrow('audit chain invalid');expect(readFileSync(path,'utf8')).toBe(bytes);});
  it('withholds stale seed trust on every read without silently migrating disk',()=>{const {path,store}=setup();const before=readFileSync(path,'utf8');const claims=store.listClaims();expect(claims.every(c=>c.trust.score===0)).toBe(true);expect(claims.some(c=>c.legacyStatusWarning)).toBe(true);store.dashboard();expect(readFileSync(path,'utf8')).toBe(before);});
  it('commits multi-event automatic dispute once and rolls back on save failure',()=>{
    const {path,store}=setup();store.createClaim(claim);store.updateStatus('local','submitted');store.updateStatus('local','under_review');store.addEvidence('local',{id:'support',summary:'test receipt'});store.addVerification('local',{decision:'accepted',rationale:'reviewed',evidenceIds:['support']});store.updateStatus('local','verified');
    const before=readFileSync(path,'utf8'),snapshot=structuredClone(store.state);
    const save=vi.spyOn(store,'saveState').mockImplementation(()=>{throw new Error('disk full');});
    expect(()=>store.addEvidence('local',{summary:'adverse',relation:'contradicts'})).toThrow('disk full');expect(store.state).toEqual(snapshot);expect(readFileSync(path,'utf8')).toBe(before);
    save.mockRestore();const success=vi.spyOn(store,'saveState');store.addEvidence('local',{summary:'adverse',relation:'contradicts'});expect(success).toHaveBeenCalledTimes(1);expect(createStore(path).getClaim('local').status).toBe('disputed');expect(store.checkAudit().valid).toBe(true);
  });
  it('rejects stale writers and active locks without lost updates',()=>{const {path,store}=setup();const second=createStore(path);store.createClaim(claim);expect(()=>second.createClaim({...claim,id:'other'})).toThrow('store changed');writeFileSync(`${path}.lock`,'');expect(()=>store.updateStatus('local','submitted')).toThrow();expect(createStore(path).getClaim('local').status).toBe('draft');});
  it('withholds full verified legacy trust when review only supports partial eligibility',()=>{const {store}=setup();store.createClaim(claim);store.addEvidence('local',{id:'support',summary:'test'});store.addVerification('local',{decision:'partially_accepted',rationale:'only partial',evidenceIds:['support']});store.state.claims.find(c=>c.id==='local').status='verified';const projected=store.getClaim('local');expect(projected.gates.partially_verified.pass).toBe(true);expect(projected.legacyStatusWarning).toBe(true);expect(projected.trust.score).toBe(0);});
  it.each([{statement:' '},{subject:{id:3}},{id:'bad/id'},{tags:{} }])('rejects malformed intake before mutation %j',input=>{const {path,store}=setup();const before=readFileSync(path,'utf8');expect(()=>store.createClaim({...claim,...input})).toThrow();expect(readFileSync(path,'utf8')).toBe(before);});
  it('rejects unknown sensitivity rather than leaking references',()=>{const {store}=setup();store.createClaim(claim);expect(()=>store.addEvidence('local',{summary:'test',sourceRef:'private',sensitivity:'secret-ish'})).toThrow('sensitivity');});
});

describe('actual loopback transport',()=>{
  it('serves static assets and JSON mutations, gates and audit; rejects unsafe requests',async()=>{
    const {store,dir}=setup();writeFileSync(join(dir,'index.html'),'<h1>test build</h1>');const server=createHttpServer(store,dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
    try {
      expect(await (await fetch(base)).text()).toContain('test build');
      const hostileHostStatus=await new Promise((resolve,reject)=>{get(`${base}/api/health`,{headers:{host:'rebind.invalid'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});
      expect(hostileHostStatus).toBe(403);
      const post=(headers,body=claim)=>fetch(`${base}/api/claims`,{method:'POST',headers,body:JSON.stringify(body)});
      expect((await post({'content-type':'text/plain'})).status).toBe(415);
      expect((await post({'content-type':'application/json',origin:'https://evil.invalid'})).status).toBe(403);
      expect((await post({'content-type':'application/json'},null)).status).toBe(400);
      expect((await post({'content-type':'application/json'})).status).toBe(201);
      const gate=await (await fetch(`${base}/api/claims/local/verification-gate`)).json();expect(gate.pass).toBe(false);expect(gate.reasons).toContain('supporting_evidence_required');
      expect((await fetch(`${base}/api/claims/local/verification-gate?target=strong`)).status).toBe(400);
      expect((await fetch(`${base}/api/claims/missing/verification-gate`)).status).toBe(404);
      expect((await (await fetch(`${base}/api/audit`)).json()).valid).toBe(true);
      expect((await fetch(`${base}/missing.js`)).status).toBe(404);
      expect((await fetch(`${base}/api/claims`,{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(2*1024*1024+1)})).status).toBe(413);
    } finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
  });
});
