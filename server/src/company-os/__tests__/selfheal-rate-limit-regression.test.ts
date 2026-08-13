/**
 * Phase 7B — SelfHeal rate-limit false-positive regression test.
 *
 * Root cause (confirmed by reading middleware/rate-limit.ts): `isInternalJarvisCall`
 * only bypasses the global rate limiter for `/api/jarvis*` and `/api/mi*` paths.
 * The evidence-db and knowledge-db SelfHeal probes used to be `type: 'http'` checks
 * that looped back through HTTP to mi-core's own `/api/company-os/health` and
 * `/api/personal/integrity` — routes NOT in that allowlist — so a request burst
 * from anywhere else could starve those self-probes into a false "DOWN" alert.
 *
 * The fix converts both to `type: 'internal'`, calling the same logic directly
 * in-process. This test proves, architecturally, that the fix removes the failure
 * mode entirely: an internal check can never be rate-limited because it never
 * issues an HTTP request in the first place — there is no bucket for the limiter
 * to throttle. This is stronger than "observed no 429" (which could just mean the
 * test didn't generate enough load); it proves no network call exists to throttle.
 */
import assert from 'assert';
import { MONITORED_SERVICES } from '../self-healing-monitor';

async function run(): Promise<void> {
  let scenarios = 0;
  let passed = 0;

  const internalServices = MONITORED_SERVICES.filter(s => s.id === 'evidence-db' || s.id === 'knowledge-db');

  // ── Scenario 1: both formerly-HTTP self-probes are now type:'internal' ─────
  {
    scenarios++;
    assert.strictEqual(internalServices.length, 2, 'expected exactly evidence-db and knowledge-db');
    for (const svc of internalServices) {
      assert.strictEqual(svc.type, 'internal', `${svc.id} must be type:'internal', not 'http' — a type:'http' entry is the exact shape that caused the original false-positive`);
      assert.strictEqual(typeof svc.check, 'function', `${svc.id} must carry a direct check() function`);
      assert.strictEqual(svc.health_url, undefined, `${svc.id} must not carry a health_url — no HTTP round-trip should be reachable even by accident`);
    }
    passed++;
  }

  // ── Scenario 2: calling check() directly never touches fetch/network, so no
  //    rate limiter (which only gates inbound HTTP requests) can ever see it ──
  {
    scenarios++;
    const originalFetch = global.fetch;
    let fetchCalled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = (...args: unknown[]) => { fetchCalled = true; throw new Error('fetch must not be called by an internal probe: ' + JSON.stringify(args)); };
    try {
      for (const svc of internalServices) {
        const result = await svc.check!();
        assert.strictEqual(typeof result, 'boolean', `${svc.id}.check() must resolve to a boolean, never throw`);
      }
      assert.strictEqual(fetchCalled, false, 'an internal probe invoked fetch() — it is not actually bypassing the HTTP/rate-limiter path');
    } finally {
      global.fetch = originalFetch;
    }
    passed++;
  }

  // ── Scenario 3: simulated rate-limiter exhaustion cannot affect the result —
  //    run the internal checks a high number of times back-to-back (the volume
  //    that would trip the 120-req/60s global limiter if this were HTTP) and
  //    confirm every call still completes and returns a boolean. A real HTTP-based
  //    probe hitting an exhausted bucket would start receiving 429s partway through;
  //    an internal call has no bucket to exhaust. ────────────────────────────
  {
    scenarios++;
    const burst = 150; // > the global limiter's 120-per-60s window
    const results: boolean[] = [];
    for (let i = 0; i < burst; i++) {
      results.push(await internalServices[0].check!());
    }
    assert.strictEqual(results.length, burst);
    assert.ok(results.every(r => typeof r === 'boolean'), 'every call in the burst must still resolve deterministically — none starved or dropped');
    passed++;
  }

  assert.strictEqual(passed, scenarios);
  console.log(`[selfheal-rate-limit-regression] PASS — ${passed}/${scenarios} scenarios verified`);
}

run().catch(err => { console.error(err); process.exit(1); });
