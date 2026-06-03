import type { Claim, ClaimStatus } from './types';

export function averageTrustScore(claims: Claim[]): number {
  if (!claims.length) return 0;
  return claims.reduce((sum, claim) => sum + claim.trust.score, 0) / claims.length;
}

export function evidenceCount(claims: Claim[]): number {
  return claims.reduce((sum, claim) => sum + claim.evidence.length, 0);
}

export function verificationCoverage(claims: Claim[]): number {
  if (!claims.length) return 0;
  return claims.filter((claim) => claim.verifications.length > 0).length / claims.length;
}

export function privacyRiskCount(claims: Claim[]): number {
  return claims.flatMap((claim) => claim.evidence).filter((evidence) => evidence.sensitivity === 'restricted' || evidence.sensitivity === 'sealed').length;
}

export function statusCounts(claims: Claim[]): Record<ClaimStatus, number> {
  const statuses: ClaimStatus[] = ['draft', 'submitted', 'under_review', 'partially_verified', 'verified', 'disputed', 'rejected', 'expired', 'revoked', 'superseded'];
  return Object.fromEntries(statuses.map((status) => [status, claims.filter((claim) => claim.status === status).length])) as Record<ClaimStatus, number>;
}

export function reviewQueue(claims: Claim[]): Claim[] {
  return claims.filter((claim) => ['submitted', 'under_review', 'disputed'].includes(claim.status) || claim.risk === 'high');
}

export function antiSlopGate(claim: Claim): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (claim.evidence.length === 0) reasons.push('no evidence');
  if (claim.verifications.length === 0) reasons.push('no verification');
  if (claim.type === 'performance' && claim.trust.components.benchmarkQuality < 0.5) reasons.push('benchmark quality below threshold');
  if (claim.risk === 'high' && claim.trust.components.governanceStatus < 0.7) reasons.push('high-risk claim lacks governance clearance');
  if (claim.trust.state === 'disputed' || claim.trust.state === 'revoked') reasons.push(`trust state is ${claim.trust.state}`);
  return { pass: reasons.length === 0, reasons };
}
