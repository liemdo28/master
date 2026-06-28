/**
 * graph.js — Phase 18 Business Knowledge Graph core.
 *
 *   • EntityRegistry      — business entities (nodes): brand, location, connector,
 *                           metric, kpi, agent, customer, etc.
 *   • RelationshipEngine  — typed, directional edges between entities
 *                           (depends_on, owns, feeds, affects, ...).
 *   • DependencyGraph     — adjacency views (out/in) for traversal.
 *   • ImpactAnalysisEngine — forward BFS to compute blast radius of a change.
 *   • KnowledgeQueryEngine — graph queries (neighbors, paths, degrees of separation).
 *
 * The graph is held in memory and snapshotted to JSON on every mutation so it
 * survives restarts and is fully auditable.
 */
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

/* ------------------------------------------------------------------ */
/* Entity Registry                                                    */
/* ------------------------------------------------------------------ */

export class EntityRegistry {
  constructor(opts) {
    this.store = new JsonStore('kg-entity', opts);
  }

  add(entity) {
    const e = {
      id: entity.id || makeId('ENT'),
      type: entity.type, // brand | location | connector | metric | agent | customer ...
      name: entity.name,
      meta: entity.meta || {},
    };
    this.store.insert(e);
    return e;
  }

  get(id) {
    return this.store.find((e) => e.id === id);
  }

  byType(type) {
    return this.store.filter((e) => e.type === type);
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Relationship Engine + Dependency Graph                             */
/* ------------------------------------------------------------------ */

export class RelationshipEngine {
  constructor(opts) {
    this.store = new JsonStore('kg-relationship', opts);
  }

  /**
   * @param {object} r { from, to, type, meta? }
   * type examples: 'depends_on', 'owns', 'feeds', 'affects', 'parent_of'
   */
  link(r) {
    const rec = {
      id: makeId('REL'),
      timestamp: Date.now(),
      from: r.from,
      to: r.to,
      type: r.type,
      meta: r.meta || {},
    };
    this.store.insert(rec);
    return rec;
  }

  /** Outgoing edges of an entity (optionally filtered by type). */
  outFrom(id, type) {
    return this.store.filter((r) => r.from === id && (!type || r.type === type));
  }

  /** Incoming edges of an entity (optionally filtered by type). */
  inTo(id, type) {
    return this.store.filter((r) => r.to === id && (!type || r.type === type));
  }

  all() {
    return this.store.all();
  }
}

export class DependencyGraph {
  constructor(entities, relationships, opts) {
    this.entities = entities;
    this.relationships = relationships;
  }

  /** Direct dependents (who relies on `id`). */
  dependents(id) {
    return this.relationships.inTo(id, 'depends_on').map((r) => r.from);
  }

  /** Direct dependencies (what `id` relies on). */
  dependencies(id) {
    return this.relationships.outFrom(id, 'depends_on').map((r) => r.to);
  }

  neighbors(id) {
    const outs = this.relationships.outFrom(id).map((r) => ({ dir: 'out', type: r.type, id: r.to }));
    const ins = this.relationships.inTo(id).map((r) => ({ dir: 'in', type: r.type, id: r.from }));
    return [...outs, ...ins];
  }
}

/* ------------------------------------------------------------------ */
/* Impact Analysis Engine                                             */
/* ------------------------------------------------------------------ */

export class ImpactAnalysisEngine {
  constructor(graph, opts) {
    this.graph = graph;
    this.store = new JsonStore('kg-impact', opts);
  }

  /**
   * Blast-radius: starting from `rootId`, propagate impact across the graph.
   *
   * Impact propagation semantics:
   *   • 'depends_on'  -> reverse: if A depends_on B and B is down, A is impacted.
   *                      i.e. follow INCOMING depends_on edges (to the dependents).
   *   • 'feeds'       -> forward: if A feeds B and A is down, B loses its input.
   *                      i.e. follow OUTGOING feeds edges.
   *   • 'affects'     -> forward: if A affects B and A changes, B is affected.
   *                      i.e. follow OUTGOING affects edges.
   */
  blastRadius(rootId, { maxDepth = 10 } = {}) {
    const REVERSE = new Set(['depends_on']); // follow incoming
    const FORWARD = new Set(['feeds', 'affects']); // follow outgoing

    const visited = new Set([rootId]);
    const byDepth = { 0: [rootId] };
    let frontier = [rootId];

    for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
      const next = [];
      for (const node of frontier) {
        const targets = new Set();
        // Reverse edges: who depends on `node`?
        for (const r of this.graph.relationships.inTo(node)) {
          if (REVERSE.has(r.type)) targets.add(r.from);
        }
        // Forward edges: who does `node` feed / affect?
        for (const r of this.graph.relationships.outFrom(node)) {
          if (FORWARD.has(r.type)) targets.add(r.to);
        }
        for (const t of targets) {
          if (!visited.has(t)) {
            visited.add(t);
            next.push(t);
          }
        }
      }
      if (next.length) byDepth[depth] = next;
      frontier = next;
    }


    const result = {
      id: makeId('IMPACT'),
      timestamp: Date.now(),
      rootId,
      impacted: [...visited],
      impactedCount: visited.size,
      byDepth,
      maxDepth: Object.keys(byDepth).length - 1,
    };
    this.store.insert(result);
    return result;
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Knowledge Query Engine                                             */
/* ------------------------------------------------------------------ */

export class KnowledgeQueryEngine {
  constructor(graph, opts) {
    this.graph = graph;
    this.store = new JsonStore('kg-query', opts);
  }

  /** Shortest path between two entities (BFS over undirected view). */
  path(from, to) {
    if (from === to) return { from, to, path: [from], hops: 0 };
    const prev = new Map();
    const queue = [from];
    const seen = new Set([from]);
    while (queue.length) {
      const node = queue.shift();
      for (const n of this._undirectedNeighbors(node)) {
        if (seen.has(n)) continue;
        seen.add(n);
        prev.set(n, node);
        if (n === to) {
          const path = [to];
          let cur = to;
          while (prev.has(cur)) {
            cur = prev.get(cur);
            path.unshift(cur);
          }
          const result = { from, to, path, hops: path.length - 1 };
          this.store.insert({ id: makeId('Q'), timestamp: Date.now(), query: 'path', ...result });
          return result;
        }
        queue.push(n);
      }
    }
    const result = { from, to, path: null, hops: Infinity };
    return result;
  }

  _undirectedNeighbors(id) {
    const outs = this.graph.relationships.outFrom(id).map((r) => r.to);
    const ins = this.graph.relationships.inTo(id).map((r) => r.from);
    return [...new Set([...outs, ...ins])];
  }

  all() {
    return this.store.all();
  }
}
