/**
 * Executive Context Builder
 * Builds the full "brain" context injected into every Mi response.
 * This is what transforms Mi from a chatbot into an Executive Assistant.
 *
 * ALWAYS INJECTED (not keyword-gated):
 * - Who CEO is
 * - What businesses they run
 * - Current date/time in OWNER timezone (Vietnam — ICT/UTC+7)
 * - Store times (secondary reference)
 * - Upcoming holidays + business impact
 * - Active workflows
 *
 * TIMEZONE RULE: Owner timezone is ALWAYS primary.
 * "today", "tomorrow", "this week", "morning", "evening" → OWNER timezone.
 * Store times are secondary/informational only.
 *
 * The AI then has full context to reason like a real assistant.
 */

import fs from 'fs';
import path from 'path';
import { getHolidayContextString, getWeekContext } from './holiday-engine';
import { getTimeContextForAI, getOwnerTimezone } from '../utils/timezone';

const MI_CORE_ROOT = path.resolve(__dirname, '..', '..', '..');
const GLOBAL_DIR = process.env.GLOBAL_DIR || path.join(MI_CORE_ROOT, '.local-agent-global');
const MEM_DIR = path.join(GLOBAL_DIR, 'executive-memory-v2');

function readMem(file: string): Record<string, unknown> {
  try { return JSON.parse(fs.readFileSync(path.join(MEM_DIR, file), 'utf-8')); }
  catch { return {}; }
}

// ── Build the always-on context block ────────────────────────────────────
export function buildExecutiveContext(): string {
  const owner    = readMem('owner_profile.json');
  const biz      = readMem('business_memory.json') as { businesses?: Record<string, unknown>; market_context?: Record<string, unknown> };
  const prefs    = readMem('preferences.json');
  const workflows = readMem('workflow_memory.json') as { common_workflows?: Record<string, { trigger: string; steps: string[] }> };

  const now = new Date();
  // Owner timezone (Vietnam ICT) is always PRIMARY
  const ownerTz = getOwnerTimezone();
  const ownerTime = now.toLocaleString('en-US', {
    timeZone: ownerTz,
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const holidayCtx = getHolidayContextString(now);
  const weekCtx = getWeekContext(now);

  const blocks: string[] = [];

  // ── Owner Identity ──
  blocks.push(`=== WHO YOU ARE WORKING FOR ===
Anh: ${owner.full_role || 'business owner'}, Vietnamese entrepreneur
Location: ${owner.city || 'Ho Chi Minh City'}, ${owner.country || 'Vietnam'} — ICT/UTC+7
Current time: ${ownerTime}
Timezone: ${ownerTz} (Owner Primary — all conversations, scheduling, reminders use this)
Businesses: ${(owner.businesses as string[])?.join(', ')}
Communication: ${owner.communication_style}
Decision style: ${owner.decision_style}

${getTimeContextForAI()}`);

  // ── Businesses ──
  const businesses = biz.businesses as Record<string, Record<string, unknown>> || {};
  const bizLines: string[] = ['=== YOUR BUSINESSES ==='];
  for (const [, b] of Object.entries(businesses)) {
    const biz = b as Record<string, unknown>;
    const marketing = biz.marketing as Record<string, unknown> || {};
    const seo = biz.seo as Record<string, unknown> || {};
    bizLines.push(`
[${biz.name}]
Type: ${biz.cuisine} restaurant in ${biz.location ? (biz.location as Record<string,string>).city : 'Stockton'}, CA
Website: ${biz.website} (${biz.website_tech})
Target: ${biz.target_customers}
Marketing: post ${marketing.post_schedule || '3x/week'}, best time: ${marketing.best_post_time}
Tone: ${marketing.tone}
SEO keywords: ${(seo.target_keywords as string[])?.slice(0,3).join(', ')}
Manager: ${(biz.operations as Record<string,string>)?.staff_manager || 'Maria'}`);
  }
  blocks.push(bizLines.join('\n'));

  // ── Holiday / Local Events (Owner timezone reference) ──
  blocks.push(`=== CURRENT WEEK & HOLIDAYS (Owner timezone) ===
${holidayCtx}`);

  // ── Workflows anh expects ──
  const wf = workflows.common_workflows || {};
  const wfLines = ['=== HOW ANH EXPECTS YOU TO WORK ==='];
  for (const [key, w] of Object.entries(wf)) {
    wfLines.push(`\n[${key.replace(/_/g,' ').toUpperCase()}] (trigger: ${w.trigger})`);
    wf[key].steps.forEach(s => wfLines.push(`  ${s}`));
  }
  blocks.push(wfLines.join('\n'));

  // ── Response rules ──
  const neverDo = (prefs.never_do as string[]) || [];
  const alwaysInclude = (prefs.always_include as string[]) || [];
  blocks.push(`=== YOUR RESPONSE RULES ===
✓ Always include: ${alwaysInclude.join(' | ')}
✗ Never: ${neverDo.slice(0,3).join(' | ')}
Format: ${prefs.report_format || 'bullets + recommendation'}
When unsure: ${prefs.when_unsure || 'make best inference, state assumptions'}`);

  return blocks.join('\n\n');
}

// ── Build the core system prompt ─────────────────────────────────────────
export function buildSystemPrompt(additionalContext: string[] = []): string {
  const execCtx = buildExecutiveContext();

  const corePrompt = `Bạn là Mi — Jarvis-style Executive Assistant của anh.

IDENTITY: Bạn không phải chatbot. Bạn là người trợ lý thực sự đang làm việc cho anh.
- Xưng "em", gọi người dùng là "anh"
- Luôn nói tiếng Việt tự nhiên (trừ khi anh dùng tiếng Anh)
- Không hỏi lại những điều rõ ràng
- Khi anh nói 1 câu, em phải hiểu full context — không cần giải thích lại

TIMEZONE RULE: Owner timezone (Asia/Ho_Chi_Minh / ICT / UTC+7) là PRIMARY.
Khi anh nói "hôm nay", "ngày mai", "tuần này", "sáng", "chiều", "tối", "lên lịch", "nhắc" → dùng OWNER timezone.
Store times (Chicago CDT, Los Angeles PDT) chỉ mang tính tham khảo.

THINKING MODE: Trước khi trả lời, em suy luận:
1. Anh đang hỏi gì thực sự? (intent behind the words)
2. Có data nào em đang có không?
3. Nếu không có data → suy luận từ context + knowledge
4. Output: HÀNH ĐỘNG cụ thể, không phải checklist

${execCtx}`;

  if (additionalContext.length > 0) {
    return corePrompt + '\n\n=== LIVE DATA (just fetched) ===\n' + additionalContext.join('\n\n');
  }
  return corePrompt;
}

// ── Detect what type of reasoning is needed ──────────────────────────────
export function detectReasoningType(message: string): string[] {
  const m = message.toLowerCase();
  const types: string[] = [];

  if (/holiday|lễ|ngày lễ|event|sự kiện|tuần này|this week|weekend/.test(m))
    types.push('holiday_business_impact');
  if (/post|đăng|content|marketing|campaign|quảng cáo|instagram|facebook/.test(m))
    types.push('marketing_action');
  if (/last post|bài gần nhất|tương tự|similar|như lần trước/.test(m))
    types.push('content_reference');
  if (/schedule|lên lịch|sáng mai|tomorrow|next week|tuần sau/.test(m))
    types.push('scheduling');
  if (/hôm nay|today|làm gì|what.*do|briefing|tóm tắt/.test(m))
    types.push('daily_brief');
  if (/dashboard|nhà hàng|restaurant|order|staff|maria|doanh thu|revenue/.test(m))
    types.push('restaurant_ops');
  if (/task|asana|việc|todo|overdue|deadline/.test(m))
    types.push('task_management');

  return types.length ? types : ['general'];
}

// ── Action plan builder ──────────────────────────────────────────────────
export interface ActionPlan {
  intent: string;
  reasoning_chain: string[];
  proposed_actions: Array<{
    action: string;
    auto_execute: boolean;
    requires_approval: boolean;
    approval_level?: number;
  }>;
  recommendation: string;
}

export function buildActionPlan(message: string, reasoningTypes: string[]): string {
  const plans: string[] = [];

  if (reasoningTypes.includes('holiday_business_impact')) {
    const weekCtx = getWeekContext();
    plans.push(`HOLIDAY REASONING CHAIN:
${weekCtx.summary}
↓
Business impact: ${weekCtx.has_holiday ? weekCtx.holidays.map(h => `${h.name} → ${h.traffic_effect} traffic, ${h.business_impact} impact`).join(', ') : 'No holiday this week'}
↓
Marketing opportunity: ${weekCtx.marketing_suggestions[0]}
↓
Recommended action: ${weekCtx.marketing_suggestions[0]}`);
  }

  if (reasoningTypes.includes('marketing_action') || reasoningTypes.includes('content_reference')) {
    plans.push(`MARKETING ACTION PLAN:
1. ✓ Auto: Check last 3 posts for reference (from RawSushi/Bakudan content history)
2. ✓ Auto: Check marketing policy (tone, hashtags)
3. ✓ Auto: Draft post copy (VI + EN)
4. → Approval required: Post / Schedule`);
  }

  return plans.join('\n\n');
}
