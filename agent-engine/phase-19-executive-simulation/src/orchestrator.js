/**
 * orchestrator.js — Phase 19 Executive Simulation.
 *
 * Wires assumption/forecast/scenario/simulation-risk/decision-comparison engines
 * into an end-to-end executive simulation: define scenarios, risk-evaluate each,
 * then compare them to produce a ranked, explained decision recommendation.
 */
import {
  AssumptionRegistry,
  ForecastEngine,
  ScenarioEngine,
  SimulationRiskEngine,
  DecisionComparisonEngine,
} from './engines.js';

export class ExecutiveSimulation {
  constructor(opts = {}) {
    this.assumptions = new AssumptionRegistry(opts);
    this.forecast = new ForecastEngine(opts);
    this.scenarios = new ScenarioEngine(this.forecast, this.assumptions, opts);
    this.risk = new SimulationRiskEngine(this.scenarios, this.assumptions, opts);
    this.comparison = new DecisionComparisonEngine(opts);
  }

  /**
   * Run a full decision simulation over the currently-defined scenarios.
   * Returns { risks, comparison }.
   */
  runDecision({ downsidePenalty } = {}) {
    const scenarios = this.scenarios.all();
    const risks = scenarios.map((s) => this.risk.evaluate(s.id));
    const cmp = this.comparison.compare(scenarios, risks, { downsidePenalty });
    return { risks, comparison: cmp };
  }

  /** Validate an assumption (mark it confirmed by evidence). */
  validateAssumption(id) {
    return this.assumptions.store.update(id, { validated: true });
  }
}

export default ExecutiveSimulation;
