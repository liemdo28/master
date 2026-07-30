/**
 * Project Registry — tracks which projects run on which nodes.
 * Supports the leader lock for integration-system.
 */

export interface ProjectRecord {
  project_id: string;
  node_id: string;
  role: 'active' | 'passive';
  status: 'running' | 'stopped' | 'unknown';
  started_at?: string;
  last_heartbeat?: string;
}

const PROJECTS = new Map<string, ProjectRecord[]>();

export function registerProject(project_id: string, node_id: string, role: 'active' | 'passive'): ProjectRecord {
  const record: ProjectRecord = {
    project_id, node_id, role, status: 'running', started_at: new Date().toISOString(),
  };
  const existing = PROJECTS.get(project_id) || [];
  const idx = existing.findIndex(p => p.node_id === node_id);
  if (idx >= 0) existing[idx] = record; else existing.push(record);
  PROJECTS.set(project_id, existing);
  return record;
}

export function getProjectNodes(project_id: string): ProjectRecord[] {
  return PROJECTS.get(project_id) || [];
}

export function getActiveNode(project_id: string): ProjectRecord | null {
  return getProjectNodes(project_id).find(p => p.role === 'active' && p.status === 'running') || null;
}

export function getAllProjects(): { project_id: string; nodes: ProjectRecord[] }[] {
  return Array.from(PROJECTS.entries()).map(([project_id, nodes]) => ({ project_id, nodes }));
}
