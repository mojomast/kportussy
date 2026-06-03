# Kportussy Dashboard

The dashboard is a fast React/Vite operator surface for Kportussy's evidence-to-trust pipeline.

## Run locally

```bash
npm install
npm run dev
```

Default dev URL: <http://127.0.0.1:5179>

## Build and test

```bash
npm run lint:data
npm test
npm run build
```

## Panels

- **Overview** — trust score, evidence count, verification coverage, privacy-sensitive evidence.
- **Claims** — claim cards with status, risk, evidence, verification, trust components, and anti-slop gate output.
- **Review Queue** — submitted/under-review/disputed/high-risk claims with next actions.
- **Evidence Graph** — visual claim → evidence relations with privacy sensitivity markers.
- **Roadmap** — 30/60/90 day milestones and acceptance criteria.
- **API Contract** — initial endpoints from the spec.

## MVP backend contract

The current dashboard is static/mock-data backed. The first backend cut should expose the endpoints listed in `docs/SPEC.md` and replace `src/data.ts` with API fetches.

Keep dashboard output privacy-safe: restricted/sealed evidence should show metadata and summaries, never raw private artifacts.
