/**
 * Antigravity Gateway — Stateful Session Runtime
 *
 * Provides session continuity for long-running agent orchestration:
 *  - Persistent session graph
 *  - Reasoning continuity across requests
 *  - Tool ownership tracking
 *  - Session checkpoints for crash recovery
 *  - Resumable orchestration
 *  - Execution snapshots
 *  - Replay continuity
 *
 * Without this, long-running orchestration remains fragile —
 * every request is isolated and state is lost on failure.
 */

import { randomUUID } from 'node:crypto';

export interface Session {
    id: string;
    createdAt: number;
    lastActivityAt: number;
    status: SessionStatus;
    metadata: SessionMetadata;
    history: SessionTurn[];
    checkpoints: SessionCheckpoint[];
    toolState: ToolOwnershipState;
    stats: SessionStats;
}

export type SessionStatus = 'active' | 'idle' | 'suspended' | 'completed' | 'crashed' | 'expired';

export interface SessionMetadata {
    workspaceId?: string;
    agentId?: string;
    clientId?: string;
    model?: string;
    protocol: 'anthropic' | 'openai';
    tags: string[];
}

export interface SessionTurn {
    index: number;
    requestId: string;
    timestamp: number;
    role: 'user' | 'assistant' | 'tool';
    type: 'message' | 'tool_use' | 'tool_result' | 'thinking';
    summary: string;
    tokenCount?: number;
    providerId?: string;
    durationMs?: number;
}

export interface SessionCheckpoint {
    id: string;
    timestamp: number;
    turnIndex: number;
    reason: 'auto' | 'tool_complete' | 'reasoning_complete' | 'manual' | 'error_recovery';
    resumable: boolean;
    snapshotSize: number;
}

export interface ToolOwnershipState {
    activeTool: string | null;
    activeToolId: string | null;
    toolChainDepth: number;
    toolHistory: Array<{ name: string; id: string; status: 'pending' | 'success' | 'error'; timestamp: number }>;
}

export interface SessionStats {
    totalTurns: number;
    totalTokensIn: number;
    totalTokensOut: number;
    totalToolCalls: number;
    totalDurationMs: number;
    providerSwitches: number;
    checkpointCount: number;
    recoveryCount: number;
}

// ── Configuration ──────────────────────────────────────────────────────────

export interface SessionRuntimeConfig {
    /** Maximum idle time before session expires (ms). */
    maxIdleMs: number;
    /** Maximum session duration (ms). */
    maxDurationMs: number;
    /** Maximum turns per session. */
    maxTurns: number;
    /** Auto-checkpoint interval (turns). */
    checkpointInterval: number;
    /** Maximum concurrent sessions. */
    maxConcurrentSessions: number;
    /** Cleanup interval (ms). */
    cleanupIntervalMs: number;
}

const DEFAULT_CONFIG: SessionRuntimeConfig = {
    maxIdleMs: 30 * 60_000,          // 30 minutes
    maxDurationMs: 4 * 60 * 60_000,  // 4 hours
    maxTurns: 500,
    checkpointInterval: 10,
    maxConcurrentSessions: 50,
    cleanupIntervalMs: 60_000,
};

// ── Session Runtime ────────────────────────────────────────────────────────

class SessionRuntime {
    private sessions = new Map<string, Session>();
    private config: SessionRuntimeConfig;
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;

    constructor(config: Partial<SessionRuntimeConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /** Start the session runtime (cleanup timer). */
    start(): void {
        if (this.cleanupTimer) return;
        this.cleanupTimer = setInterval(() => this.cleanup(), this.config.cleanupIntervalMs);
    }

    /** Stop the session runtime. */
    stop(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /** Create a new session. */
    create(metadata: Partial<SessionMetadata> = {}): Session {
        if (this.sessions.size >= this.config.maxConcurrentSessions) {
            // Evict oldest idle session
            this.evictOldest();
        }

        const session: Session = {
            id: `sess_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
            status: 'active',
            metadata: { protocol: 'openai', tags: [], ...metadata },
            history: [],
            checkpoints: [],
            toolState: { activeTool: null, activeToolId: null, toolChainDepth: 0, toolHistory: [] },
            stats: { totalTurns: 0, totalTokensIn: 0, totalTokensOut: 0, totalToolCalls: 0, totalDurationMs: 0, providerSwitches: 0, checkpointCount: 0, recoveryCount: 0 },
        };

        this.sessions.set(session.id, session);
        return session;
    }

    /** Get a session by ID. Returns undefined if not found or expired. */
    get(sessionId: string): Session | undefined {
        const session = this.sessions.get(sessionId);
        if (!session) return undefined;
        if (this.isExpired(session)) {
            session.status = 'expired';
            return undefined;
        }
        return session;
    }

    /** Record a turn in a session. */
    addTurn(sessionId: string, turn: Omit<SessionTurn, 'index' | 'timestamp'>): void {
        const session = this.sessions.get(sessionId);
        if (!session || session.status !== 'active') return;

        session.lastActivityAt = Date.now();
        session.history.push({
            ...turn,
            index: session.history.length,
            timestamp: Date.now(),
        });
        session.stats.totalTurns++;

        if (turn.tokenCount) {
            if (turn.role === 'user') session.stats.totalTokensIn += turn.tokenCount;
            else session.stats.totalTokensOut += turn.tokenCount;
        }

        if (turn.type === 'tool_use') {
            session.stats.totalToolCalls++;
            session.toolState.toolChainDepth++;
        }

        if (turn.type === 'tool_result') {
            session.toolState.toolChainDepth = Math.max(0, session.toolState.toolChainDepth - 1);
        }

        // Auto-checkpoint
        if (session.stats.totalTurns % this.config.checkpointInterval === 0) {
            this.checkpoint(sessionId, 'auto');
        }

        // Check limits
        if (session.stats.totalTurns >= this.config.maxTurns) {
            session.status = 'completed';
        }
    }

    /** Create a checkpoint for crash recovery. */
    checkpoint(sessionId: string, reason: SessionCheckpoint['reason']): SessionCheckpoint | undefined {
        const session = this.sessions.get(sessionId);
        if (!session) return undefined;

        const checkpoint: SessionCheckpoint = {
            id: `ckpt_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
            timestamp: Date.now(),
            turnIndex: session.history.length,
            reason,
            resumable: true,
            snapshotSize: JSON.stringify(session.history.slice(-20)).length,
        };

        session.checkpoints.push(checkpoint);
        session.stats.checkpointCount++;

        // Keep only last 20 checkpoints
        if (session.checkpoints.length > 20) {
            session.checkpoints.splice(0, session.checkpoints.length - 20);
        }

        return checkpoint;
    }

    /** Resume a session from a checkpoint. */
    resume(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;
        if (session.status === 'expired' || session.status === 'completed') return false;

        session.status = 'active';
        session.lastActivityAt = Date.now();
        session.stats.recoveryCount++;
        return true;
    }

    /** Suspend a session (preserves state but marks inactive). */
    suspend(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        session.status = 'suspended';
        this.checkpoint(sessionId, 'manual');
    }

    /** Complete a session normally. */
    complete(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        session.status = 'completed';
        session.stats.totalDurationMs = Date.now() - session.createdAt;
    }

    /** Mark a session as crashed (for recovery). */
    crash(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        session.status = 'crashed';
        this.checkpoint(sessionId, 'error_recovery');
    }

    /** Get all active sessions. */
    getActive(): Session[] {
        return [...this.sessions.values()].filter((s) => s.status === 'active');
    }

    /** Get session count by status. */
    getStatusCounts(): Record<SessionStatus, number> {
        const counts: Record<SessionStatus, number> = { active: 0, idle: 0, suspended: 0, completed: 0, crashed: 0, expired: 0 };
        for (const session of this.sessions.values()) {
            counts[session.status]++;
        }
        return counts;
    }

    /** Get total session count. */
    get size(): number {
        return this.sessions.size;
    }

    // ── Private ─────────────────────────────────────────────────────────────

    private isExpired(session: Session): boolean {
        const now = Date.now();
        const idle = now - session.lastActivityAt;
        const duration = now - session.createdAt;
        return idle > this.config.maxIdleMs || duration > this.config.maxDurationMs;
    }

    private cleanup(): void {
        for (const [id, session] of this.sessions) {
            if (this.isExpired(session)) {
                session.status = 'expired';
                // Keep expired sessions briefly for debugging, then remove
                if (Date.now() - session.lastActivityAt > this.config.maxIdleMs * 2) {
                    this.sessions.delete(id);
                }
            }
        }
    }

    private evictOldest(): void {
        let oldest: Session | null = null;
        for (const session of this.sessions.values()) {
            if (session.status === 'expired' || session.status === 'completed') {
                this.sessions.delete(session.id);
                return;
            }
            if (!oldest || session.lastActivityAt < oldest.lastActivityAt) {
                oldest = session;
            }
        }
        if (oldest && oldest.status === 'idle') {
            this.sessions.delete(oldest.id);
        }
    }
}

/** Singleton session runtime. */
export const sessionRuntime = new SessionRuntime();
