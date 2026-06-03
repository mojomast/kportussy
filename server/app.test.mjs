import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from './store.mjs';
import { createApp } from './app.mjs';

function testApp() {
  const dir = mkdtempSync(join(tmpdir(), 'kportussy-'));
  const store = createStore(join(dir, 'db.json'));
  const app = createApp(store);
  return { app, store, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

async function req(app, path, init) {
  const res = await app(new Request(`http://test.local/api${path}`, init));
  return { res, body: await res.json() };
}

describe('live Kportussy API', () => {
  it('serves health/dashboard/claims/events from persistent seed store', async () => {
    const { app, cleanup } = testApp();
    try {
      const health = await req(app, '/health');
      expect(health.res.status).toBe(200);
      expect(health.body.claims).toBeGreaterThanOrEqual(4);
      const dashboard = await req(app, '/dashboard');
      expect(dashboard.body.mode).toBe('live');
      expect(dashboard.body.metrics.evidenceCount).toBeGreaterThan(0);
      const claims = await req(app, '/claims');
      expect(claims.body.claims[0].evidence[0].sourceRef).not.toContain('session:k-port-review');
      const events = await req(app, '/events');
      expect(events.body.events.length).toBeGreaterThan(0);
    } finally { cleanup(); }
  });

  it('creates claim, links evidence, verifies, recomputes, and emits audit events', async () => {
    const { app, cleanup } = testApp();
    try {
      const created = await req(app, '/claims', { method: 'POST', body: JSON.stringify({ subject: { id: 'tool-x', name: 'Tool X', type: 'tool', namespace: 'test' }, domain: 'tool-novelty', statement: 'Tool X is useful when evidence says so.', trustApplication: 'test routing' }) });
      expect(created.res.status).toBe(201);
      const claimId = created.body.id;
      await req(app, `/claims/${claimId}/evidence-links`, { method: 'POST', body: JSON.stringify({ summary: 'Seed benchmark stub', relation: 'supports', sensitivity: 'public' }) });
      await req(app, `/claims/${claimId}/verifications`, { method: 'POST', body: JSON.stringify({ method: 'unit-test', decision: 'partially_accepted', rationale: 'test' }) });
      const recomputed = await req(app, '/trust-signals/recompute', { method: 'POST', body: JSON.stringify({ claimId }) });
      expect(recomputed.body.trust.score).toBeGreaterThan(0);
      const events = await req(app, '/events');
      const types = events.body.events.map((e) => e.type);
      expect(types).toContain('claim.created');
      expect(types).toContain('evidence.linked');
      expect(types).toContain('verification.created');
      expect(types).toContain('trust_signal.computed');
    } finally { cleanup(); }
  });

  it('blocks high-risk verification when anti-slop gate fails', async () => {
    const { app, cleanup } = testApp();
    try {
      const blocked = await req(app, '/claims/claim-build-cycle-promotion/status', { method: 'POST', body: JSON.stringify({ status: 'verified' }) });
      expect(blocked.res.status).toBe(400);
      expect(blocked.body.error).toContain('governance');
    } finally { cleanup(); }
  });
});
