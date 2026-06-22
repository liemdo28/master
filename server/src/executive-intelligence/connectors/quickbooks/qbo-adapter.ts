/**
 * QuickBooks Online Adapter — Phase 21
 *
 * Read-only adapter for QuickBooks Online REST API.
 * Uses OAuth 2.0 for authentication.
 *
 * This is a stub — full implementation requires QBO OAuth credentials
 * and the Intuit SDK setup.
 */

import { FinanceReadAdapter, BalanceReport, ProfitLossReport, TransactionRecord, ConnectorHealthStatus } from '../finance-read-adapter';

export class QBOAdapter implements FinanceReadAdapter {
  readonly sourceName = 'QuickBooks Online';

  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private realmId: string;
  private baseUrl: string;

  constructor() {
    this.clientId = process.env.QBO_CLIENT_ID || '';
    this.clientSecret = process.env.QBO_CLIENT_SECRET || '';
    this.refreshToken = process.env.QBO_REFRESH_TOKEN || '';
    this.realmId = process.env.QBO_REALM_ID || '';
    this.baseUrl = process.env.QBO_BASE_URL || 'https://quickbooks.api.intuit.com';
  }

  private get configured(): boolean {
    return !!(this.clientId && this.clientSecret && this.refreshToken && this.realmId);
  }

  async getHealthStatus(): Promise<ConnectorHealthStatus> {
    if (!this.configured) {
      return {
        connected: false,
        lastReadAt: null,
        lastError: 'QBO credentials not configured (QBO_CLIENT_ID, QBO_REFRESH_TOKEN, QBO_REALM_ID)',
        latencyMs: null,
        dataFreshness: 'unknown',
      };
    }

    // TODO: Implement OAuth token refresh + API ping
    return {
      connected: false,
      lastReadAt: null,
      lastError: 'QBO adapter not yet implemented',
      latencyMs: null,
      dataFreshness: 'unknown',
    };
  }

  async getBalanceReport(): Promise<BalanceReport> {
    if (!this.configured) {
      return this.emptyBalanceReport();
    }
    // TODO: Call QBO Reports API — BalanceSheet
    throw new Error('QBO getBalanceReport not yet implemented');
  }

  async getProfitLoss(_from: string, _to: string): Promise<ProfitLossReport> {
    if (!this.configured) {
      return this.emptyProfitLossReport();
    }
    // TODO: Call QBO Reports API — ProfitAndLoss
    throw new Error('QBO getProfitLoss not yet implemented');
  }

  async getRecentTransactions(_days: number = 7): Promise<TransactionRecord[]> {
    if (!this.configured) {
      return [];
    }
    // TODO: Call QBO Query API — TransactionListByDate
    throw new Error('QBO getRecentTransactions not yet implemented');
  }

  private emptyBalanceReport(): BalanceReport {
    return {
      source: this.sourceName,
      asOf: new Date().toISOString(),
      accounts: [],
      totalAssets: 0,
      totalLiabilities: 0,
      netWorth: 0,
    };
  }

  private emptyProfitLossReport(): ProfitLossReport {
    return {
      source: this.sourceName,
      period: { from: '', to: '' },
      revenue: 0,
      expenses: 0,
      netIncome: 0,
      categories: [],
    };
  }
}
