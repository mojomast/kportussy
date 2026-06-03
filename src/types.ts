export type SubjectType = 'agent' | 'tool' | 'memory' | 'rag_source' | 'dashboard_component' | 'autonomous_cycle' | 'service';
export type ClaimStatus = 'draft' | 'submitted' | 'under_review' | 'partially_verified' | 'verified' | 'disputed' | 'rejected' | 'expired' | 'revoked' | 'superseded';
export type TrustState = 'unverified' | 'weak' | 'moderate' | 'strong' | 'disputed' | 'expired' | 'revoked';
export type EvidenceRelation = 'supports' | 'contradicts' | 'contextualizes' | 'invalidates' | 'supersedes';

export interface Subject {
  id: string;
  name: string;
  type: SubjectType;
  namespace: string;
}

export interface EvidenceItem {
  id: string;
  type: string;
  relation: EvidenceRelation;
  summary: string;
  sourceRef: string;
  sensitivity: 'public' | 'internal' | 'restricted' | 'sealed';
  freshnessDays: number;
}

export interface Verification {
  id: string;
  method: string;
  verifier: string;
  decision: 'accepted' | 'partially_accepted' | 'rejected' | 'inconclusive' | 'disputed';
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
}

export interface TrustSignal {
  state: TrustState;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  components: {
    evidenceStrength: number;
    verificationStrength: number;
    provenanceQuality: number;
    benchmarkQuality: number;
    recency: number;
    contradictionPenalty: number;
    governanceStatus: number;
  };
}

export interface Claim {
  id: string;
  subject: Subject;
  domain: string;
  type: string;
  statement: string;
  status: ClaimStatus;
  risk: 'low' | 'medium' | 'high';
  tags: string[];
  createdAt: string;
  nextAction: string;
  evidence: EvidenceItem[];
  verifications: Verification[];
  trust: TrustSignal;
  trustApplication: string;
}

export interface RoadmapMilestone {
  id: string;
  horizon: '30d' | '60d' | '90d';
  title: string;
  status: 'planned' | 'in_progress' | 'blocked' | 'done';
  acceptance: string;
}
