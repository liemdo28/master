/**
 * Objective Run Store — File-based persistence
 *
 * Persists objective_runs to disk as JSON (one file per run).
 * Location: {GLOBAL_DIR}/executive-intelligence/runs/{id}.json
 *
 * No external DB required — works immediately on any machine.
 * Postgres migration exists for when the DB layer is ready (Week 2+).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ObjectiveRun, ObjectiveRunStatus } from '../types';

// ── Configuration ─────────────────────────────────────────────────────────────

const MI_CORE_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const GLOBAL_DIR = process.env.GLOBAL_DIR || path.join(MI_CORE_ROOT, '.local-agent-global');
const RUNS_DIR = path.join(GLOBAL_DIR, 'executive-intelligence', 'runs');

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function generateId(): string {
  return `run-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ObjectiveRunStore {
  /**
   * Create a new objective run and persist it.
   */
  createRun(objectiveText: string, channel: string, owner: string): ObjectiveRun;

  /**
   * Update the status of an objective run.
   */
  updateStatus(runId: string, status: ObjectiveRunStatus, extra?: Partial<ObjectiveRun>): ObjectiveRun | null;

  /**
   * Set final confidence and mark as ended.
   */
  completeRun(runId: string, confidence: number): ObjectiveRun | null;

  /**
   * Get a single objective run by ID.
   */
  getRun(runId: string): ObjectiveRun | null;

  /**
   * List all objective runs, most recent first.
   */
  listRuns(limit?: number): ObjectiveRun[];

  /**
   * Get runs by status.
   */
  getRunsByStatus(status: ObjectiveRunStatus): ObjectiveRun[];
}

// ── Implementation ────────────────────────────────────────────────────────────

export const objectiveRunStore: ObjectiveRunStore = {
  createRun(objectiveText, channel, owner) {
    ensureDir(RUNS_DIR);

    const run: ObjectiveRun = {
      id: generateId(),
      objectiveText,
      channel,
      status: 'pending',
      owner,
      startedAt: new Date().toISOString(),
    };

    const filePath = path.join(RUNS_DIR, `${run.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(run, null, 2));
    return run;
  },

  updateStatus(runId, status, extra) {
    const run = this.getRun(runId);
    if (!run) return null;

    const updated: ObjectiveRun = { ...run, status, ...extra };

    const filePath = path.join(RUNS_DIR, `${runId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
    return updated;
  },

  completeRun(runId, confidence) {
    return this.updateStatus(runId, 'completed', {
      endedAt: new Date().toISOString(),
      finalConfidence: confidence,
    });
  },

  getRun(runId) {
    const filePath = path.join(RUNS_DIR, `${runId}.json`);
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as ObjectiveRun;
    } catch {
      return null;
    }
  },

  listRuns(limit = 50) {
    ensureDir(RUNS_DIR);
    const files = fs.readdirSync(RUNS_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit);

    const runs: ObjectiveRun[] = [];
    for (const file of files) {
      try {
        const data = fs.readFileSync(path.join(RUNS_DIR, file), 'utf-8');
        runs.push(JSON.parse(data));
      } catch { /* skip corrupt files */ }
    }

    return runs;
  },

  getRunsByStatus(status) {
    return this.listRuns(200).filter(r => r.status === status);
  },
};
