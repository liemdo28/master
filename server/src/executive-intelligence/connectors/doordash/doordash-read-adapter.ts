/**
 * DoorDash Read Adapter — Phase 21
 *
 * Read-only adapter for DoorDash marketplace data.
 * Reads: order data, ratings, delivery metrics, store performance.
 *
 * This is a stub — full implementation requires DoorDash API credentials.
 */

import { FinanceReadAdapter, BalanceReport, ProfitLossReport, TransactionRecord, ConnectorHealthStatus } from '../finance-read-adapter';

export class DoorDashReadAdapter implements FinanceReadAdapter {
  readonly sourceName = 'DoorDash';

  private developerId: string;
  private keyId: string;
  private signingKey: string;

  constructor() {
    this.developerId = process.env.DOORDASH_DEVELOPER_ID || '';
    this.keyId = process.env.DOORDASH_KEY_ID || '';
    this.signingKey = process.env.DOORDASH_SIGNING_KEY || '';
  }

  private get configured(): boolean {
    return !!(this.developerId && this.keyId && this.signingKey);
  }

  async getHealthStatus(): Promise<ConnectorHealthStatus> {
    if (!this.configured) {
      return {
        connected: false,
        lastReadAt: null,
        lastError: 'DoorDash credentials not configured (DOORDASH_DEVELOPER_ID, DOORDASH_KEY_ID)',
        latencyMs: null,
        dataFreshness: 'unknown',
      };
    }

    // TODO: Implement DoorDash API health check
    return {
      connected: false,
      lastReadAt: null,
      lastError: 'DoorDash adapter not yet implemented',
      latencyMs: null,
      dataFreshness: 'unknown',
    };
  }

  async getBalanceReport(): Promise<BalanceReport> {
    // DoorDash doesn't have a traditional balance sheet — return empty
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
    // TODO: Call DoorDash Reports API for sales/revenue data
    throw new Error('DoorDash getProfitLoss not yet implemented');
  }

  async getRecentTransactions(_days: number = 7): Promise<TransactionRecord[]> {
    // TODO: Call DoorDash Orders API for recent orders
    throw new Error('DoorDash getRecentTransactions not yet implemented');
  }
}
