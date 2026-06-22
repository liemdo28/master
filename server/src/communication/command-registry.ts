/**
 * Command Registry — single source of truth for all /mi commands.
 * Each command has: name, aliases, description, level (read/write/dangerous),
 * language support, and handler reference.
 */

export type CommandLevel = 'read' | 'write' | 'dangerous';

export interface CommandDef {
  name: string;
  aliases: string[];
  description_en: string;
  description_vi: string;
  level: CommandLevel;
  examples: string[];
  requires_args: boolean;
}

export const COMMAND_REGISTRY: CommandDef[] = [
  // ── Status / Health ─────────────────────────────────────────────────────
  { name: 'status',    aliases: ['s'],          level: 'read', requires_args: false,
    description_en: 'CEO system status summary', description_vi: 'Tóm tắt trạng thái hệ thống',
    examples: ['/mi status'] },
  { name: 'health',    aliases: ['ping'],        level: 'read', requires_args: false,
    description_en: 'All service health check',  description_vi: 'Kiểm tra sức khỏe tất cả dịch vụ',
    examples: ['/mi health'] },
  { name: 'today',     aliases: ['briefing'],    level: 'read', requires_args: false,
    description_en: 'Daily briefing',            description_vi: 'Bản tóm tắt hôm nay',
    examples: ['/mi today'] },

  // ── Business ────────────────────────────────────────────────────────────
  { name: 'stores',    aliases: ['store'],       level: 'read', requires_args: false,
    description_en: 'Store health (Stone Oak, Bandera, Raw)', description_vi: 'Sức khỏe các cửa hàng',
    examples: ['/mi stores', '/mi Stone Oak hôm nay thế nào?'] },
  { name: 'qb',        aliases: ['quickbooks'],  level: 'read', requires_args: false,
    description_en: 'QuickBooks summary',        description_vi: 'Tóm tắt QuickBooks',
    examples: ['/mi qb'] },
  { name: 'reviews',   aliases: ['review'],      level: 'read', requires_args: false,
    description_en: 'Recent reviews',            description_vi: 'Đánh giá mới nhất',
    examples: ['/mi reviews'] },
  { name: 'disputes',  aliases: ['dispute'],     level: 'read', requires_args: false,
    description_en: 'Active disputes',           description_vi: 'Tranh chấp đang xử lý',
    examples: ['/mi disputes'] },

  // ── Tasks / Projects ────────────────────────────────────────────────────
  { name: 'tasks',     aliases: ['task'],        level: 'read', requires_args: false,
    description_en: 'Pending tasks',             description_vi: 'Task đang chờ',
    examples: ['/mi tasks'] },
  { name: 'projects',  aliases: ['project'],     level: 'read', requires_args: false,
    description_en: 'Project status',            description_vi: 'Trạng thái dự án',
    examples: ['/mi projects'] },
  { name: 'dev',       aliases: ['devs'],        level: 'read', requires_args: false,
    description_en: 'Dev team status',           description_vi: 'Trạng thái team dev',
    examples: ['/mi dev', '/mi dev đang làm gì?'] },

  // ── Approvals ───────────────────────────────────────────────────────────
  { name: 'approvals', aliases: ['approval'],    level: 'read', requires_args: false,
    description_en: 'Pending approvals',         description_vi: 'Phê duyệt đang chờ',
    examples: ['/mi approvals'] },
  { name: 'approve',   aliases: ['ok', 'yes'],   level: 'write', requires_args: true,
    description_en: 'Approve action by ID',      description_vi: 'Phê duyệt hành động theo ID',
    examples: ['/mi approve abc123'] },
  { name: 'reject',    aliases: ['no', 'deny'],  level: 'write', requires_args: true,
    description_en: 'Reject action by ID',       description_vi: 'Từ chối hành động theo ID',
    examples: ['/mi reject abc123'] },

  // ── Infrastructure ──────────────────────────────────────────────────────
  { name: 'bigdata',   aliases: ['bd'],          level: 'read', requires_args: false,
    description_en: 'Big Data health (PG/MinIO/Qdrant)', description_vi: 'Sức khỏe Big Data',
    examples: ['/mi bigdata', '/mi bigdata health'] },
  { name: 'dashboard', aliases: ['dash'],        level: 'read', requires_args: false,
    description_en: 'Dashboard connector status', description_vi: 'Trạng thái dashboard',
    examples: ['/mi dashboard'] },

  // ── Nodes / Devices ─────────────────────────────────────────────────────
  { name: 'nodes',     aliases: ['node'],        level: 'read', requires_args: false,
    description_en: 'All node agents status',    description_vi: 'Trạng thái tất cả node',
    examples: ['/mi nodes'] },
  { name: 'laptop1',   aliases: ['l1'],          level: 'read', requires_args: false,
    description_en: 'Laptop 1 node status',      description_vi: 'Trạng thái laptop 1',
    examples: ['/mi laptop1 status'] },
  { name: 'laptop2',   aliases: ['l2'],          level: 'read', requires_args: false,
    description_en: 'Laptop 2 node status',      description_vi: 'Trạng thái laptop 2',
    examples: ['/mi laptop2 status'] },

  // ── Alerts / Monitoring ─────────────────────────────────────────────────
  { name: 'alerts',    aliases: ['alert'],       level: 'read', requires_args: false,
    description_en: 'Active alerts',             description_vi: 'Cảnh báo đang hoạt động',
    examples: ['/mi alerts'] },
  { name: 'watch',     aliases: [],              level: 'write', requires_args: true,
    description_en: 'Watch a target for alerts', description_vi: 'Theo dõi mục tiêu',
    examples: ['/mi watch Stone Oak'] },
  { name: 'mute',      aliases: [],              level: 'write', requires_args: true,
    description_en: 'Mute alerts temporarily',   description_vi: 'Tắt cảnh báo tạm thời',
    examples: ['/mi mute reviews 2h'] },

  // ── Help ────────────────────────────────────────────────────────────────
  { name: 'help',      aliases: ['?', 'h'],      level: 'read', requires_args: false,
    description_en: 'Show available commands',   description_vi: 'Hiển thị lệnh có thể dùng',
    examples: ['/mi help'] },
];

export function findCommand(token: string): CommandDef | null {
  const t = token.toLowerCase();
  return COMMAND_REGISTRY.find(c => c.name === t || c.aliases.includes(t)) ?? null;
}

export function helpText(lang: 'vi' | 'en' = 'vi'): string {
  const lines = ['*Lệnh Mi — Phone OS của anh*\n'];
  for (const cmd of COMMAND_REGISTRY) {
    const desc = lang === 'vi' ? cmd.description_vi : cmd.description_en;
    lines.push(`/mi ${cmd.name} — ${desc}`);
  }
  lines.push('\nGõ câu hỏi tự nhiên bằng tiếng Việt hoặc tiếng Anh — Mi sẽ hiểu.');
  return lines.join('\n');
}
