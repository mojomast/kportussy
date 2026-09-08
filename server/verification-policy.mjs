// Verification policy is authoritative in the store, not a UI score threshold.
import { benchmarkGate } from './benchmark-receipt.mjs';
export const POLICY_VERSION = 'evidence-bound-review-v2';
export const VOCABULARY = Object.freeze({
  status: ['draft', 'submitted', 'under_review', 'partially_verified', 'verified', 'disputed', 'rejected', 'expired', 'revoked', 'superseded'],
  decision: ['accepted', 'partially_accepted', 'rejected', 'inconclusive', 'disputed'],
  confidence: ['low', 'medium', 'high'],
  relation: ['supports', 'contradicts', 'contextualizes', 'invalidates', 'supersedes'],
  risk: ['low', 'medium', 'high'],
  claimType: ['capability', 'quality', 'performance', 'compliance', 'provenance', 'identity', 'release_readiness', 'novelty'],
});

const transitions = {
  draft: ['submitted'],
  submitted: ['under_review'],
  under_review: ['partially_verified', 'verified', 'rejected', 'disputed'],
  partially_verified: ['disputed', 'expired', 'revoked'],
  verified: ['disputed', 'expired', 'revoked'],
  disputed: ['under_review', 'rejected', 'partially_verified', 'verified', 'revoked'],
  rejected: [], expired: [], revoked: [], superseded: [],
};

export function requireTerm(kind, value) {
  if (!VOCABULARY[kind].includes(value)) throw new Error(`invalid ${kind}: expected ${VOCABULARY[kind].join(' | ')}`);
}

export function allowedTransitions(from) { return [...(transitions[from] ?? [])]; }

export function requireTransition(from, to) {
  requireTerm('status', to);
  if (!transitions[from]?.includes(to)) throw new Error(`invalid claim transition: ${from} -> ${to}`);
}

// Ordered, bounded reason codes; no user-supplied summaries or source references.
export function verificationGate(claim, target = 'verified') {
  if (!['verified', 'partially_verified'].includes(target)) throw new Error('invalid verification target');
  const reasons = [];
  const evidence = claim.evidence ?? [];
  const supporting = evidence.filter(e => e.relation === 'supports');
  const review = claim.verifications?.at(-1); // Ledger order, never caller timestamps.
  if (!VOCABULARY.risk.includes(claim.risk) || !VOCABULARY.claimType.includes(claim.type) || evidence.some(e => !VOCABULARY.relation.includes(e.relation))) reasons.push('invalid_policy_vocabulary');
  if (!supporting.length) reasons.push('supporting_evidence_required');
  if (evidence.some(e => ['contradicts', 'invalidates'].includes(e.relation))) reasons.push('adverse_evidence_unresolved');
  if (!review) reasons.push('verification_required');
  else {
    const decisions = target === 'verified' ? ['accepted'] : ['accepted', 'partially_accepted'];
    if (!decisions.includes(review.decision)) reasons.push('latest_decision_insufficient');
    const refs = review.evidenceIds;
    if (!Array.isArray(refs) || !refs.length) reasons.push('review_evidence_required');
    else {
      if (refs.some(id => !evidence.some(e => e.id === id))) reasons.push('review_evidence_not_linked');
      if (supporting.some(e => !refs.includes(e.id))) reasons.push('supporting_evidence_not_reviewed');
    }
  }
  // Numeric projections are NOT approval records or benchmark measurements.
  if (claim.risk === 'high') reasons.push('governance_clearance_not_implemented');
  reasons.push(...benchmarkGate(claim));
  return { policyVersion: POLICY_VERSION, target, pass: reasons.length === 0, reasons, verificationId: review?.id ?? null };
}
