/**
 * Mi ↔ n8n Control Service
 * Wraps n8n REST API for use by mi-core departments
 *
 * APIs:
 *   listWorkflows()
 *   triggerWorkflow(workflowId, data?)
 *   getExecution(executionId)
 *   getExecutionLogs(executionId)
 *   stopExecution(executionId)
 */

'use strict';

const N8N_BASE_URL = process.env.N8N_URL || 'http://localhost:5678';
const N8N_API_KEY  = process.env.N8N_API_KEY || '';
const N8N_USER     = process.env.N8N_USER || 'mi-admin';
const N8N_PASS     = process.env.N8N_PASS || 'mi-n8n-secure-2025';

function authHeaders() {
  if (N8N_API_KEY) {
    return { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' };
  }
  const b64 = Buffer.from(`${N8N_USER}:${N8N_PASS}`).toString('base64');
  return { 'Authorization': `Basic ${b64}`, 'Content-Type': 'application/json' };
}

async function apiGet(path) {
  const res = await fetch(`${N8N_BASE_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`n8n GET ${path} → ${res.status}`);
  return res.json();
}

async function apiPost(path, body = {}) {
  const res = await fetch(`${N8N_BASE_URL}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`n8n POST ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(`${N8N_BASE_URL}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`n8n DELETE ${path} → ${res.status}`);
  return res.json();
}

/**
 * List all workflows registered in n8n
 */
async function listWorkflows() {
  const data = await apiGet('/api/v1/workflows');
  return (data.data || []).map(w => ({
    id: w.id,
    name: w.name,
    active: w.active,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
    tags: (w.tags || []).map(t => t.name),
  }));
}

/**
 * Trigger a workflow by ID, optionally passing data payload
 */
async function triggerWorkflow(workflowId, data = {}) {
  const startedAt = Date.now();
  // n8n webhook trigger — workflow must have a webhook node named 'mi-trigger'
  const webhookPath = `/webhook/${workflowId}`;
  let res;
  try {
    const httpRes = await fetch(`${N8N_BASE_URL}${webhookPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'mi-core', ...data }),
    });
    res = await httpRes.json().catch(() => ({}));
  } catch {
    // Fall back to execution API
    res = await apiPost(`/api/v1/workflows/${workflowId}/run`, { data });
  }
  return {
    workflow_id: workflowId,
    triggered_at: new Date().toISOString(),
    duration_ms: Date.now() - startedAt,
    result: res,
  };
}

/**
 * Get a specific execution by ID
 */
async function getExecution(executionId) {
  const data = await apiGet(`/api/v1/executions/${executionId}`);
  return {
    id: data.id,
    workflow_id: data.workflowId,
    status: data.status,
    started_at: data.startedAt,
    finished_at: data.stoppedAt,
    mode: data.mode,
  };
}

/**
 * Get execution logs (node output data)
 */
async function getExecutionLogs(executionId) {
  const data = await apiGet(`/api/v1/executions/${executionId}`);
  const nodes = data.data?.resultData?.runData || {};
  return {
    execution_id: executionId,
    status: data.status,
    nodes: Object.entries(nodes).map(([name, runs]) => ({
      node: name,
      status: runs[0]?.error ? 'error' : 'success',
      items: runs[0]?.data?.main?.[0]?.length || 0,
      error: runs[0]?.error?.message,
    })),
  };
}

/**
 * Stop a running execution
 */
async function stopExecution(executionId) {
  return apiDelete(`/api/v1/executions/${executionId}`);
}

/**
 * Health check for n8n
 */
async function checkHealth() {
  try {
    const res = await fetch(`${N8N_BASE_URL}/healthz`);
    return { ok: res.ok, status: res.status, url: N8N_BASE_URL };
  } catch (e) {
    return { ok: false, error: e.message, url: N8N_BASE_URL };
  }
}

module.exports = { listWorkflows, triggerWorkflow, getExecution, getExecutionLogs, stopExecution, checkHealth };
