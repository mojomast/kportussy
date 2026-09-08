# Focused local MVP diff audit

This is a separate adversarial review pass by the implementing agent, without delegation. It is not independent human stewardship, external security certification, or approval for real-data adoption.

## Scope and invariants

Reviewed the branch's evidence-bound review and benchmark policy plus the workbench, HTTP entrypoint, projections, storage commits, initialization and operating guide. Traced the public create/link/review/status/recompute operations through disk persistence and every display surface rather than treating passing tests or scores as authority.

- Promotion: the store gate and lifecycle are both checked; the UI only displays server results. No scalar fallback can mark a claim eligible. Full verification requires accepted, not partially accepted, review.
- Coverage: the latest review explicitly binds evidence IDs; all support is covered; contradictory evidence and below-baseline receipts remain blockers, even if contextual or followed by a favorable review.
- Privacy: projected benchmark summaries contain result/digest/reasons, not embedded samples, means or provenance commands. Restricted references and sealed summaries remain redacted. Free-text metadata is not a secret store.
- Persistence: malformed existing data cannot trigger reseeding; multi-event mutation commits are one rename; failed saves restore memory; cooperating stale/locked writers cannot overwrite newer data. History remains after revoke.
- Local exposure: production build and API share a loopback server; transport requires JSON mutation bodies, bounded size, loopback Host and same-origin browser requests.
- Human interaction: actual input forms replace fabricated evidence/unbound quick reviews; lifecycle actions, errors, evidence selection, terminal state and audit payloads are visible. Offline data is stale, not mock.

## Findings fixed during the separate pass

1. Full verified legacy records could retain positive trust under partial-only review. Recompute now evaluates the full gate for recorded verified status; regression test requires zero score plus a legacy warning.
2. Loopback bind did not itself prevent DNS-rebinding-style Host use. Added loopback Host validation. The test uses node:http because this runtime's fetch normalizes Host overrides; the raw transport test verifies rejection.
3. A stale-loader race existed between parsed state and a second fingerprint read. The fingerprint now comes from the same bytes that were parsed. Commit bookkeeping uses the exact bytes written, avoiding a post-commit read that could falsely roll memory back.
4. The old seed command deleted the default database and ignored the configured path. It now only opens/initializes the selected store. A subprocess regression test verifies existing history is byte-identical.
5. An unused client helper still encoded numeric eligibility thresholds. It now fails closed without server gate data.

## Verification and limits

`server/local-mvp.test.mjs` covers corrupt stores, audit tampering, stale projections, atomic dispute commits, rollback, stale writers/locks, malformed intake/sensitivity, safe seed and real transport rejection. `src/App.test.jsx` exercises the human lifecycle through the actual app/store with a fetch adapter and checks offline write blocking. Existing policy/receipt tests cover the independent constraints of both delivered slices. `scripts/local-mvp-demo.mjs` exercises the built production HTTP entrypoint and a separate CLI process using actual deterministic workload receipts.

No unresolved blocker was identified for the documented single-operator local prototype. Explicitly outside this conclusion: independent authorship/provenance, statistical validity, authentication, high-risk governance, full replay/signed audit anchors, fsync/power-loss recovery, multi-user concurrency, expiry scheduling, supersession, adjudicated adverse-evidence correction and real-data migration. These remain adoption blockers, not reasons to silently broaden the local MVP's authority.
