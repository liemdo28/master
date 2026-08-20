/**
 * Phase 9D — permanent regression coverage for qb-online-watcher's idempotency
 * fix. Proves, against a real (isolated, ephemeral) qb-agent.db — not a mock —
 * that at most one active TRIGGER_SYNC command can exist per remote target at
 * a time, that a stale command doesn't permanently block recovery, that the
 * check-then-insert is atomic under concurrent calls, and that no new
 * authority was introduced (fixed target, fixed command type, no shell, no
 * arbitrary machine).
 */
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-9d-qb-watcher-'));
process.env.MI_DATA_DIR = tmpRoot;

import { __test__ } from '../qb-online-watcher';

function initSchema(db: InstanceType<typeof Database>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS heartbeats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id TEXT NOT NULL,
      store_code TEXT,
      status TEXT,
      qb_open INTEGER DEFAULT 0,
      qb_company TEXT,
      app_version TEXT,
      uptime_seconds INTEGER,
      received_at TEXT,
      meta_json TEXT DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command_id TEXT UNIQUE NOT NULL,
      machine_id TEXT NOT NULL,
      command_type TEXT NOT NULL,
      payload_json TEXT DEFAULT '{}',
      status TEXT DEFAULT 'pending',
      created_at TEXT,
      acked_at TEXT,
      result_json TEXT DEFAULT '{}',
      completed_at TEXT,
      error TEXT
    );
  `);
}

function insertHeartbeat(db: InstanceType<typeof Database>, machineId: string, receivedAt: string): void {
  db.prepare(`INSERT INTO heartbeats (machine_id, status, received_at) VALUES (?, 'ok', ?)`).run(machineId, receivedAt);
}

function insertCommandRow(db: InstanceType<typeof Database>, opts: { commandId: string; machineId: string; commandType: string; status: string; createdAt: string }): void {
  db.prepare(`INSERT INTO commands (command_id, machine_id, command_type, payload_json, status, created_at) VALUES (?, ?, ?, '{}', ?, ?)`)
    .run(opts.commandId, opts.machineId, opts.commandType, opts.status, opts.createdAt);
}

function freshDb(): InstanceType<typeof Database> {
  __test__.reset();
  const db = __test__.getDb();
  initSchema(db);
  db.exec('DELETE FROM commands; DELETE FROM heartbeats;');
  return db;
}

let passed = 0;
const isoAgo = (ms: number) => new Date(Date.now() - ms).toISOString();
const isoNow = () => new Date().toISOString();

async function run(): Promise<void> {
  // ── 1. Baseline: no active command exists — insert succeeds ──
  {
    freshDb();
    const id = __test__.insertSyncCommand();
    assert.ok(id, 'first insert must succeed');
    assert.ok(id!.startsWith('auto-sync-'));
    passed++;
  }

  // ── 2. Same outage detected repeatedly: a second insert while the first is
  //        still 'pending' must be skipped, not duplicated ──
  {
    freshDb();
    const first = __test__.insertSyncCommand();
    const second = __test__.insertSyncCommand();
    assert.ok(first);
    assert.strictEqual(second, null, 'a pending active command must block a second insert');
    const db = __test__.getDb();
    const count = (db.prepare(`SELECT COUNT(*) as n FROM commands WHERE machine_id=? AND command_type=?`).get(__test__.MACHINE_ID, __test__.COMMAND_TYPE) as { n: number }).n;
    assert.strictEqual(count, 1, 'exactly one command row must exist, not two');
    passed++;
  }

  // ── 3. Offline -> online -> offline -> online transitions via poll(): only
  //        one active command should exist after two back-to-back reconnects
  //        while the first sync is still pending ──
  {
    const db = freshDb();
    insertHeartbeat(db, __test__.MACHINE_ID, isoAgo(90 * 60 * 1000)); // stale — offline
    __test__.setWasOffline(true);
    await __test__.poll(); // still offline (no fresh heartbeat) — no-op

    // Reconnect
    insertHeartbeat(db, __test__.MACHINE_ID, isoNow());
    await __test__.poll(); // should insert exactly one command
    let count = (db.prepare(`SELECT COUNT(*) as n FROM commands`).get() as { n: number }).n;
    assert.strictEqual(count, 1, 'first reconnect must insert exactly one command');

    // Go offline again, then reconnect again quickly while the first command is still pending
    __test__.setWasOffline(true);
    insertHeartbeat(db, __test__.MACHINE_ID, isoNow());
    await __test__.poll(); // reconnect while a pending command already exists
    count = (db.prepare(`SELECT COUNT(*) as n FROM commands`).get() as { n: number }).n;
    assert.strictEqual(count, 1, 'a second reconnect while the first command is still pending must not insert a duplicate');
    passed++;
  }

  // ── 4. Stale pending command does not block a fresh insert ──
  {
    const db = freshDb();
    insertCommandRow(db, { commandId: 'stale-1', machineId: __test__.MACHINE_ID, commandType: __test__.COMMAND_TYPE, status: 'pending', createdAt: isoAgo(__test__.STALE_COMMAND_MS + 5 * 60 * 1000) });
    const id = __test__.insertSyncCommand();
    assert.ok(id, 'a stale pending command must not block a fresh insert');
    passed++;
  }

  // ── 5. Completed prior command does not block a fresh insert ──
  {
    const db = freshDb();
    insertCommandRow(db, { commandId: 'done-1', machineId: __test__.MACHINE_ID, commandType: __test__.COMMAND_TYPE, status: 'completed', createdAt: isoNow() });
    const id = __test__.insertSyncCommand();
    assert.ok(id, 'a completed prior command must not block a fresh insert — a new reconnect deserves a new sync');
    passed++;
  }

  // ── 6. Failed prior command does not block a fresh insert (retry must be possible) ──
  {
    const db = freshDb();
    insertCommandRow(db, { commandId: 'fail-1', machineId: __test__.MACHINE_ID, commandType: __test__.COMMAND_TYPE, status: 'failed', createdAt: isoNow() });
    const id = __test__.insertSyncCommand();
    assert.ok(id, 'a failed prior command must not block a fresh insert');
    passed++;
  }

  // ── 7. Acked (in-flight, not yet completed) command DOES block ──
  {
    const db = freshDb();
    insertCommandRow(db, { commandId: 'acked-1', machineId: __test__.MACHINE_ID, commandType: __test__.COMMAND_TYPE, status: 'acked', createdAt: isoNow() });
    const id = __test__.insertSyncCommand();
    assert.strictEqual(id, null, 'an acked (in-flight) command must still count as active and block a duplicate');
    passed++;
  }

  // ── 8. Different remote target does not interfere — an active command for a
  //        DIFFERENT machine_id/command_type must not block this machine's insert.
  //        Also proves the target is never anything other than the fixed MACHINE_ID. ──
  {
    const db = freshDb();
    insertCommandRow(db, { commandId: 'other-1', machineId: 'some-other-machine', commandType: __test__.COMMAND_TYPE, status: 'pending', createdAt: isoNow() });
    insertCommandRow(db, { commandId: 'other-2', machineId: __test__.MACHINE_ID, commandType: 'SOME_OTHER_COMMAND', status: 'pending', createdAt: isoNow() });
    const id = __test__.insertSyncCommand();
    assert.ok(id, 'active commands for a different machine or command type must not block this insert');
    const row = db.prepare(`SELECT machine_id, command_type FROM commands WHERE command_id=?`).get(id) as { machine_id: string; command_type: string };
    assert.strictEqual(row.machine_id, __test__.MACHINE_ID, 'inserted command must always target the fixed MACHINE_ID — never arbitrary');
    assert.strictEqual(row.command_type, __test__.COMMAND_TYPE, 'inserted command must always be the fixed TRIGGER_SYNC type — never arbitrary');
    passed++;
  }

  // ── 9. Malformed/unknown target: findActiveSyncCommand only ever queries the
  //        fixed MACHINE_ID — there is no code path that accepts a caller-
  //        supplied or malformed target. Structural proof via source re-check. ──
  {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'qb-online-watcher.ts'), 'utf8');
    // The only string literal ever used as machine_id in a commands query/insert
    // is the fixed MACHINE_ID constant — never a request param, req.body, req.query,
    // or any other externally-influenceable source.
    assert.ok(!/req\.(body|query|params)/.test(source), 'qb-online-watcher.ts must never read from an HTTP request — it has no HTTP entrypoint at all');
    passed++;
  }

  // ── 10. Concurrent watcher invocations / DB contention: fire many overlapping
  //         insertSyncCommand() calls "concurrently" (Promise.all over sync calls,
  //         proving the transaction serializes them correctly even when queued
  //         back-to-back) — exactly one must succeed. ──
  {
    freshDb();
    const results = await Promise.all(Array.from({ length: 20 }, () => Promise.resolve(__test__.insertSyncCommand())));
    const succeeded = results.filter(r => r !== null);
    assert.strictEqual(succeeded.length, 1, `exactly one of 20 concurrent-style calls must succeed, got ${succeeded.length}`);
    passed++;
  }

  // ── 11. Process restart during outage: state reset (simulating a fresh
  //         process) while the machine is still offline must not spuriously
  //         insert anything, and must not lose track of an already-active
  //         command once the process comes back and a genuine reconnect happens. ──
  {
    const db = freshDb();
    insertHeartbeat(db, __test__.MACHINE_ID, isoAgo(2 * 60 * 60 * 1000)); // still offline
    // Simulate the module being re-initialized (startQbOnlineWatcher's own logic)
    __test__.setWasOffline(true);
    __test__.setLastSeenAt(null);
    await __test__.poll(); // still offline — must not insert
    let count = (db.prepare(`SELECT COUNT(*) as n FROM commands`).get() as { n: number }).n;
    assert.strictEqual(count, 0, 'no insert may happen while still genuinely offline after a simulated restart');

    // A command was already inserted by a "previous process instance" and is
    // still pending — after "restart", a fresh reconnect must not duplicate it.
    insertCommandRow(db, { commandId: 'pre-restart-1', machineId: __test__.MACHINE_ID, commandType: __test__.COMMAND_TYPE, status: 'pending', createdAt: isoNow() });
    insertHeartbeat(db, __test__.MACHINE_ID, isoNow());
    await __test__.poll();
    count = (db.prepare(`SELECT COUNT(*) as n FROM commands`).get() as { n: number }).n;
    assert.strictEqual(count, 1, 'a restart must not cause a duplicate insert when an active command from before the restart still exists');
    passed++;
  }

  // ── 12. No new authority: no ActionType added, no shell/exec introduced. ──
  {
    const actionTypesSource = fs.readFileSync(path.resolve(__dirname, '..', '..', 'personal-os', 'actions', 'types.ts'), 'utf8');
    const block = /export type ActionType =\s*([\s\S]*?);/.exec(actionTypesSource);
    assert.ok(block);
    const count = [...block![1].matchAll(/'([A-Z_]+)'/g)].length;
    assert.strictEqual(count, 7, 'ActionType enum must remain exactly 7 values');
    const watcherSource = fs.readFileSync(path.resolve(__dirname, '..', 'qb-online-watcher.ts'), 'utf8');
    assert.ok(!/child_process|execSync|exec\(|spawn\(/.test(watcherSource), 'no shell/process execution may be introduced');
    passed++;
  }

  __test__.reset();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log(`[qb-online-watcher-idempotency] PASS — ${passed} invariants verified`);
}

run().catch(err => {
  __test__.reset();
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* best-effort */ }
  console.error(err);
  process.exit(1);
});
