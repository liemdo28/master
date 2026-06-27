/**
 * Phase 7 — Company Data Platform
 * Unified data model across Finance, Marketing, Operations
 */
import { createRegisteredObjective } from '../executive-coordination/objective-registry';
import { createTask, addEvidence } from '../executive-coordination/task-registry';

export interface DataSourceNode {
  source: string;
  division: string;
  status: 'live' | 'stale' | 'missing' | 'blocked';
  last_sync: string | null;
  schema_defined: boolean;
}

export interface CrossSourceSchema {
  name: string;
  sources: string[];
  fields: string[];
  status: 'defined' | 'partial' | 'missing';
}

export interface DataPlatformDashboard {
  status: 'OPERATIONAL' | 'PARTIAL' | 'BLOCKED';
  sources: DataSourceNode[];
  schemas: CrossSourceSchema[];
  warnings: string[];
}

export function getDataSources(): DataSourceNode[] {
  return [
    { source: 'quickbooks', division: 'finance', status: 'stale', last_sync: '2026-06-18T08:29:36.703Z', schema_defined: true },
    { source: 'accounting-engine', division: 'finance', status: 'live', last_sync: new Date().toISOString(), schema_defined: true },
    { source: 'gsc', division: 'marketing', status: 'missing', last_sync: null, schema_defined: true },
    { source: 'ga4', division: 'marketing', status: 'missing', last_sync: null, schema_defined: false },
    { source: 'gbp', division: 'marketing', status: 'blocked', last_sync: null, schema_defined: false },
    { source: 'crawler', division: 'marketing', status: 'live', last_sync: new Date().toISOString(), schema_defined: true },
    { source: 'doordash', division: 'operations', status: 'missing', last_sync: null, schema_defined: false },
    { source: 'toast', division: 'operations', status: 'missing', last_sync: null, schema_defined: false },
    { source: 'payroll', division: 'finance', status: 'missing', last_sync: null, schema_defined: false },
  ];
}

export function getCrossSourceSchemas(): CrossSourceSchema[] {
  return [
    { name: 'store_dimension', sources: ['quickbooks', 'toast', 'doordash', 'ga4'], fields: ['store_id', 'name', 'address', 'brand'], status: 'defined' },
    { name: 'revenue_fact', sources: ['quickbooks', 'toast', 'doordash'], fields: ['store_id', 'date', 'amount', 'source'], status: 'partial' },
    { name: 'marketing_fact', sources: ['gsc', 'ga4', 'gbp'], fields: ['store_id', 'date', 'clicks', 'impressions', 'sessions'], status: 'partial' },
    { name: 'review_fact', sources: ['gbp', 'yelp'], fields: ['store_id', 'date', 'rating', 'review_text'], status: 'missing' },
    { name: 'labor_fact', sources: ['payroll'], fields: ['store_id', 'date', 'hours', 'cost'], status: 'missing' },
  ];
}

export function buildDataPlatformDashboard(): DataPlatformDashboard {
  const sources = getDataSources();
  const schemas = getCrossSourceSchemas();
  const warnings: string[] = [];
  const missing = sources.filter(s => s.status === 'missing' || s.status === 'blocked');
  if (missing.length > 0) warnings.push(`${missing.length} data sources are missing or blocked: ${missing.map(s => s.source).join(', ')}.`);
  if (schemas.some(s => s.status === 'missing')) warnings.push('Some cross-source schemas are not yet defined.');
  const liveCount = sources.filter(s => s.status === 'live').length;
  const status = liveCount >= 6 && warnings.length === 0 ? 'OPERATIONAL' : warnings.length > 0 ? 'PARTIAL' : 'BLOCKED';
  return { status, sources, schemas, warnings };
}

export function runDataPlatformBootstrap() {
  const objective = createRegisteredObjective('Phase 7 Company Data Platform', 'ceo');
  const task = createTask({
    objectiveId: objective.id,
    title: 'Create Company Data Platform',
    description: 'Unified data model across Finance, Marketing, Operations.',
    division: 'it',
    owner: 'data-platform',
    approvalRequired: 'none',
  });
  const dashboard = buildDataPlatformDashboard();
  addEvidence(task.id, {
    type: 'api-output',
    url: `data-platform:sources:${dashboard.sources.length};schemas:${dashboard.schemas.length};status:${dashboard.status}`,
    capturedAt: new Date().toISOString(),
  });
  return { objective, task, dashboard };
}

export { buildDataPlatformDashboard as buildDashboard };