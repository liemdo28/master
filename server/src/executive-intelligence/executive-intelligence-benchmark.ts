/**
 * Executive Intelligence Benchmark — Phase 21I
 * 50 scenarios across 8 categories testing Mi's executive intelligence.
 *
 * Categories: Operations, Finance, Engineering, Infrastructure,
 * Restaurant, Marketing, Compliance, Strategy
 *
 * Scores: Intent understanding, Planning quality, Reasoning quality,
 * Reflection quality, Decision quality, Executive usefulness
 */

import { processCEOInput, IntelligenceResult } from './executive-intelligence-orchestrator';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BenchmarkScenario {
  id: number;
  category: string;
  input: string;
  expected_intent: string;
  expected_mode: 'quick' | 'full' | 'emergency' | 'strategic';
  must_contain: string[];      // brief must contain at least one of these
  must_NOT_contain: string[];  // brief must NOT contain these
  min_confidence: number;      // minimum confidence threshold
}

export interface BenchmarkScore {
  scenario_id: number;
  intent_correct: boolean;
  mode_correct: boolean;
  confidence_acceptable: boolean;
  has_required_content: boolean;
  no_forbidden_content: boolean;
  overall_score: number;       // 0-100
  brief_quality: number;       // 0-100
  processing_time_ms: number;
}

export interface BenchmarkReport {
  total_scenarios: number;
  passed: number;
  failed: number;
  overall_score: number;       // average across all scenarios
  by_category: Record<string, { total: number; passed: number; score: number }>;
  by_dimension: {
    intent_understanding: number;
    planning_quality: number;
    reasoning_quality: number;
    reflection_quality: number;
    decision_quality: number;
    executive_usefulness: number;
  };
  execution_time_ms: number;
  certification: 'EXECUTIVE_INTELLIGENCE_OPERATIONAL' | 'EXECUTIVE_INTELLIGENCE_PARTIAL' | 'EXECUTIVE_INTELLIGENCE_INSUFFICIENT';
  failing_scenarios: BenchmarkScore[];
}

// ── 50 Test Scenarios ─────────────────────────────────────────────────────────

const SCENARIOS: BenchmarkScenario[] = [
  // ═══ OPERATIONS (7 scenarios) ═══
  { id: 1, category: 'Operations', input: 'Something feels wrong today.', expected_intent: 'operational_concern', expected_mode: 'full', must_contain: ['phân tích', 'kiểm tra'], must_NOT_contain: [], min_confidence: 0.4 },
  { id: 2, category: 'Operations', input: 'System đang bị lỗi', expected_intent: 'operational_concern', expected_mode: 'full', must_contain: ['health', 'PM2', 'service'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 3, category: 'Operations', input: 'Are the services running okay?', expected_intent: 'general_status_check', expected_mode: 'quick', must_contain: ['status', 'health'], must_NOT_contain: [], min_confidence: 0.3 },
  { id: 4, category: 'Operations', input: 'Có gì sai ở hệ thống không?', expected_intent: 'operational_concern', expected_mode: 'full', must_contain: ['kiểm tra', 'hệ thống'], must_NOT_contain: [], min_confidence: 0.4 },
  { id: 5, category: 'Operations', input: 'Dashboard không load được', expected_intent: 'technology_concern', expected_mode: 'full', must_contain: ['server', 'API'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 6, category: 'Operations', input: 'Có vẻ chậm quá', expected_intent: 'service_degradation', expected_mode: 'full', must_contain: ['hiệu năng', 'performance'], must_NOT_contain: [], min_confidence: 0.4 },
  { id: 7, category: 'Operations', input: 'Process crashed紧急', expected_intent: 'urgent_intervention', expected_mode: 'emergency', must_contain: ['khẩn cấp', 'emergency', 'EMERGENCY'], must_NOT_contain: [], min_confidence: 0.6 },

  // ═══ FINANCE (7 scenarios) ═══
  { id: 8, category: 'Finance', input: 'Revenue down 12% this week', expected_intent: 'revenue_concern', expected_mode: 'strategic', must_contain: ['doanh thu', 'traffic', 'conversion'], must_NOT_contain: [], min_confidence: 0.6 },
  { id: 9, category: 'Finance', input: 'Doanh thu giảm 15%', expected_intent: 'revenue_concern', expected_mode: 'strategic', must_contain: ['hypothesis', 'revenue'], must_NOT_contain: [], min_confidence: 0.6 },
  { id: 10, category: 'Finance', input: 'How much are we spending on labor?', expected_intent: 'general_status_check', expected_mode: 'quick', must_contain: ['labor', 'nhân công'], must_NOT_contain: [], min_confidence: 0.3 },
  { id: 11, category: 'Finance', input: 'Costs are way too high this month', expected_intent: 'revenue_concern', expected_mode: 'strategic', must_contain: ['chi phí', 'cost'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 12, category: 'Finance', input: 'Profit margin is shrinking', expected_intent: 'revenue_concern', expected_mode: 'strategic', must_contain: ['margin', 'pricing'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 13, category: 'Finance', input: 'Lỗ quá nhiều tiền', expected_intent: 'revenue_concern', expected_mode: 'strategic', must_contain: ['doanh thu', 'lỗ'], must_NOT_contain: [], min_confidence: 0.6 },
  { id: 14, category: 'Finance', input: 'Should we invest in a new POS system?', expected_intent: 'strategic_question', expected_mode: 'strategic', must_contain: ['chiến lược', 'lựa chọn'], must_NOT_contain: [], min_confidence: 0.5 },

  // ═══ ENGINEERING (7 scenarios) ═══
  { id: 15, category: 'Engineering', input: 'API is returning 500 errors', expected_intent: 'technology_concern', expected_mode: 'full', must_contain: ['server', 'infrastructure'], must_NOT_contain: [], min_confidence: 0.6 },
  { id: 16, category: 'Engineering', input: 'Need to deploy the new feature', expected_intent: 'technology_concern', expected_mode: 'full', must_contain: ['deploy', 'server'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 17, category: 'Engineering', input: 'Database is slow', expected_intent: 'technology_concern', expected_mode: 'full', must_contain: ['database', 'infrastructure'], must_NOT_contain: [], min_confidence: 0.6 },
  { id: 18, category: 'Engineering', input: 'Code quality review needed', expected_intent: 'technology_concern', expected_mode: 'full', must_contain: ['code', 'quality'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 19, category: 'Engineering', input: 'Bug đang ảnh hưởng đến khách hàng', expected_intent: 'technology_concern', expected_mode: 'full', must_contain: ['bug', 'khách'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 20, category: 'Engineering', input: 'Should we rebuild the notification system?', expected_intent: 'strategic_question', expected_mode: 'strategic', must_contain: ['chiến lược', 'lựa chọn'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 21, category: 'Engineering', input: 'Server load is spiking', expected_intent: 'service_degradation', expected_mode: 'full', must_contain: ['hiệu năng', 'server'], must_NOT_contain: [], min_confidence: 0.5 },

  // ═══ INFRASTRUCTURE (6 scenarios) ═══
  { id: 22, category: 'Infrastructure', input: 'PM2 processes are restarting', expected_intent: 'technology_concern', expected_mode: 'full', must_contain: ['PM2', 'process'], must_NOT_contain: [], min_confidence: 0.6 },
  { id: 23, category: 'Infrastructure', input: 'WhatsApp connector is down', expected_intent: 'operational_concern', expected_mode: 'full', must_contain: ['WhatsApp', 'connector'], must_NOT_contain: [], min_confidence: 0.6 },
  { id: 24, category: 'Infrastructure', input: 'Node network healthy?', expected_intent: 'general_status_check', expected_mode: 'quick', must_contain: ['health', 'node'], must_NOT_contain: [], min_confidence: 0.3 },
  { id: 25, category: 'Infrastructure', input: 'Disk space almost full', expected_intent: 'technology_concern', expected_mode: 'full', must_contain: ['disk', 'space', 'server'], must_NOT_contain: [], min_confidence: 0.6 },
  { id: 26, category: 'Infrastructure', input: 'Cần update server', expected_intent: 'technology_concern', expected_mode: 'full', must_contain: ['server', 'update'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 27, category: 'Infrastructure', input: 'SSL certificate expiring soon', expected_intent: 'compliance_concern', expected_mode: 'full', must_contain: ['license', 'certificate', 'SSL'], must_NOT_contain: [], min_confidence: 0.6 },

  // ═══ RESTAURANT (6 scenarios) ═══
  { id: 28, category: 'Restaurant', input: 'Food safety compliance check needed', expected_intent: 'compliance_concern', expected_mode: 'full', must_contain: ['compliance', 'food safety'], must_NOT_contain: [], min_confidence: 0.6 },
  { id: 29, category: 'Restaurant', input: 'Bakudan kitchen staff shortage', expected_intent: 'people_concern', expected_mode: 'full', must_contain: ['nhân sự', 'staff', 'labor'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 30, category: 'Restaurant', input: 'Customer reviews are dropping', expected_intent: 'marketing_concern', expected_mode: 'strategic', must_contain: ['review', 'marketing'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 31, category: 'Restaurant', input: 'Raw Sushi inventory low', expected_intent: 'operational_concern', expected_mode: 'full', must_contain: ['inventory', 'vận hành'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 32, category: 'Restaurant', input: 'Should we open a third location?', expected_intent: 'strategic_question', expected_mode: 'strategic', must_contain: ['chiến lược', 'mở rộng'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 33, category: 'Restaurant', input: 'Supplier prices going up', expected_intent: 'revenue_concern', expected_mode: 'strategic', must_contain: ['chi phí', 'nguyên liệu'], must_NOT_contain: [], min_confidence: 0.5 },

  // ═══ MARKETING (6 scenarios) ═══
  { id: 34, category: 'Marketing', input: 'SEO rankings dropped', expected_intent: 'marketing_concern', expected_mode: 'strategic', must_contain: ['SEO', 'marketing', 'traffic'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 35, category: 'Marketing', input: 'Social media engagement is down', expected_intent: 'marketing_concern', expected_mode: 'strategic', must_contain: ['social', 'marketing'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 36, category: 'Marketing', input: 'Campaign ROI not good', expected_intent: 'marketing_concern', expected_mode: 'strategic', must_contain: ['campaign', 'ROI'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 37, category: 'Marketing', input: 'Google review rating falling', expected_intent: 'marketing_concern', expected_mode: 'strategic', must_contain: ['review', 'rating'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 38, category: 'Marketing', input: 'Brand reputation concern', expected_intent: 'marketing_concern', expected_mode: 'strategic', must_contain: ['brand', 'reputation'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 39, category: 'Marketing', input: 'Cần chạy quảng cáo mới', expected_intent: 'marketing_concern', expected_mode: 'full', must_contain: ['quảng cáo', 'campaign'], must_NOT_contain: [], min_confidence: 0.5 },

  // ═══ COMPLIANCE (6 scenarios) ═══
  { id: 40, category: 'Compliance', input: 'Business license renewal due', expected_intent: 'compliance_concern', expected_mode: 'full', must_contain: ['license', 'compliance'], must_NOT_contain: [], min_confidence: 0.6 },
  { id: 41, category: 'Compliance', input: 'Insurance policy expiring', expected_intent: 'compliance_concern', expected_mode: 'full', must_contain: ['insurance', 'compliance'], must_NOT_contain: [], min_confidence: 0.6 },
  { id: 42, category: 'Compliance', input: 'Any compliance risks?', expected_intent: 'compliance_concern', expected_mode: 'full', must_contain: ['compliance', 'rủi ro'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 43, category: 'Compliance', input: 'Health inspection next week', expected_intent: 'compliance_concern', expected_mode: 'full', must_contain: ['compliance', 'inspection'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 44, category: 'Compliance', input: 'Labor law changes affect us?', expected_intent: 'compliance_concern', expected_mode: 'strategic', must_contain: ['compliance', 'labor'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 45, category: 'Compliance', input: 'Pháp lý mới có ảnh hưởng không?', expected_intent: 'compliance_concern', expected_mode: 'full', must_contain: ['compliance', 'pháp luật'], must_NOT_contain: [], min_confidence: 0.5 },

  // ═══ STRATEGY (5 scenarios) ═══
  { id: 46, category: 'Strategy', input: 'What should I focus on today?', expected_intent: 'general_status_check', expected_mode: 'quick', must_contain: ['tổng quan', 'priority', 'ưu tiên'], must_NOT_contain: [], min_confidence: 0.3 },
  { id: 47, category: 'Strategy', input: 'How are we doing overall?', expected_intent: 'general_status_check', expected_mode: 'quick', must_contain: ['status', 'tổng'], must_NOT_contain: [], min_confidence: 0.3 },
  { id: 48, category: 'Strategy', input: 'Any worrying trends?', expected_intent: 'operational_concern', expected_mode: 'full', must_contain: ['rủi ro', 'risk'], must_NOT_contain: [], min_confidence: 0.4 },
  { id: 49, category: 'Strategy', input: 'Should we expand to new city?', expected_intent: 'strategic_question', expected_mode: 'strategic', must_contain: ['chiến lược', 'mở rộng'], must_NOT_contain: [], min_confidence: 0.5 },
  { id: 50, category: 'Strategy', input: 'Mối lo lớn nhấtตอน này là gì?', expected_intent: 'risk_concern', expected_mode: 'full', must_contain: ['rủi ro', 'risk', 'lỗi'], must_NOT_contain: [], min_confidence: 0.4 },
];

// ── Scoring ────────────────────────────────────────────────────────────────────

function scoreScenario(scenario: BenchmarkScenario, result: IntelligenceResult): BenchmarkScore {
  const briefText = result.brief.formatted_whatsapp + ' ' + result.brief.formatted_markdown;

  // Intent correctness
  const intentCorrect = result.intent.primary_intent.intent === scenario.expected_intent;

  // Mode correctness
  const modeCorrect = result.mode === scenario.expected_mode;

  // Confidence acceptable
  const confidenceAcceptable = result.brief.confidence >= scenario.min_confidence;

  // Required content
  const hasRequired = scenario.must_contain.length === 0 ||
    scenario.must_contain.some(keyword => briefText.toLowerCase().includes(keyword.toLowerCase()));

  // Forbidden content
  const noForbidden = scenario.must_NOT_contain.length === 0 ||
    !scenario.must_NOT_contain.some(keyword => briefText.toLowerCase().includes(keyword.toLowerCase()));

  // Score calculation
  let overallScore = 0;
  if (intentCorrect) overallScore += 30;
  if (modeCorrect) overallScore += 20;
  if (confidenceAcceptable) overallScore += 15;
  if (hasRequired) overallScore += 20;
  if (noForbidden) overallScore += 15;

  // Brief quality: based on structure and content length
  const hasSections = result.brief.sections.length >= 2;
  const hasActions = result.brief.recommended_actions.length > 0;
  const hasRisks = result.brief.risks.length > 0;
  const adequateLength = result.brief.formatted_whatsapp.length > 50;

  let briefQuality = 0;
  if (hasSections) briefQuality += 25;
  if (hasActions) briefQuality += 25;
  if (hasRisks) briefQuality += 25;
  if (adequateLength) briefQuality += 25;

  return {
    scenario_id: scenario.id,
    intent_correct: intentCorrect,
    mode_correct: modeCorrect,
    confidence_acceptable: confidenceAcceptable,
    has_required_content: hasRequired,
    no_forbidden_content: noForbidden,
    overall_score: overallScore,
    brief_quality: briefQuality,
    processing_time_ms: result.processing_time_ms,
  };
}

// ── Benchmark runner ───────────────────────────────────────────────────────────

export function runBenchmark(): BenchmarkReport {
  const startTime = Date.now();
  const scores: BenchmarkScore[] = [];

  for (const scenario of SCENARIOS) {
    try {
      const result = processCEOInput(scenario.input);
      scores.push(scoreScenario(scenario, result));
    } catch (err) {
      scores.push({
        scenario_id: scenario.id,
        intent_correct: false,
        mode_correct: false,
        confidence_acceptable: false,
        has_required_content: false,
        no_forbidden_content: false,
        overall_score: 0,
        brief_quality: 0,
        processing_time_ms: 0,
      });
    }
  }

  const totalScenarios = SCENARIOS.length;
  const passed = scores.filter(s => s.overall_score >= 60).length;
  const failed = totalScenarios - passed;
  const overallScore = scores.reduce((sum, s) => sum + s.overall_score, 0) / totalScenarios;

  // By category
  const byCategory: Record<string, { total: number; passed: number; score: number }> = {};
  for (let i = 0; i < SCENARIOS.length; i++) {
    const cat = SCENARIOS[i].category;
    if (!byCategory[cat]) byCategory[cat] = { total: 0, passed: 0, score: 0 };
    byCategory[cat].total++;
    byCategory[cat].score += scores[i].overall_score;
    if (scores[i].overall_score >= 60) byCategory[cat].passed++;
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].score = Math.round(byCategory[cat].score / byCategory[cat].total);
  }

  // By dimension
  const dimScores = {
    intent_understanding: scores.filter(s => s.intent_correct).length / totalScenarios * 100,
    planning_quality: scores.filter(s => s.mode_correct).length / totalScenarios * 100,
    reasoning_quality: scores.reduce((sum, s) => sum + s.brief_quality, 0) / totalScenarios,
    reflection_quality: scores.filter(s => s.confidence_acceptable).length / totalScenarios * 100,
    decision_quality: scores.filter(s => s.has_required_content).length / totalScenarios * 100,
    executive_usefulness: overallScore,
  };

  // Certification
  let certification: BenchmarkReport['certification'];
  if (overallScore >= 75 && passed >= totalScenarios * 0.8) {
    certification = 'EXECUTIVE_INTELLIGENCE_OPERATIONAL';
  } else if (overallScore >= 50) {
    certification = 'EXECUTIVE_INTELLIGENCE_PARTIAL';
  } else {
    certification = 'EXECUTIVE_INTELLIGENCE_INSUFFICIENT';
  }

  const failingScenarios = scores.filter(s => s.overall_score < 60);

  return {
    total_scenarios: totalScenarios,
    passed,
    failed,
    overall_score: Math.round(overallScore),
    by_category: byCategory,
    by_dimension: {
      intent_understanding: Math.round(dimScores.intent_understanding),
      planning_quality: Math.round(dimScores.planning_quality),
      reasoning_quality: Math.round(dimScores.reasoning_quality),
      reflection_quality: Math.round(dimScores.reflection_quality),
      decision_quality: Math.round(dimScores.decision_quality),
      executive_usefulness: Math.round(dimScores.executive_usefulness),
    },
    execution_time_ms: Date.now() - startTime,
    certification,
    failing_scenarios: failingScenarios,
  };
}

// ── Format report ──────────────────────────────────────────────────────────────

export function formatBenchmarkReport(report: BenchmarkReport): string {
  const lines: string[] = [
    '# Executive Intelligence Benchmark Report',
    '',
    `## Certification: ${report.certification}`,
    '',
    `**Overall Score: ${report.overall_score}/100**`,
    `Passed: ${report.passed}/${report.total_scenarios} | Failed: ${report.failed}`,
    `Execution time: ${report.execution_time_ms}ms`,
    '',
    '## By Category',
    '',
    '| Category | Total | Passed | Score |',
    '|----------|-------|--------|-------|',
  ];

  for (const [cat, data] of Object.entries(report.by_category)) {
    lines.push(`| ${cat} | ${data.total} | ${data.passed} | ${data.score}% |`);
  }

  lines.push('', '## By Dimension', '');
  lines.push(`- Intent Understanding: ${report.by_dimension.intent_understanding}%`);
  lines.push(`- Planning Quality: ${report.by_dimension.planning_quality}%`);
  lines.push(`- Reasoning Quality: ${report.by_dimension.reasoning_quality}%`);
  lines.push(`- Reflection Quality: ${report.by_dimension.reflection_quality}%`);
  lines.push(`- Decision Quality: ${report.by_dimension.decision_quality}%`);
  lines.push(`- Executive Usefulness: ${report.by_dimension.executive_usefulness}%`);

  if (report.failing_scenarios.length > 0) {
    lines.push('', '## Failing Scenarios', '');
    for (const f of report.failing_scenarios) {
      const s = SCENARIOS.find(sc => sc.id === f.scenario_id);
      lines.push(`- #${f.scenario_id} [${s?.category}] "${s?.input}" — Score: ${f.overall_score}/100`);
    }
  }

  return lines.join('\n');
}
