import { readFileSync } from 'node:fs';

const schema = JSON.parse(readFileSync('schemas/claim.schema.json', 'utf8'));
const example = JSON.parse(readFileSync('examples/hermes-capability.claim.json', 'utf8'));
const requiredTop = schema.required ?? [];
const missing = requiredTop.filter((key) => !(key in example));
if (missing.length) {
  console.error(`example missing required top-level keys: ${missing.join(', ')}`);
  process.exit(1);
}
if (!Array.isArray(example.evidence) || example.evidence.length === 0) {
  console.error('example must include evidence');
  process.exit(1);
}
console.log('claim example passes lightweight validation');
