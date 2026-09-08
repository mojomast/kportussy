import { createHash } from 'node:crypto';

export const BENCHMARK_VERSION = 'benchmark-receipt-v1';
const text = x => typeof x === 'string' && x.trim().length > 0 && x.length <= 4096;
const digest = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const keys = (x, expected) => object(x) && Object.keys(x).sort().join(',') === [...expected].sort().join(',');
// Canonical JSON: recursively sorted object keys, ordered arrays, JSON numbers.
export function canonicalJson(x) {
  if (Array.isArray(x)) return `[${x.map(canonicalJson).join(',')}]`;
  if (object(x)) return `{${Object.keys(x).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(x[k])}`).join(',')}}`;
  return JSON.stringify(x);
}
export const benchmarkHash = x => createHash('sha256').update(canonicalJson(x)).digest('hex');

export function validBenchmarkSpec(s) {
  return keys(s, ['metric', 'unit', 'direction', 'minimumSamples', 'baselineSha256', 'datasetSha256']) &&
    text(s.metric) && text(s.unit) && ['higher_is_better', 'lower_is_better'].includes(s.direction) &&
    Number.isSafeInteger(s.minimumSamples) && s.minimumSamples >= 2 && s.minimumSamples <= 10000 && digest(s.baselineSha256) && digest(s.datasetSha256);
}
const samples = x => Array.isArray(x) && x.length >= 1 && x.length <= 10000 && x.every(Number.isFinite);
const run = x => keys(x, ['id', 'samples', 'sourceSha256']) && text(x.id) && samples(x.samples) && digest(x.sourceSha256);
// Divide before summing to avoid overflowing an otherwise finite mean.
const mean = xs => xs.reduce((sum, x) => sum + x / xs.length, 0);

export function validateBenchmarkReceipt(receipt, claim) {
  const fail = reason => ({ valid: false, pass: false, reasons: [reason] });
  if (!validBenchmarkSpec(claim.benchmarkSpec)) return fail('benchmark_spec_required');
  if (!keys(receipt, ['artifact', 'sha256']) || !digest(receipt.sha256)) return fail('benchmark_receipt_invalid');
  const a = receipt.artifact;
  if (!keys(a, ['schemaVersion', 'claimId', 'metric', 'unit', 'direction', 'baseline', 'candidate', 'provenance']) ||
      a.schemaVersion !== BENCHMARK_VERSION || !text(a.claimId) || !text(a.metric) || !text(a.unit) ||
      !['higher_is_better', 'lower_is_better'].includes(a.direction) || !run(a.baseline) || !run(a.candidate) ||
      !keys(a.provenance, ['runner', 'environment', 'command', 'datasetSha256']) ||
      !['runner', 'environment', 'command'].every(k => text(a.provenance[k])) || !digest(a.provenance.datasetSha256)) return fail('benchmark_receipt_invalid');
  if (benchmarkHash(a) !== receipt.sha256) return fail('benchmark_digest_mismatch');
  const s = claim.benchmarkSpec;
  if (a.claimId !== claim.id || a.metric !== s.metric || a.unit !== s.unit || a.direction !== s.direction ||
      benchmarkHash(a.baseline) !== s.baselineSha256 || a.provenance.datasetSha256 !== s.datasetSha256) return fail('benchmark_contract_mismatch');
  const baselineMean = mean(a.baseline.samples), candidateMean = mean(a.candidate.samples);
  if (![baselineMean, candidateMean].every(Number.isFinite)) return fail('benchmark_receipt_invalid');
  const reasons = [];
  if (Math.min(a.baseline.samples.length, a.candidate.samples.length) < s.minimumSamples) reasons.push('benchmark_sample_size_insufficient');
  if (s.direction === 'higher_is_better' ? candidateMean < baselineMean : candidateMean > baselineMean) reasons.push('benchmark_below_baseline');
  return { valid: true, pass: reasons.length === 0, reasons, sha256: receipt.sha256, baselineMean, candidateMean,
    baselineSamples: a.baseline.samples.length, candidateSamples: a.candidate.samples.length };
}

export function benchmarkGate(claim) {
  // Evaluate every declared benchmark, not just favorable/supporting/reviewed ones.
  const evidence = claim.evidence ?? [];
  const benchmarks = evidence.filter(e => e.type === 'benchmark_result' || e.benchmarkReceipt !== undefined);
  const reasons = [];
  if (claim.type === 'performance' || benchmarks.length || claim.benchmarkSpec !== undefined) {
    if (!validBenchmarkSpec(claim.benchmarkSpec)) reasons.push('benchmark_spec_required');
    if (!benchmarks.some(e => e.relation === 'supports')) reasons.push('benchmark_receipt_required');
  }
  for (const e of benchmarks) reasons.push(...validateBenchmarkReceipt(e.benchmarkReceipt, claim).reasons);
  return [...new Set(reasons)];
}
