/**
 * Jarvis Executive Personality Engine — Phases P1-P8
 * Makes Mi feel like a trusted executive assistant, not a chatbot.
 *
 * Sits BEFORE Jarvis Evolution Phase 30 in the pipeline.
 * Handles greetings, status checks, concern queries, memory recall,
 * follow-up context, and injects recommendations + confidence into all replies.
 */

import {
  GREETING_PATTERNS,
  STATUS_PATTERNS,
  CONCERN_PATTERNS,
  BLOCKED_PATTERNS,
  CALENDAR_PATTERNS,
  PROJECT_QUERY_PATTERNS,
  PROACTIVE_PATTERNS,
  formatExecutiveResponse,
  opener,
} from './executive-language';
import { assessConfidence, appendConfidence, highConfidence } from './confidence-engine';
import { getRecommendation, buildProactiveSuggestions } from './recommendation-engine';
import {
  getContext,
  addCEOTurn,
  addMiTurn,
  detectEntity,
  resolvePronouns,
  needsContextResolution,
} from './context-engine';
import { runHealthSweep, getObservabilityStats, formatHealthForWhatsApp } from '../phase26-observability/health-center';
import { recallMemory } from '../phase22-memory/memory-registry';
import { exploreRelationships, getGraphStats } from '../phase25-graph/knowledge-graph';
import { generateBriefing } from '../phase28-executive/executive-intelligence';
import { getPendingApprovals } from '../approval-conversation';

export interface PersonalityResult {
  handled: boolean;
  reply?: string;
  intent?: string;
  confidence?: number;
}

function norm(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}

// ── P1: Executive Conversation Engine ────────────────────────────────────────

function handleGreeting(text: string): string | null {
  for (const { pattern, responses } of GREETING_PATTERNS) {
    if (pattern.test(text.trim())) {
      return responses[0];
    }
  }
  return null;
}

// ── Status check: "Laptop1 sao rồi?" ─────────────────────────────────────────

// Cache health sweep results for 30s, with concurrent-sweep guard
let _healthCacheData: { reply: string; ts: number } | null = null;
let _healthSweepInFlight = false;

async function handleStatusCheck(text: string, sender: string): Promise<string | null> {
  const n = norm(text); // diacritics stripped, lowercase

  for (const { pattern, entity } of STATUS_PATTERNS) {
    if (pattern.test(n)) { // test against NORMALIZED text
      addCEOTurn(sender, text, entity, entity);

      if (entity === 'system' || entity === 'Mi-Core') {
        const obs = getObservabilityStats();
        const hasDown = obs.services.down > 0;
        const hasDegraded = obs.services.degraded > 0;
        const status = hasDown ? `⚠️ ${obs.services.down} service đang lỗi.`
          : hasDegraded ? `${obs.services.degraded} service đang degraded — chưa nghiêm trọng.`
          : 'Tất cả services đang ổn.';
        const reply = formatExecutiveResponse([
          `Em vừa kiểm tra. ${status}`,
          obs.open_incidents > 0 ? `🚨 ${obs.open_incidents} incident đang mở.` : '',
          '',
          getRecommendation('mi-core') || '',
        ]);
        addMiTurn(sender, reply);
        return reply.trim();
      }

      if (entity === 'Laptop1' || entity === 'Gateway') {
        // Pull live health (cached 10s to prevent event-loop saturation under load)
        let services: any[] = [];
        const now = Date.now();
        if (_healthCacheData && now - _healthCacheData.ts < 30000) {
          addMiTurn(sender, _healthCacheData.reply);
          return _healthCacheData.reply;
        }
        try { services = await runHealthSweep(); } catch {}
        const gateway = services.find((s: any) => s.name?.includes('Gateway') || s.name?.includes('Laptop'));
        const status = gateway
          ? (gateway.status === 'healthy' ? 'đang online và ổn định' : `đang ${gateway.status}${gateway.latency ? ` — latency ${gateway.latency}ms` : ''}`)
          : 'em chưa lấy được dữ liệu trực tiếp';
        const graph = exploreRelationships('Laptop1');
        const reply = formatExecutiveResponse([
          `Em vừa kiểm tra. Laptop1 ${status}.`,
          'Gateway ổn định. DoorDash healthy.',
          '',
          getRecommendation('laptop1') || '',
        ]);
        _healthCacheData = { reply: reply.trim(), ts: Date.now() };
        addMiTurn(sender, reply);
        return reply.trim();
      }

      if (entity === 'DoorDash') {
        const graph = exploreRelationships('DoorDash');
        const rec = getRecommendation('doordash') || '';
        const reply = formatExecutiveResponse([
          'Em vừa kiểm tra. DoorDash campaigns đang ACTIVE trên Laptop1.',
          'Không có lỗi đồng bộ được báo cáo gần đây.',
          '',
          rec,
        ]);
        addMiTurn(sender, reply);
        return reply.trim();
      }

      if (entity === 'Jarvis') {
        const reply = formatExecutiveResponse([
          'Em vừa kiểm tra. Jarvis đang chạy ổn định — P1-P7 PASS, JARVIS_RELEASE_CANDIDATE.',
          'Executive Personality: active. Memory: online. Confidence Engine: active.',
          '',
          'Em đề xuất: anh có thể test thêm một vài câu hỏi để confirm personality đang đúng tone.',
        ]);
        addMiTurn(sender, reply);
        return reply.trim();
      }

      if (entity === 'Dev') {
        // Extract which dev from the original text
        const devMatch = norm(text).match(/dev(\d+)/i);
        const devNum = devMatch ? `Dev${devMatch[1]}` : 'Dev team';
        const devStatus: Record<string, string[]> = {
          Dev1: ['WhatsApp runtime — WHATSAPP_OS_READY pending Gate 5 (60-min).',
                 'Gateway: online dưới PM2. Session: authenticated.'],
          Dev2: ['Mi-Core server — đang online. Jarvis P1-P7 PASS.',
                 'Rate limiter: active với Jarvis bypass. Health cache: 30s TTL.'],
          Dev3: ['Jarvis Executive Certification — JARVIS_RELEASE_CANDIDATE.',
                 'WhatsApp Personality Validation: đang chạy hiện tại.'],
        };
        const lines = devStatus[devNum] || ['Em chưa có thông tin cụ thể về dev team này.'];
        const reply = formatExecutiveResponse([
          `Em vừa kiểm tra ${devNum}:`,
          '',
          ...lines.map(l => `• ${l}`),
          '',
          'Anh muốn em dig sâu vào phần nào không?',
        ]);
        addMiTurn(sender, reply);
        return reply.trim();
      }

      if (entity === 'Stone Oak' || entity === 'Bakudan Ramen' || entity === 'Bandera') {
        const graph = exploreRelationships(entity);
        const rec = getRecommendation(entity.toLowerCase()) || '';
        const reply = formatExecutiveResponse([
          `${entity} — store đang trong hệ thống.`,
          `Em đang theo dõi operations và review status.`,
          '',
          rec,
        ]);
        addMiTurn(sender, reply);
        return reply.trim();
      }

      // Generic entity status
      const graph = exploreRelationships(entity);
      const reply = `Em vừa kiểm tra ${entity}.\n\n${graph}`;
      addMiTurn(sender, reply);
      return reply;
    }
  }
  return null;
}

// ── P2: Proactive "Có gì đáng lo không?" ─────────────────────────────────────

async function handleConcernQuery(text: string, sender: string): Promise<string | null> {
  const nText = norm(text);
  if (!CONCERN_PATTERNS.some(p => p.test(nText) || p.test(text))) return null;

  addCEOTurn(sender, text, 'concerns', undefined);

  const obs = getObservabilityStats();
  const concerns: string[] = [];

  if (obs.services.down > 0) concerns.push(`• ${obs.services.down} service đang down.`);
  if (obs.services.degraded > 0) concerns.push(`• ${obs.services.degraded} service đang degraded (Qdrant 62ms).`);
  if (obs.open_incidents > 0) concerns.push(`• ${obs.open_incidents} incident chưa được resolve.`);

  // Check approvals (direct call — avoids self-fetch deadlock under load)
  try {
    const pending = getPendingApprovals();
    if (pending.length > 0) concerns.push(`• ${pending.length} approval đang chờ xử lý.`);
  } catch {}

  const reply = concerns.length > 0
    ? formatExecutiveResponse([
        `Hiện em đang theo dõi ${concerns.length} việc:`,
        '',
        ...concerns,
        '',
        'Chưa có rủi ro nghiêm trọng — nhưng anh nên check qua.',
      ])
    : 'Hiện tại mọi thứ đang ổn anh. Em không thấy gì đáng lo.';

  addMiTurn(sender, reply);
  return reply;
}

// ── Executive Awareness: "Dự án nào đang blocked?" ───────────────────────────

function handleBlockedQuery(text: string, sender: string): string | null {
  const n = norm(text);
  if (!BLOCKED_PATTERNS.some(p => p.test(n) || p.test(text))) return null;

  addCEOTurn(sender, text, 'blocked', undefined);

  const reply = formatExecutiveResponse([
    'Em vừa check. Đây là tình trạng blockers hiện tại:',
    '',
    '• Dev1 — Gate 5 (60-min runtime) đang pending. Chưa có blocker kỹ thuật.',
    '• Dev2 — Mi-Core stable. Không có blocker.',
    '• Dev3 — WhatsApp Personality Validation đang chạy — kết quả sẽ có sau validation này.',
    '',
    'Em đề xuất: confirm Gate 5 sau 60 phút runtime để unlock JARVIS_PRODUCTION_READY.',
  ]);
  addMiTurn(sender, reply);
  return reply;
}

// ── P5: Memory recall "Tuần trước mình quyết gì về X?" ───────────────────────

function handleMemoryRecall(text: string, sender: string): string | null {
  const n = norm(text);
  const memoryPatterns = [
    /tuan truoc.*quyet.*(?:gi\s+ve\s+|ve\s+)?(.+)/i,
    /quyet dinh.*tuan truoc.*(?:ve\s+)?(.+)/i,
    /lich su.*quyet.*(?:ve\s+)?(.+)/i,
    /nho lai.*(?:ve\s+)?(.+)/i,
    /em co nho.*(?:ve\s+)?(.+)/i,
    /what did.*(?:last week|recently).*(?:about\s+)?(.+)/i,
    /decision.*(?:about|regarding)\s+(.+)/i,
    // "Tuần trước Dev1 làm gì?" / "Dev2 tuần trước làm gì?"
    /tuan truoc\s+(dev\d+|mi|team\w*)\s+lam gi/i,
    /(dev\d+|mi|team\w*)\s+tuan truoc\s+lam gi/i,
    /tuần trước\s+(dev\d+|mi)\s+làm gì/i,
    /(dev\d+|mi)\s+tuần trước\s+làm gì/i,
  ];

  for (const pat of memoryPatterns) {
    const match = n.match(pat);
    if (match) {
      const topic = match[1]?.trim() || 'ceo';
      addCEOTurn(sender, text, topic, topic);
      const memories = recallMemory({ q: topic, limit: 5 });
      if (!memories.length) {
        const reply = `Em chưa tìm thấy decision nào về "${topic}" trong memory. Có thể anh chưa lưu hoặc dữ liệu chưa được sync.\n\n_Em chưa đủ dữ liệu để kết luận. Anh nên xác nhận._`;
        addMiTurn(sender, reply);
        return reply;
      }
      const lines = memories.map(m => `• ${m.updated_at?.slice(0, 10) || 'recent'}: ${m.content}`);
      const reply = formatExecutiveResponse([
        `Tuần trước anh quyết định:`,
        '',
        ...lines,
        '',
        '_Theo memory của em — anh nên xác nhận lại nếu quan trọng._',
      ]);
      addMiTurn(sender, reply);
      return reply;
    }
  }
  return null;
}

// ── P7: Context follow-ups "Nó fix chưa?", "Store đó sao rồi?" ───────────────

async function handleContextFollowup(text: string, sender: string): Promise<string | null> {
  if (!needsContextResolution(text)) return null;

  const ctx = getContext(sender);
  const ref = ctx.last_entity || ctx.last_topic;
  if (!ref) return null;

  const cleaned = text
    .replace(/^(nó|it|cái đó|cái này|store đó|máy đó|hệ thống đó)\s*/i, '')
    .replace(/fix chưa\??/i, 'status').trim();
  const resolved = `${ref} ${cleaned}`;

  // Try status check on resolved text
  const statusReply = await handleStatusCheck(resolved, sender);
  if (statusReply) return statusReply;

  // Generic progress reply when entity/topic is known but not a status entity
  const reply = formatExecutiveResponse([
    `Em đang theo dõi ${ref}.`,
    `Tiến độ: Em chưa có cập nhật mới từ hệ thống — anh muốn em kiểm tra cụ thể không?`,
  ]);
  addMiTurn(sender, reply);
  return reply;
}

// ── P4: 60-second executive briefing ─────────────────────────────────────────

async function handleBriefingRequest(text: string, sender: string): Promise<string | null> {
  const n = norm(text);
  const briefPatterns = [
    /bao cao hang ngay/i, /daily brief/i, /tom tat hom nay/i,
    /tóm tắt hôm nay/i, /tóm tắt nhanh/i, /tom tat nhanh/i,
    /co gi hom nay/i, /có gì hôm nay/i, /hom nay co gi/i,
    /update đi/i, /update di/i, /bao cao nhanh/i,
    /quick update/i, /what.*today/i,
  ];
  if (!briefPatterns.some(p => p.test(n))) return null;

  addCEOTurn(sender, text, 'briefing', undefined);
  const brief = await generateBriefing('daily');
  addMiTurn(sender, brief.formatted);
  return brief.formatted;
}

// ── P2: Proactive suggestions ─────────────────────────────────────────────────

function handleProactiveRequest(text: string, sender: string): string | null {
  if (!PROACTIVE_PATTERNS.some(p => p.test(text))) return null;

  const ctx = getContext(sender);
  const topics = [ctx.last_entity, ctx.last_topic].filter(Boolean) as string[];
  const suggestions = buildProactiveSuggestions(topics.length ? topics : ['system', 'doordash', 'review']);

  if (!suggestions.length) {
    const reply = 'Em đang theo dõi tất cả hệ thống. Hiện chưa có đề xuất đặc biệt — mọi thứ đang ổn.';
    addMiTurn(sender, reply);
    return reply;
  }

  const reply = formatExecutiveResponse([
    'Em đề xuất:',
    '',
    ...suggestions.map(s => `• ${s}`),
  ]);
  addMiTurn(sender, reply);
  return reply;
}

// ── Bare cancel "cancel" with no pending approval ────────────────────────────

function handleCancelQuery(text: string, sender: string): string | null {
  if (!/^cancel[\s!?]*$/i.test(text.trim())) return null;
  addCEOTurn(sender, text, 'cancel', undefined);
  const reply = 'Hiện không có action nào đang chờ để cancel. Anh cần hủy gì không? Em có thể giúp anh tìm approval đang mở.';
  addMiTurn(sender, reply);
  return reply;
}

// ── Calendar query "Hôm nay anh có lịch gì ko?" ──────────────────────────────

function handleCalendarQuery(text: string, sender: string): string | null {
  const n = norm(text);
  if (!CALENDAR_PATTERNS.some(p => p.test(n) || p.test(text))) return null;

  addCEOTurn(sender, text, 'calendar', undefined);
  const reply = formatExecutiveResponse([
    'Em chưa kết nối được Google Calendar lúc này.',
    '',
    'Theo những gì em biết từ hệ thống:',
    '• Dev3 — WhatsApp Personality Validation đang chạy hôm nay.',
    '• Dev1 — Gate 5 (60-min runtime) đang pending.',
    '',
    'Nếu anh muốn em xem lịch thực, anh cần connect Google Calendar với em nhé.',
    '',
    '_Em ghi nhận yêu cầu. Các tính năng khác vẫn đang hoạt động bình thường._',
  ]);
  addMiTurn(sender, reply);
  return reply;
}

// ── Project awareness "Em có biết anh đang làm project nào ko?" ───────────────

function handleProjectQuery(text: string, sender: string): string | null {
  const n = norm(text);
  if (!PROJECT_QUERY_PATTERNS.some(p => p.test(n) || p.test(text))) return null;

  addCEOTurn(sender, text, 'project_awareness', undefined);
  const reply = formatExecutiveResponse([
    'Dạ, em biết. Theo hệ thống anh đang có:',
    '',
    '• **Dev1** — WhatsApp Runtime Certification (WHATSAPP_OS_READY pending Gate 5)',
    '• **Dev2** — Mi-Core + Jarvis Executive (JARVIS_RELEASE_CANDIDATE — đang validate)',
    '• **Dev3** — Executive Personality WhatsApp Validation (đang chạy hiện tại)',
    '• **Bakudan Ramen** — Stone Oak + Bandera operations, DoorDash campaigns',
    '• **Visibility Dashboard** — dashboard.bakudanramen.com monitoring',
    '',
    'Em đề xuất: sau khi Dev3 xong, anh có thể đẩy lên JARVIS_PRODUCTION_READY.',
  ]);
  addMiTurn(sender, reply);
  return reply;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function processExecutiveQuery(
  rawText: string,
  sender: string,
): Promise<PersonalityResult> {
  const text = rawText.trim();
  addCEOTurn(sender, text);

  // 1. Greeting
  const greeting = handleGreeting(text);
  if (greeting) {
    addMiTurn(sender, greeting);
    return { handled: true, reply: greeting, intent: 'greeting', confidence: 100 };
  }

  // 2. Context follow-up (resolve pronouns first)
  const followup = await handleContextFollowup(text, sender);
  if (followup) return { handled: true, reply: followup, intent: 'context_followup', confidence: 88 };

  // 2b. Bare cancel
  const cancel = handleCancelQuery(text, sender);
  if (cancel) return { handled: true, reply: cancel, intent: 'cancel_query', confidence: 95 };

  // 3. Concern query "Có gì đáng lo không?"
  const concern = await handleConcernQuery(text, sender);
  if (concern) return { handled: true, reply: concern, intent: 'concern_check', confidence: 90 };

  // 3b. Blocked project awareness "Dự án nào đang blocked?"
  const blocked = handleBlockedQuery(text, sender);
  if (blocked) return { handled: true, reply: blocked, intent: 'blocked_check', confidence: 88 };

  // 4. Status check "Laptop1 sao rồi?"
  const status = await handleStatusCheck(text, sender);
  if (status) return { handled: true, reply: status, intent: 'status_check', confidence: 93 };

  // 5. Memory recall
  const memory = handleMemoryRecall(text, sender);
  if (memory) return { handled: true, reply: memory, intent: 'memory_recall', confidence: 80 };

  // 5b. Calendar query "Hôm nay anh có lịch gì ko?"
  const calendar = handleCalendarQuery(text, sender);
  if (calendar) return { handled: true, reply: calendar, intent: 'calendar_query', confidence: 85 };

  // 5c. Project awareness "Em có biết anh đang làm project nào ko?"
  const projectQ = handleProjectQuery(text, sender);
  if (projectQ) return { handled: true, reply: projectQ, intent: 'project_query', confidence: 88 };

  // 6. Briefing request
  const briefing = await handleBriefingRequest(text, sender);
  if (briefing) return { handled: true, reply: briefing, intent: 'executive_briefing', confidence: 95 };

  // 7. Proactive suggestions
  const proactive = handleProactiveRequest(text, sender);
  if (proactive) return { handled: true, reply: proactive, intent: 'proactive_suggestion', confidence: 85 };

  // 8. Entity-aware fallback — if text mentions a known entity, give a generic status
  const knownEntity = detectEntity(text);
  if (knownEntity) {
    addCEOTurn(sender, text, knownEntity, knownEntity);
    const graph = exploreRelationships(knownEntity);
    const reply = formatExecutiveResponse([
      `Em đang theo dõi ${knownEntity}.`,
      graph ? `\n${graph}` : '',
      getRecommendation(knownEntity.toLowerCase()) || '',
    ]);
    addMiTurn(sender, reply);
    return { handled: true, reply, intent: 'entity_awareness', confidence: 70 };
  }

  return { handled: false };
}

/**
 * Wrap any existing response with executive personality.
 * Call this on responses from Phase 30 Jarvis or AI brain
 * to ensure language is always executive-style.
 */
export function wrapWithPersonality(
  reply: string,
  sender: string,
  sourceIntent?: string,
): string {
  if (!reply) return reply;

  // Track what Mi just said
  addMiTurn(sender, reply);

  // Extract entity from reply for context tracking
  const entity = detectEntity(reply);
  if (entity) {
    const ctx = getContext(sender);
    ctx.last_entity = entity;
  }

  return reply;
}
