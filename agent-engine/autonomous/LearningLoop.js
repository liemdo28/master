/**
 * local-agent/autonomous/LearningLoop.js
 * Phase 22: Self-Improving Loop
 */
import { EventEmitter } from 'events';

export class LearningLoop extends EventEmitter {
    constructor({ workspaceRoot, config = {} } = {}) {
        super();
        this.root = workspaceRoot;
        this.config = { cycleIntervalMs: 300000, minSamples: 10, maxHistorySize: 10000, ...config };
        this.observations = [];
        this.patterns = new Map();
        this.improvements = [];
        this.metrics = { totalObservations: 0, patternsIdentified: 0, improvementsApplied: 0, cyclesCompleted: 0 };
    }

    observe(event) {
        const obs = { id: crypto.randomUUID(), timestamp: Date.now(), type: event.type, data: event.data, outcome: event.outcome, context: event.context || {} };
        this.observations.push(obs);
        this.metrics.totalObservations++;
        if (this.observations.length > this.config.maxHistorySize) this.observations = this.observations.slice(-this.config.maxHistorySize);
        this.emit('observe', obs);
        return obs.id;
    }

    detectPatterns() {
        const groups = {};
        for (const o of this.observations) { if (!groups[o.type]) groups[o.type] = []; groups[o.type].push(o); }
        const detected = [];
        for (const [type, events] of Object.entries(groups)) {
            if (events.length < this.config.minSamples) continue;
            const p = this._analyze(events);
            if (p.confidence >= 0.7) { this.patterns.set(p.id, p); detected.push(p); this.metrics.patternsIdentified++; this.emit('pattern-detected', p); }
        }
        return detected;
    }

    _analyze(events) {
        const rates = events.filter(e => e.outcome).map(e => e.outcome === 'success' ? 1 : 0);
        const sr = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
        return { id: crypto.randomUUID(), type: events[0].type, eventCount: events.length, successRate: sr, confidence: Math.min(1, events.length / 100), firstSeen: events[0].timestamp, lastSeen: events[events.length - 1].timestamp };
    }

    getPatterns(filter = {}) {
        let p = [...this.patterns.values()];
        if (filter.type) p = p.filter(x => x.type === filter.type);
        if (filter.minConfidence) p = p.filter(x => x.confidence >= filter.minConfidence);
        return p.sort((a, b) => b.confidence - a.confidence);
    }

    generateImprovements() {
        const improvements = this.getPatterns({ minConfidence: 0.7 }).filter(p => p.successRate < 0.5).map(p => ({
            id: crypto.randomUUID(), patternId: p.id, type: 'optimization',
            description: `Low success rate (${(p.successRate * 100).toFixed(1)}%) for ${p.type}`,
            suggestedAction: 'Add retry logic with exponential backoff',
            priority: p.successRate < 0.3 ? 'critical' : 'high',
            confidence: p.confidence, status: 'pending', timestamp: Date.now(),
        }));
        this.improvements.push(...improvements);
        return improvements;
    }

    applyImprovement(id) {
        const imp = this.improvements.find(i => i.id === id);
        if (!imp) throw new Error(`Improvement ${id} not found`);
        imp.status = 'applied'; imp.appliedAt = Date.now();
        this.metrics.improvementsApplied++;
        this.emit('improvement-applied', imp);
        return imp;
    }

    async runCycle() {
        const cycle = { id: crypto.randomUUID(), timestamp: Date.now(), steps: [] };
        cycle.steps.push({ step: 'observe', count: this.observations.length });
        const patterns = this.detectPatterns();
        cycle.steps.push({ step: 'detect-patterns', count: patterns.length });
        const improvements = this.generateImprovements();
        cycle.steps.push({ step: 'generate-improvements', count: improvements.length });
        this.metrics.cyclesCompleted++;
        this.emit('cycle-complete', cycle);
        return { cycle, patterns, improvements, metrics: { ...this.metrics } };
    }

    getMetrics() {
        return { ...this.metrics, observationBufferSize: this.observations.length, activePatterns: this.patterns.size, pendingImprovements: this.improvements.filter(i => i.status === 'pending').length };
    }

    getHistory(limit = 100) { return this.observations.slice(-limit); }
    exportPatterns() { return [...this.patterns.values()]; }
    exportImprovements() { return [...this.improvements]; }
}
