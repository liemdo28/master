/**
 * Phase P3 — Confidence Engine
 * Mi expresses appropriate uncertainty based on data source.
 */

import { ConfidenceSource, CONFIDENCE_RULES, scoreToPhrase } from './confidence-rules';

export interface ConfidenceResult {
  score: number;
  phrase: string;
  caveat?: string;
  show_in_response: boolean;
}

export function assessConfidence(source: ConfidenceSource, ageMinutes = 0): ConfidenceResult {
  const rule = CONFIDENCE_RULES[source];
  let score = rule.base_score;

  // Penalize for staleness
  if (ageMinutes > 120) score = Math.min(score, 50);
  else if (ageMinutes > 30) score -= 10;

  const show_in_response = score < 85; // only show phrase if uncertain

  return {
    score,
    phrase: scoreToPhrase(score),
    caveat: rule.caveat,
    show_in_response,
  };
}

export function highConfidence(): ConfidenceResult {
  return { score: 95, phrase: 'Em vừa kiểm tra trực tiếp.', show_in_response: false };
}

export function lowConfidence(reason?: string): ConfidenceResult {
  return {
    score: 30,
    phrase: reason || 'Em chưa đủ dữ liệu để kết luận.',
    caveat: 'Em đang kiểm tra thêm.',
    show_in_response: true,
  };
}

export function appendConfidence(reply: string, confidence: ConfidenceResult): string {
  if (!confidence.show_in_response) return reply;
  const lines = [reply];
  lines.push(`\n_${confidence.phrase}${confidence.caveat ? ' ' + confidence.caveat : ''}_`);
  return lines.join('');
}
