import { useState, type FormEvent } from 'react';
import { api } from './api';
import { useDashboardData } from './useDashboardData';
import type { Claim } from './types';
import './styles.css';
import './workbench.css';

const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const optionalJson = (value: string) => value ? JSON.parse(value) : undefined;

function ClaimWorkspace({ claim, run }: {claim: Claim; run: (work: () => Promise<unknown>) => Promise<void>}) {
  function evidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const node=event.currentTarget; const form=new FormData(node);
    void run(async () => { await api.addEvidence(claim.id, {type:text(form,'type'),relation:text(form,'relation'),summary:text(form,'summary'),sourceRef:text(form,'sourceRef'),sensitivity:text(form,'sensitivity'),benchmarkReceipt:optionalJson(text(form,'receipt'))}); node.reset(); });
  }
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const node=event.currentTarget; const form=new FormData(node);
    void run(async () => { await api.addVerification(claim.id,{decision:text(form,'decision'),confidence:text(form,'confidence'),verifier:text(form,'verifier'),method:'local-human-review',rationale:text(form,'rationale'),evidenceIds:form.getAll('evidenceIds')}); node.reset(); });
  }
  return <article className="panel-stack">
    <section className="glass"><h2>{claim.subject.name || claim.subject.id}</h2><code>{claim.id}</code><p>{claim.statement}</p><p>Recorded status: <b>{claim.status}</b> · Risk: {claim.risk} · Heuristic score: {claim.trust.score} (not authority)</p>
      {claim.legacyStatusWarning && <p role="alert">Legacy status is not supported by current policy. Positive trust is withheld; explicit re-review/migration is required.</p>}
      <p>Intended use (not granted): {claim.trustApplication}</p>
      {(['verified','partially_verified'] as const).map(target => <div className="gate" key={target}><b>{target} eligibility: {claim.gates?.[target].pass ? 'eligible' : 'blocked'}</b><p>{claim.gates?.[target].reasons.join('; ') || (claim.gates ? 'Evidence policy satisfied; lifecycle still applies. Not independent approval.' : 'Server policy unavailable.')}</p><small>{claim.gates?.[target].policyVersion}</small></div>)}
      <div className="action-row">{claim.allowedTransitions?.map(status => <button key={status} disabled={(status==='verified' || status==='partially_verified') && !claim.gates?.[status].pass} onClick={() => void run(() => api.updateStatus(claim.id,status))}>Set {status}</button>)}</div>
      {claim.allowedTransitions?.length===0 && <p>Terminal status: history retained, no outgoing transition.</p>}
    </section>
    <section className="glass"><h2>Evidence and benchmark receipts</h2><p>Review original material locally. Restricted references and raw receipts are not exposed here. Summaries must be safe to display. Receipt hashes establish consistency, not truthful execution.</p>
      {claim.benchmarkSpec && <details><summary>Pinned benchmark contract</summary><pre>{JSON.stringify(claim.benchmarkSpec,null,2)}</pre></details>}
      {claim.evidence.length===0 && <p>No evidence linked. No starter stubs are created.</p>}
      {claim.evidence.map(e => <div className="record" key={e.id}><b>{e.id} · {e.relation} · {e.type}</b><p>{e.summary}</p><small>{e.sensitivity} · {e.sourceRef}</small></div>)}
      {claim.benchmarks?.map(b => <div className="record" key={b.evidenceId}><b>Receipt {b.evidenceId}: {b.pass ? 'passes comparison' : 'blocked'}</b><p>{b.reasons.join('; ')}</p><code>{b.sha256}</code></div>)}
      <form onSubmit={evidence}><h3>Link evidence</h3><label>Evidence type<select name="type"><option>document</option><option>benchmark_result</option><option>test_report</option></select></label><label>Relation<select name="relation"><option>supports</option><option>contextualizes</option><option>contradicts</option><option>invalidates</option><option>supersedes</option></select></label><label>Evidence summary<textarea name="summary" required/></label><label>Source reference<input name="sourceRef" required/></label><label>Sensitivity<select name="sensitivity" defaultValue="restricted"><option>restricted</option><option>sealed</option><option>internal</option><option>public</option></select></label><label>Benchmark receipt JSON (required for benchmark_result)<textarea name="receipt" placeholder='{"artifact":{...},"sha256":"..."}'/></label><button>Link evidence</button></form>
    </section>
    <section className="glass"><h2>Evidence-bound review</h2><p>The latest review governs eligibility. Select the evidence you actually reviewed; all supporting evidence must be covered. Adverse evidence cannot be voted away.</p>
      {claim.verifications.map(v => <div className="record" key={v.id}><b>{v.decision} · {v.verifier} · {v.confidence}</b><p>{v.rationale}</p><small>{v.createdAt} · Evidence: {v.evidenceIds?.join(', ') || 'unbound legacy review'}</small></div>)}
      <form onSubmit={review}><label>Reviewer label (not authenticated)<input name="verifier" required/></label><label>Decision<select name="decision" defaultValue="inconclusive"><option>inconclusive</option><option>accepted</option><option>partially_accepted</option><option>rejected</option><option>disputed</option></select></label><label>Confidence<select name="confidence" defaultValue="medium"><option>low</option><option>medium</option><option>high</option></select></label><label>Review rationale<textarea name="rationale" required/></label><fieldset><legend>Evidence reviewed</legend>{claim.evidence.map(e => <label className="check" key={e.id}><input type="checkbox" name="evidenceIds" value={e.id}/>{e.id} — {e.relation}: {e.summary}</label>)}</fieldset><button>Record review</button></form>
    </section>
  </article>;
}

export default function App() {
  const data=useDashboardData(5000);
  const [selected,setSelected]=useState(''); const [tab,setTab]=useState('Claims');
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  const claim=data.claims.find(c=>c.id===selected);
  async function run(work: () => Promise<unknown>) {
    if(busy || data.error || data.loading) return;
    setBusy(true); setMessage('');
    try { await work(); setMessage('Saved locally.'); await data.refresh(); }
    catch(error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const node=event.currentTarget; const form=new FormData(node);
    void run(async () => { const created=await api.createClaim({id:text(form,'id') || undefined,subject:{id:text(form,'subject'),name:text(form,'subject'),type:'tool',namespace:'local'},domain:text(form,'domain'),statement:text(form,'statement'),type:text(form,'type'),risk:text(form,'risk') as Claim['risk'],trustApplication:text(form,'use'),benchmarkSpec:optionalJson(text(form,'spec'))}); setSelected(created.id); setTab('Claims'); node.reset(); });
  }
  return <main><aside className="sidebar"><h1>Kportussy</h1><p>Evidence before influence</p><nav>{['Claims','Create','Audit'].map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</nav><p>Local, single-operator prototype</p></aside><section className="content">
    <header className="glass"><h1>Evidence-to-trust workbench</h1><p>No promotion from scores alone. Local eligibility is not permission for routing, deployment, or real-data adoption. Independent policy, provenance and data-owner approval remain required. High-risk governance is blocked.</p><p>{data.error ? 'OFFLINE / STALE — writes disabled' : data.loading ? 'Connecting…' : 'Connected to local store'} · Last sync: {data.lastUpdatedAt || 'never'}</p>{data.error && <p role="alert">{data.error}</p>}<button onClick={()=>void data.refresh()}>Refresh</button><button onClick={()=>data.setPaused(!data.paused)}>{data.paused?'Resume polling':'Pause polling'}</button></header>
    {message && <p role="status">{message}</p>}
    <fieldset className="workspace" disabled={busy || !!data.error || data.loading}>
      {tab==='Create' && <section className="glass"><h2>Create claim</h2><form onSubmit={create}><label>Claim ID (optional; pin before producing receipts)<input name="id" pattern="[A-Za-z0-9_-]+"/></label><label>Subject<input name="subject" required/></label><label>Domain<input name="domain" required/></label><label>Claim type<select name="type"><option>capability</option><option>performance</option><option>quality</option><option>release_readiness</option><option>provenance</option><option>compliance</option><option>identity</option><option>novelty</option></select></label><label>Risk<select name="risk" defaultValue="medium"><option>low</option><option>medium</option><option>high</option></select></label><label>Scoped statement<textarea name="statement" required/></label><label>Intended trust application<input name="use" required/></label><label>Benchmark contract JSON (pin at creation for performance claims)<textarea name="spec" placeholder='See docs/BENCHMARK_RECEIPTS.md for the exact contract.'/></label><button>Create claim</button></form></section>}
      {tab==='Claims' && <><section className="glass"><h2>Claims</h2><label>Select claim<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a claim</option>{data.claims.map(c=><option value={c.id} key={c.id}>{c.id} — {c.status}</option>)}</select></label><p>{data.claims.length} records. New databases include labeled example records; these are not adoption evidence.</p></section>{claim && <ClaimWorkspace key={claim.id} claim={claim} run={run}/>}</>}
    </fieldset>
    {tab==='Audit' && <section className="glass"><h2>Audit visibility</h2><p>Chain: {data.audit?.valid ? 'consistent' : 'unavailable'} · Total events: {data.audit?.eventCount ?? 'unknown'}</p><code>{data.audit?.head}</code><p>{data.audit?.limitation}</p><p>Showing latest 50 events. Full chain is validated; use the private database for complete history. No delete or overwrite action is exposed.</p>{data.events.slice().reverse().map(e=><details key={e.id}><summary>{e.occurredAt} · {e.type} · {String(e.subjectRefs.claim_id ?? '')}</summary><pre>{JSON.stringify(e,null,2)}</pre></details>)}</section>}
  </section></main>;
}
