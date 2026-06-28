/**
 * orchestrator.js — Phase 15 Safe Autonomy.
 *
 * SafeActionExecutor is the single choke point through which an APPROVED action
 * (from Phase 14) becomes an actual execution. It enforces, in order:
 *
 *   1. kill switch OFF            (if tripped -> block + log)
 *   2. action whitelisted         (AutonomousActionRegistry)
 *   3. all guardrails pass        (GuardrailEngine)
 *   4. severe actions have a rollback handler attached
 *
 * On success it calls the action's `run` handler and logs 'executed'.
 * On failure it logs 'blocked' with the reason.
 * If the action's run() throws, it triggers the rollback engine.
 *
 * Everything is injected: the executor never reaches into real systems by
 * itself — it orchestrates handlers the operator provides. This keeps Phase 15
 * safe and fully unit-testable.
 */
import {
  GuardrailEngine,
  KillSwitch,
  AutonomyLog,
  RollbackEngine,
  AutonomousActionRegistry,
} from './engines.js';

export class SafeActionExecutor {
  constructor(opts = {}) {
    this.killSwitch = opts.killSwitch || new KillSwitch(opts);
    this.registry = opts.registry || new AutonomousActionRegistry(opts);
    this.guardrails = opts.guardrails || new GuardrailEngine(opts);
    this.log = opts.log || new AutonomyLog(opts);
    this.rollback = opts.rollback || new RollbackEngine(opts);
  }

  /**
   * @param {object} approved { signature, tier, ctx, run, rollbackPlan, onRollback, verify }
   * @returns {{ executed: boolean, reason?: string, guardResult?, rollbackResult? }}
   */
  async execute(approved) {
    const { signature, tier = 0, ctx = {}, run, rollbackPlan, onRollback, verify } = approved;

    if (this.killSwitch.isTripped()) {
      this.log.append({ actionId: signature, event: 'blocked', detail: { reason: 'kill-switch-tripped' } });
      return { executed: false, reason: 'kill-switch-tripped' };
    }

    if (!this.registry.allows(signature, tier)) {
      this.log.append({
        actionId: signature,
        event: 'blocked',
        detail: { reason: 'not-whitelisted', tier },
      });
      return { executed: false, reason: 'not-whitelisted' };
    }

    const guardResult = this.guardrails.check(ctx);
    if (!guardResult.passed) {
      this.log.append({
        actionId: signature,
        event: 'blocked',
        detail: { reason: 'guardrail-failed', failures: guardResult.failures },
      });
      return { executed: false, reason: 'guardrail-failed', guardResult };
    }

    try {
      if (typeof run === 'function') await run();
      this.log.append({ actionId: signature, event: 'executed', detail: { tier } });
      return { executed: true, guardResult };
    } catch (err) {
      // Action failed mid-flight -> attempt rollback if a plan/handler exists.
      let rollbackResult = null;
      if (rollbackPlan) {
        rollbackResult = await this.rollback.run(rollbackPlan, {
          rollback: onRollback,
          verify,
        });
        this.log.append({
          actionId: signature,
          event: 'rolled-back',
          detail: { error: err.message, status: rollbackResult.status },
        });
      } else {
        this.log.append({
          actionId: signature,
          event: 'blocked',
          detail: { reason: 'run-threw-no-rollback', error: err.message },
        });
      }
      return { executed: false, reason: 'run-threw', error: err.message, rollbackResult };
    }
  }

  tripKillSwitch(reason) {
    const r = this.killSwitch.trip(reason);
    this.log.append({ actionId: 'system', event: 'kill-tripped', detail: { reason } });
    return r;
  }

  clearKillSwitch() {
    const r = this.killSwitch.clear();
    this.log.append({ actionId: 'system', event: 'kill-cleared', detail: {} });
    return r;
  }
}

export class AutonomousOps extends SafeActionExecutor {
  constructor(opts = {}) {
    super(opts);
  }
}

export default AutonomousOps;
