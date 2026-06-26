/**
 * Antigravity Gateway — Replay Debugger
 *
 * Captures and replays:
 *  - Failed requests
 *  - Streaming sessions
 *  - Tool call chains
 *  - Provider responses
 *
 * Critical for debugging Cline/Claude Code failures without
 * needing to reproduce the exact client state.
 */

export interface ReplayEntry {
    id: string;
    timestamp: number;
    type: 'request' | 'stream' | 'tool_chain' | 'provider_response';
    protocol: 'anthropic' | 'openai';
    status: 'success' | 'error' | 'timeout' | 'partial';

    // Request data
    request: {
        method: string;
        path: string;
        headers: Record<string, string>;
        body: unknown;
    };

    // Provider interaction
    provider?: {
        id: string;
        kind: string;
        model: string;
        outgoingPayload: unknown;
        responseStatus?: number;
        responseBody?: unknown;
    };

    // Streaming data
    streamEvents?: StreamReplayEvent[];

    // Tool chain data
    toolChain?: ToolChainEntry[];

    // Error info
    error?: {
        message: string;
        stage: string;
        stack?: string;
    };

    // Timing
    durationMs: number;
    correlationId?: string;
}

export interface StreamReplayEvent {
    index: number;
    timestamp: number;
    eventType: string;
    data: string;
    byteSize: number;
}

export interface ToolChainEntry {
    index: number;
    toolName: string;
    toolId: string;
    input: unknown;
    output?: unknown;
    status: 'pending' | 'success' | 'error';
    durationMs?: number;
}

const MAX_ENTRIES = 100;

class ReplayDebugger {
    private entries: ReplayEntry[] = [];
    private enabled = true;

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    /** Record a complete request/response cycle for replay. */
    record(entry: ReplayEntry): void {
        if (!this.enabled) return;
        this.entries.push(entry);
        if (this.entries.length > MAX_ENTRIES) {
            this.entries.splice(0, this.entries.length - MAX_ENTRIES);
        }
    }

    /** Get all recorded entries (most recent first). */
    getAll(count = 50): ReplayEntry[] {
        return this.entries.slice(-count).reverse();
    }

    /** Get only failed entries. */
    getFailed(count = 50): ReplayEntry[] {
        return this.entries
            .filter((e) => e.status === 'error' || e.status === 'timeout')
            .slice(-count)
            .reverse();
    }

    /** Get a specific entry by ID. */
    getById(id: string): ReplayEntry | undefined {
        return this.entries.find((e) => e.id === id);
    }

    /** Get entries by correlation ID. */
    getByCorrelation(correlationId: string): ReplayEntry[] {
        return this.entries.filter((e) => e.correlationId === correlationId);
    }

    /**
     * Generate a replay payload that can be sent back through the gateway.
     * Strips internal metadata and returns a clean request object.
     */
    generateReplayPayload(id: string): {
        method: string;
        path: string;
        headers: Record<string, string>;
        body: unknown;
    } | null {
        const entry = this.getById(id);
        if (!entry) return null;

        return {
            method: entry.request.method,
            path: entry.request.path,
            headers: {
                ...entry.request.headers,
                'x-replay-id': id,
                'x-replay-original-timestamp': String(entry.timestamp),
            },
            body: entry.request.body,
        };
    }

    /**
     * Generate a curl command for replaying a request externally.
     */
    generateCurl(id: string, baseUrl = 'http://127.0.0.1:3456'): string | null {
        const entry = this.getById(id);
        if (!entry) return null;

        const headers = Object.entries(entry.request.headers)
            .filter(([k]) => !k.startsWith('x-replay'))
            .map(([k, v]) => `-H '${k}: ${v}'`)
            .join(' \\\n  ');

        const body = JSON.stringify(entry.request.body);
        return `curl -X ${entry.request.method} '${baseUrl}${entry.request.path}' \\\n  ${headers} \\\n  -d '${body}'`;
    }

    /** Get replay statistics. */
    getStats(): {
        total: number;
        byStatus: Record<string, number>;
        byProtocol: Record<string, number>;
        byType: Record<string, number>;
        avgDurationMs: number;
    } {
        const byStatus: Record<string, number> = {};
        const byProtocol: Record<string, number> = {};
        const byType: Record<string, number> = {};
        let totalDuration = 0;

        for (const e of this.entries) {
            byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
            byProtocol[e.protocol] = (byProtocol[e.protocol] ?? 0) + 1;
            byType[e.type] = (byType[e.type] ?? 0) + 1;
            totalDuration += e.durationMs;
        }

        return {
            total: this.entries.length,
            byStatus,
            byProtocol,
            byType,
            avgDurationMs: this.entries.length > 0 ? Math.round(totalDuration / this.entries.length) : 0,
        };
    }

    /** Clear all entries. */
    clear(): void {
        this.entries.length = 0;
    }
}

/** Singleton replay debugger instance. */
export const replayDebugger = new ReplayDebugger();

/** Helper to create a replay entry ID. */
export function createReplayId(): string {
    return `replay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
