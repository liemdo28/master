/**
 * Antigravity Gateway — Request Correlation
 *
 * Every request gets a unique correlation context:
 *  - request_id: unique per HTTP request
 *  - session_id: derived from client headers (x-session-id, or generated)
 *  - workspace_id: from client headers (x-workspace-id)
 *  - provider_trace: populated during routing
 *
 * This enables end-to-end tracing across multi-agent systems.
 */

import { randomUUID } from 'node:crypto';
import type http from 'node:http';

export interface CorrelationContext {
    requestId: string;
    sessionId: string;
    workspaceId: string | null;
    traceId: string;
    startTime: number;
    providerTrace: ProviderTraceEntry[];
}

export interface ProviderTraceEntry {
    providerId: string;
    model: string;
    startMs: number;
    endMs: number;
    status: 'ok' | 'error';
    error?: string;
    streamChunks?: number;
    bytesTransferred?: number;
}

const activeContexts = new Map<string, CorrelationContext>();

/** Create a new correlation context from an incoming HTTP request. */
export function createCorrelation(req: http.IncomingMessage): CorrelationContext {
    const headers = req.headers;
    const requestId = (headers['x-request-id'] as string) || `gw_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const sessionId = (headers['x-session-id'] as string) || `sess_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const workspaceId = (headers['x-workspace-id'] as string) || null;
    const traceId = (headers['x-trace-id'] as string) || `trace_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    const ctx: CorrelationContext = {
        requestId,
        sessionId,
        workspaceId,
        traceId,
        startTime: Date.now(),
        providerTrace: [],
    };

    activeContexts.set(requestId, ctx);
    return ctx;
}

/** Add a provider trace entry to an existing correlation context. */
export function addProviderTrace(requestId: string, entry: ProviderTraceEntry): void {
    const ctx = activeContexts.get(requestId);
    if (ctx) ctx.providerTrace.push(entry);
}

/** Finalize and remove a correlation context. Returns the completed context. */
export function finalizeCorrelation(requestId: string): CorrelationContext | undefined {
    const ctx = activeContexts.get(requestId);
    activeContexts.delete(requestId);
    return ctx;
}

/** Get an active correlation context by request ID. */
export function getCorrelation(requestId: string): CorrelationContext | undefined {
    return activeContexts.get(requestId);
}

/** Set correlation headers on the outgoing response. */
export function setCorrelationHeaders(res: http.ServerResponse, ctx: CorrelationContext): void {
    res.setHeader('x-request-id', ctx.requestId);
    res.setHeader('x-trace-id', ctx.traceId);
    if (ctx.sessionId) res.setHeader('x-session-id', ctx.sessionId);
}

/** Get count of active correlations (for health monitoring). */
export function activeCorrelationCount(): number {
    return activeContexts.size;
}
