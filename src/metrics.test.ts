import { describe, expect, it } from 'vitest';
import { claims } from './data';
import { antiSlopGate, averageTrustScore, evidenceCount, privacyRiskCount, reviewQueue, statusCounts, verificationCoverage } from './metrics';

describe('kportussy dashboard metrics', () => {
  it('computes trust and evidence metrics', () => {
    expect(claims.length).toBeGreaterThanOrEqual(4);
    expect(averageTrustScore(claims)).toBeGreaterThan(0);
    expect(evidenceCount(claims)).toBeGreaterThan(claims.length - 1);
    expect(verificationCoverage(claims)).toBeGreaterThan(0);
    expect(privacyRiskCount(claims)).toBeGreaterThan(0);
  });

  it('builds a review queue and status counts', () => {
    const counts = statusCounts(claims);
    expect(counts.submitted + counts.under_review + counts.partially_verified + counts.draft).toBe(claims.length);
    expect(reviewQueue(claims).some((claim) => claim.risk === 'high')).toBe(true);
  });

  it('blocks under-evidenced anti-slop claims', () => {
    const performanceClaim = claims.find((claim) => claim.type === 'performance');
    expect(performanceClaim).toBeDefined();
    const gate = antiSlopGate(performanceClaim!);
    expect(gate.pass).toBe(false);
    expect(gate.reasons.join(' ')).toContain('benchmark');
  });
});
