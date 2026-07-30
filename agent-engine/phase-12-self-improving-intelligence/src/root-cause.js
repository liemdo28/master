/**
 * root-cause.js — Root Cause Analysis Engine (5-Whys).
 *
 * Walks a symptom through up to 5 "why?" steps. Each step either pulls a
 * pre-seeded cause from the input (so humans/operators can drive it) or
 * applies a deterministic heuristic to the failure's signal/context.
 *
 * The output is an auditable chain: symptom → cause1 → cause2 → ... → root.
 * It also classifies the root into a known bucket (external dependency,
 * data freshness, auth, capacity, code defect, unknown) so the
 * recommendation engine can pick the right remediation family.
 */
import { JsonStore, makeId } from './store.js';

const ROOT_BUCKETS = [
  { key: 'external_dependency', match: /(timeout|unreachable|rate.limit|503|502|429|connection)/i },
  { key: 'data_freshness', match: /(stale|outdated|empty|zero|missing data|24h|not updated)/i },
  { key: 'auth', match: /(token|auth|401|403|permission|expired credential|login)/i },
  { key: 'capacity', match: /(oom|memory|disk full|queue full|backpressure|too many)/i },
  { key: 'code_defect', match: /(null|undefined|exception|traceback|crash|uncaught)/i },
];

function classify(text) {
  const hay = String(text);
  for (const b of ROOT_BUCKETS) if (b.match.test(hay)) return b.key;
  return 'unknown';
}

export class RootCauseEngine {
  constructor(opts) {
    this.store = new JsonStore('root-cause', opts);
  }

  /**
   * @param {object} input
   * @param {string} input.symptom
   * @param {string[]} [input.whys]  optional operator-driven answers (why1..why5)
   * @param {object}  [input.signal]
   * @param {object}  [input.context]
   * @returns {{ id, timestamp, symptom, chain: string[], root, bucket, depth }}
   */
  analyze(input) {
    const symptom = input.symptom;
    const provided = Array.isArray(input.whys) ? input.whys : [];
    const chain = [symptom];

    let current = symptom;
    for (let depth = 1; depth <= 5; depth++) {
      const next = provided[depth - 1]
        ? provided[depth - 1]
        : this._heuristic(current, input, depth);
      if (!next || next === current) break;
      chain.push(next);
      current = next;
      // Stop early if we've reached an external/root signal.
      if (/external|third.party|vendor|api provider|credential/i.test(current)) break;
    }

    const root = current;
    const bucket = classify(`${symptom} ${chain.slice(1).join(' ')} ${JSON.stringify(input.signal || {})}`);

    const record = {
      id: makeId('RCA'),
      timestamp: Date.now(),
      symptom,
      chain,
      root,
      bucket,
      depth: chain.length - 1,
    };
    this.store.insert(record);
    return record;
  }

  /** Deterministic per-depth heuristic when no operator whys are supplied. */
  _heuristic(current, input, depth) {
    const sig = JSON.stringify(input.signal || {}).toLowerCase();
    const ctx = JSON.stringify(input.context || {}).toLowerCase();
    const hay = `${current} ${sig} ${ctx}`;

    if (depth === 1) {
      if (/timeout/.test(hay)) return 'request did not complete within the configured window';
      if (/stale|24h|not updated/.test(hay)) return 'data source was not refreshed within SLA';
      if (/empty|zero|no data/.test(hay)) return 'upstream returned an empty payload';
      if (/401|403|token|auth/.test(hay)) return 'credential was rejected by the upstream';
      return 'observed signal deviated from the expected value';
    }
    if (depth === 2) {
      if (/window|refreshed|payload|rejected|expected value/.test(current)) {
        return 'upstream provider did not respond successfully';
      }
      return 'the call to the upstream provider failed or returned no usable data';
    }
    if (depth === 3) {
      return 'external dependency lifecycle (provider outage, throttling, or credential rotation)';
    }
    if (depth === 4) return 'no retry, circuit-breaker, or fallback was in place for that dependency';
    return 'the system assumes the external dependency is always healthy';
  }

  all() {
    return this.store.all();
  }
  count() {
    return this.store.count();
  }
}
