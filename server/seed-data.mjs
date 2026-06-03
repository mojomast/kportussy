export const seedClaims = [
  {
    id: 'claim-hermes-review',
    subject: { id: 'hermes', name: 'Hermes Agent', type: 'agent', namespace: 'ussyverse' },
    domain: 'repo-architecture-review', type: 'capability',
    statement: 'Hermes can produce useful repository architecture reviews with evidence-backed findings and Ussyverse integration recommendations.',
    status: 'partially_verified', risk: 'medium', tags: ['agent','repo-review','subagents'],
    createdAt: '2026-06-02T22:10:00Z', nextAction: 'Replay review rubric against 5 repos and attach benchmark scores.',
    trustApplication: 'Increase routing confidence for architecture-review tasks after benchmark pass.',
    evidence: [
      { id: 'ev-kport-review', type: 'transcript_summary', relation: 'supports', summary: 'Parallel K-Port review produced architecture, security, and Ussyverse integration findings.', sourceRef: 'session:k-port-review', sensitivity: 'restricted', freshnessDays: 1 },
      { id: 'ev-human-context', type: 'human_review', relation: 'contextualizes', summary: 'Needs rubric validation before strong trust state.', sourceRef: 'manual:pending', sensitivity: 'internal', freshnessDays: 1 }
    ],
    verifications: [{ id: 'ver-manual-1', method: 'manual-review', verifier: 'mojomast/hermes', decision: 'partially_accepted', confidence: 'medium', rationale: 'Useful output exists; benchmark set not yet broad enough.' }],
    trust: { state: 'moderate', score: 0.64, confidence: 'medium', components: { evidenceStrength: 0.68, verificationStrength: 0.55, provenanceQuality: 0.72, benchmarkQuality: 0.28, recency: 0.96, contradictionPenalty: 0, governanceStatus: 0.62 } }
  },
  {
    id: 'claim-ragussy-grounding',
    subject: { id: 'ragussy', name: 'Ragussy RAG', type: 'tool', namespace: 'ussyverse' },
    domain: 'rag-grounding', type: 'quality',
    statement: 'Ragussy can rank verified/witnessed sources above stale or contradicted memory when trust metadata is available.',
    status: 'submitted', risk: 'medium', tags: ['rag','retrieval','source-trust'], createdAt: '2026-06-02T22:15:00Z',
    nextAction: 'Implement trust-weighted retrieval adapter and compare citation quality against baseline.',
    trustApplication: 'Adjust RAG ranking weights using Kportussy trust signals.',
    evidence: [{ id: 'ev-rag-design', type: 'design_spec', relation: 'supports', summary: 'Kportussy spec maps trust_state to retrieval weighting.', sourceRef: 'docs/SPEC.md#ragussy', sensitivity: 'public', freshnessDays: 1 }],
    verifications: [],
    trust: { state: 'weak', score: 0.32, confidence: 'low', components: { evidenceStrength: 0.34, verificationStrength: 0.05, provenanceQuality: 0.7, benchmarkQuality: 0, recency: 0.95, contradictionPenalty: 0, governanceStatus: 0.2 } }
  },
  {
    id: 'claim-build-cycle-promotion',
    subject: { id: 'autobuild-v1', name: 'Autonomous Build Cycle', type: 'autonomous_cycle', namespace: 'hermes' },
    domain: 'autonomous-build-quality', type: 'performance',
    statement: 'Autonomous build cycles should only promote changes when tests, benchmarks, privacy gates, and review evidence pass.',
    status: 'under_review', risk: 'high', tags: ['build-cycle','promotion','anti-slop'], createdAt: '2026-06-02T22:20:00Z',
    nextAction: 'Wire benchmark evidence adapter and Becomussy approval trigger.',
    trustApplication: 'Block feature/tool promotion until claim reaches verified or policy-approved partial state.',
    evidence: [
      { id: 'ev-roadmap', type: 'roadmap', relation: 'supports', summary: '30/60/90 roadmap defines promotion gates and benchmark evidence requirements.', sourceRef: 'docs/ROADMAP.md', sensitivity: 'public', freshnessDays: 1 },
      { id: 'ev-anti-slop', type: 'policy_spec', relation: 'supports', summary: 'Anti-slop gates require novelty and measured utility.', sourceRef: 'docs/EVALUATION.md', sensitivity: 'public', freshnessDays: 1 }
    ],
    verifications: [{ id: 'ver-policy-1', method: 'policy-engine-evaluation', verifier: 'kportussy-policy-v0', decision: 'inconclusive', confidence: 'medium', rationale: 'Policy exists in spec; executable evaluator pending.' }],
    trust: { state: 'moderate', score: 0.51, confidence: 'medium', components: { evidenceStrength: 0.61, verificationStrength: 0.34, provenanceQuality: 0.8, benchmarkQuality: 0.18, recency: 0.95, contradictionPenalty: 0, governanceStatus: 0.45 } }
  },
  {
    id: 'claim-dashboard-readiness',
    subject: { id: 'kportussy-dashboard', name: 'Kportussy Dashboard', type: 'dashboard_component', namespace: 'kportussy' },
    domain: 'dashboard-readiness', type: 'release_readiness',
    statement: 'The Kportussy dashboard makes claim queues, trust states, roadmap gates, evidence density, and privacy risks inspectable at speed.',
    status: 'draft', risk: 'low', tags: ['dashboard','clawdeck','visibility'], createdAt: '2026-06-03T02:30:00Z',
    nextAction: 'Run build/test and attach screenshots or preview evidence.',
    trustApplication: 'Expose as first-class ClawDeck/Kportussy review surface after validation.',
    evidence: [{ id: 'ev-dashboard-code', type: 'repository_commit', relation: 'supports', summary: 'Initial React/Vite dashboard implementation.', sourceRef: 'commit:0b811ef', sensitivity: 'public', freshnessDays: 0 }],
    verifications: [],
    trust: { state: 'unverified', score: 0.22, confidence: 'low', components: { evidenceStrength: 0.3, verificationStrength: 0, provenanceQuality: 0.55, benchmarkQuality: 0, recency: 1, contradictionPenalty: 0, governanceStatus: 0.1 } }
  }
];

export const seedRoadmap = [
  { id: 'm1', horizon: '30d', title: 'Claim/evidence/verification API foundation', status: 'in_progress', acceptance: 'Create/review claim end-to-end; every mutation emits audit events.' },
  { id: 'm2', horizon: '30d', title: 'Dashboard review surface', status: 'in_progress', acceptance: 'Operators can see queues, trust states, privacy risks, and next actions.' },
  { id: 'm3', horizon: '60d', title: 'Becomussy + benchmark evidence adapters', status: 'planned', acceptance: 'Approval/audit refs and benchmark JSON become evidence packages.' },
  { id: 'm4', horizon: '60d', title: 'Ragussy trust-weighted retrieval prototype', status: 'planned', acceptance: 'Answers expose verified/stale/disputed source metadata.' },
  { id: 'm5', horizon: '90d', title: 'Promotion gate v1', status: 'planned', acceptance: 'At least one real tool/feature decision cites Kportussy evidence.' },
  { id: 'm6', horizon: '90d', title: 'Dispute, expiry, and revocation workflow', status: 'planned', acceptance: 'Stale or contradicted claims degrade without deleting history.' }
];
