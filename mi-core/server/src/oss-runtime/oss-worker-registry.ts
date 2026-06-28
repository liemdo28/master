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
];

export function workersForPhase(phase: number): OssWorkerSpec[] {
  return OSS_WORKERS.filter((w) => w.phase === phase);
}

export function getWorker(id: string): OssWorkerSpec | undefined {
  return OSS_WORKERS.find((w) => w.id === id);
}
