/**
 * Persistent Node Registry — Phase 6
 * File-backed: survives server restarts.
 * Nodes self-register on boot and heartbeat every 30s.
 * Complements the in-memory registry; this is the source of truth.
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = process.env.MI_CORE_ROOT
  ? path.join(process.env.MI_CORE_ROOT, '.local-agent-global')
  : 'D:/Project/Master/mi-core/.local-agent-global';
const NODES_DIR  = path.join(GLOBAL_DIR, 'nodes');
const REG_FILE   = path.join(NODES_DIR, 'registry.json');

const HEARTBEAT_TTL_MS = 3 * 60 * 1000; // 3 min → offline

export interface PersistentNodeRecord {
  node_id:        string;
  node_name:      string;
  address:        string;   // ip:port or hostname:port
  port:           number;
  platform:       string;   // win32 | darwin | linux
  node_version:   string;
  capabilities:   string[]; // ['gstack','whatsapp','health-monitor','browser-agent']
  role:           'leader' | 'worker' | 'passive';
  status:         'online' | 'offline' | 'unknown';
  registered_at:  string;
  last_seen:      string;
  heartbeat_count: number;
  metadata?:      Record<string, unknown>;
}

// ── Storage ──────────────────────────────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(NODES_DIR)) fs.mkdirSync(NODES_DIR, { recursive: true });
}

function load(): Map<string, PersistentNodeRecord> {
  ensureDir();
  try {
    const raw = JSON.parse(fs.readFileSync(REG_FILE, 'utf8'));
    return new Map(Object.entries(raw));
  } catch { return new Map(); }
}

function save(registry: Map<string, PersistentNodeRecord>) {
  ensureDir();
  const obj = Object.fromEntries(registry);
  fs.writeFileSync(REG_FILE, JSON.stringify(obj, null, 2));
}

// ── Registry operations ───────────────────────────────────────────────────────

export function registerNodePersistent(params: {
  node_id:       string;
  node_name?:    string;
  address?:      string;
  port:          number;
  platform:      string;
  node_version:  string;
  capabilities?: string[];
  role?:         PersistentNodeRecord['role'];
  metadata?:     Record<string, unknown>;
}): PersistentNodeRecord {
  const registry = load();
  const existing = registry.get(params.node_id);
  const now = new Date().toISOString();

  const record: PersistentNodeRecord = {
    node_id:         params.node_id,
    node_name:       params.node_name || existing?.node_name || params.node_id,
    address:         params.address  || existing?.address  || `unknown:${params.port}`,
    port:            params.port,
    platform:        params.platform,
    node_version:    params.node_version,
    capabilities:    params.capabilities || existing?.capabilities || [],
    role:            params.role || existing?.role || 'passive',
    status:          'online',
    registered_at:   existing?.registered_at || now,
    last_seen:       now,
    heartbeat_count: (existing?.heartbeat_count || 0) + 1,
    metadata:        params.metadata || existing?.metadata,
  };

  registry.set(params.node_id, record);
  save(registry);
  console.log(`[NodeRegistry] ${params.node_id} registered — role:${record.role} platform:${record.platform}`);
  return record;
}

export function heartbeatPersistent(nodeId: string, metadata?: Record<string, unknown>): boolean {
  const registry = load();
  const node = registry.get(nodeId);
  if (!node) return false;
  node.last_seen = new Date().toISOString();
  node.status = 'online';
  node.heartbeat_count++;
  if (metadata) node.metadata = { ...node.metadata, ...metadata };
  save(registry);
  return true;
}

export function getAllNodesPersistent(): PersistentNodeRecord[] {
  const registry = load();
  const now = Date.now();
  let dirty = false;
  for (const node of registry.values()) {
    const staleness = now - new Date(node.last_seen).getTime();
    const newStatus: PersistentNodeRecord['status'] = staleness > HEARTBEAT_TTL_MS ? 'offline' : 'online';
    if (node.status !== newStatus) { node.status = newStatus; dirty = true; }
  }
  if (dirty) save(registry);
  return Array.from(registry.values()).sort((a, b) => b.last_seen.localeCompare(a.last_seen));
}

export function getNodePersistent(nodeId: string): PersistentNodeRecord | null {
  return load().get(nodeId) || null;
}

export function setNodeRolePersistent(nodeId: string, role: PersistentNodeRecord['role']): boolean {
  const registry = load();
  const node = registry.get(nodeId);
  if (!node) return false;
  node.role = role;
  save(registry);
  return true;
}

export function removeNodePersistent(nodeId: string): boolean {
  const registry = load();
  if (!registry.has(nodeId)) return false;
  registry.delete(nodeId);
  save(registry);
  return true;
}

export function getOnlineNodes(): PersistentNodeRecord[] {
  return getAllNodesPersistent().filter(n => n.status === 'online');
}

export function getNodesSummary() {
  const all = getAllNodesPersistent();
  return {
    total:        all.length,
    online:       all.filter(n => n.status === 'online').length,
    offline:      all.filter(n => n.status === 'offline').length,
    leader_count: all.filter(n => n.role === 'leader').length,
    nodes:        all,
    registry_file: REG_FILE,
  };
}
