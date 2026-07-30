/**
 * EmailActionService.mjs
 * Draft, send, reply, forward emails via Gmail.
 * ALL send actions require CEO approval.
 */

import path from 'path';
import { ApprovalRequiredAction } from './ApprovalRequiredAction.mjs';
import { auditLog } from './ActionAuditLog.mjs';
import { localFileConnector } from '../universal-visibility/LocalFileVisibilityConnector.mjs';

export class EmailActionService {
  /**
   * Create Gmail draft — requires approval to send
   * @param {object} params
   * @param {string} params.to - recipient email
   * @param {string} params.to_name - recipient display name
   * @param {string} params.subject
   * @param {string} params.body - email body (can include markdown)
   * @param {string} [params.attachment_path] - optional file attachment
   * @param {boolean} [params.use_drive_link] - if file >10MB, send Drive link instead
   */
  static draftEmail(params) {
    const { to, to_name, subject, body, attachment_path, use_drive_link } = params;

    // Security: block sensitive attachments
    if (attachment_path && localFileConnector.isFileBlocked(attachment_path)) {
      return {
        blocked: true,
        reason: `🚫 Security: "${path.basename(attachment_path)}" cannot be sent — sensitive file.`,
      };
    }

    const attachInfo = attachment_path ? localFileConnector.getFileInfo(attachment_path) : null;
    const useDriveLink = use_drive_link || (attachInfo && attachInfo.size_kb > 10240); // >10MB

    const draft = {
      type: 'gmail-draft',
      to,
      to_name,
      subject,
      body,
      attachment: attachInfo ? {
        path: attachment_path,
        name: attachInfo.name,
        size_kb: attachInfo.size_kb,
        send_as_link: useDriveLink,
      } : null,
      created_at: new Date().toISOString(),
    };

    auditLog.log({ event: 'email_drafted', to, subject, has_attachment: !!attachment_path });

    return {
      status: 'draft',
      draft,
      preview: [
        `📧 Email Draft:`,
        `To: ${to_name ? `${to_name} <${to}>` : to}`,
        `Subject: ${subject}`,
        `Body:\n${body.slice(0, 300)}${body.length > 300 ? '...' : ''}`,
        attachInfo ? `Attachment: ${attachInfo.name} (${attachInfo.size_kb}KB)${useDriveLink ? ' — will send as Drive link' : ''}` : '',
      ].filter(Boolean).join('\n'),
    };
  }

  /**
   * Queue email for sending — requires CEO approval
   */
  static queueSend(draftOrParams) {
    const draft = draftOrParams.draft || draftOrParams;

    // Security check on attachment
    if (draft.attachment?.path && localFileConnector.isFileBlocked(draft.attachment.path)) {
      return {
        blocked: true,
        reason: `🚫 Blocked: "${draft.attachment.name}" is a sensitive file and cannot be sent.`,
      };
    }

    const action = ApprovalRequiredAction.create({
      type: 'send-email',
      target: draft.to,
      description: `Send email to ${draft.to_name || draft.to}: "${draft.subject}"${draft.attachment ? ` + attachment ${draft.attachment.name}` : ''}`,
      payload: draft,
      before_state: 'Email draft ready, not sent',
      rollback_plan: 'Email cannot be unsent — act before approving',
    });

    return {
      status: 'pending_approval',
      action,
      formatted: ApprovalRequiredAction.formatForResponse(action),
    };
  }

  /**
   * Full flow: find file → draft email → queue for approval
   * Used when CEO says "tìm file X rồi gửi cho David"
   */
  static async findAndSend(fileQuery, recipientInfo, emailOpts = {}) {
    // Step 1: Find file
    const fileResult = localFileConnector.searchFiles(fileQuery, { maxResults: 5 });

    if (fileResult.count === 0) {
      return {
        status: 'file_not_found',
        message: `Em tìm không thấy file "${fileQuery}" trong hệ thống. Anh muốn tìm cụ thể hơn không?`,
        query: fileQuery,
      };
    }

    // If multiple files found, ask for confirmation
    if (fileResult.count > 1) {
      return {
        status: 'ambiguous_file',
        message: `Em tìm thấy ${fileResult.count} file liên quan:`,
        files: fileResult.files,
        next_step: 'Anh chọn file nào để gửi?',
      };
    }

    const file = fileResult.files[0];

    // Step 2: Block sensitive files
    if (file.blocked || localFileConnector.isFileBlocked(file.path)) {
      return {
        blocked: true,
        reason: `🚫 "${file.name}" là file nhạy cảm — không thể gửi qua email.`,
      };
    }

    // Step 3: Draft email
    const recipient = typeof recipientInfo === 'string'
      ? { to: recipientInfo, to_name: '' }
      : recipientInfo;

    const draftResult = this.draftEmail({
      to: recipient.email || recipient.to,
      to_name: recipient.name || recipient.to_name,
      subject: emailOpts.subject || `${file.name} — shared by Mi`,
      body: emailOpts.body || `Kính gửi ${recipient.name || 'bạn'},\n\nVui lòng tìm file đính kèm: ${file.name}\n\nTrân trọng`,
      attachment_path: file.path,
    });

    if (draftResult.blocked) return draftResult;

    // Step 4: Queue for approval
    return this.queueSend(draftResult);
  }

  /**
   * Draft a reply to an email — requires approval
   */
  static draftReply(originalEmail, replyBody) {
    const draft = {
      type: 'gmail-reply',
      to: originalEmail.from,
      subject: `Re: ${originalEmail.subject}`,
      body: replyBody,
      thread_id: originalEmail.thread_id,
    };

    const action = ApprovalRequiredAction.create({
      type: 'reply-email',
      target: originalEmail.from,
      description: `Reply to "${originalEmail.subject}" from ${originalEmail.from}`,
      payload: draft,
      before_state: `Original email received ${originalEmail.date}`,
      rollback_plan: 'Reply cannot be unsent — confirm before approving',
    });

    return { status: 'pending_approval', action, formatted: ApprovalRequiredAction.formatForResponse(action) };
  }
}
