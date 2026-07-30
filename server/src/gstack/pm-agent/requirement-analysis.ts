/**
 * Requirement Analysis Engine — Phase 13.2
 * Converts CEO natural language into a structured RequirementPackage.
 */

import type { IntentResult } from '../intent-router';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RequirementPackage {
  request_id: string;
  raw_request: string;
  analyzed_at: string;

  objective: string;               // business goal extracted from request
  scope: string[];                 // what IS included
  out_of_scope: string[];          // what is explicitly excluded
  stakeholders: string[];          // roles involved
  risks: string[];                 // high-level risk flags
  assumptions: string[];           // implicit assumptions being made
  constraints: string[];           // time / system / approval limits
  deliverables: string[];          // expected outputs
}

// ── Normalizer ─────────────────────────────────────────────────────────────────

function norm(text: string): string {
  return text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Objective extraction ───────────────────────────────────────────────────────

const OBJECTIVE_MAP: Array<{ patterns: RegExp[]; objective: string; deliverables: string[] }> = [
  {
    patterns: [/kiem tra.*dashboard|audit.*dashboard|dashboard.*kiem tra/],
    objective: 'Xác minh trạng thái và chất lượng Dashboard',
    deliverables: ['Audit report', 'Health check evidence', 'Connector status'],
  },
  {
    patterns: [/tim loi|find.*bug|find.*loi|detect.*error/],
    objective: 'Phát hiện lỗi và vấn đề trong hệ thống',
    deliverables: ['Bug report', 'Error log analysis', 'Source scan results'],
  },
  {
    patterns: [/fix.*loi|fix.*bug|sua loi|khac phuc/],
    objective: 'Sửa lỗi đã phát hiện trong phạm vi an toàn',
    deliverables: ['Fix confirmation', 'Before/after evidence', 'Regression test results'],
  },
  {
    patterns: [/test.*lai|re.*test|kiem tra lai|run.*test/],
    objective: 'Xác nhận hệ thống hoạt động đúng sau thay đổi',
    deliverables: ['Test results', 'QA certification', 'Regression suite pass'],
  },
  {
    patterns: [/deploy|trien khai|len production/],
    objective: 'Triển khai phiên bản mới lên môi trường production',
    deliverables: ['Deployment confirmation', 'Post-deploy health check'],
  },
  {
    patterns: [/bao cao|report|tong hop|summary/],
    objective: 'Tạo báo cáo tổng hợp trạng thái hệ thống',
    deliverables: ['Executive report', 'Status summary'],
  },
];

// ── Scope extraction ───────────────────────────────────────────────────────────

const SCOPE_PATTERNS: Array<{ pattern: RegExp; scope_item: string }> = [
  { pattern: /dashboard/i, scope_item: 'dashboard.bakudanramen.com — routes, health, connectors' },
  { pattern: /mi.?core/i, scope_item: 'mi-core server (port 4001) — APIs, PM2 processes' },
  { pattern: /whatsapp/i, scope_item: 'WhatsApp AI Gateway — session, routing, message delivery' },
  { pattern: /source|code|scan/i, scope_item: 'Source code — TypeScript errors, TODOs, security patterns' },
  { pattern: /log|loi|error/i, scope_item: 'Error logs — PM2 logs, recent error patterns' },
  { pattern: /test|regression/i, scope_item: 'Regression suite — 5 CEO test cases' },
  { pattern: /fix|sua/i, scope_item: 'Auto-fix boundary — SAFE changes only (no schema, no prod data)' },
];

const OUT_OF_SCOPE_MAP: Record<string, string[]> = {
  dashboard: ['WhatsApp routing changes', 'Knowledge Universe modifications', 'Database schema changes'],
  mi_core: ['Frontend code changes', 'WhatsApp client configuration'],
  audit: ['Production data changes', 'Dependency upgrades', 'Architecture changes'],
  fix: ['Manual fixes requiring CEO approval', 'Database migrations', 'Third-party API changes'],
};

// ── Stakeholder extraction ─────────────────────────────────────────────────────

function extractStakeholders(intent: IntentResult): string[] {
  const stakeholders = ['CEO (Hoang Le) — requester'];
  if (['fix_bug', 'build_feature', 'deploy_release'].includes(intent.intent)) {
    stakeholders.push('Engineering Manager — technical planning');
    stakeholders.push('QA Agent — quality certification');
  }
  if (intent.requires_approval) {
    stakeholders.push('CEO approval required before execution');
  }
  stakeholders.push('Auditor — evidence verification');
  return stakeholders;
}

// ── Assumption extraction ──────────────────────────────────────────────────────

const ASSUMPTION_MAP: Record<string, string[]> = {
  audit_project: [
    'mi-core is running on port 4001',
    'PM2 is managing production processes',
    'Dashboard is accessible at bakudanramen.com',
  ],
  fix_bug: [
    'Fixes are limited to SAFE auto-fix boundary',
    'No manual CEO intervention required for L1 fixes',
    'Source control is available for rollback',
  ],
  deploy_release: [
    'TypeScript build is clean (0 errors)',
    'Regression suite passes at ≥80%',
    'CEO has approved deployment',
  ],
  check_status: [
    'PM2 and health endpoints are accessible',
    'Evidence directory is writable',
  ],
};

// ── Constraint extraction ──────────────────────────────────────────────────────

const CONSTRAINT_MAP: Record<string, string[]> = {
  audit_project: ['Max 3 minutes per skill execution', 'Evidence must be written to disk'],
  fix_bug: ['Auto-fix only: no schema changes, no prod data, no dependency upgrades', 'CEO approval required for L3 fixes'],
  deploy_release: ['CEO double-approval required', 'Zero TypeScript errors required', '≥80% regression pass rate required'],
  check_status: ['Read-only operations only'],
};

// ── Main API ──────────────────────────────────────────────────────────────────

export function analyzeRequirements(raw_request: string, intent: IntentResult, requestId: string): RequirementPackage {
  const n = norm(raw_request);

  // Objective — use first match, or combine if multi-phase request
  const matchedObjectives: string[] = [];
  const deliverables: string[] = [];
  for (const entry of OBJECTIVE_MAP) {
    if (entry.patterns.some(p => p.test(n))) {
      matchedObjectives.push(entry.objective);
      deliverables.push(...entry.deliverables);
    }
  }
  const objective = matchedObjectives.length > 1
    ? `Pipeline đa giai đoạn: ${matchedObjectives.join(' → ')}`
    : matchedObjectives[0] || `Thực thi yêu cầu: ${intent.intent.replace('_', ' ')}`;

  // Scope
  const scope: string[] = [];
  for (const sp of SCOPE_PATTERNS) {
    if (sp.pattern.test(raw_request)) scope.push(sp.scope_item);
  }
  if (scope.length === 0) scope.push(`${intent.target_project || 'Hệ thống tổng thể'} — all components`);

  // Out of scope
  const out_of_scope: string[] = [];
  if (intent.target_project && OUT_OF_SCOPE_MAP[intent.target_project]) {
    out_of_scope.push(...OUT_OF_SCOPE_MAP[intent.target_project]);
  }
  if (out_of_scope.length === 0 && OUT_OF_SCOPE_MAP[intent.intent]) {
    out_of_scope.push(...OUT_OF_SCOPE_MAP[intent.intent]);
  }
  if (out_of_scope.length === 0) {
    out_of_scope.push('Thay đổi schema database', 'Nâng cấp dependencies', 'Thay đổi cấu hình production thủ công');
  }

  // Risks (high-level — detailed risk in risk-prediction.ts)
  const risks: string[] = [];
  if (n.includes('fix')) risks.push('Fix có thể gây regression nếu vượt auto-fix boundary');
  if (n.includes('deploy') || n.includes('trien khai')) risks.push('Deployment risk: downtime nếu build thất bại');
  if (intent.risk_level >= 2) risks.push('Yêu cầu CEO approval — pipeline sẽ block nếu không có approval');
  if (risks.length === 0) risks.push('P2: Hệ thống có thể tạm offline trong quá trình scan');

  return {
    request_id: requestId,
    raw_request,
    analyzed_at: new Date().toISOString(),
    objective,
    scope,
    out_of_scope,
    stakeholders: extractStakeholders(intent),
    risks,
    assumptions: ASSUMPTION_MAP[intent.intent] || ASSUMPTION_MAP['audit_project'],
    constraints: CONSTRAINT_MAP[intent.intent] || CONSTRAINT_MAP['audit_project'],
    deliverables: [...new Set(deliverables)],
  };
}
