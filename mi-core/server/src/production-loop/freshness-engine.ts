/**
 * Freshness Engine — Production Loop Part 3
 * Calculates data freshness scores per connector and division.
 */

import { getAllConnectors, getConnectorStatus, ConnectorDefinition } from './connector-registry';

export interface FreshnessScore {
  connectorId: string;
  connectorName: string;
  status: string;
  freshnessScore: number; // 0–100 (100 = perfectly fresh)
  lastHeartbeatAgeMs: number;
  lastEventAgeMs: number;
  thresholdMs: number;
  isStale: boolean;
  division: string;
  priority: string;
}

export function calculateFreshness(c: ConnectorDefinition): FreshnessScore {
  const now = Date.now();
  const lastHb = c.lastHeartbeat ? new Date(c.lastHeartbeat).getTime() : 0;
  const lastEv = c.lastEvent ? new Date(c.lastEvent).getTime() : 0;
  const hbAgeMs = lastHb ? now - lastHb : Infinity;
  const evAgeMs = lastEv ? now - lastEv : Infinity;
  const isStale = hbAgeMs > c.staleThresholdMs;

  // Score: 100 when fresh, decays linearly to 0 at threshold
  const freshnessScore = lastHb === 0
    ? 0
    : Math.max(0, Math.round(100 * (1 - hbAgeMs / c.staleThresholdMs)));

  return {
    connectorId: c.id,
    connectorName: c.name,
    status: getConnectorStatus(c.id),
    freshnessScore,
    lastHeartbeatAgeMs: lastHb === 0 ? -1 : hbAgeMs,
    lastEventAgeMs: lastEv === 0 ? -1 : evAgeMs,
    thresholdMs: c.staleThresholdMs,
    isStale,
    division: c.division,
    priority: c.priority,
  };
}

export function getAllFreshnessScores(): FreshnessScore[] {
  return getAllConnectors().map(calculateFreshness);
}

export function getDivisionFreshness(): Record<string, {
  avgFreshness: number;
  connectorCount: number;
  staleCount: number;
  scores: FreshnessScore[];
}> {
  const scores = getAllFreshnessScores();
  const divs: Record<string, FreshnessScore[]> = {};
  for (const s of scores) {
    if (!divs[s.division]) divs[s.division] = [];
    divs[s.division].push(s);
  }

  const result: Record<string, {
    avgFreshness: number;
    connectorCount: number;
    staleCount: number;
    scores: FreshnessScore[];
  }> = {};

  for (const [div, divScores] of Object.entries(divs)) {
    const valid = divScores.filter(s => s.freshnessScore >= 0);
    const avgFreshness = valid.length > 0
      ? Math.round(valid.reduce((sum, s) => sum + s.freshnessScore, 0) / valid.length)
      : 0;
    result[div] = {
      avgFreshness,
      connectorCount: divScores.length,
      staleCount: divScores.filter(s => s.isStale).length,
      scores: divScores,
    };
  }

  return result;
}

export function getStaleConnectorFreshness(): FreshnessScore[] {
  return getAllFreshnessScores().filter(s => s.isStale);
}

export function getOverallFreshness(): {
  avgFreshness: number;
  totalConnectors: number;
  staleCount: number;
  degradedCount: number;
  healthyCount: number;
  loopStatus: 'PRODUCTION_LOOP_READY' | 'PRODUCTION_LOOP_PARTIAL' | 'PRODUCTION_LOOP_BLOCKED';
} {
  const scores = getAllFreshnessScores();
  const valid = scores.filter(s => s.freshnessScore >= 0);
  const avgFreshness = valid.length > 0
    ? Math.round(valid.reduce((sum, s) => sum + s.freshnessScore, 0) / valid.length)
    : 0;

  const staleCount = scores.filter(s => s.status === 'stale').length;
  const degradedCount = scores.filter(s => s.status === 'degraded').length;
  const healthyCount = scores.filter(s => s.status === 'healthy').length;

  let loopStatus: 'PRODUCTION_LOOP_READY' | 'PRODUCTION_LOOP_PARTIAL' | 'PRODUCTION_LOOP_BLOCKED';
  if (staleCount === 0 && degradedCount === 0) {
    loopStatus = 'PRODUCTION_LOOP_READY';
  } else if (staleCount <= Math.ceil(scores.length * 0.3)) {
    loopStatus = 'PRODUCTION_LOOP_PARTIAL';
  } else {
    loopStatus = 'PRODUCTION_LOOP_BLOCKED';
  }

  return {
    avgFreshness,
    totalConnectors: scores.length,
    staleCount,
    degradedCount,
    healthyCount,
    loopStatus,
  };
}