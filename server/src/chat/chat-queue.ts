/**
 * Chat request queue — concurrency control and backpressure for the AI chat layer.
 *
 * Limits:
 *   - MAX_CONCURRENT: 3 simultaneous AI calls to Ollama
 *   - MAX_QUEUED:    20 waiting requests (beyond this → 503)
 *   - REQUEST_TIMEOUT_MS: 90s per request (queue wait + AI call combined)
 */

import { chatMetrics } from './chat-metrics';

const MAX_CONCURRENT = 3;
const MAX_QUEUED = 20;
const REQUEST_TIMEOUT_MS = 90_000;

let active = 0;
const waiting: Array<() => void> = [];

function tryDrain() {
  while (active < MAX_CONCURRENT && waiting.length > 0) {
    const next = waiting.shift()!;
    active++;
    next();
  }
}

/**
 * Enqueue a chat request. Returns a promise that resolves when the slot is
 * acquired and the work function completes. Rejects if:
 *   - Queue is full (>MAX_QUEUED waiting)
 *   - Total wait+run time exceeds REQUEST_TIMEOUT_MS
 */
export async function enqueueChat<T>(work: () => Promise<T>): Promise<T> {
  if (waiting.length >= MAX_QUEUED) {
    chatMetrics.reqQueueRejected();
    throw new ChatQueueFullError(`Chat queue full (${MAX_QUEUED} requests waiting)`);
  }

  chatMetrics.queueEnter();

  return new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    function cleanup() {
      if (timer) { clearTimeout(timer); timer = null; }
      chatMetrics.queueLeave();
    }

    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      // Remove from waiting queue if still there
      const idx = waiting.indexOf(proceed);
      if (idx !== -1) waiting.splice(idx, 1);
      else active = Math.max(0, active - 1); // was running, forcibly release slot
      tryDrain();
      reject(new ChatTimeoutError('Chat request timed out after 90s (queue + AI call)'));
    }, REQUEST_TIMEOUT_MS);

    function proceed() {
      chatMetrics.queueLeave();
      // Don't call queueEnter/Leave twice — we already called queueEnter above.
      // Re-add for "active" tracking via chatMetrics (active_requests tracked in chat.ts).
      work().then(
        (result) => {
          if (settled) return;
          settled = true;
          if (timer) { clearTimeout(timer); timer = null; }
          active = Math.max(0, active - 1);
          tryDrain();
          resolve(result);
        },
        (err) => {
          if (settled) return;
          settled = true;
          if (timer) { clearTimeout(timer); timer = null; }
          active = Math.max(0, active - 1);
          tryDrain();
          reject(err);
        },
      );
    }

    if (active < MAX_CONCURRENT) {
      active++;
      proceed();
    } else {
      waiting.push(proceed);
    }
  });
}

export class ChatQueueFullError extends Error {
  readonly code = 'QUEUE_FULL';
  constructor(msg: string) { super(msg); this.name = 'ChatQueueFullError'; }
}

export class ChatTimeoutError extends Error {
  readonly code = 'CHAT_TIMEOUT';
  constructor(msg: string) { super(msg); this.name = 'ChatTimeoutError'; }
}

/** Current queue state — for metrics and health checks. */
export function queueState() {
  return { active, waiting: waiting.length, max_concurrent: MAX_CONCURRENT, max_queued: MAX_QUEUED };
}
