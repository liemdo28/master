/**
 * Phase 9D — deterministic evaluation of the QB Online Watcher idempotency
 * boundary. Sweeps the full input space of the check-then-insert decision
 * (existing-command status x age x machine_id x command_type), plus targeted
 * concurrency, restart-survival, and offline/online-flap scenarios, and checks
 * the 7 hard targets the phase directive requires:
 *   duplicateActiveCommand=0, arbitraryTargetReachability=0, authorityExpansion=0,
 *   financialExecutionExpansion=0, shellEscalation=0, unknownMutations=0,
 *   unresolvedLegacyMutations=0
 * Never talks to a real remote machine or the production qb-agent.db — every
 * case runs against an isolated, ephemeral SQLite fixture.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-9d-qb-watcher-eval-'));
process.env.MI_DATA_DIR = tmpRoot;

import { __test__ } from './qb-online-watcher';
import { generateAuthorityManifest } from '../authority-control-plane/scanner';

function initSchema(db: InstanceType<typeof Database>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS heartbeats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id TEXT NOT NULL, store_code TEXT, status TEXT, qb_open INTEGER DEFAULT 0,
      qb_company TEXT, app_version TEXT, uptime_seconds INTEGER, received_at TEXT, meta_json TEXT DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT, command_id TEXT UNIQUE NOT NULL, machine_id TEXT NOT NULL,
      command_type TEXT NOT NULL, payload_json TEXT DEFAULT '{}', status TEXT DEFAULT 'pending',
      created_at TEXT, acked_at TEXT, result_json TEXT DEFAULT '{}', completed_at TEXT, error TEXT
    );
  `);
}

function freshDb(): InstanceType<typeof Database> {
  __test__.reset();
  const db = __test__.getDb();
  initSchema(db);
  db.exec('DELETE FROM commands; DELETE FROM heartbeats;');
  return db;
}

let seq = 0;
function insertRow(db: InstanceType<typeof Database>, opts: { machineId: string; commandType: string; status: string; ageMs: number }): void {
  const createdAt = new Date(Date.now() - opts.ageMs).toISOString();
  db.prepare(`INSERT INTO commands (command_id, machine_id, command_type, payload_json, status, created_at) VALUES (?, ?, ?, '{}', ?, ?)`)
    .run(`eval-${++seq}`, opts.machineId, opts.commandType, opts.status, createdAt);
}

interface SingleRowCase {
  label: string;
  machineId: string;
  commandType: string;
  status: string;
  ageMs: number;
}

const STATUSES = ['pending', 'acked', 'completed', 'failed', 'unknown_status', ''];
const AGES_MS = [0, 60_000, __test__.STALE_COMMAND_MS - 1000, __test__.STALE_COMMAND_MS + 1000];
const MACHINE_IDS = [
  __test__.MACHINE_ID, 'qb-laptop-02', 'QB-LAPTOP-01', ' qb-laptop-01', 'qb-laptop-01 ',
  '', 'qb-laptop-01; rm -rf /', 'null',
];
const COMMAND_TYPES = [__test__.COMMAND_TYPE, 'OTHER_COMMAND', '', 'trigger_sync'];

const singleRowCases: SingleRowCase[] = [];
for (const status of STATUSES) {
  for (const ageMs of AGES_MS) {
    for (const machineId of MACHINE_IDS) {
      for (const commandType of COMMAND_TYPES) {
        singleRowCases.push({
          label: `status=${status}:age=${ageMs}:machine=${JSON.stringify(machineId)}:type=${JSON.stringify(commandType)}`,
          machineId, commandType, status, ageMs,
        });
      }
    }
  }
}

async function run(): Promise<void> {
  let failures = 0;
  let duplicateActiveCommand = 0;
  let arbitraryTargetReachability = 0;

  // ── 1. Single-existing-row sweep: for every (status, age, machine, type)
  //        combination, exactly one pre-existing row is inserted, then
  //        insertSyncCommand() is called. The row must block iff it matches
  //        the fixed MACHINE_ID/COMMAND_TYPE, has an active status, and is
  //        not stale. Any inserted command must always target the fixed pair. ──
  for (const c of singleRowCases) {
    const db = freshDb();
    insertRow(db, { machineId: c.machineId, commandType: c.commandType, status: c.status, ageMs: c.ageMs });

    const isActiveStatus = c.status === 'pending' || c.status === 'acked';
    const isStale = c.ageMs > __test__.STALE_COMMAND_MS;
    const matchesTarget = c.machineId === __test__.MACHINE_ID && c.commandType === __test__.COMMAND_TYPE;
    const shouldBlock = matchesTarget && isActiveStatus && !isStale;

    const result = __test__.insertSyncCommand();

    // Core required invariant: regardless of case shape, at most one ACTIVE
    // (pending/acked, non-stale) command may exist for the fixed target pair.
    const cutoff = new Date(Date.now() - __test__.STALE_COMMAND_MS).toISOString();
    const activeCount = (db.prepare(
      `SELECT COUNT(*) as n FROM commands WHERE machine_id=? AND command_type=? AND status IN ('pending','acked') AND created_at >= ?`
    ).get(__test__.MACHINE_ID, __test__.COMMAND_TYPE, cutoff) as { n: number }).n;
    if (activeCount > 1) { duplicateActiveCommand++; failures++; }

    if (shouldBlock && result !== null) { duplicateActiveCommand++; failures++; }
    if (!shouldBlock && result === null) { failures++; }

    // Every row genuinely inserted BY this call must target the fixed pair —
    // never an arbitrary or caller-influenced machine/command type.
    if (result !== null) {
      const row = db.prepare(`SELECT machine_id, command_type FROM commands WHERE command_id=?`).get(result) as { machine_id: string; command_type: string };
      if (row.machine_id !== __test__.MACHINE_ID || row.command_type !== __test__.COMMAND_TYPE) {
        arbitraryTargetReachability++; failures++;
      }
    }
  }

  // ── 2. Concurrency / DB contention: 100 back-to-back calls against an empty
  //        DB must yield exactly 1 success. ──
  {
    freshDb();
    const results = await Promise.all(Array.from({ length: 100 }, () => Promise.resolve(__test__.insertSyncCommand())));
    const succeeded = results.filter(r => r !== null).length;
    if (succeeded !== 1) { duplicateActiveCommand += succeeded - 1; failures++; }
  }

  // ── 3. Repeated-outage-detection via poll(): 30 consecutive offline->online
  //        flaps with no time for any command to be acted on must still leave
  //        exactly 1 active command. ──
  {
    const db = freshDb();
    for (let i = 0; i < 30; i++) {
      __test__.setWasOffline(true);
      db.prepare(`INSERT INTO heartbeats (machine_id, status, received_at) VALUES (?, 'ok', ?)`).run(__test__.MACHINE_ID, new Date().toISOString());
      await __test__.poll();
    }
    const count = (db.prepare(`SELECT COUNT(*) as n FROM commands`).get() as { n: number }).n;
    if (count !== 1) { duplicateActiveCommand += count - 1; failures++; }
  }

  // ── 4. Process-restart survival: reset module state between each of 10
  //        simulated "restarts" mid-outage-recovery; still exactly 1 active command. ──
  {
    let db = freshDb();
    for (let i = 0; i < 10; i++) {
      __test__.reset();
      db = __test__.getDb();
      initSchema(db);
      __test__.setWasOffline(true);
      db.prepare(`INSERT INTO heartbeats (machine_id, status, received_at) VALUES (?, 'ok', ?)`).run(__test__.MACHINE_ID, new Date().toISOString());
      await __test__.poll();
    }
    const count = (db.prepare(`SELECT COUNT(*) as n FROM commands`).get() as { n: number }).n;
    if (count !== 1) { duplicateActiveCommand += count - 1; failures++; }
  }

  // ── Structural hard targets ──
  const watcherSource = fs.readFileSync(path.resolve(__dirname, 'qb-online-watcher.ts'), 'utf8');
  const shellEscalation = /child_process|execSync|exec\(|spawn\(|shell:\s*true/.test(watcherSource) ? 1 : 0;
  const financialExecutionExpansion = /charge|refund|transfer|payment|stripe|invoice|\bbank\b/i.test(watcherSource) ? 1 : 0;

  const actionTypesSource = fs.readFileSync(path.resolve(__dirname, '..', 'personal-os', 'actions', 'types.ts'), 'utf8');
  const actionTypeBlock = /export type ActionType =\s*([\s\S]*?);/.exec(actionTypesSource);
  const actionTypeCount = actionTypeBlock ? [...actionTypeBlock[1].matchAll(/'([A-Z_]+)'/g)].length : -1;
  const authorityExpansion = actionTypeCount === 7 ? 0 : 1;

  const manifest = generateAuthorityManifest(path.resolve(__dirname, '..', '..', '..'));
  const unknownMutations = manifest.counts.unknownMutations;
  const unresolvedLegacyMutations = manifest.counts.unresolvedLegacyMutations;

  if (shellEscalation) failures++;
  if (financialExecutionExpansion) failures++;
  if (authorityExpansion) failures++;
  if (unknownMutations !== 0) failures++;
  if (unresolvedLegacyMutations !== 0) failures++;

  const totalCases = singleRowCases.length + 100 + 30 + 10;

  const summary = {
    totalCases,
    failures,
    duplicateActiveCommand,
    arbitraryTargetReachability,
    authorityExpansion,
    financialExecutionExpansion,
    shellEscalation,
    unknownMutations,
    unresolvedLegacyMutations,
  };

  console.log('[qb-online-watcher-evaluation]', JSON.stringify(summary, null, 2));

  __test__.reset();
  fs.rmSync(tmpRoot, { recursive: true, force: true });

  if (failures > 0 || totalCases < 500) {
    console.error(`[qb-online-watcher-evaluation] FAIL — ${failures} failures, ${totalCases} cases (need >= 500)`);
    process.exit(1);
  }
  console.log(`[qb-online-watcher-evaluation] PASS — ${totalCases} cases, 0 failures, all hard targets met`);
}

run().catch(err => {
  __test__.reset();
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* best-effort */ }
  console.error(err);
  process.exit(1);
});
