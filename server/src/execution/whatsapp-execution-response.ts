/**
 * DEV5 — Phase E7: WhatsApp Execution Response
 * 
 * When action request is detected, response must NOT be just advice.
 * Must show: intent detected, workflow created, draft status, approval pending.
 * 
 * NO pure SEO advice for action requests.
 */

import type { ActionIntent } from './action-intent-engine';
import type { ExecutionWorkflow } from './workflow-creation-layer';
import type { ApprovalRequest } from './approval-orchestrator';
import type { SEODraft } from './seo-pipeline';
import { formatApprovalMessage } from './approval-orchestrator';
import { ceoLabel } from './ceo-language-filter';

// ── Response builders ──────────────────────────────────────────────────────

function compactEvidencePath(value?: string): string {
  if (!value) return '';
  const marker = '.local-agent-global';
  const idx = value.indexOf(marker);
  return idx >= 0 ? value.slice(idx) : value;
}

export function buildActionDetectedResponse(intent: ActionIntent): string {
  const entity = intent.target_entity || 'chung';
  const workflows = intent.workflow_types.map(t => ceoLabel(t)).join(' + ');
  return `Em hiểu. Em sẽ thực hiện *${workflows}* cho *${entity}*.`;
}

export function buildWorkflowCreatedResponse(wf: ExecutionWorkflow): string {
  const types = wf.workflow_types.map(t => ceoLabel(t)).join(' + ');
  return `Em đã tạo:\n` +
    `Loại: ${types}\n` +
    `Cho: ${wf.target_entity || 'chung'}\n` +
    `Trạng thái: ${wf.status === 'created' ? 'Đang chuẩn bị' : wf.status === 'executing' ? 'Đang xử lý' : wf.status === 'completed' ? 'Hoàn tất' : wf.status}`;
}

export function buildDraftCreatedResponse(draft: SEODraft): string {
  return `Em da tao draft:\n` +
    `Topic: *${draft.topic.topic}*\n` +
    `Keywords: ${draft.topic.keywords.join(', ')}\n` +
    `Word count: ${draft.article.word_count}\n` +
    `Meta title: ${draft.article.metadata.meta_title}\n` +
    `Slug: /${draft.article.metadata.slug}\n` +
    `Preview: ${draft.preview_path}`;
}

export function buildApprovalRequestResponse(approval: ApprovalRequest): string {
  return formatApprovalMessage(approval);
}

export function buildExecutionStatusResponse(wf: ExecutionWorkflow): string {
  const completedSteps = wf.steps.filter(s => s.status === 'done').length;
  const totalSteps = wf.steps.length;
  return `Workflow *${wf.workflow_id}* — ${completedSteps}/${totalSteps} steps completed.\n` +
    `Status: ${wf.status}\n` +
    `Target: ${wf.target_entity || 'general'}`;
}

// ── Full action response (combines all) ────────────────────────────────────

export function buildFullActionResponse(params: {
  intent: ActionIntent;
  workflow: ExecutionWorkflow;
  draft?: SEODraft;
  approval?: ApprovalRequest;
}): string {
  const lines: string[] = [];

  const entity = params.workflow.target_entity || 'chung';
  const title = params.draft?.topic.topic || `Action for ${entity}`;

  lines.push('Em đã tạo bản nháp để anh duyệt.');
  lines.push('');
  lines.push(`Trạng thái: *Bản nháp đã sẵn sàng*`);
  lines.push(`Tiêu đề: *${title}*`);
  lines.push(`Cho: *${entity}*`);
  lines.push(`Duyệt: *${params.approval ? 'Đang chờ anh' : 'Không cần duyệt'}*`);
  lines.push('');

  if (params.draft) {
    const hasImage = Boolean(params.draft.image_assets?.featured_image);
    lines.push('Tóm tắt:');
    lines.push(`- Bài viết: đã tạo bản nháp`);
    lines.push(`- Hình preview: ${hasImage ? 'em gửi kèm bên dưới' : 'chưa tạo được'}`);
    lines.push(`- OG/social preview: ${params.draft.image_assets?.og_image && params.draft.image_assets?.social_preview ? 'đã tạo' : 'chưa tạo được'}`);
    lines.push('');
  }

  if (params.approval) {
    lines.push('Anh reply: *APPROVE* / *EDIT* / *CANCEL*');
  }

  return lines.join('\n');
}

// ── Danger response ────────────────────────────────────────────────────────

export function buildDangerousActionBlockedResponse(intent: ActionIntent): string {
  const entity = intent.target_entity || '';
  return `Hanh dong nay *NGUY HIEM* va bi BLOCK:\n` +
    `Type: ${intent.message_class}\n` +
    `${entity ? `Target: ${entity}\n` : ''}` +
    `Mi khong tu thuc hien. Can CEO xac nhan truc tiep.`;
}

// ── Duplicate response ─────────────────────────────────────────────────────

export function buildDuplicateResponse(existingWorkflowId: string | null): string {
  if (existingWorkflowId) {
    return `Em da nhan yeu cau nay roi. Workflow *${existingWorkflowId}* dang cho xu ly.\n` +
      `Anh muon em lam gi them khong?`;
  }
  return 'Em da nhan yeu cau tuong tu gan day. Vui long cho 2 phut hoac gui lai voi chi tiet khac.';
}
