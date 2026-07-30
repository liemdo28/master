/**
 * Mi Company OS — Data Source Registry
 * All external data sources Mi reads from or writes to.
 * Source evidence: MI_LINKED_SOURCES_AUDIT.md, .env.example files, connector-registry.json
 * Updated: 2026-06-18
 */

export type SourceTruthLevel = 'PRIMARY' | 'SECONDARY' | 'DERIVED' | 'SUPPLEMENTAL';
export type CredentialStatus  = 'CONFIGURED' | 'DEGRADED' | 'MISSING' | 'EXTERNAL';
export type RefreshPolicy     = 'REALTIME' | 'ON_DEMAND' | 'SCHEDULED' | 'MANUAL';
export type EvidencePolicy    = 'REQUIRED' | 'RECOMMENDED' | 'OPTIONAL';

export interface DataSource {
  id: string;
  name: string;
  category: string;
  owner_dept: string;
  credential_status: CredentialStatus;
  truth_level: SourceTruthLevel;
  refresh_policy: RefreshPolicy;
  evidence_policy: EvidencePolicy;
  connector_id?: string;        // mi-core visibility connector id
  access_method: string;        // how mi-core reads it
  write_capable: boolean;
  requires_approval_for_write: boolean;
  last_known_health: 'healthy' | 'degraded' | 'unknown';
  notes?: string;
}

export const DATA_SOURCES: DataSource[] = [
  // ── FINANCIAL ─────────────────────────────────────────────────────────────
  {
    id: 'quickbooks',
    name: 'QuickBooks Desktop',
    category: 'finance',
    owner_dept: 'finance',
    credential_status: 'DEGRADED',
    truth_level: 'PRIMARY',
    refresh_policy: 'SCHEDULED',
    evidence_policy: 'REQUIRED',
    connector_id: 'quickbooks-runtime',
    access_method: 'qb-ops-agent on laptop1 → accounting-engine API (8844) → mi-core',
    write_capable: false,
    requires_approval_for_write: true,
    last_known_health: 'degraded',
    notes: 'Degraded because QB Desktop runs on laptop1 (external machine). Syncs when laptop1 online.',
  },
  {
    id: 'accounting-engine-db',
    name: 'Accounting Engine SQLite',
    category: 'finance',
    owner_dept: 'finance',
    credential_status: 'CONFIGURED',
    truth_level: 'DERIVED',
    refresh_policy: 'ON_DEMAND',
    evidence_policy: 'REQUIRED',
    access_method: 'HTTP GET http://127.0.0.1:8844/api/*',
    write_capable: false,
    requires_approval_for_write: true,
    last_known_health: 'healthy',
  },
  {
    id: 'payroll',
    name: 'Payroll System',
    category: 'finance',
    owner_dept: 'finance',
    credential_status: 'MISSING',
    truth_level: 'PRIMARY',
    refresh_policy: 'MANUAL',
    evidence_policy: 'REQUIRED',
    access_method: 'Not yet integrated',
    write_capable: false,
    requires_approval_for_write: true,
    last_known_health: 'unknown',
    notes: 'PLANNED. Must integrate before HR dept activates.',
  },
  {
    id: 'irs',
    name: 'IRS / Tax Authority',
    category: 'compliance',
    owner_dept: 'tax-compliance',
    credential_status: 'MISSING',
    truth_level: 'PRIMARY',
    refresh_policy: 'MANUAL',
    evidence_policy: 'REQUIRED',
    access_method: 'Not yet integrated. Tax dept PLANNED.',
    write_capable: false,
    requires_approval_for_write: true,
    last_known_health: 'unknown',
    notes: 'Never file without CEO double-approval.',
  },

  // ── POS / RESTAURANT ──────────────────────────────────────────────────────
  {
    id: 'toast',
    name: 'Toast POS',
    category: 'restaurant',
    owner_dept: 'restaurant-intelligence',
    credential_status: 'CONFIGURED',
    truth_level: 'PRIMARY',
    refresh_policy: 'ON_DEMAND',
    evidence_policy: 'REQUIRED',
    connector_id: 'toast-connector',
    access_method: 'Toast API via mi-core connector + Bakudan integration-system (Playwright)',
    write_capable: false,
    requires_approval_for_write: true,
    last_known_health: 'healthy',
    notes: 'Sales, menu, transaction data.',
  },
  {
    id: 'doordash',
    name: 'DoorDash Merchant',
    category: 'restaurant',
    owner_dept: 'restaurant-intelligence',
    credential_status: 'CONFIGURED',
    truth_level: 'PRIMARY',
    refresh_policy: 'ON_DEMAND',
    connector_id: 'doordash-agent',
    evidence_policy: 'REQUIRED',
    access_method: 'doordash-agent Playwright automation at mi-core/data/doordash-agent',
    write_capable: true,
    requires_approval_for_write: true,
    last_known_health: 'healthy',
    notes: 'Can update menu pricing and promos. CEO approval required for writes.',
  },
  {
    id: 'food-safety-db',
    name: 'Food Safety Records',
    category: 'operations',
    owner_dept: 'restaurant-intelligence',
    credential_status: 'CONFIGURED',
    truth_level: 'PRIMARY',
    refresh_policy: 'REALTIME',
    evidence_policy: 'REQUIRED',
    connector_id: 'food-safety',
    access_method: 'food-safety-gateway reads WhatsApp form submissions → SQLite + Google Sheets',
    write_capable: false,
    requires_approval_for_write: false,
    last_known_health: 'healthy',
  },

  // ── REVIEWS / REPUTATION ──────────────────────────────────────────────────
  {
    id: 'google-reviews',
    name: 'Google Reviews',
    category: 'marketing',
    owner_dept: 'marketing',
    credential_status: 'CONFIGURED',
    truth_level: 'PRIMARY',
    refresh_policy: 'SCHEDULED',
    evidence_policy: 'REQUIRED',
    access_method: 'review-automation-system FastAPI (port 8000) — Google OAuth',
    write_capable: true,
    requires_approval_for_write: true,
    last_known_health: 'healthy',
    notes: 'CEO approval required before posting any reply.',
  },
  {
    id: 'yelp',
    name: 'Yelp Reviews',
    category: 'marketing',
    owner_dept: 'marketing',
    credential_status: 'CONFIGURED',
    truth_level: 'PRIMARY',
    refresh_policy: 'SCHEDULED',
    evidence_policy: 'REQUIRED',
    access_method: 'review-automation-system with Yelp cookies (yelp-cookies.json)',
    write_capable: true,
    requires_approval_for_write: true,
    last_known_health: 'healthy',
  },

  // ── GOOGLE WORKSPACE ──────────────────────────────────────────────────────
  {
    id: 'google-drive',
    name: 'Google Drive',
    category: 'productivity',
    owner_dept: 'executive-assistant',
    credential_status: 'CONFIGURED',
    truth_level: 'SECONDARY',
    refresh_policy: 'ON_DEMAND',
    evidence_policy: 'RECOMMENDED',
    connector_id: 'google-drive',
    access_method: 'mi-core Google Drive connector (OAuth)',
    write_capable: true,
    requires_approval_for_write: true,
    last_known_health: 'healthy',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'communication',
    owner_dept: 'executive-assistant',
    credential_status: 'CONFIGURED',
    truth_level: 'PRIMARY',
    refresh_policy: 'ON_DEMAND',
    evidence_policy: 'REQUIRED',
    connector_id: 'gmail',
    access_method: 'mi-core Gmail connector (OAuth)',
    write_capable: true,
    requires_approval_for_write: true,
    last_known_health: 'healthy',
    notes: 'CEO approval required before sending any email.',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    category: 'productivity',
    owner_dept: 'executive-assistant',
    credential_status: 'CONFIGURED',
    truth_level: 'PRIMARY',
    refresh_policy: 'ON_DEMAND',
    evidence_policy: 'REQUIRED',
    connector_id: 'google-calendar',
    access_method: 'mi-core Google Calendar connector (OAuth)',
    write_capable: true,
    requires_approval_for_write: true,
    last_known_health: 'healthy',
    notes: 'CEO approval required before creating calendar events.',
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    category: 'operations',
    owner_dept: 'restaurant-intelligence',
    credential_status: 'CONFIGURED',
    truth_level: 'SECONDARY',
    refresh_policy: 'SCHEDULED',
    evidence_policy: 'OPTIONAL',
    connector_id: 'google-sheets',
    access_method: 'food-safety-gateway Google Sheets sync',
    write_capable: true,
    requires_approval_for_write: false,
    last_known_health: 'healthy',
    notes: 'Food safety form data auto-synced.',
  },

  // ── HEALTH / PERSONAL ─────────────────────────────────────────────────────
  {
    id: 'apple-health',
    name: 'Apple Health / Huawei Health',
    category: 'health',
    owner_dept: 'executive-assistant',
    credential_status: 'CONFIGURED',
    truth_level: 'PRIMARY',
    refresh_policy: 'SCHEDULED',
    evidence_policy: 'OPTIONAL',
    connector_id: 'health-export',
    access_method: 'JSON exports at .local-agent-global/health-export/',
    write_capable: false,
    requires_approval_for_write: false,
    last_known_health: 'healthy',
    notes: 'Sleep, HRV, steps data. Phase 23.',
  },

  // ── WHATSAPP ──────────────────────────────────────────────────────────────
  {
    id: 'whatsapp',
    name: 'WhatsApp (CEO + Business)',
    category: 'communication',
    owner_dept: 'executive-assistant',
    credential_status: 'CONFIGURED',
    truth_level: 'PRIMARY',
    refresh_policy: 'REALTIME',
    evidence_policy: 'REQUIRED',
    connector_id: 'whatsapp',
    access_method: 'whatsapp-ai-gateway (port 3211) + mi-ceo-observer (port 3212)',
    write_capable: true,
    requires_approval_for_write: true,
    last_known_health: 'healthy',
    notes: 'CEO approval required before sending any WhatsApp message to external parties.',
  },

  // ── KNOWLEDGE / INTERNAL ──────────────────────────────────────────────────
  {
    id: 'knowledge-db',
    name: 'Mi Knowledge Database',
    category: 'knowledge',
    owner_dept: 'library',
    credential_status: 'CONFIGURED',
    truth_level: 'DERIVED',
    refresh_policy: 'ON_DEMAND',
    evidence_policy: 'OPTIONAL',
    access_method: 'SQLite at .local-agent-global/knowledge-db/knowledge.db (WAL)',
    write_capable: true,
    requires_approval_for_write: false,
    last_known_health: 'healthy',
  },
  {
    id: 'operational-memory-db',
    name: 'Operational Memory',
    category: 'knowledge',
    owner_dept: 'executive-assistant',
    credential_status: 'CONFIGURED',
    truth_level: 'DERIVED',
    refresh_policy: 'REALTIME',
    evidence_policy: 'REQUIRED',
    access_method: 'SQLite at .local-agent-global/operational-memory/memory.db (WAL)',
    write_capable: true,
    requires_approval_for_write: false,
    last_known_health: 'healthy',
  },
  {
    id: 'evidence-db',
    name: 'Company OS Evidence DB',
    category: 'audit',
    owner_dept: 'qa',
    credential_status: 'CONFIGURED',
    truth_level: 'PRIMARY',
    refresh_policy: 'REALTIME',
    evidence_policy: 'REQUIRED',
    access_method: 'SQLite at .local-agent-global/company-os/evidence.db (WAL)',
    write_capable: true,
    requires_approval_for_write: false,
    last_known_health: 'healthy',
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function getDataSource(id: string): DataSource | undefined {
  return DATA_SOURCES.find(s => s.id === id);
}

export function getSourcesByDept(deptId: string): DataSource[] {
  return DATA_SOURCES.filter(s => s.owner_dept === deptId);
}

export function getHealthySources(): DataSource[] {
  return DATA_SOURCES.filter(s => s.last_known_health === 'healthy');
}

export function getMissingSources(): DataSource[] {
  return DATA_SOURCES.filter(s => s.credential_status === 'MISSING');
}

export function getWriteCapableSources(): DataSource[] {
  return DATA_SOURCES.filter(s => s.write_capable);
}

export function dataSourceSummary(): string {
  const byHealth: Record<string, number> = {};
  for (const s of DATA_SOURCES) {
    byHealth[s.last_known_health] = (byHealth[s.last_known_health] || 0) + 1;
  }
  return [
    `Data Source Registry — ${DATA_SOURCES.length} total`,
    ...Object.entries(byHealth).map(([h, n]) => `  ${h}: ${n}`),
    `  write-capable: ${getWriteCapableSources().length}`,
    `  missing credentials: ${getMissingSources().length}`,
  ].join('\n');
}
