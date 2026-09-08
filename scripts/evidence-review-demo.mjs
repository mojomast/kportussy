// Real local CLI processes and test receipts; no HTTP server or external service.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = join(root, 'artifacts', 'eval');
mkdirSync(base, { recursive: true });
const artifact = mkdtempSync(join(base, 'evidence-review-'));
const db = join(artifact, 'store.json');
const hash = value => createHash('sha256').update(value).digest('hex');
const testsPath = join(artifact, 'tests.json');
const tests = spawnSync('npm', ['test', '--', '--reporter=json', `--outputFile=${testsPath}`], { cwd: root, encoding: 'utf8' });
writeFileSync(join(artifact, 'tests.log'), `${tests.stdout ?? ''}\n${tests.stderr ?? ''}`);
assert.equal(tests.status, 0, `Tests failed; inspect ${artifact}`);
const testsBytes = readFileSync(testsPath);
const testsReport = JSON.parse(testsBytes);
assert.equal(testsReport.success, true);
const steps = [];
function cli(args, expected = 0) {
  const result = spawnSync(process.execPath, ['server/cli.mjs', ...args], { cwd: root, env: { ...process.env, KPORTUSSY_DB_PATH: db }, encoding: 'utf8' });
  steps.push({ command: args[0], exitCode: result.status, stdout: result.stdout, stderr: result.stderr });
  writeFileSync(join(artifact, 'cli-transcript.json'), JSON.stringify(steps, null, 2));
  assert.equal(result.status, expected, `${args[0]}: ${result.stderr}`);
  return expected === 1 ? result.stderr : JSON.parse(result.stdout);
}
const payload = value => JSON.stringify({ actorId: 'local-self-test', ...value });
cli(['health']);
const initialEvents = JSON.parse(readFileSync(db)).events.length;
const id = 'claim-local-evidence-bound-review';
cli(['create-claim', payload({ id, subject: { id: 'kportussy-cli', type: 'tool', name: 'Kportussy CLI' }, type: 'quality', risk: 'low', domain: 'repository-quality', statement: 'This local CLI run rejects rejected reviews and persists evidence-bound accepted review transitions.', trustApplication: 'Local implementation review only; not production promotion.' })]);
cli(['set-status', id, 'submitted', 'local-self-test']);
cli(['set-status', id, 'under_review', 'local-self-test']);
cli(['add-evidence', id, payload({ id: 'test-receipt', type: 'test_result', summary: 'Actual test run receipt; scoped to this checkout and environment.', relation: 'supports', sensitivity: 'restricted', sourceRef: testsPath, contentHash: hash(testsBytes) })]);
cli(['add-verification', id, payload({ decision: 'rejected', confidence: 'high', evidenceIds: ['test-receipt'], rationale: 'Intentional negative-control review, not a claim that the test suite failed.' })]);
const rejectedGate = cli(['verification-gate', id], 2);
assert.deepEqual(rejectedGate.reasons, ['latest_decision_insufficient']);
const beforeBlocked = readFileSync(db, 'utf8');
assert.match(cli(['set-status', id, 'verified'], 1), /latest_decision_insufficient/);
assert.equal(readFileSync(db, 'utf8'), beforeBlocked);
cli(['add-verification', id, payload({ decision: 'accepted', confidence: 'medium', evidenceIds: ['test-receipt'], method: 'test-suite-execution', rationale: `Local self-test: ${testsReport.numPassedTests} tests passed. This is not independent review or measured ecosystem utility.` })]);
const acceptedGate = cli(['verification-gate', id]);
assert.equal(acceptedGate.pass, true);
const verified = cli(['set-status', id, 'verified', 'local-self-test']);
assert.equal(verified.status, 'verified');
assert.equal(cli(['claim', id]).status, 'verified'); // Separate process reloads disk.
// Deliberately injected negative evidence tests reversibility, not a real defect report.
const disputed = cli(['add-evidence', id, payload({ id: 'negative-control', type: 'human_attestation', summary: 'Synthetic contradiction control used only to exercise automatic dispute.', relation: 'contradicts', sensitivity: 'public', sourceRef: 'local-test-fixture:contradiction' })]);
assert.equal(disputed.status, 'disputed');
assert.equal(disputed.trust.score, 0);
const contradictedGate = cli(['verification-gate', id], 2);
assert.ok(contradictedGate.reasons.includes('adverse_evidence_unresolved'));
const revoked = cli(['set-status', id, 'revoked', 'local-self-test']);
assert.equal(revoked.status, 'revoked');
assert.equal(revoked.verifications.length, 2);
const events = JSON.parse(readFileSync(db)).events;
const mutationTypes = events.slice(initialEvents).map(e => e.type);
assert.deepEqual(mutationTypes, ['claim.created', 'claim.status_changed', 'claim.status_changed', 'evidence.linked', 'verification.created', 'verification.created', 'claim.status_changed', 'evidence.linked', 'claim.status_changed', 'claim.status_changed']);
let previousHash;
for (const { eventHash, ...event } of events) {
  assert.equal(event.previousHash, previousHash);
  assert.equal(eventHash, hash(JSON.stringify({ ...event, previousHash: previousHash ?? null })));
  previousHash = eventHash;
}
const privacyOutput = JSON.stringify({ verified, disputed, revoked, gate: acceptedGate, events });
assert.ok(!privacyOutput.includes(testsPath), 'Restricted source reference leaked');
const limitations = [
  'Local self-test, not independent verification, measured novelty, or ecosystem utility.',
  'Negative review and contradiction are explicitly synthetic policy controls; test results are real.',
  'Hash-chain integrity was checked; full event replay and multi-writer atomicity are not implemented.',
  'Restricted source-reference redaction was checked, not comprehensive privacy certification.',
  'High-risk governance, independent benchmark policy/provenance approval, expiry, dispute resolution and legacy data migration remain separate gates.',
];
const report = { slice: 'evidence-bound-review-v1', artifact, passed: true, tests: { passed: testsReport.numPassedTests, failed: testsReport.numFailedTests, sha256: hash(testsBytes) }, rejectedGate, acceptedGate, contradictedGate, finalStatus: revoked.status, mutationCount: mutationTypes.length, auditHashChainValid: true, restrictedSourceReferenceLeaked: false, cliProcessCount: steps.length, limitations };
writeFileSync(join(artifact, 'report.json'), JSON.stringify(report, null, 2));
writeFileSync(join(artifact, 'report.md'), `# Evidence-bound review local run\n\nPassed: ${report.passed}\nTests: ${report.tests.passed} passed, ${report.tests.failed} failed\nCLI processes: ${steps.length}\nMutation audit events: ${mutationTypes.length}\nFinal status: ${revoked.status}\n\nRejected review blocked; accepted evidence-bound review persisted; contradiction disputed; revocation retained history.\n\n## Limitations\n${limitations.map(x => `- ${x}`).join('\n')}\n`);
console.log(JSON.stringify(report, null, 2));
