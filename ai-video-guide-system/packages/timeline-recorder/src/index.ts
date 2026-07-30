// src/index.ts

import { z } from "zod";

export const TimelineEventSchema = z.object({
  timestamp: z.number(), // ms since recording start
  type: z.enum(["action", "screenshot", "navigation", "error", "hover", "scroll", "input"]),
  stepIndex: z.number().optional(),
  description: z.string(),
  data: z.record(z.unknown()).optional(),
});

export const TimelineSegmentSchema = z.object({
  stepIndex: z.number(),
  startMs: z.number(),
  endMs: z.number(),
  description: z.string(),
  events: z.array(TimelineEventSchema),
});

export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
export type TimelineSegment = z.infer<typeof TimelineSegmentSchema>;

/**
 * TimelineRecorder captures a time-ordered stream of browser events during
 * a video recording session. Events are grouped into segments per workflow step.
 */
export class TimelineRecorder {
  private events: TimelineEvent[] = [];
  private startTime: number = 0;
  private segments: TimelineSegment[] = [];
  private currentSegmentEvents: TimelineEvent[] = [];

  /** Start a new recording session */
  start(): void {
    this.events = [];
    this.segments = [];
    this.currentSegmentEvents = [];
    this.startTime = Date.now();
  }

  /** Elapsed time in ms since session start */
  elapsed(): number {
    return Date.now() - this.startTime;
  }

  /** Record a single event */
  record(event: Omit<TimelineEvent, "timestamp">): void {
    this.events.push({ ...event, timestamp: this.elapsed() });
    this.currentSegmentEvents.push({ ...event, timestamp: this.elapsed() });
  }

  /** Begin a new step segment */
  beginSegment(stepIndex: number, description: string): void {
    // Finalize previous segment
    if (this.currentSegmentEvents.length > 0) {
      const first = this.currentSegmentEvents[0];
      const last = this.currentSegmentEvents[this.currentSegmentEvents.length - 1];
      this.segments.push({
        stepIndex: this.segments.length,
        startMs: first.timestamp,
        endMs: last.timestamp,
        description: this.segments.length > 0 ? "" : description,
        events: [...this.currentSegmentEvents],
      });
    }
    this.currentSegmentEvents = [];
  }

  /** Finalize and return the full timeline */
  finalize(): { events: TimelineEvent[]; segments: TimelineSegment[] } {
    if (this.currentSegmentEvents.length > 0) {
      const first = this.currentSegmentEvents[0];
      const last = this.currentSegmentEvents[this.currentSegmentEvents.length - 1];
      this.segments.push({
        stepIndex: this.segments.length,
        startMs: first.timestamp,
        endMs: last.timestamp,
        description: "",
        events: [...this.currentSegmentEvents],
      });
    }
    this.currentSegmentEvents = [];
    return { events: [...this.events], segments: [...this.segments] };
  }

  /** Export as JSON-serializable object */
  toJSON() {
    const result = this.finalize();
    return result;
  }
}
