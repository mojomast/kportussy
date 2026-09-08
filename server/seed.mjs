import { createStore } from './store.mjs';
// Initialization is idempotent, never a destructive reset. Honors KPORTUSSY_DB_PATH.
const store=createStore();
console.log(`opened ${store.state.claims.length} claims, ${store.state.events.length} events in ${store.path}; existing history preserved`);
