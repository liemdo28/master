/**
 * Executive Reflection Engine — Phase 21C
 * Questions conclusions BEFORE reporting to CEO.
 *
 * Every analysis result passes through reflection to:
 * - Identify assumptions and blind spots
 * - Check for alternative explanations
 * - Assess evidence quality and completeness
 * - Assign realistic confidence levels
 * - Flag risks of being wrong
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type EvidenceQuality = 'strong' | 'moderate' | 'weak' | 'absent';

export interface ReflectionAssumption {
  id: string;
  description: string;
  impact_if_wrong: 'low' | 'medium' | 'high';
  can_verify: boolean;
  verification_method?: string;
}

export interface ReflectionRisk {
  id: string;
  description: string;
  probability: 'low' | 'medium' | 'high';
  consequence: string;
  mitigation: string;
}

export interface AlternativeExplanation {
  hypothesis: string;
  plausibility: number; // 0.0 – 1.0
  evidence_for: string[];
  evidence_against: string[];
}

export interface ReflectionResult {
  input_summary: string;
  overall_confidence: number;         // 0.0 – 1.0
  confidence_level: 'very_high' | 'high' | 'moderate' | 'low' | 'very_low';
  assumptions: ReflectionAssumption[];
  risks: ReflectionRisk[];
  alternative_explanations: AlternativeExplanation[];
  evidence_quality: EvidenceQuality;
  missing_evidence: string[];
  blind_spots: string[];
  reflection_timestamp: string;
  recommendation_to_ceo: {
    should_act: boolean;
    urgency: 'immediate' | 'can_wait' | 'needs_more_info';
    summary_vi: string;
    caveats_vi: string;
  };
}

// ── Reflection questions bank ──────────────────────────────────────────────────

const REFLECTION_QUESTIONS = {
  evidence: [
    'Is the evidence based on direct observation or inference?',
    'How recent is this data?',
    'Could the data be stale or corrupted?',
    'Is there corroborating evidence from a second source?',
    'What evidence would change this conclusion?',
  ],
  assumptions: [
    'What are we taking for granted?',
    'Are we assuming past patterns will continue?',
    'Are we assuming the CEO has the same information we do?',
    'Are we assuming a cause-effect relationship that might be correlation?',
    'Are we assuming a worst case that may not be realistic?',
  ],
  alternatives: [
    'What if the opposite is true?',
    'Is there a simpler explanation?',
    'Could there be an external factor we haven\'t considered?',
    'What would a skeptic say about this analysis?',
    'Are we seeing what we expect to see (confirmation bias)?',
  ],
  impact: [
    'How wrong could we be?',
    'What\'s the cost of being wrong?',
    'Is this decision reversible?',
    'Does the CEO need to act now, or can we gather more data?',
    'Are we overestimating or underestimating the urgency?',
  ],
};

// ── Confidence calculation ─────────────────────────────────────────────────────

function calculateConfidence(
  evidenceQuality: EvidenceQuality,
  assumptionCount: number,
  alternativeCount: number,
  riskCount: number,
): number {
  let base: number;
  switch (evidenceQuality) {
    case 'strong': base = 0.9; break;
    case 'moderate': base = 0.7; break;
    case 'weak': base = 0.45; break;
    case 'absent': base = 0.2; break;
  }

  // Penalize for each assumption, alternative, and risk
  const assumptionPenalty = Math.min(0.3, assumptionCount * 0.05);
  const alternativePenalty = Math.min(0.2, alternativeCount * 0.07);
  const riskPenalty = Math.min(0.15, riskCount * 0.03);

  return Math.max(0.05, Math.round((base - assumptionPenalty - alternativePenalty - riskPenalty) * 100) / 100);
}

function getConfidenceLevel(score: number): ReflectionResult['confidence_level'] {
  if (score >= 0.85) return 'very_high';
  if (score >= 0.7) return 'high';
  if (score >= 0.5) return 'moderate';
  if (score >= 0.3) return 'low';
  return 'very_low';
}

function assessEvidenceQuality(findings: string[], evidenceCount: number): EvidenceQuality {
  if (evidenceCount === 0) return 'absent';
  if (evidenceCount >= 4 && findings.some(f => /direct|measured|confirmed|verified/i.test(f))) return 'strong';
  if (evidenceCount >= 2) return 'moderate';
  return 'weak';
}

// ── Reflection engine ──────────────────────────────────────────────────────────

export interface ReflectionInput {
  analysis_type: string;
  findings: string[];
  evidence_count: number;
  conclusions: string[];
  data_sources: string[];
}

export function reflectOnAnalysis(input: ReflectionInput): ReflectionResult {
  // 1. Assess evidence quality
  const evidenceQuality = assessEvidenceQuality(input.findings, input.evidence_count);

  // 2. Generate assumptions
  const assumptions: ReflectionAssumption[] = [];
  if (input.data_sources.length > 0) {
    assumptions.push({
      id: 'data-freshness',
      description: 'Dữ liệu sử dụng phản ánh trạng thái hiện tại',
      impact_if_wrong: 'high',
      can_verify: true,
      verification_method: 'Kiểm tra timestamp dữ liệu đầu vào',
    });
  }
  if (input.conclusions.length > 1) {
    assumptions.push({
      id: 'consistency',
      description: 'Các kết luận nhất quán với nhau',
      impact_if_wrong: 'medium',
      can_verify: true,
      verification_method: 'So sánh chéo các kết luận',
    });
  }
  if (input.findings.length > 0) {
    assumptions.push({
      id: 'completeness',
      description: 'Đã thu thập đủ dữ liệu để đưa ra kết luận',
      impact_if_wrong: 'high',
      can_verify: true,
      verification_method: 'Danh sách kiểm tra dữ liệu còn thiếu',
    });
  }

  // 3. Generate alternative explanations
  const alternatives: AlternativeExplanation[] = [];
  if (input.findings.length > 0) {
    alternatives.push({
      hypothesis: 'Có thể có yếu tố bên ngoài chưa được xem xét',
      plausibility: 0.4,
      evidence_for: ['Môi trường kinh doanh luôn có biến động'],
      evidence_against: input.data_sources.length >= 3 ? ['Đã kiểm tra nhiều nguồn dữ liệu'] : [],
    });
  }
  if (input.conclusions.length > 0) {
    alternatives.push({
      hypothesis: 'Kết luận có thể là do trùng hợp thay vì nguyên nhân thật',
      plausibility: 0.25,
      evidence_for: ['Tương quan không phải nhân quả'],
      evidence_against: input.evidence_count >= 3 ? ['Nhiều bằng chứng đồng thuận'] : [],
    });
  }

  // 4. Generate risks
  const risks: ReflectionRisk[] = [];
  const highImpactAssumptions = assumptions.filter(a => a.impact_if_wrong === 'high');
  for (const a of highImpactAssumptions) {
    risks.push({
      id: `risk-${a.id}`,
      description: `Nếu "${a.description}" là sai → phân tích có thể không chính xác`,
      probability: 'medium',
      consequence: 'Quyết định CEO có thể dựa trên thông tin không đầy đủ',
      mitigation: a.verification_method || 'Cần thêm bằng chứng',
    });
  }

  // 5. Identify missing evidence
  const missingEvidence: string[] = [];
  if (input.evidence_count < 3) {
    missingEvidence.push('Cần thêm nguồn dữ liệu độc lập để xác nhận');
  }
  if (input.data_sources.length < 2) {
    missingEvidence.push('Nên cross-check với ít nhất 1 nguồn dữ liệu khác');
  }

  // 6. Blind spots
  const blindSpots: string[] = [
    'Phân tích có thể bị ảnh hưởng bởi thiên kiến xác nhận (confirmation bias)',
    'Tình hình có thể thay đổi từ khi thu thập dữ liệu',
    'Có thể có thông tin CEO biết mà Mi chưa có',
  ];

  // 7. Calculate confidence
  const confidence = calculateConfidence(
    evidenceQuality,
    assumptions.length,
    alternatives.length,
    risks.length,
  );

  // 8. Recommendation
  const shouldAct = confidence >= 0.5;
  const urgency: ReflectionResult['recommendation_to_ceo']['urgency'] =
    confidence >= 0.7 ? 'immediate' :
    confidence >= 0.5 ? 'can_wait' : 'needs_more_info';

  return {
    input_summary: `${input.analysis_type}: ${input.findings.length} findings, ${input.evidence_count} evidence points`,
    overall_confidence: confidence,
    confidence_level: getConfidenceLevel(confidence),
    assumptions,
    risks,
    alternative_explanations: alternatives,
    evidence_quality: evidenceQuality,
    missing_evidence: missingEvidence,
    blind_spots: blindSpots,
    reflection_timestamp: new Date().toISOString(),
    recommendation_to_ceo: {
      should_act: shouldAct,
      urgency,
      summary_vi: shouldAct
        ? `Phân tích đủ tin cậy (${Math.round(confidence * 100)}%) để báo cáo CEO`
        : `Cần thêm bằng chứng trước khi báo cáo (confidence: ${Math.round(confidence * 100)}%)`,
      caveats_vi: risks.length > 0
        ? `⚠️ ${risks.length} rủi ro cần CEO lưu ý`
        : 'Không có rủi ro lớn từ phân tích',
    },
  };
}

// ── Quick reflect for simple cases ─────────────────────────────────────────────

export function quickReflect(findings: string[]): {
  confidence: number;
  ready: boolean;
  warning?: string;
} {
  if (findings.length === 0) {
    return { confidence: 0.1, ready: false, warning: 'Không có findings để phản chiếu' };
  }
  if (findings.length >= 3) {
    return { confidence: 0.75, ready: true };
  }
  return {
    confidence: 0.5,
    ready: findings.length >= 2,
    warning: findings.length < 2 ? 'Số lượng findings hạn chế' : undefined,
  };
}

// ── Reflection questions getter ────────────────────────────────────────────────

export function getReflectionQuestions(category: keyof typeof REFLECTION_QUESTIONS): string[] {
  return REFLECTION_QUESTIONS[category] || [];
}

export function getAllReflectionQuestions(): typeof REFLECTION_QUESTIONS {
  return REFLECTION_QUESTIONS;
}
