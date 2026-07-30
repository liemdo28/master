import { spawn } from 'child_process';
import path from 'path';
import { enqueueJob } from '../queue/job-queue';

const BRIDGE_PATH = path.resolve(__dirname, '../../../local-agent/browser-agent/browser_bridge.py');
const PYTHON_BIN = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');

export type BrowserProvider = 'browser-use' | 'skyvern';

export interface BrowserTask {
  url: string;
  task: string;
  provider?: BrowserProvider;
  approval_id?: string;
  headless?: boolean;
}

function selectProvider(provider?: BrowserProvider, production = false): BrowserProvider {
  if (provider) return provider;
  return production ? 'skyvern' : 'browser-use';
}

function runBrowserUse(params: BrowserTask, timeoutMs = 60000): Promise<unknown> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON_BIN, [BRIDGE_PATH, JSON.stringify(params)], { timeout: timeoutMs });
    let out = '';
    let err = '';
    proc.stdout.on('data', (d: Buffer) => out += d.toString());
    proc.stderr.on('data', (d: Buffer) => err += d.toString());
    proc.on('close', (code: number) => {
      if (code !== 0) return resolve({ ok: false, error: err || `Exit ${code}` });
      try { resolve(JSON.parse(out)); }
      catch { resolve({ ok: false, error: `Invalid response: ${out.slice(0, 200)}` }); }
    });
    proc.on('error', (e: Error) => resolve({ ok: false, error: e.message }));
  });
}

async function runSkyvern(params: BrowserTask): Promise<unknown> {
  const baseUrl = process.env.SKYVERN_BASE_URL;
  const apiKey = process.env.SKYVERN_API_KEY;
  if (!baseUrl || !apiKey) {
    return enqueueJob({
      queue_name: 'browser',
      job_type: 'skyvern_workflow',
      payload_json: params as unknown as Record<string, unknown>,
      created_by: 'browser-router',
    });
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ url: params.url, navigation_goal: params.task }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Skyvern error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function runBrowserTask(params: BrowserTask, options: { write?: boolean; production?: boolean } = {}) {
  if (!params.url || !params.task) throw new Error('url and task required');
  if (options.write && !params.approval_id) throw new Error('approval_id required for browser write actions');

  const provider = selectProvider(params.provider, options.production);
  if (provider === 'skyvern') return runSkyvern({ ...params, provider });
  return runBrowserUse({ ...params, action: options.write ? 'write' : 'extract', headless: params.headless !== false } as BrowserTask & { action: string });
}

export const browserRouterBoundary = {
  runBrowserTask,
};
