/**
 * WhatsApp Action Router — Jarvis build
 * Handles all NaturalRoute intents. Never says "Use /agent".
 */
import { styleReply, shortJson, statusWord, greetingReply, clarifyReply, approvalReply } from './ceo-response-style';
import { NaturalRoute } from './natural-intent-router';
import { addMute, addWatch } from '../jarvis/ceo-preference-store';
import { generateExecutiveBriefing } from '../intelligence/executive-briefing';
import { generateApprovalSummary } from '../intelligence/approval-center';
import { formatStoreIntelligenceReport } from '../intelligence/store-intelligence';
import { formatActionItemSummary } from '../intelligence/action-item-extractor';
import { getConnectorHealthBoard, routeCommand } from '../projects/connector-router';

export interface ActionRouterResult {
  reply: string;
  approval_required: boolean;
  approval_id: string | null;
  metadata?: Record<string, unknown>;
}

const PORT = process.env.MI_PORT || 4001;

async function getJson(path: string, timeoutMs = 7000): Promise<any> {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
    const text = await res.text();
    try { return text ? JSON.parse(text) : {}; } catch { return { raw: text, status: res.status }; }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

function projectLabel(projectId?: string): string {
  const map: Record<string, string> = {
    'whatsapp-ai-gateway': 'WhatsApp gateway',
    'doordash-compaigns': 'DoorDash',
    'integration-system': 'Integration agent',
    'review-automation': 'Review Automation',
  };
  return map[projectId || ''] || projectId || 'project';
}

// Direct probe for known services when node agent isn't registered
const KNOWN_DIRECT_ENDPOINTS: Record<string, string> = {
  'whatsapp-ai-gateway': 'http://localhost:3211/api/health',
  'doordash-compaigns': 'http://localhost:3211/api/health', // best-effort
};

async function probeDirect(projectId: string): Promise<{ ok: boolean; status: string; detail?: string }> {
  const url = KNOWN_DIRECT_ENDPOINTS[projectId || ''];
  if (!url) return { ok: false, status: 'unknown', detail: 'No direct probe configured' };
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const d: any = await r.json();
      return { ok: true, status: 'online', detail: d.name || d.version || 'running' };
    }
    return { ok: false, status: 'error', detail: `HTTP ${r.status}` };
  } catch {
    return { ok: false, status: 'offline', detail: 'Connection refused' };
  }
}

async function projectStatus(route: NaturalRoute): Promise<ActionRouterResult> {
  const data = await getJson(`/api/nodes/${route.target || 'laptop1'}/projects/${route.projectId}/status`);
  // If node agent not registered, probe the service directly
  if (data?.error === 'NODE_NOT_FOUND' || data?.error === 'AGENT_OFFLINE') {
    const direct = await probeDirect(route.projectId || '');
    const icon = direct.ok ? '✅' : '🔴';
    return {
      approval_required: false, approval_id: null,
      reply: `${icon} *${projectLabel(route.projectId)}*: ${direct.status}.\n${direct.detail || ''}\n_(Node agent offline — kết quả từ direct probe)_`,
      metadata: { direct_probe: direct },
    };
  }
  const s = statusWord(data);
  const icon = /healthy|online|running|ok/i.test(s) ? '✅' : /error|offline|down/i.test(s) ? '🔴' : '🟡';
  return {
    approval_required: false, approval_id: null,
    reply: styleReply([
      `${icon} *${projectLabel(route.projectId)}*: ${s}.`,
      data.url ? `URL: ${data.url}` : '',
      data.error ? `Lỗi: ${data.error}` : '',
    ], 'status'),
    metadata: { project: route.projectId, status: s },
  };
}

export async function routeAssistantAction(route: NaturalRoute, _originalMessage: string): Promise<ActionRouterResult> {
  switch (route.intent) {

    // ── Social ──────────────────────────────────────────────────────────────

    case 'greeting': {
      const [nodes, approvals] = await Promise.all([
        getJson('/api/nodes'),
        getJson('/api/jarvis/risk'),
      ]);
      const laptop1 = (nodes.nodes || []).find((n: any) => n.node_id === 'laptop1');
      const criticals = (approvals.signals || []).filter((s: any) => s.level === 'critical').length;
      const warnings  = (approvals.signals || []).filter((s: any) => s.level === 'warning').length;
      return {
        approval_required: false, approval_id: null,
        reply: greetingReply({
          nodes: nodes.nodes?.length,
          alerts: criticals,
          pending: warnings,
        }) + (laptop1 ? `\nLaptop1: ${laptop1.status || 'unknown'}.` : ''),
        metadata: { route: 'greeting' },
      };
    }

    case 'farewell':
      return { approval_required: false, approval_id: null,
        reply: 'Em trực 24/7. Anh cần gì cứ nhắn.', metadata: {} };

    case 'how_are_you':
      return { approval_required: false, approval_id: null,
        reply: 'Em ổn. Hệ thống đang chạy bình thường. Anh cần gì không?', metadata: {} };

    // ── What's important today ──────────────────────────────────────────────

    case 'what_is_important': {
      const briefing = generateExecutiveBriefing();
      return { approval_required: false, approval_id: null, reply: briefing.formatted, metadata: { source: 'executive-briefing' } };
    }

    // ── Blockers ───────────────────────────────────────────────────────────

    case 'what_is_blocking': {
      const risk = await getJson('/api/jarvis/risk');
      const signals = (risk.signals || []) as Array<{ level: string; source: string; message: string }>;
      const blockers = signals.filter(s => s.level === 'critical' || s.level === 'warning');
      if (!blockers.length) {
        return { approval_required: false, approval_id: null, reply: '✅ Không phát hiện blocker nào. Hệ thống đang chạy bình thường.', metadata: {} };
      }
      const lines = blockers.slice(0, 5).map(s => {
        const icon = s.level === 'critical' ? '🔴' : '🟡';
        return `${icon} [${s.source}] ${s.message}`;
      });
      return { approval_required: false, approval_id: null,
        reply: `*Blockers hiện tại (${blockers.length}):*\n\n${lines.join('\n')}`,
        metadata: { blockers } };
    }

    // ── Risk summary ───────────────────────────────────────────────────────

    case 'risks_summary': {
      const risk = await getJson('/api/jarvis/risk');
      const signals = (risk.signals || []) as Array<{ level: string; source: string; message: string }>;
      if (!signals.length) {
        return { approval_required: false, approval_id: null, reply: '✅ Không có risk nào. Tất cả ổn.', metadata: {} };
      }
      const c = signals.filter(s => s.level === 'critical').length;
      const w = signals.filter(s => s.level === 'warning').length;
      const lines = signals.slice(0, 6).map(s => {
        const icon = s.level === 'critical' ? '🔴' : s.level === 'warning' ? '🟡' : 'ℹ️';
        return `${icon} ${s.message}`;
      });
      return { approval_required: false, approval_id: null,
        reply: `*Risk Summary*\n🔴 Critical: ${c}  🟡 Warning: ${w}\n\n${lines.join('\n')}`,
        metadata: { signals } };
    }

    // ── System status ──────────────────────────────────────────────────────

    case 'system_status': {
      const [health, wa, nodes] = await Promise.all([
        getJson('/api/health'),
        getJson('/api/whatsapp/mi/health'),
        getJson('/api/nodes'),
      ]);
      const nodeList = (nodes.nodes || []).map((n: any) =>
        `  • ${n.node_id}: ${n.status || 'unknown'}`).join('\n');
      return {
        approval_required: false, approval_id: null,
        reply: styleReply([
          `✅ *Mi-Core*: ${health.server || 'ok'} | Ollama: ${health.ollama || 'unknown'}`,
          `📱 *WhatsApp relay*: ${wa.endpoint || statusWord(wa)}`,
          nodeList ? `🖥 *Nodes*:\n${nodeList}` : '',
        ], 'status'),
        metadata: { health, wa, nodes },
      };
    }

    // ── Dashboard / workspace visibility ─────────────────────────────────

    case 'dashboard_link':
      return {
        approval_required: false, approval_id: null,
        reply: [
          '📊 Có anh.',
          'Dashboard chính: http://dashboard.bakudanramen.com',
          'Em dùng connector đọc status/task/approval từ đó. Anh muốn em check module nào thì nói thẳng tên module hoặc task.',
        ].join('\n'),
        metadata: { target: 'dashboard', url: 'http://dashboard.bakudanramen.com' },
      };

    case 'dashboard_status': {
      const result = await routeCommand('dashboard status');
      const summary = String(result.summary || '').trim();
      return {
        approval_required: !!result.requires_approval,
        approval_id: result.approval_id || null,
        reply: styleReply([
          '📊 *Dashboard của anh*',
          summary || 'Em thấy dashboard connector, nhưng snapshot hiện chưa có dữ liệu mới.',
          '',
          'Link: http://dashboard.bakudanramen.com',
          'Anh muốn em drill-down task, approval, Maria, hay store nào?',
        ], 'status'),
        metadata: { source: 'dashboard-connector', result },
      };
    }

    case 'workspace_overview': {
      const result = await routeCommand('scan all projects');
      return {
        approval_required: false, approval_id: null,
        reply: styleReply([
          '🧭 Em scan workspace cho anh.',
          String(result.summary || '').slice(0, 2500),
          '',
          'Nếu anh muốn, em drill-down từng project: Dashboard, Raw website, Bakudan website, WhatsApp API, Integration System, DoorDash.',
        ], 'status'),
        metadata: { source: 'project-scanner', result },
      };
    }

    case 'connector_health': {
      const board = await getConnectorHealthBoard();
      return {
        approval_required: false, approval_id: null,
        reply: styleReply([
          '🔌 Em check lớp kết nối cho anh.',
          board,
          '',
          'Chỗ nào partial/offline thì em có thể khoanh vùng nguyên nhân tiếp.',
        ], 'status'),
        metadata: { source: 'connector-health-board' },
      };
    }

    // ── Laptop 1 ──────────────────────────────────────────────────────────

    case 'laptop1_status': {
      const [health, projects, waGateway] = await Promise.all([
        getJson('/api/nodes/laptop1/health'),
        getJson('/api/nodes/laptop1/projects', 8000),
        probeDirect('whatsapp-ai-gateway'),
      ]);
      const nodeAgentUp = !health?.error;
      if (!nodeAgentUp) {
        // Node agent not registered — probe known services directly
        const waIcon = waGateway.ok ? '✅' : '🔴';
        return {
          approval_required: false, approval_id: null,
          reply: styleReply([
            `🖥 *Laptop1* — Node agent chưa kết nối với Mi-Core.`,
            `${waIcon} *WhatsApp Gateway*: ${waGateway.status}. ${waGateway.detail || ''}`,
            `\n_Để có đầy đủ status, laptop1 cần chạy mi-node-agent._`,
          ], 'status'),
          metadata: { wa_direct: waGateway },
        };
      }
      const pLines = Array.isArray(projects.projects)
        ? projects.projects.map((p: any) => `  • ${p.project_id}: ${statusWord(p)}`).join('\n')
        : '';
      const nodeStatus = statusWord(health);
      const icon = /online|ok|healthy/i.test(nodeStatus) ? '✅' : '🔴';
      return {
        approval_required: false, approval_id: null,
        reply: styleReply([
          `${icon} *Laptop1*: ${nodeStatus}.`,
          pLines ? `Projects:\n${pLines}` : '',
        ], 'status'),
        metadata: { health, projects },
      };
    }

    // ── Laptop 2 ──────────────────────────────────────────────────────────

    case 'laptop2_status': {
      const health = await getJson('/api/nodes/laptop2/health');
      return {
        approval_required: false, approval_id: null,
        reply: `🖥 *Laptop2*: ${statusWord(health)}.`,
        metadata: { health },
      };
    }

    // ── All nodes ─────────────────────────────────────────────────────────

    case 'all_nodes_status': {
      const nodes = await getJson('/api/nodes');
      const list = (nodes.nodes || []).map((n: any) => {
        const icon = n.status === 'online' ? '✅' : n.status === 'offline' ? '🔴' : '🟡';
        return `${icon} *${n.node_id}*: ${n.status} — ${n.address || 'n/a'}`;
      }).join('\n');
      return {
        approval_required: false, approval_id: null,
        reply: list || '⚠️ Chưa có node nào đăng ký.',
        metadata: { nodes },
      };
    }

    // ── Project statuses ──────────────────────────────────────────────────

    case 'doordash_status':
    case 'whatsapp_gateway_status':
    case 'integration_status':
      return projectStatus(route);

    // ── DoorDash revenue ──────────────────────────────────────────────────

    case 'doordash_revenue': {
      const data = await getJson('/api/nodes/laptop1/projects/doordash-compaigns/status');
      const revenue = data.revenue || data.today_revenue || data.summary?.revenue || 'Chưa có dữ liệu';
      return {
        approval_required: false, approval_id: null,
        reply: `💰 *DoorDash doanh thu*: ${revenue}\n${data.error ? `Lỗi: ${data.error}` : ''}`,
        metadata: { data },
      };
    }

    // ── Big Data ──────────────────────────────────────────────────────────

    case 'bigdata_health': {
      const data = await getJson('/api/bigdata/health');
      const pg = data.postgres || 'unknown';
      const mn = data.minio || 'unknown';
      const qd = data.qdrant || 'unknown';
      const icon = data.overall === 'ok' ? '✅' : '🟡';
      return {
        approval_required: false, approval_id: null,
        reply: `${icon} *Big Data*\nPostgres: ${pg}  MinIO: ${mn}  Qdrant: ${qd}`,
        metadata: { bigdata: data },
      };
    }

    // ── Store ops ─────────────────────────────────────────────────────────

    case 'store_ops': {
      const report = formatStoreIntelligenceReport();
      return { approval_required: false, approval_id: null, reply: report, metadata: { source: 'store-intelligence' } };
    }

    // ── Payroll ───────────────────────────────────────────────────────────

    case 'payroll_status':
      return {
        approval_required: false, approval_id: null,
        reply: '💵 *Payroll*\n\nKết nối QB chưa active. Khi QB connector online, Mi sẽ hiển thị:\n• Lịch trả lương tới\n• Tổng số giờ chờ duyệt\n• Variance với kỳ trước',
        metadata: {},
      };

    // ── Reviews ───────────────────────────────────────────────────────────

    case 'review_status': {
      const data = await getJson('/api/jarvis/risk');
      const reviewSignals = (data.signals || []).filter((s: any) => /review/i.test(s.source));
      if (!reviewSignals.length) {
        return { approval_required: false, approval_id: null,
          reply: '⭐ *Reviews*: Không có alert mới. Dùng /mi review summary để xem chi tiết.',
          metadata: {} };
      }
      const lines = reviewSignals.map((s: any) => `• ${s.message}`).join('\n');
      return { approval_required: false, approval_id: null, reply: `⭐ *Reviews*\n\n${lines}`, metadata: { reviewSignals } };
    }

    // ── Dev status ────────────────────────────────────────────────────────

    case 'dev_status': {
      const nodes = await getJson('/api/nodes');
      const devNodes = (nodes.nodes || []).filter((n: any) => /dev|laptop/i.test(n.node_id));
      if (!devNodes.length) {
        return { approval_required: false, approval_id: null,
          reply: '🔧 *Dev*: Không có dev node nào kết nối. Laptop1/Dev1 offline hoặc chưa đăng ký.',
          metadata: {} };
      }
      const lines = devNodes.map((n: any) => `• ${n.node_id}: ${n.status} (${n.address})`).join('\n');
      return { approval_required: false, approval_id: null, reply: `🔧 *Dev nodes*:\n${lines}`, metadata: { devNodes } };
    }

    case 'create_dev_task':
      return {
        approval_required: false, approval_id: null,
        reply: styleReply([
          'Em tạo draft task:',
          `"${_originalMessage.slice(0, 100)}"`,
          '',
          'Confirm anh? Em sẽ xin approval trước khi giao cho Dev1.',
        ]),
        metadata: { task_type: 'dev_task_draft', message: _originalMessage },
      };

    // ── Logs ─────────────────────────────────────────────────────────────

    case 'logs_request': {
      const data = await getJson(`/api/nodes/${route.target || 'laptop1'}/projects/${route.projectId}/logs`, 12000);
      return {
        approval_required: false, approval_id: null,
        reply: data.error
          ? `⚠️ Không lấy được logs ${projectLabel(route.projectId)}: ${data.error}`
          : `📋 *Logs — ${projectLabel(route.projectId)}*\n\n${shortJson(data, 800)}`,
        metadata: { logs: data },
      };
    }

    // ── Clear logs (dangerous — requires approval) ────────────────────────

    case 'clear_logs': {
      const id = 'clrlogs-' + Date.now().toString(36);
      return {
        approval_required: true, approval_id: id,
        reply: approvalReply(`Xóa logs ${projectLabel(route.projectId)} trên ${route.target || 'laptop1'}`, id),
        metadata: { requested_action: 'clear_logs', project: route.projectId, node: route.target },
      };
    }

    // ── Node issue report (context setter) ───────────────────────────────

    case 'node_issue_report': {
      return {
        approval_required: false, approval_id: null,
        reply: `⚠️ Em ghi nhận *${route.target || 'laptop1'}* đang có vấn đề. Anh cần em check gì — restart, xem logs, hay gọi support?`,
        metadata: { issue_target: route.target },
      };
    }

    // ── Store issue report (context setter) ──────────────────────────────

    case 'store_issue_report': {
      return {
        approval_required: false, approval_id: null,
        reply: `⚠️ Em ghi nhận *${route.target || 'store'}* đang có vấn đề. Anh muốn em check ops, staffing, hay revenue?`,
        metadata: { issue_target: route.target },
      };
    }

    // ── Restart (requires approval) ───────────────────────────────────────

    case 'restart_project': {
      const id = 'restart-' + Date.now().toString(36);
      return {
        approval_required: true, approval_id: id,
        reply: approvalReply(`Restart ${projectLabel(route.projectId)} trên ${route.target || 'laptop1'}`, id),
        metadata: { requested_action: 'restart_project', project: route.projectId, node: route.target },
      };
    }

    // ── Approval response ─────────────────────────────────────────────────

    case 'approval_response':
      return {
        approval_required: false, approval_id: null,
        reply: generateApprovalSummary().formatted,
        metadata: { intent: 'approval_summary' },
      };

    // ── Mute / unmute ─────────────────────────────────────────────────────

    case 'mute_alerts': {
      const hours = parseInt(route.param || '2');
      addMute('all', hours, 'CEO requested mute');
      return { approval_required: false, approval_id: null,
        reply: `🔕 Alert tắt ${hours}h. Em vẫn trực, sẽ báo lại lúc ${new Date(Date.now() + hours * 3600000).toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' })}.`,
        metadata: {} };
    }

    case 'unmute_alerts':
      return { approval_required: false, approval_id: null,
        reply: '🔔 Alert đã bật lại.', metadata: {} };

    // ── Help ─────────────────────────────────────────────────────────────

    case 'help_natural': {
      const actions = formatActionItemSummary();
      const approvals = generateApprovalSummary();
      return {
        approval_required: false, approval_id: null,
        reply: [
          '*Mi có thể làm:*',
          '',
          '📊 Tình hình: "hôm nay có gì?" / "hệ thống sao rồi?"',
          '🖥 Laptop: "laptop1 sao rồi?" / "doordash status"',
          '🏪 Cửa hàng: "cửa hàng Stone Oak thế nào?"',
          '📋 Approvals: "approval summary" / "critical approvals"',
          '✅ Action items: "action items" / "danh sách task"',
          '📈 Briefing: "executive briefing" / "báo cáo tổng hợp"',
          '⭐ Reviews: "review status"',
          '',
          `Đang chờ: ${approvals.total_pending} approvals, ${actions.split('⏳').length - 1} open tasks.`,
        ].join('\n'),
        metadata: {},
      };
    }

    // ── Report ────────────────────────────────────────────────────────────

    case 'report_request':
      return {
        approval_required: false, approval_id: null,
        reply: 'Em có các reports mới nhất trong E:/Project/Master/mi-core/reports/\nNếu anh muốn gửi ra ngoài, em sẽ xin xác nhận trước.',
        metadata: {},
      };

    // ── Default ───────────────────────────────────────────────────────────

    default:
      return {
        approval_required: false, approval_id: null,
        reply: clarifyReply(),
        metadata: {},
      };
  }
}
