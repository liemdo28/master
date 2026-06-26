type Release = () => void;

interface Waiter {
  resolve: (release: Release) => void;
  enqueuedAt: number;
}

interface SlotState {
  active: number;
  queued: Waiter[];
  limit: number;
  maxObservedActive: number;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Enforces upstream concurrency per quota source.
 *
 * Default is intentionally 1 because OpusMax/NKQ reject parallel Cline work
 * with provider-side concurrency errors. Queuing here prevents retry storms
 * before traffic reaches the supplier.
 */
class ConcurrencyLimiter {
  private readonly states = new Map<string, SlotState>();
  private readonly defaultLimit = envInt('GATEWAY_SOURCE_CONCURRENCY_LIMIT', envInt('SOURCE_CONCURRENCY_LIMIT', 1));

  async acquire(sourceId: string, limit = this.defaultLimit): Promise<Release> {
    const state = this.state(sourceId, limit);
    state.limit = limit;

    if (state.active < state.limit) {
      return this.activate(sourceId, state);
    }

    return new Promise<Release>((resolve) => {
      state.queued.push({ resolve, enqueuedAt: Date.now() });
    });
  }

  getActive(sourceId: string): number {
    return this.states.get(sourceId)?.active ?? 0;
  }

  getQueued(sourceId: string): number {
    return this.states.get(sourceId)?.queued.length ?? 0;
  }

  getLimit(sourceId: string): number {
    return this.states.get(sourceId)?.limit ?? this.defaultLimit;
  }

  getStats(): Array<{ sourceId: string; active: number; queued: number; limit: number; maxObservedActive: number }> {
    return Array.from(this.states.entries())
      .map(([sourceId, state]) => ({
        sourceId,
        active: state.active,
        queued: state.queued.length,
        limit: state.limit,
        maxObservedActive: state.maxObservedActive,
      }))
      .sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  }

  snapshotFor(sourceId: string): { active: number; queued: number; limit: number } {
    const state = this.states.get(sourceId);
    return {
      active: state?.active ?? 0,
      queued: state?.queued.length ?? 0,
      limit: state?.limit ?? this.defaultLimit,
    };
  }

  private state(sourceId: string, limit: number): SlotState {
    let state = this.states.get(sourceId);
    if (!state) {
      state = { active: 0, queued: [], limit, maxObservedActive: 0 };
      this.states.set(sourceId, state);
    }
    return state;
  }

  private activate(sourceId: string, state: SlotState): Release {
    state.active++;
    state.maxObservedActive = Math.max(state.maxObservedActive, state.active);
    let released = false;

    return () => {
      if (released) return;
      released = true;
      const current = this.states.get(sourceId);
      if (!current) return;
      current.active = Math.max(0, current.active - 1);
      this.pump(sourceId, current);
    };
  }

  private pump(sourceId: string, state: SlotState): void {
    while (state.active < state.limit && state.queued.length > 0) {
      const waiter = state.queued.shift();
      if (!waiter) return;
      waiter.resolve(this.activate(sourceId, state));
    }

    if (state.active === 0 && state.queued.length === 0) {
      this.states.delete(sourceId);
    }
  }
}

export const concurrencyLimiter = new ConcurrencyLimiter();
