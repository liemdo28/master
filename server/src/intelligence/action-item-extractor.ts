/**
 * Action Item Extractor
 * Detects tasks from conversation text, assigns owner, creates proposal, requires approval.
 */
import { createActionItem, updateActionItem, getActionItems, ActionItem } from './context-memory';

// ── Task detection patterns ───────────────────────────────────────────────────

interface DetectedTask {
  text: string;
  owner?: string;
  due_hint?: string;
  confidence: number;
}

const TASK_PATTERNS: Array<{ pattern: RegExp; extract: (m: RegExpMatchArray, text: string) => DetectedTask | null }> = [
  // "cần [ai đó] làm/kiểm tra/xử lý X"
  {
    pattern: /cần\s+(?:(\w+)\s+)?(?:làm|kiểm tra|xử lý|sửa|fix|check|update)\s+(.+)/i,
    extract: (m) => ({ text: `Cần ${m[0].split(' ').slice(1).join(' ')}`, owner: m[1], confidence: 0.85 }),
  },
  // "giao [tên] X" / "assign [name] to X"
  {
    pattern: /(?:giao|assign)\s+(?:cho\s+)?([A-Za-zÀ-ỹ]+)\s+(.+)/i,
    extract: (m) => ({ text: m[2].trim(), owner: m[1], confidence: 0.9 }),
  },
  // "[tên] cần/phải/should X"
  {
    pattern: /([A-Z][a-zÀ-ỹ]+)\s+(?:cần|phải|should|must|needs? to)\s+(.+)/,
    extract: (m) => ({ text: m[2].trim(), owner: m[1], confidence: 0.8 }),
  },
  // "todo: X" / "action: X" / "task: X"
  {
    pattern: /(?:todo|action item|task|việc cần làm)\s*[:–-]\s*(.+)/i,
    extract: (m) => ({ text: m[1].trim(), confidence: 0.95 }),
  },
  // "follow up on X" / "follow-up: X"
  {
    pattern: /follow[- ]?up[:\s]+(.+)/i,
    extract: (m) => ({ text: `Follow up: ${m[1].trim()}`, confidence: 0.85 }),
  },
  // "broken / không hoạt động / down" — operational issues need action
  {
    pattern: /(.+?)\s+(?:bị hỏng|không hoạt động|broken|is down|không chạy|cần sửa)/i,
    extract: (m) => ({ text: `Fix: ${m[1].trim()}`, confidence: 0.75 }),
  },
];

export function extractTasksFromText(text: string): DetectedTask[] {
  const tasks: DetectedTask[] = [];
  const lines = text.split(/[.\n!?]+/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    for (const { pattern, extract } of TASK_PATTERNS) {
      const m = line.match(pattern);
      if (m) {
        const task = extract(m, line);
        if (task && task.text.length > 3 && task.text.length < 300) {
          tasks.push(task);
          break;
        }
      }
    }
  }

  // Dedup by text similarity
  return tasks.filter((t, i) => !tasks.slice(0, i).some(prev => similarity(prev.text, t.text) > 0.7));
}

function similarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const inter = [...setA].filter(w => setB.has(w)).length;
  return inter / Math.max(setA.size, setB.size);
}

// ── Owner inference ───────────────────────────────────────────────────────────

const KNOWN_STAFF: Record<string, string[]> = {
  Maria:   ['food safety', 'vệ sinh', 'temperature', 'nhiệt độ', 'kitchen', 'bếp'],
  David:   ['cooler', 'equipment', 'thiết bị', 'maintenance', 'bảo trì'],
  Dev1:    ['gateway', 'laptop', 'system', 'server', 'code', 'deploy'],
  Manager: ['staff', 'schedule', 'nhân viên', 'ca làm', 'opening', 'closing'],
};

export function inferOwner(taskText: string, suggestedOwner?: string): string | undefined {
  if (suggestedOwner) return suggestedOwner;
  const lower = taskText.toLowerCase();
  for (const [name, keywords] of Object.entries(KNOWN_STAFF)) {
    if (keywords.some(kw => lower.includes(kw))) return name;
  }
  return undefined;
}

// ── Proposal Builder ──────────────────────────────────────────────────────────

export interface ActionItemProposal {
  tasks: ActionItem[];
  approval_required: boolean;
  formatted: string;
}

export function buildActionItemProposal(
  tasks: DetectedTask[],
  sourceMessageId: string,
  chatId: string,
): ActionItemProposal {
  if (tasks.length === 0) {
    return {
      tasks: [],
      approval_required: false,
      formatted: 'Không phát hiện action item nào trong nội dung này.',
    };
  }

  const created: ActionItem[] = [];
  for (const t of tasks) {
    const owner = inferOwner(t.text, t.owner);
    const item = createActionItem({
      source_message_id: sourceMessageId,
      chat_id: chatId,
      text: t.text,
      owner,
      status: 'open',
      due_date: t.due_hint,
    });
    created.push(item);
  }

  const lines = [
    `📌 *Action Items Detected* (${created.length})`,
    '',
    ...created.map((a, i) => `${i + 1}. *${a.id}* — ${a.text}${a.owner ? '\n   Owner: ' + a.owner : ''}`),
    '',
    '⚠️ Cần anh approve để giao việc chính thức.',
  ];

  return {
    tasks: created,
    approval_required: true,
    formatted: lines.join('\n'),
  };
}

// ── Action item summary ───────────────────────────────────────────────────────

export function formatActionItemSummary(): string {
  const open = getActionItems({ status: 'open' });
  const inProgress = getActionItems({ status: 'in_progress' });
  const done = getActionItems({ status: 'done' });

  if (open.length === 0 && inProgress.length === 0) {
    return '📌 *Action Items*\n\nKhông có action item nào đang mở.';
  }

  const lines = ['📌 *Action Items Summary*', ''];

  if (inProgress.length > 0) {
    lines.push(`🔄 In Progress (${inProgress.length})`);
    inProgress.slice(0, 5).forEach(a => lines.push(`  • ${a.id}: ${a.text.slice(0, 60)}${a.owner ? ' → ' + a.owner : ''}`));
    lines.push('');
  }

  if (open.length > 0) {
    lines.push(`⏳ Open (${open.length})`);
    open.slice(0, 5).forEach(a => lines.push(`  • ${a.id}: ${a.text.slice(0, 60)}${a.owner ? ' → ' + a.owner : ''}`));
    lines.push('');
  }

  lines.push(`✅ Completed: ${done.length}`);
  return lines.join('\n');
}

export function markActionItemDone(id: string): boolean {
  return updateActionItem(id, { status: 'done' });
}

export function markActionItemInProgress(id: string): boolean {
  return updateActionItem(id, { status: 'in_progress' });
}
