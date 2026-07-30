/**
 * decision-replay.js — Decision Replay Engine.
 *
 * Given a NEW failure/signal, search failure-memory for the most similar
 * past failure and "replay" what we know about it: the action taken, whether
 * it resolved, and the root cause that was found. This is the lookup core of
 * self-improving intelligence — we never start from zero on a repeat issue.
 *
 * Match scoring is a transparent, deterministic TF overlap over symptoms +
 * action type, so the result is auditable (no black box).
 */
import { JsonStore, makeId } from './store.js';

export class DecisionReplayEngine {
  constructor(failureMemory, opts) {
    this.failures = failureMemory;
    this.store = new JsonStore('decision-replay', opts);
  }

  /**
   * @param {object} input
   * @param {string} input.symptom
   * @param {string} [input.actionType]
   * @param {object} [input.signal]
   * @returns {{ id, timestamp, symptom, match: object|null, matchScore: number, confidence: string, novel: boolean }}
   */
  replay(input) {
    const candidates = this.failures.all();
    let best = null;
    let bestScore = 0;

    for (const c of candidates) {
      const score = this._score(c, input);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }

    // Normalize to 0..100 with a soft cap so a perfect text overlap ~= 94-100%.
    const matchScore = Math.min(100, Math.round(bestScore * 9));
    const confidence = matchScore >= 70 ? 'HIGH' : matchScore >= 45 ? 'MEDIUM' : 'LOW';
    const novel = matchScore < 35;

    const record = {
      id: makeId('REPLAY'),
      timestamp: Date.now(),
      symptom: input.symptom,
      actionType: input.actionType || null,
      match: best ? { failureId: best.id, symptom: best.symptom, resolved: best.resolved } : null,
      matchScore,
      confidence,
      novel,
    };

    this.store.insert(record);
    return record;
  }

  /** Token-overlap score with a small actionType bonus. */
  _score(candidate, input) {
    const a = this._tokens(`${candidate.symptom} ${candidate.actionType || ''}`);
    const b = this._tokens(`${input.symptom} ${input.actionType || ''}`);
    if (!a.size || !b.size) return 0;
    let overlap = 0;
    for (const t of b) if (a.has(t)) overlap += 1;
    const base = overlap / Math.sqrt(a.size * b.size); // cosine-ish
    let score = base * 10;
    if (input.actionType && candidate.actionType === input.actionType) score += 0.5;
    return score;
  }

  _tokens(s) {
    return new Set(
      String(s)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 2)
    );
  }

  all() {
    return this.store.all();
  }
  count() {
    return this.store.count();
  }
}
