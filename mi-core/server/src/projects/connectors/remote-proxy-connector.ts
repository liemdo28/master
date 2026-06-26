/**
 * Remote Proxy Connector
 * Proxies to mi-remote-agent running on a different machine (LAN/Tailscale).
 * Used for: integration-system, whatsapp-api
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const REMOTE_TOKEN = process.env.MI_REMOTE_TOKEN || 'mi-remote-changeme';

export interface RemoteAgentConfig {
  agent_id:   string;
  name:       string;
  host:       string;         // e.g. 100.x.x.x (Tailscale) or 192.168.x.x
  port:       number;
  project_id: string;
  token:      string;
}

export interface RemoteStatus {
  agent_id:     string;
  name:         string;
  reachable:    boolean;
  project_id:   string;
  host:         string;
  status?:      string;
  version?:     string;
  last_checked: string;
  error?:       string;
}

export interface RemoteSnapshot {
  synced_at:    string;
  status:       'live' | 'unreachable' | 'auth_error' | 'not_configured';
  agent_id:     string;
  name:         string;
  host:         string;
  project_data?: Record<string, unknown>;
  logs?:        string[];
  errors?:      string[];
  summary_text: string;
}

// Default configs — override via env or project-connectors.json
const DEFAULT_REMOTE_AGENTS: RemoteAgentConfig[] = [
  {
    agent_id:   'integration-system',
    name:       'Integration System',
    host:       process.env.INTEGRATION_SYSTEM_HOST || '',
    port:       parseInt(process.env.INTEGRATION_SYSTEM_PORT || '4005'),
    project_id: 'integration-system',
    token:      process.env.MI_REMOTE_TOKEN || REMOTE_TOKEN,
  },
  {
    agent_id:   'whatsapp-api',
    name:       'WhatsApp API',
    host:       process.env.WHATSAPP_HOST || '',
    port:       parseInt(process.env.WHATSAPP_PORT || '4005'),
    project_id: 'whatsapp-ai-gateway',
    token:      process.env.MI_REMOTE_TOKEN || REMOTE_TOKEN,
  },
];

function getConfig(agentId: string): RemoteAgentConfig | null {
  // Check project-connectors.json first
  const registryFile = path.join(GLOBAL_DIR, 'mi-core', 'project-connectors.json');
  if (fs.existsSync(registryFile)) {
    try {
      const registry = JSON.parse(fs.readFileSync(registryFile, 'utf-8')) as { connectors: Array<RemoteAgentConfig & { location_type: string }> };
      const found = registry.connectors?.find((c) => c.agent_id === agentId || c.project_id === agentId);
      if (found?.host) return found as RemoteAgentConfig;
    } catch { /* ignore */ }
  }
  return DEFAULT_REMOTE_AGENTS.find(a => a.agent_id === agentId) || null;
}

async function remoteRequest(
  config: RemoteAgentConfig,
  method: string,
  endpoint: string,
  body?: object,
  timeoutMs = 8000,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  return new Promise((resolve) => {
    if (!config.host) {
      resolve({ ok: false, status: 0, data: { error: 'Host not configured' } });
      return;
    }

    const payload = body ? JSON.stringify(body) : undefined;
    const isHttps = config.host.startsWith('https://');
    const host = config.host.replace(/^https?:\/\//, '');
    const lib = isHttps ? https : http;

    const options = {
      hostname: host,
      port: config.port,
      path: endpoint,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        'X-Mi-Token': config.token,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
      timeout: timeoutMs,
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ ok: (res.statusCode || 0) < 400, status: res.statusCode || 0, data: JSON.parse(data) }); }
        catch { resolve({ ok: false, status: res.statusCode || 0, data: { raw: data } }); }
      });
    });

    req.on('error', (e) => resolve({ ok: false, status: 0, data: { error: e.message } }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, data: { error: 'timeout' } }); });
    if (payload) req.write(payload);
    req.end();
  });
}

export async function checkRemoteAgent(agentId: string): Promise<RemoteStatus> {
  const config = getConfig(agentId);
  const now = new Date().toISOString();

  if (!config || !config.host) {
    return {
      agent_id: agentId, name: agentId, reachable: false,
      project_id: agentId, host: '',
      last_checked: now,
      error: `Remote agent not configured. Set ${agentId.toUpperCase().replace(/-/g, '_')}_HOST in .env`,
    };
  }

  const result = await remoteRequest(config, 'GET', '/health', undefined, 5000);
  return {
    agent_id:     config.agent_id,
    name:         config.name,
    reachable:    result.ok,
    project_id:   config.project_id,
    host:         `${config.host}:${config.port}`,
    status:       result.ok ? 'online' : 'unreachable',
    last_checked: now,
    error:        result.ok ? undefined : String((result.data as Record<string, unknown>)?.error || 'Connection failed'),
  };
}

export async function syncRemoteProject(agentId: string): Promise<RemoteSnapshot> {
  const config = getConfig(agentId);
  const now = new Date().toISOString();
  const cacheDir = path.join(GLOBAL_DIR, 'mi-core', 'connectors', agentId);

  if (!config || !config.host) {
    const snap: RemoteSnapshot = {
      synced_at: now, status: 'not_configured', agent_id: agentId, name: agentId,
      host: '',
      summary_text: [
        `🔗 ${agentId}: Remote agent NOT configured`,
        `  To connect: set ${agentId.toUpperCase().replace(/-/g, '_')}_HOST=<ip> in mi-core/.env`,
        `  Then deploy mi-remote-agent on the remote machine`,
        `  Install: copy mi-core/mi-remote-agent/ to remote, run: node index.mjs`,
      ].join('\n'),
    };
    cacheSnapshot(cacheDir, snap);
    return snap;
  }

  // Get status from remote
  const [statusRes, logsRes, errorsRes] = await Promise.all([
    remoteRequest(config, 'GET', '/project/status'),
    remoteRequest(config, 'GET', '/project/logs'),
    remoteRequest(config, 'GET', '/project/errors'),
  ]);

  if (!statusRes.ok) {
    const snap: RemoteSnapshot = {
      synced_at: now, status: 'unreachable', agent_id: agentId,
      name: config.name, host: `${config.host}:${config.port}`,
      errors: [String((statusRes.data as Record<string, unknown>)?.error || 'Connection failed')],
      summary_text: [
        `🔗 ${config.name}: UNREACHABLE`,
        `  Host: ${config.host}:${config.port}`,
        `  Error: ${(statusRes.data as Record<string, unknown>)?.error || 'Connection failed'}`,
        `  Make sure mi-remote-agent is running on the remote machine`,
      ].join('\n'),
    };
    cacheSnapshot(cacheDir, snap);
    return snap;
  }

  const projectData = statusRes.data as Record<string, unknown>;
  const logs   = Array.isArray((logsRes.data as Record<string, unknown>)?.logs)   ? (logsRes.data as { logs: string[] }).logs.slice(-20)   : [];
  const errors = Array.isArray((errorsRes.data as Record<string, unknown>)?.errors) ? (errorsRes.data as { errors: string[] }).errors.slice(-10) : [];

  const snap: RemoteSnapshot = {
    synced_at: now, status: 'live', agent_id: agentId, name: config.name,
    host: `${config.host}:${config.port}`,
    project_data: projectData,
    logs,
    errors,
    summary_text: [
      `🔗 ${config.name}: ✓ CONNECTED`,
      `  Host: ${config.host}:${config.port}`,
      `  Status: ${JSON.stringify(projectData).slice(0, 100)}`,
      errors.length ? `  Recent errors: ${errors.length}` : '  No recent errors',
    ].join('\n'),
  };

  cacheSnapshot(cacheDir, snap);
  return snap;
}

function cacheSnapshot(cacheDir: string, snap: RemoteSnapshot) {
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, 'data.json'),     JSON.stringify(snap, null, 2));
  fs.writeFileSync(path.join(cacheDir, 'health.json'),   JSON.stringify({ status: snap.status, host: snap.host, synced_at: snap.synced_at }));
  fs.writeFileSync(path.join(cacheDir, 'last_sync.json'),JSON.stringify({ synced_at: snap.synced_at }));
  fs.writeFileSync(path.join(cacheDir, 'errors.json'),   JSON.stringify(snap.errors || []));
}

export function getCachedRemote(agentId: string): RemoteSnapshot | null {
  try {
    return JSON.parse(fs.readFileSync(
      path.join(GLOBAL_DIR, 'mi-core', 'connectors', agentId, 'data.json'), 'utf-8'
    ));
  } catch { return null; }
}

// Execute approved action on remote
export async function executeRemoteAction(agentId: string, action: { command: string; params?: object }): Promise<unknown> {
  const config = getConfig(agentId);
  if (!config) throw new Error(`Remote agent ${agentId} not configured`);
  const result = await remoteRequest(config, 'POST', '/project/execute-approved-action', action);
  if (!result.ok) throw new Error(String((result.data as Record<string, unknown>)?.error || 'Remote execution failed'));
  return result.data;
}

export async function runRemoteQA(agentId: string): Promise<unknown> {
  const config = getConfig(agentId);
  if (!config) return { error: `Agent ${agentId} not configured` };
  const result = await remoteRequest(config, 'POST', '/project/qa', {});
  return result.data;
}

export async function previewRemoteCommand(agentId: string, command: string): Promise<unknown> {
  const config = getConfig(agentId);
  if (!config) return { error: `Agent ${agentId} not configured` };
  const result = await remoteRequest(config, 'POST', '/project/command-preview', { command });
  return result.data;
}

export function getAllRemoteStatuses(): Promise<RemoteStatus[]> {
  return Promise.all(DEFAULT_REMOTE_AGENTS.map(a => checkRemoteAgent(a.agent_id)));
}
