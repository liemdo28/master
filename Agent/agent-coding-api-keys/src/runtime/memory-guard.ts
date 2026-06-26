/**
 * Antigravity Gateway — Memory Pressure Protection
 *
 * Prevents long-running agents from destabilizing the gateway through:
 *  - Request memory limits
 *  - Stream buffer limits
 *  - Replay retention limits
 *  - Payload truncation policies
 *  - Automatic cleanup under pressure
 *  - Heap usage monitoring
 *
 * Without this, unbounded growth from replay buffers, inspector payloads,
 * and stream events will eventually crash the process.
 */

export interface MemoryGuardConfig {
    /** Maximum heap usage before triggering pressure mode (bytes). */
    heapPressureThresholdBytes: number;
    /** Maximum heap usage before emergency cleanup (bytes). */
    heapCriticalThresholdBytes: number;
    /** Maximum size of a single request body (bytes). */
    maxRequestBodyBytes: number;
    /** Maximum size of a single tool result content (bytes). */
    maxToolResultBytes: number;
    /** Check interval (ms). */
    checkIntervalMs: number;
    /** Whether to log pressure events. */
    logPressure: boolean;
}

export interface MemoryStatus {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
    pressure: 'normal' | 'elevated' | 'critical';
    gcRecommended: boolean;
    lastCheckAt: number;
}

export type PressureLevel = 'normal' | 'elevated' | 'critical';
export type CleanupCallback = (level: PressureLevel) => void;

const DEFAULT_CONFIG: MemoryGuardConfig = {
    heapPressureThresholdBytes: 512 * 1024 * 1024,  // 512MB
    heapCriticalThresholdBytes: 1024 * 1024 * 1024,  // 1GB
    maxRequestBodyBytes: 10 * 1024 * 1024,            // 10MB
    maxToolResultBytes: 1 * 1024 * 1024,              // 1MB
    checkIntervalMs: 15_000,                          // 15s
    logPressure: true,
};

class MemoryGuard {
    private config: MemoryGuardConfig;
    private checkTimer: ReturnType<typeof setInterval> | null = null;
    private cleanupCallbacks: CleanupCallback[] = [];
    private lastStatus: MemoryStatus;
    private pressureEvents: Array<{ timestamp: number; level: PressureLevel; heapMB: number }> = [];

    constructor(config: Partial<MemoryGuardConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.lastStatus = this.checkNow();
    }

    /** Start periodic memory monitoring. */
    start(): void {
        if (this.checkTimer) return;
        this.checkTimer = setInterval(() => this.monitor(), this.config.checkIntervalMs);
    }

    /** Stop monitoring. */
    stop(): void {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
    }

    /** Register a cleanup callback for pressure events. */
    onPressure(callback: CleanupCallback): void {
        this.cleanupCallbacks.push(callback);
    }

    /** Get current memory status. */
    getStatus(): MemoryStatus {
        return this.lastStatus;
    }

    /** Check memory immediately and return status. */
    checkNow(): MemoryStatus {
        const mem = process.memoryUsage();
        const heapUsed = mem.heapUsed;
        const pressure = this.classifyPressure(heapUsed);

        this.lastStatus = {
            heapUsedMB: Math.round(heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
            rssMB: Math.round(mem.rss / 1024 / 1024),
            pressure,
            gcRecommended: pressure !== 'normal',
            lastCheckAt: Date.now(),
        };

        return this.lastStatus;
    }

    /** Validate request body size. Returns true if acceptable. */
    validateRequestSize(bodyBytes: number): boolean {
        return bodyBytes <= this.config.maxRequestBodyBytes;
    }

    /** Validate tool result size. Returns true if acceptable. */
    validateToolResultSize(contentBytes: number): boolean {
        return contentBytes <= this.config.maxToolResultBytes;
    }

    /** Truncate content to fit within limits. */
    truncateContent(content: string, maxBytes: number): string {
        if (Buffer.byteLength(content) <= maxBytes) return content;
        // Binary search for the right truncation point
        let low = 0;
        let high = content.length;
        while (low < high) {
            const mid = Math.floor((low + high + 1) / 2);
            if (Buffer.byteLength(content.slice(0, mid)) <= maxBytes - 20) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }
        return content.slice(0, low) + '\n[TRUNCATED]';
    }

    /** Get pressure event history. */
    getPressureHistory(): Array<{ timestamp: number; level: PressureLevel; heapMB: number }> {
        return this.pressureEvents.slice(-50);
    }

    /** Check if the system is under memory pressure. */
    isUnderPressure(): boolean {
        return this.lastStatus.pressure !== 'normal';
    }

    // ── Private ─────────────────────────────────────────────────────────────

    private monitor(): void {
        const status = this.checkNow();

        if (status.pressure !== 'normal') {
            this.pressureEvents.push({
                timestamp: Date.now(),
                level: status.pressure,
                heapMB: status.heapUsedMB,
            });

            if (this.pressureEvents.length > 200) {
                this.pressureEvents.splice(0, this.pressureEvents.length - 200);
            }

            if (this.config.logPressure) {
                console.warn(`[memory-guard] Pressure: ${status.pressure} (heap: ${status.heapUsedMB}MB / rss: ${status.rssMB}MB)`);
            }

            // Notify cleanup callbacks
            for (const cb of this.cleanupCallbacks) {
                try { cb(status.pressure); } catch { /* don't let cleanup errors propagate */ }
            }

            // Emergency: try to trigger GC if available
            if (status.pressure === 'critical' && typeof global.gc === 'function') {
                global.gc();
            }
        }
    }

    private classifyPressure(heapUsed: number): PressureLevel {
        if (heapUsed >= this.config.heapCriticalThresholdBytes) return 'critical';
        if (heapUsed >= this.config.heapPressureThresholdBytes) return 'elevated';
        return 'normal';
    }
}

/** Singleton memory guard. */
export const memoryGuard = new MemoryGuard();
