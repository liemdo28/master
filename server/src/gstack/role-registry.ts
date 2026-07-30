/**
 * GStack Role Registry
 * Defines all 6 operating roles, their capabilities, and ownership boundaries.
 * Queryable — Mi can ask "who handles this?" at runtime.
 */

export type RoleId =
  | 'product_manager'
  | 'engineering_manager'
  | 'developer'
  | 'qa'
  | 'release'
  | 'auditor';

export interface Role {
  id: RoleId;
  name: string;
  name_vi: string;
  owns: string[];           // what this role is responsible for
  can_execute: string[];    // skill IDs this role may invoke
  max_risk_level: 1 | 2 | 3;
  requires_approval_for: string[];
}

const ROLES: Record<RoleId, Role> = {
  product_manager: {
    id: 'product_manager',
    name: 'Product Manager',
    name_vi: 'Quản lý sản phẩm',
    owns: ['acceptance_criteria', 'scope_definition', 'ceo_communication', 'report_creation'],
    can_execute: ['knowledge_search', 'dashboard_read', 'gmail_draft', 'calendar_read'],
    max_risk_level: 1,
    requires_approval_for: ['gmail_send', 'calendar_write'],
  },
  engineering_manager: {
    id: 'engineering_manager',
    name: 'Engineering Manager',
    name_vi: 'Quản lý kỹ thuật',
    owns: ['technical_planning', 'task_breakdown', 'system_scan', 'build_verification'],
    can_execute: ['health', 'github_read', 'source_scan', 'log_scan', 'pm2_status'],
    max_risk_level: 2,
    requires_approval_for: ['github_write', 'config_change'],
  },
  developer: {
    id: 'developer',
    name: 'Developer',
    name_vi: 'Lập trình viên',
    owns: ['code_implementation', 'safe_patches', 'unit_tests'],
    can_execute: ['github_read', 'source_scan', 'knowledge_search'],
    max_risk_level: 2,
    requires_approval_for: ['github_write', 'file_write', 'deploy'],
  },
  qa: {
    id: 'qa',
    name: 'QA Agent',
    name_vi: 'Kiểm định chất lượng',
    owns: ['test_execution', 'regression', 'health_sweep', 'certification_evidence'],
    can_execute: ['health', 'regression_suite', 'pm2_status', 'build_check', 'dashboard_audit'],
    max_risk_level: 1,
    requires_approval_for: [],
  },
  release: {
    id: 'release',
    name: 'Release Agent',
    name_vi: 'Phát hành',
    owns: ['deployment', 'rollback', 'production_verification'],
    can_execute: ['health', 'pm2_restart', 'build_deploy', 'rollback'],
    max_risk_level: 3,
    requires_approval_for: ['pm2_restart', 'build_deploy', 'rollback'],
  },
  auditor: {
    id: 'auditor',
    name: 'Auditor',
    name_vi: 'Kiểm toán độc lập',
    owns: ['evidence_verification', 'certification', 'claim_rejection'],
    can_execute: ['source_scan', 'log_scan', 'health', 'knowledge_search'],
    max_risk_level: 1,
    requires_approval_for: [],
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

export function getRole(id: RoleId): Role {
  return ROLES[id];
}

export function listRoles(): Role[] {
  return Object.values(ROLES);
}

export function getRoleForIntent(intent: string): RoleId {
  const map: Record<string, RoleId> = {
    audit_project:    'qa',
    fix_bug:          'engineering_manager',
    build_feature:    'engineering_manager',
    deploy_release:   'release',
    rollback:         'release',
    check_status:     'qa',
    monitor_runtime:  'qa',
    create_report:    'product_manager',
    search_knowledge: 'product_manager',
    send_message:     'product_manager',
    unknown:          'product_manager',
  };
  return map[intent] || 'product_manager';
}

export function canExecuteSkill(roleId: RoleId, skillId: string): boolean {
  const role = ROLES[roleId];
  return role?.can_execute.includes(skillId) ?? false;
}

export function formatRolesForCeo(): string {
  return listRoles().map(r =>
    `*${r.name_vi}* — ${r.owns.slice(0, 2).join(', ')}`
  ).join('\n');
}
