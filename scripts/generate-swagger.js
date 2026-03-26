'use strict';

/**
 * scripts/generate-swagger.js
 *
 * Reads the OpenAPI spec from docs/openapi.yaml, validates it,
 * and writes a formatted docs/openapi.json alongside it.
 *
 * Usage:
 *   node scripts/generate-swagger.js
 *   npm run docs
 */

const fs   = require('fs');
const path = require('path');
const YAML = require('yamljs');

const SRC  = path.resolve(__dirname, '../docs/openapi.yaml');
const DEST = path.resolve(__dirname, '../docs/openapi.json');

console.log('📄  Loading OpenAPI spec from:', SRC);

if (!fs.existsSync(SRC)) {
  console.error('❌  openapi.yaml not found — expected at docs/openapi.yaml');
  process.exit(1);
}

let spec;
try {
  spec = YAML.load(SRC);
} catch (err) {
  console.error('❌  Failed to parse openapi.yaml:', err.message);
  process.exit(1);
}

// ── Basic structural validation ───────────────────────────────────────────────
const required = ['openapi', 'info', 'paths'];
for (const field of required) {
  if (!spec[field]) {
    console.error(`❌  Missing required OpenAPI field: "${field}"`);
    process.exit(1);
  }
}

const pathCount    = Object.keys(spec.paths).length;
const schemaCount  = Object.keys(spec.components?.schemas || {}).length;
const version      = spec.info?.version || 'unknown';

console.log(`✅  Spec valid — version ${version}, ${pathCount} paths, ${schemaCount} schemas`);

// ── Write JSON output ─────────────────────────────────────────────────────────
fs.writeFileSync(DEST, JSON.stringify(spec, null, 2), 'utf8');
console.log('✅  JSON spec written to:', DEST);

// ── Print route summary to stdout ─────────────────────────────────────────────
console.log('\n📋  Route summary:\n');
for (const [route, methods] of Object.entries(spec.paths)) {
  for (const method of Object.keys(methods)) {
    const op = methods[method];
    const tags    = (op.tags || []).join(', ') || '—';
    const summary = op.summary || '';
    console.log(`  ${method.toUpperCase().padEnd(7)} ${route.padEnd(35)} [${tags}]  ${summary}`);
  }
}

console.log('\n🎉  Done. Swagger UI reads docs/openapi.yaml at runtime (/api-docs).');
console.log('     The generated docs/openapi.json can be imported into Postman or Insomnia.\n');
