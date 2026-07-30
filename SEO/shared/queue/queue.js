/**
 * File-backed FIFO task queue per-agent. Tasks live in shared/queue/<agent>.json.
 * Mi-Core or any agent can enqueue; the owning agent dequeues and processes.
 */
const fs = require('fs');
const path = require('path');

const QUEUE_DIR = __dirname;

function file(agentId) {
  return path.join(QUEUE_DIR, `${agentId}.json`);
}

function _read(agentId) {
  const p = file(agentId);
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}

function _write(agentId, arr) {
  fs.writeFileSync(file(agentId), JSON.stringify(arr, null, 2));
}

function enqueue(agentId, task) {
  const arr = _read(agentId);
  const t = {
    id: task.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    enqueued_at: new Date().toISOString(),
    status: 'pending',
    ...task,
  };
  arr.push(t);
  _write(agentId, arr);
  return t;
}

function dequeue(agentId) {
  const arr = _read(agentId);
  const idx = arr.findIndex((t) => t.status === 'pending');
  if (idx < 0) return null;
  const t = arr[idx];
  t.status = 'in_progress';
  t.started_at = new Date().toISOString();
  _write(agentId, arr);
  return t;
}

function complete(agentId, taskId, result) {
  const arr = _read(agentId);
  const t = arr.find((x) => x.id === taskId);
  if (!t) return null;
  t.status = 'done';
  t.completed_at = new Date().toISOString();
  t.result = result || null;
  _write(agentId, arr);
  return t;
}

function list(agentId) { return _read(agentId); }

module.exports = { enqueue, dequeue, complete, list, QUEUE_DIR };
