# Benchmark receipts v1 — local adoption-readiness slice

This extends evidence-bound review to `evidence-bound-review-v2`. It is a local eligibility check, not production promotion authority. No dashboard, live service/configuration, or external integration is changed.

## Exact chosen behavior

A claim can declare `benchmarkSpec` at creation. There is no update endpoint for that contract. It pins one metric, unit, direction, minimum sample count, baseline digest and dataset digest. A missing contract is permitted for legacy compatibility, but performance claims cannot qualify without it. A provided malformed contract is rejected before mutation.

```json
{
  "metric": "search_work",
  "unit": "element_probes",
  "direction": "lower_is_better",
  "minimumSamples": 6,
  "baselineSha256": "<64 lowercase hexadecimal characters>",
  "datasetSha256": "<64 lowercase hexadecimal characters>"
}
```

`minimumSamples` is an integer from 2 to 10000, required independently of both run lengths; both runs must meet it. The floor of two is only a bounded prototype policy, not statistical sufficiency. Direction is exactly `higher_is_better` or `lower_is_better`. Strings must be nonblank and no longer than 4096 characters. Exact keys are required for the contract and all receipt objects; unexpected keys cannot introduce a caller-supplied pass flag, mean, or alternate policy.

Evidence submitted through existing CLI `add-evidence` / HTTP evidence-links carries `type: "benchmark_result"` and `benchmarkReceipt: {"artifact": {...}, "sha256": "..."}`. An artifact has exactly:

```text
schemaVersion: "benchmark-receipt-v1"
claimId: the receiving claim ID
metric, unit, direction: exact matches to benchmarkSpec
baseline: { id, samples, sourceSha256 }
candidate: { id, samples, sourceSha256 }
provenance: { runner, environment, command, datasetSha256 }
```

Each run has 1–10000 finite JSON numeric samples. Strings, nulls, empty samples, missing provenance, unknown versions/directions, and malformed hashes fail closed. Source digests are required for both implementations; dataset digest must match the claim's contract. Baseline digest binds the entire baseline object, including ID, sample order/values, and source digest. A receipt cannot swap baseline, metric, direction, units, dataset or claim after contract creation.

Hash algorithm: SHA-256 over UTF-8 canonical JSON, recursively sorting object keys with JavaScript's default key sort, preserving array order and using JSON number serialization. No whitespace. `benchmarkHash` and `canonicalJson` in `server/benchmark-receipt.mjs` implement it. Receipt `sha256` hashes the artifact only; `baselineSha256` hashes the baseline object. Dataset/source artifact materialization is the producer's responsibility. The demo hashes actual local source bytes and canonical dataset values. This is a prototype canonical format, not a claim of compliance with an external canonicalization standard.

Means are recomputed as the sum of each sample divided by run length (JavaScript finite-number arithmetic). No submitted aggregate or `benchmarkQuality` score is trusted. Both target statuses require candidate mean >= baseline mean for higher-is-better, or <= for lower-is-better. Equality qualifies as “not worse”; strict improvement, tolerance, confidence intervals, variance, paired tests, randomization, multiplicity and effect-size thresholds are not implemented. Signed finite samples are allowed; metric-specific ranges need independent policy.

## Failures, history, and review

- Malformed, hash-mismatched, or contract-mismatched receipt ingestion throws before memory, disk or audit mutation. Typed `benchmark_result` evidence without a receipt is rejected.
- Structurally valid below-baseline or undersized runs are saved, not discarded. Their evidence event records receipt digest, pass=false and reason codes.
- Performance claims require at least one supporting benchmark receipt. A nonperformance claim declaring a benchmark contract also requires one.
- Every typed benchmark or attached receipt is revalidated at gate evaluation, including contextual, superseding and unreviewed records. A favorable receipt cannot cancel a bad one. Relabeling a receipt-bearing record as a document does not bypass checking. Unstructured text labeled as an ordinary document cannot be semantically recognized as a benchmark; performance evidence must use the contract.
- Existing latest-review, coverage, lifecycle and adverse-evidence checks still apply. Adding a blocking receipt to either verified status automatically disputes it and withholds positive score. An accepted re-review of good support cannot hide contextual below-baseline evidence.
- There is no deletion, overwrite or “latest benchmark wins” route. Corrected evidence must not erase history. Adjudicated invalidation/resolution of an erroneous benchmark remains unimplemented; a blocked claim stays blocked.
- High-risk claims still fail `governance_clearance_not_implemented`, even with a passing receipt and accepted review.
- Gate inspection and blocked transitions do not append events to an existing store. Successful claim creation audits the benchmark contract. Evidence linkage audits its digest/result; existing append-only event prefixes remain intact.
- Receipt artifacts stay in the private JSON database and are omitted from current claim projections even for public evidence. Event summaries and gate output omit samples, runner/environment and command. Digests and benchmark contracts are visible metadata, not privacy certification. Use nonsensitive metric/unit labels.

Additional gate reason codes:

```text
benchmark_spec_required
benchmark_receipt_required
benchmark_receipt_invalid
benchmark_digest_mismatch
benchmark_contract_mismatch
benchmark_sample_size_insufficient
benchmark_below_baseline
```

`benchmark_validation_not_implemented` is retired in v2. Validation never opens receipt paths, fetches URLs, or executes the provenance command. The embedded artifact permits deterministic recomputation of hashes, sample counts and comparisons; it does not prove an arbitrary submitted workload was executed.

## Actual reproducible CLI demo

```sh
npm test
node scripts/benchmark-workload.mjs
node scripts/benchmark-receipt-demo.mjs
node scripts/evidence-review-demo.mjs
npm run lint:data
```

The workload runs linear and binary search on the same 256 pre-sorted integers and six declared queries, checks successful lookup, and records actual element probes. Sorting/setup cost and elapsed time are excluded. It makes a narrow deterministic work claim, not a universal performance claim.

The demo executes the workload in two separate Node processes and requires identical outputs, then creates an explicitly isolated database under ignored `artifacts/eval/benchmark-receipt-*/`. It runs the real suite, records its report and SHA-256, and invokes 17 real CLI processes. It proves tamper rejection without mutation, accepted evidence-bound verification and persistence, automatic dispute after an explicitly synthetic below-baseline contextual receipt, blocking of both targets even after a new accepted review, and revocation retaining evidence/reviews. It checks the exact ten mutation event types, unchanged prior audit prefix, hash-chain integrity, private provenance redaction and persisted raw receipt. Generated artifacts are never staged.

Artifacts: `report.json`, `tests.json`, `tests.log`, `workload-run-1.json`, `workload-run-2.json`, `receipt.json`, `synthetic-regression-receipt.json`, `cli-transcript.json`, `store.json`. The negative receipt is a labeled synthetic policy control, not a measured search regression. Unit tests additionally cover both directions, ties, sample-size failures, schema/binding failures, high-risk governance, legacy receipts, HTTP enforcement and retained history.

## Remaining adoption gates and required approval

This slice checks receipt consistency and deterministic comparison, not trusted authorship, source/dataset availability, independent execution, meaningful baseline selection, or statistical validity. A caller can manufacture a self-consistent receipt. Existing heuristic scores remain uncalibrated. Authentication, reviewer authority, trusted attestations, signed execution receipts and benchmark registry/policy ownership are independent work.

Legacy migration is explicit and still blocked: inventory cached verified claims and scores; obtain approved benchmark contracts/baselines; preserve old records and event chains; link reproducible receipts and append evidence-bound re-reviews under the new policy; reconcile status and projections with an audited migration. There is no contract-update/migration command in this slice, so do not manually patch the live JSON database to adopt it. Missing legacy contracts/receipts fail eligibility; reads do not automatically migrate cached statuses/scores. The existing loader can reseed after any read/parse error, another real-data blocker requiring a separate fail-closed storage slice.

Before any real-data adoption, obtain explicit project/data-owner authorization for the dataset and migration scope, and independent policy/steward approval of metric scope, baseline/dataset/source artifacts, sample-size/statistical requirements, provenance trust, privacy handling and permitted downstream use. High-risk use additionally needs an authoritative governance-clearance contract. Promotion/routing authority must remain separate from this gate.

Also unresolved: multi-writer locking, atomic multi-event transactions, backup/recovery, complete event replay, expiry scheduling, supersession linkage and adjudicated contradiction/benchmark correction. Hash-chain checks are not replay certification. No real-data migration, live configuration, git identity change, commit or push is part of this slice.
