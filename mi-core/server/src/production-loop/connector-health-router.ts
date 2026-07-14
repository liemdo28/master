/**
 * Connector Health Router — Production Loop Part 5
 * Routes connector health signals to the correct division.
 */

import { getConnector, getConnectorStatus, getConnectorDivisions } from './connector-registry';
import { getConnectorEvents, getEventsByDivision } from './connector-event-ingestor';
import { getAllFreshnessScores, getDivisionFreshness } from './freshness-engine';

export interface HealthRouteResult {
  connectorId: string;
  connectorName: string;
  division: string;
  status: string;
  freshnessScore: number;
  eventCount: number;
  recentEvents: Array<{ id: string; type: string; timestamp: string }>;
  lastHeartbeat: string | null;
  lastEvent: string | null;
  priority: string;
  action: 'monitor' | 'alert' | 'critical' | 'healthy';
  message: string;
}

export function routeConnectorHealth(connectorId: string): HealthRouteResult | null {
  const connector = getConnector(connectorId);
  if (!connector) return null;

  const status = getConnectorStatus(connectorId);
  const events = getConnectorEvents(connectorId, 5);
  const freshnessScores = getAllFreshnessScores();
  const score = freshnessScores.find(s => s.connectorId === connectorId);

  let action: HealthRouteResult['action'];
  let message: string;

  switch (status) {
    case 'healthy':
      action = 'healthy';
      message = `${connector.name} is healthy.`;
      break;
    case 'degraded':
      action = 'alert';
      message = `${connector.name} is degraded. Last heartbeat ${connector.lastHeartbeat}.`;
      break;
    case 'stale':
      action = 'critical';
      message = `${connector.name} is STALE. Immediate attention required.`;
      break;
    default:
      action = 'monitor';
      message = `${connector.name} has unknown status. No heartbeat received.`;
  }

  return {
    connectorId: connector.id,
    connectorName: connector.name,
    division: connector.division,
    status,
    freshnessScore: score?.freshnessScore ?? 0,
    eventCount: events.length,
    recentEvents: events.map(e => ({ id: e.id, type: e.type, timestamp: e.timestamp })),
    lastHeartbeat: connector.lastHeartbeat,
    lastEvent: connector.lastEvent,
    priority: connector.priority,
    action,
    message,
  };
}

export function routeAllConnectors(): {
  connectors: HealthRouteResult[];
  byDivision: Record<string, HealthRouteResult[]>;
  criticalCount: number;
  alertCount: number;
  healthyCount: number;
} {
  const { getAllConnectors } = require('./connector-registry');
  const connectors = getAllConnectors().map((c: { id: string }) => routeConnectorHealth(c.id)).filter(Boolean) as HealthRouteResult[];

  const byDivision: Record<string, HealthRouteResult[]> = {};
  for (const c of connectors) {
    if (!byDivision[c.division]) byDivision[c.division] = [];
    byDivision[c.division].push(c);
  }

  return {
    connectors,
    byDivision,
    criticalCount: connectors.filter(c => c.action === 'critical').length,
    alertCount: connectors.filter(c => c.action === 'alert').length,
    healthyCount: connectors.filter(c => c.action === 'healthy').length,
  };
}

export function getDivisionHealthSummary(): Record<string, {
  avgFreshness: number;
  connectors: HealthRouteResult[];
  overallStatus: string;
  action: 'healthy' | 'alert' | 'critical';
}> {
  const all = routeAllConnectors();
  const divFreshness = getDivisionFreshness();
  const result: Record<string, {
    avgFreshness: number;
    connectors: HealthRouteResult[];
    overallStatus: string;
    action: 'healthy' | 'alert' | 'critical';
  }> = {};

  for (const [div, conns] of Object.entries(all.byDivision)) {
    const fresh = divFreshness[div];
    const hasCritical = conns.some(c => c.action === 'critical');
    const hasAlert = conns.some(c => c.action === 'alert');

    result[div] = {
      avgFreshness: fresh?.avgFreshness ?? 0,
      connectors: conns,
      overallStatus: hasCritical ? 'critical' : hasAlert ? 'degraded' : 'healthy',
      action: hasCritical ? 'critical' : hasAlert ? 'alert' : 'healthy',
    };
  }

  return result;
}