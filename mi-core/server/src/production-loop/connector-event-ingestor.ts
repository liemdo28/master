/**
 * Connector Event Ingestor — Production Loop Part 4
 * Ingests connector events, routes to division, creates tasks for stale connectors.
 */

import { updateEvent, getConnector, getConnectorStatus, getStaleConnectors, ConnectorDefinition } from './connector-registry';
import fs from 'fs';
import path from 'path';

const MI_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const EVIDENCE_DIR = process.env.PRODUCTION_LOOP_EVIDENCE_DIR ||
  path.join(MI_ROOT, 'evidence', 'production-loop');
const EVENTS_FILE = path.join(EVIDENCE_DIR, 'connector-events.json');

function ensureDir() { fs.mkdirSync(EVIDENCE_DIR, { recursive: true }); }

export interface ConnectorEvent {
  id: string;
  connectorId: string;
  timestamp: string;
  type: 'data_update' | 'error' | 'auth_refresh' | 'metrics' | 'heartbeat' | 'custom';
  payload: Record<string, unknown>;
  division: string;
  routed: boolean;
}

interface EventStore {
  events: ConnectorEvent[];
}

function loadEvents(): EventStore {
  try {
    return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
  } catch {
    return { events: [] };
  }
}

function saveEvents(store: EventStore) {
  ensureDir();
  // Keep last 1000 events
  const trimmed = store.events.slice(-999);
  fs.writeFileSync(EVENTS_FILE, JSON.stringify({ events: trimmed }, null, 2));
}

let _events: ConnectorEvent[] | null = null;

function getEvents(): ConnectorEvent[] {
  if (!_events) _events = loadEvents().events;
  return _events;
}

export function ingestConnectorEvent(req: {
  connectorId: string;
  type?: ConnectorEvent['type'];
  payload?: Record<string, unknown>;
  timestamp?: string;
}): { event: ConnectorEvent | null; task?: { taskId: string; title: string; division: string; priority: string; connectorId: string } } {
  const ts = req.timestamp ?? new Date().toISOString();
  const connector = getConnector(req.connectorId);

  if (!connector) {
    return { event: null };
  }

  updateEvent(req.connectorId, ts);

  const event: ConnectorEvent = {
    id: `${req.connectorId}-${Date.now()}`,
    connectorId: req.connectorId,
    timestamp: ts,
    type: req.type ?? 'data_update',
    payload: req.payload ?? {},
    division: connector.division,
    routed: true,
  };

  _events = getEvents();
  _events.push(event);
  saveEvents({ events: _events });

  // Check if this connector just became stale and create a task
  const status = getConnectorStatus(req.connectorId);
  let task: { taskId: string; title: string; division: string; priority: string; connectorId: string } | undefined;

  if (status === 'stale') {
    const taskId = `stale-connector-${req.connectorId}-${Date.now()}`;
    task = {
      taskId,
      title: `Fix stale connector: ${connector.name}`,
      division: connector.division,
      priority: connector.priority === 'critical' ? 'P0' : connector.priority === 'high' ? 'P1' : 'P2',
      connectorId: req.connectorId,
    };
  }

  return { event, task };
}

export function getConnectorEvents(connectorId?: string, limit = 100): ConnectorEvent[] {
  const events = getEvents();
  const filtered = connectorId
    ? events.filter(e => e.connectorId === connectorId)
    : events;
  return filtered.slice(-limit);
}

export function getEventsByDivision(division: string): ConnectorEvent[] {
  return getEvents().filter(e => e.division === division);
}

export function createStaleConnectorTasks(): Array<{
  taskId: string;
  title: string;
  division: string;
  priority: string;
  connectorId: string;
  connectorName: string;
}> {
  const stale = getStaleConnectors();
  return stale.map(c => ({
    taskId: `stale-connector-${c.id}-${Date.now()}`,
    title: `Fix stale connector: ${c.name}`,
    division: c.division,
    priority: c.priority === 'critical' ? 'P0' : c.priority === 'high' ? 'P1' : 'P2',
    connectorId: c.id,
    connectorName: c.name,
  }));
}