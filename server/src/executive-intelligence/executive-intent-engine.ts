/**
 * Executive Intent Engine — Phase 21A
 * Understands what the CEO actually wants, even from ambiguous statements.
 *
 * Maps vague/ambiguous CEO messages → structured intent hypotheses
 * with confidence scores, enabling the rest of the intelligence layer
 * to reason about the CEO's true intent before acting.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type IntentCategory =
  | 'operational_concern'
  | 'revenue_concern'
  | 'risk_concern'
  | 'service_degradation'
  | 'strategic_question'
  | 'compliance_concern'
  | 'people_concern'
  | 'technology_concern'
  | 'marketing_concern'
  | 'general_status_check'
  | 'urgent_intervention'
  | 'performance_review'
  | 'unknown';

export interface IntentHypothesis {
  intent: IntentCategory;
  label_vi: string;
  confidence: number;           // 0.0 – 1.0
  evidence_keywords: string[];  // which words triggered this
  suggested_investigation: string[];
}

export interface IntentAnalysis {
  raw_message: string;
  is_ambiguous: boolean;
  primary_intent: IntentHypothesis;
  alternatives: IntentHypothesis[];
  recommended_entry_point: string;   // which engine to invoke next
  confidence_threshold_met: boolean; // >= 0.6
  analysis_timestamp: string;
}

// ── Keyword lexicon per intent ─────────────────────────────────────────────────

const INTENT_LEXICON: Record<IntentCategory, {
  keywords_vi: string[];
  keywords_en: string[];
  weight: number;              // base weight for matches
  investigation: string[];
  label_vi: string;
}> = {
  operational_concern: {
    keywords_vi: ['sai', 'lỗi', 'hỏng', 'đổ', 'vấn đề', 'trục trặc', 'không hoạt động', 'stuck', 'kệ', 'máy', 'hệ thống'],
    keywords_en: ['wrong', 'broken', 'issue', 'problem', 'stuck', 'not working', 'error', 'failing'],
    weight: 0.8,
    investigation: ['Check PM2 process health', 'Review error logs', 'Check connector status', 'Verify service uptime'],
    label_vi: 'Lo ngại vận hành',
  },
  revenue_concern: {
    keywords_vi: ['doanh thu', 'thu', 'lỗ', 'lãi', 'tiền', 'doanh số', 'sale', 'revenue', 'profit', 'loss', 'mất tiền'],
    keywords_en: ['revenue', 'profit', 'loss', 'money', 'sales', 'income', 'margin', 'down'],
    weight: 0.85,
    investigation: ['Analyze revenue trends', 'Compare with prior period', 'Check conversion rates', 'Review AOV and traffic'],
    label_vi: 'Lo ngại doanh thu',
  },
  risk_concern: {
    keywords_vi: ['rủi ro', 'nguy hiểm', 'mất', 'đe dọa', 'beo', 'pháp lý', 'kiện', 'nghị định'],
    keywords_en: ['risk', 'danger', 'threat', 'exposed', 'compliance', 'lawsuit', 'regulation'],
    weight: 0.9,
    investigation: ['Run risk scan', 'Review compliance status', 'Check pending approvals', 'Assess exposure'],
    label_vi: 'Rủi ro',
  },
  service_degradation: {
    keywords_vi: ['chậm', 'lag', 'treo', 'timeout', 'nặng', 'quá tải', 'nặng'],
    keywords_en: ['slow', 'lag', 'timeout', 'overloaded', 'latency', 'degraded'],
    weight: 0.75,
    investigation: ['Check response times', 'Review resource usage', 'Check database performance', 'Analyze traffic patterns'],
    label_vi: 'Giảm hiệu năng dịch vụ',
  },
  strategic_question: {
    keywords_vi: ['nên', 'chiến lược', 'kế hoạch', 'tương lai', 'mở rộng', 'đầu tư', 'triển khai'],
    keywords_en: ['should we', 'strategy', 'plan', 'future', 'expand', 'invest', 'deploy'],
    weight: 0.7,
    investigation: ['Review business goals', 'Analyze market conditions', 'Assess resource availability', 'Check competitive landscape'],
    label_vi: 'Câu hỏi chiến lược',
  },
  compliance_concern: {
    keywords_vi: ['pháp luật', 'quy định', 'tuân thủ', 'license', 'giấy phép', 'bảo hiểm'],
    keywords_en: ['compliance', 'regulation', 'license', 'permit', 'insurance', 'audit'],
    weight: 0.8,
    investigation: ['Check license expiry dates', 'Review compliance status', 'Verify insurance coverage', 'Check regulatory updates'],
    label_vi: 'Tuân thủ pháp luật',
  },
  people_concern: {
    keywords_vi: ['nhân viên', 'tuyển', 'sa thải', 'nghỉ', 'lương', 'phòng nhân sự', 'HR'],
    keywords_en: ['employee', 'hire', 'fire', 'quit', 'salary', 'staff', 'HR', 'turnover'],
    weight: 0.7,
    investigation: ['Review staffing levels', 'Check attendance', 'Review pending HR items', 'Assess team performance'],
    label_vi: 'Lo ngại nhân sự',
  },
  technology_concern: {
    keywords_vi: ['server', 'database', 'API', 'code', 'bug', 'deploy', 'update', 'phát triển'],
    keywords_en: ['server', 'database', 'API', 'code', 'bug', 'deploy', 'update', 'develop'],
    weight: 0.7,
    investigation: ['Check server health', 'Review recent deployments', 'Check error rates', 'Assess technical debt'],
    label_vi: 'Lo ngại công nghệ',
  },
  marketing_concern: {
    keywords_vi: ['marketing', 'quảng cáo', 'campaign', 'SEO', 'social', 'review', 'rating', 'brand'],
    keywords_en: ['marketing', 'advertising', 'campaign', 'SEO', 'social', 'review', 'rating', 'brand'],
    weight: 0.7,
    investigation: ['Review campaign performance', 'Check review scores', 'Analyze traffic sources', 'Assess brand sentiment'],
    label_vi: 'Lo ngại marketing',
  },
  general_status_check: {
    keywords_vi: ['thế nào', 'ra sao', 'okay', 'bình thường', 'ổn', 'tốt', 'update', 'trạng thái'],
    keywords_en: ['how are we', 'status', 'okay', 'fine', 'update', 'doing', 'going'],
    weight: 0.5,
    investigation: ['Run health check', 'Review active priorities', 'Check pending actions', 'Summarize current state'],
    label_vi: 'Kiểm tra tổng quát',
  },
  urgent_intervention: {
    keywords_vi: ['gấp', 'khẩn cấp', 'emergency', 'now', 'ngay', 'cứu', 'hãy nhanh'],
    keywords_en: ['urgent', 'emergency', 'asap', 'now', 'immediately', 'critical', 'help'],
    weight: 1.0,
    investigation: ['Identify most critical issue', 'Check service health', 'Review active incidents', 'Assess blocking items'],
    label_vi: 'Can thiệp khẩn cấp',
  },
  performance_review: {
    keywords_vi: ['đánh giá', 'review', 'hiệu suất', 'performance', 'kpi', 'metric'],
    keywords_en: ['evaluate', 'review', 'performance', 'KPI', 'metric', 'score'],
    weight: 0.65,
    investigation: ['Gather performance metrics', 'Compare against targets', 'Review department scores', 'Identify improvement areas'],
    label_vi: 'Đánh giá hiệu suất',
  },
  unknown: {
    keywords_vi: [],
    keywords_en: [],
    weight: 0.0,
    investigation: ['Ask for clarification', 'Review recent context', 'Check for known patterns'],
    label_vi: 'Chưa xác định',
  },
};

// ── Ambiguity detection ────────────────────────────────────────────────────────

const AMBIGUOUS_PATTERNS = [
  // Vietnamese
  /cảm giác/i,
  /có vẻ/i,
  /hơi/i,
  /dạo này/i,
  /không biết/i,
  /thấy.*sai/i,
  /thấy.*kỳ/i,
  /có gì.*không/i,
  /như thế nào/i,
  /thế nào/i,
  // English
  /something feels/i,
  /something seems/i,
  /i think/i,
  /not sure/i,
  /i feel like/i,
  /weird/i,
  /off today/i,
  /anything wrong/i,
  /any concern/i,
];

// ── Engine ─────────────────────────────────────────────────────────────────────

export function analyzeIntent(message: string): IntentAnalysis {
  const text = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const rawText = message.toLowerCase();

  // Detect ambiguity
  const isAmbiguous = AMBIGUOUS_PATTERNS.some(p => p.test(message));

  // Score each intent category
  const hypotheses: IntentHypothesis[] = [];

  for (const [category, lexicon] of Object.entries(INTENT_LEXICON)) {
    if (category === 'unknown') continue;

    const matchedKeywords: string[] = [];
    let matchScore = 0;

    // Check Vietnamese keywords
    for (const kw of lexicon.keywords_vi) {
      const kwNorm = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (text.includes(kwNorm) || rawText.includes(kw.toLowerCase())) {
        matchedKeywords.push(kw);
        matchScore += lexicon.weight;
      }
    }

    // Check English keywords
    for (const kw of lexicon.keywords_en) {
      if (rawText.includes(kw.toLowerCase())) {
        matchedKeywords.push(kw);
        matchScore += lexicon.weight;
      }
    }

    if (matchedKeywords.length > 0) {
      // Normalize confidence: more matches = higher confidence, capped at 1.0
      const confidence = Math.min(1.0, matchScore / (matchedKeywords.length > 0 ? matchedKeywords.length : 1));

      hypotheses.push({
        intent: category as IntentCategory,
        label_vi: lexicon.label_vi,
        confidence: Math.round(confidence * 100) / 100,
        evidence_keywords: matchedKeywords,
        suggested_investigation: lexicon.investigation,
      });
    }
  }

  // Sort by confidence descending
  hypotheses.sort((a, b) => b.confidence - a.confidence);

  // If no matches, fall back to general status check
  if (hypotheses.length === 0) {
    hypotheses.push({
      intent: 'general_status_check',
      label_vi: 'Kiểm tra tổng quát',
      confidence: 0.4,
      evidence_keywords: [],
      suggested_investigation: ['Run health check', 'Review active priorities', 'Check pending actions'],
    });
  }

  const primary = hypotheses[0];
  const alternatives = hypotheses.slice(1);

  // Determine entry point
  const entryPointMap: Record<IntentCategory, string> = {
    operational_concern: 'executive-planner → health-audit',
    revenue_concern: 'business-reasoning-engine → revenue-analysis',
    risk_concern: 'executive-decision-engine → risk-assessment',
    service_degradation: 'executive-planner → service-diagnostic',
    strategic_question: 'executive-planner → strategic-analysis',
    compliance_concern: 'executive-decision-engine → compliance-check',
    people_concern: 'business-reasoning-engine → people-analysis',
    technology_concern: 'executive-planner → tech-diagnostic',
    marketing_concern: 'business-reasoning-engine → marketing-analysis',
    general_status_check: 'executive-brief → quick-status',
    urgent_intervention: 'executive-planner → emergency-response',
    performance_review: 'executive-planner → performance-audit',
    unknown: 'ask-clarification',
  };

  return {
    raw_message: message,
    is_ambiguous: isAmbiguous,
    primary_intent: primary,
    alternatives,
    recommended_entry_point: entryPointMap[primary.intent] || 'ask-clarification',
    confidence_threshold_met: primary.confidence >= 0.6,
    analysis_timestamp: new Date().toISOString(),
  };
}

// ── Quick helper for pipeline integration ──────────────────────────────────────

export function isAmbiguousMessage(message: string): boolean {
  return AMBIGUOUS_PATTERNS.some(p => p.test(message));
}

export function getQuickIntent(message: string): IntentCategory {
  const analysis = analyzeIntent(message);
  return analysis.primary_intent.intent;
}
