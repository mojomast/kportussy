# Kportussy Specification

## 1. Mission

Kportussy turns explicit claims into auditable trust signals. It separates five things that often get dangerously collapsed:

1. **Claim** — what is being asserted.
2. **Evidence** — what supports, contradicts, contextualizes, or invalidates it.
3. **Verification** — who/what evaluated the evidence and by what method.
4. **Trust application** — how downstream systems may use the verified signal.
5. **Audit** — what happened, when, by whom, and under which policy.

## 2. Bounded contexts

### Claim Registry
Owns canonical claim records, revisions, state transitions, subject links, domain links, and lifecycle rules.

### Evidence Ledger
Owns evidence metadata, provenance, hashes, source references, privacy labels, and claim-evidence relations. Raw evidence may live elsewhere.

### Verification Workflow
Owns verification runs, human reviews, automated checks, decisions, rationales, limitations, expiry, and disputes.

### Trust Projection
Computes contextual trust signals from claims, evidence, verification, benchmark quality, recency, contradictions, and governance status.

### Privacy & Access Control
Owns visibility, sealed evidence, redaction, access grants, retention, and disclosure policy.

### Audit & Governance
Owns append-only trust-affecting events and integration with Becomussy approvals/governance triggers.

### Integration Gateway
Owns APIs, event streams, and Ussyverse integration contracts.

## 3. Vocabulary map

| Term | Definition |
|---|---|
| `Subject` | Entity a claim is about: human, agent, tool, model, memory, project, artifact, repo, build cycle, RAG source, dashboard component. |
| `Domain` | Scope where a claim is meaningful: code editing, RAG grounding, privacy, release readiness, benchmark performance, memory provenance. |
| `Claim` | Specific assertion about a subject in a domain. |
| `Claimant` | Actor that submits the claim. |
| `Evidence` | Artifact, log, benchmark, commit, memory, approval, citation, document, or observation relevant to a claim. |
| `EvidenceRelation` | `supports`, `contradicts`, `contextualizes`, `invalidates`, or `supersedes`. |
| `Verifier` | Human, agent, CI job, benchmark runner, policy engine, or steward evaluating evidence. |
| `Verification` | Recorded evaluation with method, decision, confidence, rationale, limitations, and expiry. |
| `TrustSignal` | Contextual output that downstream systems may consume. Not universal truth. |
| `TrustApplication` | Specific use of a trust signal: routing, self-model update, RAG weighting, dashboard badge, release promotion. |
| `AuditEvent` | Immutable record of a trust-affecting mutation. |
| `SealedEvidence` | Evidence whose existence/metadata are visible, but raw content is restricted. |

## 4. Subject model

Initial subject types:

```text
human
agent
tool
model
memory
project
artifact
repository
autonomous_cycle
rag_source
dashboard_component
service
benchmark
```

Minimum subject fields:

```yaml
Subject:
  id: string
  type: enum
  name: string
  namespace: string
  external_refs: array
  owner_ref: string?
  status: active | archived | deprecated | deleted_soft
  created_at: datetime
  updated_at: datetime
```

## 5. Domain model

Domains define evidence expectations and risk.

Example domains:

```text
agent-capability
repository-quality
benchmark-performance
release-readiness
security-posture
privacy-compliance
rag-grounding
memory-provenance
autonomous-build-quality
dashboard-readiness
tool-novelty
```

Minimum domain fields:

```yaml
Domain:
  id: string
  slug: string
  name: string
  description: string
  risk_class: low | medium | high
  required_evidence_types: string[]
  required_verification_methods: string[]
  scoring_profile: string
```

## 6. Claim model

```yaml
Claim:
  id: string
  subject_id: string
  domain_id: string
  claimant_id: string
  statement: string
  claim_type: capability | quality | performance | compliance | provenance | identity | release_readiness | novelty
  status: draft | submitted | under_review | partially_verified | verified | disputed | rejected | expired | revoked | superseded
  sensitivity: public | internal | restricted | sealed
  valid_from: datetime?
  valid_until: datetime?
  supersedes_claim_id: string?
  tags: string[]
  metadata: object
  created_at: datetime
  updated_at: datetime
```

## 7. Evidence model

```yaml
Evidence:
  id: string
  evidence_type: document | url | repository_commit | test_result | benchmark_run | audit_event | approval_record | memory_record | log_excerpt | human_attestation | dataset_snapshot | model_card | release_artifact | security_scan
  title: string
  summary: string
  content_ref: string?
  content_hash: string?
  source_kind: user | git | ci | benchmark | becomussy | ragussy | clawdeck | ussyhub | external
  source_ref: string
  submitted_by: string
  observed_at: datetime?
  submitted_at: datetime
  access_policy_id: string
  retention_policy_id: string?
  metadata: object
```

Claim/evidence relation:

```yaml
ClaimEvidence:
  id: string
  claim_id: string
  evidence_id: string
  relation: supports | contradicts | contextualizes | invalidates | supersedes
  weight_hint: low | medium | high
  rationale: string
  linked_by: string
  linked_at: datetime
```

## 8. Benchmark evidence requirements

Benchmark evidence is first-class because Ussyverse promotion should be measurable.

```yaml
BenchmarkEvidence:
  benchmark_name: string
  benchmark_version: string
  task_class: string
  baseline_name: string
  candidate_name: string
  metric_name: string
  metric_value: number
  baseline_value: number?
  threshold: number?
  sample_size: integer
  run_id: string
  environment_ref: string
  commit_hash: string?
  repro_command: string?
  artifact_hash: string?
  pass: boolean
  limitations: string[]
```

## 9. Verification model

```yaml
Verification:
  id: string
  claim_id: string
  verifier_id: string
  verification_type: manual | automated | hybrid | delegated
  method: string
  method_version: string?
  decision: accepted | partially_accepted | rejected | inconclusive | disputed
  confidence: low | medium | high
  rationale: string
  evidence_ids: string[]
  limitations: string[]
  expires_at: datetime?
  created_at: datetime
  metadata: object
```

Method examples:

```text
manual-review
benchmark-replay
test-suite-execution
repository-inspection
source-provenance-check
memory-audit-check
policy-engine-evaluation
security-scan-review
human-steward-approval
```

## 10. Claim lifecycle

```text
draft
  → submitted
  → under_review
  → partially_verified | verified | rejected | disputed

verified | partially_verified
  → disputed | expired | revoked | superseded

disputed
  → under_review | rejected | partially_verified | verified | revoked
```

Rules:

1. A claim cannot become `verified` without at least one verification record.
2. High-risk domains require governance approval before `verified` trust application.
3. Contradicting evidence can move a claim to `disputed`.
4. Expired evidence reduces trust or moves claims to `expired`.
5. Revocation never deletes history.
6. Supersession must link old and new claims.
7. Any trust-affecting mutation emits an audit event.

## 11. Trust signal model

```yaml
TrustSignal:
  id: string
  claim_id: string?
  subject_id: string
  domain_id: string
  trust_state: unverified | weak | moderate | strong | disputed | expired | revoked
  score: number # 0.0-1.0
  confidence: low | medium | high
  components:
    evidence_strength: number
    verification_strength: number
    provenance_quality: number
    benchmark_quality: number
    recency: number
    contradiction_penalty: number
    risk_adjustment: number
    governance_status: number
  explanation: string
  computed_at: datetime
  valid_until: datetime?
  scoring_profile_version: string
```

Trust signals are projections, not universal truth. Every consumer must know the domain, scoring profile, and limitations.

## 12. Privacy and visibility

Visibility levels:

```text
public
internal
restricted
sealed
```

Disclosure modes:

```text
raw_available
summary_only
metadata_only
sealed_reference
redacted
external_pointer
```

Default policy:

- raw evidence is restricted unless explicitly public,
- public output uses summaries/proof cards,
- private logs/transcripts remain sealed or restricted,
- access to evidence emits audit events,
- external AI processing of sensitive evidence requires policy approval,
- trust scores must explain privacy limitations without leaking raw evidence.

## 13. Audit events

Event types:

```text
claim.created
claim.submitted
claim.status_changed
claim.superseded
claim.revoked
evidence.registered
evidence.linked
evidence.access_changed
verification.created
verification.decision_recorded
trust_signal.computed
trust_application.applied
dispute.opened
dispute.resolved
governance.approval_required
governance.approved
governance.rejected
```

Envelope:

```yaml
AuditEvent:
  id: string
  type: string
  actor_id: string?
  occurred_at: datetime
  subject_refs: object
  payload: object
  previous_hash: string?
  event_hash: string?
```

## 14. Initial API surface

```text
GET  /health
GET  /domains
POST /subjects
GET  /subjects/{id}
GET  /subjects/{id}/trust
POST /claims
GET  /claims/{id}
POST /claims/{id}/submit
POST /claims/{id}/status
POST /evidence
POST /claims/{id}/evidence-links
POST /claims/{id}/verifications
POST /claims/{id}/disputes
POST /trust-signals/recompute
GET  /claims/{id}/audit
GET  /events
```

## 15. Integration contracts

### Hermes
- Submit task outcome claims.
- Attach diffs, tests, transcripts, and benchmark results.
- Query trust before relying on tools/memories.

### Becomussy
- Provides approval records, audit logs, witnesses, governance triggers, and memory IDs as evidence.
- Receives high-risk self-model/capability upgrade requests.

### Ragussy
- Consumes source trust signals for retrieval weighting.
- Surfaces evidence status in citations.

### ClawDeck
- Displays claim review queues, trust cards, disputed claims, stale benchmarks, and promotion gate status.

### UssyHub
- Exposes trust APIs to ecosystem services.
- Publishes event streams and routes integration clients.

### Autonomous build cycles
- Emit improvement claims with test/benchmark artifacts.
- Promotion requires verified or partially verified claims meeting threshold.

## 16. MVP cut

MVP must include:

- subject registry,
- domain registry,
- claim CRUD and lifecycle,
- evidence registration/linking,
- manual verification records,
- basic trust projection,
- append-only audit log,
- privacy labels and summary-only evidence,
- REST API,
- example claim packages,
- benchmark evidence schema.

Post-MVP:

- automated verification runners,
- cryptographic attestations,
- advanced scoring profiles,
- trust decay scheduler,
- ClawDeck review UI,
- Ragussy weighting adapter,
- UssyHub event federation.
