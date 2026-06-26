/**
 * Antigravity Gateway — Runtime Supervisor
 *
 * Monitors the entire runtime and takes corrective action:
 *  - Detects stuck executions
 *  - Detects dead agents/sessions
 *  - Detects hung streams
 *  - Triggers recovery procedures
 *  - Triggers cleanup
 *  - Restarts failed tasks
 *  - Enforces runtime health invariants
 *
 * The supervisor is the "watchdog" that ensures the runtime
 * never enters an unrecoverable state silently.
 */

import { streamLifecycle } from './stream-lifecycle.js';
import { sessionRuntime } from './session-runtime.js';
import { memoryGuard } from './memory-guard.js';
import { circuitBreakers } from './circuit-breaker.js';
import { executionGraph } from './execution-graph.js';
import { timeline } from './timeline.js';
import { detectOrchestrationAnomalies } from './provider-state.js';
import { quotaOrchestrator } from './quota-orchestrator.js';

export interface SupervisorConfig {
    /** How often to run supervision checks (ms). */
    checkIntervalMs: number;
    /** Maximum time a session can be active without turns (ms). */
    stuckSessionThresholdMs: number;
    /** Maximum time an execution node can be active (ms). */
    stuckNodeThresholdMs: number;
    /** Maximum active streams before throttling. */
    maxActiveStreams: number;
    /** Maximum active sessions before rejecting new ones. */
    maxActiveSessions: number;
    /** Whether to auto-recover crashed sessions. */
    autoRecover: boolean;
    /** Whether to log supervisor actions. */
    logActions: boolean;
}

export interface SupervisorStatus {
    running: boolean;
    lastCheckAt: number;
    checksPerformed: number;
    actionsPerformed: SupervisorAction[];
    health: RuntimeHealth;
}

export interface RuntimeHealth {
    overall: 'healthy' | 'degraded' | 'critical';
    sessions: { active: number; stuck: number; crashed: number };
    streams: { active: number; orphaned: number };
    memory: { pressure: string; heapMB: number };
    providers: { open: number; halfOpen: number; closed: number };
    graph: { activeNodes: number; totalNodes: number };
}

export interface SupervisorAction {
    timestamp: number;
    type:
    | 'session_recovered'
    | 'stream_killed'
    | 'node_cancelled'
    | 'memory_cleanup'
    | 'graph_pruned'
    | 'session_expired'
    | 'orchestration_warning'
    | 'orchestration_critical';
    target: string;
    reason: string;
}

const DEFAULT_CONFIG: SupervisorConfig = {
    checkIntervalMs: 5 * 60_000, // 5 minutes — reduce log noise
    stuckSessionThresholdMs: 5 * 60_000,
    stuckNodeThresholdMs: 3 * 60_000,
    maxActiveStreams: 20,
    maxActiveSessions: 50,
    autoRecover: true,
    logActions: true,
};

class RuntimeSupervisor {
    private config: SupervisorConfig;
    private timer: ReturnType<typeof setInterval> | null = null;
    private lastCheckAt = 0;
    private checksPerformed = 0;
    private actions: SupervisorAction[] = [];

    constructor(config: Partial<SupervisorConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /** Start the supervisor. */
    start(): void {
        if (this.timer) return;
        this.timer = setInterval(() => this.supervise(), this.config.checkIntervalMs);

        // Register memory pressure cleanup
        memoryGuard.onPressure((level) => {
            if (level === 'critical') {
                this.emergencyCleanup();
            }
        });
    }

    /** Stop the supervisor. */
    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /** Get current supervisor status. */
    getStatus(): SupervisorStatus {
        return {
            running: this.timer !== null,
            lastCheckAt: this.lastCheckAt,
            checksPerformed: this.checksPerformed,
            actionsPerformed: this.actions.slice(-50),
            health: this.assessHealth(),
        };
    }

    /** Assess overall runtime health. */
    assessHealth(): RuntimeHealth {
        const sessionCounts = sessionRuntime.getStatusCounts();
        const streamStats = streamLifecycle.getStats();
        const memStatus = memoryGuard.getStatus();
        const cbStats = circuitBreakers.getStats();

        const stuckSessions = this.detectStuckSessions().length;

        let overall: RuntimeHealth['overall'] = 'healthy';
        if (memStatus.pressure === 'critical' || cbStats.totalOpen > 2 || stuckSessions > 5) {
            overall = 'critical';
        } else if (memStatus.pressure === 'elevated' || cbStats.totalOpen > 0 || stuckSessions > 0) {
            overall = 'degraded';
        }

        return {
            overall,
            sessions: { active: sessionCounts.active, stuck: stuckSessions, crashed: sessionCounts.crashed },
            streams: { active: streamStats.active, orphaned: streamStats.orphaned },
            memory: { pressure: memStatus.pressure, heapMB: memStatus.heapUsedMB },
            providers: { open: cbStats.totalOpen, halfOpen: cbStats.totalHalfOpen, closed: cbStats.totalClosed },
            graph: { activeNodes: executionGraph.size, totalNodes: executionGraph.size },
        };
    }

    // ── Private supervision logic ───────────────────────────────────────────

    private supervise(): void {
        this.lastCheckAt = Date.now();
        this.checksPerformed++;

        // 1. Detect and handle stuck sessions
        const stuckSessions = this.detectStuckSessions();
        for (const sessionId of stuckSessions) {
            if (this.config.autoRecover) {
                sessionRuntime.crash(sessionId);
                sessionRuntime.resume(sessionId);
                this.recordAction('session_recovered', sessionId, 'Session was stuck without activity');
            }
        }

        // 2. Check stream health (orphan detection is handled by stream-lifecycle)
        const activeStreams = streamLifecycle.getActive();
        if (activeStreams.length > this.config.maxActiveStreams) {
            // Kill oldest streams to stay within limits
            const sorted = [...activeStreams].sort((a, b) => a.startedAt - b.startedAt);
            const toKill = sorted.slice(0, activeStreams.length - this.config.maxActiveStreams);
            for (const stream of toKill) {
                streamLifecycle.clientDisconnected(stream.id);
                this.recordAction('stream_killed', stream.id, 'Exceeded max active streams limit');
            }
        }

        // 3. Detect stuck execution nodes
        const now = Date.now();
        // We can't iterate all nodes efficiently without a session list,
        // so we check active sessions' graphs
        for (const session of sessionRuntime.getActive()) {
            const activeNodes = executionGraph.getActiveNodes(session.id);
            for (const node of activeNodes) {
                if (node.startedAt && (now - node.startedAt) > this.config.stuckNodeThresholdMs) {
                    executionGraph.fail(node.id, 'Supervisor: execution timeout');
                    this.recordAction('node_cancelled', node.id, `Node stuck for ${Math.round((now - node.startedAt) / 1000)}s`);
                }
            }
        }

        // 4. Prune old execution graphs (older than 1 hour)
        const pruned = executionGraph.prune(60 * 60_000);
        if (pruned > 0) {
            this.recordAction('graph_pruned', `${pruned} nodes`, 'Routine graph cleanup');
        }

        // 5. Orchestration anomaly detection
        this.checkOrchestrationHealth();

        // 6. Emit supervisor heartbeat to timeline
        timeline.emit({
            sessionId: null,
            requestId: null,
            type: 'request.complete',
            source: 'supervisor',
            payload: { checksPerformed: this.checksPerformed, health: this.assessHealth().overall },
        });
    }

    /**
     * Check orchestration health and emit timeline alerts for anomalies.
     * Also detects NKQ inactivity, routing imbalance, and stuck provider selection.
     */
    private checkOrchestrationHealth(): void {
        try {
            const anomalies = detectOrchestrationAnomalies();
            for (const anomaly of anomalies) {
                const actionType: SupervisorAction['type'] =
                    anomaly.severity === 'critical' ? 'orchestration_critical' : 'orchestration_warning';

                this.recordAction(actionType, anomaly.providerId ?? 'orchestration', anomaly.message);

                timeline.emit({
                    sessionId: null,
                    requestId: null,
                    type: anomaly.severity === 'critical' ? 'provider.quota_exhausted' : 'provider.quota_low',
                    source: 'supervisor',
                    payload: {
                        code: anomaly.code,
                        message: anomaly.message,
                        severity: anomaly.severity,
                        providerId: anomaly.providerId ?? null,
                    },
                });
            }

            // ── NKQ Inactivity Detection ────────────────────────────────────
            const metrics = quotaOrchestrator.getMetrics();
            const nkqState = metrics.providers.find(p => p.provider === 'antigravity');
            const opusmaxState = metrics.providers.find(p => p.provider === 'opusmax');

            if (nkqState && opusmaxState) {
                // Detect: OpusMax has requests but NKQ has zero — routing bypass
                if (nkqState.totalRequests === 0 && opusmaxState.totalRequests > 0) {
                    this.recordAction('orchestration_critical', 'antigravity',
                        `NKQ INACTIVITY DETECTED: NKQ has 0 requests while OpusMax has ${opusmaxState.totalRequests}. Routing is bypassing NKQ orchestration priority.`);
                    timeline.emit({
                        sessionId: null,
                        requestId: null,
                        type: 'provider.quota_low',
                        source: 'supervisor',
                        payload: {
                            code: 'nkq_inactive',
                            message: 'NKQ has zero requests while OpusMax is accumulating — routing bypass detected',
                            severity: 'critical',
                            providerId: 'antigravity',
                            nkqRequests: nkqState.totalRequests,
                            opusmaxRequests: opusmaxState.totalRequests,
                        },
                    });
                }

                // Detect: Routing imbalance — NKQ should have proportionally more early requests
                if (nkqState.totalRequests > 0 && opusmaxState.totalRequests > 0) {
                    const totalReqs = nkqState.totalRequests + opusmaxState.totalRequests;
                    const nkqRatio = nkqState.totalRequests / totalReqs;
                    // Expected: NKQ gets 20 out of every 80 requests (25%)
                    // If NKQ ratio drops below 15%, something is wrong
                    if (nkqRatio < 0.15 && totalReqs > 10) {
                        this.recordAction('orchestration_warning', 'antigravity',
                            `Routing imbalance: NKQ=${nkqState.totalRequests} (${(nkqRatio * 100).toFixed(1)}%) vs OpusMax=${opusmaxState.totalRequests}. Expected ~25% NKQ distribution.`);
                    }
                }

                // Detect: Stuck provider selection — active provider hasn't changed despite batch being full
                if (metrics.currentActiveProvider === 'opusmax' && nkqState.state === 'ACTIVE') {
                    this.recordAction('orchestration_warning', 'orchestration',
                        `Provider selection mismatch: metrics says active=${metrics.currentActiveProvider} but NKQ state=${nkqState.state}`);
                }

                // Detect: Quota drift — NKQ quota used doesn't match expected pattern
                if (nkqState.state === 'STANDBY' && nkqState.usedQuota === 0 && opusmaxState.usedQuota > 0) {
                    this.recordAction('orchestration_warning', 'antigravity',
                        `Quota drift: NKQ is STANDBY with 0 used quota while OpusMax has ${opusmaxState.usedQuota} used. NKQ should have been consumed first.`);
                }
            }

            // Detect: NKQ circuit breaker incorrectly open
            const cbStats = circuitBreakers.getStats();
            const nkqBreaker = cbStats.providers['antigravity'];
            if (nkqBreaker && nkqBreaker.state !== 'closed') {
                this.recordAction('orchestration_critical', 'antigravity',
                    `NKQ circuit breaker is ${nkqBreaker.state.toUpperCase()} (failures=${nkqBreaker.consecutiveFailures}). This blocks NKQ from receiving traffic.`);
            }

        } catch (err) {
            // Orchestration monitoring is non-fatal — never crash supervisor
            console.warn('[supervisor] Orchestration health check failed:', err instanceof Error ? err.message : String(err));
        }
    }

    private detectStuckSessions(): string[] {
        const now = Date.now();
        const stuck: string[] = [];
        for (const session of sessionRuntime.getActive()) {
            const idle = now - session.lastActivityAt;
            if (idle > this.config.stuckSessionThresholdMs) {
                stuck.push(session.id);
            }
        }
        return stuck;
    }

    private emergencyCleanup(): void {
        // Under critical memory pressure: aggressive cleanup
        const pruned = executionGraph.prune(10 * 60_000); // Prune anything older than 10 min
        timeline.emit({
            sessionId: null,
            requestId: null,
            type: 'memory.critical',
            source: 'supervisor',
            payload: { action: 'emergency_cleanup', prunedNodes: pruned },
        });
        this.recordAction('memory_cleanup', 'runtime', 'Critical memory pressure — emergency cleanup');
    }

    private recordAction(type: SupervisorAction['type'], target: string, reason: string): void {
        const action: SupervisorAction = { timestamp: Date.now(), type, target, reason };
        this.actions.push(action);
        if (this.actions.length > 200) {
            this.actions.splice(0, this.actions.length - 200);
        }
        if (this.config.logActions) {
            console.log(`[supervisor] ${type}: ${target} — ${reason}`);
        }
    }
}

/** Singleton runtime supervisor. */
export const supervisor = new RuntimeSupervisor();
