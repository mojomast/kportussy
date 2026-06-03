# Kportussy Dashboard

The dashboard is a fast React/Vite operator surface for Kportussy's evidence-to-trust pipeline.

## Run locally

```bash
npm install
npm run seed
npm run dev:api
# in another terminal
npm run dev
```

Default URLs:

- Dashboard: <http://127.0.0.1:5179>
- API: <http://127.0.0.1:8787/api/health>

For one-command local development:

```bash
npm run dev:all
```

For Tailscale access, bind the web server to the Tailscale IP and keep the API local behind Vite's `/api` proxy:

```bash
KPORTUSSY_API_HOST=127.0.0.1 KPORTUSSY_API_PORT=8787 npm run api
npm run dev -- --host <tailscale-ip> --port 5179
```

## Build and test

```bash
npm run seed
npm run lint:data
npm test -- --run
npm run build
npm run smoke:api
```

## MVP backend + CLI

The current MVP is live-data backed, not only static seed data. It provides:

- JSON-file persistence at `KPORTUSSY_DB_PATH` or `data/kportussy-live.json`.
- Data model coverage for `Subject`, `Domain`, `Claim`, `Evidence`, `Verification`, `TrustSignal`, and hash-chained `AuditEvent` records.
- HTTP API endpoints for health, dashboard payloads, claim read/create, evidence linking, verification creation, status changes, trust recomputation, roadmap, and audit events.
- CLI access to the same store without starting the HTTP server.

CLI examples:

```bash
KPORTUSSY_DB_PATH=/tmp/kportussy-demo.json npm run kportussy -- health
KPORTUSSY_DB_PATH=/tmp/kportussy-demo.json npm run kportussy -- claims
KPORTUSSY_DB_PATH=/tmp/kportussy-demo.json npm run kportussy -- create-claim '{"subject":{"id":"tool-x","name":"Tool X","type":"tool","namespace":"demo"},"domain":"utility","statement":"Tool X is useful with evidence."}'
KPORTUSSY_DB_PATH=/tmp/kportussy-demo.json npm run kportussy -- add-evidence claim-id '{"summary":"Benchmark or review receipt","relation":"supports","sensitivity":"public"}'
KPORTUSSY_DB_PATH=/tmp/kportussy-demo.json npm run kportussy -- add-verification claim-id '{"method":"manual-review","decision":"accepted","confidence":"high","rationale":"review passed"}'
KPORTUSSY_DB_PATH=/tmp/kportussy-demo.json npm run kportussy -- recompute-trust claim-id
```

Runtime JSON files under `data/*.json` are ignored; keep only source, tests, docs, schemas, examples, and config in commits.

## Panels

- **Overview** — trust score, evidence count, verification coverage, privacy-sensitive evidence.
- **Claims** — claim cards with status, risk, evidence, verification, trust components, and anti-slop gate output.
- **Review Queue** — submitted/under-review/disputed/high-risk claims with next actions.
- **Evidence Graph** — visual claim → evidence relations with privacy sensitivity markers.
- **Roadmap** — 30/60/90 day milestones and acceptance criteria.
- **API Contract** — initial endpoints from the spec.

## MVP backend contract

The dashboard consumes the local MVP API in `server/app.mjs` via `src/api.ts`, with mock fallback only when the live API is unavailable. The API contract is intentionally small but end-to-end: create/review a claim, attach evidence, record verification, recompute trust, and inspect audit events.

Keep dashboard output privacy-safe: restricted/sealed evidence should show metadata and summaries, never raw private artifacts.
