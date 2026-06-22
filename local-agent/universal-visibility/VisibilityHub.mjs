/**
 * VisibilityHub — Universal Visibility Aggregator
 * 
 * Provides unified access to all platform data through existing connectors.
 * Does NOT fake data — returns actual connector status.
 */
import path from 'path';
import fs from 'fs';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';

export class VisibilityHub {
  constructor(options = {}) {
    this.globalDir = options.globalDir || GLOBAL_DIR;
    this.cacheDir = path.join(this.globalDir, 'visibility');
    this.registryPath = path.join(this.cacheDir, 'connector-registry.json');
  }

  /** Get all connectors with status */
  getConnectors() {
    try {
      return JSON.parse(fs.readFileSync(this.registryPath, 'utf-8'));
    } catch {
      return [];
    }
  }

  /** Get only connected/active connectors */
  getConnected() {
    return this.getConnectors().filter(c => c.auth_status === 'connected' && c.status === 'active');
  }

  /** Get connector by ID */
  getConnector(id) {
    return this.getConnectors().find(c => c.connector_id === id) || null;
  }

  /** Get summary for Mi's response */
  getSummary() {
    const all = this.getConnectors();
    const connected = all.filter(c => c.auth_status === 'connected');
    const notConfigured = all.filter(c => c.auth_status === 'not_configured');
    return {
      total: all.length,
      connected: connected.length,
      not_configured: notConfigured.length,
      healthy: all.filter(c => c.health_status === 'healthy').length,
      last_sync: all.filter(c => c.last_sync).sort((a, b) => new Date(b.last_sync) - new Date(a.last_sync))[0]?.last_sync || null,
      platforms: connected.map(c => ({ id: c.connector_id, name: c.name, health: c.health_status })),
      missing: notConfigured.map(c => ({ id: c.connector_id, name: c.name, hint: c.setup_hint })),
    };
  }

  /** Get daily snapshot — builds from cached connector data */
  getDailySnapshot() {
    const snapshotPath = path.join(this.cacheDir, 'daily-snapshot.json');
    try {
      return JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
    } catch {
      return {
        generated_at: new Date().toISOString(),
        date: new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        platforms: this.getSummary(),
        action_items: [],
        note: 'No daily snapshot available yet. Run sync to generate.'
      };
    }
  }

  /** Search across all readable platforms */
  searchAllPlatforms(query) {
    const results = [];
    const connected = this.getConnected();
    for (const connector of connected) {
      if (connector.read_capability.includes('files') || connector.read_capability.includes('content')) {
        results.push({ connector: connector.connector_id, name: connector.name, status: 'Search available via connector cache' });
      }
    }
    if (results.length === 0) {
      return { query, results: [], note: 'No active connectors available for search.' };
    }
    return { query, results };
  }
}
