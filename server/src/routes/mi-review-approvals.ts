import { Router, Request, Response } from 'express';
import {
  appendReviewApprovalAudit,
  getReviewApprovalAudit,
  getReviewApprovals,
  getOverdueReviewApprovals,
  ReviewApprovalRequest,
  saveReviewApproval,
  updateReviewApproval,
} from '../services/review-approval-store';

export const miReviewApprovalsRouter = Router();

function internalAuth(req: Request, res: Response, next: () => void) {
  const expected = process.env.REVIEW_APPROVAL_INTERNAL_TOKEN || '';
  if (!expected) return next();
  const supplied = String(req.headers['x-internal-token'] || req.headers['x-api-key'] || '');
  if (supplied !== expected) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  return next();
}

async function callReviewSystem(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body: any }> {
  const baseUrl = process.env.REVIEW_SYSTEM_BASE_URL || 'http://127.0.0.1:8000';
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(init.headers as Record<string, string> || {}),
  };
  if (process.env.REVIEW_SYSTEM_INTERNAL_TOKEN) headers['x-internal-token'] = process.env.REVIEW_SYSTEM_INTERNAL_TOKEN;
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await response.text();
  let body: any = text;
  try { body = text ? JSON.parse(text) : {}; } catch { /* keep text */ }
  return { ok: response.ok, status: response.status, body };
}

function validatePayload(body: Partial<ReviewApprovalRequest>): string | null {
  const required: Array<keyof ReviewApprovalRequest> = [
    'approval_id',
    'review_id',
    'store',
    'platform',
    'rating',
    'reviewer_name',
    'review_text',
    'suggested_reply',
    'risk_level',
    'reason',
    'actions',
  ];
  for (const key of required) {
    if (body[key] === undefined || body[key] === null || body[key] === '') return `Missing ${key}`;
  }
  if (!Array.isArray(body.actions)) return 'actions must be an array';
  return null;
}

miReviewApprovalsRouter.post('/review-approvals', internalAuth, (req: Request, res: Response) => {
  const error = validatePayload(req.body);
  if (error) return res.status(400).json({ ok: false, error });

  const record = saveReviewApproval(req.body as ReviewApprovalRequest);
  return res.json({
    ok: true,
    approval_id: record.approval_id,
    review_id: record.review_id,
    status: record.status,
    ceo_message: record.ceo_message,
    notify: {
      channel: 'whatsapp_or_mi_chatbot',
      message: record.ceo_message,
    },
  });
});

miReviewApprovalsRouter.post('/review-approvals/sweep-timeouts', async (_req: Request, res: Response) => {
  const timeoutMinutes = parseInt(process.env.REVIEW_APPROVAL_TIMEOUT_MINUTES || '1440', 10);
  const overdue = getOverdueReviewApprovals(timeoutMinutes);
  const results = [];

  for (const record of overdue) {
    updateReviewApproval(record.review_id, { status: 'approval_timeout', last_error: 'Approval timed out' });
    const escalation = await callReviewSystem(`/api/reviews/${record.review_id}/escalate`, {
      method: 'POST',
      body: JSON.stringify({ actor: 'mi-core', source: 'timeout', reason: `Approval timed out after ${timeoutMinutes} minutes` }),
    });
    const status = escalation.ok ? 'escalated' : 'post_failed';
    updateReviewApproval(record.review_id, {
      status,
      last_result: escalation.body,
      last_error: escalation.ok ? undefined : `Escalation failed (${escalation.status})`,
    });
    appendReviewApprovalAudit({
      approval_id: record.approval_id,
      review_id: record.review_id,
      actor: 'mi-core',
      channel: 'timeout',
      timestamp: new Date().toISOString(),
      action: 'approval_timeout',
      original_reply: record.original_reply,
      final_reply: record.final_reply,
      result: escalation.body,
      error: escalation.ok ? undefined : `Escalation failed (${escalation.status})`,
    });
    results.push({ review_id: record.review_id, status, escalation_status: escalation.status });
  }

  res.json({ ok: true, timeout_minutes: timeoutMinutes, processed: results.length, results });
});

miReviewApprovalsRouter.get('/review-approvals', (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit || '50'), 10);
  res.json({ ok: true, approvals: getReviewApprovals(limit) });
});

miReviewApprovalsRouter.get('/review-approvals/audit', (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit || '100'), 10);
  res.json({ ok: true, audit: getReviewApprovalAudit(limit) });
});
