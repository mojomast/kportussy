import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { seedClaims, seedRoadmap } from './seed-data.mjs';
import { dashboardMetrics } from './metrics.mjs';
import { requireTerm, requireTransition, verificationGate } from './verification-policy.mjs';
import { redactClaim } from './privacy.mjs';
import { validBenchmarkSpec, validateBenchmarkReceipt } from './benchmark-receipt.mjs';

const now = () => new Date().toISOString();
const defaultPath = resolve(process.cwd(), 'data/kportussy-live.json');
function id(prefix){ return `${prefix}-${randomUUID().slice(0,8)}`; }
function clone(x){ return JSON.parse(JSON.stringify(x)); }
function eventHash(evt, prev){ return createHash('sha256').update(JSON.stringify({...evt, previousHash:prev ?? null})).digest('hex'); }

export class KportussyStore {
  constructor(path = process.env.KPORTUSSY_DB_PATH || defaultPath){ this.path=path; this.state=this.load(); }
  load(){
    try { return JSON.parse(readFileSync(this.path,'utf8')); }
    catch { return this.seedState(); }
  }
  seedState(){
    const s={ version:1, createdAt:now(), claims: clone(seedClaims), roadmap: clone(seedRoadmap), events: [] };
    for(const c of s.claims) this.appendEventTo(s,'claim.seeded','seed',{claim_id:c.id,subject_id:c.subject.id},{status:c.status});
    this.saveState(s); return s;
  }
  save(){ this.saveState(this.state); }
  saveState(s){ mkdirSync(dirname(this.path),{recursive:true}); const tmp=`${this.path}.tmp`; writeFileSync(tmp, JSON.stringify(s,null,2)); renameSync(tmp,this.path); }
  appendEventTo(s,type,actorId,subjectRefs={},payload={}){ const prev=s.events.at(-1)?.eventHash; const evt={id:id('evt'),type,actorId,occurredAt:now(),subjectRefs,payload,previousHash:prev}; evt.eventHash=eventHash(evt,prev); s.events.push(evt); return evt; }
  event(type,actorId='dashboard',subjectRefs={},payload={}){ const evt=this.appendEventTo(this.state,type,actorId,subjectRefs,payload); this.save(); return evt; }
  dashboard(){ const claims=this.state.claims.map(redactClaim); return { mode:'live', claims, roadmap:this.state.roadmap, metrics:dashboardMetrics(claims), events:this.state.events.slice(-50), generatedAt:now() }; }
  health(){ return { status:'ok', service:'kportussy-api', version:'0.2.0-live-brrrr', database:'json-file', path:this.path, claims:this.state.claims.length, events:this.state.events.length, now:now() }; }
  listClaims(){ return this.state.claims.map(redactClaim); }
  getClaim(claimId){ const c=this.state.claims.find(c=>c.id===claimId); return c ? redactClaim(c) : null; }
  events(limit=100){ return this.state.events.slice(-Math.min(limit,500)).reverse(); }
  createClaim(input){
    if(!input?.subject?.id || !input?.statement || !input?.domain) throw new Error('subject.id, statement, and domain are required');
    if(input.benchmarkSpec !== undefined && !validBenchmarkSpec(input.benchmarkSpec)) throw new Error('invalid benchmarkSpec');
    requireTerm('risk', input.risk ?? 'medium');
    requireTerm('claimType', input.type ?? 'capability');
    if(input.id && this.state.claims.some(c=>c.id===input.id)) throw new Error('duplicate claim id');
    const claim={ id:input.id || id('claim'), subject: input.subject, domain:input.domain, type:input.type || 'capability', statement:input.statement, status:'draft', risk:input.risk || 'medium', tags:input.tags || [], createdAt:now(), nextAction:input.nextAction || 'Attach evidence and submit for review.', trustApplication:input.trustApplication || 'No trust application specified yet.', evidence:[], verifications:[], trust:{ state:'unverified', score:0, confidence:'low', components:{ evidenceStrength:0, verificationStrength:0, provenanceQuality:0, benchmarkQuality:0, recency:1, contradictionPenalty:0, governanceStatus:0 } } };
    if(input.benchmarkSpec !== undefined) claim.benchmarkSpec=clone(input.benchmarkSpec);
    this.state.claims.push(claim); this.event('claim.created', input.actorId || 'dashboard', {claim_id:claim.id, subject_id:claim.subject.id}, {statement:claim.statement,...(claim.benchmarkSpec ? {benchmarkSpec:clone(claim.benchmarkSpec)} : {})}); return redactClaim(claim);
  }
  updateStatus(claimId,status,actorId='dashboard'){
    const c=this.state.claims.find(c=>c.id===claimId); if(!c) throw new Error('claim not found');
    requireTerm('status',status);
    const gate=['verified','partially_verified'].includes(status) ? verificationGate(c,status) : null;
    if(gate && !gate.pass) throw new Error(`verification blocked: ${gate.reasons.join('; ')}`);
    requireTransition(c.status,status);
    const old=c.status; c.status=status; this.recomputeTrustFor(c,false); this.event('claim.status_changed',actorId,{claim_id:c.id,subject_id:c.subject.id},{from:old,to:status,...(gate ? {policyVersion:gate.policyVersion,verificationId:gate.verificationId} : {})}); this.save(); return redactClaim(c);
  }
  addEvidence(claimId,input){
    const c=this.state.claims.find(c=>c.id===claimId); if(!c) throw new Error('claim not found');
    const ev={ id:input.id || id('ev'), type:input.type || input.evidence_type || 'document', relation:input.relation ?? 'supports', summary:input.summary, sourceRef:input.sourceRef || input.source_ref || 'dashboard', sensitivity:input.sensitivity || 'restricted', freshnessDays:input.freshnessDays ?? 0, contentHash:input.contentHash };
    if(!ev.summary) throw new Error('evidence summary is required');
    requireTerm('relation',ev.relation);
    if(c.evidence.some(e=>e.id===ev.id)) throw new Error('duplicate evidence id');
    let benchmark;
    if(input.benchmarkReceipt !== undefined || ev.type === 'benchmark_result'){
      benchmark=validateBenchmarkReceipt(input.benchmarkReceipt,c);
      if(!benchmark.valid) throw new Error(`benchmark rejected: ${benchmark.reasons.join('; ')}`);
      ev.benchmarkReceipt=clone(input.benchmarkReceipt);
    }
    c.evidence.push(ev); this.recomputeTrustFor(c,false); this.event('evidence.linked',input.actorId||'dashboard',{claim_id:c.id,evidence_id:ev.id},{relation:ev.relation,sensitivity:ev.sensitivity,...(benchmark ? {benchmark:{sha256:benchmark.sha256,pass:benchmark.pass,reasons:benchmark.reasons}} : {})}); this.reconcileReview(c,input.actorId); this.save(); return redactClaim(c);
  }
  addVerification(claimId,input){
    const c=this.state.claims.find(c=>c.id===claimId); if(!c) throw new Error('claim not found');
    const ver={ id:input.id || id('ver'), method:input.method || 'manual-review', verifier:input.verifier || input.verifier_id || 'dashboard-reviewer', decision:input.decision ?? 'inconclusive', confidence:input.confidence ?? 'medium', rationale:input.rationale, evidenceIds:input.evidenceIds ?? [], createdAt:now() };
    requireTerm('decision',ver.decision); requireTerm('confidence',ver.confidence);
    if(typeof ver.rationale!=='string' || !ver.rationale.trim()) throw new Error('verification rationale is required');
    if(!Array.isArray(ver.evidenceIds) || ver.evidenceIds.some(ref=>typeof ref!=='string' || !c.evidence.some(e=>e.id===ref))) throw new Error('evidenceIds must reference evidence linked to this claim');
    if(new Set(ver.evidenceIds).size!==ver.evidenceIds.length) throw new Error('duplicate review evidence id');
    if(c.verifications.some(v=>v.id===ver.id)) throw new Error('duplicate verification id');
    ver.evidenceIds=[...ver.evidenceIds];
    c.verifications.push(ver); this.recomputeTrustFor(c,false); this.event('verification.created',input.actorId||'dashboard',{claim_id:c.id,verification_id:ver.id},{decision:ver.decision,confidence:ver.confidence,evidenceIds:ver.evidenceIds}); this.reconcileReview(c,input.actorId); this.save(); return redactClaim(c);
  }
  verificationGate(claimId,target='verified'){
    const c=this.state.claims.find(c=>c.id===claimId); if(!c) throw new Error('claim not found');
    return verificationGate(c,target);
  }
  reconcileReview(c,actorId='dashboard'){
    if(!['verified','partially_verified'].includes(c.status)) return;
    const gate=verificationGate(c,c.status);
    if(gate.pass) return;
    const old=c.status; c.status='disputed'; this.recomputeTrustFor(c,false);
    this.event('claim.status_changed',actorId,{claim_id:c.id,subject_id:c.subject.id},{from:old,to:c.status,policyVersion:gate.policyVersion,reasons:gate.reasons});
  }
  recomputeTrust(claimId,actorId='dashboard'){
    const c=this.state.claims.find(c=>c.id===claimId); if(!c) throw new Error('claim not found');
    this.recomputeTrustFor(c,true,actorId); this.save(); return redactClaim(c);
  }
  recomputeTrustFor(c, emit=false, actorId='dashboard'){
    const evidenceStrength=Math.min(1,(c.evidence?.length || 0)/3);
    const verificationStrength=Math.min(1,(c.verifications?.length || 0)/2);
    const benchmarkQuality=c.type==='performance' ? (c.trust?.components?.benchmarkQuality ?? 0.18) : Math.max(c.trust?.components?.benchmarkQuality ?? 0, evidenceStrength*0.4);
    const provenanceQuality=Math.min(1,0.45 + evidenceStrength*0.35);
    const recency=0.95;
    const contradictionPenalty=(c.evidence||[]).some(e=>['contradicts','invalidates'].includes(e.relation)) ? 0.35 : 0;
    const governanceStatus=c.risk==='high' ? Math.max(c.trust?.components?.governanceStatus ?? 0.25, verificationStrength*0.55) : Math.max(0.4, verificationStrength);
    let score=0.25*evidenceStrength+0.2*verificationStrength+0.15*provenanceQuality+0.15*benchmarkQuality+0.1*recency+0.15*governanceStatus-contradictionPenalty;
    score=Math.max(0,Math.min(1,score));
    let state= score>=0.75?'strong':score>=0.5?'moderate':score>=0.25?'weak':'unverified';
    const gate=verificationGate(c,'partially_verified');
    const withheld=!gate.pass || ['rejected','revoked','expired','superseded','disputed'].includes(c.status);
    if(withheld){ score=0; state='unverified'; }
    if(contradictionPenalty) state='disputed'; if(['revoked','expired','disputed'].includes(c.status)) state=c.status;
    c.trust={ state, score:Number(score.toFixed(3)), confidence: withheld?'low':verificationStrength>0.5?'high':verificationStrength>0?'medium':'low', components:{ evidenceStrength, verificationStrength, provenanceQuality, benchmarkQuality, recency, contradictionPenalty, governanceStatus } };
    if(emit) this.event('trust_signal.computed',actorId,{claim_id:c.id,subject_id:c.subject.id},{score:c.trust.score,state:c.trust.state});
  }
}
export function createStore(path){ return new KportussyStore(path); }
