/**
 * Phase 25 — Knowledge Graph
 * In-memory entity relationship graph. Neo4j optional upgrade path.
 * Entities: Stores, Projects, People, Reviews, Payroll, Tasks, Deployments, Invoices.
 */

export type EntityType = 'store' | 'project' | 'person' | 'review' | 'task' | 'node' | 'service' | 'document';
export type RelationType = 'owns' | 'runs_on' | 'related_to' | 'reported_by' | 'managed_by' | 'deployed_on' | 'depends_on' | 'part_of';

export interface GraphEntity {
  id: string;
  type: EntityType;
  name: string;
  attributes: Record<string, string>;
  created_at: string;
}

export interface GraphRelation {
  id: string;
  from: string;   // entity id
  to: string;     // entity id
  type: RelationType;
  label?: string;
  created_at: string;
}

const ENTITIES: Map<string, GraphEntity> = new Map();
const RELATIONS: GraphRelation[] = [];

function addEntity(e: Omit<GraphEntity, 'created_at'>): GraphEntity {
  const entity = { ...e, created_at: new Date().toISOString() };
  ENTITIES.set(e.id, entity);
  return entity;
}

function addRelation(from: string, to: string, type: RelationType, label?: string): GraphRelation {
  const existing = RELATIONS.find(r => r.from === from && r.to === to && r.type === type);
  if (existing) return existing;
  const rel: GraphRelation = { id: `rel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, from, to, type, label, created_at: new Date().toISOString() };
  RELATIONS.push(rel);
  return rel;
}

// ── Seed the graph with known entities ──────────────────────────────────────

// People
addEntity({ id: 'person.liem', type: 'person', name: 'Liêm Đỗ', attributes: { role: 'CEO/Founder', phone: '+84931773657', location: 'San Antonio TX' } });

// Stores
addEntity({ id: 'store.bakudan', type: 'store', name: 'Bakudan Ramen', attributes: { location: 'San Antonio TX', type: 'Ramen' } });
addEntity({ id: 'store.stone_oak', type: 'store', name: 'Stone Oak', attributes: { location: 'San Antonio TX', parent: 'Bakudan Ramen' } });
addEntity({ id: 'store.bandera', type: 'store', name: 'Bandera', attributes: { location: 'San Antonio TX', parent: 'Bakudan Ramen' } });
addEntity({ id: 'store.rim', type: 'store', name: 'Rim', attributes: { location: 'San Antonio TX', parent: 'Bakudan Ramen' } });
addEntity({ id: 'store.raw_sushi', type: 'store', name: 'Raw Sushi Bar', attributes: { location: 'Stockton CA', type: 'Sushi' } });

// Projects
addEntity({ id: 'project.mi_core', type: 'project', name: 'Mi-Core', attributes: { status: 'active', stack: 'TypeScript/Node.js', port: '4001' } });
addEntity({ id: 'project.dashboard', type: 'project', name: 'Dashboard', attributes: { url: 'dashboard.bakudanramen.com', status: 'active' } });
addEntity({ id: 'project.bakudan_dashboard', type: 'project', name: 'Bakudan Dashboard', attributes: { url: 'dashboard.bakudanramen.com', status: 'active', alias_for: 'Dashboard' } });
addEntity({ id: 'project.whatsapp_gateway', type: 'project', name: 'WhatsApp AI Gateway', attributes: { port: '3211', status: 'active' } });
addEntity({ id: 'project.whatsapp_gateway_alias', type: 'project', name: 'WhatsApp Gateway', attributes: { port: '3211', status: 'active', node: 'Laptop1', alias_for: 'WhatsApp AI Gateway' } });
addEntity({ id: 'project.doordash', type: 'project', name: 'DoorDash Campaigns', attributes: { status: 'active', platform: 'DoorDash' } });
addEntity({ id: 'project.review_automation', type: 'project', name: 'Review Automation', attributes: { status: 'active' } });
addEntity({ id: 'project.integration', type: 'project', name: 'Integration System', attributes: { status: 'active' } });
addEntity({ id: 'document.payroll', type: 'document', name: 'Payroll Finance Checklist', attributes: { domain: 'payroll finance checklist', status: 'indexed' } });

// Nodes
addEntity({ id: 'node.laptop1', type: 'node', name: 'Laptop1', attributes: { role: 'ACTIVE writer', os: 'Windows', location: 'Office' } });
addEntity({ id: 'node.laptop2', type: 'node', name: 'Laptop2', attributes: { role: 'PASSIVE standby', os: 'Windows', location: 'Office' } });
addEntity({ id: 'node.pc', type: 'node', name: 'PC', attributes: { role: 'Mi-Core host', os: 'Windows' } });

// Relationships
addRelation('person.liem', 'store.bakudan', 'owns');
addRelation('person.liem', 'store.raw_sushi', 'owns');
addRelation('person.liem', 'project.mi_core', 'owns');
addRelation('store.bakudan', 'store.stone_oak', 'part_of');
addRelation('store.bakudan', 'store.bandera', 'part_of');
addRelation('store.bakudan', 'store.rim', 'part_of');
addRelation('project.mi_core', 'node.pc', 'deployed_on');
addRelation('project.whatsapp_gateway', 'node.laptop1', 'deployed_on');
addRelation('project.whatsapp_gateway_alias', 'node.laptop1', 'deployed_on');
addRelation('project.doordash', 'node.laptop1', 'deployed_on');
addRelation('project.review_automation', 'node.laptop1', 'deployed_on');
addRelation('project.integration', 'node.laptop1', 'deployed_on');
addRelation('project.bakudan_dashboard', 'project.dashboard', 'related_to');
addRelation('document.payroll', 'store.raw_sushi', 'related_to');
addRelation('document.payroll', 'store.bakudan', 'related_to');
addRelation('project.mi_core', 'project.whatsapp_gateway', 'depends_on');
addRelation('project.dashboard', 'project.mi_core', 'depends_on');
addRelation('store.stone_oak', 'project.doordash', 'related_to');
addRelation('store.bandera', 'project.doordash', 'related_to');
addRelation('store.bakudan', 'project.review_automation', 'related_to');

// ── Query API ────────────────────────────────────────────────────────────────

export function getEntity(id: string): GraphEntity | undefined {
  return ENTITIES.get(id);
}

export function getAllEntities(type?: EntityType): GraphEntity[] {
  const all = Array.from(ENTITIES.values());
  return type ? all.filter(e => e.type === type) : all;
}

export function getRelationsFor(entityId: string): { outgoing: GraphRelation[]; incoming: GraphRelation[] } {
  return {
    outgoing: RELATIONS.filter(r => r.from === entityId),
    incoming: RELATIONS.filter(r => r.to === entityId),
  };
}

export function findEntityByName(name: string): GraphEntity | undefined {
  const q = name.toLowerCase();
  return Array.from(ENTITIES.values()).find(e =>
    e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)
  );
}

export function exploreRelationships(name: string): string {
  const entity = findEntityByName(name);
  if (!entity) return `Không tìm thấy entity "${name}" trong knowledge graph.`;

  const { outgoing, incoming } = getRelationsFor(entity.id);
  const lines: string[] = [`*${entity.name}* (${entity.type})`];

  const attrs = Object.entries(entity.attributes).map(([k, v]) => `  • ${k}: ${v}`);
  if (attrs.length) lines.push('\n📋 *Attributes:*\n' + attrs.join('\n'));

  if (outgoing.length) {
    lines.push('\n➡️ *Connects to:*');
    for (const r of outgoing) {
      const target = ENTITIES.get(r.to);
      lines.push(`  • ${r.type} → ${target?.name || r.to}`);
    }
  }

  if (incoming.length) {
    lines.push('\n⬅️ *Connected by:*');
    for (const r of incoming) {
      const source = ENTITIES.get(r.from);
      lines.push(`  • ${source?.name || r.from} (${r.type})`);
    }
  }

  return `🕸 *Knowledge Graph — ${entity.name}*\n\n${lines.join('\n')}`;
}

export function getGraphStats() {
  const byType: Record<string, number> = {};
  for (const e of ENTITIES.values()) byType[e.type] = (byType[e.type] || 0) + 1;
  return { total_entities: ENTITIES.size, total_relations: RELATIONS.length, by_type: byType };
}
