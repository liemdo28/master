/**
 * Production Loop Router — Production Loop API Layer
 * Exposes the 5 required production loop APIs.
 */

import { Router, Request, Response } from 'express';
import { getAllConnectors, getConnectorStatus, getStaleConnectors } from './connector-registry';
import { acceptHeartbeat, getHeartbeatSummary } from './connector-heartbeat';
import { ingestConnectorEvent, getConnectorEvents, getEventsByDivision } from './connector-event-ingestor';
import { getAllFreshnessScores, getOverallFreshness, getDivisionFreshness } from './freshness-engine';
import { routeAllConnectors, getDivisionHealthSummary, routeConnectorHealth } from './connector-health-router';
import { getEvidenceSummary, readEvidence } from './connector-evidence-writer';
import { getExecutiveAlertSummary, generateStaleConnectorAlerts } from './connector-alert-engine';
import { generateDashboard } from './production-loop-dashboard';

export const productionLoopRouter = Router({ mergeParams: true });

// GET /api/production-loop/status
productionLoopRouter.get('/status', (_req: Request, res: Response) => {
  try {
    const freshness = getOverallFreshness();
    const heartbeat = getHeartbeatSummary();
    const stale = getStaleConnectors();
    const alerts = getExecutiveAlertSummary();

    res.json({
      status: freshness.loopStatus,
      generatedAt: new Date().toISOString(),
      freshness: {
        avgFreshness: freshness.avgFreshness,
        totalConnectors: freshness.totalConnectors,
        healthyCount: freshness.healthyCount,
        degradedCount: freshness.degradedCount,
        staleCount: freshness.staleCount,
      },
      connectors: heartbeat,
      staleConnectors: stale.map(c => ({
        id: c.id, name: c.name, division: c.division, priority: c.priority,
        lastHeartbeat: c.lastHeartbeat,
      })),
      alerts: {
        unacknowledged: alerts.unacknowledged,
        bySeverity: alerts.bySeverity,
        byDivision: alerts.byDivision,
      },
      divisionHealth: getDivisionHealthSummary(),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /api/production-loop/heartbeat
productionLoopRouter.post('/heartbeat', (req: Request, res: Response) => {
  try {
    const { connectorId, timestamp, metrics, metadata } = req.body;
    if (!connectorId) {
      return res.status(400).json({ error: 'connectorId is required' });
    }
    const result = acceptHeartbeat({ connectorId, timestamp, metrics, metadata });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST /api/production-loop/event
productionLoopRouter.post('/event', (req: Request, res: Response) => {
  try {
    const { connectorId, type, payload, timestamp } = req.body;
    if (!connectorId) {
      return res.status(400).json({ error: 'connectorId is required' });
    }
    const { event, task } = ingestConnectorEvent({ connectorId, type, payload, timestamp });

    if (!event) {
      return res.status(404).json({ error: `Connector '${connectorId}' not found` });
    }

    // Auto-generate stale alerts
    const alerts = generateStaleConnectorAlerts();

    res.json({ event, task, staleAlertsGenerated: alerts.length });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/production-loop/evidence
productionLoopRouter.get('/evidence', (req: Request, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit || '200'), 10);
    const records = readEvidence(limit);
    const summary = getEvidenceSummary();
    res.json({ records, summary });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/production-loop/freshness
productionLoopRouter.get('/freshness', (req: Request, res: Response) => {
  try {
    const connectorId = req.query.connectorId as string | undefined;
    const scores = getAllFreshnessScores();
    const overall = getOverallFreshness();
    const byDivision = getDivisionFreshness();

    if (connectorId) {
      const score = scores.find(s => s.connectorId === connectorId);
      if (!score) return res.status(404).json({ error: `Connector '${connectorId}' not found` });
      return res.json({ connector: score, overall, byDivision });
    }

    res.json({ scores, overall, byDivision });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GET /api/production-loop/dashboard
productionLoopRouter.get('/dashboard', (_req: Request, res: Response) => {
  try {
    res.json(generateDashboard());
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});