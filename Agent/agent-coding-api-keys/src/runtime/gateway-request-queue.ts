type Release = () => void;

interface QueueWaiter {
  id: string;
  protocol: string;
  resolve: (release: Release) => void;
  reject: (error: Error) => void;
  enqueuedAt: number;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

class GatewayRequestQueue {
  private active = 0;
  private paused = false;
  private readonly queue: QueueWaiter[] = [];
  readonly limit = envInt('GATEWAY_MAX_CONCURRENT_REQUESTS', envInt('CLINE_SAFE_MAX_CONCURRENT_REQUESTS', 1));

  async acquire(id: string, protocol: string, signal?: AbortSignal): Promise<Release> {
    if (this.paused) {
      throw Object.assign(new Error('gateway drain active: new AI requests are paused'), { code: 'GATEWAY_DRAINING' });
    }
    if (signal?.aborted) {
      throw Object.assign(new Error('client disconnected while waiting for gateway queue'), { code: 'CLIENT_DISCONNECTED' });
    }

    if (this.active < this.limit) {
      return this.activate();
    }

    return new Promise<Release>((resolve, reject) => {
      const waiter: QueueWaiter = { id, protocol, resolve, reject, enqueuedAt: Date.now() };
      const onAbort = () => {
        const idx = this.queue.indexOf(waiter);
        if (idx >= 0) this.queue.splice(idx, 1);
        reject(Object.assign(new Error('client disconnected while waiting for gateway queue'), { code: 'CLIENT_DISCONNECTED' }));
      };
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      waiter.resolve = (release) => {
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve(release);
      };
      this.queue.push(waiter);
    });
  }

  drain(): { paused: boolean; active_requests: number; queued_requests: number; concurrency_limit: number; queued: Array<{ id: string; protocol: string; wait_ms: number }> } {
    this.paused = true;
    return this.snapshot();
  }

  resume(): { paused: boolean; active_requests: number; queued_requests: number } {
    this.paused = false;
    this.pump();
    return this.snapshot();
  }

  snapshot(): { paused: boolean; active_requests: number; queued_requests: number; concurrency_limit: number; queued: Array<{ id: string; protocol: string; wait_ms: number }> } {
    const now = Date.now();
    return {
      paused: this.paused,
      active_requests: this.active,
      queued_requests: this.queue.length,
      concurrency_limit: this.limit,
      queued: this.queue.map((item) => ({
        id: item.id,
        protocol: item.protocol,
        wait_ms: Math.max(0, now - item.enqueuedAt),
      })),
    };
  }

  private activate(): Release {
    this.active++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active = Math.max(0, this.active - 1);
      this.pump();
    };
  }

  private pump(): void {
    while (this.active < this.limit && this.queue.length > 0) {
      const waiter = this.queue.shift();
      if (!waiter) return;
      waiter.resolve(this.activate());
    }
  }
}

export const gatewayRequestQueue = new GatewayRequestQueue();
