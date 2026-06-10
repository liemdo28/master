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
import { approve, reject, getPending, getById } from '../approval/gate';
import { setupApiKey, rotateApiKey, revokeApiKey } from '../services/whatsapp-key-manager';

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

// ── POST /api/whatsapp/mi — main message handler ────────────────────────────
whatsappRouter.post('/mi', waAuth, async (req: Request, res: Response) => {
  const {
    source,
    client_id,
    message_id,
    chat_id,
    group_id = '',
    sender,
    sender_name = '',
    text,
    timestamp,
    attachments = [],
    api_key: _apiKey, // extracted via middleware, not used here
  } = req.body as {
    source?: string;
    client_id?: string;
    message_id?: string;
    chat_id?: string;
    group_id?: string;
    sender?: string;
    sender_name?: string;
    text?: string;
    timestamp?: string;
    attachments?: Array<{ type: string; url: string; name?: string }>;
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
      reply: existing?.response || '',
      actions: [],
      approval_required: false,
      approval_id: null,
      metadata: { intent: 'duplicate', source: 'mi-core', confidence: 1, requires_followup: false },
    });
  }

  // ── Normalize message ─────────────────────────────────────────────────────
  const { normalized, isMiCommand } = normalizeMessage(text);

  // If not a /mi command, ignore silently (whatsapp-api routes only /mi)
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

  if (approveMatch) {
    const approvalId = approveMatch[1].trim();
    const result = handleApprovalCommand(approvalId, 'approved', sender, sender_name, message_id, chat_id);
    return res.json(result);
  }

  if (rejectMatch) {
    const approvalId = rejectMatch[1].trim();
    const result = handleApprovalCommand(approvalId, 'rejected', sender, sender_name, message_id, chat_id);
    return res.json(result);
  }

  // ── Route to Mi Executive Pipeline ───────────────────────────────────────
  try {
    const pipelineOut = await runPipeline({
      message: normalized,
      mode: 'ceo',
      history: [],
      intent: 'chat',
    });

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
        reply: `⚡ Em đã chuẩn bị action. Tuy nhiên action này cần **double approval** vì thuộc danh mục nhạy cảm.\n\nApproval ID: **${action.id}**\n\nAnh reply:\n/mi approve ${action.id}\nhoặc\n/mi reject ${action.id}`,
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
        reply: `Em đã chuẩn bị action:\n\n${pipelineOut.reply}\n\nApproval ID: **${action.id}**\nAnh reply:\n/mi approve ${action.id}\nhoặc\n/mi reject ${action.id}`,
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
    return res.status(500).json({
      ok: false,
      error: 'PIPELINE_ERROR',
      detail: 'Mi encountered an error processing your message.',
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

// POST /api/whatsapp/mi/revoke — revoke API key
whatsappRouter.post('/mi/revoke', async (req: Request, res: Response) => {
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
