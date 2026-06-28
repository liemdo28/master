/**
 * engines.js — Phase 56 Talent Intelligence building blocks.
 *
 *   • CapacityEngine       — utilization = allocated / capacity per person, with
 *                            overload / underload classification.
 *   • RetentionRiskEngine  — 0–100 flight-risk score from burnout (over-utilization),
 *                            performance, stale reviews, and the 12–36mo churn window.
 *
 * Pure arithmetic, no LLM. Deterministic and unit-testable.
 */
const round2 = (n) => Number(n.toFixed(2));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export class CapacityEngine {
  /** @param {object} p { capacityHrs, allocatedHrs } */
  utilization({ capacityHrs, allocatedHrs }) {
    const util = capacityHrs > 0 ? round2(allocatedHrs / capacityHrs) : 0;
    const status = util > 1 ? 'OVERLOADED' : util < 0.5 ? 'UNDERUTILIZED' : 'BALANCED';
    return { utilization: util, status };
  }
}

export class RetentionRiskEngine {
  /**
   * @param {object} person {
   *   performance (0..100), capacityHrs, allocatedHrs,
   *   tenureMonths, lastReviewDays
   * }
   * @returns {object} { score (0..100), band, drivers[] }
   */
  score(person) {
    const drivers = [];
    let score = 0;

    const util = person.capacityHrs > 0 ? person.allocatedHrs / person.capacityHrs : 0;
    if (util > 1) { const v = round2(Math.min(util - 1, 0.5) * 60); score += v; drivers.push({ factor: 'overload', points: v }); }
    else if (util > 0.9) { score += 15; drivers.push({ factor: 'burnout-risk', points: 15 }); }

    if (person.performance < 60) { const v = round2((60 - person.performance) * 0.5); score += v; drivers.push({ factor: 'low-performance', points: v }); }

    if (person.lastReviewDays > 180) { score += 15; drivers.push({ factor: 'stale-review', points: 15 }); }

    if (person.tenureMonths >= 12 && person.tenureMonths <= 36) { score += 10; drivers.push({ factor: 'churn-window', points: 10 }); }

    score = round2(clamp(score, 0, 100));
    const band = score >= 60 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW';
    return { score, band, drivers };
  }
}
