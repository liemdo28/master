import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const REVIEW_DIR = path.join(GLOBAL_DIR, 'connectors', 'review-approvals');
const APPROVALS_PATH = path.join(REVIEW_DIR, 'approvals.json');
const AUDIT_PATH = path.join(REVIEW_DIR, 'audit.json');

export interface ReviewApprovalRequest {
  approval_id: string;
  review_id: number;
  store: string;
  platform: string;
  rating: number;
  reviewer_name: string;
  review_text: string;
  review_date?: string | null;
  suggested_reply: string;
  risk_level: string;
  reason: string;
  actions: string[];
}

export interface ReviewApprovalRecord extends ReviewApprovalRequest {
  status: 'pending' | 'approved_by_ceo' | 'rejected_by_ceo' | 'edited_by_ceo' | 'posted' | 'post_failed' | 'approval_timeout' | 'escalated';
  ceo_message: string;
  created_at: string;
  updated_at: string;
  original_reply: string;
  final_reply: string;
  last_result?: unknown;
  last_error?: string;
}

export interface ReviewApprovalAudit {
  approval_id: string;
  review_id: number;
  actor: string;
  channel: string;
  timestamp: string;
  action: string;
  original_reply: string;
  final_reply: string;
  result?: unknown;
  error?: string;
}

function ensureDir() {
  if (!fs.existsSync(REVIEW_DIR)) fs.mkdirSync(REVIEW_DIR, { recursive: true });
}

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, data: unknown) {
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function formatReviewApprovalMessage(payload: ReviewApprovalRequest): string {
  return [
    'Review needs approval',
    '',
    `Store: ${payload.store}`,
    `Platform: ${payload.platform}`,
    `Rating: ${payload.rating} stars`,
    `Customer: ${payload.reviewer_name}`,
    '',
    'Review:',
    `"${payload.review_text}"`,
    '',
    'Suggested reply:',
    `"${payload.suggested_reply}"`,
    '',
    'Reply options:',
    '1. Approve',
    '2. Reject',
    '3. Edit: <new reply>',
    '4. Escalate',
  ].join('\n');
}

export function saveReviewApproval(payload: ReviewApprovalRequest): ReviewApprovalRecord {
  const approvals = readJson<ReviewApprovalRecord[]>(APPROVALS_PATH, []);
  const now = new Date().toISOString();
  const existingIndex = approvals.findIndex(a => a.approval_id === payload.approval_id);
  const existing = existingIndex >= 0 ? approvals[existingIndex] : null;
  const record: ReviewApprovalRecord = {
    ...payload,
    status: existing?.status || 'pending',
    ceo_message: formatReviewApprovalMessage(payload),
    created_at: existing?.created_at || now,
    updated_at: now,
    original_reply: existing?.original_reply || payload.suggested_reply,
    final_reply: existing?.final_reply || payload.suggested_reply,
    last_result: existing?.last_result,
    last_error: existing?.last_error,
  };

  if (existingIndex >= 0) approvals[existingIndex] = record;
  else approvals.push(record);
  if (approvals.length > 1000) approvals.splice(0, approvals.length - 1000);
  writeJson(APPROVALS_PATH, approvals);
  return record;
}

export function getReviewApprovalByReviewId(reviewId: number): ReviewApprovalRecord | undefined {
  return readJson<ReviewApprovalRecord[]>(APPROVALS_PATH, []).find(a => a.review_id === reviewId);
}

export function getReviewApprovals(limit = 50): ReviewApprovalRecord[] {
  return readJson<ReviewApprovalRecord[]>(APPROVALS_PATH, []).slice(-limit).reverse();
}

export function getOverdueReviewApprovals(timeoutMinutes: number): ReviewApprovalRecord[] {
  const cutoff = Date.now() - timeoutMinutes * 60_000;
  return readJson<ReviewApprovalRecord[]>(APPROVALS_PATH, []).filter((record) => {
    if (!['pending', 'edited_by_ceo'].includes(record.status)) return false;
    return new Date(record.created_at).getTime() <= cutoff;
  });
}

export function updateReviewApproval(
  reviewId: number,
  updates: Partial<Pick<ReviewApprovalRecord, 'status' | 'final_reply' | 'last_result' | 'last_error'>>,
): ReviewApprovalRecord | undefined {
  const approvals = readJson<ReviewApprovalRecord[]>(APPROVALS_PATH, []);
  const record = approvals.find(a => a.review_id === reviewId);
  if (!record) return undefined;
  Object.assign(record, updates, { updated_at: new Date().toISOString() });
  writeJson(APPROVALS_PATH, approvals);
  return record;
}

export function appendReviewApprovalAudit(entry: ReviewApprovalAudit) {
  const audit = readJson<ReviewApprovalAudit[]>(AUDIT_PATH, []);
  audit.push(entry);
  if (audit.length > 2000) audit.splice(0, audit.length - 2000);
  writeJson(AUDIT_PATH, audit);
}

export function getReviewApprovalAudit(limit = 100): ReviewApprovalAudit[] {
  return readJson<ReviewApprovalAudit[]>(AUDIT_PATH, []).slice(-limit).reverse();
}
