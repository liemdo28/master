"use strict";
/**
 * Asana Connector — tasks, projects, teams, goals via Asana REST API.
 * Requires ASANA_TOKEN in .env.
 * Caches to .local-agent-global/visibility/asana/
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncAsana = syncAsana;
exports.getCachedAsana = getCachedAsana;
exports.getTasksForPerson = getTasksForPerson;
exports.getOverdueTasks = getOverdueTasks;
exports.isAsanaConfigured = isAsanaConfigured;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ASANA_TOKEN = process.env.ASANA_TOKEN;
const BASE_URL = 'https://app.asana.com/api/1.0';
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CACHE_DIR = path_1.default.join(GLOBAL_DIR, 'visibility', 'asana');
function isConfigured() { return !!ASANA_TOKEN; }
async function asanaFetch(endpoint) {
    if (!isConfigured())
        throw new Error('ASANA_TOKEN not set in .env');
    const res = await fetch(`${BASE_URL}${endpoint}`, {
        headers: {
            Authorization: `Bearer ${ASANA_TOKEN}`,
            Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok)
        throw new Error(`Asana API error ${res.status}: ${await res.text()}`);
    return res.json();
}
async function getWorkspace() {
    const data = await asanaFetch('/workspaces');
    return data.data[0];
}
async function getMyTasks(workspaceGid) {
    const me = await asanaFetch('/users/me');
    const res = await asanaFetch(`/tasks?assignee=me&workspace=${workspaceGid}&completed_since=now&opt_fields=name,completed,due_on,notes,projects,created_at,modified_at,assignee`);
    const now = new Date();
    return (res.data || []).map(t => ({
        id: t['gid'],
        name: t['name'],
        completed: t['completed'],
        due_on: t['due_on'],
        assignee: t['assignee']?.name || 'me',
        projects: (t['projects'] || []).map(p => p.name),
        notes: t['notes']?.slice(0, 200),
        is_overdue: !!(t['due_on'] && new Date(t['due_on']) < now && !t['completed']),
        created_at: t['created_at'],
        modified_at: t['modified_at'],
    }));
}
async function getProjects(workspaceGid) {
    const res = await asanaFetch(`/projects?workspace=${workspaceGid}&opt_fields=name,team,current_status_update,due_date,completed`);
    return (res.data || []).map(p => ({
        id: p['gid'],
        name: p['name'],
        team: p['team']?.name || '',
        status: p['current_status_update']?.status_type,
        due_date: p['due_date'],
        completed: p['completed'],
    }));
}
async function getProjectTasks(projectGid, limit = 30) {
    const res = await asanaFetch(`/tasks?project=${projectGid}&opt_fields=name,completed,due_on,assignee,notes,modified_at,created_at&limit=${limit}`);
    const now = new Date();
    return (res.data || []).map(t => ({
        id: t['gid'],
        name: t['name'],
        completed: t['completed'],
        due_on: t['due_on'],
        assignee: t['assignee']?.name,
        projects: [projectGid],
        is_overdue: !!(t['due_on'] && new Date(t['due_on']) < now && !t['completed']),
        created_at: t['created_at'],
        modified_at: t['modified_at'],
    }));
}
async function syncAsana() {
    const ws = await getWorkspace();
    const [myTasks, projects] = await Promise.all([
        getMyTasks(ws.gid),
        getProjects(ws.gid),
    ]);
    // Get tasks for first 5 projects (avoid rate limit)
    const projectTasks = [];
    for (const proj of projects.slice(0, 5)) {
        try {
            const tasks = await getProjectTasks(proj.id, 20);
            for (const t of tasks) {
                t.projects = [proj.name];
            }
            projectTasks.push(...tasks);
        }
        catch { /* skip */ }
    }
    const allTasks = [...myTasks, ...projectTasks.filter(t => !myTasks.find(m => m.id === t.id))];
    const overdue = allTasks.filter(t => t.is_overdue);
    // Group by assignee
    const byAssignee = {};
    for (const t of allTasks) {
        const a = t.assignee || 'Unassigned';
        if (!byAssignee[a])
            byAssignee[a] = [];
        byAssignee[a].push(t);
    }
    const snapshot = {
        synced_at: new Date().toISOString(),
        workspace_name: ws.name,
        my_tasks: myTasks,
        overdue_tasks: overdue,
        projects,
        tasks_by_assignee: byAssignee,
    };
    fs_1.default.mkdirSync(CACHE_DIR, { recursive: true });
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'data.json'), JSON.stringify(snapshot, null, 2));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'summary.json'), JSON.stringify({
        my_tasks: myTasks.length, overdue: overdue.length, projects: projects.length,
        synced_at: snapshot.synced_at,
    }, null, 2));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'last_sync.json'), JSON.stringify({ synced_at: snapshot.synced_at }));
    fs_1.default.writeFileSync(path_1.default.join(CACHE_DIR, 'errors.json'), JSON.stringify([]));
    return snapshot;
}
function getCachedAsana() {
    try {
        return JSON.parse(fs_1.default.readFileSync(path_1.default.join(CACHE_DIR, 'data.json'), 'utf-8'));
    }
    catch {
        return null;
    }
}
function getTasksForPerson(name) {
    const cached = getCachedAsana();
    if (!cached)
        return [];
    const q = name.toLowerCase();
    return Object.entries(cached.tasks_by_assignee)
        .filter(([assignee]) => assignee.toLowerCase().includes(q))
        .flatMap(([, tasks]) => tasks)
        .filter(t => !t.completed);
}
function getOverdueTasks() {
    return getCachedAsana()?.overdue_tasks || [];
}
function isAsanaConfigured() { return isConfigured(); }
