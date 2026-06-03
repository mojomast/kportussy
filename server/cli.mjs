#!/usr/bin/env node
import { createStore } from './store.mjs';

function usage() {
  return `Kportussy CLI

Usage:
  npm run kportussy -- <command> [args]
  node server/cli.mjs <command> [args]

Commands:
  health
  dashboard
  claims
  claim <claim-id>
  create-claim '<json>'
  add-evidence <claim-id> '<json>'
  add-verification <claim-id> '<json>'
  set-status <claim-id> <status> [actor-id]
  recompute-trust <claim-id> [actor-id]
  events [limit]

The CLI writes to KPORTUSSY_DB_PATH when set, otherwise data/kportussy-live.json.
JSON mutation payloads use the same shape as the HTTP API.`;
}

function readJson(raw, label) {
  try {
    return JSON.parse(raw ?? '{}');
  } catch (error) {
    throw new Error(`${label} must be valid JSON: ${error.message}`);
  }
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export async function runCli(argv = process.argv.slice(2), store = createStore()) {
  const [command, ...args] = argv;
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }

  switch (command) {
    case 'health':
      print(store.health());
      return 0;
    case 'dashboard':
      print(store.dashboard());
      return 0;
    case 'claims':
      print({ claims: store.listClaims() });
      return 0;
    case 'claim': {
      const claim = store.getClaim(args[0]);
      if (!claim) throw new Error('claim not found');
      print(claim);
      return 0;
    }
    case 'create-claim':
      print(store.createClaim(readJson(args[0], 'claim payload')));
      return 0;
    case 'add-evidence':
      print(store.addEvidence(args[0], readJson(args[1], 'evidence payload')));
      return 0;
    case 'add-verification':
      print(store.addVerification(args[0], readJson(args[1], 'verification payload')));
      return 0;
    case 'set-status':
      print(store.updateStatus(args[0], args[1], args[2]));
      return 0;
    case 'recompute-trust':
      print(store.recomputeTrust(args[0], args[1]));
      return 0;
    case 'events':
      print({ events: store.events(Number(args[0] || 100)) });
      return 0;
    default:
      throw new Error(`unknown command: ${command}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(error.message);
    console.error('\n' + usage());
    process.exitCode = 1;
  });
}
