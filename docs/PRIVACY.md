# Privacy and Governance Model

## Defaults

- Raw evidence is restricted by default.
- Public views use proof cards and summaries.
- Every raw evidence access emits an audit event.
- External AI processing of restricted evidence requires explicit policy approval.
- Revocation/dispute preserves history but can redact sensitive details from public views.

## Visibility levels

| Level | Meaning |
|---|---|
| `public` | Safe for public proof cards. |
| `internal` | Visible to Ussyverse operators/services. |
| `restricted` | Reviewer/steward access only. |
| `sealed` | Metadata visible; content requires explicit grant. |

## Sensitive evidence examples

- private repo transcripts,
- user-specific memory content,
- raw logs with credentials/hostnames/usernames,
- security scan details,
- identity documents,
- moderation/governance notes,
- unreleased benchmark artifacts.

## Public proof card pattern

A proof card may show:

```yaml
claim_summary: Hermes has partially verified repo-review capability.
trust_state: moderate
verified_by: benchmark + steward review
last_verified: 2026-06-02
limitations:
  - private repo evidence is sealed
  - benchmark sample size is small
next_review_due: 2026-07-02
```

It must not show restricted raw evidence unless policy allows it.
