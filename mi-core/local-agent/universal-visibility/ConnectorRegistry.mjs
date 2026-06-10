/**
 * ConnectorRegistry — standalone ESM module
 * Tracks all platform connectors, their auth/health/sync status.
 * Single source of truth for what Mi can see.
 * NEVER fakes data — always tells the truth about connector status.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const REGISTRY_PATH = path.join(GLOBAL_DIR, 'visibility', 'connector-registry.json');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function load() {
  try { return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8')); }
  catch { return []; }
}

function save(connectors) {
  ensureDir(path.dirname(REGISTRY_PATH));
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(connectors, null, 2));
}

const DEFAULT_CONNECTORS = [
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
    read_capability: ['tasks', 'users', 'projects', 'comments', 'approvals', 'inventory', 'timesheets'],
    write_capability: ['tasks', 'content'],
    approval_required: true,
    cache_path: 'dashboard/',
    health_status: 'unknown',
    config: { base_url: 'http://dashboard.bakudanramen.com', local_path: 'E:/Project/Master/dashboard.bakudanramen.com' },
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
    setup_hint: 'Same OAuth as Gmail — add Drive scope: https://developers.google.com/workspace/guides/create-credentials',
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
    read_capability: ['files', 'content', 'menu', 'pages', 'posts', 'SEO', 'reports', 'qa-results'],
    write_capability: ['content', 'menu', 'posts'],
    approval_required: true,
    cache_path: 'websites/raw/',
    health_status: 'unknown',
    config: { local_path: 'E:/Project/Master/RawSushi' },
  },
  {
    connector_id: 'website-bakudan',
    name: 'bakudanramen.com',
    type: 'local',
    status: 'active',
    auth_status: 'connected',
    last_sync: null,
    read_capability: ['files', 'content', 'menu', 'pages', 'posts', 'SEO', 'reports', 'qa-results'],
    write_capability: ['content', 'menu', 'posts'],
    approval_required: true,
    cache_path: 'websites/bakudan/',
    health_status: 'unknown',
    config: { local_path: 'E:/Project/Master/Bakudan' },
  },
  {
    connector_id: 'integration-system',
    name: 'Integration System',
    type: 'remote',
    status: 'active',
    auth_status: 'connected',
    last_sync: null,
    read_capability: ['logs', 'health', 'queues', 'errors', 'qa'],
    write_capability: ['execute'],
    approval_required: true,
    cache_path: 'integration-system/',
    health_status: 'unknown',
    setup_hint: 'Set MI_REMOTE_TOKEN in .env on remote machine',
  },
  {
    connector_id: 'whatsapp-api',
    name: 'WhatsApp API',
    type: 'remote',
    status: 'active',
    auth_status: 'connected',
    last_sync: null,
    read_capability: ['logs', 'health', 'queues', 'errors', 'qa'],
    write_capability: ['execute'],
    approval_required: true,
    cache_path: 'whatsapp-api/',
    health_status: 'unknown',
    setup_hint: 'Set MI_REMOTE_TOKEN in .env on remote machine',
  },
];

export class ConnectorRegistry {
  /** Initialize registry with defaults if not exists */
  init() {
    if (!fs.existsSync(REGISTRY_PATH)) {
      save(DEFAULT_CONNECTORS);
    }
  }

  /** Get all connectors */
  getAll() {
    const data = load();
    return data.length > 0 ? data : DEFAULT_CONNECTORS;
  }

  /** Get connector by ID */
  getById(id) {
    return this.getAll().find(c => c.connector_id === id) || null;
  }

  /** Get only connected & active connectors */
  getConnected() {
    return this.getAll().filter(c => c.auth_status === 'connected' && c.status === 'active');
  }

  /** Get not configured connectors */
  getNotConfigured() {
    return this.getAll().filter(c => c.auth_status === 'not_configured');
  }

  /** Update connector by ID */
  update(id, patch) {
    const all = this.getAll();
    const idx = all.findIndex(c => c.connector_id === id);
    if (idx < 0) return null;
    all[idx] = { ...all[idx], ...patch };
    save(all);
    return all[idx];
  }

  /** Mark connector as synced */
  markSynced(id, health = 'healthy') {
    this.update(id, { last_sync: new Date().toISOString(), health_status: health });
  }

  /** Get summary for dashboard/UI */
  getSummary() {
    const all = this.getAll();
    return {
      total: all.length,
      connected: all.filter(c => c.auth_status === 'connected').length,
      not_configured: all.filter(c => c.auth_status === 'not_configured').length,
      healthy: all.filter(c => c.health_status === 'healthy').length,
      connectors: all.map(c => ({
        id: c.connector_id,
        name: c.name,
        type: c.type,
        auth: c.auth_status,
        health: c.health_status,
        last_sync: c.last_sync,
        setup_hint: c.auth_status !== 'connected' ? c.setup_hint : undefined,
        approval_required: c.approval_required,
      })),
    };
  }

  /** Get all readable connector IDs for a given capability */
  getReadableFor(capability) {
    return this.getConnected().filter(c => c.read_capability.includes(capability));
  }

  /** Get all writable connector IDs for a given capability */
  getWritableFor(capability) {
    return this.getConnected().filter(c => c.write_capability.includes(capability));
  }
}

export const registry = new ConnectorRegistry();
export default registry;