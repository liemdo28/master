/**
 * DashboardVisibilityConnector.mjs
 * Reads bakudanramen.com Dashboard data from cache + live HTTP check.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';

const GLOBAL_DIR   = process.env.GLOBAL_DIR   || 'E:/Project/Master/.local-agent-global';
const DASHBOARD_URL = process.env.DASHBOARD_API || 'http://dashboard.bakudanramen.com';
const CACHE_DIR    = path.join(GLOBAL_DIR, 'visibility', 'dashboard');

function ping(url, timeoutMs = 3000) {
  return new Promise(resolve => {
    try {
      const req = http.get(url, res => { resolve({ ok: true, status: res.statusCode }); req.destroy(); });
      req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ ok: false, reason: 'timeout' }); });
      req.on('error', e => resolve({ ok: false, reason: e.message }));
    } catch (e) { resolve({ ok: false, reason: e.message }); }
  });
}

export class DashboardVisibilityConnector {
  constructor() {
    this.id = 'dashboard';
    this.name = 'Dashboard (bakudanramen.com)';
  }

  getCacheSnapshot() {
    const cacheFile = path.join(CACHE_DIR, 'snapshot.json');
    if (!fs.existsSync(cacheFile)) return null;
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      const stat = fs.statSync(cacheFile);
      const age_min = Math.floor((Date.now() - stat.mtimeMs) / 60000);
      return { data, age_min, file: cacheFile };
    } catch { return null; }
  }

  async getLiveStatus() {
    const result = await ping(`${DASHBOARD_URL}/api/health`);
    if (!result.ok) {
      const result2 = await ping(DASHBOARD_URL);
      return result2;
    }
    return result;
  }

  async getSnapshot() {
    const live = await this.getLiveStatus();
    const cache = this.getCacheSnapshot();

    if (live.ok) {
      return {
        status: 'ok',
        connector: 'dashboard',
        source: 'live',
        url: DASHBOARD_URL,
        live_status: live.status,
        cache_data: cache?.data || null,
        last_sync: cache?.data?.synced_at || null,
      };
    }

    if (cache) {
      return {
        status: 'ok',
        connector: 'dashboard',
        source: 'cache',
        cache_age_min: cache.age_min,
        data: cache.data,
        last_sync: cache.data?.synced_at || null,
        warning: 'Using cached data — dashboard unreachable',
      };
    }

    return {
      status: 'CONNECTOR_NOT_CONFIGURED',
      connector: 'dashboard',
      setup: `Dashboard at ${DASHBOARD_URL} is not reachable and no cache exists`,
      data: null,
    };
  }

  /** Get task summary */
  async getTasks() {
    const snap = await this.getSnapshot();
    if (snap.status !== 'ok') return snap;
    const data = snap.cache_data || snap.data || {};
    return {
      status: 'ok',
      source: snap.source,
      tasks: data.tasks || [],
      task_count: data.task_count || data.tasks?.length || 0,
    };
  }

  getSummaryText() {
    const cache = this.getCacheSnapshot();
    if (!cache) return `🏪 Dashboard: No cache — run sync or check ${DASHBOARD_URL}`;
    const d = cache.data;
    return `🏪 Dashboard: ${d.modules_count ?? '?'} modules, ${d.reports_count ?? '?'} reports (cached ${cache.age_min}min ago)`;
  }
}

export const dashboardConnector = new DashboardVisibilityConnector();
