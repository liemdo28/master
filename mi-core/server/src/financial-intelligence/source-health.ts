import fs from 'fs';
import path from 'path';
import type { FinanceSourceHealth, FinanceSourceStatus } from './types';

const QB_SUMMARY = path.join(process.cwd(), '.local-agent-global', 'visibility', 'quickbooks', 'summary.json');
const QB_DATA = path.join(process.cwd(), '.local-agent-global', 'visibility', 'quickbooks', 'data.json');

function freshnessMinutes(timestamp: string | null): number | null {
  if (!timestamp) return null;
  const ms = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.round(ms / 60000);
}

function loadJson(filePath: string): any | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function getFinanceSourceHealth(): FinanceSourceHealth {
  const summary = loadJson(QB_SUMMARY);
  const data = loadJson(QB_DATA);
  if (!summary && !data) {
    return {
      source: 'QuickBooks Runtime',
      status: 'missing',
      certified: false,
      lastSuccessfulSync: null,
      freshnessMinutes: null,
      gaps: ['QuickBooks visibility cache is missing.'],
      actionRequired: true,
    };
  }

  const lastSuccessfulSync = summary?.last_successful_sync || data?.last_successful_sync || data?.last_sync_timestamp || null;
  const fresh = freshnessMinutes(lastSuccessfulSync);
  const gaps = [
    ...(Array.isArray(data?.gaps) ? data.gaps : []),
    ...(summary?.certified === false ? ['QuickBooks runtime is not certified.'] : []),
    ...(fresh !== null && fresh > 1440 ? [`Last successful QB sync is stale (${fresh} minutes old).`] : []),
  ];
  const dashboardStatus = String(summary?.dashboard_status || data?.dashboard_status || summary?.status || data?.status || '').toLowerCase();
  const status: FinanceSourceStatus = !lastSuccessfulSync ? 'missing'
    : dashboardStatus.includes('needs') || dashboardStatus.includes('degraded') ? 'degraded'
      : fresh !== null && fresh > 1440 ? 'stale'
        : summary?.certified || data?.certified ? 'healthy'
          : 'degraded';

  return {
    source: 'QuickBooks Runtime',
    status,
    certified: Boolean(summary?.certified || data?.certified),
    lastSuccessfulSync,
    freshnessMinutes: fresh,
    gaps,
    actionRequired: Boolean(summary?.action_required || data?.action_required || gaps.length > 0),
  };
}
