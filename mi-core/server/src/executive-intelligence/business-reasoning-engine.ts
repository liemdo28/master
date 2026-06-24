/**
 * Business Reasoning Engine — Phase 21D
 * Thinks like a business operator, not just a workflow engine.
 *
 * Given a business signal (revenue drop, cost increase, etc.),
 * generates multi-dimensional hypotheses, ranks them by probability,
 * and recommends specific actions with expected outcomes.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type BusinessDimension =
  | 'traffic'
  | 'conversion'
  | 'aov'           // average order value
  | 'reviews'
  | 'campaigns'
  | 'marketing'
  | 'competition'
  | 'operations'
  | 'labor'
  | 'seasonality'
  | 'pricing'
  | 'product'
  | 'location'
  | 'technology'
  | 'compliance';

export type HypothesisProbability = 'very_likely' | 'likely' | 'possible' | 'unlikely' | 'very_unlikely';

export interface BusinessHypothesis {
  id: string;
  dimension: BusinessDimension;
  title_vi: string;
  description: string;
  probability: HypothesisProbability;
  probability_score: number;   // 0.0 – 1.0
  evidence: string[];
  counter_evidence: string[];
  recommended_actions: string[];
  expected_impact: string;
  data_needed: string[];
}

export interface BusinessSignal {
  type: string;             // e.g. 'revenue_drop', 'cost_increase', 'complaint_spike'
  magnitude: number;        // e.g. -12 for 12% drop
  period: string;           // e.g. 'last_7_days'
  context: Record<string, unknown>;
}

export interface BusinessAnalysis {
  signal: BusinessSignal;
  hypotheses: BusinessHypothesis[];
  top_3_actions: string[];
  overall_assessment: string;
  confidence: number;
  analysis_timestamp: string;
}

// ── Hypothesis generators per signal type ──────────────────────────────────────

interface HypothesisTemplate {
  dimension: BusinessDimension;
  title_vi: string;
  description: string;
  getEvidence: (signal: BusinessSignal) => string[];
  getActions: () => string[];
  baseProbability: (magnitude: number) => number;
}

const REVENUE_DROP_HYPOTHESES: HypothesisTemplate[] = [
  {
    dimension: 'traffic',
    title_vi: 'Giảm lưu lượng truy cập',
    description: 'Lượng khách hàng truy cập website/app giảm so với kỳ trước',
    getEvidence: (s) => [`Doanh thu giảm ${Math.abs(s.magnitude)}%`, 'Có thể lượng truy cập giảm tương ứng'],
    getActions: () => ['Kiểm tra analytics traffic 7 ngày gần nhất', 'So sánh traffic tuần này vs tuần trước', 'Kiểm tra traffic từ các kênh chính'],
    baseProbability: (m) => Math.min(0.8, 0.4 + Math.abs(m) * 0.02),
  },
  {
    dimension: 'conversion',
    title_vi: 'Giảm tỷ lệ chuyển đổi',
    description: 'Khách hàng truy cập nhưng ít đặt hàng hơn',
    getEvidence: (s) => [`Doanh thu giảm ${Math.abs(s.magnitude)}%`, 'Traffic có thể ổn định nhưng conversion giảm'],
    getActions: () => ['Kiểm tra conversion funnel', 'Review UX checkout flow', 'Kiểm tra giá có competitive không'],
    baseProbability: (m) => Math.min(0.7, 0.3 + Math.abs(m) * 0.015),
  },
  {
    dimension: 'aov',
    title_vi: 'Giảm giá trị đơn hàng trung bình',
    description: 'Khách hàng đặt ít hơn mỗi đơn hàng',
    getEvidence: (s) => [`Doanh thu giảm ${Math.abs(s.magnitude)}%`, 'AOV giảm = mỗi khách trả ít hơn'],
    getActions: () => ['Kiểm tra AOV 7/30 ngày', 'Review upsell/cross-sell performance', 'Kiểm tra combo deals'],
    baseProbability: (m) => Math.min(0.6, 0.25 + Math.abs(m) * 0.012),
  },
  {
    dimension: 'seasonality',
    title_vi: 'Ảnh hưởng mùa vụ',
    description: 'Doanh thu giảm do yếu tố thời vụ tự nhiên',
    getEvidence: (s) => ['So sánh cùng kỳ năm trước', 'Xu hướng ngành hàng trong giai đoạn này'],
    getActions: () => ['So sánh doanh thu cùng kỳ năm trước', 'Kiểm tra xu hướng ngành', 'Xác định xem có phải mùa thấp điểm không'],
    baseProbability: (m) => 0.3,
  },
  {
    dimension: 'competition',
    title_vi: 'Áp lực cạnh tranh',
    description: 'Đối thủ mới hoặc chương trình khuyến mãi mạnh hơn',
    getEvidence: (s) => ['Có đối thủ mới khai trương?', 'Đối thủ có chương trình promo lớn không?'],
    getActions: () => ['Kiểm tra hoạt động đối thủ gần đây', 'So sánh giá và khuyến mãi', 'Đánh giá market share'],
    baseProbability: (m) => 0.25,
  },
  {
    dimension: 'reviews',
    title_vi: 'Đánh giá tiêu cực',
    description: 'Review xấu tăng, ảnh hưởng đến quyết định mua hàng',
    getEvidence: (s) => ['Kiểm tra review trên Google/Yelp', 'Negative sentiment tăng?'],
    getActions: () => ['Kiểm tra reviews 7 ngày gần nhất', 'So sánh rating trung bình', 'Phân tích complaint patterns'],
    baseProbability: (m) => 0.2,
  },
  {
    dimension: 'operations',
    title_vi: 'Vấn đề vận hành',
    description: 'Mất hàng, hết hàng, chậm trễ giao hàng ảnh hưởng doanh thu',
    getEvidence: (s) => ['Kiểm tra inventory levels', 'Tình trạng giao hàng gần đây'],
    getActions: () => ['Kiểm tra inventory/hàng tồn', 'Review order fulfillment rate', 'Kiểm tra supplier status'],
    baseProbability: (m) => 0.2,
  },
  {
    dimension: 'pricing',
    title_vi: 'Vấn đề về giá',
    description: 'Giá không competitive hoặc thay đổi giá ảnh hưởng demand',
    getEvidence: (s) => ['Kiểm tra lịch sử thay đổi giá', 'So sánh giá với đối thủ'],
    getActions: () => ['Review pricing history', 'So sánh giá với competitors', 'Kiểm tra margin analysis'],
    baseProbability: (m) => 0.15,
  },
  {
    dimension: 'marketing',
    title_vi: 'Giảm hiệu quả marketing',
    description: 'Campaign không hiệu quả, ROI quảng cáo giảm',
    getEvidence: (s) => ['Kiểm tra ROAS', 'Ad spend efficiency'],
    getActions: () => ['Kiểm tra ROAS 7 ngày', 'Review campaign performance', 'So sánh CPA với benchmark'],
    baseProbability: (m) => 0.2,
  },
  {
    dimension: 'labor',
    title_vi: 'Vấn đề nhân sự',
    description: 'Thiếu nhân viên ảnh hưởng chất lượng dịch vụ',
    getEvidence: (s) => ['Kiểm tra staffing level', 'Turnover rate gần đây'],
    getActions: () => ['Kiểm tra staffing vs schedule', 'Review employee availability', 'Đánh giá training gaps'],
    baseProbability: (m) => 0.15,
  },
];

const COMPLAINT_SPIKE_HYPOTHESES: HypothesisTemplate[] = [
  {
    dimension: 'operations',
    title_vi: 'Giảm chất lượng dịch vụ',
    description: 'Phản ánh từ khách hàng tăng do vấn đề vận hành',
    getEvidence: (s) => ['So sánh số lượng complaint kỳ này vs trước', 'Phân tích loại complaint'],
    getActions: () => ['Phân loại top complaints', 'Kiểm tra QA scores', 'Review staff performance'],
    baseProbability: () => 0.7,
  },
  {
    dimension: 'product',
    title_vi: 'Vấn đề sản phẩm',
    description: 'Chất lượng sản phẩm giảm hoặc thay đổi không đúng kỳ vọng',
    getEvidence: (s) => ['Có thay đổi recipe/supplier không?', 'Inventory fresh date issues?'],
    getActions: () => ['Kiểm tra thay đổi recipe', 'Review supplier quality', 'Check inventory freshness'],
    baseProbability: () => 0.4,
  },
  {
    dimension: 'technology',
    title_vi: 'Vấn đề hệ thống đặt hàng',
    description: 'Bug hoặc downtime hệ thống đặt hàng gây khó khăn cho khách',
    getEvidence: (s) => ['Kiểm tra hệ thống đặt hàng', 'App/website uptime'],
    getActions: () => ['Review order system logs', 'Check app crash reports', 'Verify website uptime'],
    baseProbability: () => 0.25,
  },
];

const COST_INCREASE_HYPOTHESES: HypothesisTemplate[] = [
  {
    dimension: 'pricing',
    title_vi: 'Tăng giá nguyên liệu',
    description: 'Chi phí nguyên liệu đầu vào tăng',
    getEvidence: (s) => [`Chi phí tăng ${s.magnitude}%`, 'So sánh giá suppliers'],
    getActions: () => ['Review supplier invoices', 'Compare prices across suppliers', 'Check commodity market trends'],
    baseProbability: () => 0.6,
  },
  {
    dimension: 'labor',
    title_vi: 'Tăng chi phí nhân công',
    description: 'Labor costs tăng do overtime, turnover, hoặc wage increase',
    getEvidence: (s) => ['Review labor cost breakdown', 'Overtime hours analysis'],
    getActions: () => ['Analyze labor cost components', 'Review scheduling efficiency', 'Check overtime trends'],
    baseProbability: () => 0.4,
  },
  {
    dimension: 'operations',
    title_vi: 'Waste và inefficiency',
    description: 'Chi phí tăng do lãng phí hoặc quy trình không hiệu quả',
    getEvidence: (s) => ['Waste tracking data', 'Process efficiency metrics'],
    getActions: () => ['Review waste logs', 'Audit operational processes', 'Identify bottlenecks'],
    baseProbability: () => 0.3,
  },
];

const SIGNAL_HYPOTHESIS_MAP: Record<string, HypothesisTemplate[]> = {
  revenue_drop: REVENUE_DROP_HYPOTHESES,
  complaint_spike: COMPLAINT_SPIKE_HYPOTHESES,
  cost_increase: COST_INCREASE_HYPOTHESES,
};

// ── Probability ranking ────────────────────────────────────────────────────────

function scoreToProbability(score: number): HypothesisProbability {
  if (score >= 0.7) return 'very_likely';
  if (score >= 0.5) return 'likely';
  if (score >= 0.3) return 'possible';
  if (score >= 0.15) return 'unlikely';
  return 'very_unlikely';
}

// ── Engine ─────────────────────────────────────────────────────────────────────

let hypothesisCounter = 0;

export function analyzeBusinessSignal(signal: BusinessSignal): BusinessAnalysis {
  const templates = SIGNAL_HYPOTHESIS_MAP[signal.type] || REVENUE_DROP_HYPOTHESES;

  const hypotheses: BusinessHypothesis[] = templates.map(template => {
    const probScore = Math.min(1.0, Math.max(0.05, template.baseProbability(signal.magnitude)));
    hypothesisCounter++;

    return {
      id: `hyp-${hypothesisCounter}`,
      dimension: template.dimension,
      title_vi: template.title_vi,
      description: template.description,
      probability: scoreToProbability(probScore),
      probability_score: probScore,
      evidence: template.getEvidence(signal),
      counter_evidence: [],
      recommended_actions: template.getActions(),
      expected_impact: `Xác suất ${Math.round(probScore * 100)}% là nguyên nhân`,
      data_needed: [],
    };
  });

  // Sort by probability
  hypotheses.sort((a, b) => b.probability_score - a.probability_score);

  // Top 3 actions
  const topActions = hypotheses.slice(0, 3).flatMap(h => h.recommended_actions.slice(0, 1));

  // Overall assessment
  const topHypothesis = hypotheses[0];
  const overallAssessment = [
    `Signal: ${signal.type} (${signal.magnitude > 0 ? '+' : ''}${signal.magnitude}%)`,
    `Most likely cause: ${topHypothesis.title_vi} (probability: ${Math.round(topHypothesis.probability_score * 100)}%)`,
    `Dimensions analyzed: ${hypotheses.length}`,
  ].join('\n');

  return {
    signal,
    hypotheses,
    top_3_actions: topActions,
    overall_assessment: overallAssessment,
    confidence: topHypothesis.probability_score,
    analysis_timestamp: new Date().toISOString(),
  };
}

// ── Generic business question analyzer ─────────────────────────────────────────

export interface BusinessQuestion {
  question: string;
  context?: Record<string, unknown>;
}

export interface BusinessQuestionAnalysis {
  question: string;
  dimensions_to_investigate: BusinessDimension[];
  data_sources_needed: string[];
  reasoning_approach: string;
  expected_output: string;
}

export function analyzeBusinessQuestion(q: BusinessQuestion): BusinessQuestionAnalysis {
  const text = q.question.toLowerCase();
  const dimensions: BusinessDimension[] = [];

  if (/revenue|doanh thu|sales|sale|thu/.test(text)) dimensions.push('traffic', 'conversion', 'aov');
  if (/cost|chi phí|expense|labor|nhân công/.test(text)) dimensions.push('labor', 'operations', 'pricing');
  if (/customer|khách|review|phản ánh|complaint/.test(text)) dimensions.push('reviews', 'operations', 'product');
  if (/marketing|campaign|ad|quảng cáo/.test(text)) dimensions.push('campaigns', 'traffic');
  if (/competition|cạnh tranh|đối thủ/.test(text)) dimensions.push('competition', 'pricing');
  if (/profit|lợi nhuận|margin|lãi/.test(text)) dimensions.push('pricing', 'operations', 'labor');
  if (/expand|mở rộng|grow|phát triển/.test(text)) dimensions.push('location', 'product', 'competition');

  if (dimensions.length === 0) {
    dimensions.push('traffic', 'conversion', 'operations');
  }

  return {
    question: q.question,
    dimensions_to_investigate: dimensions,
    data_sources_needed: dimensions.map(d => `${d}_data`),
    reasoning_approach: `Multi-dimensional analysis across ${dimensions.length} business areas`,
    expected_output: 'Ranked hypotheses with evidence and recommended actions',
  };
}

// ── Helper: format analysis for CEO ────────────────────────────────────────────

export function formatBusinessAnalysis(analysis: BusinessAnalysis): string {
  const lines: string[] = [
    `📊 *Business Analysis — ${analysis.signal.type}*`,
    `Signal: ${analysis.signal.magnitude > 0 ? '+' : ''}${analysis.signal.magnitude}% (${analysis.signal.period})`,
    '',
    '*Hypotheses (ranked by probability):*',
  ];

  for (const h of analysis.hypotheses.slice(0, 5)) {
    const icon = h.probability_score >= 0.5 ? '🔴' : h.probability_score >= 0.3 ? '🟠' : '🟡';
    lines.push(`${icon} *${h.title_vi}* (${Math.round(h.probability_score * 100)}%)`);
    lines.push(`  ${h.description}`);
    if (h.recommended_actions.length > 0) {
      lines.push(`  → ${h.recommended_actions[0]}`);
    }
    lines.push('');
  }

  lines.push('*Top 3 Actions:*');
  for (const action of analysis.top_3_actions) {
    lines.push(`1. ${action}`);
  }

  return lines.join('\n');
}
