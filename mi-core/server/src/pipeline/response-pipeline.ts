/**
 * Mi Response Pipeline — Jarvis-style Executive Assistant
 *
 * CEO message
 * → [ALWAYS] Full executive context (owner + business + holiday + workflows)
 * → [SMART] Live data pulled only when relevant (calendar, email, projects, etc.)
 * → [REASON] Executive reasoning chain built for the query type
 * → AI response with full context → acts like a real assistant, not a chatbot
 */

import { executiveMemory } from '../memory/executive-memory';
import { search as kbSearch } from '../knowledge/knowledge-db';
import {
  getDailySnapshot, searchProjects, getTasksForPerson_,
  getImportantEmailsAll, getTodayEventsAll,
} from '../visibility/visibility-hub';
import { getHealthSummaryText, hasHealthExport } from '../visibility/connectors/health/health-connector';
import { getAccountingSummaryText } from '../visibility/connectors/accounting-connector';
import { getFoodSafetySummaryText } from '../visibility/connectors/food-safety-connector';
import { detectProjectTarget, detectActionType, routeCommand } from '../projects/connector-router';
import { buildSystemPrompt, detectReasoningType, buildActionPlan } from '../intelligence/executive-context';
import { getHolidayContextString, getWeekContext } from '../intelligence/holiday-engine';
import { getFederatedContext, searchAll } from '../knowledge-federation/index';
import { getPlatformHealthText } from '../visibility/platform-health';
import { createTaskDraft, parseTaskFromMessage, formatTaskDraftResponse } from '../projects/task-manager';
import { draftContent, formatContentDraftResponse, getLastPost } from '../projects/content-scheduler';
import { askAi, ChatMessage } from '../services/ai-client';
import { getPending } from '../approval/gate';
import { MiMode } from '../services/mi-brain';
import { isDailyWorkAction, handleDailyWorkAction } from '../actions/daily-work-actions';
import { resolveStore, resolvePerson, answerStoreQuery } from '../memory2/store-context';
import { searchLocalFiles, formatFileResults } from '../actions/file-search';
import { isDataAnalystMessage, handleDataAnalystMessage, buildDataAnalystRouteContext } from '../actions/data-analyst-handler';

export interface PipelineInput {
  message: string;
  mode: MiMode;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  intent: string;
}

export interface PipelineOutput {
  reply: string;
  model: string;
  sources: string[];
  memory_context: string;
  kb_hits: number;
}

export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const { message, mode, history } = input;
  const sources: string[] = ['executive-brain', 'holiday-engine'];
  const liveDataParts: string[] = [];  // live data fetched this request
  let kbHits = 0;
  let extraContext = '';

  // ── 0a. Data Analyst — intercept before AI ────────────────────────────────
  if (isDataAnalystMessage(message)) {
    const directAnswer = handleDataAnalystMessage(message);
    if (directAnswer) {
      return { reply: directAnswer, model: 'data-analyst', sources: ['data-analyst'], memory_context: '', kb_hits: 0 };
    }
    // Inject data analyst context into AI prompt
    const { contextLine } = buildDataAnalystRouteContext(message);
    extraContext = contextLine;
  }

  // ── 0. Daily Work Actions — intercept before AI ──────────────────────────
  // Handles: file search, find+send, create meeting, upload Drive, store queries
  if (isDailyWorkAction(message)) {
    const actionResult = await handleDailyWorkAction(message);
    if (actionResult) {
      // Inject context into sources
      const reply = actionResult.reply;
      const srcs = [...actionResult.sources];
      // Still let AI enrich the response with store/people context
      const store = resolveStore(message);
      const person = resolvePerson(message);
      const storeCtx = store ? `\n[Store] ${store.name} — ${store.city}, ${store.state}` : '';
      const personCtx = person ? `\n[Person] ${person.name} — ${person.role}` : '';
      return {
        reply: reply + storeCtx + personCtx,
        model: 'action-layer',
        sources: srcs,
        memory_context: '',
        kb_hits: 0,
      };
    }
  }

  // ── 1. Detect what reasoning types are needed ──
  const reasoningTypes = detectReasoningType(message);

  // ── 2. Executive Memory — relevant snippets ──
  const memContext = executiveMemory.getRelevantMemoryForMessage(message);

  // ── 3. Knowledge DB ──
  const kbResults = kbSearch(message, 5);
  if (kbResults.length > 0) {
    const kbSection = kbResults.map(r =>
      `Source: ${r.source} | ${r.title}\n${r.snippet}`
    ).join('\n---\n');
    liveDataParts.push(`[Knowledge DB — ${kbResults.length} hits]\n${kbSection}`);
    sources.push('knowledge-db');
    kbHits = kbResults.length;
  }

  // (Compliance DB search handled by knowledge-federation/index.ts searchAll)

  // ── 4. Executive Reasoning Chain ──
  if (reasoningTypes.some(t => ['holiday_business_impact', 'marketing_action', 'content_reference', 'scheduling'].includes(t))) {
    const actionPlan = buildActionPlan(message, reasoningTypes);
    if (actionPlan) {
      liveDataParts.push(`[Executive Reasoning]\n${actionPlan}`);
      sources.push('reasoning-engine');
    }
  }

  // ── 4b. Knowledge Federation — unified search ──
  const fedCtx = getFederatedContext(message, 1200);
  if (fedCtx) {
    liveDataParts.push(fedCtx);
    sources.push('knowledge-federation');
  }

  // ── 4b2. Store + People context from federated memory ──
  const storeCtx = resolveStore(message);
  if (storeCtx) {
    liveDataParts.push(`[Store Context]\n${storeCtx.name} | ${storeCtx.city}, ${storeCtx.state} | ${storeCtx.website}\nManager: ${storeCtx.manager} | Timezone: ${storeCtx.timezone}\nCompliance: ${storeCtx.compliance_jurisdiction} | Best post: ${storeCtx.best_post_time}`);
    sources.push('store-memory');
  }
  const personCtx = resolvePerson(message);
  if (personCtx) {
    liveDataParts.push(`[Person Context]\n${personCtx.name} — ${personCtx.role}\nStores: ${personCtx.stores.join(', ')}`);
    sources.push('people-memory');
  }

  // ── 4b3. Local file search for relevant queries ──
  if (/tìm|find|search|report|file|báo cáo|payroll|invoice/i.test(message) &&
      !/tìm task|find task|tìm project/i.test(message)) {
    const fileHits = searchLocalFiles(message, 3);
    if (Array.isArray(fileHits) && fileHits.length > 0) {
      liveDataParts.push(`[Local Files — ${fileHits.length} found]\n` +
        fileHits.map(f => `• ${f.score}% — ${f.name} (${f.modified}) — ${f.path}`).join('\n'));
      sources.push('local-filesystem');
    }
  }

  // ── 4c. Platform health (when asked or for daily brief) ──
  if (/platform|connector|kết nối|hệ thống|status.*all|tất cả.*status/i.test(message) ||
      reasoningTypes.includes('daily_brief')) {
    try {
      const healthText = await getPlatformHealthText();
      liveDataParts.push(healthText);
      sources.push('platform-health');
    } catch { /* non-blocking */ }
  }

  // ── 4d. Task creation — direct action ──
  if (/^(create|tạo|giao|add)\s+(task|việc)/i.test(message.trim())) {
    const parsed = parseTaskFromMessage(message);
    const draft = createTaskDraft(parsed);
    liveDataParts.push(`[Task Draft Created]\n${formatTaskDraftResponse(draft)}`);
    sources.push('task-manager');
  }

  // ── 4e. Content scheduling — direct action ──
  if (/lên lịch.*post|schedule.*post|đăng.*sáng mai|post.*tomorrow|tạo.*content|draft.*post/i.test(message)) {
    const isRaw = /raw|sushi/i.test(message);
    const isBakudan = /bakudan|ramen/i.test(message);
    const business = isRaw ? 'raw-sushi' : (isBakudan ? 'bakudan' : 'raw-sushi');
    const isSimilar = /tương tự|similar|như lần trước|last post/i.test(message);
    const lastPost = isSimilar ? getLastPost(business) : null;

    const draft = draftContent({
      business,
      type: /seo/i.test(message) ? 'seo-article' : 'social-post',
      reference_post: lastPost?.id,
      schedule_date: (() => {
        const d = new Date(); d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
      })(),
    });
    liveDataParts.push(`[Content Draft Created]\n${formatContentDraftResponse(draft)}`);
    sources.push('content-scheduler');
  }

  // ── 5. Daily Brief / Visibility snapshot ──
  const needsBrief = reasoningTypes.includes('daily_brief') ||
    /hôm nay|today|tình hình|snapshot|briefing|tóm tắt.*ngày|morning/i.test(message);
  if (needsBrief) {
    try {
      const snapshot = await getDailySnapshot();
      const visLines = [
        `📅 ${snapshot.date}`,
        snapshot.emails.unread !== undefined
          ? `📧 Gmail: ${snapshot.emails.unread} unread, ${snapshot.emails.important} important`
          : `📧 Gmail: ${snapshot.emails.status}`,
        snapshot.calendar.today_count !== undefined
          ? `📆 Calendar: ${snapshot.calendar.today_count} events today${snapshot.calendar.events_today?.length ? ' → ' + snapshot.calendar.events_today.map((e: { title: string }) => e.title).join(', ') : ''}`
          : `📆 Calendar: ${snapshot.calendar.status}`,
        snapshot.tasks.asana_my_tasks !== undefined
          ? `✅ Asana: ${snapshot.tasks.asana_my_tasks} tasks, ${snapshot.tasks.asana_overdue || 0} overdue`
          : `✅ Asana: ${snapshot.tasks.asana_status}`,
        snapshot.dashboard.status === 'synced'
          ? `🏪 Dashboard: synced (${snapshot.dashboard.modules_count} modules)`
          : '🏪 Dashboard: not synced',
        snapshot.action_items?.length > 0 ? `⚠️ Action items: ${snapshot.action_items.join(' | ')}` : '',
      ].filter(Boolean).join('\n');
      liveDataParts.push(`[Daily Snapshot]\n${visLines}`);
      sources.push('visibility-hub');
    } catch { /* non-blocking */ }
  }

  // ── 6. Live holiday context (for specific holiday queries) ──
  if (/holiday|lễ|ngày lễ|event.*week|tuần.*có.*gì|stockton.*có/i.test(message)) {
    const holidayCtx = getHolidayContextString();
    liveDataParts.push(`[Holiday + Local Events — Stockton CA]\n${holidayCtx}`);
    sources.push('holiday-engine-detailed');
  }

  // ── 7. Project connector query ──
  const projectTarget = detectProjectTarget(message);
  if (projectTarget !== 'unknown') {
    try {
      const result = await routeCommand(message);
      if (result.summary) {
        liveDataParts.push(`[Project: ${result.target}]\n${result.summary}`);
        sources.push(...result.sources);
        if (result.requires_approval) {
          liveDataParts.push(`[→ Approval Required: ID ${result.approval_id}]`);
        }
      }
    } catch { /* non-blocking */ }
  }

  // ── 8. Restaurant ops ──
  if (reasoningTypes.includes('restaurant_ops') || /dashboard|doanh thu|order|nhà hàng.*hôm|reservation/i.test(message)) {
    try {
      const result = await routeCommand('Check Dashboard');
      if (result.summary) {
        liveDataParts.push(`[Dashboard / Restaurant Ops]\n${result.summary}`);
        sources.push('dashboard-connector');
      }
    } catch { /* non-blocking */ }
  }

  // ── 9. Person task query ──
  const personMatch = message.match(/(?:maria|hoang|nguyen)\s+(?:còn|có|task|công việc)/i) ||
    message.match(/task.*(?:của|for)\s+([\w]+)/i);
  if (personMatch) {
    const name = (personMatch[1] || personMatch[0].split(/\s/)[0]).toLowerCase();
    const tasks = getTasksForPerson_(name);
    if (tasks.asana.length > 0) {
      liveDataParts.push(`[Tasks for ${name}]\n${tasks.asana.map((t: { name: string; is_overdue: boolean; due_on?: string }) => `• ${t.name} (${t.is_overdue ? 'OVERDUE' : 'due ' + (t.due_on || 'no date')})`).join('\n')}`);
      sources.push('asana');
    }
  }

  // ── 10. Health ──
  if (/sức khỏe|bước chân|steps|sleep|ngủ|tim|heart rate/i.test(message)) {
    if (hasHealthExport()) {
      liveDataParts.push(`[Health]\n${getHealthSummaryText()}`);
      sources.push('health-export');
    }
  }

  // ── 11. Accounting ──
  if (/kế toán|accounting|ledger|chi phí|cost/i.test(message)) {
    liveDataParts.push(`[Accounting]\n${getAccountingSummaryText()}`);
    sources.push('accounting-engine');
  }

  // ── 12. Email / Calendar live ──
  if (/email|gmail|thư.*quan trọng/i.test(message)) {
    const emails = getImportantEmailsAll(5);
    if (emails.gmail.length > 0) {
      liveDataParts.push(`[Gmail — Important]\n${emails.gmail.map((e: { subject: string; from: string }) => `• ${e.subject} — ${e.from}`).join('\n')}`);
      sources.push('gmail');
    }
  }
  if (/calendar|lịch|meeting|cuộc họp/i.test(message)) {
    const events = getTodayEventsAll();
    if (events.calendar.length > 0) {
      liveDataParts.push(`[Calendar Today]\n${events.calendar.map((e: { title: string; start: string }) => `• ${e.title} @ ${new Date(e.start).toLocaleTimeString('vi-VN')}`).join('\n')}`);
      sources.push('google-calendar');
    }
  }

  // ── 13. Pending approvals ──
  const pending = getPending();
  if (pending.length > 0) {
    liveDataParts.push(`[Pending Approvals: ${pending.length}]\n${pending.map(a => `• Level ${a.risk_level}: ${a.description}`).join('\n')}`);
    sources.push('approval-gate');
  }

  // ── 14. Memory context extra ──
  if (memContext) {
    liveDataParts.push(`[Memory Context]\n${memContext}`);
  }

  // ── 15. Project search ──
  const searchMatch = message.match(/tìm\s+(.+)|find\s+(.+)/i);
  if (searchMatch) {
    const q = (searchMatch[1] || searchMatch[2]).trim();
    const projectHits = searchProjects(q);
    if (projectHits.length > 0) {
      liveDataParts.push(`[Project Search: "${q}"]\n${projectHits.slice(0, 5).map((p: { name: string; type: string; path: string }) => `${p.name} (${p.type}) — ${p.path}`).join('\n')}`);
    }
  }

  // ── 16. Build full system prompt (always includes exec brain) ──
  const systemPrompt = buildSystemPrompt(liveDataParts);

  // ── 17. Build messages ──
  const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];
  for (const h of history.slice(-8)) messages.push({ role: h.role, content: h.content });
  messages.push({ role: 'user', content: message });

  // ── 18. AI call ──
  const aiRes = await askAi(messages);

  return { reply: aiRes.text, model: aiRes.model, sources, memory_context: memContext, kb_hits: kbHits };
}
