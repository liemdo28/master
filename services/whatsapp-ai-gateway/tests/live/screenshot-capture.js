/**
 * Screenshot Capture — Phase 2.5
 * Fetches dashboard pages and saves them as HTML snapshots + uses the /qr endpoint.
 * Requires the gateway to be running (npm start).
 *
 * Usage:
 *   node tests/live/screenshot-capture.js [--port 3210]
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv.find(a => a.match(/^\d+$/)) || process.env.DASHBOARD_PORT || '3210');
const BASE = `http://localhost:${PORT}`;
const SCREENSHOTS_DIR = path.resolve('./screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function get(url) {
  return new Promise((resolve, reject) => {
    const req = (url.startsWith('https') ? https : http).get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function capture() {
  console.log(`\nCapturing dashboard at ${BASE}...\n`);

  const captures = [
    { url: `${BASE}/`,           file: 'dashboard-status.html',      label: 'Dashboard main' },
    { url: `${BASE}/health`,     file: 'health-check.json',          label: 'Health endpoint' },
    { url: `${BASE}/api/stats`,  file: 'api-stats.json',             label: 'Stats API' },
    { url: `${BASE}/api/messages?limit=20`, file: 'api-messages.json', label: 'Messages API' },
    { url: `${BASE}/api/safety`, file: 'api-safety.json',            label: 'Safety state' },
  ];

  let ok = 0; let failed = 0;

  for (const capture of captures) {
    const { url, file, label } = capture;
    try {
      const { status, body } = await get(url);
      const outPath = path.join(SCREENSHOTS_DIR, file);
      fs.writeFileSync(outPath, body);
      console.log(`  ✅  ${label} (${status}) → screenshots/${file} [${body.length} bytes]`);
      ok++;
    } catch (err) {
      console.log(`  ❌  ${label} — ${err.message}`);
      failed++;
    }
  }

  // Try QR endpoint (only available before scan)
  try {
    const { status, body } = await get(`${BASE}/qr`);
    if (status === 200) {
      const qrPath = path.join(SCREENSHOTS_DIR, 'qr-code.png');
      fs.writeFileSync(qrPath, body);
      console.log(`  ✅  QR code → screenshots/qr-code.png`);
      ok++;
    } else {
      console.log(`  ℹ️   QR endpoint returned ${status} — likely already scanned`);
    }
  } catch (err) {
    console.log(`  ℹ️   QR endpoint — ${err.message}`);
  }

  // Generate summary snapshot
  const summary = {
    captured_at: new Date().toISOString(),
    dashboard_url: BASE,
    files: captures.map(c => c.file),
  };
  fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'capture-summary.json'), JSON.stringify(summary, null, 2));

  console.log(`\n  ${ok} captures saved, ${failed} failed`);
  console.log(`  📁  All files in ./screenshots/\n`);

  if (failed > 0) {
    console.log('  ⚠️  Is the gateway running? (npm start)\n');
    process.exit(1);
  }
}

capture().catch(err => {
  console.error('Capture error:', err.message);
  console.log('\n  Make sure the gateway is running: npm start\n');
  process.exit(1);
});
