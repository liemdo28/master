/**
 * Entity Registry — Business Knowledge Graph Part 1
 * Defines and manages all business entity types.
 */

export type EntityType =
  | 'Company' | 'Brand' | 'Store' | 'Employee' | 'Role'
  | 'Objective' | 'Task' | 'Approval' | 'Evidence'
  | 'Connector' | 'Workflow' | 'Agent' | 'OSSTool' | 'Vendor'
  | 'Campaign' | 'MenuItem' | 'CustomerReview' | 'FinancialRecord'
  | 'CreativeAsset' | 'Incident' | 'Risk';

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  properties: Record<string, unknown>;
  metadata: {
    createdAt: string;
    updatedAt: string;
    owner?: string;
    division?: string;
    status?: string;
    tags?: string[];
  };
}

export interface Relationship {
  id: string;
  from: string; // entity id
  to: string;   // entity id
  type: RelationshipType;
  properties: Record<string, unknown>;
  metadata: {
    createdAt: string;
    confidence?: number; // 0–1
    source?: string;
  };
}

export type RelationshipType =
  | 'owns' | 'manages' | 'belongs_to' | 'part_of'
  | 'connects_to' | 'depends_on' | 'feeds_into' | 'approved_by'
  | 'monitors' | 'alerts' | 'routes_to' | 'provides'
  | 'uses' | 'owns_brand' | 'owns_store' | 'has_role'
  | 'has_objective' | 'has_task' | 'has_incident' | 'has_risk'
  | 'uses_connector' | 'runs_workflow' | 'assigned_to';

const ENTITY_TYPES: EntityType[] = [
  'Company', 'Brand', 'Store', 'Employee', 'Role',
  'Objective', 'Task', 'Approval', 'Evidence',
  'Connector', 'Workflow', 'Agent', 'OSSTool', 'Vendor',
  'Campaign', 'MenuItem', 'CustomerReview', 'FinancialRecord',
  'CreativeAsset', 'Incident', 'Risk',
];

export function getEntityTypes(): EntityType[] {
  return [...ENTITY_TYPES];
}

export function isValidEntityType(type: string): type is EntityType {
  return ENTITY_TYPES.includes(type as EntityType);
}

// ── In-memory entity store (production-ready pattern: JSON file back, in-memory read)
const entities = new Map<string, Entity>();
const relationships: Relationship[] = [];

// Seed with Bakudan / Raw Sushi business context
const SEED_COMPANY: Entity = {
  id: 'company-raw-sushi',
  type: 'Company',
  name: 'Raw Sushi',
  properties: {
    industry: 'restaurant',
    cuisine: 'japanese-sushi',
    locations: ['B1'],
    primaryBrand: 'Raw Sushi',
  },
  metadata: {
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    division: 'operations',
  },
};

const SEED_BRAND: Entity = {
  id: 'brand-raw-sushi',
  type: 'Brand',
  name: 'Raw Sushi',
  properties: {
    company: 'Raw Sushi',
    primaryColor: '#1a1a2e',
    channels: ['in-store', 'doordash', 'grabfood'],
  },
  metadata: {
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    division: 'marketing',
  },
};

const SEED_STORE_B1: Entity = {
  id: 'store-b1',
  type: 'Store',
  name: 'Raw Sushi B1',
  properties: {
    location: 'B1',
    address: 'District 7, Ho Chi Minh City',
    channels: ['in-store', 'doordash', 'grabfood'],
    primaryRevenue: 'doordash',
  },
  metadata: {
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    division: 'operations',
    status: 'active',
    owner: 'ops-team',
  },
};

const SEED_CONNECTOR_DOORDASH: Entity = {
  id: 'connector-doordash',
  type: 'Connector',
  name: 'DoorDash',
  properties: {
    vendor: 'DoorDash',
    type: 'delivery',
    division: 'operations',
    revenueChannel: 'online-delivery',
  },
  metadata: {
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    division: 'operations',
    status: 'active',
  },
};

const SEED_CONNECTOR_QB: Entity = {
  id: 'connector-quickbooks',
  type: 'Connector',
  name: 'QuickBooks',
  properties: {
    vendor: 'Intuit',
    type: 'accounting',
    division: 'finance',
  },
  metadata: {
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    division: 'finance',
    status: 'active',
  },
};

const SEED_CONNECTOR_WHATSAPP: Entity = {
  id: 'connector-whatsapp',
  type: 'Connector',
  name: 'WhatsApp',
  properties: {
    vendor: 'Meta',
    type: 'messaging',
    division: 'marketing',
  },
  metadata: {
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    division: 'marketing',
    status: 'active',
  },
};

const SEED_CONNECTOR_GBP: Entity = {
  id: 'connector-gbp',
  type: 'Connector',
  name: 'Google Business Profile',
  properties: {
    vendor: 'Google',
    type: 'reviews',
    division: 'marketing',
  },
  metadata: {
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    division: 'marketing',
    status: 'active',
  },
};

const SEED_CONNECTOR_GA4: Entity = {
  id: 'connector-ga4',
  type: 'Connector',
  name: 'Google Analytics 4',
  properties: {
    vendor: 'Google',
    type: 'analytics',
    division: 'marketing',
  },
  metadata: {
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    division: 'marketing',
    status: 'active',
  },
};

const SEED_CONNECTOR_GSC: Entity = {
  id: 'connector-gsc',
  type: 'Connector',
  name: 'Google Search Console',
  properties: {
    vendor: 'Google',
    type: 'seo',
    division: 'marketing',
  },
  metadata: {
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    division: 'marketing',
    status: 'active',
  },
};

const SEED_WORKFLOW_REVENUE: Entity = {
  id: 'workflow-raw-sushi-revenue',
  type: 'Workflow',
  name: 'Raw Sushi Online Revenue Growth',
  properties: {
    objective: 'Increase Raw Sushi online revenue 10%',
    agents: ['finance-agent', 'marketing-agent', 'seo-agent', 'doordash-operator', 'creative-agent'],
    status: 'active',
  },
  metadata: {
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    division: 'marketing',
    owner: 'ceo',
  },
};

const SEED_OBJECTIVE: Entity = {
  id: 'objective-raw-sushi-revenue-10',
  type: 'Objective',
  name: 'Increase Raw Sushi online revenue 10%',
  properties: {
    target: '10%',
    currentBaseline: 0,
    channel: 'doordash',
    deadline: '30 days',
  },
  metadata: {
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    division: 'marketing',
    status: 'active',
  },
};

const SEED_APPROVAL: Entity = {
  id: 'approval-raw-sushi-campaign',
  type: 'Approval',
  name: 'Campaign Budget Approval',
  properties: {
    amount: 500,
    currency: 'USD',
    requester: 'marketing-agent',
    status: 'pending',
  },
  metadata: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    division: 'finance',
  },
};

const SEED_AGENTS: Entity[] = [
  { id: 'agent-finance', type: 'Agent', name: 'Finance Agent', properties: { division: 'finance', role: 'revenue_baseline' }, metadata: { createdAt: '2024-01-01T00:00:00.000Z', updatedAt: new Date().toISOString(), division: 'finance' } },
  { id: 'agent-marketing', type: 'Agent', name: 'Marketing Agent', properties: { division: 'marketing', role: 'traffic_analysis' }, metadata: { createdAt: '2024-01-01T00:00:00.000Z', updatedAt: new Date().toISOString(), division: 'marketing' } },
  { id: 'agent-seo', type: 'Agent', name: 'SEO Agent', properties: { division: 'marketing', role: 'seo_opportunity' }, metadata: { createdAt: '2024-01-01T00:00:00.000Z', updatedAt: new Date().toISOString(), division: 'marketing' } },
  { id: 'agent-doordash', type: 'Agent', name: 'DoorDash Operator', properties: { division: 'operations', role: 'campaign_visibility' }, metadata: { createdAt: '2024-01-01T00:00:00.000Z', updatedAt: new Date().toISOString(), division: 'operations' } },
  { id: 'agent-creative', type: 'Agent', name: 'Creative Agent', properties: { division: 'marketing', role: 'asset_creation' }, metadata: { createdAt: '2024-01-01T00:00:00.000Z', updatedAt: new Date().toISOString(), division: 'marketing' } },
];

const SEED_OSS: Entity[] = [
  { id: 'oss-langfuse', type: 'OSSTool', name: 'Langfuse', properties: { category: 'observability', purpose: 'tracing' }, metadata: { createdAt: '2024-01-01T00:00:00.000Z', updatedAt: new Date().toISOString(), division: 'engineering' } },
  { id: 'oss-langgraph', type: 'OSSTool', name: 'LangGraph', properties: { category: 'orchestration', purpose: 'multi_agent' }, metadata: { createdAt: '2024-01-01T00:00:00.000Z', updatedAt: new Date().toISOString(), division: 'engineering' } },
  { id: 'oss-n8n', type: 'OSSTool', name: 'n8n', properties: { category: 'workflow', purpose: 'automation' }, metadata: { createdAt: '2024-01-01T00:00:00.000Z', updatedAt: new Date().toISOString(), division: 'engineering' } },
];

const SEED_RELATIONSHIPS: Relationship[] = [
  { id: 'rel-company-brand', from: 'company-raw-sushi', to: 'brand-raw-sushi', type: 'owns_brand', properties: {}, metadata: { createdAt: '2024-01-01T00:00:00.000Z', confidence: 1.0 } },
  { id: 'rel-brand-store', from: 'brand-raw-sushi', to: 'store-b1', type: 'owns_store', properties: {}, metadata: { createdAt: '2024-01-01T00:00:00.000Z', confidence: 1.0 } },
  { id: 'rel-store-doordash', from: 'store-b1', to: 'connector-doordash', type: 'uses_connector', properties: { channel: 'online-delivery' }, metadata: { createdAt: '2024-01-01T00:00:00.000Z', confidence: 1.0 } },
  { id: 'rel-company-qb', from: 'company-raw-sushi', to: 'connector-quickbooks', type: 'uses_connector', properties: {}, metadata: { createdAt: '2024-01-01T00:00:00.000Z', confidence: 1.0 } },
  { id: 'rel-company-whatsapp', from: 'company-raw-sushi', to: 'connector-whatsapp', type: 'uses_connector', properties: {}, metadata: { createdAt: '2024-01-01T00:00:00.000Z', confidence: 1.0 } },
  { id: 'rel-store-gbp', from: 'store-b1', to: 'connector-gbp', type: 'uses_connector', properties: {}, metadata: { createdAt: '2024-01-01T00:00:00.000Z', confidence: 1.0 } },
  { id: 'rel-company-ga4', from: 'company-raw-sushi', to: 'connector-ga4', type: 'uses_connector', properties: {}, metadata: { createdAt: '2024-01-01T00:00:00.000Z', confidence: 1.0 } },
  { id: 'rel-company-gsc', from: 'company-raw-sushi', to: 'connector-gsc', type: 'uses_connector', properties: {}, metadata: { createdAt: '2024-01-01T00:00:00.000Z', confidence: 1.0 } },
  { id: 'rel-obj-workflow', from: 'objective-raw-sushi-revenue-10', to: 'workflow-raw-sushi-revenue', type: 'has_objective', properties: {}, metadata: { createdAt: '2024-01-01T00:00:00.000Z', confidence: 1.0 } },
  { id: 'rel-workflow-approval', from: 'workflow-raw-sushi-revenue', to: 'approval-raw-sushi-campaign', type: 'approved_by', properties: {}, metadata: { createdAt: '2024-01-01T00:00:00.000Z', confidence: 1.0 } },
  { id: 'rel-doordash-oss', from: 'connector-doordash', to: 'oss-langgraph', type: 'runs_workflow', properties: {}, metadata: { createdAt: '2024-01-01T00:00:00.000Z', confidence: 0.8 } },
];

// Seed all entities
for (const e of [SEED_COMPANY, SEED_BRAND, SEED_STORE_B1, SEED_CONNECTOR_DOORDASH, SEED_CONNECTOR_QB, SEED_CONNECTOR_WHATSAPP, SEED_CONNECTOR_GBP, SEED_CONNECTOR_GA4, SEED_CONNECTOR_GSC, SEED_WORKFLOW_REVENUE, SEED_OBJECTIVE, SEED_APPROVAL, ...SEED_AGENTS, ...SEED_OSS]) {
  entities.set(e.id, e);
}
for (const r of SEED_RELATIONSHIPS) {
  relationships.push(r);
}

export function addEntity(entity: Entity): Entity {
  entities.set(entity.id, entity);
  return entity;
}

export function getEntity(id: string): Entity | null {
  return entities.get(id) ?? null;
}

export function getAllEntities(): Entity[] {
  return [...entities.values()];
}

export function getEntitiesByType(type: EntityType): Entity[] {
  return [...entities.values()].filter(e => e.type === type);
}

export function searchEntities(query: string): Entity[] {
  const q = query.toLowerCase();
  return [...entities.values()].filter(e =>
    e.name.toLowerCase().includes(q) ||
    e.id.toLowerCase().includes(q) ||
    e.type.toLowerCase().includes(q)
  );
}

export function addRelationship(rel: Omit<Relationship, 'id' | 'metadata'>): Relationship {
  const full: Relationship = {
    ...rel,
    id: `rel-${rel.from}-${rel.to}-${rel.type}-${Date.now()}`,
    metadata: { createdAt: new Date().toISOString(), confidence: 1.0 },
  };
  relationships.push(full);
  return full;
}

export function getAllRelationships(): Relationship[] {
  return [...relationships];
}

export function getRelationshipsFrom(entityId: string): Relationship[] {
  return relationships.filter(r => r.from === entityId);
}

export function getRelationshipsTo(entityId: string): Relationship[] {
  return relationships.filter(r => r.to === entityId);
}

export function getRelationshipsByType(type: RelationshipType): Relationship[] {
  return relationships.filter(r => r.type === type);
}

export const KNOWLEDGE_GRAPH_STATUS = 'CONFIGURED_NOT_INSTALLED';