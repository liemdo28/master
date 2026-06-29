/**
 * Mi Company OS — Library Department (Source-Truth).
 *
 * Step 6 of the 12-step pipeline. Loads the REAL live business snapshot
 * (Asana tasks, emails, calendar, projects, health, connectors) in-process so
 * every command runs against real data instead of "no active connector".
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

/**
 * Build a concise, CEO-readable source-truth context from the live snapshot.
 * Returns a high-confidence DeptReport (real data) plus the raw snapshot in
 * `result` for downstream departments.
 */
export async function executeLibraryRequest(args: {
  pipeline_id: string;
  intent: string;
  command: string;
}): Promise<DeptReport> {
  try {
    const snap: any = await getDailySnapshot();

    const tasks = snap?.tasks || {};
    const emails = snap?.emails || {};
    const cal = snap?.calendar || {};
    const projects = snap?.projects || {};
    const platforms = snap?.platforms || {};
    const accounting = snap?.accounting || {};
    const foodSafety = snap?.food_safety || {};

    const connectedCount = Array.isArray(platforms.connected) ? platforms.connected.length : 0;

    // Real, factual context — what the company actually knows right now.
    const facts: string[] = [];
    facts.push(`${n(tasks.asana_my_tasks)} task Asana (${n(tasks.asana_overdue)} qua han)`);
    facts.push(`${n(emails.unread)} email chua doc (${n(emails.important)} quan trong)`);
    facts.push(`${n(cal.today_count)} su kien lich hom nay`);
    facts.push(`${n(projects.total)} project (${n(projects.with_issues)} co issue)`);
    facts.push(`${connectedCount} connector dang ket noi`);

    // Honestly flag the data sources that are NOT available.
    const gaps: string[] = [];
    if (accounting.status && accounting.status !== 'synced') gaps.push('ke toan chua dong bo');
    if (n(foodSafety.total_records) === 0) gaps.push('food-safety chua co du lieu');

    const summary =
      `Nguon su that (live): ${facts.join(', ')}.` +
      (gaps.length ? ` Chua co: ${gaps.join(', ')}.` : '');

    return {
      dept_id: DEPT_ID,
      dept_name: DEPT_NAME,
      summary,
      result: snap,          // full real snapshot for downstream departments
      status: 'done',
      evidence_count: facts.length,
      confidence: 0.96,      // real live data → high confidence source-truth
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
