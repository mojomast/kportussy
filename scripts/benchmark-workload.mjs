// Deterministic local work benchmark, not wall-clock speed or ecosystem utility.
// Both algorithms search the same pre-sorted data; sorting/index construction is excluded.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { benchmarkHash } from '../server/benchmark-receipt.mjs';

const values = Array.from({ length: 256 }, (_, i) => i);
const queries = [0, 15, 63, 127, 191, 255];
function linear(key) {
  let probes = 0;
  for (const value of values) { probes++; if (value === key) return { found: true, probes }; }
  return { found: false, probes };
}
function binary(key) {
  let lo = 0, hi = values.length - 1, probes = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2); probes++;
    if (values[mid] === key) return { found: true, probes };
    if (values[mid] < key) lo = mid + 1; else hi = mid - 1;
  }
  return { found: false, probes };
}
const sourceSha256 = createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
const measure = fn => queries.map(key => {
  const result = fn(key);
  if (!result.found) throw new Error('Benchmark correctness check failed');
  return result.probes;
});
console.log(JSON.stringify({
  baseline: { id: 'linear-search-v1', samples: measure(linear), sourceSha256 },
  candidate: { id: 'binary-search-v1', samples: measure(binary), sourceSha256 },
  datasetSha256: benchmarkHash({ values, queries }),
}));
