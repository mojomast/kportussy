# Evaluation and Anti-Slop Gates

## Evaluation principle

Kportussy exists to prevent ungrounded claims. Therefore Kportussy itself must not make ungrounded claims.

## Baselines

Compare against:

1. manual notes/spreadsheets tracking tool confidence;
2. Becomussy memory without explicit evidence package;
3. Ragussy retrieval without source trust metadata;
4. autonomous build logs without promotion evidence;
5. generic badge/reputation systems.

## Core metrics

| Category | Metric |
|---|---|
| Completeness | % verified claims with required evidence types present |
| Auditability | % trust-affecting mutations with audit events |
| Privacy | restricted evidence leak count in public summaries/logs |
| Utility | time to answer “why do we trust this?” |
| Promotion quality | % promoted tools/features with benchmark-backed claims |
| Revocation | time to move contradicted claim to disputed/revoked |
| RAG value | retrieval/citation quality delta with trust metadata enabled |
| Agent routing | task success delta when Hermes uses trust signals |

## Required reports

Each evaluation run should emit:

```text
artifacts/eval/<timestamp>/
  report.md
  report.json
  claims_sample.json
  privacy_redaction_check.json
  audit_replay_check.json
  limitations.md
```

Generated artifacts should not be committed unless intentionally redacted and small.

## Anti-slop gates

### Gate 1: Specificity
Every claim must identify subject, domain, statement, evidence, and intended trust application.

### Gate 2: Evidence
No verified claim without evidence. No benchmark claim without baseline/metric/sample size.

### Gate 3: Privacy
Public summaries must be generated from allowed fields only. Restricted raw evidence cannot leak.

### Gate 4: Reversibility
A verified claim can become disputed, expired, revoked, or superseded without history deletion.

### Gate 5: Measured usefulness
Any claim that Kportussy improves Ussyverse must cite measured outcomes: faster review, better routing, better RAG trust, fewer stale claims, or blocked low-quality promotions.
