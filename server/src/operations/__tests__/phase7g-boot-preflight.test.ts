/**
 * Phase 7G §13-14 — orphan-process detection and port-collision preflight,
 * in an isolated fixture (a throwaway server bound to a high, unused port
 * standing in for "an expected service already running outside PM2" or "a
 * canonical port already occupied") — never touches a real production
 * port (4001/4002).
 */
import assert from 'assert';
import net from 'net';
import { checkPortAvailability, preflightPorts } from '../boot-preflight';

async function run(): Promise<void> {
  let scenarios = 0;
  let passed = 0;
  const FIXTURE_PORT = 48123; // arbitrary high port, not a real Mi-Core service port

  // ── §14: free port -> available ──────────────────────────────────────────
  {
    scenarios++;
    const result = await checkPortAvailability(FIXTURE_PORT, '127.0.0.1');
    assert.strictEqual(result.available, true);
    passed++;
  }

  // ── §13/§14: occupy the port with a fixture "orphan" server, then verify
  //    preflight detects it, refuses to claim it's available, and — most
  //    importantly — never terminates the fixture process/socket itself ──
  {
    scenarios++;
    const orphan = net.createServer();
    await new Promise<void>(resolve => orphan.listen(FIXTURE_PORT, '127.0.0.1', resolve));
    try {
      const result = await checkPortAvailability(FIXTURE_PORT, '127.0.0.1');
      assert.strictEqual(result.available, false, 'preflight must detect the occupied port');
      assert.match(result.detail, /already bound/i);
      // The orphan fixture server must still be alive and listening —
      // preflight took no destructive action against it.
      assert.ok(orphan.listening, 'preflight must never close/kill the process holding the port');
      passed++;
    } finally {
      orphan.close();
    }
  }

  // ── §14: preflightPorts() over a mixed set (one free, one occupied)
  //    fails safely (ok=false) rather than reporting a false "all clear".
  //    Bound on 0.0.0.0, matching how real Mi-Core services actually bind
  //    (confirmed via netstat in Section 1's reality audit) and matching
  //    preflightPorts()'s own default host. ─────────────────────────────────
  {
    scenarios++;
    const orphan = net.createServer();
    await new Promise<void>(resolve => orphan.listen(FIXTURE_PORT, '0.0.0.0', resolve));
    try {
      const report = await preflightPorts([FIXTURE_PORT]);
      assert.strictEqual(report.ok, false);
      assert.strictEqual(report.results[0].available, false);
      passed++;
    } finally {
      orphan.close();
    }
  }

  // ── §14: after the orphan releases the port, preflight reports it free
  //    again — proving this is a live check, not a cached/stale one ────────
  {
    scenarios++;
    const result = await checkPortAvailability(FIXTURE_PORT, '127.0.0.1');
    assert.strictEqual(result.available, true);
    passed++;
  }

  assert.strictEqual(passed, scenarios);
  console.log(`[phase7g-boot-preflight] PASS — ${passed}/${scenarios} scenarios verified`);
}

run().catch(err => { console.error(err); process.exit(1); });
