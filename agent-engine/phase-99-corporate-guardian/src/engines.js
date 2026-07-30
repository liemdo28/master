/**
 * engines.js — Phase 99 Corporate Guardian building blocks.
 *
 *   • GuardianEngine — aggregates threats across the four protected pillars
 *     (data / revenue / reputation / operations), converts severity into a
 *     per-pillar threat load (capped), derives a protection score per pillar
 *     (100 − load), an overall guardian score, and a defence posture.
 *
 * Pure arithmetic, no LLM. Deterministic and unit-testable.
 */
const round2 = (n) => Number(n.toFixed(2));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export const PILLARS = ['data', 'revenue', 'reputation', 'operations'];
const SEVERITY_WEIGHT = { low: 10, medium: 25, high: 50, critical: 100 };

export class GuardianEngine {
  /** @param {Array<{pillar,severity}>} threats */
  assess(threats) {
    const load = Object.fromEntries(PILLARS.map((p) => [p, 0]));
    let anyCritical = false;
    for (const t of threats) {
      if (!PILLARS.includes(t.pillar)) continue;
      load[t.pillar] += SEVERITY_WEIGHT[t.severity] ?? 0;
      if (t.severity === 'critical') anyCritical = true;
    }
    const pillars = PILLARS.map((p) => {
      const threatLoad = clamp(load[p], 0, 100);
      return { pillar: p, threatLoad, protection: round2(100 - threatLoad) };
    });
    const overall = round2(pillars.reduce((s, x) => s + x.protection, 0) / PILLARS.length);
    const weakest = [...pillars].sort((a, b) => a.protection - b.protection)[0].pillar;
    let posture;
    if (anyCritical) posture = 'DEFCON_CRITICAL';
    else if (overall < 50) posture = 'HIGH_ALERT';
    else if (overall < 75) posture = 'GUARDED';
    else posture = 'SECURE';
    return { pillars, overall, weakest, anyCritical, posture };
  }
}
