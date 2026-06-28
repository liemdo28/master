/**
 * oss-worker-registry.ts — the governed OSS worker selected for each phase.
 *
 * One primary worker per phase 12–30 (Part A1 requires ≥1 per phase 12–20; the
 * registry extends through Phase 30 so the new phases share the same runtime).
 * Specs mirror the OSS governance manifest; the registry is the runtime view.
 */
import type { OssWorkerSpec } from './oss-execution-contract';

export const OSS_WORKERS: OssWorkerSpec[] = [
  { id: 'otel', name: 'OpenTelemetry', phase: 12, businessRole: 'trace/outcome memory export', ownerDivision: 'intelligence', license: 'Apache-2.0', licenseRisk: 'low', probe: { kind: 'module', module: '@opentelemetry/api' }, fallback: 'in-engine JsonStore failure/outcome memory' },
  { id: 'langgraph', name: 'LangGraph', phase: 13, businessRole: 'multi-agent handoff orchestration', ownerDivision: 'engineering', license: 'MIT', licenseRisk: 'low', probe: { kind: 'module', module: '@langchain/langgraph' }, fallback: 'in-engine dispatch/handoff/review' },
  { id: 'temporal', name: 'Temporal', phase: 14, businessRole: 'durable approval workflow', ownerDivision: 'operations', license: 'MIT', licenseRisk: 'low', probe: { kind: 'tcp', host: '127.0.0.1', port: 7233 }, fallback: 'in-engine propose/approve/reject lifecycle' },
  { id: 'opa', name: 'Open Policy Agent', phase: 15, businessRole: 'guardrail policy decisions', ownerDivision: 'it', license: 'Apache-2.0', licenseRisk: 'low', probe: { kind: 'tcp', host: '127.0.0.1', port: 8181 }, fallback: 'in-engine GuardrailEngine + whitelist' },
  { id: 'duckdb', name: 'DuckDB', phase: 16, businessRole: 'multi-location KPI analytics', ownerDivision: 'operations', license: 'MIT', licenseRisk: 'low', probe: { kind: 'module', module: 'duckdb' }, fallback: 'in-engine LocationKPILayer rollups' },
  { id: 'openfga', name: 'OpenFGA', phase: 17, businessRole: 'tenant/relationship authorization', ownerDivision: 'it', license: 'Apache-2.0', licenseRisk: 'low', probe: { kind: 'tcp', host: '127.0.0.1', port: 8080 }, fallback: 'in-engine TenantIsolation guard' },
  { id: 'graphology', name: 'Graphology (NetworkX-equiv)', phase: 18, businessRole: 'knowledge graph traversal', ownerDivision: 'data-platform', license: 'MIT', licenseRisk: 'low', probe: { kind: 'module', module: 'graphology' }, fallback: 'in-engine adjacency BFS impact/path' },
  { id: 'statsforecast', name: 'StatsForecast', phase: 19, businessRole: 'time-series forecasting', ownerDivision: 'finance', license: 'Apache-2.0', licenseRisk: 'low', probe: { kind: 'env', env: 'STATSFORECAST_URL' }, fallback: 'in-engine linear/growth ForecastEngine' },
  { id: 'openobserve', name: 'OpenObserve', phase: 20, businessRole: 'continuous monitoring + autonomy log', ownerDivision: 'executive', license: 'AGPL-3.0', licenseRisk: 'medium', probe: { kind: 'tcp', host: '127.0.0.1', port: 5080 }, fallback: 'in-engine AutonomyLog + Uptime-Kuma rollback' },

  // Phase 21–30 primary workers (Part B) — same runtime contract.
  { id: 'chatwoot', name: 'Chatwoot', phase: 21, businessRole: 'customer conversation/feedback ingestion', ownerDivision: 'operations', license: 'MIT', licenseRisk: 'low', probe: { kind: 'tcp', host: '127.0.0.1', port: 3000 }, fallback: 'in-engine feedback-ingestion + sentiment' },
  { id: 'posthog', name: 'PostHog', phase: 22, businessRole: 'channel/revenue analytics', ownerDivision: 'marketing', license: 'MIT', licenseRisk: 'low', probe: { kind: 'tcp', host: '127.0.0.1', port: 8000 }, fallback: 'in-engine channel-performance engine' },
  { id: 'uptimekuma', name: 'Uptime Kuma', phase: 23, businessRole: 'store-ops uptime/checklist monitoring', ownerDivision: 'operations', license: 'MIT', licenseRisk: 'low', probe: { kind: 'tcp', host: '127.0.0.1', port: 3001 }, fallback: 'in-engine store-health + checklist compliance' },
  { id: 'erpnext', name: 'ERPNext', phase: 24, businessRole: 'procurement/inventory/COGS', ownerDivision: 'finance', license: 'GPL-3.0', licenseRisk: 'medium', probe: { kind: 'tcp', host: '127.0.0.1', port: 8001 }, fallback: 'in-engine vendor/ingredient/COGS engines' },
  { id: 'orangehrm', name: 'OrangeHRM', phase: 25, businessRole: 'HR/labor/scheduling', ownerDivision: 'operations', license: 'GPL-3.0', licenseRisk: 'medium', probe: { kind: 'tcp', host: '127.0.0.1', port: 8002 }, fallback: 'in-engine labor-cost + schedule-risk engines' },
  { id: 'comfyui', name: 'ComfyUI', phase: 26, businessRole: 'creative asset generation', ownerDivision: 'creative', license: 'GPL-3.0', licenseRisk: 'medium', probe: { kind: 'tcp', host: '127.0.0.1', port: 8188 }, fallback: 'in-engine creative-brief + asset registry' },
  { id: 'keycloak', name: 'Keycloak', phase: 27, businessRole: 'access control / identity', ownerDivision: 'it', license: 'Apache-2.0', licenseRisk: 'low', probe: { kind: 'tcp', host: '127.0.0.1', port: 8443 }, fallback: 'in-engine access-control + audit-log engines' },
  { id: 'n8n', name: 'n8n', phase: 28, businessRole: 'workflow fabric automation', ownerDivision: 'it', license: 'Sustainable Use License', licenseRisk: 'medium', probe: { kind: 'tcp', host: '127.0.0.1', port: 5678 }, fallback: 'in-engine workflow registry + dedupe + replay' },
  { id: 'openmetadata', name: 'OpenMetadata', phase: 29, businessRole: 'data catalog / quality / lineage', ownerDivision: 'data-platform', license: 'Apache-2.0', licenseRisk: 'low', probe: { kind: 'tcp', host: '127.0.0.1', port: 8585 }, fallback: 'in-engine catalog + freshness + lineage engines' },
  { id: 'grafana', name: 'Grafana', phase: 30, businessRole: 'executive command-center dashboards', ownerDivision: 'executive', license: 'AGPL-3.0', licenseRisk: 'medium', probe: { kind: 'tcp', host: '127.0.0.1', port: 3030 }, fallback: 'in-engine CEO command-center renderer' },

  // Phase 31-40 primary workers — same runtime contract.
  { id: 'supplier-hub', name: 'ODOO Community (Supply Chain)', phase: 31, businessRole: 'supply chain + vendor delivery + logistics', ownerDivision: 'operations', license: 'GPL-3.0', licenseRisk: 'medium', probe: { kind: 'module', module: 'odoorpc' }, fallback: 'in-engine supply-chain + vendor delivery signals' },
  { id: 'legal-hub', name: 'PostgreSQL Legal Hub', phase: 32, businessRole: 'legal + contract + compliance + regulatory', ownerDivision: 'legal', license: 'PostgreSQL', licenseRisk: 'low', probe: { kind: 'module', module: 'pg' }, fallback: 'in-engine legal-compliance + contract registry' },
  { id: 'innovate-db', name: 'PostgreSQL Innovation Pipeline', phase: 33, businessRole: 'menu R&D + product pipeline + supplier innovation', ownerDivision: 'product', license: 'PostgreSQL', licenseRisk: 'low', probe: { kind: 'module', module: 'pg' }, fallback: 'in-engine product-innovation + R&D pipeline' },
  { id: 'fleet-mgmt', name: 'ODOO Community (Fleet)', phase: 34, businessRole: 'delivery fleet + vehicle ops + driver management', ownerDivision: 'operations', license: 'GPL-3.0', licenseRisk: 'medium', probe: { kind: 'module', module: 'odoorpc' }, fallback: 'in-engine fleet-transport + driver signals' },
  { id: 'fraudscore-oss', name: 'FraudScore OSS', phase: 35, businessRole: 'payment fraud + refund abuse + chargeback detection', ownerDivision: 'fraud-risk', license: 'MIT', licenseRisk: 'low', probe: { kind: 'env', env: 'FRAUDSCORE_URL' }, fallback: 'in-engine fraud-risk + refund abuse signals' },
  { id: 'rewards-engine', name: 'PostgreSQL Loyalty Engine', phase: 36, businessRole: 'rewards + retention + VIP lifecycle management', ownerDivision: 'customer-loyalty', license: 'PostgreSQL', licenseRisk: 'low', probe: { kind: 'module', module: 'pg' }, fallback: 'in-engine customer-loyalty + VIP lifecycle signals' },
  { id: 'doordash-api', name: 'DoorDash API', phase: 37, businessRole: 'DoorDash + aggregator + partner onboarding', ownerDivision: 'partner-channel', license: 'Proprietary', licenseRisk: 'medium', probe: { kind: 'env', env: 'DOORDASH_API_URL' }, fallback: 'in-engine partner-channel + DoorDash aggregator signals' },
  { id: 'sql-ledger', name: 'SQL-Ledger', phase: 38, businessRole: 'GL + AP/AR + reconciliation + tax', ownerDivision: 'finance-accounting', license: 'GPL-2.0', licenseRisk: 'low', probe: { kind: 'module', module: 'better-sqlite3' }, fallback: 'in-engine finance-accounting + GL signals' },
  { id: 'airbyte', name: 'Airbyte', phase: 39, businessRole: 'ETL pipeline + data warehouse + BI reporting', ownerDivision: 'data-warehouse', license: 'MIT', licenseRisk: 'low', probe: { kind: 'module', module: 'airbyte-sdk' }, fallback: 'in-engine data-warehouse + ETL signals' },
  { id: 'autonomy-core', name: 'Temporal / n8n Autonomy Core', phase: 40, businessRole: 'self-healing + autonomous orchestration + rollback', ownerDivision: 'autonomous-ops', license: 'MIT', licenseRisk: 'low', probe: { kind: 'module', module: '@temporalio/client' }, fallback: 'in-engine autonomous-ops + self-healing signals' },

  // Phase 41-50 primary workers
  { id: 'ai-support-core', name: 'Rasa OSS', phase: 41, businessRole: 'AI-powered customer support + ticket triage', ownerDivision: 'ai-customer-support', license: 'MIT', licenseRisk: 'low', probe: { kind: 'env', env: 'PHASE_41_URL' }, fallback: 'in-engine ai-customer-support signals' },
  { id: 'tax-hub', name: 'TaxJar / OpenTaxJar', phase: 42, businessRole: 'Tax preparation + filing + audit defense', ownerDivision: 'tax-compliance', license: 'MIT', licenseRisk: 'low', probe: { kind: 'env', env: 'PHASE_42_URL' }, fallback: 'in-engine tax-compliance signals' },
  { id: 'mkt-automation', name: 'Mautic', phase: 43, businessRole: 'Multi-channel marketing + campaign orchestration', ownerDivision: 'marketing-automation', license: 'GPL-3.0', licenseRisk: 'low', probe: { kind: 'env', env: 'PHASE_43_URL' }, fallback: 'in-engine marketing-automation signals' },
  { id: 'supplier-registry', name: 'ERPNext Community', phase: 44, businessRole: 'Supplier onboarding + scoring + relationship mgmt', ownerDivision: 'supplier-management', license: 'GPL-3.0', licenseRisk: 'low', probe: { kind: 'env', env: 'PHASE_44_URL' }, fallback: 'in-engine supplier-management signals' },
  { id: 'store-exp-core', name: 'PostHog + Appsmith', phase: 45, businessRole: 'In-store experience + queue management + ambience', ownerDivision: 'store-experience', license: 'MIT', licenseRisk: 'low', probe: { kind: 'env', env: 'PHASE_45_URL' }, fallback: 'in-engine store-experience signals' },
  { id: 'qa-core', name: 'Great Expectations', phase: 46, businessRole: 'Food quality + service quality + compliance audits', ownerDivision: 'quality-assurance', license: 'Apache-2.0', licenseRisk: 'low', probe: { kind: 'env', env: 'PHASE_46_URL' }, fallback: 'in-engine quality-assurance signals' },
  { id: 'dr-core', name: 'Velero + Restic', phase: 47, businessRole: 'Business continuity + disaster recovery + backup', ownerDivision: 'disaster-recovery', license: 'Apache-2.0', licenseRisk: 'low', probe: { kind: 'env', env: 'PHASE_47_URL' }, fallback: 'in-engine disaster-recovery signals' },
  { id: 'km-core', name: 'BookStack / WikiJS', phase: 48, businessRole: 'Internal knowledge base + SOP + training library', ownerDivision: 'knowledge-management', license: 'MIT', licenseRisk: 'low', probe: { kind: 'env', env: 'PHASE_48_URL' }, fallback: 'in-engine knowledge-management signals' },
  { id: 'ir-core', name: 'PostgreSQL + Superset', phase: 49, businessRole: 'Investor reporting + cap table + stakeholder updates', ownerDivision: 'investor-relations', license: 'Apache-2.0', licenseRisk: 'low', probe: { kind: 'env', env: 'PHASE_49_URL' }, fallback: 'in-engine investor-relations signals' },
  { id: 'strategy-core', name: 'Metabase + n8n', phase: 50, businessRole: 'Long-term strategy + roadmap + market analysis', ownerDivision: 'strategic-planning', license: 'AGPL-3.0', licenseRisk: 'low', probe: { kind: 'env', env: 'PHASE_50_URL' }, fallback: 'in-engine strategic-planning signals' },
];


export function workersForPhase(phase: number): OssWorkerSpec[] {
  return OSS_WORKERS.filter((w) => w.phase === phase);
}

export function getWorker(id: string): OssWorkerSpec | undefined {
  return OSS_WORKERS.find((w) => w.id === id);
}
