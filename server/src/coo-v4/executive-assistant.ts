/**
 * Domain U — Executive Assistant V4
 * Answers CEO questions from real data sources:
 * - Gmail (via google-tokens.json)
 * - QB agent status (qb-agent.db)
 * - Visibility data (projects, daily-snapshot)
 * - Pending workflows (coo-v4/workflows.db)
 * - Knowledge base
 * - Executive memory
 */

import fs   from 'fs';
import path from 'path';
import https from 'https';
import type { AgentResult } from './types';

const GLOBAL = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const MI_ROOT = process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core';

// ── Google token loader ────────────────────────────────────────────────────

function loadGoogleToken(): string | null {
  try {
    const p = path.join(GLOBAL, 'visibility', 'google-tokens.json');
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8')).access_token || null;
  } catch { return null; }
}

function gGet(token: string, hostname: string, apiPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get({ hostname, path: apiPath, headers: { Authorization: `Bearer ${token}` } }, res => {
      let d = ''; res.on('data', c => { d += c; }); res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); }
      });
    }).on('error', reject);
  });
}

// ── Data loaders ───────────────────────────────────────────────────────────

function loadVisibilitySnapshot(): any {
  try {
    const p = path.join(GLOBAL, 'visibility', 'daily-snapshot.json');
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
  } catch { return {}; }
}

function loadProjects(): any[] {
  try {
    const p = path.join(GLOBAL, 'visibility', 'projects', 'data.json');
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
  } catch { return []; }
}

function loadPendingWorkflows(): any[] {
  try {
    const Database = require('better-sqlite3');
    const p = path.join(GLOBAL, 'coo-v4', 'workflows.db');
    if (!fs.existsSync(p)) return [];
    const db = new Database(p, { readonly: true });
    const rows = db.prepare("SELECT * FROM workflows WHERE status IN ('pending','waiting_approval','running') ORDER BY created_at DESC LIMIT 10").all();
    db.close();
    return rows;
  } catch { return []; }
}

function loadQbStatus(): { status: string; last_sync: string; error: string | null; stores: number } {
  try {
    const Database = require('better-sqlite3');
    const p = path.join(MI_ROOT, 'data', 'qb-agent.db');
    if (!fs.existsSync(p)) return { status: 'not_configured', last_sync: '', error: null, stores: 0 };
    const db = new Database(p, { readonly: true });
    const state = db.prepare('SELECT * FROM dd_machine_state ORDER BY updated_at DESC LIMIT 1').get() as any;
    const stores = db.prepare('SELECT COUNT(*) as n FROM machines').get() as any;
    db.close();
    if (!state) return { status: 'no_data', last_sync: '', error: null, stores: 0 };
    return {
      status:    state.last_sync_status,
      last_sync: state.last_sync_at,
      error:     state.last_error,
      stores:    stores?.n || 0,
    };
  } catch { return { status: 'error', last_sync: '', error: 'DB error', stores: 0 }; }
}

function loadExecutiveMemory(): any {
  try {
    const files = ['owner_profile.json', 'business_memory.json', 'personal_context.json'];
    const memory: any = {};
    for (const f of files) {
      const p = path.join(GLOBAL, 'executive-memory-v2', f);
      if (fs.existsSync(p)) memory[f.replace('.json', '')] = JSON.parse(fs.readFileSync(p, 'utf8'));
    }
    return memory;
  } catch { return {}; }
}

function loadWorkOrders(): any[] {
  try {
    const dir = path.join(GLOBAL, 'work-orders');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}

// ── CEO Question Handlers ──────────────────────────────────────────────────

export async function answerHomNayAnhCogi(): Promise<AgentResult> {
  // "Hôm nay anh có gì?" — What does CEO have today?
  const t0 = Date.now();
  try {
    const snapshot = loadVisibilitySnapshot();
    const workflows = loadPendingWorkflows();
    const workOrders = loadWorkOrders();
    const memory = loadExecutiveMemory();
    const qb = loadQbStatus();

    const token = loadGoogleToken();
    let gmailUnread = 0;
    let importantEmails: any[] = [];

    if (token) {
      const gList = await gGet(token, 'gmail.googleapis.com', '/gmail/v1/users/me/messages?maxResults=10&q=is:important+is:unread').catch(() => ({}));
      importantEmails = gList.messages || [];
      const allUnread = await gGet(token, 'gmail.googleapis.com', '/gmail/v1/users/me/messages?q=is:unread&maxResults=1').catch(() => ({}));
      gmailUnread = allUnread.resultSizeEstimate || 0;
    }

    const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' });
    const owner = memory?.owner_profile?.preferred_name || 'anh';

    const items: string[] = [];

    // Gmail
    if (gmailUnread > 0) items.push(`📧 Gmail: ${gmailUnread} email chưa đọc${importantEmails.length > 0 ? ` (${importantEmails.length} quan trọng)` : ''}`);

    // Pending workflows
    if (workflows.length > 0) items.push(`⏳ ${workflows.length} workflow đang chạy/chờ duyệt`);

    // QB issue
    if (qb.status === 'error' || qb.status === 'SYNC_FAILED' || qb.error) {
      items.push(`⚠️ QB Agent: sync lỗi từ ${qb.last_sync ? new Date(qb.last_sync).toLocaleDateString('vi-VN') : '?'}`);
    }

    // Work orders
    if (workOrders.length > 0) items.push(`📋 ${workOrders.length} work order đang mở`);

    // Projects
    const projects = loadProjects();
    const risky = projects.filter(p => (p.issues || []).length > 0);
    if (risky.length > 0) items.push(`🔴 ${risky.length} project có vấn đề`);

    const lines = [
      `📅 *${today}*`,
      `Chào ${owner}! Đây là tóm tắt hôm nay:`,
      '',
      ...items.map(i => `• ${i}`),
      '',
      items.length === 0 ? '✅ Không có vấn đề cấp bách.' : `Tổng: ${items.length} mục cần chú ý.`,
    ];

    return {
      success:     true,
      output:      lines.join('\n'),
      duration_ms: Date.now() - t0,
      agent:       'executive',
      metadata:    { gmail_unread: gmailUnread, important_emails: importantEmails.length, workflows: workflows.length, qb_status: qb.status },
    };
  } catch (e: any) {
    return { success: false, output: null, error: e.message, duration_ms: Date.now() - t0, agent: 'executive', metadata: {} };
  }
}

export async function answerCoGiCanDuyet(): Promise<AgentResult> {
  // "Có gì cần duyệt?" — What needs approval?
  const t0 = Date.now();
  try {
    const workflows = loadPendingWorkflows().filter((w: any) => w.status === 'waiting_approval');
    const workOrders = loadWorkOrders().filter(wo => wo.status === 'pending_approval' || wo.intent?.requires_approval);

    const items: string[] = [];
    workflows.forEach((w: any) => items.push(`🔐 Workflow ${w.id}: ${w.name}`));
    workOrders.forEach((wo: any) => items.push(`📋 Work Order ${wo.request_id}: ${wo.raw_request?.slice(0, 60)}`));

    const lines = items.length > 0
      ? [`🔐 *Cần Duyệt (${items.length})*`, '', ...items, '', 'Anh trả lời "duyệt <id>" hoặc "huỷ <id>" — em sẽ thực hiện ngay.']
      : ['✅ Không có gì cần duyệt lúc này.'];

    return { success: true, output: lines.join('\n'), duration_ms: Date.now() - t0, agent: 'executive', metadata: { pending_count: items.length } };
  } catch (e: any) {
    return { success: false, output: null, error: e.message, duration_ms: Date.now() - t0, agent: 'executive', metadata: {} };
  }
}

export async function answerCoGiDangLo(): Promise<AgentResult> {
  // "Có gì đáng lo?" — What's concerning?
  const t0 = Date.now();
  try {
    const concerns: Array<{ level: 'high' | 'medium' | 'low'; msg: string }> = [];

    // QB sync failure
    const qb = loadQbStatus();
    if (qb.error && qb.status !== 'ok') {
      const age = qb.last_sync ? Math.floor((Date.now() - new Date(qb.last_sync).getTime()) / 86400000) : 0;
      concerns.push({ level: 'high', msg: `QB Agent sync lỗi ${age} ngày — ${qb.error?.slice(0, 80)}` });
    }

    // Pending workflows (long running)
    const workflows = loadPendingWorkflows();
    const stuckWorkflows = workflows.filter((w: any) => {
      if (!w.created_at) return false;
      const age = Date.now() - new Date(w.created_at).getTime();
      return age > 3600000; // > 1 hour
    });
    if (stuckWorkflows.length > 0) concerns.push({ level: 'medium', msg: `${stuckWorkflows.length} workflow kẹt > 1 giờ` });

    // Projects with issues
    const projects = loadProjects();
    const risky = projects.filter(p => (p.issues || []).length > 0);
    risky.forEach(p => concerns.push({ level: 'medium', msg: `Project ${p.name}: ${p.issues.slice(0, 2).join(', ')}` }));

    // Failed sync (from self-improvement)
    try {
      const Database = require('better-sqlite3');
      const wfDb = path.join(GLOBAL, 'coo-v4', 'workflows.db');
      if (fs.existsSync(wfDb)) {
        const db = new Database(wfDb, { readonly: true });
        const failCount = (db.prepare("SELECT COUNT(*) as n FROM workflows WHERE status='failed'").get() as any)?.n || 0;
        db.close();
        if (failCount > 5) concerns.push({ level: 'medium', msg: `${failCount} workflow thất bại trong lịch sử` });
      }
    } catch { /* ok */ }

    const icon = { high: '🔴', medium: '🟡', low: '🟢' };
    const highCount = concerns.filter(c => c.level === 'high').length;

    const lines = concerns.length > 0
      ? [
          `⚠️ *Đáng Lo (${concerns.length} vấn đề — ${highCount} nghiêm trọng)*`, '',
          ...concerns.map(c => `${icon[c.level]} [${c.level.toUpperCase()}] ${c.msg}`),
          '',
          highCount > 0 ? '❗ Cần xử lý ngay hôm nay.' : 'Không có vấn đề nghiêm trọng.',
        ]
      : ['✅ Không có gì đáng lo lúc này. Hệ thống ổn định.'];

    return { success: true, output: lines.join('\n'), duration_ms: Date.now() - t0, agent: 'executive', metadata: { concerns: concerns.length, high: highCount } };
  } catch (e: any) {
    return { success: false, output: null, error: e.message, duration_ms: Date.now() - t0, agent: 'executive', metadata: {} };
  }
}

export async function answerDoanhThuSaoRoi(): Promise<AgentResult> {
  // "Doanh thu sao rồi?" — How's revenue?
  const t0 = Date.now();
  try {
    const qb = loadQbStatus();
    const memory = loadExecutiveMemory();
    const businesses = memory?.business_memory?.businesses || {};

    const businessNames = Object.values(businesses).map((b: any) => b.name).join(' + ');
    const lines: string[] = [
      `💰 *Doanh Thu — ${new Date().toLocaleDateString('vi-VN')}*`,
      '',
    ];

    if (qb.status === 'error' || qb.error) {
      lines.push(`⚠️ QuickBooks: sync lỗi kể từ ${qb.last_sync ? new Date(qb.last_sync).toLocaleDateString('vi-VN') : 'không rõ'}`);
      lines.push(`   Lỗi: ${qb.error?.slice(0, 100)}`);
      lines.push('');
      lines.push('📌 Cần fix QB sync trước khi lấy được doanh thu thực.');
      lines.push('   Anh nhắn "fix quickbooks" — em sẽ xử lý.');
    } else if (qb.status === 'not_configured') {
      lines.push('⚠️ QB Agent chưa được cấu hình cho máy này.');
      lines.push('   Cần chạy QB Connector trên máy tính có QuickBooks.');
    } else {
      lines.push('✅ QB Agent đang hoạt động');
      lines.push(`Last sync: ${qb.last_sync}`);
    }

    lines.push('');
    lines.push(`Businesses: ${businessNames || 'Raw Sushi Bar + Bakudan Ramen'}`);

    return { success: true, output: lines.join('\n'), duration_ms: Date.now() - t0, agent: 'executive', metadata: { qb_status: qb.status } };
  } catch (e: any) {
    return { success: false, output: null, error: e.message, duration_ms: Date.now() - t0, agent: 'executive', metadata: {} };
  }
}

export async function answerProjectNaoRuiRo(): Promise<AgentResult> {
  // "Project nào rủi ro?" — Which projects are risky?
  const t0 = Date.now();
  try {
    const projects = loadProjects();
    const workflows = loadPendingWorkflows();
    const snapshot = loadVisibilitySnapshot();

    interface RiskyProject { name: string; risk: string; issues: string[] }
    const risky: RiskyProject[] = [];

    // From projects data
    projects.forEach(p => {
      const issues = p.issues || [];
      if (issues.length > 0) risky.push({ name: p.name, risk: 'ISSUES', issues });
    });

    // From stale work orders
    const workOrders = loadWorkOrders();
    const stale = workOrders.filter(wo => {
      const age = Date.now() - new Date(wo.created_at || 0).getTime();
      return age > 86400000; // > 24h
    });
    if (stale.length > 0) {
      risky.push({ name: 'Work Orders', risk: 'STALE', issues: stale.map(w => `${w.request_id}: ${w.raw_request?.slice(0, 50)}`).slice(0, 3) });
    }

    // QB is a risk (sync failure)
    const qb = loadQbStatus();
    if (qb.error) risky.push({ name: 'QB Agent', risk: 'SYNC_FAILED', issues: [qb.error?.slice(0, 100) || 'Checksum mismatch'] });

    const lines: string[] = [`🎯 *Project Rủi Ro — ${new Date().toLocaleDateString('vi-VN')}*`, ''];

    if (risky.length === 0) {
      lines.push('✅ Không có project nào rủi ro.');
      lines.push(`Tổng: ${projects.length} projects — tất cả ổn định.`);
    } else {
      risky.forEach((r, i) => {
        const icon = r.risk === 'SYNC_FAILED' ? '🔴' : r.risk === 'ISSUES' ? '🟡' : '🟠';
        lines.push(`${icon} ${i + 1}. ${r.name} [${r.risk}]`);
        r.issues.slice(0, 2).forEach(iss => lines.push(`   - ${iss}`));
      });
      lines.push('');
      lines.push(`${risky.length} project cần chú ý. Anh muốn em xử lý project nào trước?`);
    }

    return { success: true, output: lines.join('\n'), duration_ms: Date.now() - t0, agent: 'executive', metadata: { risky_count: risky.length, total_projects: projects.length } };
  } catch (e: any) {
    return { success: false, output: null, error: e.message, duration_ms: Date.now() - t0, agent: 'executive', metadata: {} };
  }
}

// ── Universal dispatcher ───────────────────────────────────────────────────

export async function askExecutiveAssistant(question: string): Promise<AgentResult> {
  const q = question.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  if (/hom nay|co gi hom nay|today|schedule/.test(q))  return answerHomNayAnhCogi();
  if (/can duyet|duyet|approval|approve/.test(q))        return answerCoGiCanDuyet();
  if (/dang lo|lo|risk|issue|concern|van de/.test(q))    return answerCoGiDangLo();
  if (/doanh thu|revenue|sales|bao nhieu/.test(q))       return answerDoanhThuSaoRoi();
  if (/project.*rui ro|rui ro|risky|nguy hiem/.test(q)) return answerProjectNaoRuiRo();

  // Fallback: route to most relevant
  return answerHomNayAnhCogi();
}
