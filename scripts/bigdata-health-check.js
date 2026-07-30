#!/usr/bin/env node
/**
 * bigdata-health-check.js
 * Usage: node scripts/bigdata-health-check.js
 */

const BASE = process.env.BIGDATA_API || 'http://localhost:4001/api/bigdata';

async function main() {
  console.log('Mi Big Data — Health Check\n' + '='.repeat(40));
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok && res.status !== 207) {
      console.error(`Cannot read health endpoint: HTTP ${res.status}`);
      process.exitCode = 1;
      return;
    }
    const data = await res.json();
    const icon = s => s === 'ok' ? '[OK]' : '[DOWN]';
    console.log(`${icon(data.postgres)} PostgreSQL: ${data.postgres || 'unknown'}`);
    console.log(`${icon(data.minio)} MinIO: ${data.minio || 'unknown'}`);
    console.log(`${icon(data.qdrant)} Qdrant: ${data.qdrant || 'unknown'}`);
    console.log(`\nOverall: ${data.overall === 'ok' ? '[OK]' : '[DEGRADED]'}`);

    if (data.overall !== 'ok') {
      console.log('\nSetup: cd infra/bigdata && docker-compose up -d');
      process.exitCode = 1;
      return;
    }
  } catch (e) {
    console.error('[DOWN] Cannot reach Mi-Core server:', e instanceof Error ? e.message : String(e));
    console.log('Start server: cd server && npm run dev');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('[ERROR] Health check failed:', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
