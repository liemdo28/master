import type { FinanceSourceHealth, RevenueRecord, RevenueSummary } from './types';
import { getLocalCertifiedLedger } from './sample-ledger';

export function buildRevenueSummary(sourceHealth: FinanceSourceHealth, records: RevenueRecord[] = getLocalCertifiedLedger()): RevenueSummary {
  const byStore = new Map<string, { revenue: number; transactions: number; source_certified: boolean }>();
  for (const record of records) {
    const current = byStore.get(record.store) || { revenue: 0, transactions: 0, source_certified: true };
    current.revenue += record.revenue;
    current.transactions += record.transactions;
    current.source_certified = current.source_certified && record.source_certified;
    byStore.set(record.store, current);
  }

  const stores = Array.from(byStore.entries()).map(([store, value]) => ({ store, ...value }));
  const warnings = sourceHealth.status === 'healthy'
    ? []
    : [`Live QuickBooks source is ${sourceHealth.status}; revenue summary uses local certified sample ledger only.`];

  return {
    totalRevenue: stores.reduce((sum, store) => sum + store.revenue, 0),
    totalTransactions: stores.reduce((sum, store) => sum + store.transactions, 0),
    stores,
    sourceStatus: sourceHealth.status,
    warnings,
  };
}
