#!/usr/bin/env node
/**
 * bigdata-register-source.js
 * Usage: node scripts/bigdata-register-source.js --name my-source --type dashboard --description "My source"
 */

const BASE = process.env.BIGDATA_API || 'http://localhost:4001/api/bigdata';
const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i += 2) {
  opts[args[i].replace('--','')] = args[i+1];
}

if (!opts.name || !opts.type) {
  console.error('Required: --name <name> --type <type>');
  console.error('Example:  node bigdata-register-source.js --name ubereats --type ubereats --description "UberEats orders"');
  process.exit(1);
}

async function main() {
  const res = await fetch(`${BASE}/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  const data = await res.json();
  if (data.ok) console.log('✅ Registered:', data.source.name, '(id:', data.source.id + ')');
  else console.error('❌', data.error);
}

main().catch(e => { console.error(e); process.exit(1); });
