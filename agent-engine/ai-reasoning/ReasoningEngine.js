/**
 * AI Reasoning Engine - Tracks reasoning steps in realtime
 */
export class AIReasoningEngine {
  constructor() {
    this.steps = [];
    this.currentPhase = null;
    this.listeners = [];
  }

  startPhase(phase, details = {}) {
    const step = {
      id: `step_${Date.now()}`,
      phase, status: 'active', startedAt: Date.now(),
      completedAt: null, duration: null, details, subSteps: [], output: null, error: null,
    };
    this.steps.push(step);
    this.currentPhase = step;
    this._notify('phase-start', step);
    return step.id;
  }

  addSubStep(label, details = {}) {
    if (!this.currentPhase) return null;
    const sub = { id: `sub_${Date.now()}`, label, status: 'active', startedAt: Date.now(), completedAt: null, details };
    this.currentPhase.subSteps.push(sub);
    this._notify('sub-step', sub);
    return sub.id;
  }

  completePhase(output = null) {
    if (!this.currentPhase) return;
    this.currentPhase.status = 'completed';
    this.currentPhase.completedAt = Date.now();
    this.currentPhase.duration = this.currentPhase.completedAt - this.currentPhase.startedAt;
    this.currentPhase.output = output;
    this._notify('phase-complete', this.currentPhase);
    this.currentPhase = null;
  }

  failPhase(error) {
    if (!this.currentPhase) return;
    this.currentPhase.status = 'failed';
    this.currentPhase.completedAt = Date.now();
    this.currentPhase.duration = this.currentPhase.completedAt - this.currentPhase.startedAt;
    this.currentPhase.error = error;
    this._notify('phase-fail', this.currentPhase);
    this.currentPhase = null;
  }

  subscribe(listener) { this.listeners.push(listener); return () => { this.listeners = this.listeners.filter(l => l !== listener); }; }
  _notify(event, data) { for (const listener of this.listeners) { try { listener(event, data); } catch {} } }
  getSteps() { return this.steps; }
  getActivePhase() { return this.currentPhase; }
  clear() { this.steps = []; this.currentPhase = null; }

  getProgress() {
    const total = this.steps.length;
    const completed = this.steps.filter(s => s.status === 'completed').length;
    const failed = this.steps.filter(s => s.status === 'failed').length;
    const active = this.steps.filter(s => s.status === 'active').length;
    return { total, completed, failed, active };
  }

  toTimeline() {
    return this.steps.map(s => ({
      id: s.id, phase: s.phase, status: s.status, start: s.startedAt,
      end: s.completedAt || Date.now(), duration: s.duration,
      subSteps: s.subSteps.map(sub => ({ label: sub.label, status: sub.status, start: sub.startedAt, end: sub.completedAt })),
    }));
  }
}

export const reasoningEngine = new AIReasoningEngine();
export default AIReasoningEngine;