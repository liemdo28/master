import type { RevenueRecord } from './types';

export const LOCAL_CERTIFIED_SAMPLE_LEDGER: RevenueRecord[] = [
  { store: 'Raw Sushi', source: 'local-certified-sample-ledger', business_date: '2026-06-15', revenue: 1240.50, transactions: 28, source_certified: true },
  { store: 'Bakudan Ramen', source: 'local-certified-sample-ledger', business_date: '2026-06-15', revenue: 980.25, transactions: 22, source_certified: true },
  { store: 'Stone Oak', source: 'local-certified-sample-ledger', business_date: '2026-06-15', revenue: 760.00, transactions: 17, source_certified: true },
];

export function getLocalCertifiedLedger(): RevenueRecord[] {
  return LOCAL_CERTIFIED_SAMPLE_LEDGER;
}
