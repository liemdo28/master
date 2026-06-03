/**
 * Antigravity Gateway — Timeline / Event Store
 *
 * Append-only event log capturing every orchestration event:
 *  - Stream events
 *  - Tool events
 *  - Provider transitions
 *  - Retries and fallback hops
 *  - Memory pressure events
 *  - Cancellations
 *  - Session lifecycle events
 *  - Circuit breaker state changes
 *
 * Critical for:
 *  - Debugging agent orchestration
 *  - Session-level replay
 *  - Time-travel debugging
 *  - Distributed tracing
 */

import { randomUUID } from 'node:crypto';

export type TimelineEventType =
    | 'session.created'
    | 'session.resumed'
    | 'session.suspended'
    | 'session.completed'
    | 'session.crashed'
    | 'request.start'
    | 'request.complete'
    | 'request.error'
    | 'provider.selected'
    | 'provider.success'
    | 'provider.failure'
    | 'provider.fallback'
    | 'provider.recovered'
    | 'provider.circuit_open'
    | 'provider.circuit_close'
    | 'provider.quota_low'
    | 'provider.quota_exhausted'
    | 'provider.priority_switch'
    | 'quota.batch_switch'
    | 'quota.batch_started'
    | 'quota.batch_completed'
    | 'quota.provider_switched'
    | 'quota.window_started'
    | 'quota.window_reset'
    | 'quota.provider_exhausted'
    | 'quota.rotation_skipped'
    | 'quota.provider_degraded'
    | 'quota.state_reset'
    | 'stream.start'
    | 'stream.chunk'
    | 'stream.complete'
    | 'stream.error'
    | 'stream.cancelled'
    | 'stream.orphaned'
    | 'tool.use'
    | 'tool.result'
    | 'tool.error'
    | 'tool.chain_start'
    | 'tool.chain_complete'
    | 'reasoning.start'
    | 'reasoning.complete'
    | 'retry.attempt'
    | 'retry.success'
    | 'retry.exhausted'
    | 'fallback.triggered'
    | 'fallback.success'
    | 'fallback.exhausted'
    | 'memory.pressure'
    | 'memory.critical'
    | 'cancellation.requested'
    | 'cancellation.propagated'
    | 'checkpoint.created'
    | 'checkpoint.restored'
    | 'provider.manual_switch'
    | 'provider.auto_suggest'
    | 'provider.activated'
    | 'provider.deactivated';

export interface TimelineEvent {
    id: string;
    sessionId: string | null;
    requestId: string | null;
    timestamp: number;
    type: TimelineEventType;
    source: string;
    payload: Record<string, unknown>;
    durationMs?: number;
    parentEventId?: string;
}

export interface TimelineQuery {
    sessionId?: string;
    requestId?: string;
    type?: TimelineEventType | TimelineEventType[];
    source?: string;
    after?: number;
    before?: number;
    limit?: number;
}

export interface TimelineStats {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySource: Record<string, number>;
    eventsPerMinute: number;
    oldestEventAt: number | null;
    newestEventAt: number | null;
}

const MAX_EVENTS = 50_000;
const PRUNE_BATCH = 10_000;

class Timeline {
    private events: TimelineEvent[] = [];

    /** Emit a new timeline event. */
    emit(event: Omit<TimelineEvent, 'id' | 'timestamp'>): TimelineEvent {
        const entry: TimelineEvent = {
            ...event,
            id: `evt_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
            timestamp: Date.now(),
        };

        this.events.push(entry);

        // Prune if over limit
        if (this.events.length > MAX_EVENTS) {
            this.events.splice(0, PRUNE_BATCH);
        }

        return entry;
    }

    /** Query events with filters. */
    query(q: TimelineQuery): TimelineEvent[] {
        let results = this.events;

        if (q.sessionId) {
            results = results.filter((e) => e.sessionId === q.sessionId);
        }
        if (q.requestId) {
            results = results.filter((e) => e.requestId === q.requestId);
        }
        if (q.type) {
            const types = Array.isArray(q.type) ? q.type : [q.type];
            results = results.filter((e) => types.includes(e.type));
        }
        if (q.source) {
            results = results.filter((e) => e.source === q.source);
        }
        if (q.after) {
            results = results.filter((e) => e.timestamp > q.after!);
        }
        if (q.before) {
            results = results.filter((e) => e.timestamp < q.before!);
        }

        const limit = q.limit ?? 100;
        return results.slice(-limit);
    }

    /** Get the full timeline for a session (chronological). */
    getSessionTimeline(sessionId: string): TimelineEvent[] {
        return this.events.filter((e) => e.sessionId === sessionId);
    }

    /** Get the full timeline for a request. */
    getRequestTimeline(requestId: string): TimelineEvent[] {
        return this.events.filter((e) => e.requestId === requestId);
    }

    /** Get recent events (most recent first). */
    getRecent(count = 50): TimelineEvent[] {
        return this.events.slice(-count).reverse();
    }

    /** Get timeline statistics. */
    getStats(): TimelineStats {
        const eventsByType: Record<string, number> = {};
        const eventsBySource: Record<string, number> = {};

        for (const e of this.events) {
            eventsByType[e.type] = (eventsByType[e.type] ?? 0) + 1;
            eventsBySource[e.source] = (eventsBySource[e.source] ?? 0) + 1;
        }

        const now = Date.now();
        const oneMinuteAgo = now - 60_000;
        const eventsPerMinute = this.events.filter((e) => e.timestamp > oneMinuteAgo).length;

        return {
            totalEvents: this.events.length,
            eventsByType,
            eventsBySource,
            eventsPerMinute,
            oldestEventAt: this.events.length > 0 ? this.events[0]!.timestamp : null,
            newestEventAt: this.events.length > 0 ? this.events[this.events.length - 1]!.timestamp : null,
        };
    }

    /** Get event count. */
    get size(): number {
        return this.events.length;
    }

    /** Clear all events. */
    clear(): void {
        this.events.length = 0;
    }
}

/** Singleton timeline instance. */
export const timeline = new Timeline();
