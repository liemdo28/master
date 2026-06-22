/**
 * WhatsApp Ownership Router — Phase 21.6 CEO Directive P0
 *
 * Strict ownership routing: ONE MESSAGE → ONE OWNER → ONE RESPONSE
 *
 * Architecture:
 *   Incoming WhatsApp message
 *   → Dedup Check          (message-dedup-store.ts)
 *   → Group Policy Resolver
 *   → Intent Detection
 *   → Ownership Resolver    (mi_core | food_safety | marketing_preview | team_support | unknown)
 *   → Handler Execution    (handler returns { owner, confidence, response, shouldSend })
 *   → Response Builder
 *   → Router Send          (ONLY router sends — no handler direct sends)
 *
 * No handler may call replyService.send() directly.
 * Only router may send WhatsApp messages.
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Types ─────────────────────────────────────────────────────────────────────

export type OwnerType = 'mi_core' | 'food_safety' | 'marketing_preview' | 'team_support' | 'unknown_no_reply';

export interface HandlerResponse {
  owner: OwnerType;
  confidence: number;
  response: string | null;
  evidence: string;
  shouldSend: boolean;
  mediaPath?: string;
  mediaCaption?: string;
}

export interface RoutingDecision {
  message_id: string;
  chat_id: string;
  group_name: string;
  sender: string;
  senderName: string;
  timestamp: string;
  normalized_text: string;
  isGroup: boolean;
  policy: string;
  intent: string;
  owner: OwnerType;
  decision_reason: string;
  confidence: number;
  response_allowed: boolean;
  dedup_key: string;
  handler_response?: HandlerResponse;
  response_sent: boolean;
}

export interface IncomingMessage {
  messageId: string;
  chatId: string;
  groupName: string;
  sender: string;
  senderName: string;
  text: string;
  timestamp: string;
  hasImage: boolean;
  imageMedia?: { data: string; mimetype: string; };
  caption?: string;
  isGroup: boolean;
}

// ── Logger ────────────────────────────────────────────────────────────────────

const ROUTING_TRACE_PATH = path.resolve(__dirname, '../../data/routing-trace.jsonl');

function makeLogger(prefix: string) {
  return {
    info: (msg: string, data?: Record<string, unknown>) =>
      console.info(`[${prefix}] ${msg}`, data || ''),
    warn: (msg: string, data?: Record<string, unknown>) =>
      console.warn(`[${prefix}] ${msg}`, data || ''),
    error: (msg: string, data?: Record<string, unknown>) =>
      console.error(`[${prefix}] ${msg}`, data || ''),
  };
}

const log = makeLogger('router');

// ── Dedup Store ───────────────────────────────────────────────────────────────

interface DedupEntry {
  message_id: string;
  chat_id: string;
  owner: OwnerType;
  status: 'processing' | 'completed' | 'failed';
  created_at: number;
  updated_at: number;
}

const TTL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const _dedupStore = new Map<string, DedupEntry>();
let _cleanupTimer: NodeJS.Timeout | null = null;

function _startCleanup() {
  if (_cleanupTimer) return;
  _cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - TTL_MS;
    let pruned = 0;
    for (const [key, entry] of _dedupStore.entries()) {
      if (entry.created_at < cutoff) {
        _dedupStore.delete(key);
        pruned++;
      }
    }
    if (pruned > 0) log.info(`Dedup store pruned ${pruned} entries (${_dedupStore.size} remaining)`);
  }, CLEANUP_INTERVAL_MS);
}
_startCleanup();

function dedupIsDuplicate(messageId: string): boolean {
  if (!messageId) return false;
  const entry = _dedupStore.get(messageId);
  if (!entry) return false;
  if (Date.now() - entry.created_at > TTL_MS) {
    _dedupStore.delete(messageId);
    return false;
  }
  return true;
}

function dedupClaim(messageId: string, chatId: string, owner: OwnerType): { claimed: boolean; existing?: DedupEntry } {
  if (!messageId) return { claimed: true };
  const existing = _dedupStore.get(messageId);
  if (existing && Date.now() - existing.created_at <= TTL_MS) {
    log.warn('Dedup claim rejected', { messageId, owner: existing.owner, status: existing.status });
    return { claimed: false, existing };
  }
  const now = Date.now();
  _dedupStore.set(messageId, { message_id: messageId, chat_id: chatId, owner, status: 'processing', created_at: now, updated_at: now });
  return { claimed: true };
}

function dedupUpdateStatus(messageId: string, status: DedupEntry['status']) {
  const entry = _dedupStore.get(messageId);
  if (!entry) return;
  entry.status = status;
  entry.updated_at = Date.now();
}

// ── Session Store (chatId + owner scoped) ────────────────────────────────────

const _sessionStore = new Map<string, unknown>();
function sessionKey(chatId: string, owner: OwnerType): string {
  return `${chatId}::${owner}`;
}
function setSession(chatId: string, owner: OwnerType, data: unknown) {
  _sessionStore.set(sessionKey(chatId, owner), data);
}
function getSession<T>(chatId: string, owner: OwnerType): T | undefined {
  return _sessionStore.get(sessionKey(chatId, owner)) as T | undefined;
}
function clearSession(chatId: string, owner: OwnerType) {
  _sessionStore.delete(sessionKey(chatId, owner));
}

// ── Intent Patterns ───────────────────────────────────────────────────────────

const MI_CORE_PATTERNS = [
  /^mi\s+ơi/i,
  /^mi\s+$/i,
  /@mi\b/i,
];

const FOOD_SAFETY_PATTERNS = [
  /food\s+safety/i,
  /an\stoàn\s+thực\s+phẩm/i,
  /food-safety/i,
  /kiểm\s+tra\s+food\s+safety/i,
];

const MARKETING_PATTERNS = [
  /duyệt|approve|approved|đồng ý/i,
  /draft.*preview|preview.*draft/i,
  /marketing.*preview|preview.*marketing/i,
  /bản\s+nháp/i,
];

const TEAM_SUPPORT_PATTERNS = [
  /\bhelp\b/i,
  /\bsupport\b/i,
  /hỗ\s+trợ/i,
];

// ── Group Policy Resolver ─────────────────────────────────────────────────────

function resolveGroupPolicy(groupName: string, chatId: string): string {
  const name = (groupName || '').toLowerCase();
  const id = (chatId || '').toLowerCase();
  if (name.includes('food safety') || name.includes('an toàn thực phẩm') || name.includes('food-safety')) return 'food_safety';
  if (name.includes('marketing') || name.includes('content') || name.includes('draft') || name.includes('preview')) return 'marketing';
  if (name.includes('team') || name.includes('staff') || name.includes('nhân viên')) return 'team_support';
  if (name.includes('ceo') || name.includes('admin') || name.includes('liem')) return 'admin';
  return 'general';
}

// ── Ownership Resolver ────────────────────────────────────────────────────────

export function resolveOwner(msg: IncomingMessage, activeSessionOwner?: OwnerType): { owner: OwnerType; reason: string; confidence: number; intent: string } {
  const text = (msg.text || '').trim();
  const lower = text.toLowerCase();
  const groupPolicy = resolveGroupPolicy(msg.groupName, msg.chatId);

  // Rule 1: Active session — owner is already determined
  if (activeSessionOwner && activeSessionOwner !== 'unknown_no_reply') {
    return { owner: activeSessionOwner, reason: 'active_session', confidence: 1.0, intent: 'session_continuation' };
  }

  // Rule 2: Mi ơi / @Mi / CEO patterns → mi_core
  for (const pattern of MI_CORE_PATTERNS) {
    if (pattern.test(text)) {
      return { owner: 'mi_core', reason: `mi_pattern: ${pattern.toString()}`, confidence: 1.0, intent: 'mi_command' };
    }
  }

  // CEO sender → mi_core (no prefix needed)
  const ceoSenders = String(process.env.MI_CEO_WHATSAPP_IDS || '').split(',').map(s => s.trim().replace('@c.us', '').replace('@g.us', ''));
  if (msg.sender && ceoSenders.some(id => msg.sender.includes(id))) {
    return { owner: 'mi_core', reason: 'ceo_sender', confidence: 0.95, intent: 'ceo_message' };
  }

  // Rule 3: Food Safety group policy
  if (groupPolicy === 'food_safety') {
    if (msg.hasImage) {
      return { owner: 'food_safety', reason: 'food_safety_group_image', confidence: 1.0, intent: 'food_safety_submission' };
    }
    return { owner: 'food_safety', reason: 'food_safety_group', confidence: 0.9, intent: 'food_safety_text' };
  }

  // Rule 4: Marketing patterns
  for (const pattern of MARKETING_PATTERNS) {
    if (pattern.test(text)) {
      return { owner: 'marketing_preview', reason: 'marketing_pattern', confidence: 0.85, intent: 'marketing_approval' };
    }
  }

  // Rule 5: Team support patterns
  for (const pattern of TEAM_SUPPORT_PATTERNS) {
    if (pattern.test(text)) {
      return { owner: 'team_support', reason: 'team_support_pattern', confidence: 0.7, intent: 'support_request' };
    }
  }

  // Rule 6: Unknown — no reply
  return { owner: 'unknown_no_reply', reason: 'no_matching_intent', confidence: 1.0, intent: 'silent_drop' };
}

// ── Handler Registry ──────────────────────────────────────────────────────────

type HandlerFn = (msg: IncomingMessage, decision: RoutingDecision) => Promise<HandlerResponse>;

const HANDLERS: Partial<Record<OwnerType, HandlerFn>> = {};

/**
 * Register a handler for a specific owner.
 * Handlers MUST NOT call replyService.send() directly.
 * They MUST return { owner, confidence, response, shouldSend }.
 */
export function registerHandler(owner: OwnerType, handler: HandlerFn) {
  HANDLERS[owner] = handler;
}

// ── Routing Pipeline ──────────────────────────────────────────────────────────

export async function routeMessage(
  msg: IncomingMessage,
  replyFn: (chatId: string, text: string, media?: { path?: string; caption?: string }) => Promise<boolean>
): Promise<RoutingDecision> {
  const dedupKey = `msg:${msg.messageId}`;
  const decision: RoutingDecision = {
    message_id: msg.messageId,
    chat_id: msg.chatId,
    group_name: msg.groupName,
    sender: msg.sender,
    senderName: msg.senderName,
    timestamp: msg.timestamp,
    normalized_text: (msg.text || '').trim().slice(0, 120).toLowerCase(),
    isGroup: msg.isGroup,
    policy: resolveGroupPolicy(msg.groupName, msg.chatId),
    intent: 'unknown',
    owner: 'unknown_no_reply',
    decision_reason: '',
    confidence: 0,
    response_allowed: false,
    dedup_key: dedupKey,
    response_sent: false,
  };

  // ── Step 1: Dedup Check ──────────────────────────────────────────────────────
  if (msg.messageId && dedupIsDuplicate(msg.messageId)) {
    const existing = _dedupStore.get(msg.messageId);
    log.info('[ROUTER] Duplicate blocked', { messageId: msg.messageId, existingOwner: existing?.owner, existingStatus: existing?.status });
    decision.intent = 'duplicate_blocked';
    decision.owner = 'unknown_no_reply';
    decision.decision_reason = 'dedup_already_processed';
    decision.response_allowed = false;
    await _traceDecision(decision);
    return decision;
  }

  // ── Step 2: Resolve active session owner ────────────────────────────────────
  let activeSessionOwner: OwnerType | undefined;
  // Check session stores for active sessions
  for (const owner of ['mi_core', 'food_safety', 'marketing_preview', 'team_support'] as OwnerType[]) {
    if (getSession(msg.chatId, owner)) {
      activeSessionOwner = owner;
      break;
    }
  }

  // ── Step 3: Ownership Resolution ─────────────────────────────────────────────
  const resolved = resolveOwner(msg, activeSessionOwner);
  decision.owner = resolved.owner;
  decision.intent = resolved.intent;
  decision.decision_reason = resolved.reason;
  decision.confidence = resolved.confidence;

  // ── Step 4: Dedup Claim ──────────────────────────────────────────────────────
  if (msg.messageId) {
    const claimResult = dedupClaim(msg.messageId, msg.chatId, resolved.owner);
    if (!claimResult.claimed) {
      log.warn('[ROUTER] Dedup race — message already claimed', { messageId: msg.messageId, existingOwner: claimResult.existing?.owner });
      decision.intent = 'claim_race_lost';
      decision.owner = 'unknown_no_reply';
      decision.decision_reason = 'dedup_claim_rejected';
      decision.response_allowed = false;
      await _traceDecision(decision);
      return decision;
    }
  }

  // ── Step 5: Response allowed? ──────────────────────────────────────────────
  decision.response_allowed = resolved.owner !== 'unknown_no_reply';

  // ── Step 6: Execute registered handler ──────────────────────────────────────
  const handler = HANDLERS[resolved.owner];
  if (handler && decision.response_allowed) {
    try {
      const handlerResponse = await handler(msg, decision);
      decision.handler_response = handlerResponse;
      decision.response_allowed = handlerResponse.shouldSend && !!handlerResponse.response;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error('[ROUTER] Handler exception', { owner: resolved.owner, error: errMsg });
      decision.handler_response = {
        owner: resolved.owner,
        confidence: 0,
        response: null,
        evidence: `handler_exception: ${errMsg}`,
        shouldSend: false,
      };
      decision.response_allowed = false;
    }
  } else if (!handler && decision.response_allowed) {
    // No handler registered — provide default response based on owner
    decision.handler_response = {
      owner: resolved.owner,
      confidence: resolved.confidence,
      response: null,
      evidence: 'no_handler_registered',
      shouldSend: false,
    };
  }

  // ── Step 7: Router sends the ONE response ───────────────────────────────────
  if (decision.response_allowed && decision.handler_response?.response) {
    const sent = await replyFn(
      msg.chatId,
      decision.handler_response.response,
      decision.handler_response.mediaPath ? { path: decision.handler_response.mediaPath, caption: decision.handler_response.mediaCaption } : undefined
    );
    decision.response_sent = sent;
    dedupUpdateStatus(msg.messageId, sent ? 'completed' : 'failed');
  } else {
    decision.response_sent = false;
    dedupUpdateStatus(msg.messageId, 'completed');
  }

  await _traceDecision(decision);
  return decision;
}

// ── Trace ─────────────────────────────────────────────────────────────────────

async function _traceDecision(decision: RoutingDecision): Promise<void> {
  const traceLine = {
    message_id: decision.message_id,
    chat_id: decision.chat_id,
    sender: decision.sender,
    owner: decision.owner,
    intent: decision.intent,
    selected_handler: decision.owner,
    response_sent: decision.response_sent,
    timestamp: decision.timestamp,
    decision_reason: decision.decision_reason,
    confidence: decision.confidence,
    policy: decision.policy,
    group_name: decision.group_name,
    is_group: decision.isGroup,
  };
  try {
    fs.mkdirSync(path.dirname(ROUTING_TRACE_PATH), { recursive: true });
    fs.appendFileSync(ROUTING_TRACE_PATH, JSON.stringify(traceLine) + '\n');
  } catch (err) {
    log.warn('Trace write failed', { error: (err as Error).message });
  }
}

// ── Session Management ─────────────────────────────────────────────────────────

export { setSession, getSession, clearSession };

// ── Dedup Stats ────────────────────────────────────────────────────────────────

export function getDedupStats() {
  return { size: _dedupStore.size, ttl_ms: TTL_MS };
}
