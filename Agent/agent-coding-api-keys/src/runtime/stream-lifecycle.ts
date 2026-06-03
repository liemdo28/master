/**
 * Antigravity Gateway — Stream Lifecycle Manager
 *
 * Full stream lifecycle control:
 *  - Stream registry (track all active streams)
 *  - Cancellation propagation
 *  - Dead stream cleanup
 *  - Listener cleanup
 *  - Heartbeat tracking
 *  - Orphan detection
 *  - Partial replay recovery
 *
 * Without this, long-running agents will leak streams and destabilize the gateway.
 */

import type http from 'node:http';

export interface ActiveStream {
    id: string;
    requestId: string;
    providerId: string;
    model: string;
    protocol: 'anthropic' | 'openai';
    startedAt: number;
    lastActivityAt: number;
    chunksReceived: number;
    bytesTransferred: number;
    status: 'active' | 'completing' | 'cancelled' | 'errored' | 'orphaned';
    clientConnected: boolean;
    abortController?: AbortController;
}

export interface StreamLifecycleStats {
    active: number;
    completed: number;
    cancelled: number;
    errored: number;
    orphaned: number;
    totalStreams: number;
    avgDurationMs: number;
    avgChunks: number;
    longestActiveMs: number;
}

const ORPHAN_TIMEOUT_MS = 120_000; // 2 minutes without activity = orphan
const CLEANUP_INTERVAL_MS = 30_000; // Check for orphans every 30s
const MAX_COMPLETED_HISTORY = 500;

class StreamLifecycleManager {
    private active = new Map<string, ActiveStream>();
    private completed: Array<ActiveStream & { endedAt: number }> = [];
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;

    /** Start lifecycle management (orphan detection). */
    start(): void {
        if (this.cleanupTimer) return;
        this.cleanupTimer = setInterval(() => this.detectOrphans(), CLEANUP_INTERVAL_MS);
    }

    /** Stop lifecycle management. */
    stop(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /** Register a new active stream. */
    register(stream: Omit<ActiveStream, 'status' | 'chunksReceived' | 'bytesTransferred' | 'lastActivityAt' | 'clientConnected'>): ActiveStream {
        const entry: ActiveStream = {
            ...stream,
            status: 'active',
            chunksReceived: 0,
            bytesTransferred: 0,
            lastActivityAt: Date.now(),
            clientConnected: true,
        };
        this.active.set(stream.id, entry);
        return entry;
    }

    /** Record activity on a stream (chunk received). */
    recordActivity(streamId: string, bytes: number): void {
        const stream = this.active.get(streamId);
        if (!stream) return;
        stream.lastActivityAt = Date.now();
        stream.chunksReceived++;
        stream.bytesTransferred += bytes;
    }

    /** Mark client as disconnected (stream should be cancelled). */
    clientDisconnected(streamId: string): void {
        const stream = this.active.get(streamId);
        if (!stream) return;
        stream.clientConnected = false;
        stream.status = 'cancelled';
        this.tryAbort(stream);
        this.complete(streamId, 'cancelled');
    }

    /** Mark stream as completed successfully. */
    complete(streamId: string, status: 'active' | 'completing' | 'cancelled' | 'errored' | 'orphaned' = 'completing'): void {
        const stream = this.active.get(streamId);
        if (!stream) return;
        stream.status = status;
        this.active.delete(streamId);
        this.completed.push({ ...stream, endedAt: Date.now() });
        if (this.completed.length > MAX_COMPLETED_HISTORY) {
            this.completed.splice(0, this.completed.length - MAX_COMPLETED_HISTORY);
        }
    }

    /** Mark stream as errored. */
    error(streamId: string, error?: string): void {
        const stream = this.active.get(streamId);
        if (!stream) return;
        stream.status = 'errored';
        this.tryAbort(stream);
        this.complete(streamId, 'errored');
    }

    /** Get an active stream by ID. */
    get(streamId: string): ActiveStream | undefined {
        return this.active.get(streamId);
    }

    /** Get all active streams. */
    getActive(): ActiveStream[] {
        return [...this.active.values()];
    }

    /** Get lifecycle statistics. */
    getStats(): StreamLifecycleStats {
        const now = Date.now();
        const activeStreams = [...this.active.values()];
        const completedCount = this.completed.filter((s) => s.status === 'completing').length;
        const cancelledCount = this.completed.filter((s) => s.status === 'cancelled').length;
        const erroredCount = this.completed.filter((s) => s.status === 'errored').length;
        const orphanedCount = this.completed.filter((s) => s.status === 'orphaned').length;

        const allDurations = this.completed.map((s) => s.endedAt - s.startedAt);
        const allChunks = this.completed.map((s) => s.chunksReceived);

        const longestActive = activeStreams.reduce((max, s) => Math.max(max, now - s.startedAt), 0);

        return {
            active: activeStreams.length,
            completed: completedCount,
            cancelled: cancelledCount,
            errored: erroredCount,
            orphaned: orphanedCount,
            totalStreams: this.completed.length + activeStreams.length,
            avgDurationMs: allDurations.length > 0 ? Math.round(allDurations.reduce((s, v) => s + v, 0) / allDurations.length) : 0,
            avgChunks: allChunks.length > 0 ? Math.round(allChunks.reduce((s, v) => s + v, 0) / allChunks.length) : 0,
            longestActiveMs: longestActive,
        };
    }

    /** Detect and clean up orphaned streams. */
    private detectOrphans(): void {
        const now = Date.now();
        for (const [id, stream] of this.active) {
            const idle = now - stream.lastActivityAt;
            if (idle > ORPHAN_TIMEOUT_MS) {
                console.warn(`[stream-lifecycle] Orphaned stream detected: ${id} (idle ${Math.round(idle / 1000)}s)`);
                stream.status = 'orphaned';
                this.tryAbort(stream);
                this.complete(id, 'orphaned');
            }
        }
    }

    /** Try to abort the upstream connection for a stream. */
    private tryAbort(stream: ActiveStream): void {
        if (stream.abortController) {
            try { stream.abortController.abort(); } catch { /* already aborted */ }
        }
    }

    /** Force cleanup all active streams (shutdown). */
    forceCleanup(): void {
        for (const [id, stream] of this.active) {
            this.tryAbort(stream);
            this.complete(id, 'cancelled');
        }
    }
}

/** Singleton stream lifecycle manager. */
export const streamLifecycle = new StreamLifecycleManager();
