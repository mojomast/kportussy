# Kportussy

**Kportussy** is a Ussyverse evidence-to-trust specification: a governed layer for turning claims about people, agents, tools, memories, models, projects, benchmarks, and autonomous build cycles into auditable, privacy-aware trust signals.

It is inspired by [K-Port](https://github.com/Rejean-McCormick/K-Port)'s claim → evidence → verification → scoring-handoff model, generalized for Hermes, Becomussy, Ragussy, ClawDeck, UssyHub, and autonomous development workflows.

> **Core rule:** no trust, promotion, routing priority, self-model upgrade, memory confidence increase, or public badge without receipts.

## Why this exists

The Ussyverse has many systems that make or consume claims:

- “Hermes can safely edit this codebase.”
- “Ragussy’s answer is grounded in verified sources.”
- “This Becomussy memory is durable and well-supported.”
- “This autonomous build cycle improved quality.”
- “This new tool is not generic AI slop; it beats a baseline.”
- “This dashboard feature is ready for first-class exposure.”

Kportussy gives those claims a shared lifecycle:

```text
Claim → Evidence → Verification → Trust Application → Audit Trail → Expiry / Dispute / Revocation
```

## What Kportussy is

Kportussy is a **spec-first project** for a Ussyverse-native trust substrate.

It defines:

- bounded contexts and vocabulary,
- subject/domain/claim/evidence models,
- claim lifecycle and state machine,
- verification and benchmark evidence contracts,
- privacy and access-control defaults,
- audit/event model,
- Ussyverse integration points,
- 30/60/90 day roadmap,
- evaluation and anti-slop gates.

## What Kportussy is not

Kportussy is **not**:

- a generic reputation badge app,
- a generic AI wrapper,
- an automatic truth oracle,
- a replacement for Becomussy governance,
- a replacement for Ragussy retrieval,
- a public credentialing authority,
- a vibes-based score generator.

## Primary Ussyverse integrations

| System | Kportussy role |
|---|---|
| **Hermes** | Submit and consume capability claims; gate agent routing and self-improvement claims. |
| **Becomussy** | Provide governed memory, audit, approvals, witnesses, and self-model revision hooks. |
| **Ragussy** | Weight retrieved sources using verification, provenance, contradiction, and expiry metadata. |
| **ClawDeck** | Show review queues, trust cards, disputed claims, benchmark evidence, and promotion gates. |
| **UssyHub** | Expose claim/trust APIs and route trusted service metadata to ecosystem clients. |
| **Autonomous build cycles** | Produce benchmark-backed improvement claims before promotion. |

## Example claim

```yaml
subject:
  type: agent
  id: hermes
  name: Hermes Agent
claim:
  type: capability
  domain: repo-architecture-review
  statement: Hermes can produce accurate repository architecture reviews with evidence-backed findings.
evidence:
  - type: transcript
    relation: supports
  - type: benchmark_run
    relation: supports
  - type: human_review
    relation: supports
verification:
  method: rubric-review
  decision: partially_verified
trust_application:
  target: hermes-routing
  effect: increase_confidence_for_repo_review_tasks
privacy:
  raw_evidence: restricted
  public_summary: allowed
```

## Repository map

```text
README.md                 Project overview
docs/SPEC.md              Main implementation-grade specification
docs/ROADMAP.md           30/60/90 day roadmap and milestones
docs/ARCHITECTURE.md      Bounded contexts and integration architecture
docs/DASHBOARD.md         Local dashboard/API/CLI operating guide
docs/EVALUATION.md        Benchmarks, anti-slop gates, acceptance criteria
docs/PRIVACY.md           Privacy, access control, retention, redaction
schemas/claim.schema.json Draft JSON schema for claims
examples/                 Example claim packages
server/                   Tested JSON persistence, HTTP API, and CLI MVP slice
src/                      Local review workbench consuming authoritative API gates
```

## MVP status

Current status: **usable local evidence-to-trust MVP, not production authority**.

Run `npm run build` then `npm start` and open http://127.0.0.1:8787. The workbench supports scoped claim creation, evidence/benchmark receipt linkage, explicit evidence-bound review, server gate reasons, lifecycle changes, dispute/revocation and detailed audit visibility. No placeholder evidence or mock fallback is used. See [the operating guide](docs/DASHBOARD.md) for the complete workflow, storage boundaries and required real-data approvals. Run `npm run demo` for the isolated production-HTTP plus CLI end-to-end demonstration.

Performance eligibility now validates baseline-bound, dataset-bound benchmark receipts with recomputed means, explicit metric direction, sample-size requirements and provenance. Below-baseline receipts remain blocking evidence even after accepted review. See [Benchmark receipts v1](docs/BENCHMARK_RECEIPTS.md) and run `node scripts/benchmark-receipt-demo.mjs` for the isolated CLI demonstration. This does not authorize real-data adoption.

The store now enforces evidence-bound verification and bounded lifecycle transitions: a rejected review cannot verify a claim, accepted reviews must name the supporting evidence they cover, and later adverse/unreviewed evidence disputes prior approval. See [Evidence-bound review v1](docs/EVIDENCE_BOUND_REVIEW.md) for the policy, compatibility limits, CLI gate command, and reproducible local example (`node scripts/evidence-review-demo.mjs`). This is not yet a production promotion authority.

The repository now includes a JSON-file persistence layer, HTTP API, dashboard fetch adapter, and CLI capable of creating claims, linking evidence, recording manual/automated verification, computing simple trust projections, and emitting hash-chained audit events. Runtime databases live under `data/*.json` and are ignored so generated artifacts are not committed.

Quick checks:

```bash
npm test -- --run
npm run lint:data
npm run build
KPORTUSSY_DB_PATH=/tmp/kportussy-demo.json npm run kportussy -- health
```
