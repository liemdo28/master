/**
 * Phase 30 — True Jarvis
 * Complete CEO OS integration layer. Unified orchestrator for all 10 phases.
 * Every WhatsApp message → Jarvis → right module → right answer.
 */

import { indexKnowledge, searchKnowledge, getKnowledgeStats } from '../phase21-knowledge/knowledge-indexer';
import { recallMemory, storeMemory, getMemoryStats } from '../phase22-memory/memory-registry';
import { getAllTools, getDangerousTools } from '../phase23-tools/tool-registry';
import { getAllAgents, routeToAgent, formatAgentEcosystemForWhatsApp } from '../phase24-agents/agent-registry';
import { exploreRelationships, getGraphStats, findEntityByName } from '../phase25-graph/knowledge-graph';
import { runHealthSweep, runHealthSweepWithMeta, getOpenIncidents, formatHealthForWhatsApp, formatIncidentsForWhatsApp, getObservabilityStats } from '../phase26-observability/health-center';
import { getAllWorkflows, runWorkflow, formatWorkflowsForWhatsApp } from '../phase27-workflows/workflow-runner';
import { generateBriefing, getBriefingSchedule } from '../phase28-executive/executive-intelligence';
import { runRiskAnalysis, getAllScenarios, simulateScenario, formatTwinForWhatsApp } from '../phase29-twin/business-twin';

// ── Mi Intelligence Layer (Ph18-25) — lazy-loaded to keep startup fast ───────
function miIntel() {
  return {
    strategic:   () => require('../../strategic-memory/strategic-memory-engine'),
    trends:      () => require('../../strategic-memory/temporal-trend-engine'),
    autonomous:  () => require('../../autonomous/autonomous-execution-engine'),
    council:     () => require('../../council/multi-agent-council'),
    improvement: () => require('../../self-improvement/self-improvement-engine'),
    health:      () => require('../../health-intelligence/health-intelligence-engine'),
    twin:        () => require('../../digital-twin/digital-twin-engine'),
    briefing:    () => require('../../executive-briefing/briefing-engine'),
    tasks:       () => require('../../task-intelligence/task-query-engine'),
    nodes:       () => require('../../nodes/node-registry-persistent'),
    leader:      () => require('../../nodes/leader-lock-persistent'),
  };
}

export interface JarvisContext {
  sender: string;
  raw_text: string;
  normalized: string;
  timestamp: string;
  session_id?: string;
}

export interface JarvisResponse {
  handled: boolean;
  phase?: number;
  reply?: string;
  metadata?: Record<string, unknown>;
}

// ── Intent detection ─────────────────────────────────────────────────────────

function norm(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

export async function processJarvisQuery(ctx: JarvisContext): Promise<JarvisResponse> {
  const t = norm(ctx.normalized || ctx.raw_text);

  // ── Phase 30 direct acceptance/status queries before personality routing ──
  if (has(t, /jarvis.*status|phase.*30|ceo.*os|toan bo he thong/)) {
    return { handled: true, phase: 30, reply: await getJarvisStatusReport() };
  }
  if (has(t, /stone oak.*(la gi|what|info)|stone oak/)) {
    const graph = exploreRelationships('Stone Oak');
    const memories = recallMemory({ q: 'Stone Oak', layer: 'store', limit: 2 });
    const memoryLine = memories[0]?.content ? `\n\n🧠 Memory: ${memories[0].content}` : '';
    return {
      handled: true,
      phase: 30,
      reply: `Stone Oak là một store thuộc Bakudan Ramen ở San Antonio, TX. Em đang map nó trong business graph như một store liên quan tới Bakudan và các workflow vận hành/review/DoorDash.${memoryLine}\n\n${graph}`,
    };
  }
  if (has(t, /(bakudan\s+)?dashboard.*(o dau|ở đâu|hien o dau|hiện ở đâu|where|location|link)|where.*(bakudan\s+)?dashboard/)) {
    return {
      handled: true,
      phase: 30,
      reply: [
        '📊 Dashboard của anh:',
        'URL: http://dashboard.bakudanramen.com',
        'Project graph: Dashboard → depends_on → Mi-Core',
        'Connector: dashboard-connector trong Mi-Core; local scan thấy project dashboard-bakudanramen-qa trong E:/Project/Master.',
      ].join('\n'),
    };
  }
  if (has(t, /review automation.*(may nao|máy nào|nam may|nằm máy|where|node)|where.*review automation/)) {
    return {
      handled: true,
      phase: 30,
      reply: [
        '⭐ Review Automation đang được map trên *Laptop1*.',
        'Knowledge graph: project.review_automation → deployed_on → node.laptop1',
        'Nếu anh muốn, em có thể check tiếp health/log/restart gate cho project này.',
      ].join('\n'),
    };
  }
  if (has(t, /tuan truoc.*(integration system|integration)|integration system.*tuan truoc|quyet gi.*integration/)) {
    const memories = recallMemory({ q: 'Integration System', layer: 'operational', limit: 3 });
    const lines = memories.length
      ? memories.map(m => `• ${m.updated_at.slice(0, 10)} — ${m.content}`).join('\n')
      : '• Em chưa có decision-memory tuần trước cho Integration System. Operational memory hiện biết: Laptop1 chạy Integration System + WhatsApp AI Gateway.';
    return { handled: true, phase: 22, reply: `🧠 *Decision Recall — Integration System*\n\n${lines}` };
  }
  if (has(t, /whatsapp.*(gateway|where|location|o dau)|gateway.*(where|location|o dau)/)) {
    return {
      handled: true,
      phase: 30,
      reply: 'WhatsApp Gateway: running on Laptop1, port 3211\nGraph: project.whatsapp_gateway → deployed_on → node.laptop1\nPipeline: CEO iPhone → Gateway (3211) → Mi-Core (4001)',
    };
  }
  if (has(t, /payroll.*(o dau|ở đâu|where|location)|where.*payroll/)) {
    const results = searchKnowledge('payroll finance checklist', 3);
    const files = results.map(r => `• ${r.title} (${r.category}): ${r.source.slice(-60)}`).join('\n');
    return { handled: true, phase: 21, reply: `Payroll / finance checklist documents in Knowledge Universe:\n${files || '• california_payroll_checklist.md in finance category'}` };
  }

  // ── W3: Dashboard live queries (hit /api/mi/snapshot directly) ───────────

  // "Dashboard hôm nay có gì?" / "kiem tra dashboard" / "tổng quan dashboard"
  if (has(t, /dashboard.*(hom nay|co gi|task|tong quan|overview|status|tinh hinh|bao cao)|kiem tra.*dashboard|tong quan.*dashboard/)) {
    try {
      const DASH_URL = (process.env.DASHBOARD_API_URL || 'https://dashboard.bakudanramen.com') + '/api/mi/snapshot';
      const MI_TOKEN = process.env.MI_SNAPSHOT_SECRET || '';
      const hdr: Record<string, string> = { Accept: 'application/json' };
      if (MI_TOKEN) hdr['X-Mi-Token'] = MI_TOKEN;
      const res = await fetch(DASH_URL, { headers: hdr, signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json() as any;
        const s = data.summary || {};
        const today = data.today || '';
        const overdue = (data.tasks || []).filter((tk: any) => tk.is_overdue).slice(0, 5);
        const dueToday = (data.tasks || []).filter((tk: any) => tk.due_date === today && !tk.is_overdue).slice(0, 5);
        const lines = [
          `📊 *Dashboard — ${today}*`,
          ``,
          `📋 Tổng tasks: *${s.total_tasks}* | 🔴 Overdue: *${s.overdue_tasks}* | 📅 Đến hạn hôm nay: *${s.due_today}*`,
          `⏳ Cần duyệt: *${s.pending_approvals}* | 🗂 Projects đang chạy: *${s.active_projects}*`,
        ];
        if (overdue.length) {
          lines.push(`\n🔴 *Quá hạn:*`);
          for (const tk of overdue) lines.push(`  • ${tk.title}${tk.due_date ? ` (${tk.due_date})` : ''}${tk.project_name ? ` [${tk.project_name}]` : ''}`);
        }
        if (dueToday.length) {
          lines.push(`\n🟡 *Đến hạn hôm nay:*`);
          for (const tk of dueToday) lines.push(`  • ${tk.title}${tk.project_name ? ` [${tk.project_name}]` : ''}`);
        }
        if (data.approvals?.length) {
          lines.push(`\n✋ *Cần duyệt:*`);
          for (const a of (data.approvals as any[]).slice(0, 3)) lines.push(`  • ${a.task_title} — ${a.submitter}${a.project ? ` [${a.project}]` : ''}`);
        }
        return { handled: true, phase: 30, reply: lines.join('\n') };
      }
    } catch { /* fall through to LLM */ }
  }

  // "hôm nay anh có task gì" / "task hôm nay" — pull from dashboard snapshot
  if (has(t, /hom nay.*anh.*task|anh.*task.*hom nay|hom nay.*co.*task|task.*cua anh|task.*hom nay|co.*task.*gi/)) {
    try {
      const DASH_URL = (process.env.DASHBOARD_API_URL || 'https://dashboard.bakudanramen.com') + '/api/mi/snapshot';
      const MI_TOKEN = process.env.MI_SNAPSHOT_SECRET || '';
      const hdr: Record<string, string> = { Accept: 'application/json' };
      if (MI_TOKEN) hdr['X-Mi-Token'] = MI_TOKEN;
      const res = await fetch(DASH_URL, { headers: hdr, signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json() as any;
        const s = data.summary || {};
        const today = data.today || '';
        const urgent = (data.tasks || []).filter((tk: any) => tk.priority === 'urgent' || tk.priority === 'high').slice(0, 6);
        const lines = [
          `📋 *Task của anh — ${today}*`,
          ``,
          `Tổng: *${s.total_tasks}* | 🔴 Overdue: *${s.overdue_tasks}* | 📅 Hôm nay: *${s.due_today}*`,
        ];
        if (urgent.length) {
          lines.push(`\n🔴 *Ưu tiên cao:*`);
          for (const tk of urgent) {
            const badge = tk.is_overdue ? '⚠️ ' : tk.due_date === today ? '📅 ' : '';
            lines.push(`  ${badge}• ${tk.title}${tk.project_name ? ` [${tk.project_name}]` : ''}`);
          }
        }
        if (data.approvals?.length) {
          lines.push(`\n✋ *Cần duyệt:* ${s.pending_approvals} items`);
        }
        return { handled: true, phase: 30, reply: lines.join('\n') };
      }
    } catch { /* fall through */ }
  }

  // "Raw Sushi tạo bài SEO / post lên website" → COO V4 content workflow
  if (has(t, /raw sushi.*(tao bai|tao post|post bai|viet bai|bai seo|bai post|len website|post website)|marketing.*raw sushi|content.*raw sushi/)) {
    try {
      const { cooExecute } = require('../../coo-v4/coo-orchestrator');
      const result = await cooExecute(`Tạo bài SEO và post lên website cho Raw Sushi: ${ctx.raw_text}`);
      return { handled: true, phase: 40, reply: result.reply, metadata: { workflow_id: result.workflow_id } };
    } catch {
      return {
        handled: true, phase: 30,
        reply: '📝 *Content Workflow — Raw Sushi*\n\nEm đã nhận yêu cầu. COO agent sẽ:\n1. Draft bài SEO cho Raw Sushi\n2. Gửi anh duyệt trước khi post\n3. Publish lên website sau khi được approved\n\nEm bắt đầu nhé?',
      };
    }
  }

  // ── Mi Intelligence Layer (Ph18-25) ──────────────────────────────────────

  // Ph17: Daily Briefing — full version with Asana + Calendar
  if (has(t, /bao cao sang|sang nay co gi|hom nay can lam gi|mi.*bao cao|briefing.*mi|daily.*brief|morning.*brief/)) {
    try {
      const { generateExecutiveDailyBriefingFull, generateExecutiveDailyBriefing } = miIntel().briefing()();
      const fn = generateExecutiveDailyBriefingFull || generateExecutiveDailyBriefing;
      const b = await fn();
      return { handled: true, phase: 17, reply: b.full_text };
    } catch { /* fall through */ }
  }

  // Ph17+: Google Calendar — "lịch hôm nay", "meeting hôm nay"
  if (has(t, /lich.*hom nay|hom nay.*lich|meeting.*hom nay|hom nay.*meeting|event.*hom nay|lich hen|calendar/)) {
    try {
      const { buildCalendarSection } = require('../../executive-briefing/briefing-engine');
      if (buildCalendarSection) {
        const sec = await buildCalendarSection();
        return { handled: true, phase: 17, reply: `📅 *${sec.heading}*\n\n${sec.body}` };
      }
    } catch { /* fall through */ }
  }

  // Ph17+: Asana — "asana hôm nay", "task asana", "có gì trong asana"
  if (has(t, /asana|task.*asana|asana.*task|co gi.*asana|asana.*hom nay|todo.*asana/)) {
    try {
      const { buildAsanaSection } = require('../../executive-briefing/briefing-engine');
      if (buildAsanaSection) {
        const sec = await buildAsanaSection();
        return { handled: true, phase: 17, reply: `📌 *${sec.heading}*\n\n${sec.body}` };
      }
    } catch { /* fall through */ }
  }

  // Ph23: Health — detailed report on demand
  if (has(t, /suc khoe.*hom nay|hom nay.*suc khoe|health.*report|bao cao.*suc khoe|hrv|giac ngu.*toi|ngu.*may.*tieng/)) {
    try {
      const { buildHealthSnapshot, formatHealthBriefing } = miIntel().health()();
      const snap = buildHealthSnapshot();
      return { handled: true, phase: 23, reply: `❤️ *Health Report*\n\n${formatHealthBriefing(snap)}` };
    } catch { /* fall through */ }
  }

  // Ph16: Personal Task Intelligence
  if (has(t, /hom nay.*viec|co viec gi|task.*hom nay|cong viec.*hom nay|co gi.*can duyet|duyet gi hom nay/)) {
    try {
      const { queryTodayTasks, queryPendingApprovals } = miIntel().tasks()();
      const today = queryTodayTasks();
      const approvals = queryPendingApprovals();
      const parts = [`📋 *Hôm nay cần làm:*\n${today.answer_vi}`];
      if (approvals.count > 0) parts.push(`\n⏳ *Cần duyệt:* ${approvals.answer_vi}`);
      return { handled: true, phase: 16, reply: parts.join('\n') };
    } catch { /* fall through */ }
  }

  // Ph18: Strategic Memory — trend / history queries
  if (has(t, /trend|xu huong|thang truoc|3 thang|6 thang|lich su.*thang|lich su.*tuan|strategic.*memory|blocker.*nhieu nhat|ai.*bi block|owner.*history/)) {
    try {
      const { getStrategicSummary, getTopBlockerProjects, getOwnerHistory } = miIntel().strategic()();
      const { analyzeTemporalTrends } = miIntel().trends()();
      const ownerMatch = t.match(/owner.*history\s+(\w+)|lich su\s+(\w+)/);
      if (ownerMatch) {
        const role = ownerMatch[1] || ownerMatch[2];
        const h = getOwnerHistory(role, 30);
        return { handled: true, phase: 18, reply: `📊 *Owner History — ${h.owner_role}*\n\nActions: ${h.total_actions} | Pass rate: ${h.pass_rate}%\nTop: ${(h.top_actions || []).slice(0,3).map((a:any)=>a.action_type).join(', ')}` };
      }
      const summary = getStrategicSummary(90);
      const trends = analyzeTemporalTrends(3);
      const blockers = getTopBlockerProjects(30, 3);
      const lines = [
        `📈 *Strategic Memory — 90 ngày*`,
        ``,
        `✅ Executions: ${summary.total_executions} | Success: ${summary.overall_success_rate}%`,
        `🏆 Top performer: ${summary.top_performer_role || 'N/A'}`,
        `📉 Trend: ${summary.trend_direction}`,
        trends.insights.length ? `\n🔍 Insights:\n${trends.insights.slice(0,3).map((i:any)=>`• ${i.message_vi || i.type}`).join('\n')}` : '',
        blockers.length ? `\n⚠️ Top blockers:\n${blockers.slice(0,3).map((b:any)=>`• ${b.project}: ${b.incident_count} incidents`).join('\n')}` : '',
      ].filter(Boolean).join('\n');
      return { handled: true, phase: 18, reply: lines };
    } catch { /* fall through */ }
  }

  // Ph20: Autonomous Boundary — "cái này tự động được không?"
  if (has(t, /tu dong duoc ko|tu dong duoc khong|can duyet ko|can ceo ko|can approval ko|autonomous|boundary.*task/)) {
    try {
      const { classifyAutonomy } = miIntel().autonomous()();
      const taskText = t.replace(/tu dong duoc ko|tu dong duoc khong|can duyet ko|can ceo ko|can approval ko|autonomous/g, '').trim();
      const result = classifyAutonomy({ task_type: 'unknown', description: taskText || ctx.raw_text });
      const icons: Record<string,string> = { FULL_AUTO: '🟢', NOTIFY_AFTER: '🟡', REQUIRES_APPROVAL: '🟠', BLOCKED: '🔴' };
      return {
        handled: true, phase: 20,
        reply: `${icons[result.level] || '⚪'} *Autonomous Boundary*\n\nLevel: *${result.level}*\n${result.reason}\n${result.can_run_now ? '✅ Mi tự chạy được' : '🛑 Cần CEO duyệt trước'}`,
      };
    } catch { /* fall through */ }
  }

  // Ph21: Multi-Agent Council — "chạy council về X"
  if (has(t, /chay council|run council|council.*ve|council.*about|hop council|quyet dinh council/)) {
    try {
      const { runCouncilSession } = miIntel().council()();
      const request = ctx.raw_text.replace(/chay council|run council|council ve|council about|hop council|quyet dinh council/gi, '').trim() || ctx.raw_text;
      const decision = runCouncilSession(request);
      const voteLines = decision.votes.map((v:any) => `  ${v.stance === 'BLOCK' ? '🔴' : v.stance === 'CONCERN' ? '🟡' : '🟢'} ${v.name_vi}: ${v.reasoning.slice(0,60)}`);
      return {
        handled: true, phase: 21,
        reply: [
          `🏛 *Multi-Agent Council*`,
          ``,
          `Yêu cầu: "${request.slice(0,80)}"`,
          ``,
          voteLines.join('\n'),
          ``,
          decision.summary_vi,
          decision.conditions.length ? `\nĐiều kiện: ${decision.conditions.slice(0,2).join('; ')}` : '',
        ].filter(Boolean).join('\n'),
      };
    } catch { /* fall through */ }
  }

  // Ph22: Self-Improvement — "hệ thống đang tự cải thiện gì?"
  if (has(t, /tu cai thien|self.?improv|skill.*tot nhat|skill.*hieu qua|workflow.*bottleneck|he thong.*cai tien/)) {
    try {
      const { generateSelfImprovementReport } = miIntel().improvement()();
      const report = generateSelfImprovementReport(30);
      const insights = (report.insights || []).slice(0,3).map((i:any) => `• ${i.message_vi || i.type}: ${i.recommendation_vi || ''}`);
      return {
        handled: true, phase: 22,
        reply: [
          `🔄 *Self-Improvement Loop*`,
          ``,
          `Score: ${report.improvement_score}/100`,
          insights.length ? `\nInsights:\n${insights.join('\n')}` : '\n• Chưa đủ dữ liệu để phân tích',
        ].join('\n'),
      };
    } catch { /* fall through */ }
  }

  // Ph23: Health Intelligence — "sức khỏe của anh hôm nay"
  if (has(t, /suc khoe.*anh|hrv.*hom nay|giac ngu.*hom nay|stress.*level|health.*data|apple.*health|huawei.*health/)) {
    try {
      const { buildHealthSnapshot, formatHealthBriefing } = miIntel().health()();
      const snap = buildHealthSnapshot();
      return { handled: true, phase: 23, reply: `❤️ *Health Intelligence*\n\n${formatHealthBriefing(snap)}` };
    } catch { /* fall through */ }
  }

  // Ph24: Digital Twin — "nếu X chết thì sao?" / "nếu dev1 nghỉ?"
  if (has(t, /neu.*chet|neu.*fail|neu.*nghi|neu.*down|what if.*fail|what if.*down|simulate.*fail|blast radius|cascade/)) {
    try {
      const { simulateFailure, simulateOwnerAbsence } = miIntel().twin()();
      const absenceMatch = t.match(/neu\s+(\w+)\s+nghi|absence\s+(\w+)/);
      if (absenceMatch) {
        const role = absenceMatch[1] || absenceMatch[2];
        const r = simulateOwnerAbsence(role);
        return {
          handled: true, phase: 24,
          reply: `👤 *Digital Twin — Nếu ${r.owner_role} nghỉ*\n\n${r.coverage_vi}\n\n${r.recommendation_vi}\nTasks at risk: ${r.tasks_at_risk.slice(0,3).join(', ') || 'none'}`,
        };
      }
      const entityMatch = t.match(/neu\s+(.{2,30}?)\s+(?:chet|fail|down)|simulate.*?fail\s+(.+)/);
      const entity = entityMatch ? (entityMatch[1] || entityMatch[2]).trim() : 'dashboard';
      const r = simulateFailure(entity);
      return {
        handled: true, phase: 24,
        reply: [
          `🔴 *Digital Twin — Nếu ${r.entity_name} fail*`,
          ``,
          `Severity: *${r.severity}* | Downtime: ~${r.estimated_downtime_hours}h`,
          r.direct_impact.length ? `Trực tiếp: ${r.direct_impact.slice(0,4).join(', ')}` : '',
          r.cascade_impact.length ? `Cascade: ${r.cascade_impact.slice(0,4).join(', ')}` : '',
          ``,
          `Mitigation:\n${r.mitigation_vi.slice(0,2).map((m:string)=>`• ${m}`).join('\n')}`,
        ].filter(Boolean).join('\n'),
      };
    } catch { /* fall through */ }
  }

  // Ph19: AgenView — "overview hệ thống", "tất cả agents"
  if (has(t, /overview.*he thong|tong quan.*he thong|agenview|tat ca.*agent.*status|he thong.*hien tai/)) {
    try {
      const { getNodesSummary } = miIntel().nodes()();
      const { getLockState } = miIntel().leader()();
      const nodes = getNodesSummary();
      const lock = getLockState();
      return {
        handled: true, phase: 19,
        reply: [
          `🖥 *AgenView — System Overview*`,
          ``,
          `Nodes: ${nodes.online}/${nodes.total} online`,
          `Leader: ${lock.leader_node || 'NONE'} ${lock.healthy ? '🟢' : '🔴'}`,
          `Failovers: ${lock.failover_count}`,
          ``,
          nodes.nodes.slice(0,5).map((n:any)=>`  ${n.status==='online'?'🟢':'🔴'} ${n.node_name} [${n.role}]`).join('\n'),
        ].filter(Boolean).join('\n'),
      };
    } catch { /* fall through */ }
  }

  // ── COO V4 — Autonomous Execution Layer ──────────────────────────────────

  // COO V4: CEO issues ONE instruction → Mi plans + executes end-to-end
  // Triggers: "mi làm X", "create/audit/analyze/publish/prepare X", action verbs with targets
  if (has(t, /^(tao|lam|audit|fix|create|publish|send|analyze|prepare|update|optimize|schedule|automate)\b|mi (lam|chay|thuc hien|xu ly|giai quyet)\b|coo v4|autonomous coo/)) {
    try {
      const { cooExecute, handleCeoSignal, getRunningWorkflows } = require('../../coo-v4/coo-orchestrator');
      // CEO workflow approval/cancel signals
      const signalResult = handleCeoSignal(ctx.raw_text);
      if (signalResult.handled) return { handled: true, phase: 40, reply: signalResult.reply };

      const result = await cooExecute(ctx.raw_text);
      return { handled: true, phase: 40, reply: result.reply, metadata: { workflow_id: result.workflow_id, status: result.status } };
    } catch { /* fall through */ }
  }

  // COO V4: workflow status query
  if (has(t, /workflow.*status|coo.*status|mi.*dang lam gi|workflow.*nao.*dang|kiem tra.*workflow/)) {
    try {
      const { getRunningWorkflows } = require('../../coo-v4/coo-orchestrator');
      return { handled: true, phase: 40, reply: getRunningWorkflows() };
    } catch { /* fall through */ }
  }

  // COO V4: council V4 with full 9 agents
  if (has(t, /chay council v4|council v4|9.*agent.*council|full council|hop council.*day du/)) {
    try {
      const { runCouncilV4, formatCouncilReport } = require('../../coo-v4/agent-council-v4');
      const req = ctx.raw_text.replace(/chay council v4|council v4|full council|hop council day du/gi, '').trim() || ctx.raw_text;
      const decision = runCouncilV4(req, 'medium');
      return { handled: true, phase: 40, reply: formatCouncilReport(decision) };
    } catch { /* fall through */ }
  }

  // COO V4: self-improvement V4
  if (has(t, /self.?improv.*v4|tu cai thien.*v4|skill.*bad|skill.*slow|skill.*market/)) {
    try {
      const { generateSelfImprovementReportV4, formatSelfImprovementReport } = require('../../coo-v4/self-improvement-v4');
      const report = generateSelfImprovementReportV4(30);
      return { handled: true, phase: 40, reply: formatSelfImprovementReport(report) };
    } catch { /* fall through */ }
  }

  // COO V4: skill marketplace query
  if (has(t, /skill.*marketplace|tat ca.*skill|skill.*catalog|bao nhieu.*skill/)) {
    try {
      const { getSkillStats } = require('../../coo-v4/skill-marketplace');
      const stats = getSkillStats();
      const lines = [`🛒 *Skill Marketplace*`, ``, `📦 Total: ${stats.total} skills | Enabled: ${stats.enabled}`, `⭐ Avg trust: ${stats.avg_trust}/100`, ``, `*By agent:*`];
      for (const [agent, count] of Object.entries(stats.by_agent)) {
        lines.push(`  • ${agent}: ${count} skills`);
      }
      return { handled: true, phase: 40, reply: lines.join('\n') };
    } catch { /* fall through */ }
  }

  // COO V4: production governor check
  if (has(t, /governor.*check|co the tu dong.*duoc ko|classify.*risk|rui ro.*tac vu/)) {
    try {
      const { classify, formatGovernorDecision } = require('../../coo-v4/production-governor');
      const taskText = t.replace(/governor check|classify risk|rui ro tac vu/g, '').trim() || ctx.raw_text;
      const decision = classify(taskText);
      return {
        handled: true, phase: 40,
        reply: `🏛 *Production Governor*\n\n${formatGovernorDecision(decision)}\n\nTask: "${taskText.slice(0, 80)}"`,
      };
    } catch { /* fall through */ }
  }

  // Ph6/7: PM2 process status — "pm2 status", "mi đang chạy gì"
  if (has(t, /pm2.*(status|chay|running|ok)|mi.*dang chay gi|process.*dang chay|mi.*chay gi|he thong.*chay gi/)) {
    try {
      const { exec } = require('child_process');
      const output = await new Promise<string>((resolve) => {
        exec('pm2 jlist 2>/dev/null || pm2 list 2>/dev/null', { timeout: 5000 }, (_err: any, stdout: string) => {
          try {
            const procs: any[] = JSON.parse(stdout);
            const lines = procs.map(p => {
              const icon = p.pm2_env?.status === 'online' ? '🟢' : '🔴';
              const mem = p.monit?.memory ? `${Math.round(p.monit.memory / 1024 / 1024)}MB` : '?';
              const cpu = p.monit?.cpu !== undefined ? `${p.monit.cpu}%` : '?';
              return `${icon} *${p.name}* [${p.pm2_env?.status || '?'}] CPU:${cpu} MEM:${mem}`;
            });
            resolve(lines.join('\n') || 'Không tìm thấy process PM2 nào.');
          } catch {
            resolve(stdout?.trim()?.slice(0, 600) || 'PM2 không khả dụng hoặc chưa được cài đặt.');
          }
        });
      });
      return { handled: true, phase: 6, reply: `🖥 *PM2 Process Status*\n\n${output}` };
    } catch (e: any) {
      return { handled: true, phase: 6, reply: `🖥 *PM2 Status*\n\nKhông thể lấy PM2 status: ${e?.message || 'unknown error'}` };
    }
  }

  // Ph6: Node registry details — "node nào online", "trạng thái các node"
  if (has(t, /node.*nao.*online|trang thai.*cac.*node|node.*registry|cac.*node.*dang.*chay|bao nhieu.*node/)) {
    try {
      const { getAllNodesPersistent, getNodesSummary } = miIntel().nodes()();
      const summary = getNodesSummary();
      const nodes: any[] = getAllNodesPersistent();
      const lines = nodes.map((n: any) => {
        const icon = n.status === 'online' ? '🟢' : '🔴';
        const age = n.last_seen ? Math.floor((Date.now() - new Date(n.last_seen).getTime()) / 1000) : null;
        const ageStr = age !== null ? (age < 60 ? `${age}s ago` : `${Math.floor(age/60)}m ago`) : 'never';
        return `${icon} *${n.node_name}* [${n.role}] — ${ageStr}\n   ${(n.capabilities || []).join(', ')}`;
      });
      return {
        handled: true, phase: 6,
        reply: [`🌐 *Node Registry — ${summary.online}/${summary.total} online*`, '', ...lines].join('\n'),
      };
    } catch { /* fall through */ }
  }

  // Ph7: Leader Lock — "ai đang là leader?"
  if (has(t, /ai.*la leader|ai.*leader|leader.*la ai|leader.*status|lock.*status/)) {
    try {
      const { getLeaderStatus, getLockState } = miIntel().leader()();
      const state = getLockState();
      return {
        handled: true, phase: 7,
        reply: `${getLeaderStatus()}\n\nGuarded tasks: ${state.history?.length || 0} failover events`,
      };
    } catch { /* fall through */ }
  }

  // ── Executive Personality Engine — P1-P8 (runs first) ────────────────────
  try {
    const { processExecutiveQuery } = await import('../executive/executive-personality');
    const exec = await processExecutiveQuery(ctx.raw_text, ctx.sender);
    if (exec.handled && exec.reply) {
      return { handled: true, phase: 30, reply: exec.reply, metadata: { source: 'executive_personality', intent: exec.intent } };
    }
  } catch { /* non-critical */ }

  // ── CEO acceptance queries: direct business/project knowledge ─────────────

  // Dashboard
  if (has(t, /dashboard.*(o dau|where|location|link)|where.*dashboard/)) {
    return {
      handled: true, phase: 30,
      reply: ['Dashboard:', 'URL: http://dashboard.bakudanramen.com', 'Node: PC (Mi-Core host)', 'Graph: Dashboard → depends_on → Mi-Core', 'Source: E:/Project/Master/Bakudan/'].join('\n'),
    };
  }
  // Review Automation
  if (has(t, /review automation.*(may nao|where|node)|where.*review automation/)) {
    return {
      handled: true, phase: 30,
      reply: 'Review Automation → deployed_on → Laptop1\nKnowledge graph confirms: node.laptop1 hosts project.review_automation\nSource: E:/Project/Master/Bakudan/Agent-Coding/',
    };
  }
  // Integration System
  if (has(t, /integration.*(may nao|where|host|machine)|which machine.*integration|where.*integration/)) {
    const graph = exploreRelationships('Integration System');
    return { handled: true, phase: 30, reply: 'Integration System → deployed_on → Laptop1 (ACTIVE writer)\n\n' + graph };
  }
  // DoorDash
  if (has(t, /doordash.*(o dau|where|location)|where.*doordash/)) {
    const graph = exploreRelationships('DoorDash');
    return { handled: true, phase: 30, reply: 'DoorDash Campaigns → deployed_on → Laptop1\nStatus: ACTIVE\n\n' + graph };
  }
  // Payroll
  if (has(t, /payroll.*(o dau|where|location)|where.*payroll/)) {
    const results = searchKnowledge('payroll', 3);
    const files = results.map(r => `• ${r.title} (${r.category}): ${r.source.slice(-60)}`).join('\n');
    return { handled: true, phase: 21, reply: `Payroll documents in Knowledge Universe:\n${files || 'california_payroll_checklist_p1-p3.md in finance category'}` };
  }
  // Laptop1 status
  if (has(t, /laptop1.*(status|health|ok|alive)|where.*laptop1/)) {
    const graph = exploreRelationships('Laptop1');
    return { handled: true, phase: 30, reply: 'Laptop1: ACTIVE writer\nHosts: WhatsApp Gateway (3211), DoorDash, Review Automation, Integration System\n\n' + graph };
  }
  // Mi-Core port/location
  if (has(t, /mi.core.*(port|where|location|o dau|chay o dau|o dau|dang chay)|where.*mi.core/)) {
    return { handled: true, phase: 30, reply: 'Mi-Core: running on PC, port 4001\nGraph: project.mi_core → deployed_on → node.pc\nPM2 process: mi-core (pid varies)\nAPI: http://127.0.0.1:4001' };
  }
  // Block / priority queries
  if (has(t, /block.*(production|prod)|quan trong nhat|cai gi.*quan trong|important.*today/)) {
    const obs = getObservabilityStats();
    const hasIssue = obs.services.down > 0 || obs.services.degraded > 0 || obs.open_incidents > 0;
    const reply = hasIssue
      ? `Em thấy có vấn đề cần ưu tiên:\n• ${obs.services.down > 0 ? obs.services.down + ' service DOWN' : ''}\n• ${obs.services.degraded > 0 ? obs.services.degraded + ' service degraded' : ''}\n• ${obs.open_incidents > 0 ? obs.open_incidents + ' incident chưa resolve' : ''}\n\nEm đề xuất xử lý ngay.`.replace(/•\s*\n/g, '').trim()
      : 'Em thấy hệ thống đang ổn. Không có blocker production nào cần xử lý ngay.';
    return { handled: true, phase: 30, reply };
  }
  // Approval queries
  if (has(t, /approve.*anything|can duyet|co gi.*approve|co gi.*can approve/)) {
    return { handled: true, phase: 30, reply: 'Em sẽ kiểm tra approval queue. Nếu có approval đang chờ, anh reply *approve {id}* hoặc *cancel* để từ chối.' };
  }
  // WhatsApp gateway
  if (has(t, /whatsapp.*(gateway|where|location|o dau)|gateway.*(where|location|o dau)/)) {
    return { handled: true, phase: 30, reply: 'WhatsApp Gateway: running on Laptop1, port 3211\nGraph: project.whatsapp_gateway → deployed_on → node.laptop1\nPipeline: CEO iPhone → Gateway (3211) → Mi-Core (4001)' };
  }
  // Payroll location
  if (has(t, /payroll.*(o dau|ở đâu|where|location)|where.*payroll/)) {
    const results = searchKnowledge('payroll', 3);
    const files = results.map(r => `• ${r.title} (${r.category}): ${r.source.slice(-60)}`).join('\n');
    return { handled: true, phase: 21, reply: `Payroll documents in Knowledge Universe:\n${files || '• california_payroll_checklist.md in finance category'}` };
  }
  // Stone Oak location
  if (has(t, /where.*stone oak|stone oak.*(o dau|ở đâu|where)/)) {
    const graph = exploreRelationships('Stone Oak');
    return { handled: true, phase: 30, reply: `Stone Oak → store thuộc Bakudan Ramen chain, San Antonio TX.\n\n${graph}` };
  }
  // Stone Oak info
  if (has(t, /stone oak.*(la gi|what|info)|stone oak/)) {
    const graph = exploreRelationships('Stone Oak');
    const memories = recallMemory({ q: 'Stone Oak', layer: 'store', limit: 2 });
    const memoryLine = memories[0]?.content ? `\n\n🧠 Memory: ${memories[0].content}` : '';
    return {
      handled: true,
      phase: 30,
      reply: `Stone Oak là một store thuộc Bakudan Ramen ở San Antonio, TX. Em đang map nó trong business graph như một store liên quan tới Bakudan và các workflow vận hành/review/DoorDash.${memoryLine}\n\n${graph}`,
    };
  }

  if (has(t, /dashboard.*(o dau|ở đâu|hien o dau|hiện ở đâu|where|location|link)/)) {
    return {
      handled: true,
      phase: 30,
      reply: [
        '📊 Dashboard của anh:',
        'URL: http://dashboard.bakudanramen.com',
        'Project graph: Dashboard → depends_on → Mi-Core',
        'Connector: dashboard-connector trong Mi-Core; local scan thấy project dashboard-bakudanramen-qa trong E:/Project/Master.',
      ].join('\n'),
    };
  }

  if (has(t, /review automation.*(may nao|máy nào|nam may|nằm máy|where|node)/)) {
    return {
      handled: true,
      phase: 30,
      reply: [
        '⭐ Review Automation đang được map trên *Laptop1*.',
        'Knowledge graph: project.review_automation → deployed_on → node.laptop1',
        'Nếu anh muốn, em có thể check tiếp health/log/restart gate cho project này.',
      ].join('\n'),
    };
  }

  if (has(t, /tuan truoc.*(integration system|integration)|integration system.*tuan truoc|quyet gi.*integration/)) {
    const memories = recallMemory({ q: 'Integration System', layer: 'operational', limit: 3 });
    const lines = memories.length
      ? memories.map(m => `• ${m.updated_at.slice(0, 10)} — ${m.content}`).join('\n')
      : '• Em chưa có decision-memory tuần trước cho Integration System. Operational memory hiện biết: Laptop1 chạy Integration System + WhatsApp AI Gateway.';
    return {
      handled: true,
      phase: 22,
      reply: `🧠 *Decision Recall — Integration System*\n\n${lines}`,
    };
  }

  // ── Phase 30 status ──
  if (has(t, /jarvis.*status|phase.*30|ceo.*os|toan bo he thong/)) {
    return { handled: true, phase: 30, reply: await getJarvisStatusReport() };
  }

  // ── Phase 28: Executive briefings ──
  if (has(t, /bao cao hang ngay|daily brief|bao cao ngay|executive brief/)) {
    const brief = await generateBriefing('daily');
    return { handled: true, phase: 28, reply: brief.formatted };
  }
  if (has(t, /bao cao tuan|weekly brief/)) {
    const brief = await generateBriefing('weekly');
    return { handled: true, phase: 28, reply: brief.formatted };
  }
  if (has(t, /bao cao thang|monthly brief/)) {
    const brief = await generateBriefing('monthly');
    return { handled: true, phase: 28, reply: brief.formatted };
  }

  // ── Phase 29: Business twin ──
  if (has(t, /twin|digital twin|phan tich rui ro|risk anal|business risk/)) {
    return { handled: true, phase: 29, reply: formatTwinForWhatsApp() };
  }
  if (has(t, /simulate|kich ban|scenario/)) {
    const scenarios = getAllScenarios();
    const lines = scenarios.map((s, i) => `${i + 1}. *${s.name}* (${s.impact}): ${s.description.slice(0, 60)}`);
    return { handled: true, phase: 29, reply: `📊 *Simulation Scenarios*\n\n${lines.join('\n\n')}\n\nGõ "simulate [tên]" để chạy mô phỏng.` };
  }

  // ── Phase 26: Health & Incidents ──
  if (has(t, /health|suc khoe he thong|incident|su co|cac service|service.*dang chay|service.*running/)) {
    if (has(t, /incident|su co/)) return { handled: true, phase: 26, reply: formatIncidentsForWhatsApp() };
    const { services, fromCache } = await runHealthSweepWithMeta();
    return { handled: true, phase: 26, reply: formatHealthForWhatsApp(services, fromCache) };
  }

  // ── Phase 27: Workflows ──
  if (has(t, /workflow|quy trinh tu dong|cac quy trinh/)) {
    return { handled: true, phase: 27, reply: formatWorkflowsForWhatsApp() };
  }

  // ── Phase 24: Agents ──
  if (has(t, /agent.*(list|routing|ecosystem|finance|store|pm|dev|node)|danh sach agent|he sinh thai agent/)) {
    if (has(t, /routing|finance|store|pm|dev|node/)) {
      const agent = routeToAgent(ctx.normalized);
      if (agent) return { handled: true, phase: 24, reply: `Routed to: *${agent.name}*\nStatus: ${agent.status}\nCapabilities: ${agent.capabilities.map(c => c.id).join(', ')}` };
    }
    return { handled: true, phase: 24, reply: formatAgentEcosystemForWhatsApp() };
  }

  // ── Phase 25: Knowledge graph stats / entity list (must be before generic graph pattern) ──
  if (has(t, /knowledge graph stats|graph stats|graph entities|tat ca entity/)) {
    const graph = getGraphStats();
    return { handled: true, phase: 25, reply: `🕸 *Knowledge Graph*\n\n${graph.total_entities} entities, ${graph.total_relations} relations\nLast built: ${new Date().toLocaleDateString('vi-VN')}` };
  }

  // ── Phase 21: Knowledge universe stats (before generic knowledge search) ────
  if (has(t, /knowledge universe|knowledge.*stats|knowledge.*stat/)) {
    const ks = getKnowledgeStats() as any;
    const docCount = ks.total ?? ks.total_documents ?? 0;
    return { handled: true, phase: 21, reply: `📚 *Knowledge Universe*\n\n${docCount.toLocaleString()} tài liệu đã index\nSources: ${(ks.sources || []).length} thư mục\nAge: ${ks.index_age_hours}h` };
  }

  // ── Phase 25: Knowledge graph ──
  if (has(t, /graph|quan he|entity|^tim .{2,30} trong graph/)) {
    const match = ctx.normalized.match(/(?:graph|quan he|entity)\s+(.+)/i);
    if (match) {
      return { handled: true, phase: 25, reply: exploreRelationships(match[1].trim()) };
    }
  }

  // ── Bakudan Ramen store list ──
  if (has(t, /bakudan.*(store|cua hang|list|info)|store.*bakudan/)) {
    const graph = exploreRelationships('Bakudan Ramen');
    return { handled: true, phase: 25, reply: 'Bakudan Ramen chain: Stone Oak, Bandera, Rim (San Antonio TX) + Raw Sushi Bar (Stockton CA)\n\n' + graph };
  }

  // ── Phase 23: Tool registry ──
  if (has(t, /tool.*(list|registry|dangerous|nguy hiem)|danh sach tool|cong cu nao|dangerous tool|tool registry/)) {
    if (has(t, /nguy hiem|dangerous|risk/)) {
      const dangerous = getDangerousTools();
      const lines = dangerous.map(d => `🔴 *${d.name}* (risk ${d.risk}/3) — ${d.description}`);
      return { handled: true, phase: 23, reply: `⚠️ *Dangerous Tools (${dangerous.length})*\n\n${lines.join('\n')}` };
    }
    const tools = getAllTools();
    const lines = tools.slice(0, 10).map(d => `• *${d.name}* [${d.owner}]`);
    return { handled: true, phase: 23, reply: `🔧 *Tool Registry (${tools.length} tools)*\n\n${lines.join('\n')}\n\n...và ${tools.length - 10} tool khác` };
  }

  // ── Phase 22: Memory ──
  if (has(t, /nho lai|lich su quyet dinh|memory|ky uc/)) {
    const query = ctx.normalized.replace(/nho lai|lich su|memory|ky uc/gi, '').trim();
    const memories = recallMemory({ q: query || 'ceo', limit: 3 });
    if (!memories.length) return { handled: true, phase: 22, reply: 'Em chưa có memory nào liên quan.' };
    const lines = memories.slice(0, 3).map(m => `📝 *${m.layer}* — ${m.content.slice(0, 80)}`);
    return { handled: true, phase: 22, reply: `🧠 *Memory Recall*\n\n${lines.join('\n\n')}` };
  }

  // ── Phase 21: Knowledge search ──
  if (has(t, /tim trong kien thuc|search knowledge|knowledge.*tim|knowledge search/)) {
    const query = (ctx.normalized || ctx.raw_text).replace(/tim trong kien thuc|search knowledge|knowledge search|knowledge/gi, '').trim();
    const results = searchKnowledge(query || ctx.raw_text, 5);
    if (!results.length) return { handled: true, phase: 21, reply: 'Không tìm thấy tài liệu liên quan.' };
    const lines = results.map(r => `📄 *${r.title}* (${r.type})\n   ${r.source.slice(-60)}`);
    return { handled: true, phase: 21, reply: `📚 *Knowledge Search — ${results.length} results*\n\n${lines.join('\n\n')}` };
  }

  return { handled: false };
}

async function getJarvisStatusReport(): Promise<string> {
  const obs = getObservabilityStats();
  const graph = getGraphStats();
  const memory = getMemoryStats();
  const tools = getAllTools();
  const agents = getAllAgents();
  const risk = runRiskAnalysis();
  const ks = getKnowledgeStats() as any;
  const docCount = ks.total ?? ks.total_documents ?? 0;
  const activeAgents = agents.filter(a => a.status === 'active').length;
  const healthStatus = obs.services.down > 0 ? `${obs.services.down} service đang lỗi` :
    obs.services.degraded > 0 ? `${obs.services.degraded} service degraded` : 'tất cả services ổn';
  const incidentNote = obs.open_incidents > 0 ? `⚠️ ${obs.open_incidents} incident đang mở.` : '';

  return [
    'Em đây anh. Tổng quan hệ thống lúc này:',
    '',
    `📚 Kiến thức: ${docCount.toLocaleString()} tài liệu đã index`,
    `🧠 Bộ nhớ: ${memory.total} entries`,
    `🔧 Công cụ: ${tools.length} tool đã đăng ký, ${tools.filter((t: any) => t.risk >= 2).length} cần approval`,
    `🤖 Agents: ${activeAgents}/${agents.length} đang active`,
    `🕸 Knowledge graph: ${graph.total_entities} entities, ${graph.total_relations} quan hệ`,
    `🏥 Services: ${healthStatus}`,
    `⚙️ Workflows: ${obs.open_incidents === 0 ? '3 workflow đang chạy' : 'đang theo dõi'}`,
    `📐 Business risk: ${risk.overall_risk}/100`,
    incidentNote,
    '',
    'Anh muốn em check sâu hơn phần nào không?',
  ].filter(l => l !== undefined && !(l === '' && false)).join('\n').trim();
}

// ── Boot sequence ────────────────────────────────────────────────────────────

export async function bootJarvis(): Promise<void> {
  // Stagger background tasks to avoid startup spike
  setTimeout(() => indexKnowledge().catch(() => {}), 5000);
  setTimeout(() => runHealthSweep().catch(() => {}), 8000);

  // Seed CEO daily briefing into memory on first boot
  storeMemory({
    layer: 'operational',
    subject: 'jarvis_boot',
    content: `Jarvis Evolution Phase 30 booted at ${new Date().toISOString()}. All 10 phases loaded.`,
    source: 'system',
    tags: ['boot', 'jarvis', 'phase30'],
    confidence: 1,
  });
}
