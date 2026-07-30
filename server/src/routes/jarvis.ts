/**
 * Jarvis routes — proactive monitoring, risk, suggestions, approvals, task runner.
 */

import { Router } from 'express';
import { runMonitorCycle, getAlertHistory, acknowledgeAlert } from '../jarvis/proactive-monitor';
import { evaluateSystemRisk, formatRiskSummary } from '../jarvis/risk-engine';
import { generateSuggestions } from '../jarvis/suggestion-engine';
import { getPendingApprovals, resolveApproval, getApprovalById, formatApprovalWhatsApp } from '../jarvis/approval-conversation';
import { runApprovedTask } from '../jarvis/autonomous-task-runner';
import { getPreferences, setPreference, addMute, addWatch } from '../jarvis/ceo-preference-store';

export const jarvisRouter = Router();

// GET /api/jarvis/health
jarvisRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'jarvis', timestamp: new Date().toISOString() });
});

// GET /api/jarvis/risk — live risk evaluation
jarvisRouter.get('/risk', async (_req, res) => {
  const signals = await evaluateSystemRisk();
  res.json({ signals, summary: formatRiskSummary(signals), total: signals.length });
});

// POST /api/jarvis/monitor — trigger one monitor cycle
jarvisRouter.post('/monitor', async (_req, res) => {
  const alerts = await runMonitorCycle();
  res.json({ alerts, count: alerts.length });
});

// GET /api/jarvis/alerts — recent alert history
jarvisRouter.get('/alerts', (req, res) => {
  const limit = parseInt(String(req.query.limit)) || 20;
  res.json({ alerts: getAlertHistory(limit) });
});

// POST /api/jarvis/alerts/:id/ack — acknowledge alert
jarvisRouter.post('/alerts/:id/ack', (req, res) => {
  acknowledgeAlert(req.params.id);
  res.json({ acknowledged: true, id: req.params.id });
});

// GET /api/jarvis/suggestions — suggestions from current risk
jarvisRouter.get('/suggestions', async (_req, res) => {
  const signals = await evaluateSystemRisk();
  const suggestions = generateSuggestions(signals);
  res.json({ suggestions, count: suggestions.length });
});

// GET /api/jarvis/approvals — pending approvals
jarvisRouter.get('/approvals', (_req, res) => {
  res.json({ approvals: getPendingApprovals() });
});

// POST /api/jarvis/approvals/:id/approve
jarvisRouter.post('/approvals/:id/approve', async (req, res) => {
  const item = resolveApproval(req.params.id, 'approved');
  if (!item) return res.status(404).json({ error: 'Approval not found or already resolved' });
  if (item.auto_command) {
    const result = await runApprovedTask(req.params.id);
    return res.json({ approval: item, execution: result });
  }
  return res.json({ approval: item });
});

// POST /api/jarvis/approvals/:id/reject
jarvisRouter.post('/approvals/:id/reject', (req, res) => {
  const item = resolveApproval(req.params.id, 'rejected');
  if (!item) return res.status(404).json({ error: 'Approval not found or already resolved' });
  res.json({ approval: item });
});

// GET /api/jarvis/approvals/:id/prompt — WhatsApp-formatted prompt
jarvisRouter.get('/approvals/:id/prompt', (req, res) => {
  const item = getApprovalById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json({ prompt: formatApprovalWhatsApp(item) });
});

// GET /api/jarvis/preferences
jarvisRouter.get('/preferences', (_req, res) => {
  res.json({ preferences: getPreferences() });
});

// PATCH /api/jarvis/preferences — update a single preference key
jarvisRouter.patch('/preferences', (req, res) => {
  const { key, value } = req.body as { key: string; value: unknown };
  if (!key) return res.status(400).json({ error: 'key required' });
  setPreference(key as Parameters<typeof setPreference>[0], value as string);
  res.json({ updated: true, preferences: getPreferences() });
});

// POST /api/jarvis/mute
jarvisRouter.post('/mute', (req, res) => {
  const { target, hours } = req.body as { target: string; hours?: number };
  if (!target) return res.status(400).json({ error: 'target required' });
  addMute(target, hours || 4);
  res.json({ muted: true, target, hours: hours || 4 });
});

// POST /api/jarvis/watch
jarvisRouter.post('/watch', (req, res) => {
  const { target } = req.body as { target: string };
  if (!target) return res.status(400).json({ error: 'target required' });
  addWatch(target);
  res.json({ watching: true, target });
});

// GET /api/jarvis/briefing/status — daily briefing scheduler status
jarvisRouter.get('/briefing/status', async (_req, res) => {
  const { getDailyBriefingStatus } = await import('../jarvis/daily-briefing-scheduler');
  res.json(getDailyBriefingStatus());
});

// POST /api/jarvis/briefing/trigger — manual briefing trigger
jarvisRouter.post('/briefing/trigger', async (_req, res) => {
  const { sendDailyBriefing } = await import('../jarvis/daily-briefing-scheduler');
  const result = await sendDailyBriefing();
  res.json({ ok: true, sent_length: result.length });
});

// GET /api/jarvis/tasks — autonomous task runner status
jarvisRouter.get('/tasks', async (_req, res) => {
  res.json({ tasks: [], running: false, note: 'task runner available via /api/jarvis/approvals' });
});

// GET /api/jarvis/conversation/stats — conversation memory stats
jarvisRouter.get('/conversation/stats', (_req, res) => {
  const { getSessionStats } = require('../communication/conversation-memory');
  res.json(getSessionStats());
});

// ── JARVIS EVOLUTION — Phase 21-30 Routes ───────────────────────────────────

// Phase 21: Knowledge Universe
jarvisRouter.get('/knowledge/stats', (_req, res) => {
  const { getKnowledgeStats } = require('../jarvis/phase21-knowledge/knowledge-indexer');
  res.json(getKnowledgeStats());
});
jarvisRouter.get('/knowledge/search', (req, res) => {
  const { searchKnowledge } = require('../jarvis/phase21-knowledge/knowledge-indexer');
  const q = String(req.query.q || '');
  if (!q) return res.status(400).json({ error: 'q is required' });
  res.json(searchKnowledge(q, Number(req.query.limit) || 10));
});
jarvisRouter.post('/knowledge/index', async (_req, res) => {
  const { indexKnowledge } = require('../jarvis/phase21-knowledge/knowledge-indexer');
  res.json(await indexKnowledge());
});

// Phase 22: Memory Universe
jarvisRouter.get('/memory/stats', (_req, res) => {
  const { getMemoryStats } = require('../jarvis/phase22-memory/memory-registry');
  res.json(getMemoryStats());
});
jarvisRouter.get('/memory/search', (req, res) => {
  const { recallMemory } = require('../jarvis/phase22-memory/memory-registry');
  res.json(recallMemory({ q: String(req.query.q || ''), layer: req.query.layer as any, limit: 20 }));
});
jarvisRouter.get('/memory/timeline', (req, res) => {
  const { getMemoryTimeline } = require('../jarvis/phase22-memory/memory-registry');
  res.json(getMemoryTimeline(req.query.layer as any, 30));
});
jarvisRouter.post('/memory/store', (req, res) => {
  const { storeMemory } = require('../jarvis/phase22-memory/memory-registry');
  const { layer, subject, content, source, tags, confidence } = req.body;
  if (!layer || !subject || !content) return res.status(400).json({ error: 'layer, subject, content required' });
  res.json(storeMemory({ layer, subject, content, source: source || 'api', tags: tags || [], confidence: confidence ?? 0.9 }));
});

// Phase 23: Tool Registry
jarvisRouter.get('/tools', (_req, res) => {
  const { getAllTools } = require('../jarvis/phase23-tools/tool-registry');
  res.json(getAllTools());
});
jarvisRouter.get('/tools/dangerous', (_req, res) => {
  const { getDangerousTools } = require('../jarvis/phase23-tools/tool-registry');
  res.json(getDangerousTools());
});
jarvisRouter.get('/tools/:id', (req, res) => {
  const { getToolById } = require('../jarvis/phase23-tools/tool-registry');
  const tool = getToolById(req.params.id);
  if (!tool) return res.status(404).json({ error: 'Tool not found' });
  res.json(tool);
});

// Phase 24: Agent Ecosystem
jarvisRouter.get('/agents', (_req, res) => {
  const { getAllAgents } = require('../jarvis/phase24-agents/agent-registry');
  res.json(getAllAgents());
});
jarvisRouter.get('/agents/health', (_req, res) => {
  const { getAgentHealth } = require('../jarvis/phase24-agents/agent-registry');
  res.json(getAgentHealth());
});
jarvisRouter.post('/agents/route', (req, res) => {
  const { routeToAgent } = require('../jarvis/phase24-agents/agent-registry');
  const { input } = req.body;
  if (!input) return res.status(400).json({ error: 'input required' });
  res.json({ matched: routeToAgent(input) });
});

// Phase 25: Knowledge Graph
jarvisRouter.get('/graph/stats', (_req, res) => {
  const { getGraphStats } = require('../jarvis/phase25-graph/knowledge-graph');
  res.json(getGraphStats());
});
jarvisRouter.get('/graph/entities', (req, res) => {
  const { getAllEntities } = require('../jarvis/phase25-graph/knowledge-graph');
  res.json(getAllEntities(req.query.type as any));
});
jarvisRouter.get('/graph/explore/:name', (req, res) => {
  const { exploreRelationships } = require('../jarvis/phase25-graph/knowledge-graph');
  res.json({ result: exploreRelationships(req.params.name) });
});

// Phase 26: Observability
jarvisRouter.get('/observability/health', (_req, res) => {
  const { getAllServiceHealth } = require('../jarvis/phase26-observability/health-center');
  res.json(getAllServiceHealth());
});
jarvisRouter.post('/observability/sweep', async (_req, res) => {
  const { runHealthSweep } = require('../jarvis/phase26-observability/health-center');
  res.json(await runHealthSweep());
});
jarvisRouter.get('/observability/incidents', (_req, res) => {
  const { getOpenIncidents } = require('../jarvis/phase26-observability/health-center');
  res.json(getOpenIncidents());
});
jarvisRouter.get('/observability/stats', (_req, res) => {
  const { getObservabilityStats } = require('../jarvis/phase26-observability/health-center');
  res.json(getObservabilityStats());
});

// Phase 27: Workflows
jarvisRouter.get('/workflows', (_req, res) => {
  const { getAllWorkflows } = require('../jarvis/phase27-workflows/workflow-runner');
  res.json(getAllWorkflows());
});
jarvisRouter.get('/workflows/stats', (_req, res) => {
  const { getWorkflowStats } = require('../jarvis/phase27-workflows/workflow-runner');
  res.json(getWorkflowStats());
});
jarvisRouter.post('/workflows/:id/run', async (req, res) => {
  const { runWorkflow } = require('../jarvis/phase27-workflows/workflow-runner');
  try {
    res.json(await runWorkflow(req.params.id, req.body.trigger || 'manual', req.body.triggered_by || 'api'));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Phase 28: Executive Intelligence
jarvisRouter.get('/executive/briefing', async (req, res) => {
  const { generateBriefing } = require('../jarvis/phase28-executive/executive-intelligence');
  res.json(await generateBriefing((req.query.frequency as any) || 'daily'));
});
jarvisRouter.get('/executive/schedule', (_req, res) => {
  const { getBriefingSchedule } = require('../jarvis/phase28-executive/executive-intelligence');
  res.json(getBriefingSchedule());
});

// Phase 29: Business Digital Twin
jarvisRouter.get('/twin', (_req, res) => {
  const { getTwinState } = require('../jarvis/phase29-twin/business-twin');
  res.json(getTwinState());
});
jarvisRouter.get('/twin/risk', (_req, res) => {
  const { runRiskAnalysis } = require('../jarvis/phase29-twin/business-twin');
  res.json(runRiskAnalysis());
});
jarvisRouter.get('/twin/scenarios', (_req, res) => {
  const { getAllScenarios } = require('../jarvis/phase29-twin/business-twin');
  res.json(getAllScenarios());
});
jarvisRouter.post('/twin/simulate/:id', (req, res) => {
  const { simulateScenario } = require('../jarvis/phase29-twin/business-twin');
  const result = simulateScenario(req.params.id);
  if (!result) return res.status(404).json({ error: 'Scenario not found' });
  res.json(result);
});

// Phase 30: True Jarvis Query Interface
const JARVIS_API_KEY = process.env.MI_CORE_API_KEY || '';
function requireApiKey(req: any, res: any, next: any) {
  if (!JARVIS_API_KEY) return res.status(503).json({ error: 'Server not configured — MI_CORE_API_KEY missing' });
  const key = (req.headers['x-api-key'] as string) || req.body?.api_key || '';
  if (key !== JARVIS_API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

jarvisRouter.post('/evolution/query', requireApiKey, async (req, res) => {
  const { processJarvisQuery } = require('../jarvis/phase30-jarvis/jarvis-core');
  const { text, sender } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  res.json(await processJarvisQuery({ sender: sender || 'api', raw_text: text, normalized: text, timestamp: new Date().toISOString() }));
});
jarvisRouter.get('/evolution/status', requireApiKey, async (_req, res) => {
  const { processJarvisQuery } = require('../jarvis/phase30-jarvis/jarvis-core');
  res.json(await processJarvisQuery({ sender: 'api', raw_text: 'jarvis status', normalized: 'jarvis status', timestamp: new Date().toISOString() }));
});
