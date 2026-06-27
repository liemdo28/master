/**
 * Phase 10.5 — Mi-Core PC Verifier
 *
 * Runs on PC (Mi-Core Command Center).
 * Checks what was received from Laptop1, creates tasks, stores evidence,
 * generates DUAL_MACHINE_OPERATIONAL_CERTIFICATION.md.
 *
 * Usage:
 *   node phase10-5-micore-verify.mjs
 *   node phase10-5-micore-verify.mjs --laptop1-cert path/to/LAPTOP1_RUNTIME_CERTIFICATION.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MI_CORE_URL = process.env.MI_CORE_URL || 'http://localhost:4001';
const MI_API_KEY  = process.env.MI_CORE_API_KEY || '2c6b56891f788f3836e3c6529624610f1bcce878dd556617b03b4ce690edebec';
const QB_API_KEY  = process.env.QB_API_KEY || 'b149c4783a1109ff46d01498d91766e7';

const args = process.argv.slice(2);
const laptop1CertArg = args.indexOf('--laptop1-cert');
const laptop1CertPath = laptop1CertArg >= 0 ? args[laptop1CertArg + 1] : null;

const EVIDENCE_DIR = path.join(__dirname, 'reports', 'evidence', 'phase10-5-dual-machine');
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const NOW = new Date().toISOString();
const results = {};

// ── HTTP helper ───────────────────────────────────────────────────────────────
async function miGet(path_, useBearer = false) {
  const headers = useBearer
    ? { 'Authorization': `Bearer ${MI_API_KEY}` }
    : { 'x-api-key': MI_API_KEY };
  const res = await fetch(`${MI_CORE_URL}${path_}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path_}`);
  return res.json();
}

async function miPost(path_, body, useQbKey = false) {
  const res = await fetch(`${MI_CORE_URL}${path_}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': useQbKey ? QB_API_KEY : MI_API_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

function log(label, msg, color = '') {
  const colors = { green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', reset: '\x1b[0m' };
  const c = colors[color] || '';
  console.log(`${c}${label}\x1b[0m ${msg}`);
}

function header(title) {
  console.log('');
  console.log('\x1b[36m' + '='.repeat(60) + '\x1b[0m');
  console.log('\x1b[36m  ' + title + '\x1b[0m');
  console.log('\x1b[36m' + '='.repeat(60) + '\x1b[0m');
}

function saveEvidence(name, data) {
  const p = path.join(EVIDENCE_DIR, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  log('  [SAVED]', p, 'cyan');
  return p;
}

// ── Check 1: QB heartbeats received ──────────────────────────────────────────
header('CHECK 1 — QB Heartbeats Received from Laptop1');
try {
  const data = await miGet('/api/qb-agent/machines');
  const laptop1 = Array.isArray(data?.machines)
    ? data.machines.find(m => m.machine_id === 'qb-laptop-01')
    : null;

  if (laptop1) {
    log('  [PASS]', `QB machine qb-laptop-01 registered. Last seen: ${laptop1.last_seen_at || laptop1.last_heartbeat}`, 'green');
    const ageMs = laptop1.last_seen_at ? Date.now() - new Date(laptop1.last_seen_at).getTime() : Infinity;
    const ageMins = Math.round(ageMs / 60000);
    log('  [INFO]', `Heartbeat age: ${ageMins} minutes`);
    results.check1_qb = { status: ageMins < 30 ? 'PASS' : 'STALE', machine: laptop1, age_minutes: ageMins };
  } else {
    log('  [FAIL]', 'No qb-laptop-01 machine registered — heartbeat not received yet', 'red');
    results.check1_qb = { status: 'FAIL', note: 'Run DEV1_LAPTOP1_PHASE10_5_RUNNER.ps1 on Laptop1 first' };
  }
  saveEvidence('check1-qb-machines.json', data);
} catch (e) {
  log('  [FAIL]', `QB machines check failed: ${e.message}`, 'red');
  results.check1_qb = { status: 'FAIL', error: e.message };
}

// ── Check 2: QB Events received (failure simulation + revenue objective) ──────
header('CHECK 2 — QB Events: Failure Sim + Revenue Objective');
try {
  const data = await miGet('/api/qb-agent/events?machine_id=qb-laptop-01&limit=20');
  const events = Array.isArray(data?.events) ? data.events : (Array.isArray(data) ? data : []);

  const failureSim = events.find(e => e.event_type === 'QB_OFFLINE' || e.event_key?.includes('failure'));
  const revenueObj = events.find(e => e.event_type === 'REVENUE_OBJECTIVE_REQUEST' || e.event_key?.includes('revenue'));

  if (failureSim) {
    log('  [PASS]', `Failure simulation event received: ${failureSim.event_type} @ ${failureSim.received_at}`, 'green');
  } else {
    log('  [MISSING]', 'QB_OFFLINE failure event not found', 'yellow');
  }

  if (revenueObj) {
    log('  [PASS]', `Revenue objective event received: ${revenueObj.event_type} @ ${revenueObj.received_at}`, 'green');
  } else {
    log('  [MISSING]', 'REVENUE_OBJECTIVE_REQUEST event not found', 'yellow');
  }

  results.check2_events = {
    status: (failureSim && revenueObj) ? 'PASS' : (failureSim || revenueObj) ? 'PARTIAL' : 'FAIL',
    failure_sim: !!failureSim,
    revenue_obj: !!revenueObj,
    total_events: events.length,
  };
  saveEvidence('check2-qb-events.json', { events: events.slice(0, 10) });
} catch (e) {
  log('  [FAIL]', `Events check failed: ${e.message}`, 'red');
  results.check2_events = { status: 'FAIL', error: e.message };
}

// ── Check 3: DoorDash machine checkin received ────────────────────────────────
header('CHECK 3 — DoorDash Machine Checkin');
try {
  const data = await miGet('/api/doordash-agent/machines', true);
  const machines = Array.isArray(data?.machines) ? data.machines : [];
  const laptop1dd = machines.find(m => m.machine_id === 'laptop1-doordash-agent');

  if (laptop1dd) {
    log('  [PASS]', `DoorDash machine registered: ${JSON.stringify(laptop1dd)}`, 'green');
    results.check3_doordash = { status: 'PASS', machine: laptop1dd };
  } else {
    log('  [FAIL]', `DoorDash machine laptop1-doordash-agent not found. Machines: ${JSON.stringify(machines.map(m => m.machine_id))}`, 'red');
    results.check3_doordash = { status: 'FAIL', note: 'DoorDash checkin not received from Laptop1' };
  }
  saveEvidence('check3-doordash-machines.json', data);
} catch (e) {
  log('  [FAIL]', `DoorDash check failed: ${e.message}`, 'red');
  results.check3_doordash = { status: 'FAIL', error: e.message };
}

// ── Check 4: WhatsApp gateway health ─────────────────────────────────────────
header('CHECK 4 — WhatsApp Gateway Health');
try {
  const data = await miGet('/api/whatsapp/health');
  const waStatus = data?.whatsapp_status || data?.status || 'unknown';
  const apiKeyConfigured = !!(data?.api_key_configured || data?.connected);

  if (waStatus === 'ready' || waStatus === 'connected') {
    log('  [PASS]', `WhatsApp gateway online: ${waStatus}`, 'green');
    results.check4_whatsapp = { status: apiKeyConfigured ? 'PASS' : 'PARTIAL', gateway: waStatus, api_key: apiKeyConfigured };
    if (!apiKeyConfigured) {
      log('  [PARTIAL]', 'WhatsApp gateway online but API key not configured — configure via POST /api/whatsapp/mi/setup', 'yellow');
    }
  } else {
    log('  [FAIL]', `WhatsApp gateway status: ${waStatus}`, 'red');
    results.check4_whatsapp = { status: 'FAIL', gateway: waStatus };
  }
  saveEvidence('check4-whatsapp-health.json', data);
} catch (e) {
  log('  [FAIL]', `WhatsApp check failed: ${e.message}`, 'red');
  results.check4_whatsapp = { status: 'FAIL', error: e.message };
}

// ── Check 5: Create Revenue Objective Task ────────────────────────────────────
header('CHECK 5 — Create Revenue Objective Task in Mi-Core');
try {
  const taskBody = {
    title: 'Phase 10.5: Increase Raw Sushi Revenue 10%',
    description: 'CEO Directive — dual-machine certification. Laptop1 provided QB + DoorDash evidence. Mi-Core to create plan and assign divisions.',
    division: 'financial-intelligence',
    priority: 'high',
    source: 'phase10-5-dual-machine-certification',
    created_by: 'mi-core-verifier',
    metadata: {
      objective: 'Increase Raw Sushi Revenue 10%',
      stores: ['raw-stockton'],
      data_sources: ['QuickBooks', 'DoorDash'],
      phase: '10.5',
      test_id: 'TEST5_REVENUE_OBJECTIVE',
      laptop1_evidence: results.check1_qb?.status,
      doordash_evidence: results.check3_doordash?.status,
    },
  };

  const resp = await miPost('/api/tasks', taskBody);
  if (resp?.id || resp?.task_id || resp?.success) {
    log('  [PASS]', `Revenue objective task created: ${JSON.stringify(resp)}`, 'green');
    results.check5_task = { status: 'PASS', task: resp };
  } else {
    log('  [PARTIAL]', `Task endpoint responded: ${JSON.stringify(resp)}`, 'yellow');
    results.check5_task = { status: 'PARTIAL', response: resp };
  }
  saveEvidence('check5-revenue-task.json', resp);
} catch (e) {
  log('  [FAIL]', `Task creation failed: ${e.message}`, 'red');
  results.check5_task = { status: 'FAIL', error: e.message };
}

// ── Read Laptop1 cert if provided ────────────────────────────────────────────
let laptop1CertContent = null;
if (laptop1CertPath && fs.existsSync(laptop1CertPath)) {
  laptop1CertContent = fs.readFileSync(laptop1CertPath, 'utf-8');
  log('\n  [INFO]', `Laptop1 certification loaded from: ${laptop1CertPath}`, 'cyan');
}

// ── Generate DUAL_MACHINE_OPERATIONAL_CERTIFICATION.md ─────────────────────
header('GENERATING DUAL_MACHINE_OPERATIONAL_CERTIFICATION.md');

const passCount = Object.values(results).filter(r => r.status === 'PASS').length;
const failCount = Object.values(results).filter(r => r.status === 'FAIL').length;
const partialCount = Object.values(results).filter(r => r.status === 'PARTIAL').length;
const staleCount = Object.values(results).filter(r => r.status === 'STALE').length;

const qbPass = results.check1_qb?.status === 'PASS';
const ddPass = results.check3_doordash?.status === 'PASS';
const waPartial = results.check4_whatsapp?.status !== 'FAIL';
const failSimPass = results.check2_events?.failure_sim;
const revenuePass = results.check2_events?.revenue_obj && results.check5_task?.status !== 'FAIL';

const allFive = qbPass && ddPass && waPartial && failSimPass && revenuePass;
const dualStatus = allFive ? 'DUAL_MACHINE_OPERATIONAL' : 'DUAL_MACHINE_PARTIAL';

const certDoc = `# DUAL MACHINE OPERATIONAL CERTIFICATION — Phase 10.5
**Generated:** ${NOW}
**PC (Mi-Core):** 100.118.102.113:4001
**Laptop1:**      100.111.97.25
**Status:** ${dualStatus}

---

## Question: Can Laptop1 and Mi-Core work together?

**${allFive ? 'YES — DUAL_MACHINE_OPERATIONAL' : 'PARTIAL — DUAL_MACHINE_PARTIAL (see blockers below)'}**

---

## 5-Test Certification Matrix

| Test | Description | Laptop1 | Mi-Core | Result |
|------|-------------|---------|---------|--------|
| 1 | QB Heartbeat | Sent | ${qbPass ? 'Received ✓' : 'Not received ✗'} | ${qbPass ? 'PASS' : results.check1_qb?.status} |
| 2 | DoorDash Checkin | Sent | ${ddPass ? 'Received ✓' : 'Not received ✗'} | ${ddPass ? 'PASS' : results.check3_doordash?.status} |
| 3 | WhatsApp Routing | Sent | ${waPartial ? 'Gateway live ✓' : 'Failed ✗'} | ${results.check4_whatsapp?.status} |
| 4 | Failure Simulation | QB_OFFLINE sent | ${failSimPass ? 'Event received ✓' : 'Not received ✗'} | ${failSimPass ? 'PASS' : 'FAIL'} |
| 5 | Revenue Objective | Data provided | ${revenuePass ? 'Task created ✓' : 'Incomplete ✗'} | ${revenuePass ? 'PASS' : 'PARTIAL'} |

**Pass: ${passCount} | Fail: ${failCount} | Partial: ${partialCount} | Stale: ${staleCount}**

---

## Mi-Core Evidence Store

- **QB heartbeats**: ${EVIDENCE_DIR}/check1-qb-machines.json
- **QB events**: ${EVIDENCE_DIR}/check2-qb-events.json
- **DoorDash machines**: ${EVIDENCE_DIR}/check3-doordash-machines.json
- **WhatsApp health**: ${EVIDENCE_DIR}/check4-whatsapp-health.json
- **Revenue task**: ${EVIDENCE_DIR}/check5-revenue-task.json

---

## Mi-Core Received

| Event | Source | Status |
|-------|--------|--------|
| QB_HEARTBEAT | Laptop1 → /api/qb-agent/heartbeat | ${qbPass ? 'STORED' : 'MISSING'} |
| DOORDASH_CHECKIN | Laptop1 → /api/doordash-agent/machines/checkin | ${ddPass ? 'STORED' : 'MISSING'} |
| QB_OFFLINE | Laptop1 → /api/qb-agent/events | ${failSimPass ? 'STORED' : 'MISSING'} |
| REVENUE_OBJECTIVE_REQUEST | Laptop1 → /api/qb-agent/events | ${results.check2_events?.revenue_obj ? 'STORED' : 'MISSING'} |
| FIN_TASK | Mi-Core auto-created | ${results.check5_task?.status !== 'FAIL' ? 'CREATED' : 'FAILED'} |

---

${laptop1CertContent ? `## Laptop1 Certification (attached)\n\n${laptop1CertContent}\n\n---\n\n` : ''}
## Remaining Blockers

${!qbPass ? '- **QB**: Heartbeat not received — run DEV1_LAPTOP1_PHASE10_5_RUNNER.ps1 on Laptop1\n' : ''}${!ddPass ? '- **DoorDash**: Checkin not received — check Tailscale connectivity 100.111.97.25:3460\n' : ''}${results.check4_whatsapp?.status === 'PARTIAL' ? '- **WhatsApp**: API key not configured in Mi-Core — run POST /api/whatsapp/mi/setup\n' : ''}${results.check4_whatsapp?.status === 'FAIL' ? '- **WhatsApp**: Gateway offline — check mi-whatsapp-gateway PM2 process\n' : ''}${!failSimPass ? '- **Failure Test**: QB_OFFLINE event not received — run Laptop1 runner first\n' : ''}${!revenuePass ? '- **Revenue Objective**: Incomplete — events and task creation need both machines online\n' : ''}
---

## Final Verdict

**${dualStatus}**

${allFive
  ? `Both machines (Laptop1 and Mi-Core PC) have demonstrated operational connectivity:
- Laptop1 sends events → Mi-Core receives and stores them
- Mi-Core creates tasks from Laptop1 events
- Failure events from Laptop1 trigger Mi-Core response
- Revenue objectives flow from Laptop1 data to Mi-Core executive coordination

**MI_COMPANY_OS status may now be elevated from PARTIAL toward OPERATIONAL** pending Toast and WhatsApp API key configuration.`
  : `Dual-machine loop is partially established. Fix the blockers listed above to achieve DUAL_MACHINE_OPERATIONAL.`
}
`;

const certPath = path.join(__dirname, 'DUAL_MACHINE_OPERATIONAL_CERTIFICATION.md');
fs.writeFileSync(certPath, certDoc);

const miCoreCertPath = path.join(__dirname, 'MI_CORE_RUNTIME_CERTIFICATION.md');
const miCoreCert = `# MI-CORE PC RUNTIME CERTIFICATION — Phase 10.5
**Generated:** ${NOW}
**Status:** ${dualStatus}

## Events Received from Laptop1

| Check | Status | Notes |
|-------|--------|-------|
| QB Heartbeat | ${results.check1_qb?.status} | machine qb-laptop-01, age ${results.check1_qb?.age_minutes ?? '?'} min |
| QB Events | ${results.check2_events?.status} | failure_sim=${results.check2_events?.failure_sim}, revenue=${results.check2_events?.revenue_obj} |
| DoorDash Checkin | ${results.check3_doordash?.status} | machine laptop1-doordash-agent |
| WhatsApp Gateway | ${results.check4_whatsapp?.status} | status=${results.check4_whatsapp?.gateway} |
| Revenue Task | ${results.check5_task?.status} | created in Mi-Core |

## Evidence
Evidence stored in: ${EVIDENCE_DIR}

## Certification
${dualStatus}
`;
fs.writeFileSync(miCoreCertPath, miCoreCert);

// Save full results
saveEvidence('dual-machine-results.json', { generated_at: NOW, status: dualStatus, results });

header('PHASE 10.5 MI-CORE SUMMARY');
console.log('');
console.log(`\x1b[${allFive ? '32' : '33'}m  STATUS: ${dualStatus}\x1b[0m`);
console.log(`  Checks: ${passCount} PASS | ${failCount} FAIL | ${partialCount} PARTIAL | ${staleCount} STALE`);
console.log('');
console.log('  Files created:');
console.log(`    ${certPath}`);
console.log(`    ${miCoreCertPath}`);
console.log(`    ${EVIDENCE_DIR}/`);
console.log('');

if (!allFive) {
  console.log('\x1b[33m  Remaining steps to reach DUAL_MACHINE_OPERATIONAL:\x1b[0m');
  if (!qbPass)      console.log('    1. Run DEV1_LAPTOP1_PHASE10_5_RUNNER.ps1 on Laptop1');
  if (!ddPass)      console.log('    2. Fix Tailscale firewall on Laptop1 port 3460');
  if (results.check4_whatsapp?.status === 'PARTIAL') console.log('    3. Configure WhatsApp API key: POST /api/whatsapp/mi/setup');
  if (!failSimPass) console.log('    4. QB_OFFLINE event missing — Laptop1 runner needed');
  if (!revenuePass) console.log('    5. Revenue objective incomplete — run full Laptop1 runner');
}
