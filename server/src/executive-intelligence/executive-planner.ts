/**
 * Executive Planner — Phase 21B
 * Builds a structured plan BEFORE any execution.
 *
 * Receives an intent analysis → produces an ordered, dependency-aware
 * execution plan with estimated effort, required data, and gate checks.
 * No execution happens until the plan is approved or auto-authorized.
 */

import { IntentAnalysis, IntentCategory } from './executive-intent-engine';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlanStatus = 'draft' | 'ready' | 'executing' | 'completed' | 'blocked' | 'cancelled';
export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface PlanStep {
  step_id: string;
  order: number;
  title: string;
  description: string;
  engine: string;            // which engine handles this step
  required_data: string[];   // data inputs needed
  outputs: string[];         // what this step produces
  estimated_seconds: number;
  status: StepStatus;
  dependencies: string[];    // step_ids that must complete first
  can_parallel: boolean;     // can run alongside other steps
  qa_gate: boolean;          // requires QA validation before proceeding
}

export interface ExecutionPlan {
  plan_id: string;
  created_at: string;
  intent: IntentCategory;
  title: string;
  description: string;
  total_steps: number;
  estimated_total_seconds: number;
  steps: PlanStep[];
  status: PlanStatus;
  confidence: number;        // plan confidence from intent analysis
  requires_ceo_approval: boolean;
  approval_reason?: string;
}

// ── Plan templates per intent ──────────────────────────────────────────────────

interface PlanTemplate {
  title: string;
  description: string;
  steps: Omit<PlanStep, 'step_id' | 'status'>[];
  requires_approval: boolean;
}

const PLAN_TEMPLATES: Record<IntentCategory, PlanTemplate> = {
  operational_concern: {
    title: 'Kế hoạch kiểm tra vận hành',
    description: 'Kiểm tra toàn diện hệ thống vận hành, phát hiện sự cố, và đề xuất giải pháp',
    requires_approval: false,
    steps: [
      {
        order: 1, title: 'Kiểm tra sức khỏe dịch vụ',
        description: 'Kiểm tra PM2 processes, service uptime, response times',
        engine: 'health-check', required_data: ['pm2_status', 'service_endpoints'],
        outputs: ['health_report'], estimated_seconds: 30,
        dependencies: [], can_parallel: true, qa_gate: false,
      },
      {
        order: 2, title: 'Quét lỗi hệ thống',
        description: 'Scan error logs, check for anomalies, review crash reports',
        engine: 'log-scanner', required_data: ['pm2_logs', 'error_logs'],
        outputs: ['error_report'], estimated_seconds: 45,
        dependencies: [], can_parallel: true, qa_gate: false,
      },
      {
        order: 3, title: 'Kiểm tra connectors',
        description: 'Verify all connector health, check WhatsApp, APIs',
        engine: 'connector-audit', required_data: ['connector_registry'],
        outputs: ['connector_report'], estimated_seconds: 20,
        dependencies: [], can_parallel: true, qa_gate: false,
      },
      {
        order: 4, title: 'Tổng hợp và phân tích',
        description: 'Combine health + error + connector data, identify root cause',
        engine: 'analysis', required_data: ['health_report', 'error_report', 'connector_report'],
        outputs: ['diagnosis'], estimated_seconds: 30,
        dependencies: ['1', '2', '3'], can_parallel: false, qa_gate: false,
      },
      {
        order: 5, title: 'QA xác nhận',
        description: 'Validate diagnosis accuracy, check for false positives',
        engine: 'qa-validator', required_data: ['diagnosis'],
        outputs: ['validated_diagnosis'], estimated_seconds: 15,
        dependencies: ['4'], can_parallel: false, qa_gate: true,
      },
      {
        order: 6, title: 'Tạo brief cho CEO',
        description: 'Generate executive summary with findings and recommendations',
        engine: 'executive-brief', required_data: ['validated_diagnosis'],
        outputs: ['ceo_brief'], estimated_seconds: 10,
        dependencies: ['5'], can_parallel: false, qa_gate: false,
      },
    ],
  },
  revenue_concern: {
    title: 'Kế hoạch phân tích doanh thu',
    description: 'Phân tích sâu nguyên nhân giảm doanh thu, đề xuất hành động',
    requires_approval: false,
    steps: [
      {
        order: 1, title: 'Thu thập dữ liệu doanh thu',
        description: 'Gather revenue data from all stores, compare with prior periods',
        engine: 'data-collector', required_data: ['revenue_data', 'historical_revenue'],
        outputs: ['revenue_snapshot'], estimated_seconds: 60,
        dependencies: [], can_parallel: false, qa_gate: false,
      },
      {
        order: 2, title: 'Phân tích traffic và conversion',
        description: 'Analyze traffic sources, conversion rates, AOV trends',
        engine: 'business-reasoning', required_data: ['revenue_snapshot', 'traffic_data'],
        outputs: ['traffic_analysis'], estimated_seconds: 45,
        dependencies: ['1'], can_parallel: false, qa_gate: false,
      },
      {
        order: 3, title: 'Kiểm tra yếu tố bên ngoài',
        description: 'Check seasonality, competition, market conditions',
        engine: 'market-analyzer', required_data: ['revenue_snapshot'],
        outputs: ['external_factors'], estimated_seconds: 30,
        dependencies: ['1'], can_parallel: true, qa_gate: false,
      },
      {
        order: 4, title: 'Đánh giá chiến dịch marketing',
        description: 'Review active campaigns, ad spend, ROI',
        engine: 'marketing-review', required_data: ['campaign_data', 'ad_spend'],
        outputs: ['marketing_report'], estimated_seconds: 30,
        dependencies: [], can_parallel: true, qa_gate: false,
      },
      {
        order: 5, title: 'Tạo giả thuyết và xếp hạng',
        description: 'Combine all data into ranked hypotheses with probability scores',
        engine: 'analysis', required_data: ['revenue_snapshot', 'traffic_analysis', 'external_factors', 'marketing_report'],
        outputs: ['hypotheses_ranked'], estimated_seconds: 30,
        dependencies: ['2', '3', '4'], can_parallel: false, qa_gate: false,
      },
      {
        order: 6, title: 'QA và tạo brief',
        description: 'Validate analysis, generate executive brief',
        engine: 'qa-and-brief', required_data: ['hypotheses_ranked'],
        outputs: ['ceo_brief'], estimated_seconds: 20,
        dependencies: ['5'], can_parallel: false, qa_gate: true,
      },
    ],
  },
  risk_concern: {
    title: 'Kế hoạch đánh giá rủi ro',
    description: 'Đánh giá và xếp hạng các rủi ro hiện tại, đề xuất biện pháp giảm thiểu',
    requires_approval: false,
    steps: [
      {
        order: 1, title: 'Quét rủi ro toàn diện',
        description: 'Scan for active risks: compliance, operational, financial, security',
        engine: 'risk-scanner', required_data: ['compliance_data', 'operational_data'],
        outputs: ['risk_inventory'], estimated_seconds: 45,
        dependencies: [], can_parallel: false, qa_gate: false,
      },
      {
        order: 2, title: 'Xếp hạng rủi ro',
        description: 'Score risks by probability and impact, create risk matrix',
        engine: 'risk-scoring', required_data: ['risk_inventory'],
        outputs: ['risk_matrix'], estimated_seconds: 20,
        dependencies: ['1'], can_parallel: false, qa_gate: false,
      },
      {
        order: 3, title: 'Đề xuất giảm thiểu',
        description: 'Generate mitigation strategies for top risks',
        engine: 'risk-mitigation', required_data: ['risk_matrix'],
        outputs: ['mitigation_plan'], estimated_seconds: 20,
        dependencies: ['2'], can_parallel: false, qa_gate: false,
      },
      {
        order: 4, title: 'QA và tạo brief',
        description: 'Validate risk assessment, generate executive summary',
        engine: 'qa-and-brief', required_data: ['risk_matrix', 'mitigation_plan'],
        outputs: ['ceo_brief'], estimated_seconds: 15,
        dependencies: ['3'], can_parallel: false, qa_gate: true,
      },
    ],
  },
  service_degradation: {
    title: 'Kế hoạch chẩn đoán hiệu năng',
    description: 'Xác định nguyên nhân giảm hiệu năng và đề xuất giải pháp',
    requires_approval: false,
    steps: [
      {
        order: 1, title: 'Đo hiệu năng hiện tại',
        description: 'Measure response times, CPU, memory, DB query times',
        engine: 'perf-monitor', required_data: ['system_metrics'],
        outputs: ['perf_snapshot'], estimated_seconds: 30,
        dependencies: [], can_parallel: false, qa_gate: false,
      },
      {
        order: 2, title: 'So sánh baseline',
        description: 'Compare current metrics with historical baseline',
        engine: 'baseline-compare', required_data: ['perf_snapshot', 'historical_metrics'],
        outputs: ['deviation_report'], estimated_seconds: 20,
        dependencies: ['1'], can_parallel: false, qa_gate: false,
      },
      {
        order: 3, title: 'Xác định bottleneck',
        description: 'Identify the root cause of degradation',
        engine: 'bottleneck-analyzer', required_data: ['deviation_report'],
        outputs: ['root_cause'], estimated_seconds: 20,
        dependencies: ['2'], can_parallel: false, qa_gate: false,
      },
      {
        order: 4, title: 'QA và tạo brief',
        description: 'Validate diagnosis, generate CEO summary',
        engine: 'qa-and-brief', required_data: ['root_cause'],
        outputs: ['ceo_brief'], estimated_seconds: 15,
        dependencies: ['3'], can_parallel: false, qa_gate: true,
      },
    ],
  },
  strategic_question: {
    title: 'Kế hoạch phân tích chiến lược',
    description: 'Phân tích bối cảnh, dữ liệu, và đề xuất quyết định chiến lược',
    requires_approval: false,
    steps: [
      {
        order: 1, title: 'Thu thập bối cảnh',
        description: 'Gather relevant business data, market context, goals',
        engine: 'context-gatherer', required_data: ['business_goals', 'market_data'],
        outputs: ['strategic_context'], estimated_seconds: 45,
        dependencies: [], can_parallel: false, qa_gate: false,
      },
      {
        order: 2, title: 'Phân tích lựa chọn',
        description: 'Evaluate possible courses of action with pros/cons',
        engine: 'option-analyzer', required_data: ['strategic_context'],
        outputs: ['options_analysis'], estimated_seconds: 40,
        dependencies: ['1'], can_parallel: false, qa_gate: false,
      },
      {
        order: 3, title: 'Đề xuất quyết định',
        description: 'Rank options by expected value, risk, and alignment with goals',
        engine: 'decision-support', required_data: ['options_analysis'],
        outputs: ['recommendation'], estimated_seconds: 20,
        dependencies: ['2'], can_parallel: false, qa_gate: false,
      },
      {
        order: 4, title: 'QA và tạo brief',
        description: 'Validate analysis quality, generate executive summary',
        engine: 'qa-and-brief', required_data: ['recommendation'],
        outputs: ['ceo_brief'], estimated_seconds: 15,
        dependencies: ['3'], can_parallel: false, qa_gate: true,
      },
    ],
  },
  compliance_concern: {
    title: 'Kế hoạch kiểm tra tuân thủ',
    description: 'Kiểm tra trạng thái tuân thủ pháp luật và quy định',
    requires_approval: false,
    steps: [
      {
        order: 1, title: 'Quét giấy phép và chứng nhận',
        description: 'Check license expiry dates, certifications, permits',
        engine: 'license-scanner', required_data: ['license_registry'],
        outputs: ['license_status'], estimated_seconds: 30,
        dependencies: [], can_parallel: true, qa_gate: false,
      },
      {
        order: 2, title: 'Kiểm tra insurance',
        description: 'Verify insurance coverage, policy status, renewal dates',
        engine: 'insurance-check', required_data: ['insurance_data'],
        outputs: ['insurance_status'], estimated_seconds: 20,
        dependencies: [], can_parallel: true, qa_gate: false,
      },
      {
        order: 3, title: 'Tổng hợp và xếp hạng rủi ro',
        description: 'Combine findings, prioritize by urgency',
        engine: 'compliance-analysis', required_data: ['license_status', 'insurance_status'],
        outputs: ['compliance_report'], estimated_seconds: 20,
        dependencies: ['1', '2'], can_parallel: false, qa_gate: false,
      },
      {
        order: 4, title: 'QA và tạo brief',
        description: 'Validate compliance check, generate CEO summary',
        engine: 'qa-and-brief', required_data: ['compliance_report'],
        outputs: ['ceo_brief'], estimated_seconds: 15,
        dependencies: ['3'], can_parallel: false, qa_gate: true,
      },
    ],
  },
  people_concern: {
    title: 'Kế hoạch phân tích nhân sự',
    description: 'Đánh giá tình hình nhân sự, đề xuất hành động',
    requires_approval: false,
    steps: [
      {
        order: 1, title: 'Thu thập dữ liệu nhân sự',
        description: 'Gather staffing data, attendance, pending HR items',
        engine: 'hr-data-gatherer', required_data: ['staffing_data', 'attendance'],
        outputs: ['hr_snapshot'], estimated_seconds: 30,
        dependencies: [], can_parallel: false, qa_gate: false,
      },
      {
        order: 2, title: 'Phân tích và đề xuất',
        description: 'Analyze staffing gaps, performance, and recommend actions',
        engine: 'hr-analysis', required_data: ['hr_snapshot'],
        outputs: ['hr_analysis'], estimated_seconds: 30,
        dependencies: ['1'], can_parallel: false, qa_gate: false,
      },
      {
        order: 3, title: 'QA và tạo brief',
        description: 'Validate analysis, generate CEO summary',
        engine: 'qa-and-brief', required_data: ['hr_analysis'],
        outputs: ['ceo_brief'], estimated_seconds: 15,
        dependencies: ['2'], can_parallel: false, qa_gate: true,
      },
    ],
  },
  technology_concern: {
    title: 'Kế hoạch chẩn đoán công nghệ',
    description: 'Kiểm tra hệ thống kỹ thuật, phát hiện sự cố, đề xuất giải pháp',
    requires_approval: false,
    steps: [
      {
        order: 1, title: 'Kiểm tra server và infrastructure',
        description: 'Check PM2 processes, database health, API status',
        engine: 'infra-check', required_data: ['pm2_status', 'db_health'],
        outputs: ['infra_report'], estimated_seconds: 30,
        dependencies: [], can_parallel: true, qa_gate: false,
      },
      {
        order: 2, title: 'Quét code quality',
        description: 'Check for recent errors, tech debt, security issues',
        engine: 'code-scanner', required_data: ['error_logs', 'recent_changes'],
        outputs: ['code_report'], estimated_seconds: 40,
        dependencies: [], can_parallel: true, qa_gate: false,
      },
      {
        order: 3, title: 'Tổng hợp và đề xuất',
        description: 'Combine findings, prioritize fixes',
        engine: 'tech-analysis', required_data: ['infra_report', 'code_report'],
        outputs: ['tech_diagnosis'], estimated_seconds: 20,
        dependencies: ['1', '2'], can_parallel: false, qa_gate: false,
      },
      {
        order: 4, title: 'QA và tạo brief',
        description: 'Validate diagnosis, generate CEO summary',
        engine: 'qa-and-brief', required_data: ['tech_diagnosis'],
        outputs: ['ceo_brief'], estimated_seconds: 15,
        dependencies: ['3'], can_parallel: false, qa_gate: true,
      },
    ],
  },
  marketing_concern: {
    title: 'Kế hoạch phân tích marketing',
    description: 'Đánh giá hiệu quả marketing, đề xuất chiến lược',
    requires_approval: false,
    steps: [
      {
        order: 1, title: 'Thu thập dữ liệu marketing',
        description: 'Gather campaign data, traffic, reviews, social metrics',
        engine: 'marketing-data', required_data: ['campaign_data', 'traffic_data', 'reviews'],
        outputs: ['marketing_snapshot'], estimated_seconds: 40,
        dependencies: [], can_parallel: false, qa_gate: false,
      },
      {
        order: 2, title: 'Phân tích hiệu quả',
        description: 'Analyze ROI, conversion, channel performance',
        engine: 'marketing-analysis', required_data: ['marketing_snapshot'],
        outputs: ['marketing_analysis'], estimated_seconds: 30,
        dependencies: ['1'], can_parallel: false, qa_gate: false,
      },
      {
        order: 3, title: 'QA và tạo brief',
        description: 'Validate analysis, generate CEO summary',
        engine: 'qa-and-brief', required_data: ['marketing_analysis'],
        outputs: ['ceo_brief'], estimated_seconds: 15,
        dependencies: ['2'], can_parallel: false, qa_gate: true,
      },
    ],
  },
  general_status_check: {
    title: 'Kiểm tra tổng quát',
    description: 'Tổng quan nhanh tình trạng công ty, dịch vụ, và ưu tiên hiện tại',
    requires_approval: false,
    steps: [
      {
        order: 1, title: 'Health check nhanh',
        description: 'Quick health check across all services',
        engine: 'health-check', required_data: ['pm2_status'],
        outputs: ['health_status'], estimated_seconds: 15,
        dependencies: [], can_parallel: true, qa_gate: false,
      },
      {
        order: 2, title: 'Kiểm tra ưu tiên',
        description: 'Review pending approvals, action items, incidents',
        engine: 'priority-check', required_data: ['approvals', 'action_items'],
        outputs: ['priority_status'], estimated_seconds: 15,
        dependencies: [], can_parallel: true, qa_gate: false,
      },
      {
        order: 3, title: 'Tạo brief',
        description: 'Generate quick status summary',
        engine: 'executive-brief', required_data: ['health_status', 'priority_status'],
        outputs: ['ceo_brief'], estimated_seconds: 10,
        dependencies: ['1', '2'], can_parallel: false, qa_gate: false,
      },
    ],
  },
  urgent_intervention: {
    title: 'Kế hoạch can thiệp khẩn cấp',
    description: 'Phản ứng nhanh với tình huống khẩn cấp, ưu tiên xử lý sự cố',
    requires_approval: false,
    steps: [
      {
        order: 1, title: 'Xác định sự cố nghiêm trọng nhất',
        description: 'Identify the most critical issue requiring immediate attention',
        engine: 'incident-prioritizer', required_data: ['system_health', 'active_incidents'],
        outputs: ['critical_incident'], estimated_seconds: 10,
        dependencies: [], can_parallel: false, qa_gate: false,
      },
      {
        order: 2, title: 'Thu thập bằng chứng',
        description: 'Gather all relevant data about the incident',
        engine: 'evidence-collector', required_data: ['critical_incident', 'logs'],
        outputs: ['incident_evidence'], estimated_seconds: 20,
        dependencies: ['1'], can_parallel: false, qa_gate: false,
      },
      {
        order: 3, title: 'Phân tích và đề xuất',
        description: 'Analyze root cause, propose immediate actions',
        engine: 'emergency-analysis', required_data: ['incident_evidence'],
        outputs: ['emergency_brief'], estimated_seconds: 15,
        dependencies: ['2'], can_parallel: false, qa_gate: false,
      },
    ],
  },
  performance_review: {
    title: 'Kế hoạch đánh giá hiệu suất',
    description: 'Đánh giá toàn diện hiệu suất các bộ phận và hệ thống',
    requires_approval: false,
    steps: [
      {
        order: 1, title: 'Thu thập metrics',
        description: 'Gather KPIs, performance data across all departments',
        engine: 'metrics-collector', required_data: ['department_metrics', 'system_metrics'],
        outputs: ['metrics_snapshot'], estimated_seconds: 40,
        dependencies: [], can_parallel: false, qa_gate: false,
      },
      {
        order: 2, title: 'Phân tích so sánh',
        description: 'Compare against targets and historical performance',
        engine: 'performance-analyzer', required_data: ['metrics_snapshot', 'targets'],
        outputs: ['performance_analysis'], estimated_seconds: 30,
        dependencies: ['1'], can_parallel: false, qa_gate: false,
      },
      {
        order: 3, title: 'Đề xuất cải thiện',
        description: 'Identify improvement areas and recommend actions',
        engine: 'improvement-planner', required_data: ['performance_analysis'],
        outputs: ['improvement_plan'], estimated_seconds: 20,
        dependencies: ['2'], can_parallel: false, qa_gate: false,
      },
      {
        order: 4, title: 'QA và tạo brief',
        description: 'Validate analysis, generate CEO summary',
        engine: 'qa-and-brief', required_data: ['improvement_plan'],
        outputs: ['ceo_brief'], estimated_seconds: 15,
        dependencies: ['3'], can_parallel: false, qa_gate: true,
      },
    ],
  },
  unknown: {
    title: 'Yêu cầu chưa xác định',
    description: 'Cần thêm thông tin để hiểu rõ ý định của CEO',
    requires_approval: false,
    steps: [
      {
        order: 1, title: 'Tóm tắt bối cảnh',
        description: 'Gather current company state to provide context',
        engine: 'context-gatherer', required_data: ['company_state'],
        outputs: ['context_summary'], estimated_seconds: 20,
        dependencies: [], can_parallel: false, qa_gate: false,
      },
      {
        order: 2, title: 'Đặt câu hỏi làm rõ',
        description: 'Prepare clarifying questions for CEO based on context',
        engine: 'clarification-engine', required_data: ['context_summary'],
        outputs: ['clarifying_questions'], estimated_seconds: 10,
        dependencies: ['1'], can_parallel: false, qa_gate: false,
      },
    ],
  },
};

// ── Engine ─────────────────��───────────────────────────────────────────────────

let planCounter = 0;

function generatePlanId(): string {
  planCounter++;
  return `plan-${Date.now()}-${planCounter}`;
}

export function buildExecutionPlan(analysis: IntentAnalysis): ExecutionPlan {
  const intent = analysis.primary_intent.intent;
  const template = PLAN_TEMPLATES[intent] || PLAN_TEMPLATES.unknown;

  const steps: PlanStep[] = template.steps.map(step => ({
    ...step,
    step_id: `step-${step.order}`,
    status: 'pending' as StepStatus,
  }));

  const estimatedTotal = steps.reduce((sum, s) => sum + s.estimated_seconds, 0);

  return {
    plan_id: generatePlanId(),
    created_at: new Date().toISOString(),
    intent,
    title: template.title,
    description: template.description,
    total_steps: steps.length,
    estimated_total_seconds: estimatedTotal,
    steps,
    status: 'ready',
    confidence: analysis.primary_intent.confidence,
    requires_ceo_approval: template.requires_approval,
    approval_reason: template.requires_approval ? 'CEO approval required for this type of action' : undefined,
  };
}

// ── Plan execution tracking ────────────────────────────────────────────────────

export function getStepById(plan: ExecutionPlan, stepId: string): PlanStep | undefined {
  return plan.steps.find(s => s.step_id === stepId);
}

export function areDependenciesMet(plan: ExecutionPlan, step: PlanStep): boolean {
  return step.dependencies.every(depId => {
    const dep = getStepById(plan, depId);
    return dep && dep.status === 'done';
  });
}

export function getNextExecutableSteps(plan: ExecutionPlan): PlanStep[] {
  return plan.steps.filter(s =>
    s.status === 'pending' && areDependenciesMet(plan, s)
  );
}

export function markStepComplete(plan: ExecutionPlan, stepId: string): void {
  const step = getStepById(plan, stepId);
  if (step) step.status = 'done';

  // Check if all steps are done
  if (plan.steps.every(s => s.status === 'done')) {
    plan.status = 'completed';
  }
}

export function markStepFailed(plan: ExecutionPlan, stepId: string): void {
  const step = getStepById(plan, stepId);
  if (step) step.status = 'failed';
  plan.status = 'blocked';
}

// ── Summary helper ─────────────────────────────────────────────────────────────

export function summarizePlan(plan: ExecutionPlan): string {
  const lines: string[] = [
    `📋 *${plan.title}*`,
    plan.description,
    '',
    `Steps (${plan.total_steps}):`,
  ];

  for (const step of plan.steps) {
    const icon = step.status === 'done' ? '✅' : step.status === 'running' ? '🔄' : step.status === 'failed' ? '❌' : '⬜';
    lines.push(`  ${icon} Step ${step.order}: ${step.title}`);
  }

  lines.push('');
  lines.push(`⏱️ Estimated: ~${Math.ceil(plan.estimated_total_seconds / 60)} minutes`);
  lines.push(`📊 Confidence: ${Math.round(plan.confidence * 100)}%`);
  if (plan.requires_ceo_approval) lines.push('🔒 Requires CEO approval');

  return lines.join('\n');
}
