# Evidence-bound review v1

This document preserves the original v1 design. The current store uses `evidence-bound-review-v2`, extending the benchmark placeholder with [Benchmark receipts v1](BENCHMARK_RECEIPTS.md). All other lifecycle/review constraints below remain in force; the v1 benchmark reason code and next-step statement are historical.

The subsequent [local MVP](DASHBOARD.md) adds the workbench, authoritative read projections, fail-closed loading and atomic mutation commits. Its storage/projection guarantees supersede the historical limitations below. Legacy statuses are still not automatically migrated; unsupported positive projections are now withheld on reads too.

## Selected pre-MVP slice

The original store's verified gate counted evidence and verification records. A rejected or inconclusive review counted just like an accepted review, and reviews discarded evidence references. Status updates also accepted arbitrary strings and lifecycle shortcuts. This contradicted SPEC sections 9–10, ROADMAP M3/M5, and EVALUATION Gate 2.

This slice makes the store (shared by CLI and HTTP) enforce a bounded verification policy. It does not change the dashboard, add an API wrapper, or integrate another service.

## Vocabulary and semantics

- Claim: a scoped assertion; claim types are `capability`, `quality`, `performance`, `compliance`, `provenance`, `identity`, `release_readiness`, `novelty`.
- Risk: `low`, `medium`, `high`. Unknown claim types/risk values cannot bypass policy.
- Evidence relation: `supports`, `contradicts`, `contextualizes`, `invalidates`, `supersedes`. Only `supports` satisfies positive coverage. A `supersedes` relation does not resolve a contradiction.
- Verification decision: `accepted`, `partially_accepted`, `rejected`, `inconclusive`, `disputed`. These are not claim statuses.
- Confidence: `low`, `medium`, `high`; confidence is not permission to promote.
- Review coverage: explicit `evidenceIds` referencing evidence already linked to this claim. References must be unique. All currently supporting evidence must be covered. IDs are scoped to a claim; evidence and verification IDs cannot be duplicated within that claim.
- Latest review: last appended verification, not highest confidence, a caller timestamp, or any historical accepted decision. This is a deliberately conservative single-review policy, not reviewer consensus.
- Verification gate: versioned evidence/policy eligibility for `verified` or `partially_verified`. The store additionally checks the lifecycle before changing status. Gate success alone is not a routing/promotion authorization or proof that evidence contents are true.

`verified` requires the latest decision to be `accepted`. `partially_verified` permits `accepted` or `partially_accepted`. Missing `evidenceIds` records an unbound review, never an eligible review. A nonblank rationale is mandatory. Unknown references, duplicate references and invalid vocabulary are rejected before any mutation or audit append.

Contradicting or invalidating evidence always blocks either target. Adding unreviewed support, adverse evidence, or an insufficient latest review to a verified/partially-verified claim automatically moves it to `disputed`, emits a `claim.status_changed` event with policy version and reason codes, and withholds its positive score. New contextual evidence alone does not invalidate supporting coverage. Re-reviewing all support can restore eligibility, but cannot erase unresolved adverse evidence.

High-risk claims fail with `governance_clearance_not_implemented`; performance claims fail with `benchmark_validation_not_implemented`. Numeric `governanceStatus` and `benchmarkQuality` components cannot stand in for authoritative approvals or measured benchmarks. This intentionally removes the old scalar-based route to approval until those contracts exist.

## Bounded lifecycle

```text
draft -> submitted
submitted -> under_review
under_review -> partially_verified | verified | rejected | disputed
verified | partially_verified -> disputed | expired | revoked
disputed -> under_review | rejected | partially_verified | verified | revoked
```

`rejected`, `expired`, `revoked`, and `superseded` have no outgoing transitions in v1. Unknown states, no-op transitions and shortcuts are rejected. Supersession is in the vocabulary but cannot be set by this endpoint: the required old/new claim linkage is not implemented. Partial-to-full advancement goes through dispute/re-review rather than adding an undocumented shortcut to the specified lifecycle.

## CLI / HTTP contract

Existing `add-verification` and `POST /api/claims/:id/verifications` now preserve `evidenceIds` and a server `createdAt`. The `verification.created` audit payload includes evidence IDs, not restricted source references. Successful verified transitions audit the selected verification ID and policy version.

```sh
# Use your own claim/evidence IDs and an explicitly isolated database.
export KPORTUSSY_DB_PATH=/tmp/kportussy-review.json
node server/cli.mjs add-verification CLAIM_ID '{"decision":"accepted","confidence":"medium","method":"manual-review","rationale":"Reviewed the scoped receipt; limitations remain.","evidenceIds":["EVIDENCE_ID"]}'
node server/cli.mjs verification-gate CLAIM_ID
node server/cli.mjs verification-gate CLAIM_ID partially_verified
```

Gate command exit codes: `0` eligible, `2` blocked, `1` invalid request/not found. Gate inspection appends no event to an existing store. As with other CLI commands, opening a nonexistent database creates the existing demo seed store.

Reason-code vocabulary:

```text
invalid_policy_vocabulary
supporting_evidence_required
adverse_evidence_unresolved
verification_required
latest_decision_insufficient
review_evidence_required
review_evidence_not_linked
supporting_evidence_not_reviewed
governance_clearance_not_implemented
benchmark_validation_not_implemented
```

## Repeatable real execution

```sh
npm ci --ignore-scripts
npm test
node scripts/evidence-review-demo.mjs
npm run lint:data
npm run build
```

The demo runs the real test suite, saves and SHA-256 hashes the test report, then uses separate CLI processes against a new isolated database. It checks rejected-review blocking without mutation, an evidence-bound accepted review, persistence after reopening, automatic dispute on contradiction, and revocation retaining review history. It asserts the exact mutation event sequence, verifies the existing hash chain, and checks that the restricted test source reference is absent from claim/event outputs.

Each run writes `artifacts/eval/evidence-review-*/`: `report.json`, `report.md`, `tests.json`, `tests.log`, `cli-transcript.json`, and `store.json`. The existing `artifacts/` ignore rule keeps all receipts and the private runtime database out of git. Negative-review and contradiction controls are explicitly synthetic; test execution results are not fabricated. The accepted review is an automated local self-test, not independent stewardship.

## Limits and next gate

This is not a complete promotion gate, calibrated trust score, content-integrity verifier, or proof of measured usefulness. Eligible projections retain the existing heuristic score formula; UI/mock metrics are untouched and are not authoritative. Legacy cached claims/scores are not migrated on read; old reviews without evidence IDs fail this gate and require explicit re-review. Recompute/mutations withhold positive scores when this policy fails, but no expiry scheduler was added.

The JSON store still lacks multi-writer locking, fully atomic multi-event transactions, complete event replay, authentication, reviewer authority, content-hash verification, and adjudicated contradiction resolution. Hash-chain checking is not replay certification. Restricted source-reference testing is not comprehensive privacy certification. Do not use this local prototype for production authority.

Next gate: implement and validate benchmark receipts (baseline, metric direction/value, sample size, provenance and reproducible artifact), then prove that a below-baseline or malformed result cannot become promotion-eligible. High-risk governance remains independently blocked until an authoritative clearance contract is implemented. Before real-data adoption, migrate legacy reviews explicitly and obtain independent review of this policy.
