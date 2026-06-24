/**
 * Approval Conversation — manages WhatsApp approval dialogs.
 * Tracks pending approvals by ID. Each approval has a TTL.
 * Integrates with existing approval gate in whatsapp/ceo-command-router.ts.
 */

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ApprovalItem {
  id: string;
  suggestion_id?: string;
  action_type: string;
  description: string;
  whatsapp_prompt: string;
  risk_level: 1 | 2 | 3;
  created_at: string;
  expires_at: string;
  status: ApprovalStatus;
  resolved_at?: string;
  auto_command?: string;
}

const APPROVALS = new Map<string, ApprovalItem>();
const TTL_MS = 30 * 60 * 1000; // 30 min

export function createApproval(params: {
  action_type: string;
  description: string;
  whatsapp_prompt: string;
  risk_level: 1 | 2 | 3;
  suggestion_id?: string;
  auto_command?: string;
}): ApprovalItem {
  const id = 'appr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const now = new Date();
  const item: ApprovalItem = {
    id,
    ...params,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + TTL_MS).toISOString(),
    status: 'pending',
  };
  APPROVALS.set(id, item);
  return item;
}

export function resolveApproval(id: string, decision: 'approved' | 'rejected'): ApprovalItem | null {
  const item = APPROVALS.get(id);
  if (!item || item.status !== 'pending') return null;
  item.status = decision;
  item.resolved_at = new Date().toISOString();
  return item;
}

export function getPendingApprovals(): ApprovalItem[] {
  const now = Date.now();
  const result: ApprovalItem[] = [];
  for (const [id, item] of APPROVALS) {
    if (item.status === 'pending') {
      if (new Date(item.expires_at).getTime() < now) {
        item.status = 'expired';
      } else {
        result.push(item);
      }
    }
  }
  return result;
}

export function getApprovalById(id: string): ApprovalItem | null {
  return APPROVALS.get(id) || null;
}

export function formatApprovalWhatsApp(item: ApprovalItem): string {
  const riskIcon = item.risk_level === 3 ? '🔴' : item.risk_level === 2 ? '🟡' : '🟢';
  return [
    `${riskIcon} *Yêu cầu phê duyệt* [L${item.risk_level}]`,
    `📋 ${item.description}`,
    ``,
    `✅ Anh reply *approve ${item.id}* để xác nhận`,
    `❌ Anh reply *cancel* để bỏ`,
    `⏳ Hết hạn: 30 phút`,
  ].join('\n');
}
