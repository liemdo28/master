/**
 * Simple sliding-window rate limiter keyed by IP address.
 *
 * Used to protect the gateway from abusive clients while leaving
 * long-running SSE streams and legitimate burst traffic unaffected.
 */

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface BucketEntry {
  timestamps: number[];
  blocked: boolean;
  blockedUntil: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, BucketEntry>();
  private cleanupHandle: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly config: RateLimitConfig) {
    // Periodic cleanup of stale buckets (every 5 minutes)
    this.cleanupHandle = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /** Returns true if the request is allowed, false if rate-limited. */
  check(ip: string): boolean {
    const now = Date.now();
    const cutoff = now - this.config.windowMs;
    let bucket = this.buckets.get(ip);

    if (!bucket) {
      bucket = { timestamps: [], blocked: false, blockedUntil: 0 };
      this.buckets.set(ip, bucket);
    }

    if (bucket.blocked && now < bucket.blockedUntil) return false;
    bucket.blocked = false;

    // Slide the window
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
    if (bucket.timestamps.length >= this.config.maxRequests) {
      bucket.blocked = true;
      bucket.blockedUntil = now + this.config.windowMs;
      return false;
    }

    bucket.timestamps.push(now);
    return true;
  }

  /** Return remaining requests allowed in the current window for an IP. */
  remaining(ip: string): number {
    const now = Date.now();
    const cutoff = now - this.config.windowMs;
    const bucket = this.buckets.get(ip);
    if (!bucket) return this.config.maxRequests;
    const active = bucket.timestamps.filter((t) => t > cutoff).length;
    return Math.max(0, this.config.maxRequests - active);
  }

  stop(): void {
    if (this.cleanupHandle) clearInterval(this.cleanupHandle);
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.config.windowMs * 2;
    for (const [ip, bucket] of this.buckets) {
      if (!bucket.timestamps.length || bucket.timestamps.at(-1)! < cutoff) {
        this.buckets.delete(ip);
      }
    }
  }
}

/** Gateway-level rate limiter: 300 req/min per IP for AI endpoints. */
export const aiRateLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 300 });

/** Admin API rate limiter: 60 req/min per IP. */
export const adminRateLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: 60 });
