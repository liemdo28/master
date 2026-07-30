/**
 * engines.js — Phase 67 Customer Sentiment building blocks.
 *
 *   • SentimentEngine — over a set of 1–5★ reviews: average, rating distribution,
 *                       negative ratio, and an NPS-style score (promoters 5★ −
 *                       detractors 1–2★).
 *   • TrendEngine     — compares the recent half of the series to the older half
 *                       to detect improving / declining sentiment.
 *
 * Pure arithmetic, no LLM. Deterministic and unit-testable.
 */
const round2 = (n) => Number(n.toFixed(2));

export class SentimentEngine {
  /** @param {Array<{rating:number}>} reviews */
  analyze(reviews) {
    const n = reviews.length;
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const r of reviews) { const k = Math.round(r.rating); dist[k] = (dist[k] || 0) + 1; sum += r.rating; }
    const avg = n ? round2(sum / n) : 0;
    const negatives = dist[1] + dist[2];
    const promoters = dist[5];
    const detractors = dist[1] + dist[2];
    const negativeRatio = n ? round2(negatives / n) : 0;
    const nps = n ? round2(((promoters - detractors) / n) * 100) : 0; // -100..100
    const band = avg >= 4.2 ? 'POSITIVE' : avg >= 3.4 ? 'NEUTRAL' : 'NEGATIVE';
    return { count: n, avg, dist, negativeRatio, nps, band };
  }
}

export class TrendEngine {
  /** @param {number[]} ratingsChrono  oldest→newest @returns {object} { direction, delta } */
  detect(ratingsChrono) {
    const n = ratingsChrono.length;
    if (n < 2) return { direction: 'flat', delta: 0 };
    const mid = Math.floor(n / 2);
    const older = ratingsChrono.slice(0, mid);
    const recent = ratingsChrono.slice(mid);
    const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    const delta = round2(avg(recent) - avg(older));
    const direction = delta > 0.1 ? 'improving' : delta < -0.1 ? 'declining' : 'flat';
    return { direction, delta };
  }
}
