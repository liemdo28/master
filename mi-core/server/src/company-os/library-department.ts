/**
 * Mi Company OS — Library Department (Source-Truth).
 *
 * Step 6 of the 12-step pipeline. Loads the REAL live business snapshot
 * (Asana tasks, emails, calendar, projects, health, connectors) in-process so
 * every command runs against real data instead of "no active connector".
 *
 * Also exported: loadSnapshotContext() — a detailed real-data context string
 * that executing departments inject into their brain prompt so they ANSWER
 * from real data instead of hallucinating "data unavailable".
 *
 * Autonomy: FULL_AUTO (read-only). No approval required.
 */
import { getDailySnapshot } from '../visibility/visibility-hub';
import type { DeptReport } from './report-center';

const DEPT_ID = 'library';
const DEPT_NAME = 'Library';

function n(v: unknown, d = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

export interface SnapshotContext {
  /** One-line factual summary for the CEO report. */
  summary: string;
  /** Detailed real-data context for the executing department's brain prompt. */
  contextText: string;
  /** Raw snapshot for downstream use. */
  snapshot: any;
}

/**
 * Load the live snapshot and turn it into both a one-line summary and a
 * detailed context block the brain can answer from.
 */
export async function loadSnapshotContext(): Promise<SnapshotContext> {
  const snap: any = await getDailySnapshot();

  const tasks = snap?.tasks || {};
  const emails = snap?.emails || {};
  const cal = snap?.calendar || {};
  const projects = snap?.projects || {};
  const platforms = snap?.platforms || {};
  const accounting = snap?.accounting || {};
  const foodSafety = snap?.food_safety || {};
  const revenue = snap?.revenue || {};
  const connectedCount = Array.isArray(platforms.connected) ? platforms.connected.length : 0;

  const facts: string[] = [
    `${n(tasks.asana_my_tasks)} task Asana (${n(tasks.asana_overdue)} qua han)`,
    `${n(emails.unread)} email chua doc (${n(emails.important)} quan trong)`,
    `${n(cal.today_count)} su kien lich hom nay`,
    `${n(projects.total)} project (${n(projects.with_issues)} co issue)`,
    `${connectedCount} connector dang ket noi`,
  ];

  if (revenue.status === 'ok') {
    const parts: string[] = [];
    if (revenue.toast_net_sales) parts.push(`Toast $${Number(revenue.toast_net_sales).toLocaleString()}`);
    if (revenue.doordash_net_payout) parts.push(`DoorDash $${Number(revenue.doordash_net_payout).toLocaleString()}`);
    if (parts.length) facts.push(`doanh thu: ${parts.join(' + ')}`);
  }

  const gaps: string[] = [];
  if (accounting.status && accounting.status !== 'synced') gaps.push('ke toan chua dong bo (QuickBooks Web Connector offline)');
  if (n(foodSafety.total_records) === 0) gaps.push('food-safety chua co du lieu');
  if (revenue.status !== 'ok') gaps.push('doanh thu Toast/DoorDash (chay tools/upload-revenue.mjs tren laptop1 sau khi export CSV)');

  const summary =
    `Nguon su that (live): ${facts.join(', ')}.` +
    (gaps.length ? ` Chua co: ${gaps.join(', ')}.` : '');

  // Detailed block for the brain — include actionable specifics.
  const lines: string[] = ['LIVE BUSINESS SNAPSHOT (real data — answer ONLY from this; do not invent numbers):'];
  lines.push(`- Tasks (Asana): ${n(tasks.asana_my_tasks)} total, ${n(tasks.asana_overdue)} overdue.`);
  lines.push(`- Emails: ${n(emails.unread)} unread, ${n(emails.important)} important.`);
  lines.push(`- Calendar today: ${n(cal.today_count)} events${Array.isArray(cal.events_today) ? ' — ' + cal.events_today.map((e: any) => e.title || e).slice(0, 5).join('; ') : ''}.`);
  lines.push(`- Projects: ${n(projects.total)} total, ${n(projects.with_issues)} with issues.`);
  if (Array.isArray(projects.top_issues) && projects.top_issues.length) {
    lines.push(`  Projects with issues: ${projects.top_issues.map((p: any) => `${p.name} (${Array.isArray(p.issues) ? p.issues.join(', ') : p.issues})`).join('; ')}.`);
  }
  if (Array.isArray(snap?.action_items) && snap.action_items.length) {
    lines.push(`- Action items: ${snap.action_items.slice(0, 5).join('; ')}.`);
  }
  if (snap?.health?.summary) lines.push(`- Health: ${String(snap.health.summary).replace(/\n/g, ' ').slice(0, 120)}.`);
  if (revenue.status === 'ok') {
    if (revenue.toast_net_sales) lines.push(`- Toast POS net sales: $${Number(revenue.toast_net_sales).toLocaleString()} (period ending ~${String(revenue.updated_at || '').slice(0, 10)}).`);
    if (revenue.doordash_net_payout) lines.push(`- DoorDash net payout: $${Number(revenue.doordash_net_payout).toLocaleString()}.`);
    if (revenue.total_estimate) lines.push(`- Total revenue estimate (Toast+DoorDash): $${Number(revenue.total_estimate).toLocaleString()}.`);
  }
  if (gaps.length) lines.push(`- NOT AVAILABLE (say so honestly, do not fabricate): ${gaps.join('; ')}.`);

  return { summary, contextText: lines.join('\n'), snapshot: snap };
}

/**
 * Step 6 executor — returns the source-truth summary as a high-confidence
 * DeptReport (real live data).
 */
export async function executeLibraryRequest(args: {
  pipeline_id: string;
  intent: string;
  command: string;
}): Promise<DeptReport> {
  try {
    const { summary, snapshot } = await loadSnapshotContext();
    return {
      dept_id: DEPT_ID,
      dept_name: DEPT_NAME,
      summary,
      result: snapshot,
      status: 'done',
      evidence_count: 5,
      confidence: 0.96,
    };
  } catch (e) {
    return {
      dept_id: DEPT_ID,
      dept_name: DEPT_NAME,
      summary: `Source-truth unavailable: ${e instanceof Error ? e.message : String(e)}`,
      status: 'failed',
      evidence_count: 0,
      confidence: 0.4,
    };
  }
}
