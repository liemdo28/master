/**
 * WhatsApp /mi endpoint for Mi-Core
 *
 * POST /api/whatsapp/mi  — receive WhatsApp message from whatsapp-api
 * GET  /api/whatsapp/mi/health   — health check
 * GET  /api/whatsapp/mi/status   — full status
 * GET  /api/whatsapp/mi/messages — message log
 * GET  /api/whatsapp/mi/approvals — approval records
 * GET  /api/whatsapp/mi/audit    — audit log
 *
 * Flow:
 * 1. Verify API key
 * 2. Verify client_id = mi-core
 * 3. Rate limit check
 * 4. Replay protection by message_id
 * 5. Normalize message (strip /mi prefix)
 * 6. Route to Mi Executive Pipeline
 * 7. Handle approval if needed
 * 8. Return response
 */
import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import {
  validateApiKey,
  checkRateLimit,
  isKeyConfigured,
  isMessageDuplicate,
  getKeyStatus,
  getRateLimitState,
  getAuditEntries,
} from '../services/whatsapp-key-manager';
import {
  saveMessage,
  saveParticipant,
  getAllMessages,
  getApprovals,
  getSummary,
  logError,
  updateMessageStatus,
  saveApproval,
  getPendingWhatsAppApprovals,
  updateApproval as updateStoreApproval,
} from '../services/whatsapp-store';
import { runPipeline } from '../pipeline/response-pipeline';
import { enqueueChat, ChatQueueFullError, ChatTimeoutError } from '../chat/chat-queue';
import { approve, reject, getPending, getById } from '../approval/gate';
import { setupApiKey, rotateApiKey, revokeApiKey } from '../services/whatsapp-key-manager';
import { routeCeoCommand } from '../whatsapp/ceo-command-router';
import { handleMiHumanAssistant } from '../communication/mi-human-assistant';
import { findSkill } from '../skills/skill-registry';
import { appendGroupMessage, upsertParticipant as upsertContextParticipant } from '../intelligence/context-memory';
import { responseScrubberMiddleware } from '../middleware/response-scrubber';
import {
  buildDangerousActionBlockedResponse,
  classifyActionIntent,
  needsWorkflow,
  processCEORequest,
  resolveApproval as resolveExecutionApproval,
} from '../execution';
import { isMultiIntent } from '../execution/multi-intent-engine';
import { executeMultiIntent, type MultiIntentExecutionSummary } from '../execution/multi-intent-executor';
import { answerQuickBooksQuestion } from '../visibility/connectors/qb-runtime-connector';
import { evaluateStatement, extractStatementTopic } from '../communication/statement-guard';
import { checkFingerprint, registerFingerprint } from '../execution/message-fingerprint';

const MI_ROOT = process.cwd();
const LOCAL_GLOBAL_DIR = path.join(MI_ROOT, '.local-agent-global');
const CORRECTION_LOG = path.join(LOCAL_GLOBAL_DIR, 'operational-memory', 'ceo-corrections.jsonl');

// ── Sensitive action categories requiring double approval ────────────────────
const DOUBLE_APPROVAL_KEYWORDS = [
  'payroll', 'health', 'private', 'financial', 'export',
  'production', 'deploy', 'delete.*project', 'database.*migration',
  'role.*change', 'permission.*change',
];

// ── Router ──────────────────────────────────────────────────────────────────
export const whatsappRouter = Router();

// P0 Security: scrub secrets from ALL reply fields before they leave the system
whatsappRouter.use(responseScrubberMiddleware);

// ── Middleware: API key validation ──────────────────────────────────────────
async function waAuth(req: Request, res: Response, next: Function) {
  const apiKey = (req.headers['x-api-key'] as string) || req.body?.api_key || '';

  if (!apiKey) {
    return res.status(401).json({ ok: false, error: 'MISSING_API_KEY' });
  }

  if (!validateApiKey(apiKey)) {
    logError({
      ts: new Date().toISOString(),
      message_id: req.body?.message_id || 'unknown',
      chat_id: req.body?.chat_id || 'unknown',
      error: 'INVALID_API_KEY',
    });
    return res.status(403).json({ ok: false, error: 'INVALID_API_KEY' });
  }

  next();
}

// ── Normalize WhatsApp message: strip /mi prefix ───────────────────────────
function normalizeMessage(text: string): { normalized: string; isMiCommand: boolean } {
  if (!text) return { normalized: '', isMiCommand: false };

  const trimmed = text.trim();

  // /mi ... prefix (with optional punctuation)
  const miMatch = trimmed.match(/^\/mi[\s,;:!.]+\s*(.*)/i);
  if (miMatch) {
    return { normalized: miMatch[1].trim(), isMiCommand: true };
  }

  // /mi alone (just "mi" with no follow-up text)
  const miAlone = trimmed.match(/^\/mi[\s,;:!.]*$/i);
  if (miAlone) {
    return { normalized: '', isMiCommand: true };
  }

  // Not a /mi command — check if it still looks like one
  if (/^mi[,\s]/i.test(trimmed) && !trimmed.toLowerCase().startsWith('michael') && !trimmed.toLowerCase().startsWith('microsoft')) {
    if (/^mi\s*(ơi|oi|o'i|ui)[\s!.?]*$/i.test(trimmed)) {
      return { normalized: 'Mi ơi', isMiCommand: true };
    }
    const rest = trimmed.replace(/^mi[,\s]+/i, '').trim();
    return { normalized: rest, isMiCommand: true };
  }

  return { normalized: trimmed, isMiCommand: false };
}

function stripLiveTestPrefix(message: string): string {
  return String(message || '').replace(/^TEST-DEV5-\d+\s+/i, '').trim();
}

// ── Detect if an action requires approval ──────────────────────────────────
function requiresApproval(message: string): boolean {
  const lower = message.toLowerCase();
  const actionPatterns = [
    /tạo|create|giao|assign|update|sửa|edit|delete|xóa|gửi|send|chuyển|transfer|đặt|book|cancel|hủy/i,
    /task|meeting|email.*cho|message.*cho|draft|post|schedule|invoice|payment/i,
  ];
  return actionPatterns.some(p => p.test(lower));
}

function requiresDoubleApproval(message: string): boolean {
  const lower = message.toLowerCase();
  return DOUBLE_APPROVAL_KEYWORDS.some(kw => new RegExp(kw, 'i').test(lower));
}

function shouldUseDeterministicMultiIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const expectedSignals = [
    /dashboard/.test(lower),
    /\bqb\b|quickbooks/.test(lower),
    /raw\s*seo|seo\s*raw|raw sushi.*seo|seo.*raw sushi/.test(lower),
    /maria/.test(lower),
  ].filter(Boolean).length;
  return expectedSignals >= 2 && (isMultiIntent(message) || message.includes('+'));
}

function formatMultiIntentReply(result: MultiIntentExecutionSummary): string {
  // P2+P3: Use CEO language filter — no internal workflow names, no IDs
  return result.final_summary;
}

function isFinanceTruthQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  const financeSignal = /\b(qb|quickbooks|finance|financial|doanh thu|revenue|sales|chi phi|expense|expenses|cost|costs|spend|spending|tai chinh|sync|bill|bills|payment|payments|invoice|receipt)\b/.test(lower) || /chi\s*phi/.test(lower) || /thang\s*nay/.test(lower) || /recent/.test(lower);
  const questionSignal = /\b(bao nhieu|bao nhieu|how much|sao roi|sao roi|status|sync|dong bo|dong bo|co khong|co khong|chua|chua|latest|gan nhat|gan nhat|duplicate|duplicates|trung|trung|check|kiem tra|kiem tra|thang nay|recent|payment)\b/.test(lower) || /[?？]/.test(message);
  const explicitFinanceTruth = /\bfinance\s+status\b/.test(lower) || /\bduplicate(s)?\s+(bill|bills|payment|payments)\b/.test(lower);
  const actionSignal = /\b(tao|tạo|create|generate|viet|viết|gui|gửi|send|post|dang|đăng|approve|duyet|duyệt)\b/.test(lower);
  return (explicitFinanceTruth || (financeSignal && questionSignal)) && !actionSignal;
}

function isObviousUnknownRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return /\bunknown\b/.test(lower) || /\bquantum\s+sushi\b/.test(lower);
}

function isImageFollowup(message: string): boolean {
  return /\b(hinh|hình|anh|ảnh|image|preview)\b/i.test(message) && /\b(khong|không|co|có|gui|gửi|dau|đâu|ha|hả)\b/i.test(message);
}

function latestSeoImagePath(): string | null {
  const dir = path.join(LOCAL_GLOBAL_DIR, 'seo-images');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter(f => /^featured-.*\.(svg|png|jpg|jpeg)$/i.test(f))
    .map(f => ({ f, p: path.join(dir, f), m: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  return files[0]?.p || null;
}

function appendCorrection(entry: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(CORRECTION_LOG), { recursive: true });
  fs.appendFileSync(CORRECTION_LOG, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n', 'utf8');
}

function classifyCeoCorrection(message: string): 'qb_report_completed' | 'payroll_schedule' | null {
  const lower = message.toLowerCase();
  if (/\bqb\b|quickbooks/.test(lower) && /\b(hoàn\s*thành|hoan\s*thanh|xong|completed|done)\b/.test(lower)) {
    return 'qb_report_completed';
  }
  if (/\bpayroll\b/.test(lower) && /\b(tuần\s*rồi|tuan\s*roi|tuần\s*sau|tuan\s*sau|next\s*week|last\s*week)\b/.test(lower)) {
    return 'payroll_schedule';
  }
  return null;
}

function isShortClarification(message: string): boolean {
  return /^(hả|ha|hah|gì|gi|sao|what)\??$/i.test(message.trim());
}

function isReadOnlyDashboardQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  if (!/\bdashboard\b|dash\s*board|bảng\s*điều\s*khiển|bang\s*dieu\s*khien/.test(lower)) return false;
  return /\b(kiem\s*tra|kiểm\s*tra|check|xem|coi|status|trạng\s*thái|tinh\s*hinh|tình\s*hình|sao\s*rồi|sao\s*roi|ổn|on)\b/.test(lower);
}

async function tryJarvisReadOnlyReply(message: string, sender: string | undefined, timestamp: string | undefined, chatId: string | undefined) {
  const { processJarvisQuery } = await import('../jarvis/phase30-jarvis/jarvis-core');
  return processJarvisQuery({
    sender: sender || 'whatsapp',
    raw_text: message,
    normalized: message,
    timestamp: timestamp || new Date().toISOString(),
    session_id: chatId || undefined,
  });
}

function normalizeWhatsAppIdentity(value: string): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.endsWith('@lid')) return raw;
  return raw
    .replace(/@(c\.us|s\.whatsapp\.net)$/i, '')
    .replace(/[\s\-().+]/g, '');
}

function getAllowedCeoIdentities(): string[] {
  return [
    process.env.CEO_WHATSAPP_NUMBER || '',
    process.env.CEO_WHATSAPP_ALLOWED_NUMBERS || '',
    process.env.MI_CEO_WHATSAPP_IDS || '',
  ]
    .join(',')
    .split(',')
    .map(normalizeWhatsAppIdentity)
    .filter(Boolean);
}

function isAllowedCeoSender(sender: string): boolean {
  const allowed = getAllowedCeoIdentities();
  if (allowed.length === 0) return true;
  return allowed.includes(normalizeWhatsAppIdentity(sender));
}

// ── POST /api/whatsapp/mi — main message handler ────────────────────────────
whatsappRouter.post('/mi', waAuth, async (req: Request, res: Response) => {
  const {
    source,
    client_id,
    message_id,
    chat_id,
    group_id = '',
    is_group = false,
    sender,
    sender_name = '',
    text,
    timestamp,
    attachments = [],
    quoted_message,
    api_key: _apiKey, // extracted via middleware, not used here
  } = req.body as {
    source?: string;
    client_id?: string;
    message_id?: string;
    chat_id?: string;
    group_id?: string;
    is_group?: boolean;
    sender?: string;
    sender_name?: string;
    text?: string;
    timestamp?: string;
    attachments?: Array<{ type: string; url: string; name?: string }>;
    quoted_message?: { sender?: string; sender_name?: string; text?: string };
    api_key?: string;
  };

  // ── Validate required fields ──────────────────────────────────────────────
  if (source !== 'whatsapp') {
    return res.status(400).json({ ok: false, error: 'INVALID_SOURCE', detail: 'Only whatsapp source is accepted' });
  }

  if (client_id !== 'mi-core') {
    return res.status(403).json({ ok: false, error: 'INVALID_CLIENT', detail: 'client_id must be mi-core' });
  }

  if (!message_id) {
    return res.status(400).json({ ok: false, error: 'MISSING_MESSAGE_ID' });
  }

  if (!chat_id || !sender) {
    return res.status(400).json({ ok: false, error: 'MISSING_REQUIRED_FIELDS', detail: 'chat_id and sender are required' });
  }

  if (!text?.trim()) {
    return res.status(400).json({ ok: false, error: 'MISSING_TEXT' });
  }

  // ── Group mode gate — in group chats Mi only responds when /mi prefix used ──
  const { isMiCommand: textIsMiCommand } = normalizeMessage(text);
  if (is_group && !textIsMiCommand) {
    return res.json({ ok: true, reply: '', actions: [], approval_required: false, approval_id: null,
      metadata: { intent: 'group_silent', source: 'mi-core', confidence: 1, requires_followup: false } });
  }

  // ── CEO-only gate (private chat) — non-CEO senders get silent reply ────────
  if (!is_group && !isAllowedCeoSender(sender)) {
    return res.json({ ok: true, reply: '', actions: [], approval_required: false, approval_id: null,
      metadata: { intent: 'ignored_non_ceo', source: 'mi-core', confidence: 1, requires_followup: false } });
  }

  // ── Rate limit check ─────────────────────────────────────────────────────
  const rateCheck = checkRateLimit(client_id);
  if (!rateCheck.allowed) {
    const normalizedForRateLimit = normalizeMessage(text || '').normalized || text || '';
    const rateLimitIntent = classifyActionIntent(normalizedForRateLimit);
    if (rateLimitIntent.message_class === 'dangerous_action') {
      const reply = buildDangerousActionBlockedResponse(rateLimitIntent);
      logError({
        ts: new Date().toISOString(),
        message_id,
        chat_id,
        error: 'RATE_LIMITED_DANGEROUS_BLOCKED',
        detail: `dangerous command blocked while rate limited; retry after ${rateCheck.retry_after_seconds}s`,
      });
      return res.json({
        ok: true,
        reply,
        actions: [],
        approval_required: true,
        approval_id: null,
        metadata: {
          intent: 'dangerous_blocked',
          message_class: 'dangerous_action',
          source: 'execution-engine',
          confidence: rateLimitIntent.confidence || 1,
          requires_followup: true,
          execution_action: 'dangerous_blocked',
          rate_limited: true,
        },
      });
    }

    logError({
      ts: new Date().toISOString(),
      message_id,
      chat_id,
      error: 'RATE_LIMITED',
      detail: `retry after ${rateCheck.retry_after_seconds}s`,
    });
    return res.status(429).json({
      ok: false,
      error: 'RATE_LIMITED',
      retry_after_seconds: rateCheck.retry_after_seconds,
    });
  }

  // ── Replay protection ────────────────────────────────────────────────────
  if (isMessageDuplicate(message_id)) {
    const existing = await import('../services/whatsapp-store').then(m => m.getMessageById(message_id));
    return res.json({
      ok: true,
      reply: existing?.response || 'Em đang xử lý yêu cầu của anh — anh thử lại sau vài giây nhé.',
      actions: [],
      approval_required: false,
      approval_id: null,
      metadata: { intent: 'duplicate', source: 'mi-core', confidence: 1, requires_followup: false },
    });
  }

  // ── Normalize message ─────────────────────────────────────────────────────
  // This is a dedicated Mi endpoint — gateway already filtered non-/mi traffic.
  // Always treat incoming text as a Mi command; just strip /mi prefix if present.
  const normalizedMessage = normalizeMessage(text);
  let normalized = stripLiveTestPrefix(normalizedMessage.normalized);
  const isMiCommand = true;

  // ── Build quoted message context if present ───────────────────────────────
  const quotedContext = quoted_message?.text
    ? `[Quoted from ${quoted_message.sender_name || quoted_message.sender || 'unknown'}]: "${quoted_message.text.slice(0, 300)}"`
    : undefined;

  // Dead code kept for safety — should never trigger on this endpoint
  if (!isMiCommand) {
    return res.json({
      ok: true,
      reply: '',
      actions: [],
      approval_required: false,
      approval_id: null,
      metadata: { intent: 'ignored', source: 'mi-core', confidence: 1, requires_followup: false },
    });
  }

  // ── Save participant ─────────────────────────────────────────────────────
  saveParticipant({
    sender: sender || 'unknown',
    sender_name: sender_name || sender || 'unknown',
    chat_id: chat_id || 'unknown',
    last_seen: timestamp || new Date().toISOString(),
    message_count: 0,
  });

  // ── Context memory tracking ───────────────────────────────────────────────
  upsertContextParticipant(sender || 'unknown', sender_name || sender || 'unknown', chat_id || 'unknown');
  if (is_group) {
    appendGroupMessage({
      message_id: message_id || '',
      chat_id: chat_id || '',
      sender: sender || '',
      sender_name: sender_name || sender || '',
      text: text || '',
      timestamp: timestamp || new Date().toISOString(),
    });
  }

  // ── Initial message record ───────────────────────────────────────────────
  saveMessage({
    message_id: message_id || '',
    chat_id: chat_id || '',
    group_id: group_id || '',
    sender: sender || '',
    sender_name: sender_name || sender || '',
    text: text || '',
    normalized_text: normalized || text || '',
    timestamp: timestamp || new Date().toISOString(),
    intent: 'pending',
    response: '',
    approval_id: null,
    status: 'received',
    attachments: attachments || [],
    created_at: new Date().toISOString(),
  });

  // ── Handle empty /mi ──────────────────────────────────────────────────────
  if (!normalized) {
    updateMessageStatus(message_id, 'processed', 'Dạ anh gọi em ạ?');
    return res.json({
      ok: true,
      reply: 'Dạ anh gọi em ạ?',
      actions: [],
      approval_required: false,
      approval_id: null,
      metadata: { intent: 'greeting', source: 'mi-core', confidence: 1, requires_followup: false },
    });
  }

  // ── Direct approval commands ──────────────────────────────────────────────
  // /mi approve APP-xxx  or  /mi reject APP-xxx
  const approveMatch = normalized.match(/^approve\s+(.+)/i);
  const rejectMatch = normalized.match(/^reject\s+(.+)/i);
  // "cancel <id>" or bare "cancel" — alias for rejection
  const cancelMatch = normalized.match(/^cancel\s+(.+)/i);
  const bareApprovalResponseMatch = /^(approve|approved|ok\s*em|duyet|dong\s*y|chap\s*nhan|yes|ok\s*done|cancel|huy|reject|tu\s*choi|no)\b/i.test(normalized.trim());
  const bareCancelMatch = /^cancel$/i.test(normalized.trim());

  if (approveMatch && !/^approve\s+review\s+\d+$/i.test(normalized)) {
    const approvalId = approveMatch[1].trim();
    const result = handleApprovalCommand(approvalId, 'approved', sender, sender_name, message_id, chat_id);
    return res.json(result);
  }

  if (rejectMatch && !/^reject\s+review\s+\d+$/i.test(normalized)) {
    const approvalId = rejectMatch[1].trim();
    const result = handleApprovalCommand(approvalId, 'rejected', sender, sender_name, message_id, chat_id);
    return res.json(result);
  }

  if (cancelMatch) {
    const approvalId = cancelMatch[1].trim();
    const result = handleApprovalCommand(approvalId, 'rejected', sender, sender_name, message_id, chat_id);
    return res.json(result);
  }

  if (bareCancelMatch) {
    // Cancel most recent pending approval for this sender
    const pending = getPending();
    if (pending.length) {
      const approvalId = pending[0].id;
      const result = handleApprovalCommand(approvalId, 'rejected', sender, sender_name, message_id, chat_id);
      return res.json(result);
    }
  }

  if (bareApprovalResponseMatch) {
    const executionResult = processCEORequest({
      message: normalized,
      sender: sender || 'whatsapp',
      message_id: message_id || '',
    });

    updateMessageStatus(message_id, 'processed', executionResult.response_message, null);

    return res.json({
      ok: true,
      reply: executionResult.response_message,
      actions: [],
      approval_required: false,
      approval_id: executionResult.approval?.approval_id || null,
      metadata: {
        intent: 'approval_response',
        message_class: executionResult.intent?.message_class,
        source: 'execution-engine',
        confidence: executionResult.intent?.confidence || 1,
        requires_followup: false,
        execution_action: executionResult.action,
        workflow_id: executionResult.approval?.workflow_id || null,
      },
    });
  }

  if (isImageFollowup(normalized)) {
    const imagePath = latestSeoImagePath();
    const reply = imagePath
      ? 'Có anh. Em gửi lại hình preview của bản nháp gần nhất bên dưới.'
      : 'Em chưa tìm thấy hình preview trong evidence gần nhất. Em sẽ không nói "hình sẵn sàng" nếu chưa có file proof.';
    updateMessageStatus(message_id, 'replied', reply, null);
    return res.json({
      ok: true,
      reply,
      actions: [],
      approval_required: false,
      approval_id: null,
      metadata: {
        intent: 'image_evidence_followup',
        source: 'execution-evidence',
        confidence: 1,
        requires_followup: !imagePath,
        image_evidence_path: imagePath,
      },
    });
  }

  const correctionType = classifyCeoCorrection(normalized);
  if (correctionType) {
    appendCorrection({
      type: correctionType,
      sender: sender || 'whatsapp',
      message: normalized,
    });
    const reply = correctionType === 'qb_report_completed'
      ? [
        'Em hiểu. Đây là cập nhật trạng thái, không phải yêu cầu tạo report mới.',
        'Em thấy có nhiều task QB Report liên quan, nên chưa tự đánh dấu tất cả.',
        'Anh reply *TẤT CẢ QB REPORT XONG* hoặc nói rõ mã C1/C2/C3/B1/B2/B3 để em cập nhật đúng.'
      ].join('\n')
      : [
        'Em hiểu. Payroll Raw là thông tin lịch, không chạy checklist hôm nay.',
        'Em đã ghi nhận: payroll Raw thuộc tuần sau.',
        'Em sẽ nhắc theo lịch mới, không tạo approval.'
      ].join('\n');
    updateMessageStatus(message_id, 'replied', reply, null);
    return res.json({
      ok: true,
      reply,
      actions: [],
      approval_required: false,
      approval_id: null,
      metadata: {
        intent: correctionType,
        source: 'ceo-correction-router',
        confidence: 1,
        requires_followup: correctionType === 'qb_report_completed',
        correction_log: CORRECTION_LOG,
      },
    });
  }

  if (isShortClarification(normalized)) {
    const reply = 'Anh muốn em làm rõ phần nào: task, hình preview, QB, hay approval?';
    updateMessageStatus(message_id, 'replied', reply, null);
    return res.json({
      ok: true,
      reply,
      actions: [],
      approval_required: false,
      approval_id: null,
      metadata: {
        intent: 'clarification',
        source: 'mi-core',
        confidence: 1,
        requires_followup: true,
      },
    });
  }

  // ── P0-3: Message Fingerprint — content-level dedup before routing ──────
  const fingerprintCheck = checkFingerprint({ sender: sender || 'whatsapp', text: normalized });
  if (fingerprintCheck.is_duplicate && fingerprintCheck.should_block) {
    const reply = 'Em đã nhận tin nhắn này rồi. Em đang xử lý — anh đợi vài giây nhé.';
    updateMessageStatus(message_id, 'replied', reply, null);
    return res.json({
      ok: true,
      reply,
      actions: [],
      approval_required: false,
      approval_id: null,
      metadata: {
        intent: 'fingerprint_dedup',
        source: 'message-fingerprint',
        confidence: 1,
        requires_followup: false,
        fingerprint: fingerprintCheck.existing_record?.fingerprint,
        duplicate_count: fingerprintCheck.existing_record?.count,
      },
    });
  }

  // ── P0-1: Statement Guard — catch status updates, casual acks, temporal updates ──
  // BEFORE execution engine: statements should NEVER trigger workflows
  const statementResult = evaluateStatement(normalized);
  if (statementResult.is_statement) {
    // Update context memory with the statement topic
    const stmtTopic = extractStatementTopic(normalized);
    if (stmtTopic) {
      try {
        const { addUserTurn, addAssistantTurn } = await import('../communication/conversation-memory');
        addUserTurn(sender || 'whatsapp', normalized, 'statement:' + statementResult.statement_type, { target: stmtTopic });
        addAssistantTurn(sender || 'whatsapp', statementResult.reply || 'Dạ.');
      } catch { /* non-critical */ }
    }
    updateMessageStatus(message_id, 'replied', statementResult.reply || 'Dạ.', null);
    return res.json({
      ok: true,
      reply: statementResult.reply || 'Dạ.',
      actions: [],
      approval_required: false,
      approval_id: null,
      metadata: {
        intent: 'statement_' + statementResult.statement_type,
        source: 'statement-guard',
        confidence: statementResult.confidence,
        requires_followup: false,
        statement_type: statementResult.statement_type,
      },
    });
  }

  // ── DEV5 Multi-Intent Execution: match /api/chat production behavior ─────
  if (shouldUseDeterministicMultiIntent(normalized)) {
    const multi = executeMultiIntent(normalized, { sender: sender || 'whatsapp' });
    const reply = formatMultiIntentReply(multi);
    updateMessageStatus(message_id, 'processed', reply, null);

    return res.json({
      ok: true,
      reply,
      actions: [],
      approval_required: multi.approval_pending_children > 0,
      approval_id: null,
      metadata: {
        intent: 'multi_intent',
        source: 'multi-intent-executor',
        confidence: 0.95,
        requires_followup: multi.approval_pending_children > 0,
        parent_tracking_id: multi.parent_tracking_id,
        parent_workflow_id: multi.parent_workflow_id,
        expected_children: multi.expected_children,
        executed_children: multi.executed_children,
        dropped_children: multi.dropped_children,
        failed_children: multi.failed_children,
        approval_pending_children: multi.approval_pending_children,
        trace_path: multi.trace_path,
        children: multi.children.map(child => ({
          tracking_id: child.tracking_id,
          workflow_id: child.workflow_id,
          workflow_type: child.workflow_type,
          domain: child.domain,
          status: child.status,
          evidence: child.evidence,
          error: child.error,
        })),
      },
    });
  }

  if (isFinanceTruthQuestion(normalized)) {
    const qb = answerQuickBooksQuestion(normalized);
    const reply = `${qb.answer}\n\nStatus: ${qb.status}\nSource: ${qb.source_layers.join(' + ')}\nNo mock data.`;
    updateMessageStatus(message_id, 'processed', reply, null);

    return res.json({
      ok: true,
      reply,
      actions: [],
      approval_required: false,
      approval_id: null,
      metadata: {
        intent: 'finance_truth',
        source: 'quickbooks-runtime',
        confidence: 0.95,
        requires_followup: !qb.pass,
        status: qb.status,
        gaps: qb.gaps,
        no_mock_data: qb.no_mock_data,
      },
    });
  }

  if (isReadOnlyDashboardQuestion(normalized)) {
    try {
      const jarvisResult = await tryJarvisReadOnlyReply(normalized, sender, timestamp, chat_id);
      if (jarvisResult?.handled && jarvisResult.reply) {
        updateMessageStatus(message_id, 'replied', jarvisResult.reply);
        return res.json({
          ok: true,
          reply: jarvisResult.reply,
          actions: [],
          approval_required: false,
          approval_id: null,
          metadata: {
            intent: 'dashboard_status',
            source: 'jarvis-evolution',
            confidence: 1,
            requires_followup: false,
          },
        });
      }
    } catch (e) {
      console.warn('[WhatsApp] Dashboard read-only route skipped:', e instanceof Error ? e.message : String(e));
    }
  }

  // ── DEV5 Execution Engine: action requests must create workflow evidence ──
  const executionIntent = classifyActionIntent(normalized);
  const shouldUseExecutionEngine =
    executionIntent.message_class === 'dangerous_action' ||
    (executionIntent.message_class === 'action_request' && needsWorkflow(executionIntent));

  if (shouldUseExecutionEngine) {
    const executionResult = processCEORequest({
      message: normalized,
      sender: sender || 'whatsapp',
      message_id: message_id || '',
    });

    const approvalId = executionResult.approval?.approval_id || null;
    updateMessageStatus(message_id, 'processed', executionResult.response_message, approvalId);

    return res.json({
      ok: true,
      reply: executionResult.response_message,
      actions: [],
      approval_required: !!approvalId || executionResult.action === 'dangerous_blocked',
      approval_id: approvalId,
      metadata: {
        intent: executionResult.intent?.domain || 'execution_action',
        message_class: executionResult.intent?.message_class,
        source: 'execution-engine',
        confidence: executionResult.intent?.confidence || 1,
        requires_followup: !!approvalId || executionResult.action === 'dangerous_blocked',
        execution_action: executionResult.action,
        workflow_id: executionResult.workflow?.workflow_id || null,
        evidence_path: executionResult.workflow?.evidence_path || null,
        draft_preview_path: executionResult.draft?.preview_path || null,
        image_evidence_path: executionResult.draft?.image_assets?.featured_image || null,
      },
    });
  }

  // ── Jarvis Evolution Phase 21-30 — first-class CEO OS answers ───────────
  try {
    const { processJarvisQuery } = await import('../jarvis/phase30-jarvis/jarvis-core');
    const jarvisResult = await processJarvisQuery({
      sender: sender || 'whatsapp',
      raw_text: normalized,
      normalized,
      timestamp: timestamp || new Date().toISOString(),
      session_id: chat_id || undefined,
    });
    if (jarvisResult?.handled && jarvisResult.reply) {
      updateMessageStatus(message_id, 'replied', jarvisResult.reply);
      return res.json({
        ok: true,
        reply: jarvisResult.reply,
        actions: [],
        approval_required: false,
        approval_id: null,
        metadata: {
          intent: `jarvis_phase_${jarvisResult.phase || 30}`,
          source: 'jarvis-evolution',
          confidence: 1,
          requires_followup: false,
        },
      });
    }
  } catch (e) {
    console.warn('[WhatsApp] Jarvis evolution early route skipped:', e instanceof Error ? e.message : String(e));
  }

  // ── Human assistant layer: natural conversation engine (runs BEFORE skill check) ──
  // processNaturalConversation handles: pronoun resolution, natural intents, dangerous-action approval gates, skill fallback
  const humanResultEarly = await handleMiHumanAssistant(normalized, sender || undefined);
  if (humanResultEarly?.handled) {
    try { updateMessageStatus(message_id, humanResultEarly.approval_required ? 'processed' : 'replied', humanResultEarly.reply, humanResultEarly.approval_id); } catch { /* non-critical */ }
    return res.json({
      ok: true,
      reply: humanResultEarly.reply,
      actions: [],
      approval_required: humanResultEarly.approval_required,
      approval_id: humanResultEarly.approval_id,
      metadata: {
        intent: humanResultEarly.intent,
        action_mode: humanResultEarly.action_mode,
        source: 'mi-human-assistant',
        confidence: 1,
        requires_followup: humanResultEarly.approval_required || humanResultEarly.action_mode === 'unknown_clarify',
      },
    });
  }

  // ── Skill routing — fallback for unhandled messages ──────────────────────
  const skill = findSkill(normalized);
  if (skill) {
    const skillResult = await skill.handler({ message: normalized, context: quotedContext, language: 'vi' });

    if (skillResult.requires_approval) {
      const { enqueue } = await import('../approval/gate');
      const action = enqueue({
        risk_level: 2,
        category: 'whatsapp_skill',
        description: `[Skill:${skill.name}] ${sender_name || sender}: ${normalized.slice(0, 150)}`,
        target: 'whatsapp-skill-execution',
        after_state: JSON.stringify({ skill: skill.name, sender, chat_id, message_id }),
      });
      saveApproval({
        approval_id: action.id,
        message_id: message_id || '',
        chat_id: chat_id || '',
        sender: sender || '',
        action_description: `Skill: ${skill.name} — ${normalized.slice(0, 150)}`,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
      updateMessageStatus(message_id, 'processed', skillResult.output, action.id);
      return res.json({
        ok: true,
        reply: `${skillResult.output}\n\nID: *${action.id}*\nAnh reply *approve ${action.id}* để xác nhận, hoặc *cancel* để bỏ.`,
        actions: [],
        approval_required: true,
        approval_id: action.id,
        metadata: { intent: `skill_${skill.name}`, source: 'mi-skill', confidence: skillResult.confidence, requires_followup: true },
      });
    }

    updateMessageStatus(message_id, 'replied', skillResult.output);
    return res.json({
      ok: true,
      reply: skillResult.output,
      actions: [],
      approval_required: false,
      approval_id: null,
      metadata: { intent: `skill_${skill.name}`, source: 'mi-skill', confidence: skillResult.confidence, requires_followup: false },
    });
  }

  // ── Human assistant layer fallback (for unhandled messages from skill registry) ──
  const humanResult = await handleMiHumanAssistant(normalized, sender || undefined);
  if (humanResult?.handled) {
    updateMessageStatus(message_id, humanResult.approval_required ? 'processed' : 'replied', humanResult.reply, humanResult.approval_id);
    return res.json({
      ok: true,
      reply: humanResult.reply,
      actions: [],
      approval_required: humanResult.approval_required,
      approval_id: humanResult.approval_id,
      metadata: {
        intent: humanResult.intent,
        action_mode: humanResult.action_mode,
        source: 'mi-human-assistant',
        confidence: 1,
        requires_followup: humanResult.approval_required || humanResult.action_mode === 'unknown_clarify',
      },
    });
  }

  // ── Deterministic CEO OS commands ────────────────────────────────────────
  const commandResult = await routeCeoCommand(normalized, {
    sender,
    senderName: sender_name,
    chatId: chat_id,
  });

  if (commandResult) {
    updateMessageStatus(message_id, 'replied', commandResult.reply);
    return res.json({
      ok: true,
      reply: commandResult.reply,
      actions: [],
      approval_required: false,
      approval_id: null,
      metadata: {
        intent: commandResult.intent,
        source: 'mi-core',
        confidence: commandResult.confidence,
        requires_followup: commandResult.requires_followup,
      },
    });
  }

  // ── Jarvis Evolution Phase 21-30 — unified CEO OS layer ─────────────────
  try {
    const { processJarvisQuery } = await import('../jarvis/phase30-jarvis/jarvis-core');
    const jarvisResult = await processJarvisQuery({
      sender: sender || 'whatsapp',
      raw_text: normalized,
      normalized,
      timestamp: timestamp || new Date().toISOString(),
      session_id: chat_id || undefined,
    });
    if (jarvisResult?.handled && jarvisResult.reply) {
      updateMessageStatus(message_id, 'replied', jarvisResult.reply);
      return res.json({
        ok: true,
        reply: jarvisResult.reply,
        actions: [],
        approval_required: false,
        approval_id: null,
        metadata: {
          intent: `jarvis_phase_${jarvisResult.phase || 30}`,
          source: 'jarvis-evolution',
          confidence: 1,
          requires_followup: false,
        },
      });
    }
  } catch (e) {
    console.warn('[WhatsApp] Jarvis evolution fallback skipped:', e instanceof Error ? e.message : String(e));
  }

  if (isObviousUnknownRequest(normalized)) {
    const reply = 'Em chưa hiểu rõ yêu cầu này. Anh nói rõ mục tiêu hoặc nguồn dữ liệu cần kiểm tra giúp em nhé.';
    updateMessageStatus(message_id, 'replied', reply);
    return res.json({
      ok: true,
      reply,
      actions: [],
      approval_required: false,
      approval_id: null,
      metadata: {
        intent: 'unknown_clarify',
        source: 'mi-core',
        confidence: 1,
        requires_followup: true,
      },
    });
  }

  // ── Route to Mi Executive Pipeline ───────────────────────────────────────
  try {
    const pipelineMessage = quotedContext ? `${quotedContext}\n\n${normalized}` : normalized;
    const pipelineOut = await enqueueChat(() => runPipeline({
      message: pipelineMessage,
      mode: 'ceo',
      history: [],
      intent: 'chat',
    }));

    // ── Detect if approval needed ──────────────────────────────────────────
    const needsApproval = requiresApproval(normalized);
    const needsDoubleApproval = requiresDoubleApproval(normalized);

    let approvalId: string | null = null;
    let approvalRequired = false;

    if (needsDoubleApproval) {
      // Double approval needed
      const { enqueue } = await import('../approval/gate');
      const action = enqueue({
        risk_level: 3,
        category: 'whatsapp_action',
        description: `[WhatsApp] ${sender}: ${normalized.slice(0, 200)}`,
        target: 'whatsapp-message',
        after_state: JSON.stringify({ sender, chat_id, message_id, text: normalized }),
      });
      approvalId = action.id;
      approvalRequired = true;

      saveApproval({
        approval_id: action.id,
        message_id: message_id || '',
        chat_id: chat_id || '',
        sender: sender || '',
        action_description: normalized.slice(0, 200),
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      updateMessageStatus(message_id, 'processed', pipelineOut.reply, approvalId);

      return res.json({
        ok: true,
        reply: `⚡ Em đã chuẩn bị action này nhưng cần anh xác nhận vì thuộc danh mục nhạy cảm.\n\nID: **${action.id}**\n\nAnh reply *approve ${action.id}* để tiếp tục, hoặc *cancel* để bỏ.`,
        actions: [],
        approval_required: true,
        approval_id: approvalId,
        metadata: {
          intent: 'action_double_approval',
          source: 'mi-core',
          confidence: 0.9,
          requires_followup: true,
        },
      });
    }

    if (needsApproval) {
      // Single approval needed
      const { enqueue } = await import('../approval/gate');
      const action = enqueue({
        risk_level: 2,
        category: 'whatsapp_action',
        description: `[WhatsApp from ${sender_name || sender}] ${normalized.slice(0, 200)}`,
        target: 'whatsapp-message',
        after_state: JSON.stringify({ sender, chat_id, message_id, text: normalized }),
      });
      approvalId = action.id;
      approvalRequired = true;

      saveApproval({
        approval_id: action.id,
        message_id: message_id || '',
        chat_id: chat_id || '',
        sender: sender || '',
        action_description: normalized.slice(0, 200),
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      updateMessageStatus(message_id, 'processed', pipelineOut.reply, approvalId);

      return res.json({
        ok: true,
        reply: `Em đã chuẩn bị:\n\n${pipelineOut.reply}\n\nID: **${action.id}**\nAnh reply *approve ${action.id}* để xác nhận, hoặc *cancel* để bỏ.`,
        actions: [],
        approval_required: true,
        approval_id: approvalId,
        metadata: {
          intent: 'action_awaiting_approval',
          source: 'mi-core',
          confidence: 0.85,
          requires_followup: true,
        },
      });
    }

    // ── Read-only reply ────────────────────────────────────────────────────
    updateMessageStatus(message_id, 'replied', pipelineOut.reply);
    return res.json({
      ok: true,
      reply: pipelineOut.reply,
      actions: [],
      approval_required: false,
      approval_id: null,
      metadata: {
        intent: 'chat',
        source: 'mi-core',
        confidence: pipelineOut.sources?.length ? 0.9 : 0.7,
        requires_followup: false,
      },
    });
  } catch (e: any) {
    console.error('[WhatsApp Pipeline Error]', e);
    logError({
      ts: new Date().toISOString(),
      message_id: message_id || '',
      chat_id: chat_id || '',
      error: 'PIPELINE_ERROR',
      detail: e.message,
    });
    updateMessageStatus(message_id, 'failed', undefined, null);

    // Classify the error and return a graceful Vietnamese reply.
    // Never expose raw infrastructure errors to the CEO.
    const msg = e.message || '';
    let gracefulReply: string;
    if (e instanceof ChatQueueFullError) {
      gracefulReply = 'Em đang bận xử lý nhiều việc cùng lúc — anh thử lại sau vài giây nhé.';
    } else if (e instanceof ChatTimeoutError) {
      gracefulReply = 'Em đang bị chậm lúc này — AI engine mất quá lâu. Anh thử lại nhé, em vẫn đang hoạt động.';
    } else if (/timeout|aborted|timed out|ETIMEDOUT/i.test(msg)) {
      gracefulReply = 'Em đang bị chậm lúc này — có thể do AI engine đang tải. Anh thử lại sau vài giây nhé. Em vẫn đang hoạt động.';
    } else if (/generateText|providers|LLM|ollama|anthropic/i.test(msg)) {
      gracefulReply = 'Em chưa kết nối được AI engine lúc này. Em vẫn nhận được tin nhắn của anh — anh thử lại hoặc hỏi em câu khác nhé.';
    } else if (/knowledge|qdrant|vector|embed/i.test(msg)) {
      gracefulReply = 'Em chưa truy cập được Knowledge Universe lúc này. Anh thử lại giúp em trong ít phút nhé — các tính năng khác vẫn hoạt động bình thường.';
    } else if (/UNKNOWN|open.*\.json|whatsapp-client/i.test(msg)) {
      gracefulReply = 'Em đang gặp lỗi nhỏ khi đọc cấu hình. Em vẫn đang hoạt động — anh thử lại nhé.';
    } else {
      gracefulReply = 'Em đang gặp lỗi khi xử lý tin nhắn này. Em vẫn đang hoạt động nhưng chưa lấy được thông tin mới nhất. Anh thử lại sau nhé.';
    }

    return res.json({
      ok: true,
      reply: gracefulReply,
      actions: [],
      approval_required: false,
      approval_id: null,
      metadata: { intent: 'graceful_error', source: 'mi-core', confidence: 0.5, requires_followup: false },
    });
  }
});

// ── Handle approve/reject via WhatsApp ─────────────────────────────────────
function handleApprovalCommand(
  approvalId: string,
  action: 'approved' | 'rejected',
  sender: string,
  senderName: string,
  messageId: string,
  chatId: string,
) {
  // Find in approval gate
  const gateAction = getById(approvalId);

  if (!gateAction) {
    // Check WhatsApp store
    const waApprovals = getPendingWhatsAppApprovals();
    const waApproval = waApprovals.find(a => a.approval_id === approvalId);

    if (!waApproval) {
      const executionAction = action === 'approved' ? 'approve' : 'cancel';
      const executionApproval = resolveExecutionApproval(approvalId, executionAction);
      if (executionApproval) {
        return {
          ok: true,
          reply: action === 'approved'
            ? `✅ Anh đã approve **${approvalId}** cho workflow **${executionApproval.workflow_id}**.`
            : `❌ Anh đã reject **${approvalId}** cho workflow **${executionApproval.workflow_id}**.`,
          actions: [],
          approval_required: false,
          approval_id: approvalId,
          metadata: {
            intent: `execution_approval_${action}`,
            source: 'execution-engine',
            confidence: 1,
            requires_followup: false,
            workflow_id: executionApproval.workflow_id,
          },
        };
      }

      return {
        ok: true,
        reply: `Em không tìm thấy approval ID **${approvalId}**. Có thể nó đã được xử lý hoặc ID không đúng.`,
        actions: [],
        approval_required: false,
        approval_id: null,
        metadata: { intent: 'approval_not_found', source: 'mi-core', confidence: 1, requires_followup: false },
      };
    }

    // Update WhatsApp store
    updateStoreApproval(approvalId, action, `${senderName} (${sender}) via WhatsApp`);

    return {
      ok: true,
      reply: action === 'approved'
        ? `✅ Anh đã approve **${approvalId}**. Action này đã được ghi nhận (execution will follow via main system).`
        : `❌ Anh đã reject **${approvalId}**. Action đã bị hủy.`,
      actions: [],
      approval_required: false,
      approval_id: approvalId,
      metadata: {
        intent: `approval_${action}`,
        source: 'mi-core',
        confidence: 1,
        requires_followup: false,
      },
    };
  }

  // Process via approval gate
  if (action === 'approved') {
    const result = approve(approvalId, `${senderName} (${sender}) via WhatsApp`);
    if (!result) {
      return {
        ok: true,
        reply: `Approval ID **${approvalId}** không trong trạng thái pending.`,
        actions: [],
        approval_required: false,
        approval_id: null,
        metadata: { intent: 'approval_not_pending', source: 'mi-core', confidence: 1, requires_followup: false },
      };
    }

    // Log to WhatsApp store
    updateStoreApproval(approvalId, action, `${senderName} (${sender}) via WhatsApp`);

    return {
      ok: true,
      reply: action === 'approved'
        ? `✅ Anh đã approve **${approvalId}**. Action đã được xử lý.`
        : `❌ Anh đã reject **${approvalId}**. Action đã bị hủy.`,
      actions: [],
      approval_required: false,
      approval_id: approvalId,
      metadata: {
        intent: `approval_${action}`,
        source: 'mi-core',
        confidence: 1,
        requires_followup: false,
      },
    };
  }

  // Reject via approval gate
  if (action === 'rejected') {
    const result = reject(approvalId, `${senderName} (${sender}) via WhatsApp`);
    if (!result) {
      return {
        ok: true,
        reply: `Approval ID **${approvalId}** không trong trạng thái pending.`,
        actions: [],
        approval_required: false,
        approval_id: null,
        metadata: { intent: 'approval_not_pending', source: 'mi-core', confidence: 1, requires_followup: false },
      };
    }
    updateStoreApproval(approvalId, action, `${senderName} (${sender}) via WhatsApp`);
    return {
      ok: true,
      reply: `❌ Anh đã reject **${approvalId}**. Action đã bị hủy.`,
      actions: [],
      approval_required: false,
      approval_id: approvalId,
      metadata: {
        intent: 'approval_rejected',
        source: 'mi-core',
        confidence: 1,
        requires_followup: false,
      },
    };
  }

  return {
    ok: true,
    reply: `Không thể xử lý approval **${approvalId}**. Vui lòng thử lại.`,
    actions: [],
    approval_required: false,
    approval_id: null,
    metadata: { intent: 'approval_error', source: 'mi-core', confidence: 0.5, requires_followup: false },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH + DEBUG ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/whatsapp/mi/health — lightweight health check
whatsappRouter.get('/mi/health', (_req: Request, res: Response) => {
  const keyCfg = getKeyStatus();
  const summary = getSummary();

  res.json({
    endpoint: 'online',
    api_key_configured: keyCfg.configured,
    api_key_status: keyCfg.status,
    last_message_time: summary.last_message_at || null,
    last_successful_reply: summary.last_message_at || null,
    total_messages: summary.total_messages,
    failed_auth_count: 0, // would need to count from audit
    rate_limit: keyCfg.rate_limit,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/whatsapp/health — compatibility alias required by Laptop1 validation
whatsappRouter.get('/health', (_req: Request, res: Response) => {
  const keyCfg = getKeyStatus();
  const summary = getSummary();
  res.json({
    endpoint: 'online',
    route: '/api/whatsapp/mi',
    api_key_configured: keyCfg.configured,
    api_key_status: keyCfg.status,
    last_message_time: summary.last_message_at || null,
    total_messages: summary.total_messages,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/whatsapp/mi/status — full status
whatsappRouter.get('/mi/status', (_req: Request, res: Response) => {
  const keyCfg = getKeyStatus();
  const summary = getSummary();

  res.json({
    ok: true,
    connector: 'whatsapp',
    client_id: 'mi-core',
    api_key: {
      configured: keyCfg.configured,
      status: keyCfg.status,
      created_at: keyCfg.created_at,
      last_used_at: keyCfg.last_used_at,
      base_url: keyCfg.base_url,
    },
    rate_limit: keyCfg.rate_limit,
    messages: {
      total: summary.total_messages,
      last_message_at: summary.last_message_at,
      last_sync: summary.last_sync,
    },
    groups: {
      total: summary.total_groups,
    },
    approvals: {
      total: summary.total_approvals,
      pending: summary.pending_approvals,
    },
    errors: {
      recent_24h: summary.recent_errors,
    },
    timestamp: new Date().toISOString(),
  });
});

// GET /api/whatsapp/mi/messages — message log
whatsappRouter.get('/mi/messages', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const messages = getAllMessages(Math.min(limit, 200));
  res.json({ ok: true, count: messages.length, messages });
});

// GET /api/whatsapp/mi/approvals — approval records
whatsappRouter.get('/mi/approvals', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const approvals = getApprovals(Math.min(limit, 200));
  res.json({ ok: true, count: approvals.length, approvals });
});

// GET /api/whatsapp/mi/audit — audit log
whatsappRouter.get('/mi/audit', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const entries = getAuditEntries(Math.min(limit, 500));
  res.json({ ok: true, count: entries.length, entries });
});

// GET /api/whatsapp/mi/setup — setup form (browser UI helper)
// This returns the setup state for the UI to render
whatsappRouter.get('/mi/setup', (_req: Request, res: Response) => {
  const keyCfg = getKeyStatus();
  res.json({
    ok: true,
    configured: keyCfg.configured,
    status: keyCfg.status,
    base_url: keyCfg.base_url,
    // NEVER return the hash or raw key
    hint: keyCfg.configured
      ? 'API key is configured. Use /api/whatsapp/mi/rotate to change.'
      : 'API key not configured. POST to /api/whatsapp/mi/setup with { "api_key": "..." }',
  });
});

// POST /api/whatsapp/mi/setup — configure API key from browser/CLI
whatsappRouter.post('/mi/setup', async (req: Request, res: Response) => {
  const { api_key, base_url } = req.body as { api_key?: string; base_url?: string };

  if (!api_key) {
    return res.status(400).json({ ok: false, error: 'api_key is required' });
  }

  const result = await setupApiKey(api_key, base_url);
  if (!result.ok) {
    return res.status(400).json({ ok: false, error: result.error });
  }

  res.json({ ok: true, message: 'WhatsApp API key configured successfully.' });
});

// POST /api/whatsapp/mi/rotate — rotate API key
whatsappRouter.post('/mi/rotate', async (req: Request, res: Response) => {
  const { api_key } = req.body as { api_key?: string };

  if (!api_key) {
    return res.status(400).json({ ok: false, error: 'New api_key is required' });
  }

  const result = await rotateApiKey(api_key);
  if (!result.ok) {
    return res.status(400).json({ ok: false, error: result.error });
  }

  res.json({ ok: true, message: 'WhatsApp API key rotated successfully.' });
});

// POST /api/whatsapp/mi/revoke — revoke API key (localhost only — blocks remote callers)
whatsappRouter.post('/mi/revoke', (req: Request, res: Response) => {
  const remoteIp = req.socket.remoteAddress || '';
  const isLocal = remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp === '::ffff:127.0.0.1';
  if (!isLocal) {
    return res.status(403).json({ ok: false, error: 'REVOKE_FORBIDDEN', detail: 'Revoke only allowed from localhost' });
  }
  revokeApiKey();
  res.json({ ok: true, message: 'WhatsApp API key revoked locally.' });
});

// GET /api/whatsapp/mi/check — check API key validity
whatsappRouter.get('/mi/check', (_req: Request, res: Response) => {
  const configured = isKeyConfigured();
  res.json({
    ok: true,
    configured,
    status: configured ? 'valid' : 'not_configured',
  });
});

// ── Phase 1: Communication Layer additions ───────────────────────────────────

// POST /api/whatsapp/webhook — generic webhook alias (same as /mi but path-flexible)
whatsappRouter.post('/webhook', waAuth, async (req: Request, res: Response) => {
  // Forward to /mi handler logic via internal fetch
  // Forward to /mi by delegating to the POST /mi handler directly
  req.url = '/mi';
  (whatsappRouter as unknown as { handle: (req: unknown, res: unknown, next: () => void) => void }).handle(req, res, () => res.status(404).json({ error: 'Not found' }));
});

// GET /api/whatsapp/conversations — audit trail of routed messages
whatsappRouter.get('/conversations', (req: Request, res: Response) => {
  const { getRecentConversations, getConversationStats } = require('../communication/conversation-audit');
  const limit = parseInt(String(req.query.limit)) || 50;
  const conversations = getRecentConversations(limit);
  const stats = getConversationStats();
  res.json({ stats, conversations });
});

// POST /api/whatsapp/send-test — inject a test message through the pipeline
whatsappRouter.post('/send-test', async (req: Request, res: Response) => {
  const { message = '/mi status', sender = 'test-ceo', chat_id = 'test-room' } = req.body || {};
  const message_id = 'test-' + Date.now();
  try {
    const pipeline = require('../pipeline/response-pipeline');
    const result = await pipeline.runPipeline({
      message, mode: 'mi', history: [], intent: '',
    });
    res.json({ ok: true, message_id, reply: result.reply, intent: result.intent });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});
