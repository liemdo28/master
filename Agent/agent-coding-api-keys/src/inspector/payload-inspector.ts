/**
 * Antigravity Gateway — RAW Payload Inspector
 *
 * Captures and stores raw payloads at every transformation stage:
 *  - incoming: raw client request body
 *  - transformed: after protocol conversion to Universal format
 *  - outgoing: payload sent to upstream provider
 *  - response: raw provider response
 *  - streamEvents: individual SSE events during streaming
 *  - toolEvents: tool_use and tool_result blocks
 *  - reasoningBlocks: thinking/reasoning content
 *
 * Critical for debugging protocol mismatches between Cline/Claude Code
 * and the gateway's protocol translation layer.
 */

export interface InspectedPayload {
    requestId: string;
    timestamp: number;
    stage: PayloadStage;
    protocol: 'anthropic' | 'openai' | 'universal';
    direction: 'inbound' | 'outbound' | 'internal';
    data: unknown;
    metadata?: Record<string, unknown>;
}

export type PayloadStage =
    | 'incoming_raw'
    | 'incoming_parsed'
    | 'transformed_universal'
    | 'outgoing_provider'
    | 'response_raw'
    | 'response_parsed'
    | 'stream_event'
    | 'tool_event'
    | 'reasoning_block'
    | 'error';

export interface StreamEventCapture {
    requestId: string;
    timestamp: number;
    eventType: string;
    eventData: unknown;
    chunkIndex: number;
    byteSize: number;
}

export interface InspectorStats {
    totalCaptured: number;
    byStage: Record<string, number>;
    byProtocol: Record<string, number>;
    recentErrors: InspectedPayload[];
    streamEventCount: number;
}

const MAX_PAYLOADS = 200;
const MAX_STREAM_EVENTS = 1000;

class PayloadInspector {
    private payloads: InspectedPayload[] = [];
    private streamEvents: StreamEventCapture[] = [];
    private enabled = true;

    /** Enable or disable payload capture. */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    /** Capture a payload at a specific transformation stage. */
    capture(payload: Omit<InspectedPayload, 'timestamp'>): void {
        if (!this.enabled) return;

        const entry: InspectedPayload = {
            ...payload,
            timestamp: Date.now(),
        };

        this.payloads.push(entry);
        if (this.payloads.length > MAX_PAYLOADS) {
            this.payloads.splice(0, this.payloads.length - MAX_PAYLOADS);
        }
    }

    /** Capture a streaming SSE event. */
    captureStreamEvent(event: Omit<StreamEventCapture, 'timestamp'>): void {
        if (!this.enabled) return;

        this.streamEvents.push({ ...event, timestamp: Date.now() });
        if (this.streamEvents.length > MAX_STREAM_EVENTS) {
            this.streamEvents.splice(0, this.streamEvents.length - MAX_STREAM_EVENTS);
        }
    }

    /** Get all captured payloads for a specific request. */
    getByRequestId(requestId: string): InspectedPayload[] {
        return this.payloads.filter((p) => p.requestId === requestId);
    }

    /** Get stream events for a specific request. */
    getStreamEvents(requestId: string): StreamEventCapture[] {
        return this.streamEvents.filter((e) => e.requestId === requestId);
    }

    /** Get recent payloads (most recent first). */
    getRecent(count = 50): InspectedPayload[] {
        return this.payloads.slice(-count).reverse();
    }

    /** Get payloads filtered by stage. */
    getByStage(stage: PayloadStage, count = 50): InspectedPayload[] {
        return this.payloads
            .filter((p) => p.stage === stage)
            .slice(-count)
            .reverse();
    }

    /** Get inspector statistics. */
    getStats(): InspectorStats {
        const byStage: Record<string, number> = {};
        const byProtocol: Record<string, number> = {};

        for (const p of this.payloads) {
            byStage[p.stage] = (byStage[p.stage] ?? 0) + 1;
            byProtocol[p.protocol] = (byProtocol[p.protocol] ?? 0) + 1;
        }

        return {
            totalCaptured: this.payloads.length,
            byStage,
            byProtocol,
            recentErrors: this.payloads.filter((p) => p.stage === 'error').slice(-10).reverse(),
            streamEventCount: this.streamEvents.length,
        };
    }

    /** Get a full request trace (all stages + stream events). */
    getFullTrace(requestId: string): {
        payloads: InspectedPayload[];
        streamEvents: StreamEventCapture[];
        durationMs: number | null;
    } {
        const payloads = this.getByRequestId(requestId);
        const streamEvents = this.getStreamEvents(requestId);

        let durationMs: number | null = null;
        if (payloads.length >= 2) {
            const first = payloads[0]!.timestamp;
            const last = payloads[payloads.length - 1]!.timestamp;
            durationMs = last - first;
        }

        return { payloads, streamEvents, durationMs };
    }

    /** Clear all captured data. */
    clear(): void {
        this.payloads.length = 0;
        this.streamEvents.length = 0;
    }
}

/** Singleton inspector instance. */
export const inspector = new PayloadInspector();
