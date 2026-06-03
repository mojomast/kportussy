# Kportussy Architecture

## Structural model

```text
Ussyverse producers
  Hermes / build cycles / Becomussy / Ragussy / humans
        ↓
Claim + Evidence API
        ↓
Kportussy Core
  Claim Registry
  Evidence Ledger
  Verification Workflow
  Trust Projection
  Privacy Policy
  Audit Event Log
        ↓
Consumers
  Hermes routing / Becomussy governance / Ragussy ranking / ClawDeck dashboard / UssyHub API
```

## Event-first design

Kportussy stores current projections, but treats trust-affecting mutations as events:

```text
claim.created → evidence.linked → verification.created → trust_signal.computed → trust_application.applied
```

This supports replay, audit, dispute, and rollback/revocation without deleting history.

## Integration map

### Becomussy

- evidence source: memories, audit logs, witnesses, approvals, governance triggers;
- governance sink: high-risk self-model/capability upgrades;
- not bypassed for durable identity changes.

### Ragussy

- consumes verified/stale/disputed source state;
- can expose citation confidence and provenance;
- does not become the source of truth for claim lifecycle.

### ClawDeck

- operator/reviewer surface;
- trust cards, claim queues, benchmark reports, stale claims, revocations;
- should make hidden governance inspectable.

### Hermes

- submits task result and capability claims;
- attaches diffs, tests, benchmarks, transcripts;
- consults trust signals for routing/tool selection.

### UssyHub

- route discovery and event exposure;
- cross-service API boundary;
- external clients receive policy-filtered summaries.

## First implementation shape

Recommended MVP stack:

- TypeScript or Python service;
- SQLite first, Postgres-ready schema;
- REST API + JSON events;
- JSON Schema for claim packages;
- local CLI/importer for examples;
- no raw evidence blob storage in MVP, only refs/hashes/summaries.

## Drift audit

Kportussy must resist these drifts:

- from evidence layer → generic reputation app;
- from trust signal → universal truth score;
- from privacy-aware summary → raw log dumping;
- from benchmark gate → self-congratulatory metrics;
- from governance integration → automation bypassing stewardship;
- from Ussyverse-specific vocabulary → generic agent-trust SaaS mush.
