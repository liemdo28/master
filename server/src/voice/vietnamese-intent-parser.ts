/**
 * Vietnamese Intent Parser — maps Vietnamese voice transcripts to Mi intents.
 * Uses keyword + pattern matching before falling back to AI brain.
 */

export interface VoiceIntent {
  intent: string;
  confidence: number;
  entities: Record<string, string>;
  normalized_command: string;   // equivalent /mi text command
}

interface IntentPattern {
  intent: string;
  patterns: RegExp[];
  entities?: Array<{ name: string; pattern: RegExp }>;
  command: (entities: Record<string, string>, raw: string) => string;
}

const STORE_NAMES = '(Stone Oak|Bandera|Raw|rawsushibar|bakudan)';

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'store_health',
    patterns: [/kiểm tra.*(cửa hàng|store|chi nhánh)/i, /thế nào.*(hôm nay|nay)/i, /có vấn đề gì/i],
    entities: [{ name: 'store', pattern: new RegExp(STORE_NAMES, 'i') }],
    command: (e, raw) => e.store ? `stores ${e.store}` : 'stores',
  },
  {
    intent: 'daily_briefing',
    patterns: [/hôm nay.*làm gì/i, /tóm tắt.*hôm nay/i, /báo cáo.*ngày/i, /brief/i, /today/i],
    entities: [],
    command: () => 'today',
  },
  {
    intent: 'system_status',
    patterns: [/trạng thái.*hệ thống/i, /status/i, /health/i, /sức khỏe/i],
    entities: [],
    command: () => 'status',
  },
  {
    intent: 'task_list',
    patterns: [/task.*nào/i, /công việc.*đang/i, /việc.*cần làm/i, /todo/i],
    entities: [],
    command: () => 'tasks',
  },
  {
    intent: 'approvals_check',
    patterns: [/phê duyệt/i, /approval/i, /đang chờ.*duyệt/i],
    entities: [],
    command: () => 'approvals',
  },
  {
    intent: 'review_check',
    patterns: [/review.*mới/i, /đánh giá.*mới/i, /bad review/i, /negative review/i],
    entities: [],
    command: () => 'reviews',
  },
  {
    intent: 'bigdata_health',
    patterns: [/big.?data/i, /database.*health/i, /postgres/i, /minio/i],
    entities: [],
    command: () => 'bigdata',
  },
  {
    intent: 'node_status',
    patterns: [/laptop.*[12]/i, /node.*[12]/i, /máy tính.*[12]/i],
    entities: [{ name: 'node', pattern: /laptop(\d)/i }],
    command: (e) => e.node ? `laptop${e.node}` : 'nodes',
  },
  {
    intent: 'create_task',
    patterns: [/tạo.*task/i, /thêm.*task/i, /giao.*task/i, /create.*task/i],
    entities: [{ name: 'assignee', pattern: /cho\s+(\w+)/i }],
    command: (_e, raw) => raw,
  },
];

export function parseVietnameseIntent(transcript: string): VoiceIntent {
  const text = transcript.trim();

  for (const ip of INTENT_PATTERNS) {
    const matched = ip.patterns.some(p => p.test(text));
    if (!matched) continue;

    const entities: Record<string, string> = {};
    for (const e of (ip.entities || [])) {
      const m = text.match(e.pattern);
      if (m) entities[e.name] = m[1] || m[0];
    }

    return {
      intent: ip.intent,
      confidence: 0.85,
      entities,
      normalized_command: ip.command(entities, text),
    };
  }

  // Fallback: treat full transcript as free-text Mi command
  return {
    intent: 'free_text',
    confidence: 0.5,
    entities: {},
    normalized_command: text,
  };
}
