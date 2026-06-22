/**
 * Daily Briefing Scheduler — morning + evening reports via WhatsApp (Session B).
 * Morning: 07:00 Vietnam time — unread, overdue tasks, QB status, approval queue, website status
 * Evening: 20:00 Vietnam time — completed tasks, pending approvals, finance alerts, workflow summary
 * Configurable via CEO preferences: daily_briefing_time, evening_briefing_time.
 */

import { generateExecutiveDailyBriefing } from '../executive-briefing/briefing-engine';
import { queueToCeo } from '../services/whatsapp-sender';
import { getPreferences } from './ceo-preference-store';
import { isMuted } from './ceo-preference-store';

let briefingTimer: ReturnType<typeof setInterval> | null = null;
let lastMorningDate = '';
let lastEveningDate = '';

function vietnamHour(): { hour: number; minute: number; dateStr: string } {
  const now = new Date();
  const vn = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return {
    hour: vn.getHours(),
    minute: vn.getMinutes(),
    dateStr: vn.toISOString().slice(0, 10),
  };
}

export async function sendDailyBriefing(): Promise<string> {
  const briefing = generateExecutiveDailyBriefing();
  queueToCeo(briefing.full_text);
  lastMorningDate = vietnamHour().dateStr;
  console.log(`[DailyBriefing] Morning sent for ${lastMorningDate} — severity: ${briefing.severity}`);
  return briefing.full_text;
}

export async function sendEveningBriefing(): Promise<string> {
  const { dateStr } = vietnamHour();

  // Build evening summary from live operational data
  const lines: string[] = [
    `🌙 *Báo cáo cuối ngày — ${dateStr}*`,
    ``,
  ];

  // Completed workflows
  try {
    const fs = require('fs');
    const path = require('path');
    const woDir = path.join(__dirname, '../../../../.local-agent-global/work-orders');
    if (fs.existsSync(woDir)) {
      const files = fs.readdirSync(woDir).filter((f: string) => f.endsWith('.json'));
      const today = dateStr;
      let completed = 0;
      let pendingApproval = 0;
      let failed = 0;
      for (const f of files.slice(-50)) {
        try {
          const wo = JSON.parse(fs.readFileSync(path.join(woDir, f), 'utf8'));
          const woDate = (wo.created_at || '').slice(0, 10);
          if (woDate !== today) continue;
          if (wo.status === 'delivered') completed++;
          else if (wo.status === 'approval_pending') pendingApproval++;
          else if (wo.status === 'rejected') failed++;
        } catch {}
      }
      lines.push(`✅ *Workflow hoàn thành hôm nay:* ${completed}`);
      lines.push(`⏳ *Chờ approval:* ${pendingApproval}`);
      if (failed > 0) lines.push(`❌ *Thất bại:* ${failed}`);
    }
  } catch {}

  // QB status
  try {
    const betterSqlite = require('better-sqlite3');
    const path = require('path');
    const qbPath = path.join(__dirname, '../../../data/qb-agent.db');
    const db = betterSqlite(qbPath, { readonly: true });
    const row = db.prepare(`SELECT machine_id, last_heartbeat FROM heartbeats ORDER BY last_heartbeat DESC LIMIT 1`).get() as any;
    db.close();
    if (row) {
      const diff = Math.round((Date.now() - new Date(row.last_heartbeat).getTime()) / 3600000);
      lines.push(`📊 *QB (${row.machine_id}):* Last sync ${diff}h ago — ${diff > 8 ? '⚠️ cần sync' : '✅ OK'}`);
    }
  } catch {}

  // Evidence captured today
  try {
    const fs = require('fs');
    const path = require('path');
    const evidenceDir = path.join(__dirname, '../../../../.local-agent-global/evidence');
    if (fs.existsSync(evidenceDir)) {
      const files = fs.readdirSync(evidenceDir).filter((f: string) => f.endsWith('.json'));
      const todayEvidence = files.filter((f: string) => {
        try {
          const e = JSON.parse(fs.readFileSync(path.join(evidenceDir, f), 'utf8'));
          return e.timestamp?.slice(0, 10) === dateStr;
        } catch { return false; }
      });
      if (todayEvidence.length > 0) {
        lines.push(`📋 *Evidence captured:* ${todayEvidence.length} items`);
      }
    }
  } catch {}

  lines.push(``);
  lines.push(`_Gửi qua Session B (Mi Assistant) • ${new Date().toISOString()}_`);

  const text = lines.join('\n');
  queueToCeo(text);
  lastEveningDate = dateStr;
  console.log(`[DailyBriefing] Evening sent for ${dateStr}`);
  return text;
}

export function startDailyBriefingScheduler() {
  if (briefingTimer) return;

  briefingTimer = setInterval(async () => {
    try {
      const prefs = getPreferences();
      const { hour, minute, dateStr } = vietnamHour();

      // Morning briefing
      const [mHour, mMin] = (prefs.daily_briefing_time || '07:00').split(':').map(Number);
      if (hour === mHour && minute === mMin && dateStr !== lastMorningDate) {
        if (!isMuted('daily_briefing')) {
          await sendDailyBriefing();
        } else {
          lastMorningDate = dateStr;
          console.log('[DailyBriefing] Morning muted — skipping.');
        }
      }

      // Evening briefing (default 20:00)
      const [eHour, eMin] = ((prefs as any).evening_briefing_time || '20:00').split(':').map(Number);
      if (hour === eHour && minute === eMin && dateStr !== lastEveningDate) {
        if (!isMuted('evening_briefing')) {
          await sendEveningBriefing();
        } else {
          lastEveningDate = dateStr;
          console.log('[DailyBriefing] Evening muted — skipping.');
        }
      }
    } catch (e) {
      console.warn('[DailyBriefing] Scheduler error:', e);
    }
  }, 60_000);

  console.log('[DailyBriefing] Scheduler started — morning 07:00, evening 20:00 (Vietnam time)');
}

export function stopDailyBriefingScheduler() {
  if (briefingTimer) { clearInterval(briefingTimer); briefingTimer = null; }
}

export function getDailyBriefingStatus() {
  const prefs = getPreferences();
  return {
    running: !!briefingTimer,
    morning_time: prefs.daily_briefing_time || '07:00',
    evening_time: (prefs as any).evening_briefing_time || '20:00',
    timezone: 'Asia/Ho_Chi_Minh',
    last_morning_sent: lastMorningDate || null,
    last_evening_sent: lastEveningDate || null,
  };
}
