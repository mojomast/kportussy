import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from './store.mjs';
import { createApp } from './app.mjs';
import { requireTransition, verificationGate, VOCABULARY } from './verification-policy.mjs';

const dirs = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function setup(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'kportussy-review-')); dirs.push(dir);
  const path = join(dir, 'db.json');
  const store = createStore(path);
  const claim = store.createClaim({ id: 'test-claim', subject: { id: 'test-tool', type: 'tool' }, domain: 'repository-quality', type: 'quality', risk: 'low', statement: 'A specific test result supports this scoped claim.', ...overrides });
  store.updateStatus(claim.id, 'submitted'); store.updateStatus(claim.id, 'under_review');
  const evidence = (overrides = {}) => store.addEvidence(claim.id, { id: 'receipt', type: 'test_result', summary: 'Test receipt', sensitivity: 'restricted', sourceRef: '/private/receipt', ...overrides });
  const review = (overrides = {}) => store.addVerification(claim.id, { decision: 'accepted', confidence: 'high', rationale: 'Reviewed the test receipt, not universal utility.', evidenceIds: ['receipt'], ...overrides });
  return { store, path, id: claim.id, evidence, review };
}
function unchangedOnFailure(store, path, fn, message) {
  const before = readFileSync(path, 'utf8');
  const state = JSON.stringify(store.state);
  expect(fn).toThrow(message);
  expect(readFileSync(path, 'utf8')).toBe(before);
  expect(JSON.stringify(store.state)).toBe(state);
}

describe('evidence-bound verification', () => {
  it('requires supporting evidence and a review; record counts are not clearance', () => {
    const { store, id, review, path } = setup();
    review({ evidenceIds: [] });
    expect(store.verificationGate(id).reasons).toEqual(['supporting_evidence_required', 'review_evidence_required']);
    unchangedOnFailure(store, path, () => store.updateStatus(id, 'verified'), 'verification blocked');
    expect(store.getClaim(id).trust.score).toBe(0);
  });

  it.each(['rejected', 'inconclusive', 'disputed', 'partially_accepted'])('does not turn %s into verified', decision => {
    const { store, id, evidence, review, path } = setup(); evidence(); review({ decision });
    unchangedOnFailure(store, path, () => store.updateStatus(id, 'verified'), 'latest_decision_insufficient');
    if (decision !== 'partially_accepted') expect(store.getClaim(id).trust.score).toBe(0);
  });

  it('allows partial acceptance only for the partial target', () => {
    const { store, id, evidence, review } = setup(); evidence(); review({ decision: 'partially_accepted' });
    expect(store.verificationGate(id, 'partially_verified').pass).toBe(true);
    expect(store.updateStatus(id, 'partially_verified').status).toBe('partially_verified');
  });

  it('requires explicit references and persists them in the review and audit event', () => {
    const { store, id, evidence, review, path } = setup(); evidence(); review({ evidenceIds: [] });
    expect(store.verificationGate(id).reasons).toContain('review_evidence_required');
    review(); store.updateStatus(id, 'verified', 'reviewer');
    const reopened = createStore(path);
    expect(reopened.getClaim(id).status).toBe('verified');
    expect(reopened.verificationGate(id).pass).toBe(true);
    const event = reopened.events().find(e => e.type === 'verification.created');
    expect(event.payload.evidenceIds).toEqual(['receipt']);
    expect(JSON.stringify(event)).not.toContain('/private/receipt');
  });

  it.each(['contextualizes', 'supersedes', 'contradicts', 'invalidates'])('%s alone is not supporting evidence', relation => {
    const { store, id, evidence, review } = setup(); evidence({ relation }); review();
    expect(store.verificationGate(id).reasons).toContain('supporting_evidence_required');
  });

  it.each(['contradicts', 'invalidates'])('unresolved %s blocks acceptance and automatically disputes prior approval', relation => {
    const { store, id, evidence, review } = setup(); evidence(); review(); store.updateStatus(id, 'verified');
    evidence({ id: 'negative', relation });
    expect(store.getClaim(id).status).toBe('disputed');
    expect(store.getClaim(id).trust.score).toBe(0);
    review({ evidenceIds: ['receipt', 'negative'] });
    expect(store.verificationGate(id).reasons).toContain('adverse_evidence_unresolved');
    expect(store.events()[1].payload).toMatchObject({ from: 'verified', to: 'disputed', reasons: ['adverse_evidence_unresolved'] });
  });

  it('new support invalidates old coverage; a fresh review can restore eligibility', () => {
    const { store, id, evidence, review } = setup(); evidence(); review(); store.updateStatus(id, 'verified');
    evidence({ id: 'new-support' });
    expect(store.getClaim(id).status).toBe('disputed');
    expect(store.verificationGate(id).reasons).toContain('supporting_evidence_not_reviewed');
    review({ evidenceIds: ['receipt', 'new-support'] });
    expect(store.updateStatus(id, 'verified').status).toBe('verified');
  });

  it('context-only additions do not silently invalidate an otherwise complete review', () => {
    const { store, id, evidence, review } = setup(); evidence(); review(); store.updateStatus(id, 'verified');
    evidence({ id: 'context', relation: 'contextualizes' });
    expect(store.getClaim(id).status).toBe('verified');
  });

  it('uses latest review rather than cherry-picking an old accepted decision', () => {
    const { store, id, evidence, review } = setup(); evidence(); review(); store.updateStatus(id, 'verified');
    review({ decision: 'rejected' });
    expect(store.getClaim(id).status).toBe('disputed');
    expect(store.verificationGate(id).reasons).toContain('latest_decision_insufficient');
    expect(store.getClaim(id).verifications).toHaveLength(2);
  });

  it.each([null, 'receipt', ['missing'], ['receipt', 'receipt']])('rejects invalid evidence reference payload %j without mutation', evidenceIds => {
    const { store, evidence, review, path } = setup(); evidence();
    // null means omitted, and is recorded as an explicitly unbound review.
    if (evidenceIds === null) { review({ evidenceIds }); expect(store.getClaim('test-claim').verifications.at(-1).evidenceIds).toEqual([]); }
    else unchangedOnFailure(store, path, () => review({ evidenceIds }), /evidence/);
  });

  it('rejects references to another claim even when the evidence exists there', () => {
    const { store, path, review } = setup();
    const other = store.createClaim({ subject: { id: 'other' }, domain: 'quality', statement: 'Other claim' });
    store.addEvidence(other.id, { id: 'receipt', summary: 'Other claim receipt' });
    unchangedOnFailure(store, path, review, 'linked to this claim');
  });

  it.each([{ risk: 'high' }, { type: 'performance' }])('numeric score components cannot satisfy missing policy for %j', overrides => {
    const { store, id, evidence, review } = setup(overrides); evidence(); review();
    const c = store.state.claims.find(c => c.id === id);
    c.trust.components.governanceStatus = 1; c.trust.components.benchmarkQuality = 1;
    expect(store.verificationGate(id).pass).toBe(false);
    expect(store.recomputeTrust(id).trust.score).toBe(0);
  });

  it('fails closed on legacy reviews without evidenceIds', () => {
    const c = { type: 'quality', risk: 'low', evidence: [{ id: 'a', relation: 'supports' }], verifications: [{ id: 'v', decision: 'accepted' }] };
    expect(verificationGate(c).reasons).toEqual(['review_evidence_required']);
    c.verifications[0].evidenceIds = ['ghost'];
    expect(verificationGate(c).reasons).toContain('review_evidence_not_linked');
  });

  it('rejects duplicate evidence/verification/claim IDs without mutation', () => {
    const { store, evidence, review, path } = setup(); evidence(); review({ id: 'v' });
    unchangedOnFailure(store, path, evidence, 'duplicate evidence');
    unchangedOnFailure(store, path, () => review({ id: 'v' }), 'duplicate verification');
    unchangedOnFailure(store, path, () => store.createClaim({ id: 'test-claim', subject: { id: 's' }, domain: 'd', statement: 's' }), 'duplicate claim');
  });

  it.each([{ decision: 'approved' }, { confidence: 'certain' }, { rationale: '  ' }])('rejects invalid review vocabulary/content %j without mutation', fields => {
    const { store, evidence, review, path } = setup(); evidence();
    unchangedOnFailure(store, path, () => review(fields), /invalid|required/);
  });

  it.each(['endorses', ''])('rejects invalid evidence relation %j without mutation', relation => {
    const { store, evidence, path } = setup();
    unchangedOnFailure(store, path, () => evidence({ relation }), 'invalid relation');
  });

  it.each([{ risk: 'HIGH' }, { type: 'Performance' }])('rejects unbounded claim policy vocabulary %j', fields => {
    const { store, path } = setup();
    unchangedOnFailure(store, path, () => store.createClaim({ subject: { id: 's' }, domain: 'd', statement: 's', ...fields }), 'invalid');
  });
});

describe('bounded lifecycle', () => {
  const allowed = new Set(['draft:submitted', 'submitted:under_review', 'under_review:partially_verified', 'under_review:verified', 'under_review:rejected', 'under_review:disputed', 'partially_verified:disputed', 'partially_verified:expired', 'partially_verified:revoked', 'verified:disputed', 'verified:expired', 'verified:revoked', 'disputed:under_review', 'disputed:rejected', 'disputed:partially_verified', 'disputed:verified', 'disputed:revoked']);
  it('checks every pair of bounded statuses; unsupported supersession remains closed', () => {
    for (const from of VOCABULARY.status) for (const to of VOCABULARY.status) {
      const run = () => requireTransition(from, to);
      if (allowed.has(`${from}:${to}`)) expect(run).not.toThrow(); else expect(run).toThrow('invalid claim transition');
    }
  });
  it('blocks unknown status and lifecycle shortcuts with no audit or disk mutation', () => {
    const { store, id, path, evidence, review } = setup(); evidence(); review();
    unchangedOnFailure(store, path, () => store.updateStatus(id, 'trusted'), 'invalid status');
    unchangedOnFailure(store, path, () => store.updateStatus(id, 'draft'), 'invalid claim transition');
    store.updateStatus(id, 'verified'); store.updateStatus(id, 'revoked');
    unchangedOnFailure(store, path, () => store.updateStatus(id, 'verified'), 'invalid claim transition');
    expect(store.getClaim(id).trust.score).toBe(0);
  });
  it('enforces the same evidence-bound gate over HTTP', async () => {
    const { store, id, evidence, review } = setup(); evidence(); review({ decision: 'rejected' });
    const app = createApp(store);
    const request = () => app(new Request(`http://local/api/claims/${id}/status`, { method: 'POST', body: JSON.stringify({ status: 'verified' }) }));
    const blocked = await request(); expect(blocked.status).toBe(400);
    expect((await blocked.json()).error).toContain('latest_decision_insufficient');
    review(); const accepted = await request(); expect(accepted.status).toBe(200);
    expect((await accepted.json()).status).toBe('verified');
  });
});
