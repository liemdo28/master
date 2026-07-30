/**
 * VisibilityCache — manages cache for all connector data
 * Stores snapshot data from each platform in .local-agent-global/visibility/
 * NEVER fakes data — returns null if cache is missing/stale
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CACHE_DIR = path.join(GLOBAL_DIR, 'visibility');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

export class VisibilityCache {
  constructor() {
    this.cacheDir = CACHE_DIR;
    ensureDir(this.cacheDir);
  }

  /**
   * Get cached data for a connector
   * @param {string} connectorId - connector ID (e.g. 'gmail', 'dashboard-bakudan')
   * @param {number} maxAgeMs - max age in ms (default: 1 hour)
   * @returns {object|null} cached data or null if missing/stale
   */
  get(connectorId, maxAgeMs = 3600000) {
    try {
      const cachePath = path.join(this.cacheDir, `${connectorId}.json`);
      if (!fs.existsSync(cachePath)) return null;

      const stat = fs.statSync(cachePath);
      const age = Date.now() - stat.mtimeMs;
      if (age > maxAgeMs) return null; // stale

      const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      return { data, cached_at: stat.mtime.toISOString(), age_ms: age, stale: false };
    } catch {
      return null;
    }
  }

  /**
   * Set cached data for a connector
   * @param {string} connectorId - connector ID
   * @param {object} data - data to cache
   * @returns {object} result with path and size
   */
  set(connectorId, data) {
    try {
      ensureDir(this.cacheDir);
      const cachePath = path.join(this.cacheDir, `${connectorId}.json`);
      const payload = {
        connector_id: connectorId,
        cached_at: new Date().toISOString(),
        data,
      };
      fs.writeFileSync(cachePath, JSON.stringify(payload, null, 2));
      const size = fs.statSync(cachePath).size;
      return { ok: true, path: cachePath, size_bytes: size };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Check if a connector's cache is fresh (within maxAgeMs)
   * @param {string} connectorId
   * @param {number} maxAgeMs
   * @returns {boolean}
   */
  isFresh(connectorId, maxAgeMs = 3600000) {
    return this.get(connectorId, maxAgeMs) !== null;
  }

  /**
   * Get freshness info for all connectors
   * @param {number} maxAgeMs
   * @returns {object} freshness report
   */
  getFreshnessReport(maxAgeMs = 3600000) {
    const report = {
      generated_at: new Date().toISOString(),
      fresh: [],
      stale: [],
      missing: [],
    };

    try {
      const entries = fs.readdirSync(this.cacheDir);
      for (const entry of entries) {
        if (!entry.endsWith('.json')) continue;
        const connectorId = entry.replace('.json', '');
        const cached = this.get(connectorId, maxAgeMs);
        if (cached) {
          report.fresh.push({ connector_id: connectorId, cached_at: cached.cached_at, age_ms: cached.age_ms });
        } else {
          const cachePath = path.join(this.cacheDir, entry);
          if (fs.existsSync(cachePath)) {
            const stat = fs.statSync(cachePath);
            report.stale.push({ connector_id: connectorId, last_cached: stat.mtime.toISOString() });
          } else {
            report.missing.push(connectorId);
          }
        }
      }
    } catch (e) {
      report.error = e.message;
    }
    return report;
  }

  /**
   * Clear cache for a specific connector
   * @param {string} connectorId
   */
  clear(connectorId) {
    try {
      const cachePath = path.join(this.cacheDir, `${connectorId}.json`);
      if (fs.existsSync(cachePath)) {
        fs.unlinkSync(cachePath);
        return { ok: true };
      }
      return { ok: false, error: 'not found' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Clear all cached data
   */
  clearAll() {
    try {
      const entries = fs.readdirSync(this.cacheDir);
      let cleared = 0;
      for (const entry of entries) {
        if (entry.endsWith('.json') && !entry.includes('connector-registry') && !entry.includes('sync_log')) {
          fs.unlinkSync(path.join(this.cacheDir, entry));
          cleared++;
        }
      }
      return { ok: true, cleared };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Get daily snapshot (special cached file)
   */
  getDailySnapshot() {
    try {
      const snapPath = path.join(this.cacheDir, 'daily-snapshot.json');
      if (!fs.existsSync(snapPath)) return null;
      return JSON.parse(fs.readFileSync(snapPath, 'utf-8'));
    } catch {
      return null;
    }
  }

  /**
   * Get sync log
   */
  getSyncLog() {
    try {
      const logPath = path.join(this.cacheDir, 'sync_log.json');
      if (!fs.existsSync(logPath)) return null;
      return JSON.parse(fs.readFileSync(logPath, 'utf-8'));
    } catch {
      return null;
    }
  }

  /**
   * Get cache directory size in bytes
   */
  getCacheSize() {
    try {
      let total = 0;
      const entries = fs.readdirSync(this.cacheDir);
      for (const entry of entries) {
        if (entry.endsWith('.json')) {
          const stat = fs.statSync(path.join(this.cacheDir, entry));
          total += stat.size;
        }
      }
      return total;
    } catch {
      return 0;
    }
  }
}

export const visibilityCache = new VisibilityCache();
export default visibilityCache;