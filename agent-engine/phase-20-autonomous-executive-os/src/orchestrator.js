/**
 * orchestrator.js — Phase 20 Autonomous Executive OS (capstone).
 *
 * CEOControlPanel is the single executive entry point. It ties together:
 *   • autonomous planning (objective -> funded division plan)
 *   • executive risk posture (division signals -> GREEN/AMBER/RED)
 *   • continuous monitoring (metric stream -> watch/alert/escalate)
 *   • cross-division optimization (budget reallocation)
 *   • the global kill switch (reused from Phase 15)
 *
 * The CEO panel renders a unified status: objectives, latest plan, posture,
 * escalation count, and kill-switch state — everything an executive needs in
 * one deterministic, auditable view.
 */
import {
  AutonomousPlanningEngine,
  ExecutiveRiskEngine,
  ContinuousMonitoring,
  CrossDivisionOptimizer,
} from './engines.js';
import { KillSwitch } from '../../phase-15-autonomous-ops/src/engines.js';
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class CEOControlPanel {
  constructor(opts = {}) {
    this.planning = new AutonomousPlanningEngine(opts);
    this.risk = new ExecutiveRiskEngine(opts);
    this.monitoring = new ContinuousMonitoring(opts);
    this.optimizer = new CrossDivisionOptimizer(this.planning, opts);
    this.killSwitch = opts.killSwitch || new KillSwitch(opts);
    this.objectives = new JsonStore('exec-objective', opts);
  }

  setObjective(objective) {
    return this.objectives.insert({
      id: objective.id || makeId('OBJ'),
      timestamp: Date.now(),
      title: objective.title,
      budget: objective.budget,
      divisions: objective.divisions || [],
      status: 'active',
    });
  }

  /** End-to-end: plan for the latest objective + compute posture + monitor. */
  runCycle(divisionSignals) {
    const objective = this.objectives.all()[0];
    let plan = null;
    if (objective) {
      plan = this.planning.plan({
        objective: objective.title,
        divisions: objective.divisions,
        budget: objective.budget,
      });
    }
    const posture = this.risk.posture(divisionSignals);
    return { objective, plan, posture, killSwitchTripped: this.killSwitch.isTripped() };
  }

  /** Unified CEO dashboard view. */
  dashboard(divisionSignals = []) {
    const posture = this.risk.posture(divisionSignals);
    return {
      timestamp: Date.now(),
      objectives: this.objectives.all().length,
      plans: this.planning.all().length,
      posture: posture.posture,
      escalations: this.monitoring.escalations().length,
      killSwitchTripped: this.killSwitch.isTripped(),
    };
  }

  haltCompany(reason) {
    return this.killSwitch.trip(reason);
  }

  resumeCompany() {
    return this.killSwitch.clear();
  }
}

export default CEOControlPanel;
