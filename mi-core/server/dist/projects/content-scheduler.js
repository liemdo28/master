"use strict";
/**
 * Content Scheduler — draft, schedule and approve social/SEO posts
 * for Raw Sushi Bar and Bakudan Ramen websites.
 * All publish actions require CEO approval.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.draftContent = draftContent;
exports.getScheduledPosts = getScheduledPosts;
exports.getPendingApprovalPosts = getPendingApprovalPosts;
exports.getLastPost = getLastPost;
exports.formatContentDraftResponse = formatContentDraftResponse;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const gate_1 = require("../approval/gate");
const holiday_engine_1 = require("../intelligence/holiday-engine");
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const SCHEDULE_PATH = path_1.default.join(GLOBAL_DIR, 'mi-core', 'content-schedule.json');
function loadSchedule() {
    try {
        return JSON.parse(fs_1.default.readFileSync(SCHEDULE_PATH, 'utf-8'));
    }
    catch {
        return [];
    }
}
function saveSchedule(drafts) {
    fs_1.default.mkdirSync(path_1.default.dirname(SCHEDULE_PATH), { recursive: true });
    fs_1.default.writeFileSync(SCHEDULE_PATH, JSON.stringify(drafts, null, 2));
}
function generateId() { return 'post_' + Date.now().toString(36); }
// ── Business profile shortcuts ─────────────────────────────────────────────
const BIZ_PROFILES = {
    'raw-sushi': {
        hashtags: ['#RawSushi', '#StocktonFood', '#SushiLovers', '#CentralValleyEats', '#StocktonEats'],
        best_time: 'Friday 10AM PT',
        tone: 'fresh, clean, upscale casual',
        seo_keywords: ['sushi stockton', 'best sushi stockton ca', 'sushi bar stockton'],
    },
    'bakudan': {
        hashtags: ['#BakudanRamen', '#StocktonRamen', '#RamenLovers', '#StocktonFoodies', '#BakudanRamen'],
        best_time: 'Thursday 11AM PT',
        tone: 'bold, fun, energetic',
        seo_keywords: ['ramen stockton', 'best ramen stockton ca', 'bakudan ramen'],
    },
};
// ── Draft generator ────────────────────────────────────────────────────────
function draftContent(params) {
    const { business, type, topic, reference_post, schedule_date, schedule_time } = params;
    const weekCtx = (0, holiday_engine_1.getWeekContext)();
    const upcoming = weekCtx.upcoming_7_days[0];
    // Determine topic from holiday/context if not specified
    const effectiveTopic = topic || (upcoming ? upcoming.name : 'weekend special');
    const effectiveBusiness = business === 'both' ? 'raw-sushi' : business;
    const profile = BIZ_PROFILES[effectiveBusiness] || BIZ_PROFILES['raw-sushi'];
    // Default schedule: tomorrow morning at best time
    let schedDate = schedule_date;
    if (!schedDate) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        schedDate = tomorrow.toISOString().split('T')[0];
    }
    const draft = {
        id: generateId(),
        business,
        type,
        title: `${effectiveTopic} — ${business === 'bakudan' ? 'Bakudan Ramen' : 'Raw Sushi Bar'}`,
        body_vi: generateCopy('vi', effectiveBusiness, effectiveTopic, type),
        body_en: generateCopy('en', effectiveBusiness, effectiveTopic, type),
        hashtags: [
            ...profile.hashtags.slice(0, 3),
            `#${effectiveTopic.replace(/\s+/g, '')}`,
            '#Stockton',
        ],
        image_concept: generateImageConcept(effectiveBusiness, effectiveTopic, type),
        schedule_date: schedDate,
        schedule_time: schedule_time || profile.best_time,
        status: 'pending_approval',
        created_at: new Date().toISOString(),
        reference_post,
        marketing_notes: `SEO keywords: ${profile.seo_keywords.slice(0, 2).join(', ')}. Tone: ${profile.tone}.`,
    };
    // Enqueue for approval
    const approval = (0, gate_1.enqueue)({
        risk_level: 2,
        category: 'content-publish',
        target: business,
        description: `Schedule post: "${draft.title}" on ${schedDate} at ${draft.schedule_time}`,
        before_state: 'No post scheduled',
        rollback_plan: 'Reject to cancel. Post will not be published.',
    });
    draft.approval_id = approval.id;
    const schedule = loadSchedule();
    schedule.push(draft);
    saveSchedule(schedule);
    return draft;
}
function generateCopy(lang, business, topic, type) {
    const isRaw = business === 'raw-sushi';
    const bizName = isRaw ? 'Raw Sushi Bar' : 'Bakudan Ramen';
    const product = isRaw ? 'sushi tươi ngon' : 'ramen đậm vị';
    const productEn = isRaw ? 'fresh sushi' : 'rich ramen';
    if (lang === 'vi') {
        if (type === 'promotion')
            return `🎉 ${topic} Special tại ${bizName}!\n\nHôm nay thưởng thức ${product} với ưu đãi đặc biệt. Đặt bàn ngay để không bỏ lỡ!\n\n📍 Stockton, CA`;
        if (type === 'announcement')
            return `📢 ${bizName} thông báo: ${topic}\n\nChi tiết xem tại website hoặc liên hệ trực tiếp với chúng tôi. Cảm ơn quý khách!`;
        return `✨ ${topic} tại ${bizName} — Stockton\n\n${product.charAt(0).toUpperCase() + product.slice(1)} được làm từ nguyên liệu tươi sạch hàng ngày. Ghé thăm chúng tôi cuối tuần này!\n\n🍣 Đặt bàn: ${isRaw ? 'rawsushibar.com' : 'bakudanramen.com'}`;
    }
    // English
    if (type === 'promotion')
        return `🎉 ${topic} Special at ${bizName}!\n\nCelebrate with ${productEn} and enjoy our special offer today. Book now!\n\n📍 Stockton, CA`;
    return `✨ ${topic} at ${bizName} — Stockton\n\nEnjoy fresh, quality ${productEn} made with daily ingredients. Visit us this weekend!\n\n🍜 Reserve: ${isRaw ? 'rawsushibar.com' : 'bakudanramen.com'}`;
}
function generateImageConcept(business, topic, type) {
    const isRaw = business === 'raw-sushi';
    if (isRaw)
        return `Close-up of premium sushi roll, bright/clean lighting, white background, fresh ingredients visible. Theme: ${topic}`;
    return `Steam rising from ramen bowl, warm lighting, dark background, vibrant colors. Theme: ${topic}`;
}
// ── Get scheduled posts ────────────────────────────────────────────────────
function getScheduledPosts(business) {
    const schedule = loadSchedule();
    return business ? schedule.filter(d => d.business === business || d.business === 'both') : schedule;
}
function getPendingApprovalPosts() {
    return loadSchedule().filter(d => d.status === 'pending_approval');
}
function getLastPost(business) {
    const posts = loadSchedule()
        .filter(d => (d.business === business || d.business === 'both') && d.status === 'approved')
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return posts[0] || null;
}
// ── Format for Mi response ────────────────────────────────────────────────
function formatContentDraftResponse(draft) {
    return [
        `📝 Content draft ready:`,
        ``,
        `**${draft.title}**`,
        `Business: ${draft.business} | Type: ${draft.type}`,
        ``,
        `[VI] ${draft.body_vi.slice(0, 150)}...`,
        `[EN] ${draft.body_en.slice(0, 150)}...`,
        ``,
        `Hashtags: ${draft.hashtags.join(' ')}`,
        `Image: ${draft.image_concept.slice(0, 80)}`,
        `Schedule: ${draft.schedule_date} at ${draft.schedule_time}`,
        ``,
        `→ Approval #${draft.approval_id} required`,
        `[✓ Approve] [✎ Edit] [✗ Reject]`,
    ].join('\n');
}
