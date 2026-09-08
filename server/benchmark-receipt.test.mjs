import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createStore } from './store.mjs';
import { createApp } from './app.mjs';
import { benchmarkHash, canonicalJson, validateBenchmarkReceipt, BENCHMARK_VERSION } from './benchmark-receipt.mjs';

const dirs = [];
afterEach(() => dirs.splice(0).forEach(d => rmSync(d, { recursive: true, force: true })));
function fixture(direction = 'higher_is_better', candidate = [11, 13]) {
  const baseline = { id: 'baseline-v1', samples: [10, 12], sourceSha256: 'a'.repeat(64) };
  const benchmarkSpec = { metric: 'work', unit: 'operations', direction, minimumSamples: 2, baselineSha256: benchmarkHash(baseline), datasetSha256: 'c'.repeat(64) };
  const artifact = { schemaVersion: BENCHMARK_VERSION, claimId: 'bench', metric: 'work', unit: 'operations', direction, baseline,
    candidate: { id: 'candidate-v1', samples: candidate, sourceSha256: 'b'.repeat(64) },
    provenance: { runner: 'local-self-test', environment: 'private-environment', command: 'private-command-not-executed', datasetSha256: 'c'.repeat(64) } };
  const receipt = { artifact, sha256: benchmarkHash(artifact) };
  return { receipt, claim: { id: 'bench', benchmarkSpec } };
}
function setup(options = {}) {
  const f = fixture(options.direction, options.candidate);
  const dir = mkdtempSync(join(tmpdir(), 'kportussy-bench-')); dirs.push(dir);
  const path = join(dir, 'store.json'), store = createStore(path);
  store.createClaim({ ...f.claim, type: 'performance', risk: options.risk ?? 'low', subject: { id: 'local' }, domain: 'prototype', statement: 'Local benchmark only' });
  store.updateStatus('bench', 'submitted'); store.updateStatus('bench', 'under_review');
  const evidence = (receipt = f.receipt, fields = {}) => store.addEvidence('bench', { id: 'e', type: 'benchmark_result', summary: 'Local receipt', benchmarkReceipt: receipt, ...fields });
  const review = (refs = ['e']) => store.addVerification('bench', { decision: 'accepted', confidence: 'high', rationale: 'Local self review', evidenceIds: refs });
  return { ...f, store, path, evidence, review };
}
function noMutation(s, fn) {
  const before = readFileSync(s.path, 'utf8'), memory = JSON.stringify(s.store.state);
  expect(fn).toThrow(/benchmark/);
  expect(readFileSync(s.path, 'utf8')).toBe(before);
  expect(JSON.stringify(s.store.state)).toBe(memory);
}

describe('benchmark receipt contract', () => {
  it('canonical hashing is key-order independent and matches independent SHA-256', () => {
    expect(canonicalJson({ z: 2, a: [3, { b: 1, a: 0 }] })).toBe('{"a":[3,{"a":0,"b":1}],"z":2}');
    expect(benchmarkHash({ b: 2, a: 1 })).toBe(createHash('sha256').update('{"a":1,"b":2}').digest('hex'));
  });
  it.each([
    ['higher_is_better', [11, 13], true], ['higher_is_better', [9, 11], false],
    ['lower_is_better', [9, 11], true], ['lower_is_better', [11, 13], false],
    ['higher_is_better', [10, 12], true], ['lower_is_better', [10, 12], true],
  ])('compares derived means for %s %j (ties qualify)', (direction, candidate, pass) => {
    const f = fixture(direction, candidate), result = validateBenchmarkReceipt(f.receipt, f.claim);
    expect(result.valid).toBe(true); expect(result.pass).toBe(pass); expect(result.baselineMean).toBe(11);
    if (!pass) expect(result.reasons).toContain('benchmark_below_baseline');
  });
  const malformed = [
    ['missing provenance', a => { delete a.provenance; }],
    ['blank runner', a => { a.provenance.runner = ' '; }],
    ['missing dataset hash', a => { a.provenance.datasetSha256 = 'unknown'; }],
    ['different dataset', a => { a.provenance.datasetSha256 = 'd'.repeat(64); }],
    ['numeric string', a => { a.candidate.samples = ['12', 14]; }],
    ['nonfinite', a => { a.candidate.samples = [Infinity, 12]; }],
    ['empty samples', a => { a.candidate.samples = []; }],
    ['oversized samples', a => { a.candidate.samples = Array(10001).fill(12); }],
    ['untrusted aggregate', a => { a.candidate.mean = 999; }],
    ['wrong claim', a => { a.claimId = 'other'; }],
    ['wrong metric', a => { a.metric = 'different'; }],
    ['wrong unit', a => { a.unit = 'seconds'; }],
    ['flipped direction', a => { a.direction = 'lower_is_better'; }],
    ['unknown version', a => { a.schemaVersion = 'v99'; }],
    ['changed baseline', a => { a.baseline.samples = [1, 2]; }],
    ['changed baseline provenance', a => { a.baseline.sourceSha256 = 'd'.repeat(64); }],
  ];
  it.each(malformed)('rejects %s before disk/memory/audit mutation', (_, mutate) => {
    const s = setup(); mutate(s.receipt.artifact); s.receipt.sha256 = benchmarkHash(s.receipt.artifact);
    noMutation(s, () => s.evidence());
  });
  it('rejects tampering without rehashing', () => {
    const s = setup(); s.receipt.artifact.candidate.samples[0]++;
    noMutation(s, () => s.evidence());
  });
  it.each([0, 1, 2.5, '2', 10001])('rejects invalid minimumSamples %j at creation', minimumSamples => {
    const s = setup();
    noMutation(s, () => s.store.createClaim({ subject: { id: 'x' }, domain: 'x', statement: 'x', benchmarkSpec: { ...s.claim.benchmarkSpec, minimumSamples } }));
  });
  it.each(['baseline', 'candidate'])('records undersized %s runs but blocks eligibility', side => {
    const s = setup(); s.receipt.artifact[side].samples = [12];
    if (side === 'baseline') s.store.state.claims.find(c => c.id === 'bench').benchmarkSpec.baselineSha256 = benchmarkHash(s.receipt.artifact.baseline);
    s.receipt.sha256 = benchmarkHash(s.receipt.artifact); s.evidence(); s.review();
    expect(s.store.verificationGate('bench').reasons).toContain('benchmark_sample_size_insufficient');
    noMutation(s, () => s.store.updateStatus('bench', 'partially_verified'));
  });
});

describe('benchmark enforcement and history', () => {
  it('persists eligible receipt and binds its digest in audit without private provenance', () => {
    const s = setup(); s.evidence(); s.review(); s.store.updateStatus('bench', 'verified');
    const reopened = createStore(s.path);
    expect(reopened.verificationGate('bench').pass).toBe(true);
    expect(reopened.state.claims.find(c => c.id === 'bench').evidence[0].benchmarkReceipt).toEqual(s.receipt);
    expect(reopened.events().find(e => e.type === 'evidence.linked').payload.benchmark.sha256).toBe(s.receipt.sha256);
    const output = JSON.stringify([reopened.getClaim('bench'), reopened.events(), reopened.verificationGate('bench')]);
    expect(output).not.toContain('private-command'); expect(output).not.toContain('private-environment');
    const before = readFileSync(s.path, 'utf8'); reopened.verificationGate('bench'); expect(readFileSync(s.path, 'utf8')).toBe(before);
  });
  it.each(['verified', 'partially_verified'])('below-baseline evidence cannot qualify %s despite acceptance/scalars', target => {
    const s = setup({ candidate: [8, 10] }); s.evidence(); s.review();
    s.store.state.claims.find(c => c.id === 'bench').trust.components.benchmarkQuality = 1;
    s.store.recomputeTrust('bench');
    expect(s.store.getClaim('bench').trust.score).toBe(0);
    noMutation(s, () => s.store.updateStatus('bench', target));
  });
  it.each(['supports', 'contextualizes', 'supersedes'])('later below-baseline %s receipt disputes approval and cannot be cherry-picked away', relation => {
    const s = setup(); s.evidence(); s.review(); s.store.updateStatus('bench', 'verified');
    const oldEvents = structuredClone(s.store.state.events);
    const bad = fixture('higher_is_better', [8, 9]).receipt;
    s.evidence(bad, { id: 'bad', relation }); s.review(relation === 'supports' ? ['e', 'bad'] : ['e']);
    expect(s.store.getClaim('bench').status).toBe('disputed');
    expect(s.store.getClaim('bench').trust.score).toBe(0);
    expect(s.store.verificationGate('bench').reasons).toContain('benchmark_below_baseline');
    expect(s.store.state.events.slice(0, oldEvents.length)).toEqual(oldEvents);
    expect(s.store.getClaim('bench').evidence).toHaveLength(2);
    noMutation(s, () => s.store.updateStatus('bench', 'verified'));
  });
  it('retains independent high-risk block with passing benchmarks', () => {
    const s = setup({ risk: 'high' }); s.evidence(); s.review();
    expect(s.store.verificationGate('bench').reasons).toEqual(['governance_clearance_not_implemented']);
  });
  it('does not let relabeling a benchmark as a document or quality claim bypass its result', () => {
    const s = setup({ candidate: [8, 9] }); s.store.state.claims.find(c => c.id === 'bench').type = 'quality';
    s.evidence(s.receipt, { type: 'document' }); s.review();
    expect(s.store.verificationGate('bench').reasons).toContain('benchmark_below_baseline');
  });
  it('revalidates loaded receipts instead of trusting cached pass/score', () => {
    const s = setup(); s.evidence(); s.review();
    const c = s.store.state.claims.find(c => c.id === 'bench');
    c.evidence[0].benchmarkReceipt.artifact.candidate.samples[0] = 100;
    expect(s.store.verificationGate('bench').reasons).toContain('benchmark_digest_mismatch');
    delete c.evidence[0].benchmarkReceipt;
    expect(s.store.verificationGate('bench').reasons).toContain('benchmark_receipt_invalid');
    delete c.benchmarkSpec;
    expect(s.store.verificationGate('bench').reasons).toContain('benchmark_spec_required');
  });
  it('enforces benchmark checks through the shared HTTP store', async () => {
    const s = setup({ candidate: [8, 10] }); const app = createApp(s.store);
    const post = (route, body) => app(new Request(`http://local/api/claims/bench/${route}`, { method: 'POST', body: JSON.stringify(body) }));
    const malformed = await post('evidence-links', { summary: 'bad', type: 'benchmark_result' });
    expect(malformed.status).toBe(400);
    s.evidence(); s.review();
    const response = await post('status', { status: 'verified' });
    expect(response.status).toBe(400); expect((await response.json()).error).toContain('benchmark_below_baseline');
  });
});
