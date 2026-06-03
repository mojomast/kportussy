import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from './store.mjs';
import { runCli } from './cli.mjs';

function testStore() {
  const dir = mkdtempSync(join(tmpdir(), 'kportussy-cli-'));
  const store = createStore(join(dir, 'db.json'));
  return { store, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

async function capture(argv, store) {
  let output = '';
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    output += String(chunk);
    return true;
  });
  try {
    const code = await runCli(argv, store);
    return { code, body: JSON.parse(output) };
  } finally {
    spy.mockRestore();
  }
}

describe('Kportussy CLI', () => {
  it('lists seeded claims and health from the persistent store', async () => {
    const { store, cleanup } = testStore();
    try {
      const health = await capture(['health'], store);
      expect(health.code).toBe(0);
      expect(health.body.database).toBe('json-file');
      const claims = await capture(['claims'], store);
      expect(claims.body.claims.length).toBeGreaterThanOrEqual(4);
      expect(claims.body.claims[0].evidence[0].sourceRef).toBe('restricted_reference');
    } finally { cleanup(); }
  });

  it('creates evidence-to-trust records without the HTTP server', async () => {
    const { store, cleanup } = testStore();
    try {
      const created = await capture(['create-claim', JSON.stringify({
        subject: { id: 'cli-tool', name: 'CLI Tool', type: 'tool', namespace: 'test' },
        domain: 'operator-workflow',
        statement: 'The CLI can record evidence-backed trust records.',
        actorId: 'vitest'
      })], store);
      const claimId = created.body.id;
      await capture(['add-evidence', claimId, JSON.stringify({ summary: 'CLI test evidence', relation: 'supports', sensitivity: 'public', actorId: 'vitest' })], store);
      await capture(['add-verification', claimId, JSON.stringify({ method: 'unit-test', decision: 'accepted', confidence: 'high', rationale: 'round trip passed', actorId: 'vitest' })], store);
      const trusted = await capture(['recompute-trust', claimId, 'vitest'], store);
      expect(trusted.body.trust.score).toBeGreaterThan(0.25);
      const events = await capture(['events', '10'], store);
      expect(events.body.events.map((event) => event.type)).toContain('trust_signal.computed');
    } finally { cleanup(); }
  });
});
