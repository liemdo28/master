/**
 * DoorDash Read Adapter — Playwright-based
 * Proxies to mi-doordash-agent (port 3460) which scrapes merchant.doordash.com
 */

import { FinanceReadAdapter, BalanceReport, ProfitLossReport, TransactionRecord, ConnectorHealthStatus } from '../finance-read-adapter';

const AGENT_URL = process.env.DD_AGENT_URL || 'http://127.0.0.1:3460';

async function fetchAgent(path: string): Promise<any> {
  const http = require('http');
  return new Promise((resolve, reject) => {
    const req = http.get(`${AGENT_URL}${path}`, (res: any) => {
      let body = '';
      res.on('data', (d: any) => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Invalid JSON from doordash-agent')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('doordash-agent timeout')); });
  });
}

export class DoorDashReadAdapter implements FinanceReadAdapter {
  readonly sourceName = 'DoorDash';

  async getHealthStatus(): Promise<ConnectorHealthStatus> {
    const start = Date.now();
    try {
      const data = await fetchAgent('/health');
      return {
        connected: data.status === 'ok',
        lastReadAt: data.last_run,
        lastError: data.last_error || null,
        latencyMs: Date.now() - start,
        dataFreshness: data.has_cache ? 'fresh' : 'unknown',
      };
    } catch (err: any) {
      return {
        connected: false,
        lastReadAt: null,
        lastError: `doordash-agent unreachable: ${err.message}`,
        latencyMs: null,
        dataFreshness: 'unknown',
      };
    }
  }

  async getMetrics(): Promise<any> {
    return fetchAgent('/metrics');
  }

  async triggerScrape(): Promise<any> {
    const http = require('http');
    return new Promise((resolve, reject) => {
      const req = http.request(`${AGENT_URL}/scrape`, { method: 'POST' }, (res: any) => {
        let body = '';
        res.on('data', (d: any) => body += d);
        res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({ status: 'triggered' }); } });
      });
      req.on('error', reject);
      req.end();
    });
  }

  async getBalanceReport(): Promise<BalanceReport> {
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
    const data = await fetchAgent('/metrics');
    const totalRevenue = data.accounts?.reduce((sum: number, a: any) =>
      sum + (a.stores?.reduce((s: number, st: any) =>
        s + parseFloat(st.revenue_today || '0'), 0) || 0), 0) || 0;
    return {
      source: this.sourceName,
      period: { from: _from, to: _to },
      revenue: totalRevenue,
      expenses: 0,
      netIncome: totalRevenue,
      categories: [],
    };
  }

  async getRecentTransactions(_days: number = 7): Promise<TransactionRecord[]> {
    return [];
  }
}
