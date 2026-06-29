/**
 * Connector Registry — tracks all platform connectors, their auth/health status.
 * Single source of truth for what Mi can see.
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const REGISTRY_PATH = path.join(GLOBAL_DIR, 'visibility', 'connector-registry.json');

export type ConnectorType = 'local' | 'api' | 'scrape' | 'export';
export type AuthStatus = 'connected' | 'not_configured' | 'expired' | 'error';
export type HealthStatus = 'healthy' | 'degraded' | 'offline' | 'unknown';

export interface Connector {
  connector_id: string;
  name: string;
  type: ConnectorType;
  status: 'active' | 'disabled' | 'pending';
  auth_status: AuthStatus;
  last_sync: string | null;
  read_capability: string[];
  write_capability: string[];
  approval_required: boolean;
  cache_path: string;
  health_status: HealthStatus;
  last_health_check?: string;
  setup_hint?: string;
  config?: Record<string, unknown>;
}

const DEFAULT_CONNECTORS: Connector[] = [
  {
    connector_id: 'local-projects',
    name: 'Master Workspace (Local)',
    type: 'local',
    status: 'active',
    auth_status: 'connected',
    last_sync: null,
    read_capability: ['files', 'folders', 'git-status', 'project-health', 'reports', 'source-maps'],
    write_capability: ['files', 'folders'],
    approval_required: false,
    cache_path: 'projects/',
    health_status: 'healthy',
  },
  {
    connector_id: 'dashboard-bakudan',
    name: 'Dashboard bakudanramen.com',
    type: 'local',
    status: 'active',
    auth_status: 'connected',
    last_sync: null,
    read_capability: ['tasks', 'users', 'reports', 'inventory', 'timesheets'],
    write_capability: ['tasks', 'content'],
    approval_required: true,
    cache_path: 'dashboard/',
    health_status: 'unknown',
    config: { base_url: 'http://dashboard.bakudanramen.com', local_path: 'D:/Project/Master/Bakudan/dashboard.bakudanramen.com' },
  },
  {
    connector_id: 'asana',
    name: 'Asana',
    type: 'api',
    status: 'pending',
    auth_status: 'not_configured',
    last_sync: null,
    read_capability: ['tasks', 'projects', 'teams', 'goals'],
    write_capability: ['tasks', 'projects'],
    approval_required: true,
    cache_path: 'asana/',
    health_status: 'unknown',
    setup_hint: 'Set ASANA_TOKEN in .env — get from app.asana.com/0/my-apps',
  },
  {
    connector_id: 'gmail',
    name: 'Gmail',
    type: 'api',
    status: 'pending',
    auth_status: 'not_configured',
    last_sync: null,
    read_capability: ['emails', 'threads', 'labels', 'attachments'],
    write_capability: ['drafts', 'send'],
    approval_required: true,
    cache_path: 'gmail/',
    health_status: 'unknown',
    setup_hint: 'Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env — Google Cloud Console → OAuth 2.0',
  },
  {
    connector_id: 'google-calendar',
    name: 'Google Calendar',
    type: 'api',
    status: 'pending',
    auth_status: 'not_configured',
    last_sync: null,
    read_capability: ['events', 'calendars', 'reminders'],
    write_capability: ['events'],
    approval_required: true,
    cache_path: 'google-calendar/',
    health_status: 'unknown',
    setup_hint: 'Same OAuth as Gmail — shares GOOGLE_CLIENT_ID/SECRET',
  },
  {
    connector_id: 'google-drive',
    name: 'Google Drive',
    type: 'api',
    status: 'pending',
    auth_status: 'not_configured',
    last_sync: null,
    read_capability: ['files', 'folders', 'docs', 'sheets'],
    write_capability: ['files', 'docs'],
    approval_required: true,
    cache_path: 'google-drive/',
    health_status: 'unknown',
    setup_hint: 'Same OAuth as Gmail — add Drive scope: https://www.googleapis.com/auth/drive.readonly',
  },
  {
    connector_id: 'google-sheets',
    name: 'Google Sheets',
    type: 'api',
    status: 'pending',
    auth_status: 'not_configured',
    last_sync: null,
    read_capability: ['spreadsheets', 'ranges', 'values'],
    write_capability: ['values'],
    approval_required: true,
    cache_path: 'google-sheets/',
    health_status: 'unknown',
    setup_hint: 'Same OAuth as Gmail — requires scope: https://www.googleapis.com/auth/spreadsheets',
  },
  {
    connector_id: 'health-export',
    name: 'Huawei Health Export',
    type: 'export',
    status: 'pending',
    auth_status: 'not_configured',
    last_sync: null,
    read_capability: ['steps', 'sleep', 'heart-rate', 'workouts'],
    write_capability: [],
    approval_required: false,
    cache_path: 'health/',
    health_status: 'unknown',
    setup_hint: 'Export from Huawei Health app → place JSON/XML in .local-agent-global/visibility/health/export/',
  },
  {
    connector_id: 'website-raw',
    name: 'rawsushibar.com',
    type: 'local',
    status: 'active',
    auth_status: 'connected',
    last_sync: null,
    read_capability: ['files', 'content', 'reports', 'qa-results'],
    write_capability: ['content'],
    approval_required: true,
    cache_path: 'websites/raw/',
    health_status: 'unknown',
    config: { local_path: 'D:/Project/Master/RawSushi' },
  },
  {
    connector_id: 'website-bakudan',
    name: 'bakudanramen.com',
    type: 'local',
    status: 'active',
    auth_status: 'connected',
    last_sync: null,
    read_capability: ['files', 'content', 'reports', 'qa-results'],
    write_capability: ['content'],
    approval_required: true,
    cache_path: 'websites/bakudan/',
    health_status: 'unknown',
    config: { local_path: 'D:/Project/Master/Bakudan' },
  },
  {
    connector_id: 'accounting',
    name: 'Accounting Engine',
    type: 'api',
    status: 'active',
    auth_status: 'connected',
    last_sync: null,
    read_capability: ['ledger', 'stats', 'costs', 'patches', 'qa-metrics', 'sessions'],
    write_capability: [],
    approval_required: false,
    cache_path: 'accounting/',
    health_status: 'unknown',
    setup_hint: 'Start: node D:/Project/Master/accounting-engine/api/server.js (port 8844)',
    config: { api_url: 'http://127.0.0.1:8844', db_path: 'D:/Project/Master/accounting-engine/ledgers/accounting.db' },
  },
  {
    connector_id: 'quickbooks-runtime',
    name: 'QuickBooks Runtime',
    type: 'local',
    status: 'active',
    auth_status: 'connected',
    last_sync: null,
    read_capability: ['company-state', 'activity-log', 'sync-status', 'duplicate-checks', 'transactions'],
    write_capability: [],
    approval_required: false,
    cache_path: 'quickbooks/',
    health_status: 'unknown',
    setup_hint: 'QuickBooks runtime lives on laptop1 with Dev1. Dev1 must open QuickBooks Desktop/company file on laptop1, keep QB Web Connector running, then trigger force sync.',
    config: {
      checksum_db: 'D:/Project/Master/mi-core/data/qb-agent.db',
      agent_db: 'D:/Project/Master/mi-core/data/qb-agent.db',
    },
  },
  {
    connector_id: 'food-safety',
    name: 'Food Safety Gateway',
    type: 'local',
    status: 'active',
    auth_status: 'connected',
    last_sync: null,
    read_capability: ['inspection-records', 'audit-trail', 'stores', 'reports'],
    write_capability: [],
    approval_required: false,
    cache_path: 'food-safety/',
    health_status: 'unknown',
    config: { root_path: 'D:/Project/Master/food-safety-gateway' },
  },
  // Sprint 2.1: Slack connector
  {
    connector_id: 'slack',
    name: 'Slack',
    type: 'api',
    status: 'active',
    auth_status: 'not_configured',
    last_sync: null,
    read_capability: ['channels', 'messages', 'members'],
    write_capability: [],
    approval_required: false,
    cache_path: 'slack/',
    health_status: 'unknown',
    config: { token_env: 'SLACK_BOT_TOKEN' },
    setup_hint: 'Set SLACK_BOT_TOKEN and SLACK_TEAM_ID in .env to connect Slack',
  },
  // Sprint 2.1: GitHub connector
  {
    connector_id: 'github',
    name: 'GitHub Actions',
    type: 'api',
    status: 'active',
    auth_status: 'not_configured',
    last_sync: null,
    read_capability: ['workflows', 'runs', 'repos'],
    write_capability: [],
    approval_required: false,
    cache_path: 'github/',
    health_status: 'unknown',
    config: { token_env: 'GITHUB_TOKEN' },
    setup_hint: 'Set GITHUB_TOKEN in .env to connect GitHub Actions',
  },
];

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function loadRegistry(): Connector[] {
  try {
    const existing = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8')) as Connector[];
    const merged = [...existing];
    let changed = false;
    for (const connector of DEFAULT_CONNECTORS) {
      if (!merged.some(c => c.connector_id === connector.connector_id)) {
        merged.push(connector);
        changed = true;
      }
    }
    if (changed) saveRegistry(merged);
    return merged;
  } catch {
    return DEFAULT_CONNECTORS;
  }
}

function saveRegistry(connectors: Connector[]) {
  ensureDir(path.dirname(REGISTRY_PATH));
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(connectors, null, 2));
}

function effectiveHealth(connector: Connector): HealthStatus {
  if (connector.health_status !== 'unknown') return connector.health_status;

  if (connector.auth_status !== 'connected') return 'offline';

  const cacheDir = path.join(GLOBAL_DIR, 'visibility', connector.cache_path || '');
  const dataPath = path.join(cacheDir, 'data.json');
  const summaryPath = path.join(cacheDir, 'summary.json');
  const errorsPath = path.join(cacheDir, 'errors.json');
  if (fs.existsSync(dataPath) || fs.existsSync(summaryPath)) {
    try {
      const errors = fs.existsSync(errorsPath) ? JSON.parse(fs.readFileSync(errorsPath, 'utf-8')) : [];
      return Array.isArray(errors) && errors.length > 0 ? 'degraded' : 'healthy';
    } catch {
      return 'degraded';
    }
  }

  return connector.last_sync ? 'healthy' : 'offline';
}

export const connectorRegistry = {
  getAll(): Connector[] {
    return loadRegistry();
  },

  getById(id: string): Connector | undefined {
    return loadRegistry().find(c => c.connector_id === id);
  },

  getConnected(): Connector[] {
    return loadRegistry().filter(c => c.auth_status === 'connected' && c.status === 'active');
  },

  update(id: string, patch: Partial<Connector>): Connector | null {
    const all = loadRegistry();
    const idx = all.findIndex(c => c.connector_id === id);
    if (idx < 0) return null;
    all[idx] = { ...all[idx], ...patch };
    saveRegistry(all);
    return all[idx];
  },

  markSynced(id: string, health: HealthStatus = 'healthy') {
    this.update(id, { last_sync: new Date().toISOString(), health_status: health });
  },

  getSummary() {
    const all = loadRegistry();
    return {
      total: all.length,
      connected: all.filter(c => c.auth_status === 'connected').length,
      not_configured: all.filter(c => c.auth_status === 'not_configured').length,
      healthy: all.filter(c => effectiveHealth(c) === 'healthy').length,
      connectors: all.map(c => {
        const health = effectiveHealth(c);
        // Freshness: how old is the last sync? (null = never synced)
        let age_min: number | null = null;
        if (c.last_sync) {
          age_min = Math.round((Date.now() - new Date(c.last_sync).getTime()) / 60_000);
        }
        return {
          id: c.connector_id,
          name: c.name,
          auth: c.auth_status,
          health,
          last_sync: c.last_sync,
          age_min,
          freshness:
            age_min === null ? 'never' :
            age_min < 5 ? 'fresh' :
            age_min < 30 ? 'stale' :
            age_min < 120 ? 'old' : 'stale-old',
          setup_hint: c.auth_status !== 'connected' || health !== 'healthy' ? c.setup_hint : undefined,
        };
      }),
    };
  },

  init() {
    if (!fs.existsSync(REGISTRY_PATH)) {
      saveRegistry(DEFAULT_CONNECTORS);
    }
  },

  // DEV2: Live-probe HTTP connectors and update registry to match real state.
  // Prevents registry from showing "healthy" when the service is offline.
  async liveProbe(): Promise<void> {
    const HTTP_CONNECTORS: Array<{ id: string; url: string }> = [
      { id: 'accounting', url: 'http://127.0.0.1:8844/health' },
    ];

    for (const { id, url } of HTTP_CONNECTORS) {
      let health: HealthStatus = 'offline';
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const body = await res.json() as { ok?: boolean };
          health = body?.ok === true ? 'healthy' : 'degraded';
        } else {
          health = 'degraded';
        }
      } catch {
        health = 'offline';
      }
      connectorRegistry.update(id, {
        health_status: health,
        last_health_check: new Date().toISOString(),
      });
    }
  },
};
