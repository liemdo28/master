"use strict";
/**
 * Connector Router
 * Routes CEO commands to the right project connector.
 * CEO Chat → Mi-Core → Connector Router → Project Connector → Action
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectProjectTarget = detectProjectTarget;
exports.detectActionType = detectActionType;
exports.routeCommand = routeCommand;
exports.getConnectorHealthBoard = getConnectorHealthBoard;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const project_scanner_1 = require("./project-scanner");
const raw_website_connector_1 = require("./connectors/raw-website-connector");
const bakudan_website_connector_1 = require("./connectors/bakudan-website-connector");
const dashboard_connector_1 = require("./connectors/dashboard-connector");
const remote_proxy_connector_1 = require("./connectors/remote-proxy-connector");
const gate_1 = require("../approval/gate");
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
function detectProjectTarget(message) {
    const m = message.toLowerCase();
    if (/raw.*sushi|rawsushi|rawwebsite|raw.*web|raw.*site/.test(m))
        return 'raw-website';
    if (/bakudan.*web|bakudan.*site|bakudanramen\.com/.test(m))
        return 'bakudan-website';
    if (/dashboard|bakudan.*dashboard|task.*maria|create.*task/.test(m))
        return 'dashboard';
    if (/integration.?system|integration-system|sync.*system/.test(m))
        return 'integration-system';
    if (/whatsapp|zalo.*bot|chat.*bot|whatsapp.*api/.test(m))
        return 'whatsapp-api';
    if (/all.*project|tất cả.*project|scan.*project|show.*project|project.*list/.test(m))
        return 'all';
    return 'unknown';
}
function detectActionType(message) {
    const m = message.toLowerCase();
    if (/scan|phân tích|detect|tìm project/.test(m))
        return 'scan';
    if (/pull.*data|pull data|lấy data|get data|fetch/.test(m))
        return 'pull';
    if (/run.*qa|qa.*test|test.*web|kiểm tra chất lượng/.test(m))
        return 'qa';
    if (/create.*task|tạo task|task for|giao.*việc/.test(m))
        return 'task';
    if (/push|execute|apply|thực thi|deploy/.test(m))
        return 'execute';
    return 'status';
}
async function routeCommand(message, options = {}) {
    const target = detectProjectTarget(message);
    const action = detectActionType(message);
    const sources = [];
    // ── ALL PROJECTS / SCAN ──
    if (target === 'all' || action === 'scan') {
        const projects = (0, project_scanner_1.scanAllProjects)(action === 'scan');
        saveProjectRegistry(projects);
        sources.push('project-scanner');
        return {
            target, action: 'scan',
            data: { total: projects.length, projects },
            summary: formatProjectList(projects),
            sources,
        };
    }
    // ── RAW WEBSITE ──
    if (target === 'raw-website') {
        sources.push('raw-website-connector');
        if (action === 'pull') {
            const snap = (0, raw_website_connector_1.syncRawWebsite)();
            return { target, action, data: snap, summary: snap.summary_text, sources };
        }
        if (action === 'qa') {
            const qa = (0, raw_website_connector_1.runRawQA)();
            return { target, action, data: qa, summary: formatQA('Raw Website', qa), sources };
        }
        if (action === 'task') {
            // SEO post scheduling — needs approval
            const draft = { title: extractTaskTitle(message), project: 'raw-website', type: 'seo-post' };
            const approval = (0, gate_1.enqueue)({
                risk_level: 2, category: 'content', target: 'raw-website',
                description: `Schedule SEO post for Raw Sushi: "${draft.title}"`,
                rollback_plan: 'Delete drafted post',
            });
            return { target, action, data: draft, summary: `📝 SEO post drafted for Raw Sushi — chờ approval #${approval.id}`, requires_approval: true, approval_id: approval.id, sources };
        }
        // default: status
        const status = (0, raw_website_connector_1.getCachedRawWebsite)();
        if (!status) {
            const snap = (0, raw_website_connector_1.syncRawWebsite)();
            return { target, action: 'status', data: snap, summary: snap.summary_text, sources };
        }
        return { target, action: 'status', data: status, summary: status.summary_text, sources };
    }
    // ── BAKUDAN WEBSITE ──
    if (target === 'bakudan-website') {
        sources.push('bakudan-website-connector');
        if (action === 'pull') {
            const snap = await (0, bakudan_website_connector_1.syncBakudanWebsite)();
            return { target, action, data: snap, summary: snap.summary_text, sources };
        }
        if (action === 'qa') {
            await (0, bakudan_website_connector_1.syncBakudanWebsite)();
            const qa = (0, bakudan_website_connector_1.runBakudanQA)();
            return { target, action, data: qa, summary: formatQA('Bakudan Website', qa), sources };
        }
        if (action === 'execute') {
            // Price/menu change — needs approval
            const approval = (0, gate_1.enqueue)({
                risk_level: 2, category: 'content', target: 'bakudan-website',
                description: `Website change: ${message.slice(0, 100)}`,
                rollback_plan: 'git revert last commit',
            });
            return { target, action, data: {}, summary: `⚠ Change queued for approval #${approval.id}`, requires_approval: true, approval_id: approval.id, sources };
        }
        const status = (0, bakudan_website_connector_1.getCachedBakudanWebsite)() || await (0, bakudan_website_connector_1.syncBakudanWebsite)();
        return { target, action: 'status', data: status, summary: status.summary_text, sources };
    }
    // ── DASHBOARD ──
    if (target === 'dashboard') {
        sources.push('dashboard-connector');
        if (action === 'pull') {
            const snap = await (0, dashboard_connector_1.syncDashboardProject)();
            return { target, action, data: snap, summary: snap.summary_text, sources };
        }
        if (action === 'qa') {
            await (0, dashboard_connector_1.syncDashboardProject)();
            const qa = (0, dashboard_connector_1.runDashboardQA)();
            return { target, action, data: qa, summary: formatQA('Dashboard', qa), sources };
        }
        if (action === 'task') {
            const taskTitle = extractTaskTitle(message);
            const assignee = extractAssignee(message);
            const draft = (0, dashboard_connector_1.createTaskDraft)({ title: taskTitle, assignee });
            const approval = (0, gate_1.enqueue)({
                risk_level: 2, category: 'task-management', target: 'dashboard',
                description: `Create task: "${taskTitle}"${assignee ? ` → ${assignee}` : ''}`,
                rollback_plan: 'Delete task from dashboard',
            });
            return { target, action, data: draft, summary: `✅ Task draft: "${taskTitle}" — approval #${approval.id} required`, requires_approval: true, approval_id: approval.id, sources };
        }
        const status = (0, dashboard_connector_1.getCachedDashboardProject)() || await (0, dashboard_connector_1.syncDashboardProject)();
        return { target, action: 'status', data: status, summary: status.summary_text, sources };
    }
    // ── REMOTE: INTEGRATION-SYSTEM ──
    if (target === 'integration-system') {
        sources.push('remote-proxy-connector');
        if (action === 'pull') {
            const snap = await (0, remote_proxy_connector_1.syncRemoteProject)('integration-system');
            return { target, action, data: snap, summary: snap.summary_text, sources };
        }
        if (action === 'qa') {
            const result = await (0, remote_proxy_connector_1.runRemoteQA)('integration-system');
            return { target, action, data: result, summary: formatRemoteQA('Integration System', result), sources };
        }
        if (action === 'execute') {
            const approval = (0, gate_1.enqueue)({
                risk_level: 3, category: 'remote-action', target: 'integration-system',
                description: `Remote action on integration-system: ${message.slice(0, 100)}`,
                rollback_plan: 'Revert via remote agent',
            });
            return { target, action, data: {}, summary: `🔒 Remote Level-3 action — approval #${approval.id}`, requires_approval: true, approval_id: approval.id, sources };
        }
        const cached = (0, remote_proxy_connector_1.getCachedRemote)('integration-system');
        const status = cached || await (0, remote_proxy_connector_1.syncRemoteProject)('integration-system');
        return { target, action: 'status', data: status, summary: status.summary_text, sources };
    }
    // ── REMOTE: WHATSAPP-API ──
    if (target === 'whatsapp-api') {
        sources.push('remote-proxy-connector');
        if (action === 'pull') {
            const snap = await (0, remote_proxy_connector_1.syncRemoteProject)('whatsapp-api');
            return { target, action, data: snap, summary: snap.summary_text, sources };
        }
        if (action === 'qa') {
            const result = await (0, remote_proxy_connector_1.runRemoteQA)('whatsapp-api');
            return { target, action, data: result, summary: formatRemoteQA('WhatsApp API', result), sources };
        }
        const cached = (0, remote_proxy_connector_1.getCachedRemote)('whatsapp-api');
        const status = cached || await (0, remote_proxy_connector_1.syncRemoteProject)('whatsapp-api');
        return { target, action: 'status', data: status, summary: status.summary_text, sources };
    }
    // ── UNKNOWN — try project scanner ──
    const project = (0, project_scanner_1.getProjectById)(message.split(' ').find(w => w.length > 3) || '');
    if (project) {
        return { target: 'unknown', action: 'status', data: project, summary: formatSingleProject(project), sources: ['project-scanner'] };
    }
    return {
        target: 'unknown', action: 'status', data: null,
        summary: `Mi không nhận dạng được project trong lệnh: "${message}"\nThử: "Check Raw website", "Check Dashboard", "Scan all projects"`,
        sources: [],
    };
}
// ── Connector Health Board ────────────────────────────────────────────────────
async function getConnectorHealthBoard() {
    const [remoteStatuses, rawSnap, bakudanSnap, dashSnap] = await Promise.all([
        (0, remote_proxy_connector_1.getAllRemoteStatuses)(),
        Promise.resolve((0, raw_website_connector_1.getCachedRawWebsite)()),
        Promise.resolve((0, bakudan_website_connector_1.getCachedBakudanWebsite)()),
        Promise.resolve((0, dashboard_connector_1.getCachedDashboardProject)()),
    ]);
    const lines = ['🔌 CONNECTOR HEALTH BOARD', ''];
    lines.push('LOCAL CONNECTORS:');
    lines.push(`  Raw Website:    ${rawSnap ? (rawSnap.git_dirty ? '⚠ dirty' : '✓ synced') : '○ not synced'}`);
    lines.push(`  Bakudan Web:    ${bakudanSnap ? (bakudanSnap.server_live ? '✓ live' : '⚠ server down') : '○ not synced'}`);
    lines.push(`  Dashboard:      ${dashSnap ? (dashSnap.api_live ? '✓ API live' : '⚠ API down') : '○ not synced'}`);
    lines.push('');
    lines.push('REMOTE CONNECTORS:');
    for (const rs of remoteStatuses) {
        const icon = rs.reachable ? '✓' : (rs.error?.includes('not configured') ? '○' : '✗');
        lines.push(`  ${rs.name.padEnd(20)} ${icon} ${rs.reachable ? rs.host : (rs.error || 'unreachable')}`);
    }
    return lines.join('\n');
}
// ── Helpers ───────────────────────────────────────────────────────────────────
function formatProjectList(projects) {
    const local = projects.filter(p => p.location === 'local');
    const remote = projects.filter(p => p.location === 'remote');
    const dirty = projects.filter(p => p.git_dirty);
    const lines = [`📦 Master Workspace — ${projects.length} projects`];
    lines.push('');
    lines.push('LOCAL:');
    for (const p of local.slice(0, 20)) {
        lines.push(`  ${p.name.padEnd(35)} [${p.framework}] ${p.git_dirty ? '⚠ dirty' : ''}`);
    }
    if (remote.length) {
        lines.push('');
        lines.push('REMOTE:');
        for (const p of remote)
            lines.push(`  ${p.name.padEnd(35)} [${p.machine}]`);
    }
    if (dirty.length) {
        lines.push('');
        lines.push(`⚠ Uncommitted changes: ${dirty.map(p => p.name).join(', ')}`);
    }
    return lines.join('\n');
}
function formatSingleProject(p) {
    return [
        `📁 ${p.name}`,
        `  Path: ${p.relative_path}`,
        `  Type: ${p.type} | Framework: ${p.framework}`,
        `  Git: ${p.git_branch} ${p.git_dirty ? '(dirty)' : '(clean)'}`,
        `  Start: ${p.start_cmd || 'none'}`,
        `  Location: ${p.location} (${p.machine})`,
    ].join('\n');
}
function formatQA(name, qa) {
    const lines = [`🧪 QA: ${name} — Score: ${qa.score}%`];
    if (qa.passed.length)
        lines.push('  ✓ ' + qa.passed.join('\n  ✓ '));
    if (qa.issues.length)
        lines.push('  ✗ ' + qa.issues.join('\n  ✗ '));
    return lines.join('\n');
}
function formatRemoteQA(name, result) {
    if (!result || typeof result !== 'object')
        return `🧪 QA ${name}: No result`;
    const r = result;
    if (r.error)
        return `🧪 QA ${name}: ✗ ${r.error}`;
    return `🧪 QA ${name}: ${r.passed ? '✓ Passed' : '✗ Failed'} — ${r.message || JSON.stringify(r).slice(0, 200)}`;
}
function extractTaskTitle(message) {
    const match = message.match(/task[:\s]+["']?(.+?)["']?$|tạo task[:\s]+(.+?)$/i);
    return (match?.[1] || match?.[2] || message).trim().slice(0, 100);
}
function extractAssignee(message) {
    const match = message.match(/for\s+([A-Za-z]+)|cho\s+([A-Za-z]+)|giao.*cho\s+([A-Za-z]+)/i);
    return match?.[1] || match?.[2] || match?.[3] || '';
}
function saveProjectRegistry(projects) {
    const registryPath = path_1.default.join(GLOBAL_DIR, 'mi-core', 'project-connectors.json');
    const existing = fs_1.default.existsSync(registryPath)
        ? JSON.parse(fs_1.default.readFileSync(registryPath, 'utf-8'))
        : { connectors: [] };
    // Merge scanned projects with existing connector configs
    const connectors = projects.map(p => ({
        project_id: p.project_id,
        name: p.name,
        path: p.path,
        location_type: p.location,
        machine_name: p.machine,
        host: p.location === 'remote' ? '' : 'localhost',
        port: p.ports[0] || null,
        connector_url: p.health_url,
        auth_status: 'connected',
        read_status: 'enabled',
        write_status: 'requires_approval',
        health_status: 'unknown',
        last_sync: new Date().toISOString(),
        approval_required: p.location === 'remote' || ['deploy', 'production'].some(k => p.name.includes(k)),
    }));
    const outRegistry = { updated_at: new Date().toISOString(), total: connectors.length, connectors };
    fs_1.default.writeFileSync(registryPath, JSON.stringify(outRegistry, null, 2));
}
