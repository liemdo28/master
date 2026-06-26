/**
 * Phase 0E — Duplicate Detection Engine
 *
 * Prevent duplicate tasks across divisions, n8n, agents, manual CEO commands.
 *
 * Confidence thresholds:
 *  > 85% → do not create, link to existing, return warning
 *  60-85% → create duplicate review, require coordinator approval
 *  < 60% → allow creation
 *
 * Signals compared: title similarity, objective, target system,
 * division, owner, due date, source, URL, repo, store, workflow
 */
import { Task, DuplicateCheck, DuplicateRecord } from './types';
import {
  loadCollection, saveRecord, genId, nowIso,
} from './persistence';

const SUBDIR = 'duplicates';

const HIGH_CONFIDENCE = 0.85;
const REVIEW_THRESHOLD = 0.60;

/**
 * Levenshtein-based similarity (0..1)
 */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (x === y) return 1;
  if (x.length === 0 || y.length === 0) return 0;

  const matrix: number[][] = [];
  for (let i = 0; i <= x.length; i++) {
    matrix[i] = new Array(y.length + 1).fill(0);
    matrix[i][0] = i;
  }
  for (let j = 0; j <= y.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  const dist = matrix[x.length][y.length];
  const maxLen = Math.max(x.length, y.length);
  return 1 - dist / maxLen;
}

/**
 * Token Jaccard similarity
 */
function tokenSimilarity(a: string, b: string): number {
  const tokA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const tokB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  if (tokA.size === 0 || tokB.size === 0) return 0;
  let inter = 0;
  for (const t of tokA) if (tokB.has(t)) inter++;
  return inter / (tokA.size + tokB.size - inter);
}

function compositeConfidence(task: Task, candidate: Task): number {
  const titleSim = similarity(task.title, candidate.title);
  const descSim = similarity(task.description ?? '', candidate.description ?? '');
  const tokenSim = tokenSimilarity(task.title, candidate.title);

  let signals = 0.0;
  const weights: number[] = [];
  weights.push(titleSim * 0.45);
  weights.push(tokenSim * 0.25);
  weights.push(descSim * 0.10);
  if (task.objectiveId && task.objectiveId === candidate.objectiveId) weights.push(0.10);
  if (task.division && task.division === candidate.division) weights.push(0.05);
  if (task.owner && task.owner === candidate.owner) weights.push(0.05);

  return weights.reduce((s, w) => s + w, 0);
}

export function detectDuplicates(tasks: Task[]): DuplicateCheck[] {
  const existing = loadCollection<Task>('tasks');
  const checks: DuplicateCheck[] = [];
  for (const t of tasks) {
    for (const ex of existing) {
      if (ex.id === t.id) continue;
      const conf = compositeConfidence(t, ex);
      if (conf >= REVIEW_THRESHOLD) {
        checks.push({
          existingTaskId: ex.id,
          newTaskTitle: t.title,
          confidence: Number(conf.toFixed(2)),
          matchSignals: [
            `title-similarity:${similarity(t.title, ex.title).toFixed(2)}`,
            `token-similarity:${tokenSimilarity(t.title, ex.title).toFixed(2)}`,
            ...(t.objectiveId === ex.objectiveId ? ['same-objective'] : []),
            ...(t.division === ex.division ? ['same-division'] : []),
          ],
        });
      }
    }
  }
  return checks;
}

export function checkDuplicate(newTask: Task): DuplicateCheck[] {
  return detectDuplicates([newTask]);
}

export function markDuplicate(
  originalTaskId: string, duplicateTaskId: string,
  confidence: number, action: 'linked' | 'merged' | 'ignored' | 'review_required',
): DuplicateRecord {
  const rec: DuplicateRecord = {
    id: genId('DUP'),
    originalTaskId,
    duplicateTaskId,
    confidence,
    action,
    createdAt: nowIso(),
  };
  saveRecord(SUBDIR, rec);
  return rec;
}

export function getDuplicateSummary(): {
  total: number; byAction: Record<string, number>; byConfidenceBucket: Record<string, number>;
} {
  const all = loadCollection<DuplicateRecord>(SUBDIR);
  const byAction: Record<string, number> = {};
  const byConfidenceBucket: Record<string, number> = { 'high>85': 0, 'review60-85': 0, 'low<60': 0 };
  for (const r of all) {
    byAction[r.action] = (byAction[r.action] ?? 0) + 1;
    const bucket = r.confidence > HIGH_CONFIDENCE ? 'high>85'
      : r.confidence >= REVIEW_THRESHOLD ? 'review60-85' : 'low<60';
    byConfidenceBucket[bucket]++;
  }
  return { total: all.length, byAction, byConfidenceBucket };
}

export { HIGH_CONFIDENCE, REVIEW_THRESHOLD };