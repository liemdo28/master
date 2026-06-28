/**
 * engines.js — Phase 98 Black Swan Detection building blocks.
 *
 *   • AnomalyEngine — z-score outlier detection over a numeric series:
 *     z = (x − mean) / stddev; points with |z| ≥ threshold are flagged as tail
 *     events. Reports the max |z| and a posture (CALM / ALERT / CRITICAL).
 *
 * Pure arithmetic, no LLM. Deterministic and unit-testable.
 */
const round2 = (n) => Number(n.toFixed(2));

export class AnomalyEngine {
  /**
   * @param {number[]} series
   * @param {number} [threshold=3]
   * @returns {object} { anomalies:[{index,value,z}], maxAbsZ, posture, mean, std }
   */
  scan(series, threshold = 3) {
    const n = series.length;
    if (n < 2) return { anomalies: [], maxAbsZ: 0, posture: 'CALM', mean: n ? series[0] : 0, std: 0 };
    const mean = series.reduce((s, x) => s + x, 0) / n;
    const variance = series.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    const anomalies = [];
    let maxAbsZ = 0;
    series.forEach((value, index) => {
      const z = std === 0 ? 0 : (value - mean) / std;
      const absZ = Math.abs(z);
      if (absZ > maxAbsZ) maxAbsZ = absZ;
      if (absZ >= threshold) anomalies.push({ index, value, z: round2(z) });
    });
    const posture = maxAbsZ >= 4 ? 'CRITICAL' : anomalies.length > 0 ? 'ALERT' : 'CALM';
    return { anomalies, maxAbsZ: round2(maxAbsZ), posture, mean: round2(mean), std: round2(std) };
  }
}
