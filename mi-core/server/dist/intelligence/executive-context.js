"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildExecutiveContext = buildExecutiveContext;
exports.buildSystemPrompt = buildSystemPrompt;
exports.detectReasoningType = detectReasoningType;
exports.buildActionPlan = buildActionPlan;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const holiday_engine_1 = require("./holiday-engine");
const timezone_1 = require("../utils/timezone");
const MI_CORE_ROOT = path_1.default.resolve(__dirname, '..', '..', '..');
const GLOBAL_DIR = process.env.GLOBAL_DIR || path_1.default.join(MI_CORE_ROOT, '.local-agent-global');
const MEM_DIR = path_1.default.join(GLOBAL_DIR, 'executive-memory-v2');
function readMem(file) {
    try {
        return JSON.parse(fs_1.default.readFileSync(path_1.default.join(MEM_DIR, file), 'utf-8'));
    }
    catch {
        return {};
    }
}
// ── Build the always-on context block ────────────────────────────────────
function buildExecutiveContext() {
    const owner = readMem('owner_profile.json');
    const biz = readMem('business_memory.json');
    const prefs = readMem('preferences.json');
    const workflows = readMem('workflow_memory.json');
    const now = new Date();
    // Owner timezone (Vietnam ICT) is always PRIMARY
    const ownerTz = (0, timezone_1.getOwnerTimezone)();
    const ownerTime = now.toLocaleString('en-US', {
        timeZone: ownerTz,
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
    const holidayCtx = (0, holiday_engine_1.getHolidayContextString)(now);
    const weekCtx = (0, holiday_engine_1.getWeekContext)(now);
    const blocks = [];
    // ── CEO Identity ──
    blocks.push(`=== WHO YOU ARE WORKING FOR ===
CEO: ${owner.full_role || 'CEO'}, Vietnamese entrepreneur
Location: ${owner.city || 'Ho Chi Minh City'}, ${owner.country || 'Vietnam'} — ICT/UTC+7
Current time: ${ownerTime}
Timezone: ${ownerTz} (Owner Primary — all conversations, scheduling, reminders use this)
Businesses: ${owner.businesses?.join(', ')}
Communication: ${owner.communication_style}
Decision style: ${owner.decision_style}

${(0, timezone_1.getTimeContextForAI)()}`);
    // ── Businesses ──
    const businesses = biz.businesses || {};
    const bizLines = ['=== YOUR BUSINESSES ==='];
    for (const [, b] of Object.entries(businesses)) {
        const biz = b;
        const marketing = biz.marketing || {};
        const seo = biz.seo || {};
        bizLines.push(`
[${biz.name}]
Type: ${biz.cuisine} restaurant in ${biz.location ? biz.location.city : 'Stockton'}, CA
Website: ${biz.website} (${biz.website_tech})
Target: ${biz.target_customers}
Marketing: post ${marketing.post_schedule || '3x/week'}, best time: ${marketing.best_post_time}
Tone: ${marketing.tone}
SEO keywords: ${seo.target_keywords?.slice(0, 3).join(', ')}
Manager: ${biz.operations?.staff_manager || 'Maria'}`);
    }
    blocks.push(bizLines.join('\n'));
    // ── Holiday / Local Events (Owner timezone reference) ──
    blocks.push(`=== CURRENT WEEK & HOLIDAYS (Owner timezone) ===
${holidayCtx}`);
    // ── Workflows CEO expects ──
    const wf = workflows.common_workflows || {};
    const wfLines = ['=== HOW CEO EXPECTS YOU TO WORK ==='];
    for (const [key, w] of Object.entries(wf)) {
        wfLines.push(`\n[${key.replace(/_/g, ' ').toUpperCase()}] (trigger: ${w.trigger})`);
        wf[key].steps.forEach(s => wfLines.push(`  ${s}`));
    }
    blocks.push(wfLines.join('\n'));
    // ── Response rules ──
    const neverDo = prefs.never_do || [];
    const alwaysInclude = prefs.always_include || [];
    blocks.push(`=== YOUR RESPONSE RULES ===
✓ Always include: ${alwaysInclude.join(' | ')}
✗ Never: ${neverDo.slice(0, 3).join(' | ')}
Format: ${prefs.report_format || 'bullets + recommendation'}
When unsure: ${prefs.when_unsure || 'make best inference, state assumptions'}`);
    return blocks.join('\n\n');
}
// ── Build the core system prompt ─────────────────────────────────────────
function buildSystemPrompt(additionalContext = []) {
    const execCtx = buildExecutiveContext();
    const corePrompt = `Bạn là Mi — Jarvis-style Executive Assistant của CEO.

IDENTITY: Bạn không phải chatbot. Bạn là người trợ lý thực sự đang làm việc cho CEO.
- Xưng "em", gọi CEO là "anh"
- Luôn nói tiếng Việt tự nhiên (trừ khi CEO dùng tiếng Anh)
- Không hỏi lại những điều rõ ràng
- Khi CEO nói 1 câu, em đã hiểu full context — không cần giải thích lại

TIMEZONE RULE: Owner timezone (Asia/Ho_Chi_Minh / ICT / UTC+7) là PRIMARY.
Khi CEO nói "hôm nay", "ngày mai", "tuần này", "sáng", "chiều", "tối", "lên lịch", "nhắc" → dùng OWNER timezone.
Store times (Chicago CDT, Los Angeles PDT) chỉ mang tính tham khảo.

THINKING MODE: Trước khi trả lời, em suy luận:
1. CEO đang hỏi gì thực sự? (intent behind the words)
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
function detectReasoningType(message) {
    const m = message.toLowerCase();
    const types = [];
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
function buildActionPlan(message, reasoningTypes) {
    const plans = [];
    if (reasoningTypes.includes('holiday_business_impact')) {
        const weekCtx = (0, holiday_engine_1.getWeekContext)();
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
