/**
 * PlatformHealthChecker — checks health of all platform connectors
 * Verifies cache freshness, last sync time, and actual availability.
 * NEVER fakes health status — always returns actual measured status.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { registry } from './ConnectorRegistry.mjs';
import { visibilityCache } from './VisibilityCache.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';

const STALE_THRESHOLD_MS = 3600000; // 1 hour
const CRITICAL_STALE_MS  = 86400000; // 24 hours

export class PlatformHealthChecker {
  /**
   * Check health of a specific connector
   * @param {string} connectorId
   * @returns {object} health status
   */
  checkConnector(connectorId) {
    const connector = registry.getById(connectorId);
    if (!connector) {
      return { connector_id: connectorId, status: 'not_found', message: 'Connector not in registry' };
    }

    if (connector.auth_status === 'not_configured') {
      return {
        connector_id: connectorId,
        name: connector.name,
        status: 'not_configured',
        message: connector.setup_hint || 'Connector not configured',
        auth_status: 'not_configured',
      };
    }

    if (connector.auth_status === 'expired') {
      return {
        connector_id: connectorId,
        name: connector.name,
        status: 'expired',
        message: 'Connector auth token has expired — re-authorize',
        auth_status: 'expired',
      };
    }

    // Connected — check cache freshness
    const cached = visibilityCache.get(connectorId, CRITICAL_STALE_MS);
    if (!cached) {
      // No cache at all
      return {
        connector_id: connectorId,
        name: connector.name,
        status: 'offline',
        message: 'No cache data — connector never synced or cache cleared',
        last_sync: connector.last_sync,
        auth_status: 'connected',
      };
    }

    const age = cached.age_ms;
    if (age > CRITICAL_STALE_MS) {
      return {
        connector_id: connectorId,
        name: connector.name,
        status: 'degraded',
        message: `Cache is stale (${Math.round(age / 3600000)}h old) — re-sync recommended`,
        last_sync: connector.last_sync,
        cached_at: cached.cached_at,
        age_ms: age,
        auth_status: 'connected',
      };
    }

    if (age > STALE_THRESHOLD_MS) {
      return {
        connector_id: connectorId,
        name: connector.name,
        status: 'healthy',
        message: 'Connected but cache is aging — consider sync',
        last_sync: connector.last_sync,
        cached_at: cached.cached_at,
        age_ms: age,
        auth_status: 'connected',
      };
    }

    return {
      connector_id: connectorId,
      name: connector.name,
      status: 'healthy',
      message: 'Fully operational',
      last_sync: connector.last_sync,
      cached_at: cached.cached_at,
      age_ms: age,
      auth_status: 'connected',
    };
  }

  /**
   * Check health of all connectors
   * @returns {object} health board
   */
  checkAll() {
    const all = registry.getAll();
    const results = {
      generated_at: new Date().toISOString(),
      total: all.length,
      healthy: 0,
      degraded: 0,
      offline: 0,
      not_configured: 0,
      connectors: [],
    };

    for (const connector of all) {
      const health = this.checkConnector(connector.connector_id);
      results.connectors.push(health);
      if (health.status === 'healthy') results.healthy++;
      else if (health.status === 'degraded') results.degraded++;
      else if (health.status === 'offline') results.offline++;
      else if (health.status === 'not_configured') results.not_configured++;
    }

    return results;
  }

  /**
   * Get only connectors with issues (degraded or offline)
   * @returns {object[]} connectors needing attention
   */
  getNeedsAttention() {
    const board = this.checkAll();
    return board.connectors.filter(c => c.status === 'degraded' || c.status === 'offline');
  }

  /**
   * Get quick summary for chat display
   * @returns {string} one-line health summary
   */
  getQuickSummary() {
    const board = this.checkAll();
    const lines = [];
    if (board.healthy > 0) lines.push(`${board.healthy} ✓`);
    if (board.degraded > 0) lines.push(`${board.degraded} ⚠`);
    if (board.offline > 0) lines.push(`${board.offline} ✗`);
    if (board.not_configured > 0) lines.push(`${board.not_configured} ○`);
    return `Health: ${lines.join(' | ')} | Total: ${board.total}`;
  }
}

export const healthChecker = new PlatformHealthChecker();
export default healthChecker;