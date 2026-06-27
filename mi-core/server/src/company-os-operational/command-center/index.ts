import { buildITDashboard } from '../../it-operations';
import { buildCreativeDashboard } from '../../creative-division';
import { buildDataPlatformDashboard } from '../../company-data-platform';
import { buildIntelligenceDashboard } from '../../company-intelligence';
import type { CommandCenterSnapshot } from '../types';

export function buildCommandCenterSnapshot(): CommandCenterSnapshot {
  const it = buildITDashboard();
  const creative = buildCreativeDashboard();
  const data = buildDataPlatformDashboard();
  const intelligence = buildIntelligenceDashboard();

  const truthBlockers = Array.from(new Set([
    ...it.warnings,
    ...creative.warnings,
    ...data.warnings,
    ...intelligence.warnings,
    'QuickBooks source is degraded/stale until live sync is re-certified.',
    'GBP/GA4/GSC publishing and metrics remain blocked without credentials.',
    'Toast and DoorDash live connectors are not certified for production mutation.',
  ]));

  return {
    generatedAt: new Date().toISOString(),
    status: truthBlockers.length === 0 ? 'MI_COMPANY_OS_OPERATIONAL' : 'MI_COMPANY_OS_PARTIAL',
    finance: {
      revenue: 'local-ledger available; live QB not certified',
      labor: 'payroll source missing',
      payroll: 'approval-required; live payroll not certified',
      risk: ['QB stale', 'payroll missing', 'live POS not certified'],
    },
    marketing: {
      traffic: 'SEO local evidence available; GSC/GA4 credentials missing',
      conversions: 'website conversion loop defined; live conversion metrics missing',
      reviews: 'review workflow approval-gated',
      campaigns: 'campaign drafts available; publishing approval required',
    },
    operations: {
      foodSafety: 'operator runtime can collect evidence; production SaaS remains gated',
      doordash: 'campaign changes require approval; live connector not certified',
      toast: 'live POS connector not certified',
      quickbooks: 'degraded/stale source health',
    },
    it: {
      services: `${it.services.filter(s => s.status === 'healthy').length}/${it.services.length} healthy`,
      ports: `${it.services.filter(s => s.port !== null).length} service ports tracked`,
      backups: `${it.backups.filter(b => b.status === 'current').length}/${it.backups.length} current`,
      incidents: it.warnings.length === 0 ? 'none from local dashboard' : it.warnings.join('; '),
    },
    creative: {
      assets: `${creative.assets.length} assets tracked`,
      approvals: `${creative.assets.filter(a => a.status === 'approved').length} approved`,
      campaignSupport: creative.pipelines.map(p => `${p.name}:${p.status}`).join(', '),
    },
    truthBlockers,
  };
}

export function buildCommandCenterApiProof() {
  const snapshot = buildCommandCenterSnapshot();
  return {
    endpoint: 'company-os-operational.command-center.snapshot',
    generatedAt: snapshot.generatedAt,
    status: snapshot.status,
    panels: ['finance', 'marketing', 'operations', 'it', 'creative'],
    truthBlockers: snapshot.truthBlockers,
  };
}
