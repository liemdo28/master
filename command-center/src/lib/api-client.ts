/** One typed API client for the whole app — no component calls fetch() directly.
 *  Talks only to /api/command-center/* (session-token gated, see PHASE5E_UI_COMPONENT_AUDIT.md
 *  for why this exists instead of the raw-x-api-key routes). */

const BASE = '/api/command-center';
const REMOTE_BASE = '/api/remote';
const DEFAULT_TIMEOUT_MS = 15_000;
const STORAGE_KEY = 'mi_cc_session';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export class UnauthorizedError extends ApiError {
  constructor() { super('Unauthorized', 401); this.name = 'UnauthorizedError'; }
}

let onUnauthorized: (() => void) | null = null;
/** Wired once from AuthProvider so a 401 anywhere locks the app, rather than each
 *  screen having to handle it individually. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

function getToken(): string | null {
  try { return sessionStorage.getItem(STORAGE_KEY); } catch { return null; }
}

/** Never echoes a raw provider/backend payload into a thrown message — only the
 *  backend's own already-sanitised `error` string, or a generic fallback. */
async function parseErrorBody(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === 'string') return body.error.slice(0, 300);
  } catch { /* not JSON */ }
  return `Request failed (${res.status})`;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
  /** GET requests are retried once on a network-level failure (not on any HTTP
   *  error status). Mutations are never retried automatically — retrying a POST
   *  without an idempotency key could double-create or double-approve something. */
  retry?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}, base: string = BASE): Promise<T> {
  const method = opts.method ?? 'GET';
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const canRetry = opts.retry ?? method === 'GET';

  const attempt = async (): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const token = getToken();
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
      if (res.status === 401) {
        onUnauthorized?.();
        throw new UnauthorizedError();
      }
      if (!res.ok) {
        throw new ApiError(await parseErrorBody(res), res.status);
      }
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await attempt();
  } catch (err) {
    if (canRetry && !(err instanceof ApiError)) {
      // one retry only, network/timeout errors only (ApiError means the server
      // responded — retrying an HTTP error is never useful here)
      return attempt();
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...opts, method: 'POST', body, retry: false }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...opts, method: 'PATCH', body, retry: false }),
  del: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...opts, method: 'DELETE', retry: false }),
};

/** The remote-auth module's own routes (/api/remote/*) — already session-token
 *  gated natively, no bridge needed. Used only by Settings for devices/sessions/audit. */
export const apiRemote = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...opts, method: 'GET' }, REMOTE_BASE),
  del: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...opts, method: 'DELETE', retry: false }, REMOTE_BASE),
};
