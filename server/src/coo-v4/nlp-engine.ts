/**
 * Domain C — Human NLP Engine
 * Understands: no dấu, typos, mixed EN/VI, CEO shorthand, incomplete requests.
 */

import type { ParsedIntent } from './types';

// ── CEO shorthand dictionary ───────────────────────────────────────────────

const SHORTHAND: Record<string, string> = {
  // Vietnamese shorthand
  'rv':        'review',
  'ktra':      'kiểm tra',
  'ko':        'không',
  'k':         'không',
  'dc':        'được',
  'vs':        'với',
  'nx':        'nhắn',
  'ms':        'mua sắm',
  'ck':        'chuyển khoản',
  'ad':        'admin',
  'tk':        'tài khoản',
  'mk':        'mật khẩu',
  'đt':        'điện thoại',
  'hn':        'hôm nay',
  'hq':        'hiệu quả',
  'nt':        'nhắc tôi',
  'gn':        'ghi nhận',
  'tl':        'trả lời',
  'cl':        'cải lương',
  // English shorthand
  'wp':        'wordpress',
  'gg':        'google',
  'fb':        'facebook',
  'ig':        'instagram',
  'yt':        'youtube',
  'tt':        'tiktok',
  'li':        'linkedin',
  'qb':        'quickbooks',
  'gh':        'github',
  'pr':        'pull request',
  'ci':        'ci/cd',
  'db':        'database',
  'dev':       'development',
  'prod':      'production',
  'stg':       'staging',
  'cfg':       'configuration',
};

// ── Typo correction — common CEO typing mistakes ───────────────────────────

const TYPO_MAP: Record<string, string> = {
  'dashbord':   'dashboard',
  'dashborad':  'dashboard',
  'recieve':    'receive',
  'occured':    'occurred',
  'seperator':  'separator',
  'autit':      'audit',
  'campain':    'campaign',
  'campagne':   'campaign',
  'publis':     'publish',
  'publsh':     'publish',
  'reviw':      'review',
  'chekc':      'check',
  'cheeck':     'check',
  'statis':     'status',
  'statsu':     'status',
  'wokrflow':   'workflow',
  'workfow':    'workflow',
  'analyis':    'analysis',
  'analysys':   'analysis',
  'generete':   'generate',
  'brifing':    'briefing',
  'breifing':   'briefing',
  'websit':     'website',
  'webssite':   'website',
  'doordash':   'doordash',
  'doordsah':   'doordash',
  'quickbok':   'quickbooks',
};

// ── Intent vocabulary: action verbs ────────────────────────────────────────

const ACTION_VERBS: Record<string, string[]> = {
  audit:     ['audit', 'kiem tra', 'check', 'scan', 'xem lai', 'review', 'rv', 'inspect'],
  fix:       ['fix', 'sua', 'repair', 'resolve', 'patch', 'correct', 'debug'],
  create:    ['create', 'tao', 'build', 'make', 'generate', 'generate', 'viet', 'lam', 'xay dung'],
  publish:   ['publish', 'dang', 'post', 'release', 'deploy', 'xuat ban', 'up len'],
  send:      ['send', 'gui', 'forward', 'nhan tin', 'email', 'nhan'],
  analyze:   ['analyze', 'phan tich', 'analysis', 'bao cao', 'report', 'forecast'],
  update:    ['update', 'cap nhat', 'modify', 'change', 'edit', 'sua doi'],
  prepare:   ['prepare', 'chuan bi', 'setup', 'configure', 'install'],
  optimize:  ['optimize', 'toi uu', 'improve', 'speed up', 'cai thien'],
  schedule:  ['schedule', 'hen gio', 'plan', 'remind', 'set alarm'],
  approve:   ['approve', 'duyet', 'confirm', 'accept', 'ok'],
  reject:    ['reject', 'tu choi', 'deny', 'cancel', 'huy'],
  search:    ['search', 'tim', 'find', 'look for', 'query', 'look up'],
  monitor:   ['monitor', 'theo doi', 'watch', 'track', 'alert'],
  automate:  ['automate', 'tu dong hoa', 'workflow', 'script'],
};

// ── Target vocabulary ──────────────────────────────────────────────────────

const TARGETS: Record<string, string[]> = {
  dashboard:    ['dashboard', 'dash'],
  doordash:     ['doordash', 'dd', 'door dash'],
  wordpress:    ['wordpress', 'wp', 'website', 'blog'],
  quickbooks:   ['quickbooks', 'qb', 'ke toan', 'accounting'],
  google_sheets:['google sheets', 'sheets', 'spreadsheet', 'bang tinh'],
  google_drive: ['google drive', 'drive', 'gdrive'],
  gmail:        ['gmail', 'email', 'mail', 'hop thu'],
  facebook:     ['facebook', 'fb', 'fan page', 'fanpage'],
  instagram:    ['instagram', 'ig', 'insta'],
  tiktok:       ['tiktok', 'tt', 'tik tok'],
  youtube:      ['youtube', 'yt'],
  asana:        ['asana', 'task', 'todo'],
  github:       ['github', 'gh', 'repo', 'code'],
  bakudan:      ['bakudan', 'ramen', 'store', 'stone oak', 'san antonio'],
  tax:          ['tax', 'thue', 'irs', 'ca ftb', 'payroll tax'],
  payroll:      ['payroll', 'luong', 'salary', 'nhan vien', 'employees'],
  seo:          ['seo', 'search engine', 'google ranking', 'bai viet'],
  video:        ['video', 'reel', 'short', 'clip', 'youtube video'],
  campaign:     ['campaign', 'campain', 'quang cao', 'marketing', 'ad'],
  source:       ['source', 'code', 'bug', 'error', 'crash', 'src'],
  report:       ['report', 'bao cao', 'summary', 'analysis', 'p&l', 'revenue'],
  cash_flow:    ['cash flow', 'tien mat', 'forecast', 'du bao'],
};

// ── Context inference — incomplete requests ────────────────────────────────

const CONTEXT_INFERENCES: Array<{ pattern: RegExp; action: string; target: string; description: string }> = [
  { pattern: /^doordash$/i, action: 'analyze', target: 'doordash', description: 'analyze DoorDash campaign performance' },
  { pattern: /^facebook$/i, action: 'monitor', target: 'facebook', description: 'check Facebook page status and engagement' },
  { pattern: /^quickbooks$|^qb$/i, action: 'analyze', target: 'quickbooks', description: 'review QuickBooks financials' },
  { pattern: /^dashboard$/i, action: 'audit', target: 'dashboard', description: 'audit dashboard.bakudanramen.com' },
  { pattern: /^tax$/i, action: 'prepare', target: 'tax', description: 'prepare tax package for review' },
  { pattern: /^seo$/i, action: 'create', target: 'seo', description: 'create SEO article for website' },
  { pattern: /^video$/i, action: 'create', target: 'video', description: 'create marketing video/reel' },
  { pattern: /^payroll$/i, action: 'prepare', target: 'payroll', description: 'prepare payroll for current period' },
  { pattern: /^p&l$|^pl$/i, action: 'analyze', target: 'report', description: 'generate P&L report' },
  { pattern: /^cash flow$/i, action: 'analyze', target: 'cash_flow', description: 'analyze cash flow and forecast' },
];

// ── Normalizer ─────────────────────────────────────────────────────────────

export function normalize(text: string): string {
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\w\s&/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandShorthand(text: string): string {
  const words = text.split(/\s+/);
  return words.map(w => SHORTHAND[w] || w).join(' ');
}

function correctTypos(text: string): string {
  const words = text.split(/\s+/);
  return words.map(w => TYPO_MAP[w] || w).join(' ');
}

function detectLanguage(raw: string): 'vi' | 'en' | 'mixed' {
  const viChars = (raw.match(/[àáâãèéêìíòóôõùúýăđơư]/gi) || []).length;
  const words = raw.split(/\s+/).length;
  if (viChars > 2) return 'vi';
  // Check for Vietnamese keywords without diacritics
  const viKeywords = /\b(hom nay|tao|lam|xem|gui|bao cao|kiem tra|chuan bi|dang)\b/;
  if (viKeywords.test(normalize(raw))) return 'mixed';
  return 'en';
}

function extractAction(norm: string): string {
  for (const [action, keywords] of Object.entries(ACTION_VERBS)) {
    for (const kw of keywords) {
      if (norm.includes(kw)) return action;
    }
  }
  return 'execute';
}

function extractTarget(norm: string): string {
  for (const [target, keywords] of Object.entries(TARGETS)) {
    for (const kw of keywords) {
      if (norm.includes(kw)) return target;
    }
  }
  return 'system';
}

function extractModifiers(norm: string): string[] {
  const mods: string[] = [];
  if (/hom nay|today|now|ngay/.test(norm)) mods.push('today');
  if (/tuan nay|this week|week/.test(norm)) mods.push('this_week');
  if (/thang nay|this month|month/.test(norm)) mods.push('this_month');
  if (/nhanh|fast|quick|urgent|gap/.test(norm)) mods.push('urgent');
  if (/tat ca|all|every|toan bo/.test(norm)) mods.push('all');
  if (/tu dong|auto|automatic/.test(norm)) mods.push('autonomous');
  if (/bao cao|report|summary/.test(norm)) mods.push('report');
  return mods;
}

// ── Main parse function ────────────────────────────────────────────────────

export function parseIntent(raw: string): ParsedIntent {
  const language = detectLanguage(raw);
  let norm = normalize(raw);
  norm = expandShorthand(norm);
  norm = correctTypos(norm);

  // Check context inference for single-word / incomplete queries
  for (const inf of CONTEXT_INFERENCES) {
    if (inf.pattern.test(norm.trim())) {
      return {
        raw, normalized: norm,
        action: inf.action, target: inf.target,
        modifiers: [], language,
        confidence: 0.75,
        inferred: true,
      };
    }
  }

  const action = extractAction(norm);
  const target = extractTarget(norm);
  const modifiers = extractModifiers(norm);

  // Confidence: higher when both action + target found explicitly
  const actionExplicit = Object.values(ACTION_VERBS).some(kws => kws.some(kw => norm.includes(kw)));
  const targetExplicit = Object.values(TARGETS).some(kws => kws.some(kw => norm.includes(kw)));
  const confidence = actionExplicit && targetExplicit ? 0.95 : actionExplicit || targetExplicit ? 0.80 : 0.60;

  return {
    raw, normalized: norm,
    action, target, modifiers, language,
    confidence,
    inferred: !actionExplicit || !targetExplicit,
  };
}

// ── CEO shorthand expansion for display ────────────────────────────────────

export function humanize(parsed: ParsedIntent): string {
  const actionLabels: Record<string, string> = {
    audit: 'Kiểm tra',
    fix: 'Sửa',
    create: 'Tạo',
    publish: 'Đăng',
    send: 'Gửi',
    analyze: 'Phân tích',
    update: 'Cập nhật',
    prepare: 'Chuẩn bị',
    optimize: 'Tối ưu',
    schedule: 'Lên lịch',
    search: 'Tìm kiếm',
    monitor: 'Theo dõi',
    automate: 'Tự động hóa',
    execute: 'Thực hiện',
  };
  const label = actionLabels[parsed.action] || parsed.action;
  return `${label} ${parsed.target.replace(/_/g, ' ')}`;
}
