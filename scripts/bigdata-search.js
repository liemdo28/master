#!/usr/bin/env node
/**
 * bigdata-search.js
 * Usage: node scripts/bigdata-search.js "Stone Oak issue"
 *        npm run bigdata:search -- "DoorDash dispute"
 */

const BASE  = process.env.BIGDATA_API || 'http://localhost:4001/api/bigdata';
const query = process.argv.slice(2).join(' ');

if (!query) {
  console.error('Usage: node bigdata-search.js "<query>"');
  process.exit(1);
}

async function main() {
  console.log(`Searching: "${query}"\n`);
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  if (data.error) { console.error('Error:', data.error); process.exit(1); }
  console.log(`Found ${data.count} results:\n`);
  for (const r of data.results) {
    const store = r.store_id ? `[${r.store_id}]` : '';
    const type  = r.event_type || r.type || 'chunk';
    console.log(`  • ${store} [${type}] ${r.title} (score: ${r.score?.toFixed(2)})`);
    if (r.description) console.log(`    ${r.description.slice(0,120)}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
