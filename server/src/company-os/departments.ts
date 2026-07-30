/**
 * Mi Company OS — Department Registry
 * 19 departments. Each has: id, name, phase, capabilities, intents, tools, models.
 * This is the single source of truth for what Mi can do and who owns it.
 */

export type DeptStatus = 'ACTIVE' | 'PLANNED' | 'DISABLED';
export type AutonomyPolicy = 'FULL_AUTO' | 'REQUIRES_APPROVAL' | 'BLOCKED';

export interface Department {
  id: string;
  name: string;
  phase: number;
  status: DeptStatus;
  capabilities: string[];
  intents: string[];
  tools: string[];
  owner_model: string;
  qa_model: string;
  autonomy: AutonomyPolicy;
  approval_required: boolean;
  description: string;
}

export const DEPARTMENTS: Department[] = [
  // ── PHASE 1 — CORE OS ────────────────────────────────────────────────────
  {
    id: 'dispatch',
    name: 'Dispatch Center',
    phase: 1, status: 'ACTIVE',
    capabilities: ['command_routing', 'task_decomposition', 'dept_assignment', 'pipeline_orchestration', 'context_resolution'],
    intents: ['*'],
    tools: ['intent-router', 'gstack', 'jarvis-core', 'coo-v4'],
    owner_model: 'qwen3:14b',
    qa_model: 'gemma3:12b',
    autonomy: 'FULL_AUTO',
    approval_required: false,
    description: 'Routes every CEO command through the 12-step pipeline. Single entry point.',
  },
  {
    id: 'executive-assistant',
    name: 'Executive Assistant',
    phase: 1, status: 'ACTIVE',
    capabilities: ['task_tracking', 'calendar_management', 'follow_up', 'priority_queue', 'inbox_triage'],
    intents: ['query_personal_tasks', 'check_schedule', 'set_reminder', 'follow_up'],
    tools: ['task-intelligence', 'operational-memory', 'reminders', 'asana'],
    owner_model: 'qwen3:8b',
    qa_model: 'gemma3:12b',
    autonomy: 'FULL_AUTO',
    approval_required: false,
    description: 'Manages CEO schedule, task queue, reminders, and follow-ups.',
  },
  {
    id: 'report-center',
    name: 'Reporting Center',
    phase: 1, status: 'ACTIVE',
    capabilities: ['report_aggregation', 'ceo_summary', 'kpi_dashboard', 'daily_briefing', 'weekly_summary'],
    intents: ['generate_report', 'briefing', 'status_summary', 'kpi_check'],
    tools: ['executive-briefing', 'agenview', 'strategic-memory', 'visibility'],
    owner_model: 'qwen3:8b',
    qa_model: 'gemma3:12b',
    autonomy: 'FULL_AUTO',
    approval_required: false,
    description: 'Strips raw logs and stack traces. Returns CEO-level summary only.',
  },
  {
    id: 'library',
    name: 'Library Department',
    phase: 1, status: 'PLANNED',
    capabilities: ['sop_storage', 'policy_search', 'document_retrieval', 'knowledge_base', 'training_materials'],
    intents: ['search_knowledge', 'find_sop', 'load_policy', 'retrieve_doc'],
    tools: ['knowledge-federation', 'knowledge-db', 'qdrant'],
    owner_model: 'qwen3:8b',
    qa_model: 'gemma3:12b',
    autonomy: 'FULL_AUTO',
    approval_required: false,
    description: 'SOP, policies, tax docs, training files. Powered by Outline + Qdrant.',
  },
  {
    id: 'qa',
    name: 'QA Department',
    phase: 1, status: 'ACTIVE',
    capabilities: ['independent_verification', 'evidence_check', 'regression_test', 'quality_gate', 'pass_fail_verdict'],
    intents: ['verify_result', 'qa_check', 'regression', 'audit_output'],
    tools: ['qa-gate', 'evidence-store', 'test-runner'],
    owner_model: 'gemma3:12b',
    qa_model: 'gemma3:12b',
    autonomy: 'FULL_AUTO',
    approval_required: false,
    description: 'Independent from executing dept. PASS/FAIL only. No provisional.',
  },
  // ── PHASE 2 — MONEY OPERATIONS ──────────────────────────────────────────
  {
    id: 'finance',
    name: 'Finance & Accounting',
    phase: 2, status: 'ACTIVE',
    capabilities: ['p_and_l', 'cash_flow', 'expense_categorization', 'financial_report', 'budget_tracking'],
    intents: ['check_finances', 'p_and_l', 'expense_report', 'cash_flow_check', 'budget_check'],
    tools: ['accounting-engine', 'quickbooks-runtime', 'business-agents'],
    owner_model: 'qwen3:14b',
    qa_model: 'gemma3:12b',
    autonomy: 'REQUIRES_APPROVAL',
    approval_required: true,
    description: 'P&L, cash flow, expense tracking. QuickBooks-synced. No payment without approval.',
  },
  {
    id: 'tax-compliance',
    name: 'Tax & Compliance',
    phase: 2, status: 'PLANNED',
    capabilities: ['tax_prep', 'compliance_check', 'filing_schedule', 'irs_document', 'payroll_compliance'],
    intents: ['tax_check', 'compliance_report', 'filing_deadline', 'payroll_tax'],
    tools: ['accounting-engine', 'paperless-ngx', 'quickbooks-runtime'],
    owner_model: 'qwen3:14b',
    qa_model: 'gemma3:12b',
    autonomy: 'REQUIRES_APPROVAL',
    approval_required: true,
    description: 'Tax filing prep, compliance checks. Never files without CEO double-approval.',
  },
  {
    id: 'restaurant-intelligence',
    name: 'Restaurant Intelligence',
    phase: 2, status: 'ACTIVE',
    capabilities: ['sales_analysis', 'toast_sync', 'doordash_metrics', 'menu_performance', 'store_comparison'],
    intents: ['check_sales', 'toast_report', 'doordash_check', 'menu_analysis', 'store_performance'],
    tools: ['food-safety-gateway', 'toast-connector', 'doordash-agent', 'visibility'],
    owner_model: 'qwen3:8b',
    qa_model: 'gemma3:12b',
    autonomy: 'FULL_AUTO',
    approval_required: false,
    description: 'Toast POS, DoorDash, menu performance. Real-time restaurant data.',
  },
  {
    id: 'investment-fp',
    name: 'Investment & FP&A',
    phase: 2, status: 'PLANNED',
    capabilities: ['roi_analysis', 'scenario_modeling', 'forecast', 'investment_memo', 'fp_and_a'],
    intents: ['roi_check', 'forecast', 'investment_analysis', 'scenario_model'],
    tools: ['accounting-engine', 'strategic-memory', 'data-analyst'],
    owner_model: 'qwen3:14b',
    qa_model: 'gemma3:12b',
    autonomy: 'FULL_AUTO',
    approval_required: false,
    description: 'FP&A, ROI models, scenario analysis. Advisory only — no execution.',
  },
  // ── PHASE 3 — COMPANY OPERATIONS ────────────────────────────────────────
  {
    id: 'technical-operations',
    name: 'Technical Operations',
    phase: 3, status: 'ACTIVE',
    capabilities: ['pm2_management', 'health_check', 'service_restart', 'log_analysis', 'browser_automation', 'tailscale'],
    intents: ['pm2_status', 'service_health', 'restart_service', 'check_logs', 'browser_task'],
    tools: ['autonomous-engine', 'browser-operator', 'playwright-mcp', 'digital-twin', 'nodes'],
    owner_model: 'qwen3:8b',
    qa_model: 'gemma3:12b',
    autonomy: 'FULL_AUTO',
    approval_required: false,
    description: 'PM2, health, browser automation, Playwright, Tailscale device ops.',
  },
  {
    id: 'engineering',
    name: 'Engineering Department',
    phase: 3, status: 'ACTIVE',
    capabilities: ['code_review', 'bug_fix', 'feature_build', 'test_generation', 'repo_audit'],
    intents: ['build_feature', 'fix_bug', 'code_review', 'run_tests', 'audit_repo'],
    tools: ['ai-developer-agent', 'coo-v4', 'aider', 'openhands'],
    owner_model: 'qwen2.5-coder:7b',
    qa_model: 'gemma3:12b',
    autonomy: 'REQUIRES_APPROVAL',
    approval_required: true,
    description: 'Code changes under Mi approval and QA gate. Engineering cannot certify Engineering.',
  },
  {
    id: 'rd',
    name: 'R&D Department',
    phase: 3, status: 'PLANNED',
    capabilities: ['source_evaluation', 'poc_build', 'benchmark', 'integration_test', 'feasibility_study'],
    intents: ['research', 'evaluate_tool', 'poc', 'benchmark', 'feasibility'],
    tools: ['knowledge-federation', 'council', 'data-analyst'],
    owner_model: 'qwen3:14b',
    qa_model: 'gemma3:12b',
    autonomy: 'FULL_AUTO',
    approval_required: false,
    description: 'Tool evaluation, POCs, integration testing. Delivers SOURCE_ADMISSION_REPORT.',
  },
  {
    id: 'competitive-intel',
    name: 'Competitive Intelligence',
    phase: 3, status: 'PLANNED',
    capabilities: ['competitor_research', 'market_analysis', 'pricing_intel', 'review_monitoring'],
    intents: ['competitor_check', 'market_research', 'pricing_analysis', 'review_audit'],
    tools: ['browser-operator', 'playwright-mcp', 'knowledge-federation'],
    owner_model: 'qwen3:14b',
    qa_model: 'gemma3:12b',
    autonomy: 'FULL_AUTO',
    approval_required: false,
    description: 'Competitor pricing, market analysis, review monitoring.',
  },
  // ── PHASE 4 — GROWTH ─────────────────────────────────────────────────────
  {
    id: 'marketing',
    name: 'Marketing Department',
    phase: 4, status: 'ACTIVE',
    capabilities: ['campaign_planning', 'creative_brief', 'ad_copy', 'performance_tracking', 'seo_content'],
    intents: ['marketing_plan', 'campaign_check', 'ad_copy', 'seo_content', 'promo_calendar'],
    tools: ['coo-v4', 'strategic-memory', 'restaurant-creative-engine'],
    owner_model: 'qwen3:8b',
    qa_model: 'gemma3:12b',
    autonomy: 'REQUIRES_APPROVAL',
    approval_required: true,
    description: 'Campaign planning, ad copy, performance tracking. No external post without approval.',
  },
  {
    id: 'brand-creative',
    name: 'Brand & Creative',
    phase: 4, status: 'ACTIVE',
    capabilities: ['image_generation', 'flyer_design', 'menu_design', 'logo_variation', 'social_creative'],
    intents: ['create_creative', 'design_flyer', 'generate_image', 'make_menu', 'brand_asset'],
    tools: ['restaurant-creative-engine', 'comfyui', 'flux-workflow'],
    owner_model: 'gemma3:12b',
    qa_model: 'gemma3:12b',
    autonomy: 'FULL_AUTO',
    approval_required: false,
    description: 'A/B/C creative variants with CTR prediction. ComfyUI for AI image gen.',
  },
  {
    id: 'website-studio',
    name: 'Website Studio',
    phase: 4, status: 'PLANNED',
    capabilities: ['page_update', 'seo_optimization', 'content_publish', 'landing_page', 'blog_post'],
    intents: ['update_website', 'publish_page', 'seo_audit', 'create_blog', 'landing_page'],
    tools: ['browser-operator', 'playwright-mcp', 'knowledge-federation'],
    owner_model: 'qwen3:8b',
    qa_model: 'gemma3:12b',
    autonomy: 'REQUIRES_APPROVAL',
    approval_required: true,
    description: 'Website updates, SEO, blog publishing. Public posts require approval.',
  },
  // ── PHASE 5 — MEDIA ──────────────────────────────────────────────────────
  {
    id: 'video-studio',
    name: 'Video Studio',
    phase: 5, status: 'PLANNED',
    capabilities: ['promo_video', 'walkthrough_video', 'training_video', 'reel_generation'],
    intents: ['make_video', 'promo_video', 'training_video', 'walkthrough'],
    tools: ['wan-video', 'hunyuan-video', 'ltx-video', 'comfyui'],
    owner_model: 'qwen3:8b',
    qa_model: 'gemma3:12b',
    autonomy: 'FULL_AUTO',
    approval_required: false,
    description: 'Restaurant promo, training, walkthrough videos. Wan/Hunyuan/LTX pipeline.',
  },
  {
    id: 'crm',
    name: 'CRM / Sales',
    phase: 4, status: 'PLANNED',
    capabilities: ['lead_tracking', 'customer_history', 'follow_up', 'partnership_pipeline'],
    intents: ['crm_check', 'lead_status', 'customer_lookup', 'partnership_update'],
    tools: ['twenty-crm', 'communication', 'operational-memory'],
    owner_model: 'qwen3:8b',
    qa_model: 'gemma3:12b',
    autonomy: 'FULL_AUTO',
    approval_required: false,
    description: 'Leads, customer history, partnerships. Powered by Twenty CRM.',
  },
  {
    id: 'hr',
    name: 'HR / Recruiting / Training',
    phase: 3, status: 'PLANNED',
    capabilities: ['employee_records', 'onboarding', 'training_materials', 'recruiting_pipeline', 'performance_review'],
    intents: ['hr_check', 'employee_lookup', 'onboarding', 'training_assign', 'recruiting'],
    tools: ['library', 'knowledge-federation', 'operational-memory'],
    owner_model: 'qwen3:8b',
    qa_model: 'gemma3:12b',
    autonomy: 'REQUIRES_APPROVAL',
    approval_required: true,
    description: 'Employee records, training, recruiting. Payroll changes require CEO approval.',
  },
  // ── PHASE 3 — INFRASTRUCTURE (P4 addition) ───────────────────────────────
  {
    id: 'infrastructure',
    name: 'Infrastructure & Platform',
    phase: 3, status: 'ACTIVE',
    capabilities: ['pm2_management', 'service_health', 'port_scan', 'log_analysis', 'backup', 'tailscale', 'docker_ops', 'service_recovery'],
    intents: ['service_down', 'service_health', 'pm2_check', 'docker_check', 'port_check', 'log_check', 'backup_check', 'why_down', 'restart_service'],
    tools: ['pm2-status', 'node-registry', 'visibility-dashboard', 'service-registry', 'project-registry'],
    owner_model: 'qwen3:8b',
    qa_model: 'gemma3:12b',
    autonomy: 'FULL_AUTO',
    approval_required: false,
    description: 'PM2, Docker, ports, logs, Tailscale, health monitoring, service recovery. Routes: "Mi ơi sao Dashboard chết?", "Sao WhatsApp down?"',
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function getDept(id: string): Department | undefined {
  return DEPARTMENTS.find(d => d.id === id);
}

export function getActiveDepts(): Department[] {
  return DEPARTMENTS.filter(d => d.status === 'ACTIVE');
}

export function getDeptsByPhase(phase: number): Department[] {
  return DEPARTMENTS.filter(d => d.phase === phase);
}

export function findDeptForIntent(intent: string): Department | undefined {
  return DEPARTMENTS.find(d =>
    d.intents.includes('*') ? false : d.intents.some(i => intent.includes(i) || i.includes(intent))
  ) || DEPARTMENTS.find(d => d.id === 'dispatch');
}
