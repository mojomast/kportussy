import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, Cpu, Database, GitBranch, Gauge, Lock, Network, Rocket, ShieldCheck, Sparkles } from 'lucide-react';
import { claims, roadmap } from './data';
import { antiSlopGate, averageTrustScore, evidenceCount, privacyRiskCount, reviewQueue, statusCounts, verificationCoverage } from './metrics';
import type { Claim } from './types';
import './styles.css';

const tabs = ['Overview', 'Claims', 'Review Queue', 'Evidence Graph', 'Roadmap', 'API Contract'] as const;
type Tab = (typeof tabs)[number];

function pct(value: number): string { return `${Math.round(value * 100)}%`; }
function score(value: number): string { return value.toFixed(2); }

function statusClass(status: string): string {
  if (['verified', 'strong'].includes(status)) return 'good';
  if (['partially_verified', 'moderate', 'under_review', 'submitted'].includes(status)) return 'warn';
  if (['disputed', 'revoked', 'rejected', 'expired'].includes(status)) return 'bad';
  return 'neutral';
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return <section className="stat-card"><div className="stat-icon">{icon}</div><div><p>{label}</p><strong>{value}</strong><span>{sub}</span></div></section>;
}

function TrustBar({ label, value }: { label: string; value: number }) {
  return <div className="trust-bar"><span>{label}</span><div><i style={{ width: `${Math.round(value * 100)}%` }} /></div><b>{pct(value)}</b></div>;
}

function ClaimCard({ claim }: { claim: Claim }) {
  const gate = antiSlopGate(claim);
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
      <span>risk: <b>{claim.risk}</b></span>
      <span>evidence: <b>{claim.evidence.length}</b></span>
      <span>verifications: <b>{claim.verifications.length}</b></span>
      <span>trust: <b>{score(claim.trust.score)}</b></span>
    </div>
    <div className="component-grid">
      <TrustBar label="evidence" value={claim.trust.components.evidenceStrength} />
      <TrustBar label="verification" value={claim.trust.components.verificationStrength} />
      <TrustBar label="benchmark" value={claim.trust.components.benchmarkQuality} />
      <TrustBar label="governance" value={claim.trust.components.governanceStatus} />
    </div>
    <div className="next-action"><Rocket size={16} /> {claim.nextAction}</div>
    <div className={gate.pass ? 'gate pass' : 'gate fail'}>
      {gate.pass ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      {gate.pass ? 'Anti-slop gate pass' : `Gate blocked: ${gate.reasons.join('; ')}`}
    </div>
  </article>;
}

function Overview() {
  const counts = statusCounts(claims);
  const avg = averageTrustScore(claims);
  const coverage = verificationCoverage(claims);
  const queue = reviewQueue(claims);
  return <div className="panel-stack">
    <section className="hero">
      <div>
        <p className="eyebrow"><Sparkles size={16}/> Evidence before influence</p>
        <h1>Kportussy Trust Control</h1>
        <p>Claim → evidence → verification → trust application → audit. Built to make Ussyverse promotion gates go brrrr without letting slop through.</p>
      </div>
      <div className="hero-badge"><Gauge size={32}/><strong>{score(avg)}</strong><span>avg trust</span></div>
    </section>
    <div className="stats-grid">
      <StatCard icon={<Database />} label="Claims tracked" value={String(claims.length)} sub={`${counts.under_review + counts.submitted} active review`} />
      <StatCard icon={<GitBranch />} label="Evidence links" value={String(evidenceCount(claims))} sub="supports/context/benchmarks" />
      <StatCard icon={<ShieldCheck />} label="Verification coverage" value={pct(coverage)} sub="claims with review records" />
      <StatCard icon={<Lock />} label="Privacy-sensitive evidence" value={String(privacyRiskCount(claims))} sub="restricted or sealed refs" />
    </div>
    <section className="grid-2">
      <div className="glass"><h2>Pipeline health</h2>{Object.entries(counts).filter(([,v])=>v>0).map(([k,v])=><div className="status-line" key={k}><span className={`dot ${statusClass(k)}`}/><span>{k}</span><b>{v}</b></div>)}</div>
      <div className="glass"><h2>Brrrr queue</h2>{queue.map((claim)=><div className="queue-row" key={claim.id}><span className={`pill ${statusClass(claim.status)}`}>{claim.status}</span><div><b>{claim.subject.name}</b><small>{claim.nextAction}</small></div></div>)}</div>
    </section>
  </div>;
}

function ClaimsPanel() { return <div className="claim-grid">{claims.map((claim) => <ClaimCard key={claim.id} claim={claim} />)}</div>; }

function ReviewPanel() {
  return <div className="panel-stack"><section className="glass"><h2>Review queue</h2><p className="muted">Prioritized by submitted/under_review/disputed status and high-risk domains.</p></section>{reviewQueue(claims).map((claim)=><ClaimCard key={claim.id} claim={claim}/>)}</div>;
}

function EvidenceGraph() {
  return <div className="graph-wrap">
    {claims.map((claim) => <section className="graph-claim" key={claim.id}>
      <div className="node claim-node"><Network size={18}/><b>{claim.subject.name}</b><span>{claim.domain}</span></div>
      <div className="edges">{claim.evidence.map((evidence) => <div className="edge" key={evidence.id}><i/><div className={`node evidence-node ${evidence.sensitivity}`}><span>{evidence.type}</span><b>{evidence.relation}</b><small>{evidence.summary}</small></div></div>)}</div>
    </section>)}
  </div>;
}

function RoadmapPanel() {
  return <div className="roadmap">{(['30d','60d','90d'] as const).map((horizon)=><section className="glass" key={horizon}><h2>{horizon}</h2>{roadmap.filter((m)=>m.horizon===horizon).map((m)=><div className="milestone" key={m.id}><span className={`pill ${m.status === 'done' ? 'good' : m.status === 'in_progress' ? 'warn' : 'neutral'}`}>{m.status}</span><b>{m.title}</b><p>{m.acceptance}</p></div>)}</section>)}</div>;
}

function ApiPanel() {
  const endpoints = ['GET /health','POST /subjects','POST /claims','POST /claims/{id}/submit','POST /evidence','POST /claims/{id}/evidence-links','POST /claims/{id}/verifications','POST /trust-signals/recompute','GET /subjects/{id}/trust','GET /claims/{id}/audit','GET /events'];
  return <section className="glass api-panel"><h2>Initial API contract</h2><p className="muted">Dashboard-ready endpoints from the spec. MVP backend can implement these directly.</p><div className="endpoint-grid">{endpoints.map((e)=><code key={e}>{e}</code>)}</div></section>;
}

export default function App() {
  const [active, setActive] = useState<Tab>('Overview');
  const content = useMemo(() => ({ Overview: <Overview />, Claims: <ClaimsPanel />, 'Review Queue': <ReviewPanel />, 'Evidence Graph': <EvidenceGraph />, Roadmap: <RoadmapPanel />, 'API Contract': <ApiPanel /> })[active], [active]);
  return <main>
    <aside className="sidebar"><div className="brand"><Cpu/><div><b>Kportussy</b><span>trust goes brrrr</span></div></div><nav>{tabs.map((tab)=><button className={active===tab?'active':''} onClick={()=>setActive(tab)} key={tab}>{tab}</button>)}</nav><footer><Activity size={16}/> live spec dashboard</footer></aside>
    <section className="content">{content}</section>
  </main>;
}
