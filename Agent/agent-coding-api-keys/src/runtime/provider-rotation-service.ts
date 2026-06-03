/**
 * Antigravity Gateway — Provider Rotation Service
 *
 * Time-based 15-minute window rotation.
 *
 * Rotation logic:
 *   windowIndex = floor(currentMinute / 15) % providerCount
 *
 * Example (2 providers: antigravity, opusmax):
 *   00:00 – 00:14  →  primary: antigravity,  fallback: opusmax
 *   00:15 – 00:29  →  primary: opusmax,       fallback: antigravity
 *   00:30 – 00:44  →  primary: antigravity,  fallback: opusmax
 *   00:45 – 00:59  →  primary: opusmax,       fallback: antigravity
 *   (loops forever)
 *
 * Configuration is driven by the providers array injected at construction.
 * Supports N providers — each gets its own 15-minute slot in sequence.
 *
 * This service is read-only (pure function of the clock).
 * It does NOT consume quota, does NOT persist state, and does NOT rotate
 * based on request counts. It purely decides which provider is "primary"
 * at a given point in time.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface RotationWindow {
  /** Index 0-3 within the current hour. */
  windowId: number;
  /** Human-readable label e.g. "10:15 - 10:29". */
  windowLabel: string;
  /** Provider ID that should receive requests in this window. */
  primaryProvider: string;
  /** Provider ID to use if primary fails. */
  fallbackProvider: string;
  /** Unix-ms timestamp of when this window started. */
  windowStartMs: number;
  /** Unix-ms timestamp of when this window ends (exclusive). */
  windowEndMs: number;
  /** Milliseconds remaining in this window. */
  remainingMs: number;
}

// ── Implementation ───────────────────────────────────────────────────────────

export class ProviderRotationService {
  private readonly providers: string[];

  /**
   * @param providers Ordered list of provider IDs. The first provider gets
   *   the first slot (window 0), second gets window 1, etc., cycling forever.
   *   Defaults to ['antigravity', 'opusmax'].
   */
  constructor(providers: string[] = ['antigravity', 'opusmax']) {
    if (providers.length === 0) throw new Error('ProviderRotationService: providers list cannot be empty');
    this.providers = providers;
  }

  /** Provider ID that should serve as primary for the current 15-min window. */
  getPrimaryProvider(): string {
    return this.getCurrentWindow().primaryProvider;
  }

  /** Provider ID that should serve as fallback for the current 15-min window. */
  getFallbackProvider(): string {
    return this.getCurrentWindow().fallbackProvider;
  }

  /** Full snapshot of the current rotation window. */
  getCurrentWindow(): RotationWindow {
    const now = Date.now();
    const d = new Date(now);

    const minute = d.getMinutes();
    const windowId = Math.floor(minute / 15);
    const windowStartMinute = windowId * 15;

    const windowStartMs = new Date(
      d.getFullYear(), d.getMonth(), d.getDate(),
      d.getHours(), windowStartMinute, 0, 0,
    ).getTime();
    const windowEndMs = windowStartMs + 15 * 60 * 1_000;
    const remainingMs = Math.max(0, windowEndMs - now);

    const primaryIdx = windowId % this.providers.length;
    const primary   = this.providers[primaryIdx]!;
    const fallback  = this.providers[(primaryIdx + 1) % this.providers.length]!;

    const pad = (n: number) => String(n).padStart(2, '0');
    const fmtMin = (ms: number) => {
      const t = new Date(ms);
      return `${pad(t.getHours())}:${pad(t.getMinutes())}`;
    };
    // End label shows xx:14 / xx:29 / xx:44 / xx:59 (last minute of the window)
    const endLabelMs = windowEndMs - 60_000;

    return {
      windowId,
      windowLabel: `${fmtMin(windowStartMs)} - ${fmtMin(endLabelMs)}`,
      primaryProvider: primary,
      fallbackProvider: fallback,
      windowStartMs,
      windowEndMs,
      remainingMs,
    };
  }

  /** Ordered list of provider IDs in rotation. */
  getProviderList(): string[] {
    return [...this.providers];
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

/**
 * Global time-based rotation service.
 * Providers are read from ROTATION_PROVIDERS env var (comma-separated)
 * or fall back to ['antigravity', 'opusmax'].
 *
 * To add a new provider: set ROTATION_PROVIDERS=antigravity,opusmax,openrouter
 * No code changes required.
 */
const configuredProviders = process.env['ROTATION_PROVIDERS']
  ? process.env['ROTATION_PROVIDERS'].split(',').map((s) => s.trim()).filter(Boolean)
  : ['antigravity', 'opusmax'];

export const providerRotationService = new ProviderRotationService(configuredProviders);
