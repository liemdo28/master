/**
 * n8n Control Service — Phase 23B
 * Full programmatic control over n8n: list, trigger, monitor, collect evidence.
 */

const N8N_URL  = process.env.N8N_URL    || 'http://localhost:5678';
const N8N_KEY  = process.env.N8N_API_KEY || '';
const BASE     = `${N8N_URL}/api/v1`;

interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface N8nExecution {
  id: string;
  workflowId: string;
  status: 'success' | 'error' | 'waiting' | 'running' | 'canceled';
  startedAt: string;
  stoppedAt?: string;
  finished: boolean;
}

interface N8nControlResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

function headers() {
  return { 'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json' };
}

async function n8nFetch<T>(path: string, opts: RequestInit = {}): Promise<N8nControlResult<T>> {
  if (!N8N_KEY) return { ok: false, error: 'N8N_API_KEY not set in .env' };
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...opts,
      headers: { ...headers(), ...(opts.headers as Record<string, string> || {}) },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json() as T;
    return { ok: res.ok, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export const n8nControl = {
  async listWorkflows(): Promise<N8nControlResult<N8nWorkflow[]>> {
    const r = await n8nFetch<{ data: N8nWorkflow[]; nextCursor: string | null }>('/workflows?limit=100');
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, data: (r.data as { data: N8nWorkflow[] }).data };
  },

  async getWorkflow(id: string): Promise<N8nControlResult<N8nWorkflow>> {
    return n8nFetch<N8nWorkflow>(`/workflows/${id}`);
  },

  async triggerWorkflow(id: string, payload: Record<string, unknown> = {}): Promise<N8nControlResult<N8nExecution>> {
    return n8nFetch<N8nExecution>(`/workflows/${id}/run`, {
      method: 'POST',
      body: JSON.stringify({ workflowData: payload }),
    });
  },

  async getExecution(id: string): Promise<N8nControlResult<N8nExecution>> {
    return n8nFetch<N8nExecution>(`/executions/${id}`);
  },

  async getExecutionLogs(id: string): Promise<N8nControlResult<N8nExecution>> {
    return n8nFetch<N8nExecution>(`/executions/${id}?includeData=true`);
  },

  async listExecutions(workflowId?: string, limit = 20): Promise<N8nControlResult<N8nExecution[]>> {
    const q = workflowId ? `?workflowId=${workflowId}&limit=${limit}` : `?limit=${limit}`;
    const r = await n8nFetch<{ data: N8nExecution[] }>(`/executions${q}`);
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, data: (r.data as { data: N8nExecution[] }).data };
  },

  async stopExecution(id: string): Promise<N8nControlResult<void>> {
    return n8nFetch<void>(`/executions/${id}/stop`, { method: 'POST' });
  },

  async collectEvidence(executionId: string): Promise<N8nControlResult<{
    execution_id: string;
    workflow_id: string;
    status: string;
    started_at: string;
    stopped_at?: string;
    duration_ms?: number;
    collected_at: string;
  }>> {
    const r = await this.getExecutionLogs(executionId);
    if (!r.ok || !r.data) return { ok: false, error: r.error || 'No data' };
    const exec = r.data as N8nExecution;
    const started = new Date(exec.startedAt).getTime();
    const stopped = exec.stoppedAt ? new Date(exec.stoppedAt).getTime() : undefined;
    return {
      ok: true,
      data: {
        execution_id: exec.id,
        workflow_id: exec.workflowId,
        status: exec.status,
        started_at: exec.startedAt,
        stopped_at: exec.stoppedAt,
        duration_ms: stopped ? stopped - started : undefined,
        collected_at: new Date().toISOString(),
      },
    };
  },

  async health(): Promise<{ ok: boolean; workflows: number; api_key_set: boolean; url: string }> {
    const api_key_set = !!N8N_KEY;
    if (!api_key_set) return { ok: false, workflows: 0, api_key_set: false, url: N8N_URL };
    const r = await this.listWorkflows();
    return {
      ok: r.ok,
      workflows: r.data?.length ?? 0,
      api_key_set,
      url: N8N_URL,
    };
  },
};
