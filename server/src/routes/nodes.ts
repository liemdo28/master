/**
 * Node routes — register, heartbeat, status, exec, file read.
 * Phase 6: persistent registry; Phase 7: leader lock routes.
 */

import { Router } from 'express';
import { registerNode, heartbeat, getAllNodes, getNode, setNodeRole } from '../nodes/node-registry';
import {
  registerNodePersistent, heartbeatPersistent, getAllNodesPersistent,
  getNodesSummary, setNodeRolePersistent,
} from '../nodes/node-registry-persistent';
import {
  getLockState, acquireLeadership, releaseLeadership,
  leaderHeartbeatPersistent, getLeaderStatus, isLeader, LEADER_TASKS,
} from '../nodes/leader-lock-persistent';
import {
  getNodeStatus,
  getNodeHealth,
  getNodeProjects,
  getProjectStatus,
  getProjectLogs,
  restartProject,
  execOnNode,
  readFileOnNode,
  formatNodeSummary,
} from '../nodes/node-controller';

export const nodesRouter = Router();

function nodeSummaryPayload() {
  const nodes = getAllNodes();
  return {
    nodes,
    total: nodes.length,
    online: nodes.filter(n => n.status === 'online').length,
    offline: nodes.filter(n => n.status === 'offline').length,
    summary: nodes.map(formatNodeSummary).join('\n'),
  };
}

// GET /api/nodes — all nodes
nodesRouter.get('/', (_req, res) => {
  res.json(nodeSummaryPayload());
});

// GET /api/nodes/status — all nodes
nodesRouter.get('/status', (_req, res) => {
  res.json(nodeSummaryPayload());
});

// GET /api/nodes/:id/status — single node live ping
nodesRouter.get('/:id/status', async (req, res) => {
  const status = await getNodeStatus(req.params.id);
  res.json(status);
});

// GET /api/nodes/:id/health — node agent health
nodesRouter.get('/:id/health', async (req, res) => {
  const status = await getNodeHealth(req.params.id);
  res.json(status);
});

// GET /api/nodes/:id/projects — known Laptop project health summary
nodesRouter.get('/:id/projects', async (req, res) => {
  const status = await getNodeProjects(req.params.id);
  res.json(status);
});

// GET /api/nodes/:id/projects/:project/status — single project health
nodesRouter.get('/:id/projects/:project/status', async (req, res) => {
  const status = await getProjectStatus(req.params.id, req.params.project);
  res.json(status);
});

// GET /api/nodes/:id/projects/:project/logs — remote logs through node agent
nodesRouter.get('/:id/projects/:project/logs', async (req, res) => {
  const logs = await getProjectLogs(req.params.id, req.params.project);
  res.json(logs);
});

// POST /api/nodes/:id/projects/:project/restart — restart allowlisted project
nodesRouter.post('/:id/projects/:project/restart', async (req, res) => {
  const result = await restartProject(req.params.id, req.params.project);
  res.json(result);
});

// POST /api/nodes/register — node self-registration (no auth needed, just registering metadata)
nodesRouter.post('/register', (req, res) => {
  const {
    node_id,
    node_name,
    node_url,
    node_role,
    port,
    platform,
    node_version,
  } = req.body as {
    node_id: string;
    node_name?: string;
    node_url?: string;
    node_role?: 'active' | 'passive' | 'worker';
    port: number;
    platform: string;
    node_version: string;
  };
  if (!node_id || !port) return res.status(400).json({ error: 'node_id and port required' });
  const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const record = registerNode({
    node_id,
    node_name,
    node_url,
    role: node_role,
    port,
    platform: platform || 'unknown',
    node_version: node_version || 'unknown',
    address: `${ip}:${port}`,
  });
  res.json({ registered: true, node: record });
});

// POST /api/nodes/:id/heartbeat
nodesRouter.post('/:id/heartbeat', (req, res) => {
  const ok = heartbeat(req.params.id);
  if (!ok) return res.status(404).json({ error: 'NODE_NOT_FOUND' });
  res.json({ ok: true, node_id: req.params.id, timestamp: new Date().toISOString() });
});

// POST /api/nodes/:id/exec — forward command to node
nodesRouter.post('/:id/exec', async (req, res) => {
  const { command, cwd } = req.body as { command: string; cwd?: string };
  if (!command) return res.status(400).json({ error: 'command required' });
  const result = await execOnNode(req.params.id, command, cwd);
  res.json(result);
});

// GET /api/nodes/:id/file — read file on remote node
nodesRouter.get('/:id/file', async (req, res) => {
  const filePath = String(req.query.path || '');
  if (!filePath) return res.status(400).json({ error: 'path required' });
  const result = await readFileOnNode(req.params.id, filePath);
  res.json(result);
});

// PATCH /api/nodes/:id/role — set active/passive
nodesRouter.patch('/:id/role', (req, res) => {
  const { role } = req.body as { role: 'active' | 'passive' | 'worker' };
  if (!role || !['active', 'passive', 'worker'].includes(role)) return res.status(400).json({ error: 'role must be active, passive, or worker' });
  const ok = setNodeRole(req.params.id, role);
  if (!ok) return res.status(404).json({ error: 'NODE_NOT_FOUND' });
  res.json({ updated: true, node_id: req.params.id, role });
});

// ── Phase 6: Persistent node registry ────────────────────────────────────────

// GET /api/nodes/persistent — all nodes from file-backed registry
nodesRouter.get('/persistent', (_req, res) => {
  res.json(getNodesSummary());
});

// POST /api/nodes/persistent/register — Phase 6 full registration
nodesRouter.post('/persistent/register', (req, res) => {
  const { node_id, node_name, port, platform, node_version, capabilities, metadata } = req.body as any;
  if (!node_id || !port) return res.status(400).json({ error: 'node_id and port required' });
  const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const record = registerNodePersistent({
    node_id, node_name, address: `${ip}:${port}`, port,
    platform: platform || 'unknown', node_version: node_version || 'unknown',
    capabilities: capabilities || [], metadata,
  });
  // Also register in in-memory registry for backward compat
  registerNode({ node_id, node_name, port, platform: platform || 'unknown', node_version: node_version || 'unknown', address: `${ip}:${port}` });
  res.json({ registered: true, node: record });
});

// POST /api/nodes/:id/heartbeat/persistent — persistent heartbeat
nodesRouter.post('/:id/heartbeat/persistent', (req, res) => {
  const ok = heartbeatPersistent(req.params.id, req.body?.metadata);
  heartbeat(req.params.id); // also update in-memory
  if (!ok) return res.status(404).json({ error: 'NODE_NOT_FOUND_IN_PERSISTENT_REGISTRY' });
  res.json({ ok: true, node_id: req.params.id, ts: new Date().toISOString() });
});

// ── Phase 7: Leader Lock ──────────────────────────────────────────────────────

// GET /api/nodes/leader — current leader state
nodesRouter.get('/leader', (_req, res) => {
  res.json(getLockState());
});

// GET /api/nodes/leader/status — formatted WhatsApp-ready status
nodesRouter.get('/leader/status', (_req, res) => {
  res.json({ status: getLeaderStatus(), is_leader: isLeader(), tasks: LEADER_TASKS });
});

// POST /api/nodes/leader/acquire — claim leadership (body: { node_id })
nodesRouter.post('/leader/acquire', (req, res) => {
  const { node_id } = req.body as { node_id?: string };
  const result = acquireLeadership(node_id);
  res.json(result);
});

// POST /api/nodes/leader/release — release leadership (body: { node_id })
nodesRouter.post('/leader/release', (req, res) => {
  const { node_id } = req.body as { node_id?: string };
  const result = releaseLeadership(node_id);
  res.json(result);
});

// POST /api/nodes/leader/heartbeat — leader heartbeat (body: { node_id })
nodesRouter.post('/leader/heartbeat', (req, res) => {
  const { node_id } = req.body as { node_id?: string };
  const ok = leaderHeartbeatPersistent(node_id);
  res.json({ ok, ts: new Date().toISOString() });
});
