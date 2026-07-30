/**
 * engines.js — Phase 15 Safe Autonomy building blocks.
 *
 *   • GuardrailEngine        — hard invariants that, if violated, block an action.
 *   • KillSwitch             — global halt flag; when tripped, no action executes.
 *   • AutonomyLog            — append-only log of every execute/rollback/kill event.
 *   • RollbackEngine         — runs a Phase 14 rollback plan against a reversible
 *                              action interface and records the outcome.
 *   • AutonomousActionRegistry — whitelisted action signatures Mi may run on its own.
 *
 * The SafeActionExecutor (in executor.js) wires all of these together so that an
 * action only runs when: kill switch is OFF, the action is whitelisted, every
 * guardrail passes, and a rollback handler is attached for severe actions.
 */
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

/* ------------------------------------------------------------------ */
/* Guardrail Engine                                                    */
/* ------------------------------------------------------------------ */

export class GuardrailEngine {
  constructor(opts) {
    this.store = new JsonStore('guardrail-check', opts);
    this.guards = (opts && opts.guards) || [
      // Built-in invariant guards.
      { id: 'within-business-hours', check: (ctx) => withinBusinessHours(ctx.now) },
      { id: 'below-rate-limit', check: (ctx) => (ctx.callsInLastMinute || 0) < (ctx.maxCallsPerMinute || 60) },
      { id: 'not-in-maintenance', check: (ctx) => ctx.maintenance !== true },
    ];
  }

  /** Returns { passed: boolean, failures: string[] } */
  check(ctx) {
    const failures = [];
    for (const g of this.guards) {
      try {
        const ok = g.check(ctx);
        if (!ok) failures.push(g.id);
      } catch (err) {
        failures.push(`${g.id} (error: ${err.message})`);
      }
    }
    const result = { id: makeId('GUARD'), timestamp: Date.now(), passed: failures.length === 0, failures };
    this.store.insert(result);
    return result;
  }

  all() {
    return this.store.all();
  }
}

function withinBusinessHours(nowMs) {
  // Default business window: Mon–Fri 08:00–20:00 local. Overridable via ctx.
  const d = new Date(nowMs || Date.now());
  const day = d.getDay(); // 0=Sun..6=Sat
  const hour = d.getHours();
  return day >= 1 && day <= 5 && hour >= 8 && hour < 20;
}

/* ------------------------------------------------------------------ */
/* Kill Switch                                                         */
/* ------------------------------------------------------------------ */

export class KillSwitch {
  constructor(opts) {
    this.store = new JsonStore('kill-switch', opts);
    // Single persisted state row.
    if (!this.store.all().length) {
      this.store.insert({ id: 'KILL_SWITCH', tripped: false, reason: null, trippedAt: null });
    }
  }

  state() {
    return this.store.find((r) => r.id === 'KILL_SWITCH');
  }

  isTripped() {
    return !!this.state()?.tripped;
  }

  trip(reason) {
    return this.store.update('KILL_SWITCH', { tripped: true, reason: reason || 'manual', trippedAt: Date.now() });
  }

  clear() {
    return this.store.update('KILL_SWITCH', { tripped: false, reason: null, trippedAt: null });
  }
}

/* ------------------------------------------------------------------ */
/* Autonomy Log                                                        */
/* ------------------------------------------------------------------ */

export class AutonomyLog {
  constructor(opts) {
    this.store = new JsonStore('autonomy-log', opts);
  }

  append({ actionId, event, detail }) {
    const rec = {
      id: makeId('AUT'),
      timestamp: Date.now(),
      actionId,
      event, // 'executed' | 'blocked' | 'rolled-back' | 'kill-tripped' | 'kill-cleared'
      detail: detail || {},
    };
    this.store.insert(rec);
    return rec;
  }

  all() {
    return this.store.all();
  }
  count() {
    return this.store.count();
  }
}

/* ------------------------------------------------------------------ */
/* Rollback Engine                                                     */
/* ------------------------------------------------------------------ */

export class RollbackEngine {
  constructor(opts) {
    this.store = new JsonStore('rollback-run', opts);
  }

  /**
   * @param {object} plan  Phase 14 rollback plan { id, steps }
   * @param {object} handlers { rollback: () => void, verify: () => boolean }
   * @returns {{ id, planId, status, stepsRun, verified }}
   */
  async run(plan, handlers = {}) {
    const record = {
      id: makeId('ROLLRUN'),
      timestamp: Date.now(),
      planId: plan.id,
      status: 'running',
      stepsRun: 0,
      verified: false,
    };
    this.store.insert(record);

    try {
      // Execute the rollback side-effect (the executor provides the real impl).
      if (typeof handlers.rollback === 'function') {
        await handlers.rollback(plan);
      }
      record.stepsRun = (plan.steps || []).length;
      // Verify if a verifier was supplied; otherwise assume restored.
      record.verified = typeof handlers.verify === 'function' ? await handlers.verify() : true;
      record.status = record.verified ? 'restored' : 'unverified';
    } catch (err) {
      record.status = 'failed';
      record.error = err.message;
    }

    this.store.update(record.id, record);
    return record;
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Autonomous Action Registry                                          */
/* ------------------------------------------------------------------ */

export class AutonomousActionRegistry {
  constructor(opts) {
    this.store = new JsonStore('autonomous-action-registry', opts);
  }

  /** Whitelist an action signature Mi may execute on its own. */
  register(entry) {
    const rec = {
      id: entry.id || makeId('AUTOREG'),
      signature: entry.signature, // e.g. 'doordash.retry'
      maxTier: entry.maxTier, // highest risk tier allowed to auto-run (0|1)
      description: entry.description || '',
      enabled: entry.enabled !== false,
    };
    this.store.insert(rec);
    return rec;
  }

  /** Is this action signature allowed to auto-run at this tier? */
  allows(signature, tier) {
    const entry = this.store.find((r) => r.signature === signature && r.enabled);
    return !!entry && tier <= entry.maxTier;
  }

  all() {
    return this.store.all();
  }
}
