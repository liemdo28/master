/**
 * Executive Briefing Engine — Phase 17
 *
 * Composes a CEO morning briefing from live operational data.
 * Sources: Phase 16 TaskDataCollector (work orders, blockers, approvals, graph risks)
 *          Phase 15 OperationalMemory (period stats, system health)
 *
 * No LLM required. All data-driven.
 */

import fs from 'fs';
import path from 'path';

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const GLOBAL_DIR = path.join(MI_CORE_ROOT, '.local-agent-global');

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BriefingSection {
  key: string;
  heading: string;
  body: string;
  item_count: number;
  severity: 'ok' | 'warn' | 'critical';
}

export interface ExecutiveBriefing {
  briefing_id: string;
  generated_at: string;
  date_vi: string;           // e.g. "Thứ Hai, 13/06/2026"
  time_vi: string;           // e.g. "07:00 ICT"
  sections: BriefingSection[];
  recommendation: string;
  full_text: string;         // WhatsApp-ready complete message
  data_sources: string[];
  severity: 'ok' | 'warn' | 'critical';
}

// ── Cache — stores last briefing ──────────────────────────────────────────────

const CACHE_PATH = path.join(GLOBAL_DIR, 'executive-briefing', 'last-briefing.json');

function saveCache(b: ExecutiveBriefing) {
  try {
    const dir = path.dirname(CACHE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(b, null, 2), 'utf8');
  } catch { /* never crash */ }
}

export function getLastBriefing(): ExecutiveBriefing | null {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch { return null; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function vietnamDateTime(): { date_vi: string; time_vi: string } {
  const now = new Date();
  const vn = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dd = String(vn.getDate()).padStart(2, '0');
  const mm = String(vn.getMonth() + 1).padStart(2, '0');
  const yyyy = vn.getFullYear();
  const hh = String(vn.getHours()).padStart(2, '0');
  const min = String(vn.getMinutes()).padStart(2, '0');
  return {
    date_vi: `${days[vn.getDay()]}, ${dd}/${mm}/${yyyy}`,
    time_vi: `${hh}:${min} ICT`,
  };
}

function priorityLabel(p: string): string {
  const m: Record<string, string> = { P0: '🔴 P0', P1: '🟠 P1', P2: '🟡 P2', P3: '🟢 P3' };
  return m[p] || p;
}

function ageLabel(h: number): string {
  if (h < 1) return 'vừa xong';
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

// ── Section builders ──────────────────────────────────────────────────────────

function buildTasksSection(snap: any): BriefingSection {
  const { open_work_orders: wos, open_blockers: blockers, pending_approvals: approvals } = snap;
  const total = wos.length + blockers.length + approvals.length;

  const lines: string[] = [];
  if (total === 0) {
    lines.push('Không có task nào đang mở. ✅');
  } else {
    if (wos.length > 0) lines.push(`📋 ${wos.length} work order đang mở`);
    if (approvals.length > 0) lines.push(`✋ ${approvals.length} approval chờ duyệt`);
    if (blockers.length > 0) lines.push(`🔴 ${blockers.length} blocker chưa xử lý`);

    const top = [...wos, ...approvals, ...blockers]
      .sort((a, b) => (['P0','P1','P2','P3'].indexOf(a.priority) || 9) - (['P0','P1','P2','P3'].indexOf(b.priority) || 9))
      .slice(0, 3);
    if (top.length > 0) {
      lines.push('');
      for (const t of top) {
        lines.push(`   ${priorityLabel(t.priority)} ${t.title.slice(0, 55)}${t.title.length > 55 ? '…' : ''}`);
        if (t.project) lines.push(`   ↳ ${t.project} (${ageLabel(t.age_hours)})`);
      }
    }
  }

  const hasCritical = wos.some((w: any) => w.priority === 'P0') || blockers.some((b: any) => b.priority === 'P0');
  return {
    key: 'tasks',
    heading: `1️⃣ Tasks — ${total} đang mở`,
    body: lines.join('\n'),
    item_count: total,
    severity: hasCritical ? 'critical' : total > 0 ? 'warn' : 'ok',
  };
}

function buildApprovalsSection(snap: any): BriefingSection {
  const approvals = snap.pending_approvals || [];
  const certs = snap.certifications_pending || [];
  const total = approvals.length + certs.length;

  const lines: string[] = [];
  if (total === 0) {
    lines.push('Không có gì cần anh duyệt. ✅');
  } else {
    if (approvals.length > 0) {
      lines.push(`✋ ${approvals.length} approval đang chờ:`);
      for (const a of approvals.slice(0, 3)) {
        lines.push(`   ${priorityLabel(a.priority)} ${a.title.slice(0, 60)}`);
        if (a.detail) lines.push(`   ↳ ${a.detail}`);
      }
    }
    if (certs.length > 0) {
      if (approvals.length > 0) lines.push('');
      lines.push(`📋 ${certs.length} skill chờ nâng cấp CERTIFIED`);
    }
  }

  return {
    key: 'approvals',
    heading: `2️⃣ Approvals — ${total} chờ duyệt`,
    body: lines.join('\n'),
    item_count: total,
    severity: approvals.some((a: any) => a.priority === 'P0') ? 'critical' : total > 0 ? 'warn' : 'ok',
  };
}

function buildRiskSection(snap: any): BriefingSection {
  const graphRisks: any[] = snap.graph_risks || [];
  const spofs = graphRisks.filter((r: any) => r.is_spof);
  const highRisk = graphRisks.filter((r: any) => !r.is_spof && r.criticality_score >= 50);

  const lines: string[] = [];
  if (spofs.length === 0 && highRisk.length === 0) {
    lines.push('Không có SPOF hay rủi ro cao. ✅');
    if (graphRisks.length > 0) {
      lines.push(`📊 Đang theo dõi ${graphRisks.length} thực thể — ổn định.`);
    }
  } else {
    if (spofs.length > 0) {
      lines.push(`🕸️ ${spofs.length} Single Point of Failure:`);
      for (const s of spofs) {
        lines.push(`   🔴 *${s.entity_name}* — ${s.in_degree} phụ thuộc (score: ${s.criticality_score}/100)`);
      }
    }
    if (highRisk.length > 0) {
      if (spofs.length > 0) lines.push('');
      lines.push(`⚠️ ${highRisk.length} thực thể rủi ro cao:`);
      for (const r of highRisk.slice(0, 3)) {
        lines.push(`   🟠 ${r.entity_name} — score ${r.criticality_score}/100`);
      }
    }
  }

  return {
    key: 'risk',
    heading: `3️⃣ Risk — ${spofs.length} SPOF`,
    body: lines.join('\n'),
    item_count: spofs.length,
    severity: spofs.length > 0 ? 'warn' : 'ok',
  };
}

function buildTeamSection(snap: any): BriefingSection {
  const activity: any[] = snap.recent_team_activity || [];
  const wos: any[] = snap.open_work_orders || [];

  const byRole: Record<string, { count: number; pass: number; latest: string }> = {};
  for (const a of activity) {
    if (!byRole[a.agent_role]) byRole[a.agent_role] = { count: 0, pass: 0, latest: a.action_type };
    byRole[a.agent_role].count++;
    if (a.verdict === 'PASS') byRole[a.agent_role].pass++;
  }

  const roleDisplay: Record<string, string> = {
    engineering_manager: 'Dev1',
    developer: 'Dev1',
    product_manager: 'PM',
    qa_agent: 'QA',
    qa: 'QA',
    release: 'Release',
    auditor_agent: 'Auditor',
  };

  const lines: string[] = [];
  if (activity.length === 0) {
    lines.push('Không có hoạt động nào trong 24h qua.');
  } else {
    lines.push(`${activity.length} actions trong 24h:`);
    for (const [role, stat] of Object.entries(byRole)) {
      const label = roleDisplay[role] || role;
      lines.push(`   👤 ${label} — ${stat.count} actions (${stat.pass} PASS) | ${stat.latest}`);
    }
  }
  if (wos.length > 0) {
    lines.push('');
    lines.push(`📋 ${wos.length} WO đang xử lý:`);
    for (const wo of wos.slice(0, 3)) {
      lines.push(`   • [${wo.status?.toUpperCase()}] ${wo.project || 'N/A'} — ${wo.title.slice(0, 45)}`);
    }
  }

  return {
    key: 'team',
    heading: `4️⃣ Team — ${activity.length} actions/24h`,
    body: lines.join('\n'),
    item_count: activity.length,
    severity: 'ok',
  };
}

function buildSystemHealthSection(): BriefingSection {
  const lines: string[] = [];
  let severity: BriefingSection['severity'] = 'ok';

  try {
    const { getSystemHealthSnapshot } = require('../operational-memory/temporal-intelligence');
    const health = getSystemHealthSnapshot();

    const weekRate = health.week?.success_rate ?? null;
    const monthRate = health.month?.success_rate ?? null;

    if (weekRate !== null) {
      const icon = weekRate >= 80 ? '✅' : weekRate >= 60 ? '⚠️' : '🔴';
      lines.push(`${icon} Tuần này: ${weekRate}% success (${health.week.total_executions} execs)`);
      if (weekRate < 60) severity = 'critical';
      else if (weekRate < 80) severity = 'warn';
    }
    if (monthRate !== null) {
      const icon = monthRate >= 80 ? '✅' : monthRate >= 60 ? '⚠️' : '🔴';
      lines.push(`${icon} Tháng này: ${monthRate}% success (${health.month.total_executions} execs)`);
    }

    if (weekRate !== null && monthRate !== null) {
      const delta = weekRate - monthRate;
      if (delta >= 10) lines.push('📈 Xu hướng: IMPROVING');
      else if (delta <= -10) { lines.push('📉 Xu hướng: DEGRADING ⚠️'); if (severity === 'ok') severity = 'warn'; }
      else lines.push('➡️ Xu hướng: STABLE');
    }
  } catch {
    lines.push('📊 System health: data chưa khả dụng (memory.db chưa sync)');
  }

  if (lines.length === 0) lines.push('Không có dữ liệu health.');

  return {
    key: 'health',
    heading: `5️⃣ System Health`,
    body: lines.join('\n'),
    item_count: 0,
    severity,
  };
}

function buildRecommendation(sections: BriefingSection[], snap: any): string {
  const lines: string[] = ['💡 *Recommendation:*'];

  const approvalSection = sections.find(s => s.key === 'approvals');
  const riskSection = sections.find(s => s.key === 'risk');
  const taskSection = sections.find(s => s.key === 'tasks');
  const healthSection = sections.find(s => s.key === 'health');

  // Critical first
  if (riskSection && riskSection.item_count > 0) {
    const spofNames = (snap.graph_risks || []).filter((r: any) => r.is_spof).map((r: any) => r.entity_name).join(', ');
    lines.push(`🔴 Priority 1 — Lên kế hoạch giảm phụ thuộc vào ${spofNames || 'SPOF entities'}`);
  }
  if (approvalSection && approvalSection.item_count > 0) {
    lines.push(`✋ Priority 2 — Duyệt ${approvalSection.item_count} approval trước 09:00`);
  }
  if (taskSection && snap.open_blockers?.length > 0) {
    const oldBlockers = snap.open_blockers.filter((b: any) => b.age_hours >= 24);
    if (oldBlockers.length > 0) {
      lines.push(`🔴 Priority 3 — ${oldBlockers.length} blocker tồn tại hơn 24h — cần xử lý ngay`);
    }
  }
  if (healthSection && healthSection.severity === 'warn') {
    lines.push(`📉 Chú ý — Success rate đang giảm. Kiểm tra workflow hiệu quả.`);
  }

  if (lines.length === 1) {
    lines.push('✅ Hệ thống ổn định. Tập trung vào roadmap hôm nay.');
  }

  return lines.join('\n');
}

// ── Asana section ─────────────────────────────────────────────────────────────

export async function buildAsanaSection(): Promise<BriefingSection> {
  const token = process.env.ASANA_TOKEN;
  if (!token) {
    return { key: 'asana', heading: '6️⃣ Asana Tasks', body: 'Asana chưa được cấu hình (set ASANA_TOKEN).', item_count: 0, severity: 'ok' };
  }

  try {
    const https = require('https');
    const tasks = await new Promise<any[]>((resolve, reject) => {
      const opts = {
        hostname: 'app.asana.com',
        path: '/api/1.0/tasks?assignee=me&opt_fields=name,due_on,completed,priority&limit=20&completed_since=now',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      };
      https.get(opts, (res: any) => {
        let raw = '';
        res.on('data', (d: any) => { raw += d; });
        res.on('end', () => {
          try { resolve(JSON.parse(raw).data || []); } catch { resolve([]); }
        });
      }).on('error', reject);
    });

    const open = tasks.filter((t: any) => !t.completed);
    const dueToday = open.filter((t: any) => {
      if (!t.due_on) return false;
      const today = new Date().toISOString().slice(0, 10);
      return t.due_on <= today;
    });
    const overdue = dueToday.filter((t: any) => t.due_on && t.due_on < new Date().toISOString().slice(0, 10));

    const lines: string[] = [];
    if (open.length === 0) {
      lines.push('Không có Asana task nào đang mở. ✅');
    } else {
      lines.push(`📌 ${open.length} task đang mở${dueToday.length > 0 ? `, ${dueToday.length} đến hạn hôm nay` : ''}`);
      if (overdue.length > 0) lines.push(`⚠️ ${overdue.length} task quá hạn`);
      for (const t of open.slice(0, 5)) {
        const due = t.due_on ? ` (${t.due_on})` : '';
        const icon = t.due_on && t.due_on < new Date().toISOString().slice(0, 10) ? '🔴' : '📌';
        lines.push(`   ${icon} ${t.name.slice(0, 60)}${due}`);
      }
      if (open.length > 5) lines.push(`   … và ${open.length - 5} task khác`);
    }

    return {
      key: 'asana', heading: `6️⃣ Asana — ${open.length} task mở`,
      body: lines.join('\n'), item_count: open.length,
      severity: overdue.length > 0 ? 'warn' : 'ok',
    };
  } catch (e: any) {
    return { key: 'asana', heading: '6️⃣ Asana Tasks', body: `Không thể kết nối Asana: ${e.message}`, item_count: 0, severity: 'ok' };
  }
}

// ── Google Calendar section ────────────────────────────────────────────────────

export async function buildCalendarSection(): Promise<BriefingSection> {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return { key: 'calendar', heading: '7️⃣ Lịch hôm nay', body: 'Em chưa kết nối được Google Calendar lúc này (GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN chưa cấu hình).', item_count: 0, severity: 'ok' };
  }

  try {
    const https = require('https');

    // Refresh access token
    const tokenRes = await new Promise<any>((resolve, reject) => {
      const body = new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        refresh_token: refreshToken, grant_type: 'refresh_token',
      }).toString();
      const opts = {
        hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
      };
      const req = https.request(opts, (res: any) => {
        let raw = ''; res.on('data', (d: any) => { raw += d; });
        res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error('Token parse failed')); } });
      });
      req.on('error', reject); req.write(body); req.end();
    });

    const accessToken = tokenRes.access_token;
    if (!accessToken) throw new Error('No access token returned');

    // Get today's events
    const vnNow  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const start  = new Date(vnNow.getFullYear(), vnNow.getMonth(), vnNow.getDate()).toISOString();
    const end    = new Date(vnNow.getFullYear(), vnNow.getMonth(), vnNow.getDate() + 1).toISOString();
    const query  = new URLSearchParams({ timeMin: start, timeMax: end, singleEvents: 'true', orderBy: 'startTime', maxResults: '10' }).toString();

    const events = await new Promise<any[]>((resolve, reject) => {
      https.get({
        hostname: 'www.googleapis.com',
        path: `/calendar/v3/calendars/primary/events?${query}`,
        headers: { Authorization: `Bearer ${accessToken}` },
      }, (res: any) => {
        let raw = ''; res.on('data', (d: any) => { raw += d; });
        res.on('end', () => { try { resolve(JSON.parse(raw).items || []); } catch { resolve([]); } });
      }).on('error', reject);
    });

    const lines: string[] = [];
    if (events.length === 0) {
      lines.push('Không có lịch hẹn nào hôm nay. 🗓️');
    } else {
      lines.push(`📅 ${events.length} sự kiện hôm nay:`);
      for (const ev of events) {
        const startStr = ev.start?.dateTime
          ? new Date(ev.start.dateTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
          : 'cả ngày';
        lines.push(`   🕐 ${startStr} — ${(ev.summary || '(no title)').slice(0, 55)}`);
        if (ev.location) lines.push(`      📍 ${ev.location.slice(0, 50)}`);
      }
    }

    return {
      key: 'calendar', heading: `7️⃣ Lịch — ${events.length} sự kiện`,
      body: lines.join('\n'), item_count: events.length, severity: 'ok',
    };
  } catch (e: any) {
    return { key: 'calendar', heading: '7️⃣ Lịch hôm nay', body: `Không thể tải lịch: ${e.message}`, item_count: 0, severity: 'ok' };
  }
}

// ── Main engine ────────────────────────────────────────────────────────────────

export async function generateExecutiveDailyBriefingFull(): Promise<ExecutiveBriefing> {
  const [asana, calendar] = await Promise.all([buildAsanaSection(), buildCalendarSection()]);
  const base = generateExecutiveDailyBriefing();

  // Only append if there's meaningful data
  const extra: BriefingSection[] = [];
  if (process.env.ASANA_TOKEN)     extra.push(asana);
  if (process.env.GOOGLE_REFRESH_TOKEN) extra.push(calendar);
  if (extra.length === 0) return base;

  const extraLines = extra.map(s => `\n*${s.heading}*\n${s.body}`).join('\n');
  return {
    ...base,
    sections: [...base.sections, ...extra],
    full_text: base.full_text.replace('─────────────────────────\n\n💡', `${extraLines}\n\n─────────────────────────\n\n💡`),
    data_sources: [...base.data_sources, ...(process.env.ASANA_TOKEN ? ['asana'] : []), ...(process.env.GOOGLE_REFRESH_TOKEN ? ['google_calendar'] : [])],
  };
}

export function generateExecutiveDailyBriefing(): ExecutiveBriefing {
  const { date_vi, time_vi } = vietnamDateTime();

  // Load snapshot from Phase 16
  const { buildSnapshot } = require('../task-intelligence/task-data-collector');
  const snap = buildSnapshot();

  const sections: BriefingSection[] = [
    buildTasksSection(snap),
    buildApprovalsSection(snap),
    buildRiskSection(snap),
    buildTeamSection(snap),
    buildSystemHealthSection(),
  ];

  const recommendation = buildRecommendation(sections, snap);

  // Overall severity
  const overallSeverity = sections.some(s => s.severity === 'critical') ? 'critical'
    : sections.some(s => s.severity === 'warn') ? 'warn'
    : 'ok';

  const severityIcon = overallSeverity === 'critical' ? '🔴' : overallSeverity === 'warn' ? '🟡' : '✅';

  // Compose WhatsApp message
  const lines: string[] = [
    `🌅 *Báo cáo Sáng — Mi*`,
    `📅 ${date_vi} | ⏰ ${time_vi}`,
    `${severityIcon} Status tổng thể: ${overallSeverity.toUpperCase()}`,
    '',
    '─────────────────────────',
  ];

  for (const sec of sections) {
    lines.push('');
    lines.push(`*${sec.heading}*`);
    lines.push(sec.body);
  }

  lines.push('');
  lines.push('─────────────────────────');
  lines.push('');
  lines.push(recommendation);

  lines.push('');
  lines.push('─────────────────────────');
  lines.push(`_Mi | ${time_vi} | Phase 17_`);

  const briefing: ExecutiveBriefing = {
    briefing_id: `BR-${Date.now()}`,
    generated_at: new Date().toISOString(),
    date_vi,
    time_vi,
    sections,
    recommendation,
    full_text: lines.join('\n'),
    data_sources: ['work_orders', 'operational_memory', 'graph_intelligence', 'approval_gate', 'certifications', 'execution_ledger'],
    severity: overallSeverity,
  };

  saveCache(briefing);
  return briefing;
}
