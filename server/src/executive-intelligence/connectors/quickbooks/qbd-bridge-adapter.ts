/**
 * QuickBooks Desktop Bridge Adapter — Phase 21
 *
 * Read-only adapter for QuickBooks Desktop via the existing bridge.
 * Uses Desktop SDK/QBXML on the same machine or LAN.
 * Web Connector can schedule communication with web service.
 *
 * This is a stub — full implementation requires the QBXML bridge setup.
 */

import { FinanceReadAdapter, BalanceReport, ProfitLossReport, TransactionRecord, ConnectorHealthStatus } from '../finance-read-adapter';

const BRIDGE_URL = process.env.QBD_BRIDGE_URL || 'http://127.0.0.1:3211';

export class QBDBridgeAdapter implements FinanceReadAdapter {
  readonly sourceName = 'QuickBooks Desktop (Bridge)';

  async getHealthStatus(): Promise<ConnectorHealthStatus> {
    try {
      const res = await fetch(`${BRIDGE_URL}/health`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        return {
          connected: false,
          lastReadAt: null,
          lastError: `Bridge returned ${res.status}`,
          latencyMs: null,
          dataFreshness: 'unknown',
        };
      }
      return {
        connected: true,
        lastReadAt: new Date().toISOString(),
        lastError: null,
        latencyMs: null,
        dataFreshness: 'unknown',
      };
    } catch (e) {
      return {
        connected: false,
        lastReadAt: null,
        lastError: `Bridge unreachable: ${e instanceof Error ? e.message : String(e)}`,
        latencyMs: null,
        dataFreshness: 'unknown',
      };
    }
  }

  async getBalanceReport(): Promise<BalanceReport> {
    // TODO: Call QBD bridge API for balance sheet
    throw new Error('QBD Bridge getBalanceReport not yet implemented');
  }

  async getProfitLoss(_from: string, _to: string): Promise<ProfitLossReport> {
    // TODO: Call QBD bridge API for P&L
    throw new Error('QBD Bridge getProfitLoss not yet implemented');
  }

  async getRecentTransactions(_days: number = 7): Promise<TransactionRecord[]> {
    // TODO: Call QBD bridge API for transactions
    throw new Error('QBD Bridge getRecentTransactions not yet implemented');
  }
}
