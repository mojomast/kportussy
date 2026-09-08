# Local MVP workbench

## Smallest complete product slice

A single local operator can create a scoped claim, pin a performance contract, link real evidence/embedded benchmark receipts, record a review naming the actual evidence, inspect authoritative eligibility, explicitly change lifecycle status, and see later dispute/revocation without erasing history. The React workbench, HTTP API and CLI share the same store policy. No external service, model call, routing permission or badge authority is involved.

The broad SPEC/ROADMAP remain design targets, not a claim that every integration or governance feature is implemented. This guide supersedes the old dashboard quick-action/mock-fallback operating instructions.

## Run the usable production build

From this repository, using a current Node version supported by the locked Vite version (Node 22.12+ recommended):

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run lint:data
KPORTUSSY_DB_PATH=$PWD/data/local-demo.json npm start
```

Open http://127.0.0.1:8787. One process serves both the built dashboard and `/api`. Stop with Ctrl-C. If the port is occupied, set `KPORTUSSY_API_PORT=8797` (or another free port). No system service is installed. Only loopback hosts are accepted. Do not expose through Tailscale, a reverse proxy, or a public tunnel: there is no authentication.

A new database gets four historical example records, not production evidence. Their cached scores are recomputed on projection, and unsupported recorded verified/partial statuses show a legacy warning and zero trust. No automatic status migration occurs. Use a new isolated path for practice; never delete or reseed an existing real database to repair it.

`npm run dev:all` remains the optional Vite development path (5179 with proxy to 8787). `npm run preview` alone is only a static preview; use `npm start` for the complete product.

## Human workflow

1. Create: enter subject, domain, scoped statement, risk and intended use. No placeholder evidence is created. IDs are optional for ordinary claims; use an explicit ID before producing a benchmark receipt because receipts bind to it.
2. Performance claims: paste the exact `benchmarkSpec` JSON at creation. Metric, direction, unit, baseline digest, dataset digest and minimum sample count are immutable. See [BENCHMARK_RECEIPTS.md](BENCHMARK_RECEIPTS.md). Missing contracts remain ineligible; there is no contract-update command.
3. Claims: select the claim. Submit it, then start review using the displayed allowed transitions.
4. Link evidence: write a safe summary, reference and sensitivity; choose supports/context/adverse relation. For `benchmark_result`, paste the complete `{artifact,sha256}` receipt. Malformed input is rejected visibly; valid below-baseline evidence is retained and blocking. Raw source references are not fetched and provenance commands are never executed by ingestion.
5. Review original evidence locally. Enter a reviewer label (not an authenticated identity), decision, confidence and rationale. Check the precise linked evidence you reviewed. All supporting evidence must be covered by the latest review. A review never changes status by itself.
6. Inspect server eligibility reason codes for both targets. A passing gate is local evidence-policy eligibility only, not proof of truth or downstream authorization. Use an enabled lifecycle action to record verified/partial status. Scores alone never enable this.
7. Later adverse evidence or a blocking receipt automatically disputes an approved claim. It cannot be erased by a favorable re-review. Revoke when appropriate; terminal records keep their evidence and review history. Correction/adjudicated dispute resolution is not implemented.
8. Audit: see the latest 50 detailed events, including from/to statuses and policy reasons, plus the entire chain's count/head/consistency result. A hash chain is not signed attestation or full state replay. The private DB retains all events; CLI `events` returns up to 500.

All writes show pending/error state; failed submissions retain form input. On connection failure, the workbench retains clearly marked stale data and disables writes. It never swaps in mock claims. Polling can be paused; Refresh gets the latest server view.

## Reproducible end-to-end evidence

```sh
npm test
npm run build
npm run lint:data
npm run demo
node scripts/evidence-review-demo.mjs
node scripts/benchmark-receipt-demo.mjs
```

`npm run demo` runs the production Node entrypoint on an ephemeral loopback port and fresh ignored `artifacts/eval/local-mvp-*/store.json`. It checks built HTML/JS/CSS, performs actual HTTP mutations and a separate CLI read, then stops its own server. It runs the deterministic search workload twice; actual probe samples and hashes bind the baseline/dataset/receipt. It proves no-evidence and tampered-receipt rejection without mutation, accepted evidence-bound verification, automatic dispute from an explicitly synthetic regression control, both targets remaining blocked, revocation, exact claim event sequence, chain consistency and restricted provenance redaction.

Outputs include report.json, http-transcript.json, workload.json, benchmark-contract.json, receipt.json, synthetic-negative-receipt.json, verified-projection.json and cli-projection.json. The report prints a restart command to open that exact database in the workbench; the final claim is deliberately revoked. The contract/receipt JSON files can be inspected for format learning. Receipts cannot be reused on a different claim ID without producing a correctly bound artifact and digest.

The other two demos separately run the whole test suite and preserve their CLI transcripts/test reports. React interaction tests exercise the actual store/app contract through a fetch adapter, including create → evidence selection → review → verify → dispute → revoke → audit and offline write blocking. Transport tests use real loopback sockets. These are local self-tests, not an independent human review or proof of general ecosystem usefulness.

## API / CLI additions

- `GET /api/claims/:id/verification-gate?target=verified|partially_verified`: inspection only; blocked eligibility is HTTP 200 with pass=false, invalid targets 400, missing claims 404.
- `GET /api/audit`: checks the entire loaded event chain.
- Claim GET/list/dashboard projections include both `gates`, `allowedTransitions`, `legacyStatusWarning` and benchmark digest/result summaries. Samples, means and raw provenance remain private.
- Existing CLI `verification-gate ID [target]`: exit 0 eligible, 2 blocked, 1 error. `claim ID`, `events [limit]`, create/link/review/status commands remain supported.
- Mutation HTTP bodies must be JSON, at most 2 MiB. Cross-origin browser requests and non-loopback Host headers are rejected. This is local exposure reduction, not authentication.

## Storage guarantees and recovery boundaries

- Only ENOENT initializes a database, using exclusive creation. Read/parse/shape errors, duplicate stored claim IDs and invalid event chains fail closed without reseeding.
- Each public mutation writes its entire state plus all generated events once via an atomic rename, including automatic dispute. Failed writes roll back in-memory mutation. New DB/temp/lock files are owner-only.
- An exclusive `.lock` serializes cooperating mutation commits; stale store instances reject disk changes instead of overwriting them. Restart the server after a separate CLI writer. Do not run multiple active writers; this is not a multi-user database and there is no retry/merge scheduler.
- A crash may leave a lock or temp file. Stop all writers, preserve a backup, inspect the store/chain, and obtain operator confirmation before removing a stale lock. There is no automatic lock breaking or recovery command.
- There is no fsync-based power-loss durability, backup/recovery certification, signed audit anchor or full event replay. Direct local file edits are outside the API trust boundary. Low-level store helpers/state are internal, not supported mutation APIs.
- A long-running server holds a snapshot; external modifications do not automatically refresh its reads. Stale writes are rejected. Restart rather than manually editing the JSON file.

## Explicit real-data adoption restrictions

This is a coherent local prototype, not production promotion authority. High-risk governance always fails closed. Reviewer labels are unauthenticated. A caller can manufacture a self-consistent receipt; hashes do not certify provenance, useful baselines, statistical validity or execution. The deterministic demo excludes sorting/setup and elapsed time; ties qualify as not-worse rather than strict improvement.

Before real-data adoption obtain explicit data-owner authorization and independent policy/steward approval for scope, baseline/dataset/source artifacts, sample sufficiency, statistical method, provenance trust, privacy, migration and downstream use. Legacy claims need an approved migration/re-review, not silent score/status rewriting. Expiry scheduling, supersession linkage, adverse-evidence adjudication, access grants, audit of raw file reads, trusted execution and integration authority remain unimplemented.

Summaries, review rationales, labels and claim text are displayable metadata: do not put secrets there. Restricted references and embedded receipt contents are omitted from projections; that is not comprehensive privacy certification. Keep runtime databases and generated artifacts uncommitted.
