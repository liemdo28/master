"use strict";
/**
 * Mi Response Pipeline — Jarvis-style Executive Assistant
 *
 * CEO message
 * → [ALWAYS] Full executive context (owner + business + holiday + workflows)
 * → [SMART] Live data pulled only when relevant (calendar, email, projects, etc.)
 * → [REASON] Executive reasoning chain built for the query type
 * → AI response with full context → acts like a real assistant, not a chatbot
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPipeline = runPipeline;
const executive_memory_1 = require("../memory/executive-memory");
const knowledge_db_1 = require("../knowledge/knowledge-db");
const visibility_hub_1 = require("../visibility/visibility-hub");
const health_connector_1 = require("../visibility/connectors/health/health-connector");
const accounting_connector_1 = require("../visibility/connectors/accounting-connector");
const connector_router_1 = require("../projects/connector-router");
const executive_context_1 = require("../intelligence/executive-context");
const holiday_engine_1 = require("../intelligence/holiday-engine");
const index_1 = require("../knowledge-federation/index");
const platform_health_1 = require("../visibility/platform-health");
const task_manager_1 = require("../projects/task-manager");
const content_scheduler_1 = require("../projects/content-scheduler");
const ai_client_1 = require("../services/ai-client");
const gate_1 = require("../approval/gate");
const intent_classifier_1 = require("../brain/intent-classifier");
const brain_router_1 = require("../brain/brain-router");
const compliance_retrieval_1 = require("../knowledge/compliance-retrieval");
const daily_work_actions_1 = require("../actions/daily-work-actions");
const response_scrubber_1 = require("../middleware/response-scrubber");
const latency_monitor_1 = require("../operations/latency-monitor");
const store_context_1 = require("../memory2/store-context");
const file_search_1 = require("../actions/file-search");
const data_analyst_handler_1 = require("../actions/data-analyst-handler");
// ── Asset Registry Direct Handler (Phase 14 fix) ─────────────────────────────
function isAssetQuery(msg) {
    const t = msg.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/đ/gi, 'd').replace(/[^a-z0-9\s?!]/g, ' ');
    // Project list queries
    if (/\b(project\s*(nao|gi|dao|co\s*gi|la\s*gi|hien\s*tai|list|nhe)|danh\s*sach\s*project|du\s*an\s*(nao|hien|co)|list\s*project|cac\s*project)\b/.test(t))
        return 'projects';
    // Service health queries
    if (/\b(service\s*(nao|gi|down|dang\s*down|bi\s*down|loi|loi|mat)|dich\s*vu\s*(nao|down|bi)|which\s*service|service.*healthy|service.*ok)\b/.test(t))
        return 'services';
    // Ownership queries
    if (/\b(thuoc\s*(phong|bo\s*phan|team)|phu\s*trach\s*(boi|la)|quan\s*ly\s*boi|owner|ai\s*lam\s*chu)\b/.test(t))
        return 'ownership';
    // Source/data health
    if (/\b(toast|quickbooks|doordash|food.?safe|data\s*source|nguon\s*du\s*lieu).*(healthy|ok|loi|status|tinh\s*trang)\b/.test(t) ||
        /\b(healthy|ok|loi|status)\b.*\b(toast|quickbooks|doordash)\b/.test(t))
        return 'source_health';
    return null;
}
async function tryAnswerAssetQuery(message) {
    const queryType = isAssetQuery(message);
    if (!queryType)
        return null;
    try {
        // Use direct module import — avoids self-referential HTTP + auth complexity
        const { PROJECTS, getActiveProjects, getCriticalProjects } = require('../company-os/project-registry');
        const { SERVICES, checkAllServicesHealth } = require('../company-os/service-registry');
        const { DATA_SOURCES } = require('../company-os/data-source-registry');
        if (queryType === 'projects') {
            const active = getActiveProjects();
            const critical = getCriticalProjects();
            const nonCritical = active.filter((p) => p.criticality !== 'CRITICAL');
            const lines = [
                `📋 *Company Projects (${active.length} active / ${PROJECTS.length} total)*`,
                '',
                '*🔴 Critical:*',
                ...critical.map((p) => `• ${p.name} — ${p.owner_dept}`),
                '',
                '*📦 Active:*',
                ...nonCritical.slice(0, 15).map((p) => `• ${p.name}`),
            ];
            return lines.join('\n');
        }
        if (queryType === 'services') {
            const results = await checkAllServicesHealth();
            const down = results.filter(r => !r.healthy);
            const up = results.filter(r => r.healthy);
            const lines = [
                `🔍 *Service Health (${up.length}/${results.length} healthy)*`,
                '',
            ];
            if (down.length === 0) {
                lines.push('✅ Tất cả services đang online.');
            }
            else {
                lines.push('*🔴 Down:*');
                down.forEach((s) => lines.push(`• ${s.name} — ${s.error || 'unreachable'}`));
            }
            if (up.length) {
                lines.push('', '*✅ Online:*');
                up.forEach((s) => lines.push(`• ${s.name}`));
            }
            return lines.join('\n');
        }
        if (queryType === 'ownership') {
            const msg_lower = message.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd');
            const allProjects = PROJECTS;
            const match = allProjects.find(p => msg_lower.includes(p.id.toLowerCase()) ||
                p.name.toLowerCase().split(/\s+/).some((word) => word.length > 3 && msg_lower.includes(word)));
            if (match) {
                return `🏢 *${match.name}*\nDept: ${match.owner_dept}\nMục đích: ${match.business_purpose}`;
            }
            const lines = ['🏢 *Department Ownership*', ''];
            allProjects.filter(p => p.owner_dept && p.owner_dept !== 'unknown').slice(0, 12).forEach(p => {
                lines.push(`• ${p.name} → ${p.owner_dept}`);
            });
            return lines.join('\n');
        }
        if (queryType === 'source_health') {
            const msg_norm = message.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd');
            const allSources = DATA_SOURCES;
            const specific = allSources.find(s => msg_norm.includes(s.id.toLowerCase()) ||
                s.name.toLowerCase().split(/\s+/).some((w) => w.length > 3 && msg_norm.includes(w)));
            if (specific) {
                const h = specific.health ?? specific.last_known_health ?? 'unknown';
                const icon = h === 'healthy' ? '✅' : h === 'degraded' ? '⚠️' : '❓';
                return `${icon} *${specific.name}*\nStatus: ${h}\nCredentials: ${specific.credential_status}`;
            }
            const lines = ['📡 *Data Source Health*', ''];
            allSources.forEach(s => {
                const h = s.health ?? s.last_known_health ?? 'unknown';
                const icon = h === 'healthy' ? '✅' : h === 'degraded' ? '⚠️' : '❓';
                lines.push(`${icon} ${s.name} — ${h}`);
            });
            return lines.join('\n');
        }
    }
    catch (e) {
        console.error('[AssetQuery] Error:', e instanceof Error ? e.message : String(e));
    }
    return null;
}
async function runPipeline(input) {
    const { message, mode, history } = input;
    const sources = ['executive-brain', 'holiday-engine'];
    const liveDataParts = []; // live data fetched this request
    let kbHits = 0;
    let extraContext = '';
    // ── 0. Brain Router — classify intent, select optimal brain ─────────────
    const classifiedIntent = (0, intent_classifier_1.classifyIntent)(message);
    const brainConfig = (0, brain_router_1.selectBrainConfig)(classifiedIntent);
    console.log(`[Mi Brain] domain=${classifiedIntent.domain} brain=${brainConfig.brain} model=${brainConfig.model} confidence=${classifiedIntent.confidence.toFixed(2)}`);
    // ── 0a. Asset Registry — direct answer, no LLM ───────────────────────────
    const assetQueryReply = await tryAnswerAssetQuery(message);
    if (assetQueryReply) {
        return { reply: assetQueryReply, model: 'asset-registry', sources: ['company-asset-registry'], memory_context: '', kb_hits: 0 };
    }
    // ── 0b. Data Analyst — intercept before AI ────────────────────────────────
    if ((0, data_analyst_handler_1.isDataAnalystMessage)(message)) {
        const directAnswer = (0, data_analyst_handler_1.handleDataAnalystMessage)(message);
        if (directAnswer) {
            return { reply: directAnswer, model: 'data-analyst', sources: ['data-analyst'], memory_context: '', kb_hits: 0 };
        }
        // Inject data analyst context into AI prompt
        const { contextLine } = (0, data_analyst_handler_1.buildDataAnalystRouteContext)(message);
        extraContext = contextLine;
    }
    // ── 0. Daily Work Actions — intercept before AI ──────────────────────────
    // Handles: file search, find+send, create meeting, upload Drive, store queries
    if ((0, daily_work_actions_1.isDailyWorkAction)(message)) {
        const actionResult = await (0, daily_work_actions_1.handleDailyWorkAction)(message);
        if (actionResult) {
            // Inject context into sources
            const reply = actionResult.reply;
            const srcs = [...actionResult.sources];
            // Still let AI enrich the response with store/people context
            const store = (0, store_context_1.resolveStore)(message);
            const person = (0, store_context_1.resolvePerson)(message);
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
    const reasoningTypes = (0, executive_context_1.detectReasoningType)(message);
    // ── 2. Executive Memory — relevant snippets ──
    const memContext = executive_memory_1.executiveMemory.getRelevantMemoryForMessage(message);
    // ── 3. Knowledge DB ──
    const kbResults = (0, knowledge_db_1.search)(message, 5);
    if (kbResults.length > 0) {
        const kbSection = kbResults.map(r => `Source: ${r.source} | ${r.title}\n${r.snippet}`).join('\n---\n');
        liveDataParts.push(`[Knowledge DB — ${kbResults.length} hits]\n${kbSection}`);
        sources.push('knowledge-db');
        kbHits = kbResults.length;
    }
    // ── 3b. US Compliance DB — WS4 ───────────────────────────────────────────
    if (classifiedIntent.requires_compliance_db && (0, compliance_retrieval_1.isComplianceDBAvailable)()) {
        try {
            const compResults = (0, compliance_retrieval_1.searchCompliance)(message, {
                limit: 3,
                jurisdiction: classifiedIntent.jurisdiction,
                min_score: 0.04,
            });
            if (compResults.length > 0) {
                liveDataParts.push((0, compliance_retrieval_1.formatComplianceContext)(compResults, message));
                sources.push('us-compliance-db');
                console.log(`[Mi Compliance] ${compResults.length} docs found for: "${message.slice(0, 60)}"`);
            }
        }
        catch (e) {
            console.warn('[Mi] Compliance DB search error:', e);
        }
    }
    // ── 4. Executive Reasoning Chain ──
    if (reasoningTypes.some(t => ['holiday_business_impact', 'marketing_action', 'content_reference', 'scheduling'].includes(t))) {
        const actionPlan = (0, executive_context_1.buildActionPlan)(message, reasoningTypes);
        if (actionPlan) {
            liveDataParts.push(`[Executive Reasoning]\n${actionPlan}`);
            sources.push('reasoning-engine');
        }
    }
    // ── 4b. Knowledge Federation — unified search ──
    const fedCtx = (0, index_1.getFederatedContext)(message, 1200);
    if (fedCtx) {
        liveDataParts.push(fedCtx);
        sources.push('knowledge-federation');
    }
    // ── 4b2. Store + People context from federated memory ──
    const storeCtx = (0, store_context_1.resolveStore)(message);
    if (storeCtx) {
        liveDataParts.push(`[Store Context]\n${storeCtx.name} | ${storeCtx.city}, ${storeCtx.state} | ${storeCtx.website}\nManager: ${storeCtx.manager} | Timezone: ${storeCtx.timezone}\nCompliance: ${storeCtx.compliance_jurisdiction} | Best post: ${storeCtx.best_post_time}`);
        sources.push('store-memory');
    }
    const personCtx = (0, store_context_1.resolvePerson)(message);
    if (personCtx) {
        liveDataParts.push(`[Person Context]\n${personCtx.name} — ${personCtx.role}\nStores: ${personCtx.stores.join(', ')}`);
        sources.push('people-memory');
    }
    // ── 4b3. Local file search for relevant queries ──
    if (/tìm|find|search|report|file|báo cáo|payroll|invoice/i.test(message) &&
        !/tìm task|find task|tìm project/i.test(message)) {
        const fileHits = (0, file_search_1.searchLocalFiles)(message, 3);
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
            const healthText = await (0, platform_health_1.getPlatformHealthText)();
            liveDataParts.push(healthText);
            sources.push('platform-health');
        }
        catch { /* non-blocking */ }
    }
    // ── 4d. Task creation — direct action ──
    if (/^(create|tạo|giao|add)\s+(task|việc)/i.test(message.trim())) {
        const parsed = (0, task_manager_1.parseTaskFromMessage)(message);
        const draft = (0, task_manager_1.createTaskDraft)(parsed);
        liveDataParts.push(`[Task Draft Created]\n${(0, task_manager_1.formatTaskDraftResponse)(draft)}`);
        sources.push('task-manager');
    }
    // ── 4e. Content scheduling — direct action ──
    if (/lên lịch.*post|schedule.*post|đăng.*sáng mai|post.*tomorrow|tạo.*content|draft.*post/i.test(message)) {
        const isRaw = /raw|sushi/i.test(message);
        const isBakudan = /bakudan|ramen/i.test(message);
        const business = isRaw ? 'raw-sushi' : (isBakudan ? 'bakudan' : 'raw-sushi');
        const isSimilar = /tương tự|similar|như lần trước|last post/i.test(message);
        const lastPost = isSimilar ? (0, content_scheduler_1.getLastPost)(business) : null;
        const draft = (0, content_scheduler_1.draftContent)({
            business,
            type: /seo/i.test(message) ? 'seo-article' : 'social-post',
            reference_post: lastPost?.id,
            schedule_date: (() => {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                return d.toISOString().split('T')[0];
            })(),
        });
        liveDataParts.push(`[Content Draft Created]\n${(0, content_scheduler_1.formatContentDraftResponse)(draft)}`);
        sources.push('content-scheduler');
    }
    // ── 5. Daily Brief / Visibility snapshot ──
    const needsBrief = reasoningTypes.includes('daily_brief') ||
        /hôm nay|today|tình hình|snapshot|briefing|tóm tắt.*ngày|morning/i.test(message);
    if (needsBrief) {
        try {
            const snapshot = await (0, visibility_hub_1.getDailySnapshot)();
            const visLines = [
                `📅 ${snapshot.date}`,
                snapshot.emails.unread !== undefined
                    ? `📧 Gmail: ${snapshot.emails.unread} unread, ${snapshot.emails.important} important`
                    : `📧 Gmail: ${snapshot.emails.status}`,
                snapshot.calendar.today_count !== undefined
                    ? `📆 Calendar: ${snapshot.calendar.today_count} events today${snapshot.calendar.events_today?.length ? ' → ' + snapshot.calendar.events_today.map((e) => e.title).join(', ') : ''}`
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
        }
        catch { /* non-blocking */ }
    }
    // ── 6. Live holiday context (for specific holiday queries) ──
    if (/holiday|lễ|ngày lễ|event.*week|tuần.*có.*gì|stockton.*có/i.test(message)) {
        const holidayCtx = (0, holiday_engine_1.getHolidayContextString)();
        liveDataParts.push(`[Holiday + Local Events — Stockton CA]\n${holidayCtx}`);
        sources.push('holiday-engine-detailed');
    }
    // ── 7. Project connector query ──
    const projectTarget = (0, connector_router_1.detectProjectTarget)(message);
    if (projectTarget !== 'unknown') {
        try {
            const result = await (0, connector_router_1.routeCommand)(message);
            if (result.summary) {
                liveDataParts.push(`[Project: ${result.target}]\n${result.summary}`);
                sources.push(...result.sources);
                if (result.requires_approval) {
                    liveDataParts.push(`[→ Approval Required: ID ${result.approval_id}]`);
                }
            }
        }
        catch { /* non-blocking */ }
    }
    // ── 8. Restaurant ops ──
    if (reasoningTypes.includes('restaurant_ops') || /dashboard|doanh thu|order|nhà hàng.*hôm|reservation/i.test(message)) {
        try {
            const result = await (0, connector_router_1.routeCommand)('Check Dashboard');
            if (result.summary) {
                liveDataParts.push(`[Dashboard / Restaurant Ops]\n${result.summary}`);
                sources.push('dashboard-connector');
            }
        }
        catch { /* non-blocking */ }
    }
    // ── 9. Person task query ──
    const personMatch = message.match(/(?:maria|hoang|nguyen)\s+(?:còn|có|task|công việc)/i) ||
        message.match(/task.*(?:của|for)\s+([\w]+)/i);
    if (personMatch) {
        const name = (personMatch[1] || personMatch[0].split(/\s/)[0]).toLowerCase();
        const tasks = (0, visibility_hub_1.getTasksForPerson_)(name);
        if (tasks.asana.length > 0) {
            liveDataParts.push(`[Tasks for ${name}]\n${tasks.asana.map((t) => `• ${t.name} (${t.is_overdue ? 'OVERDUE' : 'due ' + (t.due_on || 'no date')})`).join('\n')}`);
            sources.push('asana');
        }
    }
    // ── 10. Health ──
    if (/sức khỏe|bước chân|steps|sleep|ngủ|tim|heart rate/i.test(message)) {
        if ((0, health_connector_1.hasHealthExport)()) {
            liveDataParts.push(`[Health]\n${(0, health_connector_1.getHealthSummaryText)()}`);
            sources.push('health-export');
        }
    }
    // ── 11. Accounting ──
    if (/kế toán|accounting|ledger|chi phí|cost/i.test(message)) {
        liveDataParts.push(`[Accounting]\n${(0, accounting_connector_1.getAccountingSummaryText)()}`);
        sources.push('accounting-engine');
    }
    // ── 12. Email / Calendar live ──
    if (/email|gmail|thư.*quan trọng/i.test(message)) {
        const emails = (0, visibility_hub_1.getImportantEmailsAll)(5);
        if (emails.gmail.length > 0) {
            liveDataParts.push(`[Gmail — Important]\n${emails.gmail.map((e) => `• ${e.subject} — ${e.from}`).join('\n')}`);
            sources.push('gmail');
        }
    }
    if (/calendar|lịch|meeting|cuộc họp/i.test(message)) {
        const events = (0, visibility_hub_1.getTodayEventsAll)();
        if (events.calendar.length > 0) {
            liveDataParts.push(`[Calendar Today]\n${events.calendar.map((e) => `• ${e.title} @ ${new Date(e.start).toLocaleTimeString('vi-VN')}`).join('\n')}`);
            sources.push('google-calendar');
        }
    }
    // ── 13. Pending approvals ──
    const pending = (0, gate_1.getPending)();
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
        const projectHits = (0, visibility_hub_1.searchProjects)(q);
        if (projectHits.length > 0) {
            liveDataParts.push(`[Project Search: "${q}"]\n${projectHits.slice(0, 5).map((p) => `${p.name} (${p.type}) — ${p.path}`).join('\n')}`);
        }
    }
    // ── 15b. Company Asset Registry — Phase 6 ──
    if (/company.*project|du an cong ty|service.*down|department.*own|source.*health|project.*owner|company.*asset|list.*project|agent.*project/i.test(message)) {
        try {
            const MI_PORT = process.env.MI_PORT || '4001';
            const apiKey = process.env.MI_CORE_API_KEY || '';
            const assetRes = await fetch(`http://localhost:${MI_PORT}/api/company-os/assets`, {
                headers: { 'x-api-key': apiKey, 'x-mi-auth': apiKey },
                signal: AbortSignal.timeout(5000),
            });
            if (assetRes.ok) {
                const asset = await assetRes.json();
                const summary = asset.summary;
                const parts = [
                    `Departments: ${asset.departments?.active ?? '?'}/${asset.departments?.total ?? '?'} active`,
                    `Projects: ${asset.projects?.active ?? '?'} active, ${asset.projects?.critical ?? '?'} critical`,
                    `Services: ${asset.services?.total ?? '?'} total (${asset.services?.pm2 ?? '?'} PM2)`,
                    summary?.projects ? `Projects: ${summary.projects}` : '',
                    summary?.services ? `Services: ${summary.services}` : '',
                ].filter(Boolean).join('\n');
                liveDataParts.push(`[Company Asset Registry]\n${parts}`);
                sources.push('company-asset-registry');
            }
        }
        catch { /* non-blocking */ }
    }
    // ── 16. Build full system prompt (always includes exec brain) ──
    const systemPrompt = (0, executive_context_1.buildSystemPrompt)(liveDataParts);
    // ── P0-3 Gate-First: scrub secrets from LLM context BEFORE sending to model ──
    const safeSystemPrompt = (0, response_scrubber_1.scrubReply)(systemPrompt, 'llm_context_system');
    // ── 17. Build messages ──
    const messages = [{ role: 'system', content: safeSystemPrompt }];
    for (const h of history.slice(-8))
        messages.push({ role: h.role, content: h.content });
    messages.push({ role: 'user', content: (0, response_scrubber_1.scrubReply)(message, 'llm_context_user') });
    // ── 18. AI call — use brain-router-selected model ──
    const _aiT0 = Date.now();
    const aiRes = await (0, ai_client_1.askAiWithBrain)(messages, brainConfig);
    (0, latency_monitor_1.recordLatency)('ai_inference', Date.now() - _aiT0, 'response_pipeline');
    return { reply: aiRes.text, model: `${brainConfig.brain}/${aiRes.model}`, sources, memory_context: memContext, kb_hits: kbHits };
}
