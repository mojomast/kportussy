// Isolated CLI end-to-end receipt exercise. Never starts a service or uses the default DB.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { benchmarkHash, BENCHMARK_VERSION, validateBenchmarkReceipt } from '../server/benchmark-receipt.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = join(root, 'artifacts/eval'); mkdirSync(base, { recursive: true });
const artifactDir = mkdtempSync(join(base, 'benchmark-receipt-'));
const db = join(artifactDir, 'store.json');
const sha = x => createHash('sha256').update(x).digest('hex');
const save = (name, x) => writeFileSync(join(artifactDir, name), JSON.stringify(x, null, 2));
const testsPath = join(artifactDir, 'tests.json');
const tests = spawnSync('npm', ['test', '--', '--reporter=json', `--outputFile=${testsPath}`], { cwd: root, encoding: 'utf8' });
writeFileSync(join(artifactDir, 'tests.log'), `${tests.stdout}\n${tests.stderr}`);
assert.equal(tests.status, 0, `Test failure: ${artifactDir}`);
const testsBytes = readFileSync(testsPath), testsReport = JSON.parse(testsBytes);
assert.equal(testsReport.success, true);
const workload = () => {
  const result = spawnSync(process.execPath, ['scripts/benchmark-workload.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};
const measured = workload(), repeated = workload();
assert.deepEqual(measured, repeated, 'Deterministic workload did not reproduce');
save('workload-run-1.json', measured); save('workload-run-2.json', repeated);
const claimId = 'claim-local-search-work';
const benchmarkSpec = { metric: 'search_work', unit: 'element_probes', direction: 'lower_is_better', minimumSamples: 6, baselineSha256: benchmarkHash(measured.baseline), datasetSha256: measured.datasetSha256 };
const artifact = { schemaVersion: BENCHMARK_VERSION, claimId, metric: benchmarkSpec.metric, unit: benchmarkSpec.unit, direction: benchmarkSpec.direction,
  baseline: measured.baseline, candidate: measured.candidate,
  provenance: { runner: 'local-self-test', environment: `Node ${process.version}; ${process.platform}/${process.arch}`, command: 'node scripts/benchmark-workload.mjs', datasetSha256: measured.datasetSha256 } };
const receipt = { artifact, sha256: benchmarkHash(artifact) };
save('receipt.json', receipt);
const steps = [];
function cli(args, expected = 0) {
  const result = spawnSync(process.execPath, ['server/cli.mjs', ...args], { cwd: root, env: { ...process.env, KPORTUSSY_DB_PATH: db }, encoding: 'utf8' });
  steps.push({ command: args[0], exitCode: result.status, stdout: result.stdout, stderr: result.stderr });
  save('cli-transcript.json', steps);
  assert.equal(result.status, expected, `${args[0]}: ${result.stderr}`);
  return expected === 1 ? result.stderr : JSON.parse(result.stdout);
}
const json = JSON.stringify;
cli(['health']);
const initialEvents = JSON.parse(readFileSync(db)).events;
cli(['create-claim', json({ id: claimId, type: 'performance', risk: 'low', subject: { id: 'local-search', type: 'tool' }, domain: 'local-work-benchmark', statement: 'Binary search uses no more mean element probes than linear search on the six declared queries over pre-sorted integers. Setup cost and elapsed time are excluded.', benchmarkSpec, actorId: 'local-self-test' })]);
cli(['set-status', claimId, 'submitted']); cli(['set-status', claimId, 'under_review']);
const evidence = (benchmarkReceipt, fields = {}) => json({ id: 'measured', type: 'benchmark_result', relation: 'supports', summary: 'Actual deterministic local search work receipt', sensitivity: 'restricted', sourceRef: join(artifactDir, 'receipt.json'), benchmarkReceipt, ...fields });
const tampered = structuredClone(receipt); tampered.artifact.candidate.samples[0]++;
const beforeMalformed = readFileSync(db, 'utf8');
assert.match(cli(['add-evidence', claimId, evidence(tampered)], 1), /benchmark_digest_mismatch/);
assert.equal(readFileSync(db, 'utf8'), beforeMalformed);
cli(['add-evidence', claimId, evidence(receipt)]);
const review = () => cli(['add-verification', claimId, json({ decision: 'accepted', confidence: 'medium', rationale: 'Local self-review of deterministic work counts, not independent adoption approval.', evidenceIds: ['measured'], actorId: 'local-self-test' })]);
review();
const beforeGate = readFileSync(db, 'utf8');
const acceptedGate = cli(['verification-gate', claimId]);
assert.equal(acceptedGate.pass, true); assert.equal(readFileSync(db, 'utf8'), beforeGate);
assert.equal(cli(['set-status', claimId, 'verified']).status, 'verified');
assert.equal(cli(['claim', claimId]).status, 'verified');
// Explicit synthetic regression control, never represented as measured performance.
const negative = structuredClone(receipt);
negative.artifact.candidate.id = 'synthetic-regression-control';
negative.artifact.candidate.samples = measured.baseline.samples.map(x => x + 1);
negative.sha256 = benchmarkHash(negative.artifact); save('synthetic-regression-receipt.json', negative);
const disputed = cli(['add-evidence', claimId, evidence(negative, { id: 'negative-control', relation: 'contextualizes', summary: 'Synthetic below-baseline policy control, not a measured search result' })]);
assert.equal(disputed.status, 'disputed'); assert.equal(disputed.trust.score, 0);
review(); // A fresh accepted review of good support cannot erase a contextual regression.
const blockedGates = [];
for (const target of ['verified', 'partially_verified']) {
  const before = readFileSync(db, 'utf8');
  const gate = cli(['verification-gate', claimId, target], 2); blockedGates.push(gate);
  assert.deepEqual(gate.reasons, ['benchmark_below_baseline']);
  assert.match(cli(['set-status', claimId, target], 1), /benchmark_below_baseline/);
  assert.equal(readFileSync(db, 'utf8'), before);
}
const revoked = cli(['set-status', claimId, 'revoked']);
assert.equal(revoked.evidence.length, 2); assert.equal(revoked.verifications.length, 2);
const state = JSON.parse(readFileSync(db)), events = state.events;
assert.deepEqual(events.slice(0, initialEvents.length), initialEvents);
assert.deepEqual(events.slice(initialEvents.length).map(e => e.type), ['claim.created', 'claim.status_changed', 'claim.status_changed', 'evidence.linked', 'verification.created', 'claim.status_changed', 'evidence.linked', 'claim.status_changed', 'verification.created', 'claim.status_changed']);
let previousHash;
for (const { eventHash, ...event } of events) {
  assert.equal(event.previousHash, previousHash);
  assert.equal(eventHash, sha(JSON.stringify({ ...event, previousHash: previousHash ?? null })));
  previousHash = eventHash;
}
const saved = state.claims.find(c => c.id === claimId);
assert.deepEqual(saved.evidence[0].benchmarkReceipt, receipt);
const output = JSON.stringify({ events, revoked, disputed, acceptedGate, blockedGates });
assert.ok(!output.includes(artifact.provenance.command)); assert.ok(!output.includes(join(artifactDir, 'receipt.json')));
const report = { passed: true, artifactDir, policyVersion: acceptedGate.policyVersion,
  tests: { passed: testsReport.numPassedTests, failed: testsReport.numFailedTests, sha256: sha(testsBytes) },
  measured: validateBenchmarkReceipt(receipt, { id: claimId, benchmarkSpec }), deterministicRerunIdentical: true,
  acceptedGate, blockedGates, malformedNoMutation: true, blockedPromotionNoMutation: true,
  auditPrefixPreserved: true, auditHashChainValid: true, restrictedProvenanceRedacted: true,
  cliProcessCount: steps.length, mutationCount: events.length - initialEvents.length, finalStatus: revoked.status,
  limitations: ['Actual deterministic operation counts, not elapsed-time performance or general utility.', 'Below-baseline receipt is an explicitly synthetic negative control.', 'Hashes establish internal consistency, not trusted provenance or independent execution.', 'Baseline choice, sample sufficiency, statistical method and adoption authority require independent approval.', 'Legacy migration, high-risk governance, authentication, replay and transaction safety remain blocked.'] };
save('report.json', report); console.log(JSON.stringify(report, null, 2));
