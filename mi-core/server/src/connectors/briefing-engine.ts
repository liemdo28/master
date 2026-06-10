/**
 * Daily Briefing Engine — answers "Hôm nay anh nên làm gì?"
 *
 * BRIEFING FORMAT:
 * - Owner Time (Vietnam ICT/UTC+7 — PRIMARY)
 * - Store Times (Chicago CDT, Los Angeles PDT — secondary)
 * - Pending Tasks
 * - Approvals
 * - Project Health
 *
 * Owner timezone always used as basis for date/time references.
 */

import { getProjectsWithIssues } from './project-connector';
import { getPending } from '../approval/gate';
import { ownerProfile } from '../services/owner-profile';
import { askAi } from '../services/ai-client';
import { getOwnerTimezone, getAllClocks, STORE_TIMEZONES } from '../utils/timezone';

export interface BriefingData {
  date: string;
  time_of_day: 'morning' | 'afternoon' | 'evening' | 'night';
  owner_time: string;
  store_times: Record<string, string>;
  projects_with_issues: number;
  pending_approvals: number;
  top_issues: string[];
  raw_context: string;
}

function getTimeOfDay(): BriefingData['time_of_day'] {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

export async function generateBriefing(): Promise<{ briefing: string; data: BriefingData }> {
  const timeOfDay = getTimeOfDay();
  const now = new Date();
  const ownerTz = getOwnerTimezone();
  const clocks = getAllClocks();

  const dateStr = now.toLocaleDateString('vi-VN', {
    timeZone: ownerTz,
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // Gather real data
  const issueProjects = getProjectsWithIssues();
  const pendingApprovals = getPending();
  const profile = ownerProfile.getAll();
  const workStyle = profile.work_style as Record<string, unknown>;

  const topIssues = issueProjects.slice(0, 5).map(p =>
    `${p.name}: ${p.issues.join(', ')}`
  );

  const data: BriefingData = {
    date: dateStr,
    time_of_day: timeOfDay,
    owner_time: clocks.owner.full,
    store_times: Object.fromEntries(
      Object.entries(clocks.stores).map(([k, v]) => [k, v.full])
    ),
    projects_with_issues: issueProjects.length,
    pending_approvals: pendingApprovals.length,
    top_issues: topIssues,
    raw_context: '',
  };

  // Build context for AI — OWNER timezone primary
  const greetings: Record<string, string> = {
    morning: 'Chào buổi sáng anh',
    afternoon: 'Chào buổi chiều anh',
    evening: 'Chào buổi tối anh',
    night: 'Anh vẫn còn làm việc khuya thế',
  };

  const storeTimeLines = Object.entries(clocks.stores)
    .map(([name, ft]) => `  ${name}: ${ft.full}`)
    .join('\n');

  const contextLines = [
    `=== BRIEFING FORMAT ===`,
    `Owner Time (PRIMARY): ${clocks.owner.full}`,
    `Store Times (secondary):`,
    storeTimeLines,
    ``,
    `=== TODAY'S DATA (Owner timezone basis) ===`,
    `Hôm nay: ${dateStr}`,
    `Projects có vấn đề: ${issueProjects.length}`,
    issueProjects.length > 0 ? `Chi tiết: ${topIssues.join(' | ')}` : 'Tất cả projects sạch.',
    `Pending approvals: ${pendingApprovals.length}`,
    pendingApprovals.length > 0
      ? `Cần approve: ${pendingApprovals.map(a => a.description).join(', ')}`
      : '',
    workStyle?.focus_areas
      ? `Focus areas của anh: ${(workStyle.focus_areas as string[]).join(', ')}`
      : '',
  ].filter(Boolean).join('\n');

  data.raw_context = contextLines;

  const prompt = `${greetings[timeOfDay]}.

Context thực tế hôm nay:
${contextLines}

Dựa trên context trên, hãy tạo daily briefing ngắn gọn cho anh (CEO):
- Lời chào ngắn
- Top 3 việc nên ưu tiên hôm nay (dựa trên data thực)
- Nếu có project lỗi: mention cụ thể
- Nếu có pending approval: nhắc
- Kết thúc bằng 1 câu động viên ngắn

Format: tiếng Việt, súc tích, có số thứ tự, không dài dòng.`;

  const aiRes = await askAi([{ role: 'user', content: prompt }]);
  return { briefing: aiRes.text, data };
}
