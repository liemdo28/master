/**
 * Asana Connector — tasks, projects, teams, goals via Asana REST API.
 * Requires ASANA_TOKEN in .env.
 * Caches to .local-agent-global/visibility/asana/
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://app.asana.com/api/1.0';
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CACHE_DIR = path.join(GLOBAL_DIR, 'visibility', 'asana');

export interface AsanaTask {
  id: string;
  name: string;
  completed: boolean;
  due_on?: string;
  assignee?: string;
  projects: string[];
  notes?: string;
  is_overdue: boolean;
  overdue_days: number;
  created_at: string;
  modified_at: string;
}

export interface AsanaProject {
  id: string;
  name: string;
  team: string;
  status?: string;
  due_date?: string;
  completed: boolean;
}

export interface AsanaSnapshot {
  synced_at: string;
  workspace_name: string;
  my_tasks: AsanaTask[];
  overdue_tasks: AsanaTask[];
  projects: AsanaProject[];
  tasks_by_assignee: Record<string, AsanaTask[]>;
}

function isConfigured(): boolean { return !!process.env.ASANA_TOKEN; }

function toStartOfDay(value: Date | string): Date {
  const d = typeof value === 'string' ? new Date(value) : new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getOverdueDays(dueOn?: string, completed = false, now = new Date()): number {
  if (!dueOn || completed) return 0;
  const due = toStartOfDay(dueOn);
  const today = toStartOfDay(now);
  const diffMs = today.getTime() - due.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / 86400000);
}

async function asanaFetch(endpoint: string): Promise<unknown> {
  if (!isConfigured()) throw new Error('ASANA_TOKEN not set in .env');
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${process.env.ASANA_TOKEN}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Asana API error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function getWorkspace(): Promise<{ gid: string; name: string }> {
  const data = await asanaFetch('/workspaces') as { data: Array<{ gid: string; name: string }> };
  return data.data[0];
}

async function getMyTasks(workspaceGid: string): Promise<AsanaTask[]> {
  const me = await asanaFetch('/users/me') as { data: { gid: string } };
  const res = await asanaFetch(
    `/tasks?assignee=me&workspace=${workspaceGid}&completed_since=now&opt_fields=name,completed,due_on,notes,projects,created_at,modified_at,assignee`
  ) as { data: Array<Record<string, unknown>> };

  const now = new Date();
  return (res.data || []).map(t => {
    const completed = !!t['completed'];
    const due_on = t['due_on'] as string | undefined;
    const overdue_days = getOverdueDays(due_on, completed, now);
    return {
    id: t['gid'] as string,
    name: t['name'] as string,
    completed,
    due_on,
    assignee: (t['assignee'] as Record<string, string>)?.name || 'me',
    projects: ((t['projects'] as Array<{ name: string }>) || []).map(p => p.name),
    notes: (t['notes'] as string)?.slice(0, 200),
    is_overdue: overdue_days > 0,
    overdue_days,
    created_at: t['created_at'] as string,
    modified_at: t['modified_at'] as string,
  };
  });
}

async function getProjects(workspaceGid: string): Promise<AsanaProject[]> {
  const res = await asanaFetch(
    `/projects?workspace=${workspaceGid}&opt_fields=name,team,current_status_update,due_date,completed`
  ) as { data: Array<Record<string, unknown>> };

  return (res.data || []).map(p => ({
    id: p['gid'] as string,
    name: p['name'] as string,
    team: (p['team'] as Record<string, string>)?.name || '',
    status: (p['current_status_update'] as Record<string, string>)?.status_type,
    due_date: p['due_date'] as string | undefined,
    completed: p['completed'] as boolean,
  }));
}

async function getProjectTasks(projectGid: string, limit = 30): Promise<AsanaTask[]> {
  const res = await asanaFetch(
    `/tasks?project=${projectGid}&opt_fields=name,completed,due_on,assignee,notes,modified_at,created_at&limit=${limit}`
  ) as { data: Array<Record<string, unknown>> };
  const now = new Date();
  return (res.data || []).map(t => {
    const completed = !!t['completed'];
    const due_on = t['due_on'] as string | undefined;
    const overdue_days = getOverdueDays(due_on, completed, now);
    return {
    id: t['gid'] as string,
    name: t['name'] as string,
    completed,
    due_on,
    assignee: (t['assignee'] as Record<string, string>)?.name,
    projects: [projectGid],
    is_overdue: overdue_days > 0,
    overdue_days,
    created_at: t['created_at'] as string,
    modified_at: t['modified_at'] as string,
  };
  });
}

export async function syncAsana(): Promise<AsanaSnapshot> {
  const ws = await getWorkspace();
  const [myTasks, projects] = await Promise.all([
    getMyTasks(ws.gid),
    getProjects(ws.gid),
  ]);

  // Get tasks for first 5 projects (avoid rate limit)
  const projectTasks: AsanaTask[] = [];
  for (const proj of projects.slice(0, 5)) {
    try {
      const tasks = await getProjectTasks(proj.id, 20);
      for (const t of tasks) { t.projects = [proj.name]; }
      projectTasks.push(...tasks);
    } catch { /* skip */ }
  }

  const allTasks = [...myTasks, ...projectTasks.filter(t => !myTasks.find(m => m.id === t.id))];
  const overdue = allTasks.filter(t => t.is_overdue && t.overdue_days > 7 && !t.completed);

  // Group by assignee
  const byAssignee: Record<string, AsanaTask[]> = {};
  for (const t of allTasks) {
    const a = t.assignee || 'Unassigned';
    if (!byAssignee[a]) byAssignee[a] = [];
    byAssignee[a].push(t);
  }

  const snapshot: AsanaSnapshot = {
    synced_at: new Date().toISOString(),
    workspace_name: ws.name,
    my_tasks: myTasks,
    overdue_tasks: overdue,
    projects,
    tasks_by_assignee: byAssignee,
  };

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, 'data.json'), JSON.stringify(snapshot, null, 2));
  fs.writeFileSync(path.join(CACHE_DIR, 'summary.json'), JSON.stringify({
    my_tasks: myTasks.length, overdue: overdue.length, projects: projects.length,
    synced_at: snapshot.synced_at,
  }, null, 2));
  fs.writeFileSync(path.join(CACHE_DIR, 'last_sync.json'), JSON.stringify({ synced_at: snapshot.synced_at }));
  fs.writeFileSync(path.join(CACHE_DIR, 'errors.json'), JSON.stringify([]));

  return snapshot;
}

export function getCachedAsana(): AsanaSnapshot | null {
  try { return JSON.parse(fs.readFileSync(path.join(CACHE_DIR, 'data.json'), 'utf-8')); }
  catch { return null; }
}

export function getTasksForPerson(name: string): AsanaTask[] {
  const cached = getCachedAsana();
  if (!cached) return [];
  const q = name.toLowerCase();
  return Object.entries(cached.tasks_by_assignee)
    .filter(([assignee]) => assignee.toLowerCase().includes(q))
    .flatMap(([, tasks]) => tasks)
    .filter(t => !t.completed);
}

export function getOverdueTasks(): AsanaTask[] {
  return getCachedAsana()?.overdue_tasks || [];
}

export function isAsanaConfigured(): boolean { return isConfigured(); }
