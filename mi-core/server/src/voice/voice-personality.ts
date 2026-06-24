/**
 * Voice Identity — Mi speaks as COO / Executive Assistant / Operations Director.
 *
 * Rules:
 *   - No robotic log-reading
 *   - No raw metrics dumps
 *   - No workflow internal details
 *   - Executive voice: concise, actionable, professional
 *   - Vietnamese primary, English terms kept as-is
 *   - Tone: warm but decisive
 */

export type MiVoiceRole = 'ceo_brief' | 'approval_voice' | 'workflow_voice' | 'general_report';

interface VoiceIdentityConfig {
  role: MiVoiceRole;
  language: 'vi';
  tone: string;
  maxDurationSeconds: number;
  format: 'brief' | 'narrative' | 'bullet';
}

const VOICE_CONFIGS: Record<MiVoiceRole, VoiceIdentityConfig> = {
  ceo_brief: {
    role: 'ceo_brief',
    language: 'vi',
    tone: 'COO reporting to CEO — concise, decisive, actionable',
    maxDurationSeconds: 45,
    format: 'brief',
  },
  approval_voice: {
    role: 'approval_voice',
    language: 'vi',
    tone: 'Operations Director explaining an approval request — clear, 20 seconds max',
    maxDurationSeconds: 20,
    format: 'narrative',
  },
  workflow_voice: {
    role: 'workflow_voice',
    language: 'vi',
    tone: 'Operations update — status-focused, no technical details',
    maxDurationSeconds: 30,
    format: 'narrative',
  },
  general_report: {
    role: 'general_report',
    language: 'vi',
    tone: 'Executive summary — high-level, no raw data',
    maxDurationSeconds: 40,
    format: 'brief',
  },
};

/**
 * Clean text for executive voice — removes raw logs, metrics dumps, technical noise.
 */
export function cleanForVoiceIdentity(raw: string, role: MiVoiceRole = 'general_report'): string {
  const config = VOICE_CONFIGS[role];
  let text = raw;

  // Remove markdown formatting
  text = text.replace(/\*+/g, '');
  text = text.replace(/#{1,6}\s/g, '');
  text = text.replace(/`[^`]+`/g, '');
  text = text.replace(/_{2,}/g, '');

  // Remove internal noise patterns
  text = text.replace(/📋|📧|📅|✅|⚠️|🔐|🟢|🟡|🔴|⏳|🚨/g, '');
  text = text.replace(/\[.*?\]/g, ''); // Remove bracket content
  text = text.replace(/Port \d+/gi, '');
  text = text.replace(/PID \d+/gi, '');
  text = text.replace(/HTTP \d+/gi, '');
  text = text.replace(/process\.env\.\w+/gi, '');
  text = text.replace(/\.ts:\d+:\d+/g, '');
  text = text.replace(/node_modules\/[^\s]+/g, '');

  // Collapse whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/ {3,}/g, ' ');

  return text.trim();
}

/**
 * Summarize raw metrics into executive format.
 *
 * Input: "42 chưa đọc, 10 quan trọng. 855 tasks, 63 quá hạn. 257 pending approvals."
 * Output: { priorities: [...], risks: [...], actions: [...] }
 */
export interface ExecutiveSummary {
  one_liner: string;
  priorities: string[];
  risks: string[];
  actions: string[];
}

export function summarizeToExecutive(raw_text: string): ExecutiveSummary {
  const text = raw_text.toLowerCase();

  const priorities: string[] = [];
  const risks: string[] = [];
  const actions: string[] = [];

  // Extract and summarize email status
  const emailMatch = raw_text.match(/(\d+)\s*(chưa đọc|unread)/i);
  if (emailMatch) {
    const count = parseInt(emailMatch[1]);
    if (count > 20) risks.push(`${count} email chưa đọc — cần xử lý`);
    else priorities.push(`${count} email mới`);
  }

  // Extract task status
  const taskMatch = raw_text.match(/(\d+)\s*(tasks?|công việc)/i);
  const overdueMatch = raw_text.match(/(\d+)\s*(quá hạn|overdue)/i);
  if (overdueMatch) {
    risks.push(`${overdueMatch[1]} task quá hạn`);
    actions.push(`Xem xét ${overdueMatch[1]} task quá hạn`);
  } else if (taskMatch) {
    priorities.push(`${taskMatch[1]} tasks đang theo dõi`);
  }

  // Extract approvals
  const approvalMatch = raw_text.match(/(\d+)\s*(action|pending|chờ duyệt|approval)/i);
  if (approvalMatch) {
    const count = parseInt(approvalMatch[1]);
    if (count > 0) {
      priorities.push(`${count} action cần duyệt`);
      actions.push(`Duyet ${count} action đang chờ`);
    }
  }

  // Calendar events
  const calMatch = raw_text.match(/(\d+)\s*(sự kiện|events?)/i);
  if (calMatch && parseInt(calMatch[1]) > 0) {
    priorities.push(`${calMatch[1]} sự kiện hôm nay`);
  }

  // Fallbacks
  if (priorities.length === 0) priorities.push('Hệ thống hoạt động ổn định');
  if (risks.length === 0) risks.push('Không có rủi ro nghiêm trọng');
  if (actions.length === 0) actions.push('Tiếp tục theo dõi');

  const one_liner = `${priorities[0]}${risks.length > 0 ? '. Cần chú ý: ' + risks[0] : ''}.`;

  return { one_liner, priorities: priorities.slice(0, 3), risks: risks.slice(0, 3), actions: actions.slice(0, 3) };
}

/**
 * Convert executive summary to Vietnamese voice text.
 */
export function executiveToVoiceText(summary: ExecutiveSummary): string {
  const lines: string[] = [];

  lines.push(`Báo cáo nhanh. ${summary.one_liner}`);
  lines.push('');

  if (summary.priorities.length > 0) {
    lines.push('Ba điểm chính:');
    summary.priorities.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  }

  if (summary.risks.length > 0 && summary.risks[0] !== 'Không có rủi ro nghiêm trọng') {
    lines.push('');
    lines.push('Cần chú ý:');
    summary.risks.forEach(r => lines.push(`- ${r}`));
  }

  if (summary.actions.length > 0 && summary.actions[0] !== 'Tiếp tục theo dõi') {
    lines.push('');
    lines.push('Đề xuất:');
    summary.actions.forEach(a => lines.push(`- ${a}`));
  }

  return lines.join('\n');
}

/**
 * Generate approval voice explanation — 20 seconds max.
 */
export function approvalToVoiceText(description: string, category: string): string {
  // Clean the description
  const clean = description
    .replace(/\[.*?\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);

  return `Yêu cầu phê duyệt. ${clean}. Vui lòng xác nhận để tiến hành.`;
}

/**
 * Generate workflow voice update.
 */
export function workflowToVoiceText(workflow_name: string, status: string, details: string): string {
  const statusMap: Record<string, string> = {
    completed: 'hoàn thành',
    running: 'đang thực hiện',
    failed: 'thất bại',
    pending: 'đang chờ',
  };

  const statusVi = statusMap[status.toLowerCase()] || status;

  return `Cập nhật quy trình ${workflow_name}: ${statusVi}. ${details.slice(0, 100)}`;
}

export { VOICE_CONFIGS };
