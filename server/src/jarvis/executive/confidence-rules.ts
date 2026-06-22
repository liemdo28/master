/**
 * Phase P3 — Confidence Rules
 * Maps data sources and staleness to confidence levels.
 */

export type ConfidenceSource =
  | 'live_api'       // real-time health sweep
  | 'memory_recall'  // from memory store
  | 'knowledge_doc'  // from indexed document
  | 'graph_data'     // from knowledge graph
  | 'cached_data'    // data < 30 min old
  | 'stale_data'     // data > 2 hours old
  | 'inferred'       // derived/estimated
  | 'unknown';

export interface ConfidenceRule {
  source: ConfidenceSource;
  base_score: number;
  phrase: string;
  caveat?: string;
}

export const CONFIDENCE_RULES: Record<ConfidenceSource, ConfidenceRule> = {
  live_api: {
    source: 'live_api',
    base_score: 95,
    phrase: 'Em vừa kiểm tra trực tiếp — chắc 95%.',
  },
  graph_data: {
    source: 'graph_data',
    base_score: 88,
    phrase: 'Theo knowledge graph của em — khá chắc.',
  },
  memory_recall: {
    source: 'memory_recall',
    base_score: 80,
    phrase: 'Theo memory của em — anh nên xác nhận lại nếu quan trọng.',
  },
  cached_data: {
    source: 'cached_data',
    base_score: 75,
    phrase: 'Dữ liệu còn khá mới, nhưng chưa được refresh.',
  },
  knowledge_doc: {
    source: 'knowledge_doc',
    base_score: 70,
    phrase: 'Em tìm thấy trong tài liệu — có thể đã cũ.',
  },
  stale_data: {
    source: 'stale_data',
    base_score: 50,
    phrase: 'Em chưa chắc — dữ liệu đã cũ, cần kiểm tra lại.',
    caveat: 'Anh nên verify trực tiếp.',
  },
  inferred: {
    source: 'inferred',
    base_score: 60,
    phrase: 'Em suy luận dựa trên context — chưa confirm trực tiếp.',
    caveat: 'Anh cần xác nhận.',
  },
  unknown: {
    source: 'unknown',
    base_score: 30,
    phrase: 'Em chưa đủ dữ liệu để kết luận.',
    caveat: 'Em đang kiểm tra thêm.',
  },
};

export function scoreToPhrase(score: number): string {
  if (score >= 93) return 'Em chắc khoảng 95%.';
  if (score >= 85) return 'Em khá chắc.';
  if (score >= 70) return 'Em nghĩ vậy — nhưng anh nên xác nhận.';
  if (score >= 50) return 'Em chưa chắc lắm.';
  return 'Em chưa đủ dữ liệu để kết luận.';
}
