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

// ── Sensitive action categories requiring double approval ────────────────────
const DOUBLE_APPROVAL_KEYWORDS = [
  'payroll', 'health', 'private', 'financial', 'export',
  'production', 'deploy', 'delete.*project', 'database.*migration',
  'role.*change', 'permission.*change',
];

// ── Router ──────────────────────────────────────────────────────────────────
export const whatsappRouter = Router();

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
  const { normalized } = normalizeMessage(text);
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
    if (!pending.length) return res.json({ reply: 'Không có approval nào đang chờ.', intent: 'no_pending' });
    const approvalId = pending[0].id;
    const result = handleApprovalCommand(approvalId, 'rejected', sender, sender_name, message_id, chat_id);
    return res.json(result);
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
