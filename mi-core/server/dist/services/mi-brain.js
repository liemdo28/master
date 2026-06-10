"use strict";
/**
 * Mi's personality + intent engine.
 * Parses owner commands, builds context, returns structured intent.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIntent = parseIntent;
exports.buildSystemPrompt = buildSystemPrompt;
exports.buildMessages = buildMessages;
const owner_profile_1 = require("./owner-profile");
// Detect intent from Vietnamese/English natural language
function parseIntent(text) {
    const t = text.toLowerCase().trim();
    const raw = text;
    // Reminder commands — check before memory to avoid overlap
    if (/nhắc|remind/i.test(t) && /sau|mỗi|lúc|every|after|in\s+\d|at\s+\d/i.test(t)) {
        return { type: 'reminder', mode: 'health', raw };
    }
    // Memory commands
    if (/mi[,\s]+nhớ|remember this|mi[,\s]+lưu/i.test(t)) {
        return { type: 'memory_save', mode: 'personal', raw };
    }
    if (/mi[,\s]+quên|mi[,\s]+xóa|forget this|delete.*info/i.test(t)) {
        const isHealth = /sức khỏe|health|y tế/i.test(t);
        return { type: 'memory_forget', mode: 'personal', raw, memoryCategory: isHealth ? 'health' : 'preferences' };
    }
    // Visibility commands — universal platform queries
    if (/hôm nay.*cần.*làm|what.*do today|should.*do today|today.*agenda/i.test(t)) {
        return { type: 'visibility_daily', mode: 'ceo', raw };
    }
    if (/task.*overdue|overdue.*task|task.*nào.*quá hạn|quá hạn/i.test(t)) {
        return { type: 'visibility_overdue', mode: 'ceo', raw };
    }
    if (/email.*quan trọng|important.*email|gmail.*important|inbox/i.test(t)) {
        return { type: 'visibility_email', mode: 'ceo', raw };
    }
    if (/calendar|lịch.*hôm nay|sự kiện.*hôm nay|meeting|today.*event/i.test(t)) {
        return { type: 'visibility_calendar', mode: 'ceo', raw };
    }
    if (/dashboard.*task|task.*dashboard|bakudan.*task|pending.*task/i.test(t)) {
        return { type: 'visibility_dashboard', mode: 'restaurant', raw };
    }
    if (/health.*check|check.*health|bước chân|steps|sleep/i.test(t)) {
        return { type: 'visibility_health', mode: 'health', raw };
    }
    if (/connector.*status|health.*check|check.*connector|platform.*health/i.test(t)) {
        return { type: 'visibility_connector_status', mode: 'developer', raw };
    }
    // Workspace commands
    if (/hôm nay.*làm gì|nên làm gì|daily briefing|briefing|what.*do today/i.test(t)) {
        return { type: 'briefing', mode: 'ceo', raw };
    }
    if (/project.*lỗi|project.*vấn đề|project.*issue|which.*project.*broken|lỗi.*project/i.test(t)) {
        return { type: 'project_issues', mode: 'developer', raw };
    }
    if (/tìm.*project|find.*project|search.*project|tìm\s+(\w+)/i.test(t)) {
        const match = t.match(/tìm\s+(.+)|find\s+(.+)|search\s+(.+)/i);
        const searchQuery = match ? (match[1] || match[2] || match[3]).trim() : t;
        return { type: 'project_search', mode: 'developer', raw, searchQuery };
    }
    if (/approval.*pending|cần approve|pending.*approval|chờ.*duyệt/i.test(t)) {
        return { type: 'pending_approvals', mode: 'ceo', raw };
    }
    // Profile view
    if (/cho.*xem profile|view.*profile|mi.*profile|show.*profile/i.test(t)) {
        return { type: 'profile_view', mode: 'personal', raw };
    }
    if (/sức khỏe|health.*profile|health.*info/i.test(t)) {
        return { type: 'health_view', mode: 'personal', raw };
    }
    // Detect mode
    let mode = 'personal';
    if (/doanh thu|tài chính|finance|revenue|profit|invoice|quickbooks/i.test(t))
        mode = 'finance';
    else if (/project|bug|fix|deploy|code|github|git|dev|build/i.test(t))
        mode = 'developer';
    else if (/ceo|chiến lược|strategy|executive|board|report|weekly/i.test(t))
        mode = 'ceo';
    else if (/rawsushi|bakudan|menu|restaurant|nhà hàng|kitchen|order/i.test(t))
        mode = 'restaurant';
    else if (/sức khỏe|uống nước|nghỉ ngơi|sleep|health|workout|vitamin/i.test(t))
        mode = 'health';
    else if (/khẩn cấp|urgent|emergency|down|crash|incident/i.test(t))
        mode = 'emergency';
    return { type: 'chat', mode, raw };
}
// Build system prompt based on mode + owner profile
function buildSystemPrompt(mode) {
    const profile = owner_profile_1.ownerProfile.getAll();
    const name = profile.profile?.preferred_name || 'anh';
    const lang = profile.preferences?.language || 'vi';
    const responseStyle = profile.preferences?.response_style || 'short, clear, actionable';
    const base = `Bạn là Mi — Executive Assistant thông minh và đáng tin cậy của ${name}.

Nguyên tắc:
- Trả lời bằng tiếng Việt tự nhiên, ấm áp, tôn trọng, xưng "em"
- Câu trả lời ngắn gọn, rõ ràng, có action cụ thể theo style: ${responseStyle}
- Nếu owner hỏi bằng tiếng Anh, trả lời tiếng Anh
- KHÔNG trả lời như chatbot generic — luôn biết owner là ai, đang làm gì
- KHÔNG thực thi hành động rủi ro mà không có approval
- Nếu không chắc intent, hỏi lại ngắn gọn

Profile tóm tắt: ${JSON.stringify(profile.profile)}
Work style: ${JSON.stringify(profile.work_style)}`;
    const modeContexts = {
        ceo: '\nMode: CEO — Tập trung chiến lược, priorities, executive decisions, báo cáo tổng quan.',
        developer: '\nMode: Developer — Tập trung code, bugs, projects, deployment, technical decisions.',
        personal: '\nMode: Personal Assistant — Hỗ trợ daily life, reminders, preferences, personal tasks.',
        restaurant: '\nMode: Restaurant Ops — Tập trung Raw Sushi Bar, Bakudan Ramen, menu, operations, staff.',
        finance: '\nMode: Finance — Tập trung doanh thu, chi phí, QuickBooks, financial reporting.',
        health: '\nMode: Health — Nhắc nhở sức khỏe, uống nước, nghỉ ngơi. KHÔNG chẩn đoán bệnh — chỉ general wellness.',
        focus: '\nMode: Focus — Giảm thiểu distraction, tập trung vào 1 task duy nhất.',
        emergency: '\nMode: Emergency — Xử lý khẩn cấp, incident response, critical issues first.',
    };
    return base + (modeContexts[mode] || '');
}
// Format conversation history for AI context
function buildMessages(systemPrompt, history, userMessage) {
    const messages = [{ role: 'system', content: systemPrompt }];
    // Keep last 10 turns for context
    const recentHistory = history.slice(-10);
    for (const h of recentHistory) {
        messages.push({ role: h.role, content: h.content });
    }
    messages.push({ role: 'user', content: userMessage });
    return messages;
}
