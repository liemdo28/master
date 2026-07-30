/**
 * Toast Read Adapter — Phase 21
 *
 * Read-only adapter for Toast restaurant management platform.
 * Reads: sales data, labor costs, menu performance, online orders.
 *
 * This is a stub — full implementation requires Toast API credentials.
 */

import { FinanceReadAdapter, BalanceReport, ProfitLossReport, TransactionRecord, ConnectorHealthStatus } from '../finance-read-adapter';

export class ToastReadAdapter implements FinanceReadAdapter {
  readonly sourceName = 'Toast';

  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.TOAST_API_KEY || '';
    this.baseUrl = process.env.TOAST_BASE_URL || 'https://ws-api.toasttab.com';
  }

  private get configured(): boolean {
    return !!this.apiKey;
  }

  async getHealthStatus(): Promise<ConnectorHealthStatus> {
    if (!this.configured) {
      return {
        connected: false,
        lastReadAt: null,
        lastError: 'Toast API key not configured (TOAST_API_KEY)',
        latencyMs: null,
        dataFreshness: 'unknown',
      };
    }

    // TODO: Implement Toast API health check
    return {
      connected: false,
      lastReadAt: null,
      lastError: 'Toast adapter not yet implemented',
      latencyMs: null,
      dataFreshness: 'unknown',
    };
  }

  async getBalanceReport(): Promise<BalanceReport> {
    // Toast doesn't have a traditional balance sheet — return empty
    return {
      source: this.sourceName,
      asOf: new Date().toISOString(),
      accounts: [],
      totalAssets: 0,
      totalLiabilities: 0,
      netWorth: 0,
    };
  }

  async getProfitLoss(_from: string, _to: string): Promise<ProfitLossReport> {
    // TODO: Call Toast Reports API for sales/labor data
    throw new Error('Toast getProfitLoss not yet implemented');
  }

  async getRecentTransactions(_days: number = 7): Promise<TransactionRecord[]> {
    // TODO: Call Toast Orders API for recent orders
    throw new Error('Toast getRecentTransactions not yet implemented');
  }
}
