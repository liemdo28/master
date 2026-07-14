/**
 * Connector Registry — Production Loop Part 1
 * Central registry of all production connectors with status tracking.
 */

import fs from 'fs';
import path from 'path';

const MI_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const EVIDENCE_DIR = process.env.PRODUCTION_LOOP_EVIDENCE_DIR ||
  path.join(MI_ROOT, 'evidence', 'production-loop');
const REGISTRY_FILE = path.join(EVIDENCE_DIR, 'connector-registry.json');

export type ConnectorStatus = 'healthy' | 'degraded' | 'stale' | 'unknown' | 'error';

export interface ConnectorDefinition {
  id: string;
  name: string;
  type: 'accounting' | 'delivery' | 'messaging' | 'reviews' | 'analytics' | 'seo' | 'pos' | 'social';
  division: string;
  enabled: boolean;
  lastHeartbeat: string | null;
  lastEvent: string | null;
  staleThresholdMs: number; // ms after which connector is considered stale
  priority: 'critical' | 'high' | 'medium' | 'low';
  metadata: Record<string, unknown>;
}

const DEFAULT_STALE_MS = 5 * 60 * 1000; // 5 minutes

const BUILTIN_CONNECTORS: Omit<ConnectorDefinition, 'lastHeartbeat' | 'lastEvent'>[] = [
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    type: 'accounting',
    division: 'finance',
    enabled: true,
    staleThresholdMs: DEFAULT_STALE_MS,
    priority: 'critical',
    metadata: { vendor: 'Intuit', color: '#2CA01C' },
  },
  {
    id: 'doordash',
    name: 'DoorDash',
    type: 'delivery',
    division: 'operations',
    enabled: true,
    staleThresholdMs: DEFAULT_STALE_MS,
    priority: 'critical',
    metadata: { vendor: 'DoorDash', color: '#FF3008' },
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    type: 'messaging',
    division: 'marketing',
    enabled: true,
    staleThresholdMs: DEFAULT_STALE_MS,
    priority: 'high',
    metadata: { vendor: 'Meta', color: '#25D366' },
  },
  {
    id: 'gbp',
    name: 'Google Business Profile',
    type: 'reviews',
    division: 'marketing',
    enabled: true,
    staleThresholdMs: 15 * 60 * 1000,
    priority: 'high',
    metadata: { vendor: 'Google', color: '#4285F4' },
  },
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    type: 'analytics',
    division: 'marketing',
    enabled: true,
    staleThresholdMs: 10 * 60 * 1000,
    priority: 'high',
    metadata: { vendor: 'Google', color: '#E37400' },
  },
  {
    id: 'gsc',
    name: 'Google Search Console',
    type: 'seo',
    division: 'marketing',
    enabled: true,
    staleThresholdMs: 15 * 60 * 1000,
    priority: 'medium',
    metadata: { vendor: 'Google', color: '#4285F4' },
  },
  {
    id: 'toast',
    name: 'Toast POS',
    type: 'pos',
    division: 'operations',
    enabled: false, // Only if access exists
    staleThresholdMs: DEFAULT_STALE_MS,
    priority: 'medium',
    metadata: { vendor: 'Toast', color: '#FF6F00' },
  },
];

function ensureDir() { fs.mkdirSync(EVIDENCE_DIR, { recursive: true }); }

function loadRegistry(): Map<string, ConnectorDefinition> {
  try {
    const raw = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
    const map = new Map<string, ConnectorDefinition>();
    for (const [id, def] of Object.entries(raw)) {
      map.set(id, def as ConnectorDefinition);
    }
    return map;
  } catch {
    const map = new Map<string, ConnectorDefinition>();
    for (const base of BUILTIN_CONNECTORS) {
      map.set(base.id, { ...base, lastHeartbeat: null, lastEvent: null });
    }
    return map;
  }
}

function saveRegistry(map: Map<string, ConnectorDefinition>) {
  ensureDir();
  const obj: Record<string, ConnectorDefinition> = {};
  for (const [id, def] of map) obj[id] = def;
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(obj, null, 2));
}

let _registry: Map<string, ConnectorDefinition> | null = null;

function getRegistry(): Map<string, ConnectorDefinition> {
  if (!_registry) _registry = loadRegistry();
  return _registry;
}

export function getConnector(id: string): ConnectorDefinition | null {
  return getRegistry().get(id) ?? null;
}

export function getAllConnectors(): ConnectorDefinition[] {
  return [...getRegistry().values()];
}

export function getConnectorStatus(id: string): ConnectorStatus {
  const def = getConnector(id);
  if (!def) return 'unknown';
  if (!def.lastHeartbeat) return 'unknown';

  const elapsed = Date.now() - new Date(def.lastHeartbeat).getTime();
  if (elapsed > def.staleThresholdMs) return 'stale';
  if (elapsed > def.staleThresholdMs * 0.6) return 'degraded';
  return 'healthy';
}

export function updateHeartbeat(id: string, ts?: string): ConnectorDefinition | null {
  const map = getRegistry();
  const def = map.get(id);
  if (!def) return null;
  const updated: ConnectorDefinition = {
    ...def,
    lastHeartbeat: ts ?? new Date().toISOString(),
  };
  map.set(id, updated);
  saveRegistry(map);
  return updated;
}

export function updateEvent(id: string, ts?: string): ConnectorDefinition | null {
  const map = getRegistry();
  const def = map.get(id);
  if (!def) return null;
  const updated: ConnectorDefinition = {
    ...def,
    lastEvent: ts ?? new Date().toISOString(),
    lastHeartbeat: ts ?? new Date().toISOString(),
  };
  map.set(id, updated);
  saveRegistry(map);
  return updated;
}

export function getStaleConnectors(): ConnectorDefinition[] {
  return getAllConnectors().filter(c => getConnectorStatus(c.id) === 'stale');
}

export function getConnectorDivisions(): Record<string, string[]> {
  const divs: Record<string, string[]> = {};
  for (const c of getAllConnectors()) {
    if (!divs[c.division]) divs[c.division] = [];
    divs[c.division].push(c.id);
  }
  return divs;
}

export const CONNECTOR_REGISTRY_STATUS = 'PRODUCTION_LOOP_READY';