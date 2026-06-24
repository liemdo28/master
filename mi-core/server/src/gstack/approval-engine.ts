/**
 * GStack Approval Engine
 * Classifies any planned action as SAFE (auto-execute) or REQUIRES_APPROVAL.
 * Single source of truth for the risk/approval boundary.
 */

import { getSkill } from './skills/skill-registry';
import { getRole, RoleId } from './role-registry';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ApprovalVerdict = 'SAFE' | 'REQUIRES_APPROVAL';

export interface ApprovalContext {
  intent?: string;
  requested_by?: string;
  target_project?: string;
  skill_id?: string;
  role_id?: RoleId;
  action_description?: string;
}

export interface ApprovalResult {
  verdict: ApprovalVerdict;
  reason: string;
  risk_level: 1 | 2 | 3;
  requires_ceo_approval: boolean;
  approval_count_needed: number;  // 0 = auto, 1 = single CEO, 2 = double CEO
}

// ── Classification rules ──────────────────────────────────────────────────────

const ALWAYS_SAFE_INTENTS = new Set([
  'check_status',
  'monitor_runtime',
  'search_knowledge',
  'audit_project',
  'create_report',
]);

const ALWAYS_APPROVAL_INTENTS = new Set([
  'deploy_release',
  'rollback',
  'send_message',
]);

const SAFE_SKILLS = new Set([
  'health', 'pm2_status', 'source_scan', 'log_scan', 'build_check',
  'regression_suite', 'dashboard_audit', 'knowledge_search',
  'review_automation', 'calendar_read', 'github_read',
]);

const APPROVAL_SKILLS = new Set([
  'pm2_restart', 'github_write', 'gmail_send', 'calendar_write',
]);

// ── Core classifier ───────────────────────────────────────────────────────────

export function classify(action: ApprovalContext): ApprovalResult {
  const { intent, skill_id, role_id } = action;

  // 1. Skill-level classification (most precise)
  if (skill_id) {
    const skill = getSkill(skill_id);
    if (skill) {
      if (skill.approval_class === 'REQUIRES_APPROVAL' || APPROVAL_SKILLS.has(skill_id)) {
        const level = skill.risk_level;
        return {
          verdict: 'REQUIRES_APPROVAL',
          reason: `Skill '${skill.name_vi}' modifies production or sends external data`,
          risk_level: level,
          requires_ceo_approval: true,
          approval_count_needed: level >= 3 ? 2 : 1,
        };
      }
      if (SAFE_SKILLS.has(skill_id) || skill.approval_class === 'SAFE') {
        return { verdict: 'SAFE', reason: `Skill '${skill.name_vi}' is read-only`, risk_level: 1, requires_ceo_approval: false, approval_count_needed: 0 };
      }
    }
  }

  // 2. Role-level boundary check
  if (role_id && skill_id) {
    const role = getRole(role_id);
    if (role && role.requires_approval_for.includes(skill_id)) {
      return {
        verdict: 'REQUIRES_APPROVAL',
        reason: `Role '${role.name_vi}' requires approval to run '${skill_id}'`,
        risk_level: role.max_risk_level,
        requires_ceo_approval: true,
        approval_count_needed: 1,
      };
    }
  }

  // 3. Intent-level classification (coarse)
  if (intent) {
    if (ALWAYS_SAFE_INTENTS.has(intent)) {
      return { verdict: 'SAFE', reason: `Intent '${intent}' is read-only by policy`, risk_level: 1, requires_ceo_approval: false, approval_count_needed: 0 };
    }
    if (ALWAYS_APPROVAL_INTENTS.has(intent)) {
      const level: 1 | 2 | 3 = intent === 'rollback' ? 3 : intent === 'deploy_release' ? 3 : 2;
      return {
        verdict: 'REQUIRES_APPROVAL',
        reason: `Intent '${intent}' affects production or sends external communication`,
        risk_level: level,
        requires_ceo_approval: true,
        approval_count_needed: level >= 3 ? 2 : 1,
      };
    }
  }

  // 4. Default: safe for passive, requires approval for active verbs
  const desc = (action.action_description || '').toLowerCase();
  const activeVerbs = /\b(restart|kill|deploy|delete|remove|send|create|write|push|merge|rollback|install|uninstall|modify|update|patch)\b/;
  if (activeVerbs.test(desc)) {
    return {
      verdict: 'REQUIRES_APPROVAL',
      reason: `Action description contains production-modifying verb`,
      risk_level: 2,
      requires_ceo_approval: true,
      approval_count_needed: 1,
    };
  }

  return { verdict: 'SAFE', reason: 'No production-modifying action detected', risk_level: 1, requires_ceo_approval: false, approval_count_needed: 0 };
}

// ── Convenience helpers ───────────────────────────────────────────────────────

export function isSafe(action: ApprovalContext): boolean {
  return classify(action).verdict === 'SAFE';
}

export function requiresApproval(action: ApprovalContext): boolean {
  return classify(action).verdict === 'REQUIRES_APPROVAL';
}

export function classifySkill(skill_id: string, intent?: string): ApprovalResult {
  return classify({ skill_id, intent });
}

export function formatApprovalMessage(result: ApprovalResult, action: ApprovalContext): string {
  if (result.verdict === 'SAFE') return '';
  const approvals = result.approval_count_needed === 2 ? 'hai lần xác nhận' : 'xác nhận';
  return `⏳ Hành động này cần ${approvals} từ anh trước khi thực hiện.\n*Lý do:* ${result.reason}`;
}
