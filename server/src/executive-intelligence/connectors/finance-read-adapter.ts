/**
 * Finance Read Adapter Interface — Phase 21 (Week 5)
 *
 * Standardized interface for reading financial data from multiple sources.
 * Implementations: QBOAdapter, QBDBridgeAdapter, ToastReadAdapter, DoorDashReadAdapter.
 *
 * Design principle: read-only by default. Write actions require explicit CEO approval.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BalanceReport {
  source: string;
  asOf: string;
  accounts: Array<{
    name: string;
    type: string;
    balance: number;
    currency: string;
  }>;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export interface ProfitLossReport {
  source: string;
  period: { from: string; to: string };
  revenue: number;
  expenses: number;
  netIncome: number;
  categories: Array<{
    name: string;
    amount: number;
    type: 'revenue' | 'expense';
  }>;
}

export interface TransactionRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  account: string;
}

export interface ConnectorHealthStatus {
  connected: boolean;
  lastReadAt: string | null;
  lastError: string | null;
  latencyMs: number | null;
  dataFreshness: 'fresh' | 'stale' | 'unknown';
}

/**
 * Standard interface for reading financial data from any source.
 * All methods are read-only by design.
 */
export interface FinanceReadAdapter {
  /** Human-readable source name */
  readonly sourceName: string;

  /** Check if the connector is healthy and authenticated */
  getHealthStatus(): Promise<ConnectorHealthStatus>;

  /** Get balance sheet report */
  getBalanceReport(): Promise<BalanceReport>;

  /** Get profit & loss report for a period */
  getProfitLoss(from: string, to: string): Promise<ProfitLossReport>;

  /** Get recent transactions (last N days) */
  getRecentTransactions(days?: number): Promise<TransactionRecord[]>;
}

// ── Convenience type for the adapter registry ─────────────────────────────────

export type FinanceAdapterType = 'qbo' | 'qbd' | 'toast' | 'doordash';

export interface FinanceAdapterEntry {
  type: FinanceAdapterType;
  adapter: FinanceReadAdapter;
  enabled: boolean;
}
