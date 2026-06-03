# Kportussy Roadmap

## North star

By day 90, Kportussy should be dogfooded as the Ussyverse mechanism for deciding whether a tool, agent capability, memory, RAG source, dashboard feature, or autonomous build result has enough evidence to be trusted, promoted, or surfaced.

## 0-30 days: spec-to-MVP foundation

### Goal
Create a working local/API MVP that records claims, evidence, verification, trust projections, and audit events.

### Milestones

| ID | Milestone | Deliverable | Acceptance criteria |
|---|---|---|---|
| M1 | Repo/spec foundation | README, SPEC, ARCHITECTURE, PRIVACY, EVALUATION, schemas, examples | Docs define vocabulary, lifecycle, non-goals, and roadmap. |
| M2 | Minimal data model | SQLite/Postgres schema or typed models | Subject, Domain, Claim, Evidence, ClaimEvidence, Verification, TrustSignal, AuditEvent exist. |
| M3 | Claim lifecycle API | CRUD + status transition endpoints | Invalid transitions are rejected; verified requires verification. |
| M4 | Evidence ledger | Evidence metadata + claim-evidence links | Evidence can support/contradict/contextualize claims; raw content optional. |
| M5 | Manual verification | Verification records and decisions | Claims can become partially_verified/verified/rejected with rationale. |
| M6 | Audit log | Append-only event stream | Every trust-affecting mutation emits an event. |
| M7 | Example claims | Hermes/Ragussy/Becomussy/ClawDeck example packages | At least 4 realistic examples validate against schema. |

### 30-day success criteria

- API can create and review a Hermes capability claim end-to-end.
- Trust signal recomputes after evidence/verification changes.
- Audit event count matches performed mutations.
- Privacy labels prevent raw restricted evidence from appearing in public summaries.
- Example JSON validates with schema.

## 31-60 days: Ussyverse integration prototypes

### Goal
Connect Kportussy to real Ussyverse workflows without making it production-authoritative yet.

### Milestones

| ID | Milestone | Deliverable | Acceptance criteria |
|---|---|---|---|
| M8 | Becomussy evidence adapter | Import memory/audit/approval refs as evidence | No canonical memory writes without governance; evidence links are reversible. |
| M9 | Benchmark evidence adapter | Parse benchmark JSON into evidence | Stores metric, baseline, threshold, pass/fail, commit, environment. |
| M10 | Autonomous cycle claim | Build cycle emits improvement claim | Includes diff/test/benchmark evidence and promotion recommendation. |
| M11 | Ragussy trust prototype | Retrieval source metadata includes trust state | Verified sources are distinguishable from unverified/stale/disputed sources. |
| M12 | ClawDeck review mock | Claim cards/review queue | Shows pending, verified, disputed, stale, revoked claims. |
| M13 | UssyHub API manifest | Service route/events manifest | UssyHub can discover Kportussy endpoints and event stream. |

### 60-day success criteria

- One autonomous build cycle produces a complete Kportussy claim package.
- One Ragussy answer can expose source trust metadata.
- One Becomussy approval/audit item is linked as evidence.
- One ClawDeck view or static prototype shows live/replayed claim states.
- Benchmark evidence is queryable by subject/domain.

## 61-90 days: promotion gates and hardening

### Goal
Use Kportussy as an evidence-backed promotion gate for at least one real Ussyverse decision.

### Milestones

| ID | Milestone | Deliverable | Acceptance criteria |
|---|---|---|---|
| M14 | Promotion gate v1 | Policy: tool/feature promotion requires verified claim | Generic/slop tools fail unless evidence beats baseline. |
| M15 | Trust decay/expiry | Scheduler or recompute job | Stale evidence reduces trust or expires claims. |
| M16 | Dispute/revocation | Negative evidence workflow | Contradiction can move verified claim to disputed/revoked. |
| M17 | Privacy proof cards | Public summary generator | Shows claim/trust without leaking restricted raw evidence. |
| M18 | Evaluation harness | Repeatable benchmark/report command | Produces JSON+Markdown reports for quality gates. |
| M19 | Dogfood decision | Real Ussyverse promote/kill review | At least one feature/tool decision cites Kportussy evidence. |

### 90-day success criteria

- At least one Hermes/Ragussy/ClawDeck/Becomussy trust decision is made using Kportussy.
- A stale or contradicted claim is handled correctly.
- Promotion gate blocks at least one under-evidenced feature/tool.
- Privacy proof card exposes useful summary without restricted evidence.
- Evaluation report includes pass/fail, metric definitions, raw redacted artifacts, and limitations.

## Promotion gates

Kportussy itself cannot be called successful unless it passes these gates:

1. **Vocabulary gate** — terms are precise; no overloaded “agent/session/task/event” mush.
2. **Evidence gate** — every trust claim links to evidence.
3. **Benchmark gate** — performance/usefulness claims beat a baseline or state failure honestly.
4. **Privacy gate** — restricted evidence never appears in public summaries or logs.
5. **Audit gate** — mutations are replayable from events.
6. **Anti-slop gate** — no generic wrapper/project promotion without novelty + measured utility.
7. **Revocation gate** — bad/stale claims can be disputed, expired, or revoked without deleting history.

## Risks

| Risk | Mitigation |
|---|---|
| Becomes vibes-based badges | Require evidence, verification, and audit for every trust signal. |
| Overcouples to Becomussy | Treat Becomussy as governance/evidence source, not storage dependency for every object. |
| Leaks private transcripts/logs | Summary-only defaults, sealed evidence, redaction tests, access events. |
| Scores become treated as truth | Always expose domain, scoring profile, evidence limits, and confidence. |
| Too broad MVP | Start with manual verification and 4 Ussyverse example claims. |
| Automation rubber-stamps itself | High-risk claims require steward/governance approval. |
