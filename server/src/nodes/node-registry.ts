/**
 * Node Registry — tracks connected laptop nodes.
 * Nodes self-register on startup and send periodic heartbeats.
 */

export interface NodeRecord {
  node_id: string;
  node_name?: string;
  address: string;   // ip:port
  port: number;
  platform: string;
  node_version: string;
  status: 'online' | 'offline' | 'unknown';
  role: 'active' | 'passive' | 'worker';
  last_seen: string;
  registered_at: string;
  project?: string;  // integration-system or other
}

const REGISTRY = new Map<string, NodeRecord>();
const HEARTBEAT_TTL_MS = 3 * 60 * 1000; // 3 min without heartbeat = offline

export function registerNode(params: {
  node_id: string;
  node_name?: string;
  port: number;
  platform: string;
  node_version: string;
  address?: string;
  node_url?: string;
  role?: 'active' | 'passive' | 'worker';
}): NodeRecord {
  const now = new Date().toISOString();
  const existing = REGISTRY.get(params.node_id);
  const addressFromUrl = params.node_url ? params.node_url.replace(/^https?:\/\//, '').replace(/\/$/, '') : undefined;
  const record: NodeRecord = {
    node_id: params.node_id,
    node_name: params.node_name || existing?.node_name,
    address: addressFromUrl || params.address || `unknown:${params.port}`,
    port: params.port,
    platform: params.platform,
    node_version: params.node_version,
    status: 'online',
    role: params.role || existing?.role || 'passive',
    last_seen: now,
    registered_at: existing?.registered_at || now,
    project: existing?.project,
  };
  REGISTRY.set(params.node_id, record);
  return record;
}

export function heartbeat(nodeId: string): boolean {
  const node = REGISTRY.get(nodeId);
  if (!node) return false;
  node.last_seen = new Date().toISOString();
  node.status = 'online';
  return true;
}

export function getAllNodes(): NodeRecord[] {
  const now = Date.now();
  for (const node of REGISTRY.values()) {
    if (new Date(node.last_seen).getTime() + HEARTBEAT_TTL_MS < now) {
      node.status = 'offline';
    }
  }
  return Array.from(REGISTRY.values());
}

export function getNode(nodeId: string): NodeRecord | null {
  return REGISTRY.get(nodeId) || null;
}

export function setNodeRole(nodeId: string, role: 'active' | 'passive' | 'worker'): boolean {
  const node = REGISTRY.get(nodeId);
  if (!node) return false;
  node.role = role;
  return true;
}
