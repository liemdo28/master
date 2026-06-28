/**
 * engines.js — Phase 60 Organizational Health building blocks.
 *
 *   • HealthIndexEngine — weighted composite of domain scores (team / project /
 *                         finance / ops), each 0–100, into a single org-health
 *                         index, and identifies the weakest domain.
 *
 * Pure arithmetic, no LLM. Deterministic and unit-testable.
 */
const round2 = (n) => Number(n.toFixed(2));

const DEFAULT_WEIGHTS = { team: 0.3, project: 0.25, finance: 0.3, ops: 0.15 };

export class HealthIndexEngine {
  /**
   * @param {object} domains { team, project, finance, ops }  // each 0..100
   * @param {object} [weights]
   * @returns {object} { index, band, weakest, contributions }
   */
  compute(domains, weights = DEFAULT_WEIGHTS) {
    const keys = Object.keys(weights);
    const totalW = keys.reduce((s, k) => s + weights[k], 0) || 1;
    const contributions = {};
    let index = 0;
    for (const k of keys) {
      const v = domains[k] ?? 0;
      const w = weights[k] / totalW;
      contributions[k] = round2(v * w);
      index += v * w;
    }
    index = round2(index);
    const present = keys.filter((k) => domains[k] !== undefined);
    const weakest = present.sort((a, b) => domains[a] - domains[b])[0] ?? null;
    const band = index >= 75 ? 'HEALTHY' : index >= 55 ? 'WATCH' : 'CRITICAL';
    return { index, band, weakest, contributions };
  }
}
