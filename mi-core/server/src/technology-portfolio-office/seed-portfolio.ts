import type { PortfolioItem, PortfolioTrack } from './types';

const stamp = () => new Date().toISOString();

const seed: Record<PortfolioTrack, Array<Omit<PortfolioItem, 'item_id' | 'track' | 'evidence' | 'createdAt' | 'updatedAt'>>> = {
  'Open Source': [
    { name: 'Open Source Governance Registry', owner_division: 'engineering', status: 'AUDIT', business_value: 90, maintenance_cost: 'medium', risk: 'medium', source_ref: 'server/src/open-source-governance', approval_required: false },
    { name: 'Playwright', owner_division: 'operator', status: 'AUDIT', business_value: 92, maintenance_cost: 'low', risk: 'low', source_ref: 'OSS-playwright', approval_required: false },
    { name: 'DuckDB', owner_division: 'finance', status: 'DISCOVERY', business_value: 90, maintenance_cost: 'low', risk: 'low', source_ref: 'OSS-duckdb', approval_required: false },
  ],
  'AI Models': [
    { name: 'Qwen Coder', owner_division: 'engineering', status: 'AUDIT', business_value: 86, maintenance_cost: 'low', risk: 'medium', source_ref: 'engineering/model-registry', approval_required: false },
    { name: 'Claude', owner_division: 'engineering', status: 'AUDIT', business_value: 92, maintenance_cost: 'high', risk: 'medium', source_ref: 'engineering/model-registry', approval_required: false },
    { name: 'DeepSeek', owner_division: 'engineering', status: 'AUDIT', business_value: 82, maintenance_cost: 'low', risk: 'medium', source_ref: 'engineering/model-registry', approval_required: false },
    { name: 'Kimi', owner_division: 'engineering', status: 'AUDIT', business_value: 84, maintenance_cost: 'medium', risk: 'unknown', source_ref: 'engineering/model-registry', approval_required: false },
  ],
  SaaS: [
    { name: 'GitHub', owner_division: 'engineering', status: 'PRODUCTION', business_value: 95, maintenance_cost: 'medium', risk: 'low', source_ref: 'github.com/liemdo28/master', approval_required: true },
    { name: 'QuickBooks', owner_division: 'finance', status: 'PRODUCTION', business_value: 95, maintenance_cost: 'medium', risk: 'high', source_ref: 'services/qb-ops-agent', approval_required: true },
    { name: 'DoorDash Merchant', owner_division: 'operations', status: 'DISCOVERY', business_value: 80, maintenance_cost: 'medium', risk: 'medium', source_ref: 'services/doordash-agent', approval_required: true },
  ],
  'Internal Projects': [
    { name: 'Executive Coordination', owner_division: 'executive', status: 'PRODUCTION', business_value: 100, maintenance_cost: 'medium', risk: 'low', source_ref: 'server/src/executive-coordination', approval_required: false },
    { name: 'Engineering Division', owner_division: 'engineering', status: 'PILOT', business_value: 88, maintenance_cost: 'medium', risk: 'medium', source_ref: 'server/src/engineering-division', approval_required: true },
    { name: 'Operator Runtime', owner_division: 'operator', status: 'AUDIT', business_value: 86, maintenance_cost: 'medium', risk: 'medium', source_ref: 'server/src/operator-runtime', approval_required: true },
  ],
};

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function getSeedPortfolioItems(): PortfolioItem[] {
  const now = stamp();
  return Object.entries(seed).flatMap(([track, items]) =>
    items.map((item) => ({
      ...item,
      item_id: `TPO-${slug(track)}-${slug(item.name)}`,
      track: track as PortfolioTrack,
      evidence: [{ type: 'registry', value: 'Seeded from MI_COMPANY_OS_MASTER_SPEC and local source inventory.', capturedAt: now }],
      createdAt: now,
      updatedAt: now,
    }))
  );
}
