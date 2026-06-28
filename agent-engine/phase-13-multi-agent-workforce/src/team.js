/**
 * team.js — Agent Team Registry + Task Router.
 *
 * Agents are registered with the capabilities they own (e.g. 'seo', 'doordash',
 * 'qb', 'coding') and a capacity (concurrent tasks). The router assigns a task
 * to the best-fit agent by capability match, then by lowest current load, then
 * by best historical performance — a deterministic, auditable assignment rule.
 */
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class AgentTeamRegistry {
  constructor(opts) {
    this.store = new JsonStore('agent-team', opts);
    this.load = new Map(); // agentId -> current in-flight task count
  }

  register(agent) {
    const a = {
      id: agent.id || makeId('AGENT'),
      name: agent.name,
      role: agent.role || 'worker',
      capabilities: agent.capabilities || [], // e.g. ['seo','gbp']
      capacity: typeof agent.capacity === 'number' ? agent.capacity : 3,
      status: agent.status || 'available', // available | busy | offline
      meta: agent.meta || {},
    };
    this.store.insert(a);
    if (!this.load.has(a.id)) this.load.set(a.id, 0);
    return a;
  }

  get(id) {
    return this.store.find((a) => a.id === id);
  }

  all() {
    return this.store.all();
  }

  available() {
    return this.store.filter((a) => a.status === 'available');
  }

  /** Best-fit assignment. Returns { agent, reason } or null if no fit. */
  route(task, performance) {
    const caps = task.capabilities || [];
    const candidates = this.available().filter((a) => {
      const capOk = caps.length === 0 || caps.some((c) => a.capabilities.includes(c));
      const hasRoom = (this.load.get(a.id) || 0) < a.capacity;
      return capOk && hasRoom; // hard gate: no capacity => not a candidate
    });
    if (!candidates.length) return null;

    const ranked = candidates
      .map((a) => {
        const capMatch = caps.filter((c) => a.capabilities.includes(c)).length;
        const load = this.load.get(a.id) || 0;
        const perf = performance ? performance.scoreFor(a.id) : 0.5;
        // Score: capability coverage, then low load, then high perf.
        const score = capMatch * 100 + perf * 50 + (a.capacity - load);
        return { agent: a, capMatch, load, perf, hasCapacity: true, score };
      })
      .sort((x, y) => y.score - x.score);

    const winner = ranked[0];
    return { agent: winner.agent, reason: this._reason(winner, caps.length) };
  }


  _reason(r, capCount) {
    const parts = [];
    parts.push(`capacity ${r.hasCapacity ? 'OK' : 'FULL'}`);
    parts.push(`capMatch ${r.capMatch}/${capCount}`);
    parts.push(`load ${r.load}`);
    parts.push(`perf ${r.perf.toFixed(2)}`);
    return parts.join(', ');
  }

  /** Called by the orchestrator when a task starts/ends on an agent. */
  addLoad(agentId) {
    this.load.set(agentId, (this.load.get(agentId) || 0) + 1);
    const a = this.get(agentId);
    if (a && (this.load.get(agentId) || 0) >= a.capacity) {
      this.store.update(agentId, { status: 'busy' });
    }
  }

  releaseLoad(agentId) {
    const cur = Math.max(0, (this.load.get(agentId) || 0) - 1);
    this.load.set(agentId, cur);
    const a = this.get(agentId);
    if (a && a.status === 'busy' && cur < a.capacity) {
      this.store.update(agentId, { status: 'available' });
    }
  }

  reset() {
    this.store.clear();
    this.load.clear();
  }
}
