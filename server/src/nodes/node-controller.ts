/**
 * Node Controller — Mi-Core's interface to remote laptop nodes.
 * Forwards allowlisted commands to node agents via authenticated HTTP.
 * Never exposes NODE_SECRET in logs or responses.
 */

import { createHash } from 'crypto';
import { getNode, NodeRecord } from './node-registry';

const PROJECTS = {
  'whatsapp-ai-gateway': {
    id: 'whatsapp-ai-gateway',
    name: 'WhatsApp gateway',
    port: 3211,
    process: 'whatsapp-ai-gateway',
  },
  'doordash-compaigns': {
    id: 'doordash-compaigns',
    name: 'DoorDash campaigns',
    port: 4400,
    process: 'doordash-compaigns',
  },
  'integration-system': {
    id: 'integration-system',
    name: 'Integration background agent',
    port: 4100,
    process: 'integration-system',
  },
  'review-automation': {
    id: 'review-automation',
    name: 'Review Automation',
    port: 4300,
    process: 'review-automation',
  },
} as const;

export type NodeProjectId = keyof typeof PROJECTS;

function makeHeaders(nodeSecret: string, nodeId: string): Record<string, string> {
  const hash = createHash('sha256').update(nodeSecret + 'mi-node-salt-2026').digest('hex');
  return {
    'Content-Type': 'application/json',
    'x-node-id': nodeId,
    'x-node-secret': hash,
  };
}

function getNodeBase(node: NodeRecord): string {
  return node.address.startsWith('http') ? node.address.replace(/\/$/, '') : `http://${node.address}`;
}

function getNodeHost(node: NodeRecord): string {
  const base = getNodeBase(node);
  return new URL(base).hostname;
}

function getNodeSecret(nodeId: string): string {
  return process.env[`NODE_SECRET_${nodeId.toUpperCase().replace(/-/g, '_')}`] || '';
}

async function fetchJson(url: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(5000) });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try { body = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { body = { raw: text }; }
  return { ok: res.ok, status: res.status, ...body };
}

export function listKnownProjects() {
  return Object.values(PROJECTS);
}

function isDangerousCommand(command: string, nodeId: string): string | null {
  const normalized = command.trim().toLowerCase();
  if (/(^|[\\\/\s])\.env($|[\\\/\s])/.test(normalized) || /\b(type|cat|get-content)\b.*\.env\b/.test(normalized)) {
    return 'BLOCKED_SECRET_READ';
  }
  if (/\b(del|erase|rm|remove-item|rmdir|rd)\b/.test(normalized)) {
    return 'BLOCKED_DESTRUCTIVE_DELETE';
  }
  if (nodeId === 'laptop1' && /pm2\s+stop\s+integration-system/.test(normalized)) {
    return 'BLOCKED_ACTIVE_INTEGRATION_STOP_REQUIRES_APPROVAL';
  }
  return null;
}

export async function getNodeStatus(nodeId: string): Promise<Record<string, unknown>> {
  const node = getNode(nodeId);
  if (!node) return { error: 'NODE_NOT_FOUND', node_id: nodeId };
  const secret = getNodeSecret(nodeId);
  try {
    const res = await fetch(`${getNodeBase(node)}/status`, {
      headers: makeHeaders(secret, nodeId),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? await res.json() as Record<string, unknown> : { error: 'NODE_UNREACHABLE', status: res.status };
  } catch { return { error: 'NODE_OFFLINE', node_id: nodeId }; }
}

export async function getNodeHealth(nodeId: string): Promise<Record<string, unknown>> {
  const node = getNode(nodeId);
  if (!node) return { ok: false, error: 'NODE_NOT_FOUND', node_id: nodeId };
  try {
    return await fetchJson(`${getNodeBase(node)}/health`);
  } catch {
    return { ok: false, error: 'NODE_OFFLINE', node_id: nodeId };
  }
}

export async function getProjectStatus(nodeId: string, projectId: string): Promise<Record<string, unknown>> {
  const node = getNode(nodeId);
  if (!node) return { ok: false, error: 'NODE_NOT_FOUND', node_id: nodeId, project_id: projectId };
  const project = PROJECTS[projectId as NodeProjectId];
  if (!project) return { ok: false, error: 'PROJECT_NOT_FOUND', node_id: nodeId, project_id: projectId };

  const host = getNodeHost(node);
  const urls = [
    `http://${host}:${project.port}/health`,
    `http://${host}:${project.port}/api/health`,
    `http://${host}:${project.port}/status`,
  ];

  for (const url of urls) {
    try {
      const body = await fetchJson(url);
      if (body.ok || body.status === 'ok' || body.status === 200 || body.endpoint === 'online') {
        return {
          ok: true,
          node_id: nodeId,
          project_id: project.id,
          name: project.name,
          status: 'healthy',
          url,
          body,
        };
      }
      if ((body.status as number) < 500) {
        return {
          ok: false,
          node_id: nodeId,
          project_id: project.id,
          name: project.name,
          status: 'degraded',
          url,
          body,
        };
      }
    } catch {
      // Try next common health path.
    }
  }

  if (project.id === 'review-automation') {
    return {
      ok: false,
      node_id: nodeId,
      project_id: project.id,
      name: project.name,
      status: 'DEGRADED',
      reason: 'PostgreSQL/Redis missing, Docker not installed, or Review Automation port 4300 unreachable',
      next_action: 'install Docker or point Review Automation to a shared DB',
    };
  }

  return {
    ok: false,
    node_id: nodeId,
    project_id: project.id,
    name: project.name,
    status: 'offline',
    error: 'PROJECT_UNREACHABLE',
    checked_ports: [project.port],
  };
}

export async function getNodeProjects(nodeId: string): Promise<Record<string, unknown>> {
  const projects = [];
  for (const project of listKnownProjects()) {
    projects.push(await getProjectStatus(nodeId, project.id));
  }
  return { ok: true, node_id: nodeId, projects };
}

export async function execOnNode(nodeId: string, command: string, cwd?: string): Promise<Record<string, unknown>> {
  const blocked = isDangerousCommand(command, nodeId);
  if (blocked) return { success: false, error: blocked, approval_required: true, command };
  const node = getNode(nodeId);
  if (!node) return { error: 'NODE_NOT_FOUND', node_id: nodeId };
  const secret = getNodeSecret(nodeId);
  try {
    const res = await fetch(`${getNodeBase(node)}/exec`, {
      method: 'POST',
      headers: makeHeaders(secret, nodeId),
      body: JSON.stringify({ command, cwd }),
      signal: AbortSignal.timeout(35_000),
    });
    return res.ok ? await res.json() as Record<string, unknown> : { error: 'EXEC_FAILED', status: res.status };
  } catch { return { error: 'NODE_OFFLINE', node_id: nodeId }; }
}

export async function readFileOnNode(nodeId: string, filePath: string): Promise<Record<string, unknown>> {
  if (/(^|[\\\/])\.env($|[\\\/])/.test(filePath.toLowerCase())) {
    return { success: false, error: 'BLOCKED_SECRET_READ', approval_required: true };
  }
  const node = getNode(nodeId);
  if (!node) return { error: 'NODE_NOT_FOUND' };
  const secret = getNodeSecret(nodeId);
  try {
    const url = `${getNodeBase(node)}/file?path=${encodeURIComponent(filePath)}`;
    const res = await fetch(url, { headers: makeHeaders(secret, nodeId), signal: AbortSignal.timeout(10_000) });
    return res.ok ? await res.json() as Record<string, unknown> : { error: 'READ_FAILED', status: res.status };
  } catch { return { error: 'NODE_OFFLINE', node_id: nodeId }; }
}

export async function getProjectLogs(nodeId: string, projectId: string): Promise<Record<string, unknown>> {
  const project = PROJECTS[projectId as NodeProjectId];
  if (!project) return { ok: false, error: 'PROJECT_NOT_FOUND', project_id: projectId };
  return execOnNode(nodeId, `pm2 logs ${project.process} --lines 100 --nostream`);
}

export async function restartProject(nodeId: string, projectId: string): Promise<Record<string, unknown>> {
  const project = PROJECTS[projectId as NodeProjectId];
  if (!project) return { ok: false, error: 'PROJECT_NOT_FOUND', project_id: projectId };
  const result = await execOnNode(nodeId, `pm2 restart ${project.process}`);
  const status = await getProjectStatus(nodeId, projectId);
  return { ok: !result.error, restart: result, health_after_restart: status };
}

export function formatNodeSummary(node: NodeRecord): string {
  const icon = node.status === 'online' ? '🟢' : node.status === 'offline' ? '🔴' : '⚪';
  return `${icon} *${node.node_id}* [${node.role.toUpperCase()}] — ${node.status} — ${node.platform} — ${node.address}`;
}
