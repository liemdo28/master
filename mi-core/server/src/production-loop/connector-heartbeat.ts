/**
 * Connector Heartbeat Engine — Production Loop Part 2
 * Accepts heartbeat signals from connectors and updates registry.
 */

import { updateHeartbeat, getConnector, getConnectorStatus, ConnectorDefinition } from './connector-registry';

export interface HeartbeatRequest {
  connectorId: string;
  timestamp?: string;
  metrics?: {
    latencyMs?: number;
    errorRate?: number;
    successRate?: number;
    messageCount?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface HeartbeatResult {
  accepted: boolean;
  connectorId: string;
  status: string;
  nextExpectedMs: number;
  timestamp: string;
  message: string;
}

export function acceptHeartbeat(req: HeartbeatRequest): HeartbeatResult {
  const ts = req.timestamp ?? new Date().toISOString();
  const connector = getConnector(req.connectorId);

  if (!connector) {
    return {
      accepted: false,
      connectorId: req.connectorId,
      status: 'unknown',
      nextExpectedMs: 300000,
      timestamp: ts,
      message: `Connector '${req.connectorId}' not found in registry.`,
    };
  }

  const updated = updateHeartbeat(req.connectorId, ts);
  const status = getConnectorStatus(req.connectorId);

  return {
    accepted: true,
    connectorId: req.connectorId,
    status,
    nextExpectedMs: connector.staleThresholdMs,
    timestamp: ts,
    message: `Heartbeat accepted. Connector status: ${status}`,
  };
}

export function getHeartbeatSummary(): {
  connectors: Array<{ id: string; name: string; status: string; lastHeartbeat: string | null; priority: string }>;
  total: number;
  healthy: number;
  stale: number;
  degraded: number;
  unknown: number;
} {
  const { getAllConnectors } = require('./connector-registry');
  const connectors = getAllConnectors().map((c: ConnectorDefinition) => ({
    id: c.id,
    name: c.name,
    status: getConnectorStatus(c.id),
    lastHeartbeat: c.lastHeartbeat,
    priority: c.priority,
  }));

  return {
    connectors,
    total: connectors.length,
    healthy: connectors.filter((c: { status: string }) => c.status === 'healthy').length,
    stale: connectors.filter((c: { status: string }) => c.status === 'stale').length,
    degraded: connectors.filter((c: { status: string }) => c.status === 'degraded').length,
    unknown: connectors.filter((c: { status: string }) => c.status === 'unknown').length,
  };
}