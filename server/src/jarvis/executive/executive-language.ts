/**
 * Phase P8 — Executive Language Model
 * Ensures Mi sounds like an executive assistant, not a command router.
 */

// Phrases Mi should never output (command-router language)
const BANNED_PHRASES = [
  /use \/mi/i,
  /use \/agent/i,
  /command not recognized/i,
  /refer to documentation/i,
  /try \/mi/i,
  /type \/mi/i,
  /run \/mi/i,
  /invalid command/i,
  /unrecognized intent/i,
  /i don't understand/i,
  /i cannot/i,
  /i am unable/i,
  /as an ai/i,
];

// Robotic phrases → executive replacements
const REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /^I /gm, replacement: 'Em ' },
  { pattern: /^The system /gm, replacement: 'Hệ thống ' },
  { pattern: /cannot process/gi, replacement: 'chưa xử lý được' },
  { pattern: /Error:/gi, replacement: '⚠️' },
  { pattern: /undefined/g, replacement: 'chưa có dữ liệu' },
  { pattern: /null/g, replacement: 'chưa có dữ liệu' },
];

// Greeting patterns → executive responses
export const GREETING_PATTERNS: Array<{ pattern: RegExp; responses: string[] }> = [
  {
    pattern: /^(mi ơi|mi oi|hey mi|hi mi|hello mi|oi mi)[\s!?]*$/i,
    responses: ['Em đây anh.', 'Em đây anh! Anh cần gì không?'],
  },
  {
    pattern: /^(chào mi|chao mi)[\s!?]*$/i,
    responses: ['Chào anh! Em đây.'],
  },
  {
    pattern: /^(mi)[\s!?]*$/i,
    responses: ['Em đây anh.'],
  },
  {
    pattern: /^(em ơi|em oi)[\s!?]*$/i,
    responses: ['Dạ, anh cần gì không?'],
  },
  {
    pattern: /^(alo|hello|hi|xin chào|xin chao)[\s!?]*$/i,
    responses: ['Em đây anh. Anh cần gì không?'],
  },
];

// Status question patterns — tested against NORMALIZED text (diacritics stripped)
const S = '(sao roi|the nao|on khong|ok khong|status|health|ok chua|sao the|co loi|co issue|loi gi|issue gi|dang chay)';
export const STATUS_PATTERNS: Array<{ pattern: RegExp; entity: string }> = [
  { pattern: new RegExp(`laptop1\\s*${S}`, 'i'), entity: 'Laptop1' },
  { pattern: new RegExp(`laptop2\\s*${S}`, 'i'), entity: 'Laptop2' },
  { pattern: new RegExp(`mi.?core\\s*${S}`, 'i'), entity: 'Mi-Core' },
  { pattern: new RegExp(`gateway\\s*${S}`, 'i'), entity: 'Gateway' },
  { pattern: new RegExp(`doordash\\s*${S}`, 'i'), entity: 'DoorDash' },
  { pattern: new RegExp(`stone oak\\s*${S}`, 'i'), entity: 'Stone Oak' },
  { pattern: new RegExp(`bandera\\s*${S}`, 'i'), entity: 'Bandera' },
  { pattern: new RegExp(`bakudan(\\s+ramen)?\\s*${S}`, 'i'), entity: 'Bakudan Ramen' },
  { pattern: new RegExp(`(he thong|system)\\s*${S}`, 'i'), entity: 'system' },
  { pattern: new RegExp(`dashboard\\s*${S}`, 'i'), entity: 'Dashboard' },
  { pattern: new RegExp(`(review automation|review)\\s*${S}`, 'i'), entity: 'Review Automation' },
  { pattern: new RegExp(`(integration system|integration)\\s*${S}`, 'i'), entity: 'Integration System' },
  { pattern: new RegExp(`agent(\\s+os)?\\s*${S}`, 'i'), entity: 'Agent OS' },
  { pattern: new RegExp(`jarvis\\s*${S}`, 'i'), entity: 'Jarvis' },
  { pattern: new RegExp(`tinh hinh\\s+jarvis`, 'i'), entity: 'Jarvis' },
  { pattern: new RegExp(`(dev1|dev2|dev3)(\\s+${S}|\\s+dang\\s+ket|\\s+ket\\s+gi|\\s+lam\\s+gi)?`, 'i'), entity: 'Dev' },
];

// Blocked project patterns
export const BLOCKED_PATTERNS = [
  /du an nao dang blocked/i,
  /dự án nào đang blocked/i,
  /du an nao bi blocked/i,
  /project nao dang ket/i,
  /du an nao ket/i,
  /dev nao (dang )?giu blocker/i,
  /dev nao (dang )?blocked/i,
  /ai dang blocked/i,
  /who.*blocked/i,
  /what.*blocked/i,
];

// Calendar / schedule query patterns
export const CALENDAR_PATTERNS = [
  /hom nay.*lich/i,
  /hôm nay.*lịch/i,
  /lich.*hom nay/i,
  /lịch.*hôm nay/i,
  /co lich gi/i,
  /có lịch gì/i,
  /lich gi ko/i,
  /lịch gì ko/i,
  /lich gi khong/i,
  /schedule.*today/i,
  /what.*schedule/i,
  /buoi hom nay/i,
  /buổi hôm nay/i,
  /meeting.*hom nay/i,
  /cuoc hop/i,
  /cuộc họp/i,
];

// Project awareness query patterns
export const PROJECT_QUERY_PATTERNS = [
  /dang lam project nao/i,
  /đang làm project nào/i,
  /project nao/i,
  /project nào/i,
  /em co biet.*project/i,
  /em có biết.*project/i,
  /anh dang lam gi/i,
  /anh đang làm gì/i,
  /dang co project gi/i,
  /đang có project gì/i,
  /du an nao dang chay/i,
  /dự án nào đang chạy/i,
  /what.*project.*working/i,
];

// Concern patterns
export const CONCERN_PATTERNS = [
  /có gì đáng lo/i,
  /co gi dang lo/i,
  /có vấn đề gì/i,
  /co van de gi/i,
  /có gì không/i,
  /co gi khong/i,
  /lo gì không/i,
  /có issue/i,
  /co issue/i,
  /có lỗi/i,
  /co loi/i,
  /có gì cần chú ý/i,
  /co gi can chu y/i,
  /anything wrong/i,
  /any issues/i,
  /any problem/i,
];

// Proactive check patterns
export const PROACTIVE_PATTERNS = [
  /em thấy gì không/i,
  /em thay gi/i,
  /em thấy gì\??$/i,
  /có đề xuất gì/i,
  /em đề xuất gì/i,
  /de xuat gi/i,
  /recommend/i,
  /nên làm gì/i,
  /anh nên/i,
];

export function sanitizeResponse(text: string): string {
  let out = text;
  for (const { pattern, replacement } of REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function hasBannedLanguage(text: string): boolean {
  return BANNED_PHRASES.some(p => p.test(text));
}

export function formatExecutiveResponse(lines: string[]): string {
  return lines.filter(l => l !== undefined && l !== null).join('\n');
}

// Build a natural opener based on what Mi is about to say
export function opener(hasIssues: boolean, context?: string): string {
  if (context) return `Em vừa kiểm tra ${context}.`;
  if (hasIssues) return 'Em thấy có một vài điểm cần chú ý:';
  return 'Em vừa kiểm tra — hệ thống đang ổn.';
}
