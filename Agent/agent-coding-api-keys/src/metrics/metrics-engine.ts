/**
 * Antigravity Gateway — Metrics Engine
 *
 * Tracks operational metrics for observability:
 *  - p95 latency
 *  - Provider success rate
 *  - Stream completion rate
 *  - Tool chain success rate
 *  - Fallback frequency
 *  - Retry frequency
 *  - Token throughput
 *  - Stream interruption rate
 *
 * Exposed via: GET /api/metrics
 */

export interface MetricsSummary {
    uptime: number;
    requests: RequestMetrics;
    latency: LatencyMetrics;
    providers: Record<string, ProviderMetrics>;
    streaming: StreamMetrics;
    tools: ToolMetrics;
    fallbacks: FallbackMetrics;
    tokens: TokenMetrics;
}

export interface RequestMetrics {
    total: number;
    success: number;
    error: number;
    active: number;
    perMinute: number;
}

export interface LatencyMetrics {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    avgMs: number;
    maxMs: number;
}

export interface ProviderMetrics {
    requests: number;
    successes: number;
    failures: number;
    successRate: number;
    avgLatencyMs: number;
    lastError?: string;
    lastUsed?: number;
}

export interface StreamMetrics {
    total: number;
    completed: number;
    interrupted: number;
    completionRate: number;
    avgChunks: number;
    avgDurationMs: number;
}

export interface ToolMetrics {
    totalCalls: number;
    successfulChains: number;
    failedChains: number;
    avgToolsPerRequest: number;
    chainSuccessRate: number;
}

export interface FallbackMetrics {
    totalFallbacks: number;
    providerFallbacks: number;
    modelFallbacks: number;
    fallbackRate: number;
}

export interface TokenMetrics {
    totalInput: number;
    totalOutput: number;
    avgInputPerRequest: number;
    avgOutputPerRequest: number;
    tokensPerSecond: number;
}

// ── Internal tracking ──────────────────────────────────────────────────────

interface RequestRecord {
    timestamp: number;
    durationMs: number;
    success: boolean;
    providerId: string;
    streaming: boolean;
    streamCompleted?: boolean;
    streamChunks?: number;
    toolCalls?: number;
    toolChainSuccess?: boolean;
    fallback: boolean;
    inputTokens: number;
    outputTokens: number;
}

const MAX_RECORDS = 10_000;

class MetricsEngine {
    private records: RequestRecord[] = [];
    private startTime = Date.now();
    private activeRequests = 0;

    /** Record a completed request. */
    record(entry: RequestRecord): void {
        this.records.push(entry);
        if (this.records.length > MAX_RECORDS) {
            this.records.splice(0, this.records.length - MAX_RECORDS);
        }
    }

    /** Increment active request counter. */
    requestStart(): void {
        this.activeRequests++;
    }

    /** Decrement active request counter. */
    requestEnd(): void {
        this.activeRequests = Math.max(0, this.activeRequests - 1);
    }

    /** Get full metrics summary. */
    getSummary(): MetricsSummary {
        const now = Date.now();
        const uptime = now - this.startTime;
        const records = this.records;

        // Request metrics
        const total = records.length;
        const success = records.filter((r) => r.success).length;
        const error = total - success;
        const oneMinuteAgo = now - 60_000;
        const perMinute = records.filter((r) => r.timestamp > oneMinuteAgo).length;

        // Latency metrics
        const latencies = records.map((r) => r.durationMs).sort((a, b) => a - b);
        const latency: LatencyMetrics = {
            p50Ms: percentile(latencies, 50),
            p95Ms: percentile(latencies, 95),
            p99Ms: percentile(latencies, 99),
            avgMs: latencies.length > 0 ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length) : 0,
            maxMs: latencies.length > 0 ? latencies[latencies.length - 1]! : 0,
        };

        // Provider metrics
        const providers: Record<string, ProviderMetrics> = {};
        for (const r of records) {
            if (!providers[r.providerId]) {
                providers[r.providerId] = { requests: 0, successes: 0, failures: 0, successRate: 0, avgLatencyMs: 0 };
            }
            const p = providers[r.providerId]!;
            p.requests++;
            if (r.success) p.successes++;
            else {
                p.failures++;
            }
            p.lastUsed = r.timestamp;
        }
        for (const p of Object.values(providers)) {
            p.successRate = p.requests > 0 ? Math.round((p.successes / p.requests) * 100) / 100 : 0;
            const providerRecords = records.filter((r) => providers[r.providerId] === p);
            p.avgLatencyMs = providerRecords.length > 0
                ? Math.round(providerRecords.reduce((s, r) => s + r.durationMs, 0) / providerRecords.length)
                : 0;
        }

        // Streaming metrics
        const streamRecords = records.filter((r) => r.streaming);
        const streamCompleted = streamRecords.filter((r) => r.streamCompleted).length;
        const streamInterrupted = streamRecords.filter((r) => !r.streamCompleted).length;
        const streaming: StreamMetrics = {
            total: streamRecords.length,
            completed: streamCompleted,
            interrupted: streamInterrupted,
            completionRate: streamRecords.length > 0 ? Math.round((streamCompleted / streamRecords.length) * 100) / 100 : 1,
            avgChunks: streamRecords.length > 0
                ? Math.round(streamRecords.reduce((s, r) => s + (r.streamChunks ?? 0), 0) / streamRecords.length)
                : 0,
            avgDurationMs: streamRecords.length > 0
                ? Math.round(streamRecords.reduce((s, r) => s + r.durationMs, 0) / streamRecords.length)
                : 0,
        };

        // Tool metrics
        const toolRecords = records.filter((r) => (r.toolCalls ?? 0) > 0);
        const tools: ToolMetrics = {
            totalCalls: toolRecords.reduce((s, r) => s + (r.toolCalls ?? 0), 0),
            successfulChains: toolRecords.filter((r) => r.toolChainSuccess).length,
            failedChains: toolRecords.filter((r) => !r.toolChainSuccess).length,
            avgToolsPerRequest: toolRecords.length > 0
                ? Math.round((toolRecords.reduce((s, r) => s + (r.toolCalls ?? 0), 0) / toolRecords.length) * 10) / 10
                : 0,
            chainSuccessRate: toolRecords.length > 0
                ? Math.round((toolRecords.filter((r) => r.toolChainSuccess).length / toolRecords.length) * 100) / 100
                : 1,
        };

        // Fallback metrics
        const fallbackRecords = records.filter((r) => r.fallback);
        const fallbacks: FallbackMetrics = {
            totalFallbacks: fallbackRecords.length,
            providerFallbacks: fallbackRecords.length, // simplified
            modelFallbacks: 0,
            fallbackRate: total > 0 ? Math.round((fallbackRecords.length / total) * 100) / 100 : 0,
        };

        // Token metrics
        const totalInput = records.reduce((s, r) => s + r.inputTokens, 0);
        const totalOutput = records.reduce((s, r) => s + r.outputTokens, 0);
        const uptimeSeconds = Math.max(uptime / 1000, 1);
        const tokens: TokenMetrics = {
            totalInput,
            totalOutput,
            avgInputPerRequest: total > 0 ? Math.round(totalInput / total) : 0,
            avgOutputPerRequest: total > 0 ? Math.round(totalOutput / total) : 0,
            tokensPerSecond: Math.round((totalInput + totalOutput) / uptimeSeconds),
        };

        return {
            uptime,
            requests: { total, success, error, active: this.activeRequests, perMinute },
            latency,
            providers,
            streaming,
            tools,
            fallbacks,
            tokens,
        };
    }

    /** Reset all metrics. */
    reset(): void {
        this.records.length = 0;
        this.startTime = Date.now();
        this.activeRequests = 0;
    }
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)]!;
}

/** Singleton metrics engine. */
export const metrics = new MetricsEngine();
