/**
 * orchestrator.js — Phase 18 Business Knowledge Graph.
 *
 * Convenience facade wiring the entity/relationship/graph/impact/query engines.
 */
import {
  EntityRegistry,
  RelationshipEngine,
  DependencyGraph,
  ImpactAnalysisEngine,
  KnowledgeQueryEngine,
} from './graph.js';

export class KnowledgeGraph {
  constructor(opts = {}) {
    this.entities = new EntityRegistry(opts);
    this.relationships = new RelationshipEngine(opts);
    this.graph = new DependencyGraph(this.entities, this.relationships, opts);
    this.impact = new ImpactAnalysisEngine(this.graph, opts);
    this.query = new KnowledgeQueryEngine(this.graph, opts);
  }

  /** Add an entity + a set of outgoing links in one call. */
  node(entity, links = []) {
    const e = this.entities.add(entity);
    for (const l of links) {
      this.relationships.link({ ...l, from: l.from || e.id });
    }
    return e;
  }

  stats() {
    return { entities: this.entities.all().length, relationships: this.relationships.all().length };
  }
}

export default KnowledgeGraph;
