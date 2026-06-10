#!/usr/bin/env node
/**
 * bigdata-health-check.js
 * Usage: node scripts/bigdata-health-check.js
 */

const BASE = process.env.BIGDATA_API || 'http://localhost:4001/api/bigdata';

async function main() {
  console.log('Mi Big Data — Health Check\n' + '='.repeat(40));
  try {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    const icon = s => s === 'ok' ? '✅' : '❌';
    console.log(`${icon(data.postgres)} PostgreSQL: ${data.postgres}`);
    console.log(`${icon(data.minio)}    MinIO:      ${data.minio}`);
    console.log(`${icon(data.qdrant)}   Qdrant:     ${data.qdrant}`);
    console.log(`\nOverall: ${data.overall === 'ok' ? '✅ OK' : '⚠️  DEGRADED'}`);

    if (data.overall !== 'ok') {
      console.log('\nSetup: cd infra/bigdata && docker-compose up -d');
      process.exit(1);
    }
  } catch (e) {
    console.error('❌ Cannot reach Mi-Core server:', e.message);
    console.log('Start server: cd server && npm run dev');
    process.exit(1);
  }
}

main();
