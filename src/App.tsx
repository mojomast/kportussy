import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, Cpu, Database, GitBranch, Gauge, HeartPulse, Lock, Network, Plus, Radio, Rocket, ShieldCheck, Sparkles, Wifi, WifiOff } from 'lucide-react';
import { useDashboardData } from './useDashboardData';
import { api } from './api';
import { antiSlopGate, averageTrustScore, evidenceCount, privacyRiskCount, reviewQueue, statusCounts, verificationCoverage } from './metrics';
import type { AuditEvent, Claim } from './types';
import './styles.css';

const tabs = ['Overview', 'Claims', 'Create', 'Review Queue', 'Evidence Graph', 'Audit Log', 'API Status', 'Roadmap', 'API Contract'] as const;
type Tab = (typeof tabs)[number];

function pct(value: number): string { return `${Math.round(value * 100)}%`; }
function score(value: number): string { return value.toFixed(2); }
function ago(iso?: string | null): string { if (!iso) return 'never'; const secs = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000)); return secs < 60 ? `${secs}s ago` : `${Math.round(secs / 60)}m ago`; }

function statusClass(status: string): string {
  if (['verified', 'strong', 'ok'].includes(status)) return 'good';
  if (['partially_verified', 'moderate', 'under_review', 'submitted', 'in_progress', 'degraded'].includes(status)) return 'warn';
  if (['disputed', 'revoked', 'rejected', 'expired', 'down'].includes(status)) return 'bad';
  return 'neutral';
}

function StatCard({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub: string }) {
  return <section className="stat-card"><div className="stat-icon">{icon}</div><div><p>{label}</p><strong>{value}</strong><span>{sub}</span></div></section>;
}

function TrustBar({ label, value }: { label: string; value: number }) {
  return <div className="trust-bar"><span>{label}</span><div><i style={{ width: `${Math.round(value * 100)}%` }} /></div><b>{pct(value)}</b></div>;
}

function LiveStatusStrip({ mode, error, paused, setPaused, refresh, lastUpdatedAt, health }: ReturnType<typeof useDashboardData>) {
  const live = mode === 'live' && !error;
  return <div className="live-strip">
    <span className={`pill ${live ? 'good' : error ? 'bad' : 'neutral'}`}>{live ? <Wifi size={13}/> : <WifiOff size={13}/>} {mode}</span>
    <span>API: <b>{health?.status ?? (error ? 'offline' : 'checking')}</b></span>
    <span>last sync: <b>{ago(lastUpdatedAt)}</b></span>
    <span>events: <b>{health?.events ?? 'mock'}</b></span>
    {error && <span className="strip-error">{error}</span>}
    <button onClick={() => setPaused(!paused)}>{paused ? 'Resume' : 'Pause'}</button>
    <button onClick={() => void refresh()}>Refresh now</button>
  </div>;
}

function ClaimCard({ claim, onChanged }: { claim: Claim; onChanged: () => void }) {
  const gate = antiSlopGate(claim);
  async function mutate(action: 'recompute' | 'review' | 'evidence' | 'verify') {
    if (action === 'recompute') await api.recomputeTrust(claim.id);
    if (action === 'review') await api.updateStatus(claim.id, 'under_review');
    if (action === 'evidence') await api.addEvidence(claim.id, { type: 'operator_note', relation: 'contextualizes', summary: `Dashboard brrrr operator note added at ${new Date().toISOString()}`, sourceRef: 'dashboard:quick-add', sensitivity: 'internal' });
    if (action === 'verify') await api.addVerification(claim.id, { method: 'dashboard-review', decision: claim.risk === 'high' ? 'inconclusive' : 'partially_accepted', confidence: 'medium', rationale: 'Quick dashboard review; high-risk claims still require governance.' });
    onChanged();
  }
  return <article className="claim-card">
    <header>
      <div>
        <span className="eyebrow">{claim.subject.type} / {claim.domain}</span>
        <h3>{claim.subject.name}</h3>
      </div>
      <span className={`pill ${statusClass(claim.status)}`}>{claim.status}</span>
    </header>
    <p className="statement">{claim.statement}</p>
    <div className="meta-row">
      <span>risk: <b>{claim.risk}</b></span><span>evidence: <b>{claim.evidence.length}</b></span><span>verifications: <b>{claim.verifications.length}</b></span><span>trust: <b>{score(claim.trust.score)}</b></span>
    </div>
    <div className="component-grid">
      <TrustBar label="evidence" value={claim.trust.components.evidenceStrength} />
      <TrustBar label="verification" value={claim.trust.components.verificationStrength} />
      <TrustBar label="benchmark" value={claim.trust.components.benchmarkQuality} />
      <TrustBar label="governance" value={claim.trust.components.governanceStatus} />
      <TrustBar label="provenance" value={claim.trust.components.provenanceQuality} />
      <TrustBar label="recency" value={claim.trust.components.recency} />
    </div>
    <div className="next-action"><Rocket size={16} /> {claim.nextAction}</div>
    <div className={gate.pass ? 'gate pass' : 'gate fail'}>{gate.pass ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}{gate.pass ? 'Anti-slop gate pass' : `Gate blocked: ${gate.reasons.join('; ')}`}</div>
    <div className="action-row"><button onClick={() => void mutate('evidence')}>+ Evidence</button><button onClick={() => void mutate('verify')}>+ Verification</button><button onClick={() => void mutate('review')}>Start review</button><button onClick={() => void mutate('recompute')}>Recompute</button></div>
  </article>;
}

function Overview({ claims }: { claims: Claim[] }) {
  const counts = statusCounts(claims); const avg = averageTrustScore(claims); const coverage = verificationCoverage(claims); const queue = reviewQueue(claims);
  return <div className="panel-stack">
    <section className="hero"><div><p className="eyebrow"><Sparkles size={16}/> Evidence before influence</p><h1>Kportussy Trust Control</h1><p>Live claim → evidence → verification → trust application → audit. Operator cockpit for making Ussyverse promotion gates go brrrr without slop.</p></div><div className="hero-badge"><Gauge size={32}/><strong>{score(avg)}</strong><span>avg trust</span></div></section>
    <div className="stats-grid"><StatCard icon={<Database />} label="Claims tracked" value={String(claims.length)} sub={`${counts.under_review + counts.submitted} active review`} /><StatCard icon={<GitBranch />} label="Evidence links" value={String(evidenceCount(claims))} sub="supports/context/benchmarks" /><StatCard icon={<ShieldCheck />} label="Verification coverage" value={pct(coverage)} sub="claims with review records" /><StatCard icon={<Lock />} label="Privacy-sensitive evidence" value={String(privacyRiskCount(claims))} sub="restricted or sealed refs" /></div>
    <section className="grid-2"><div className="glass"><h2>Pipeline health</h2>{Object.entries(counts).filter(([,v])=>v>0).map(([k,v])=><div className="status-line" key={k}><span className={`dot ${statusClass(k)}`}/><span>{k}</span><b>{v}</b></div>)}</div><div className="glass"><h2>Brrrr queue</h2>{queue.map((claim)=><div className="queue-row" key={claim.id}><span className={`pill ${statusClass(claim.status)}`}>{claim.status}</span><div><b>{claim.subject.name}</b><small>{antiSlopGate(claim).pass ? 'READY-ish: evidence gates okay' : antiSlopGate(claim).reasons.join('; ')}</small></div></div>)}</div></section>
  </div>;
}

function CreatePanel({ onChanged }: { onChanged: () => void }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage('');
    const form = new FormData(e.currentTarget);
    try {
      const claim = await api.createClaim({ subject: { id: String(form.get('subjectId')), name: String(form.get('subjectName')), type: 'tool', namespace: 'kportussy' }, domain: String(form.get('domain')), type: 'capability', statement: String(form.get('statement')), risk: String(form.get('risk')) as Claim['risk'], nextAction: 'Attach evidence, submit, verify, recompute.', trustApplication: String(form.get('trustApplication')), tags: ['dashboard-created'] } as Partial<Claim>);
      await api.addEvidence(claim.id, { type: 'dashboard_intake', relation: 'supports', summary: 'Initial evidence stub created from dashboard intake. Replace with benchmark/audit/provenance evidence.', sourceRef: 'dashboard:create', sensitivity: 'internal' });
      setMessage(`created ${claim.id} and attached initial evidence`); onChanged(); e.currentTarget.reset();
    } catch (err) { setMessage(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  }
  return <section className="glass create-panel"><h2><Plus/> Create live claim</h2><p className="muted">This writes to the persistent Kportussy API store and emits audit events. No more mock-only vibes.</p><form onSubmit={(e)=>void submit(e)}><label>Subject ID<input name="subjectId" defaultValue="new-tool" required/></label><label>Subject name<input name="subjectName" defaultValue="New Ussyverse Tool" required/></label><label>Domain<input name="domain" defaultValue="tool-novelty" required/></label><label>Risk<select name="risk" defaultValue="medium"><option>low</option><option>medium</option><option>high</option></select></label><label>Statement<textarea name="statement" defaultValue="This tool deserves trust only after evidence, verification, and benchmark-backed utility." required/></label><label>Trust application<input name="trustApplication" defaultValue="Gate dashboard promotion until evidence passes." required/></label><button disabled={busy}>{busy ? 'Creating…' : 'Create claim + starter evidence'}</button></form>{message && <div className="next-action"><HeartPulse size={16}/>{message}</div>}</section>;
}

function ClaimsPanel({ claims, refresh }: { claims: Claim[]; refresh: () => void }) { return <div className="claim-grid">{claims.map((claim) => <ClaimCard key={claim.id} claim={claim} onChanged={refresh} />)}</div>; }
function ReviewPanel({ claims, refresh }: { claims: Claim[]; refresh: () => void }) { return <div className="panel-stack"><section className="glass"><h2>Review queue</h2><p className="muted">Live high-risk/submitted/under-review/disputed claims. Quick actions write audit events.</p></section>{reviewQueue(claims).map((claim)=><ClaimCard key={claim.id} claim={claim} onChanged={refresh}/>)}</div>; }
function EvidenceGraph({ claims }: { claims: Claim[] }) { return <div className="graph-wrap">{claims.map((claim) => <section className="graph-claim" key={claim.id}><div className="node claim-node"><Network size={18}/><b>{claim.subject.name}</b><span>{claim.domain}</span></div><div className="edges">{claim.evidence.map((evidence) => <div className="edge" key={evidence.id}><i/><div className={`node evidence-node ${evidence.sensitivity}`}><span>{evidence.type} · {evidence.sensitivity}</span><b>{evidence.relation}</b><small>{evidence.summary}</small><small>{evidence.sourceRef}</small></div></div>)}</div></section>)}</div>; }
function AuditPanel({ events }: { events: AuditEvent[] }) { return <section className="glass"><h2>Audit log</h2><p className="muted">Append-only trust-affecting event stream.</p><div className="audit-list">{events.map((event)=><div className="audit-row" key={event.id}><span className={`pill ${statusClass(event.type.includes('created')?'ok':'neutral')}`}>{event.type}</span><b>{ago(event.occurredAt)}</b><code>{JSON.stringify(event.subjectRefs)}</code><small>{event.eventHash?.slice(0,16)}</small></div>)}</div></section>; }
function ApiStatusPanel({ health, error }: Pick<ReturnType<typeof useDashboardData>, 'health' | 'error'>) { const endpoints=['GET /api/health','GET /api/dashboard','GET /api/claims','GET /api/events','POST /api/claims','POST /api/claims/{id}/evidence-links','POST /api/claims/{id}/verifications','POST /api/trust-signals/recompute']; return <section className="glass api-panel"><h2><Radio/> API Status</h2><div className="stats-grid mini"><StatCard icon={<Activity/>} label="Backend" value={health?.status ?? 'offline'} sub={error ?? health?.version ?? 'checking'} /><StatCard icon={<Database/>} label="Store" value={health?.database ?? 'unknown'} sub={`${health?.claims ?? 0} claims`} /><StatCard icon={<Clock/>} label="Events" value={String(health?.events ?? 0)} sub="append-only-ish JSON event log" /></div><div className="endpoint-grid">{endpoints.map(e=><code key={e}>{e}</code>)}</div></section>; }
function RoadmapPanel({ roadmap }: Pick<ReturnType<typeof useDashboardData>, 'roadmap'>) { return <div className="roadmap">{(['30d','60d','90d'] as const).map((horizon)=><section className="glass" key={horizon}><h2>{horizon}</h2>{roadmap.filter((m)=>m.horizon===horizon).map((m)=><div className="milestone" key={m.id}><span className={`pill ${m.status === 'done' ? 'good' : m.status === 'in_progress' ? 'warn' : 'neutral'}`}>{m.status}</span><b>{m.title}</b><p>{m.acceptance}</p></div>)}</section>)}</div>; }
function ApiPanel() { const endpoints = ['GET /api/health','GET /api/dashboard','GET /api/claims','POST /api/claims','GET /api/events','POST /api/claims/{id}/status','POST /api/claims/{id}/evidence-links','POST /api/claims/{id}/verifications','POST /api/trust-signals/recompute']; return <section className="glass api-panel"><h2>Initial API contract</h2><p className="muted">Implemented MVP endpoints are live; broader spec endpoints remain roadmap.</p><div className="endpoint-grid">{endpoints.map((e)=><code key={e}>{e}</code>)}</div></section>; }

export default function App() {
  const data = useDashboardData(4000);
  const [active, setActive] = useState<Tab>('Overview');
  const content = useMemo(() => ({ Overview: <Overview claims={data.claims} />, Claims: <ClaimsPanel claims={data.claims} refresh={data.refresh} />, Create: <CreatePanel onChanged={data.refresh}/>, 'Review Queue': <ReviewPanel claims={data.claims} refresh={data.refresh} />, 'Evidence Graph': <EvidenceGraph claims={data.claims} />, 'Audit Log': <AuditPanel events={data.events} />, 'API Status': <ApiStatusPanel health={data.health} error={data.error} />, Roadmap: <RoadmapPanel roadmap={data.roadmap} />, 'API Contract': <ApiPanel /> })[active], [active, data]);
  return <main><aside className="sidebar"><div className="brand"><Cpu/><div><b>Kportussy</b><span>live trust brrrr</span></div></div><nav>{tabs.map((tab)=><button className={active===tab?'active':''} onClick={()=>setActive(tab)} key={tab}>{tab}</button>)}</nav><footer><Activity size={16}/> {data.mode} dashboard</footer></aside><section className="content"><LiveStatusStrip {...data}/>{data.loading ? <section className="glass"><h2>Loading live trust substrate…</h2></section> : content}</section></main>;
}
