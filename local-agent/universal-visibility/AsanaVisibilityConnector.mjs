/**
 * AsanaVisibilityConnector.mjs
 * Reads Asana task cache. Supports task search, person-based lookup, overdue check.
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CACHE_DIR  = path.join(GLOBAL_DIR, 'visibility', 'asana');

export class AsanaVisibilityConnector {
  constructor() {
    this.id = 'asana';
    this.name = 'Asana';
  }

  isConfigured() {
    return !!(process.env.ASANA_TOKEN);
  }

  getSnapshot() {
    if (!this.isConfigured()) {
      return {
        status: 'CONNECTOR_NOT_CONFIGURED',
        connector: 'asana',
        setup: 'Add ASANA_TOKEN to server/.env → get token at asana.com/0/my-apps → restart Mi',
        data: null,
      };
    }
    const cacheFile = path.join(CACHE_DIR, 'tasks_cache.json');
    if (!fs.existsSync(cacheFile)) {
      return { status: 'CACHE_EMPTY', connector: 'asana', message: 'Token set, waiting for first sync', data: null };
    }
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      return { status: 'ok', connector: 'asana', source: cacheFile, last_sync: data.synced_at, data };
    } catch (e) {
      return { status: 'error', connector: 'asana', error: e.message, data: null };
    }
  }

  /** Get all overdue tasks */
  getOverdueTasks() {
    const snap = this.getSnapshot();
    if (snap.status !== 'ok') return snap;
    const overdue = (snap.data.my_tasks || []).filter(t => t.is_overdue && !t.completed);
    return {
      status: 'ok',
      source: 'asana-cache',
      count: overdue.length,
      tasks: overdue.map(t => ({
        id: t.id,
        name: t.name,
        assignee: t.assignee,
        due_on: t.due_on,
        project: t.projects?.[0],
        overdue_days: t.due_on
          ? Math.floor((Date.now() - new Date(t.due_on).getTime()) / 86400000)
          : null,
      })),
    };
  }

  /** Get tasks assigned to a specific person */
  getTasksForPerson(personName) {
    const snap = this.getSnapshot();
    if (snap.status !== 'ok') return snap;
    const n = personName.toLowerCase();
    const tasks = (snap.data.all_tasks || snap.data.my_tasks || []).filter(t =>
      t.assignee?.toLowerCase().includes(n) && !t.completed
    );
    return {
      status: 'ok',
      source: 'asana-cache',
      person: personName,
      count: tasks.length,
      tasks: tasks.slice(0, 20),
    };
  }

  /** Get my (CEO's) tasks */
  getMyTasks(includeCompleted = false) {
    const snap = this.getSnapshot();
    if (snap.status !== 'ok') return snap;
    const tasks = (snap.data.my_tasks || []).filter(t => includeCompleted || !t.completed);
    return {
      status: 'ok',
      source: 'asana-cache',
      count: tasks.length,
      tasks: tasks.slice(0, 20),
    };
  }

  /** Search tasks by keyword */
  searchTasks(query) {
    const snap = this.getSnapshot();
    if (snap.status !== 'ok') return snap;
    const q = query.toLowerCase();
    const allTasks = [
      ...(snap.data.my_tasks || []),
      ...(snap.data.all_tasks || []),
    ];
    const seen = new Set();
    const matches = allTasks.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return (t.name?.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q));
    });
    return {
      status: 'ok',
      source: 'asana-cache',
      query,
      count: matches.length,
      tasks: matches.slice(0, 10),
    };
  }

  getSummaryText() {
    const snap = this.getSnapshot();
    if (snap.status === 'CONNECTOR_NOT_CONFIGURED') return `✅ Asana: Not configured — ${snap.setup}`;
    if (snap.status !== 'ok') return `✅ Asana: ${snap.status}`;
    const d = snap.data;
    const overdue = (d.my_tasks || []).filter(t => t.is_overdue && !t.completed).length;
    return `✅ Asana: ${d.my_tasks?.length ?? '?'} tasks${overdue > 0 ? `, ⚠️ ${overdue} overdue` : ''}`;
  }
}

export const asanaConnector = new AsanaVisibilityConnector();
