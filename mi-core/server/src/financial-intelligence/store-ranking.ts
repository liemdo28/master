import type { RevenueSummary, StoreRanking } from './types';

export function rankStores(summary: RevenueSummary): StoreRanking[] {
  return [...summary.stores]
    .sort((a, b) => b.revenue - a.revenue)
    .map((store, index) => ({
      store: store.store,
      revenue: store.revenue,
      transactions: store.transactions,
      rank: index + 1,
    }));
}
