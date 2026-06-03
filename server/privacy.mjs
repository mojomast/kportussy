export function redactEvidence(evidence){
  const base={ id:evidence.id, type:evidence.type, relation:evidence.relation, summary:evidence.summary, sensitivity:evidence.sensitivity ?? 'restricted', freshnessDays:evidence.freshnessDays ?? 0 };
  if(base.sensitivity === 'sealed') return { ...base, summary: 'Sealed evidence available to authorized stewards only.', sourceRef: 'sealed_reference' };
  if(base.sensitivity === 'restricted') return { ...base, sourceRef: evidence.sourceRef ? 'restricted_reference' : undefined };
  return { ...base, sourceRef:evidence.sourceRef, contentHash:evidence.contentHash };
}
export function redactClaim(claim){ return { ...claim, evidence: (claim.evidence ?? []).map(redactEvidence) }; }
