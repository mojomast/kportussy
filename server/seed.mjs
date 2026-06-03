import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStore } from './store.mjs';
const path=resolve(process.cwd(),'data/kportussy-live.json');
try { rmSync(path); } catch {}
const store=createStore(path);
console.log(`seeded ${store.state.claims.length} claims, ${store.state.events.length} events into ${path}`);
