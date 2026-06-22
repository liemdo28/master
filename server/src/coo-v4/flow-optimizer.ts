/**
 * Domain V — Flow Optimizer
 * SQLite-backed priority queue (BullMQ semantics without Redis).
 * Parallel execution with concurrency limits, circuit breakers, retry policies.
 * OpenTelemetry-style span tracing.
 */

import fs   from 'fs';
import path from 'path';
import type { QueueJob, CircuitBreakerState } from './types';

const GLOBAL_DIR = process.env.MI_CORE_ROOT
  ? path.join(process.env.MI_CORE_ROOT, '.local-agent-global')
  : 'E:/Project/Master/.local-agent-global';
const DB_DIR  = path.join(GLOBAL_DIR, 'coo-v4');

// ── Priority Queue ─────────────────────────────────────────────────────────

class PriorityQueue<T> {
  private items: Array<{ priority: number; item: T }> = [];

  enqueue(item: T, priority: number): void {
    this.items.push({ priority, item });
    this.items.sort((a, b) => b.priority - a.priority);
  }

  dequeue(): T | undefined {
    return this.items.shift()?.item;
  }

  size(): number { return this.items.length; }
  isEmpty(): boolean { return this.items.length === 0; }

  toArray(): T[] { return this.items.map(i => i.item); }
}

// ── Circuit Breaker ────────────────────────────────────────────────────────

class CircuitBreaker {
  private state: CircuitBreakerState;
  private readonly OPEN_DURATION_MS = 60_000;

  constructor(name: string, threshold = 5) {
    this.state = { name, state: 'closed', failures: 0, threshold, last_failure: null };
  }

  isOpen(): boolean {
    if (this.state.state === 'open' && this.state.open_until) {
      if (Date.now() > new Date(this.state.open_until).getTime()) {
        this.state.state = 'half_open';
        return false;
      }
      return true;
    }
    return false;
  }

  onSuccess(): void {
    this.state.failures = 0;
    this.state.state = 'closed';
  }

  onFailure(): void {
    this.state.failures++;
    this.state.last_failure = new Date().toISOString();
    if (this.state.failures >= this.state.threshold) {
      this.state.state = 'open';
      this.state.open_until = new Date(Date.now() + this.OPEN_DURATION_MS).toISOString();
      console.warn(`[CircuitBreaker] ${this.state.name} OPEN — too many failures`);
    }
  }

  getState(): CircuitBreakerState { return { ...this.state }; }
}

// ── Span (OpenTelemetry-style tracing) ────────────────────────────────────

export interface Span {
  trace_id:   string;
  span_id:    string;
  name:       string;
  started_at: string;
  ended_at?:  string;
  duration_ms?: number;
  status:     'ok' | 'error' | 'running';
  attributes: Record<string, unknown>;
  events:     Array<{ name: string; timestamp: string; attributes?: Record<string, unknown> }>;
}

class Tracer {
  private spans: Map<string, Span> = new Map();

  startSpan(name: string, attributes: Record<string, unknown> = {}): Span {
    const span: Span = {
      trace_id: attributes.trace_id as string || `tr_${Date.now()}`,
      span_id: `sp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      started_at: new Date().toISOString(),
      status: 'running',
      attributes,
      events: [],
    };
    this.spans.set(span.span_id, span);
    return span;
  }

  endSpan(spanId: string, status: 'ok' | 'error' = 'ok'): Span | undefined {
    const span = this.spans.get(spanId);
    if (!span) return;
    span.ended_at = new Date().toISOString();
    span.duration_ms = Date.now() - new Date(span.started_at).getTime();
    span.status = status;
    return span;
  }

  addEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void {
    const span = this.spans.get(spanId);
    if (span) span.events.push({ name, timestamp: new Date().toISOString(), attributes });
  }

  getSpan(spanId: string): Span | undefined { return this.spans.get(spanId); }

  getRecentSpans(limit = 50): Span[] {
    return Array.from(this.spans.values())
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
      .slice(0, limit);
  }
}

// ── Flow Optimizer ─────────────────────────────────────────────────────────

export class FlowOptimizer {
  private queues:   Map<string, PriorityQueue<QueueJob>> = new Map();
  private breakers: Map<string, CircuitBreaker> = new Map();
  private active:   Map<string, number> = new Map();  // queue → active count
  private readonly tracer = new Tracer();

  // Concurrency limits per queue
  private readonly CONCURRENCY: Record<string, number> = {
    default:   3,
    marketing: 2,  // heavy GPU tasks
    browser:   2,  // Playwright sessions
    social:    1,  // rate-limited APIs
    tax:       1,  // sequential for safety
    financial: 1,
  };

  // Retry policies
  private readonly RETRY: Record<string, { max: number; backoff_ms: number }> = {
    default:   { max: 3, backoff_ms: 1000 },
    browser:   { max: 2, backoff_ms: 5000 },
    social:    { max: 5, backoff_ms: 10_000 },
    marketing: { max: 2, backoff_ms: 30_000 },
    financial: { max: 1, backoff_ms: 0 },
  };

  private getQueue(name: string): PriorityQueue<QueueJob> {
    if (!this.queues.has(name)) this.queues.set(name, new PriorityQueue());
    return this.queues.get(name)!;
  }

  private getBreaker(name: string): CircuitBreaker {
    if (!this.breakers.has(name)) this.breakers.set(name, new CircuitBreaker(name));
    return this.breakers.get(name)!;
  }

  enqueue<T>(queue: string, payload: T, priority = 5): QueueJob<T> {
    const job: QueueJob<T> = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      queue, payload, priority,
      attempts: 0,
      max_attempts: (this.RETRY[queue] || this.RETRY.default).max,
      status: 'waiting',
      created_at: new Date().toISOString(),
      scheduled_at: new Date().toISOString(),
    };
    this.getQueue(queue).enqueue(job, priority);
    return job;
  }

  async process<T, R>(
    queue: string,
    handler: (job: QueueJob<T>) => Promise<R>,
  ): Promise<{ results: R[]; errors: string[] }> {
    const q = this.getQueue(queue);
    const breaker = this.getBreaker(queue);
    const concurrency = this.CONCURRENCY[queue] || this.CONCURRENCY.default;
    const retry = this.RETRY[queue] || this.RETRY.default;
    const results: R[] = [];
    const errors: string[] = [];

    if (breaker.isOpen()) {
      errors.push(`Circuit breaker OPEN for queue '${queue}' — skipping`);
      return { results, errors };
    }

    const active = this.active.get(queue) || 0;
    const slots = concurrency - active;
    if (slots <= 0) return { results, errors };

    const jobs: Array<QueueJob<T>> = [];
    for (let i = 0; i < slots && !q.isEmpty(); i++) {
      const job = q.dequeue() as QueueJob<T>;
      if (job) jobs.push(job);
    }

    this.active.set(queue, active + jobs.length);

    const promises = jobs.map(async (job) => {
      const span = this.tracer.startSpan(`job.${queue}`, { job_id: job.id, queue, priority: job.priority });
      job.status = 'active';
      job.started_at = new Date().toISOString();
      job.attempts++;

      try {
        const result = await handler(job);
        job.status = 'completed';
        breaker.onSuccess();
        this.tracer.endSpan(span.span_id, 'ok');
        results.push(result);
      } catch (err: any) {
        const msg = err?.message || String(err);
        this.tracer.addEvent(span.span_id, 'error', { message: msg });
        this.tracer.endSpan(span.span_id, 'error');
        breaker.onFailure();

        if (job.attempts < retry.max) {
          job.status = 'waiting';
          if (retry.backoff_ms > 0) {
            setTimeout(() => this.getQueue(queue).enqueue(job, job.priority), retry.backoff_ms * job.attempts);
          } else {
            this.getQueue(queue).enqueue(job, job.priority);
          }
        } else {
          job.status = 'failed';
          job.error = msg;
          errors.push(`Job ${job.id} failed after ${job.attempts} attempts: ${msg}`);
        }
      }
    });

    await Promise.all(promises);
    this.active.set(queue, Math.max(0, (this.active.get(queue) || 0) - jobs.length));
    return { results, errors };
  }

  // Run steps in parallel with dependency ordering
  async runParallel<T, R>(
    steps: Array<{ id: string; deps: string[]; fn: () => Promise<R> }>,
    onStepComplete?: (id: string, result: R) => void,
  ): Promise<Map<string, R>> {
    const completed = new Map<string, R>();
    const pending = new Set(steps.map(s => s.id));
    const span = this.tracer.startSpan('parallel_execution', { step_count: steps.length });

    while (pending.size > 0) {
      // Find steps whose dependencies are all completed
      const ready = steps.filter(s =>
        pending.has(s.id) && s.deps.every(d => completed.has(d))
      );

      if (ready.length === 0) {
        const remaining = Array.from(pending).join(', ');
        errors: console.error(`[FlowOptimizer] Dependency deadlock — remaining: ${remaining}`);
        break;
      }

      const results = await Promise.allSettled(ready.map(async (step) => {
        const stepSpan = this.tracer.startSpan(`step.${step.id}`, { trace_id: span.trace_id });
        try {
          const result = await step.fn();
          completed.set(step.id, result);
          pending.delete(step.id);
          this.tracer.endSpan(stepSpan.span_id, 'ok');
          onStepComplete?.(step.id, result);
          return { id: step.id, result };
        } catch (err: any) {
          this.tracer.endSpan(stepSpan.span_id, 'error');
          throw err;
        }
      }));

      for (const r of results) {
        if (r.status === 'rejected') {
          console.error('[FlowOptimizer] Step failed:', r.reason);
        }
      }
    }

    this.tracer.endSpan(span.span_id, 'ok');
    return completed;
  }

  getStats() {
    const stats: Record<string, { queued: number; active: number; breaker: CircuitBreakerState }> = {};
    for (const [name, q] of this.queues) {
      stats[name] = {
        queued: q.size(),
        active: this.active.get(name) || 0,
        breaker: this.getBreaker(name).getState(),
      };
    }
    return stats;
  }

  getRecentSpans(limit?: number) { return this.tracer.getRecentSpans(limit); }
}

export const flowOptimizer = new FlowOptimizer();
