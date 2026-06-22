/**
 * P1 — Acknowledge Engine (Statement Detector)
 *
 * Runs BEFORE all intent routing. Detects CEO statements and returns
 * appropriate acknowledgments — no workflow, no approval, no action.
 *
 * Critical rule: 40% of CEO messages are statements. They must be
 * acknowledged, never routed to workflows.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type StatementType =
  | 'completion'       // "X đã hoàn thành rồi"
  | 'temporal_update'  // "X là tuần rồi"
  | 'casual_ack'       // "K", "Ok", "Đã nhận"
  | 'confirmation'     // "X đã xong rồi mà" / "đã làm rồi"
  | 'inform'           // generic statement — "X happening"
  | null;

export interface StatementDetectionResult {
  is_statement: boolean;
  type: StatementType;
  subject: string;
  temporal: string;
  reply: string | null;
}

// ── Normalization ─────────────────────────────────────────────────────────────

function norm(text: string): string {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Subject extraction ────────────────────────────────────────────────────────

const SUBJECT_PATTERNS: Array<[RegExp, string]> = [
  [/\b(qb|quickbooks)\b/i, 'QB'],
  [/\bpayroll\b/i, 'Payroll'],
  [/\b(raw\s*sushi|raw)\b/i, 'Raw Sushi'],
  [/\bbakudan\b/i, 'Bakudan'],
  [/\b(bakudan\s+)?dashboard\b/i, 'Dashboard'],
  [/\b(doordash)\b/i, 'DoorDash'],
  [/\breview\b/i, 'Review Automation'],
  [/\b(asana)\b/i, 'Asana'],
  [/\b(integration)\b/i, 'Integration System'],
  [/\bwhatsapp\b/i, 'WhatsApp Gateway'],
  [/\b(seo)\b/i, 'SEO'],
  [/\b(website)\b/i, 'Website'],
  [/\b(stone\s*oak)\b/i, 'Stone Oak'],
  [/\b(bandera)\b/i, 'Bandera'],
  [/\b(rim)\b/i, 'Rim'],
  [/\b(accounting|ke\s*toan)\b/i, 'Accounting'],
  [/\b(invoice)\b/i, 'Invoice'],
  [/\b(report|bao\s*cao)\b/i, 'Report'],
];

function extractSubject(text: string, normalized: string): string {
  for (const [pat, label] of SUBJECT_PATTERNS) {
    if (pat.test(text) || pat.test(normalized)) return label;
  }
  return '';
}

// ── Temporal extraction ─────────────────────────────────────────────────────

function extractTemporal(text: string): string {
  const n = norm(text);
  if (/\btuan\s*truoc\b/.test(n)) return 'tuần trước';
  if (/\bhom\s*qua\b/.test(n)) return 'hôm qua';
  if (/\bhom\s*nay\b/.test(n)) return 'hôm nay';
  if (/\bngay\s*kia\b/.test(n)) return 'ngày kia';
  if (/\btuan\s*nay\b/.test(n)) return 'tuần này';
  if (/\bthang\s*truoc\b/.test(n)) return 'tháng trước';
  if (/\bthang\s*nay\b/.test(n)) return 'tháng này';
  if (/\bnam\s*truoc\b/.test(n)) return 'năm ngoái';
  if (/\bdau\s*tuan\b/.test(n)) return 'đầu tuần';
  if (/\bgio\b/.test(n)) return 'giờ';
  return '';
}

// ── Statement patterns ────────────────────────────────────────────────────────

// PHASE ORDER MATTERS — more specific patterns must come first

// P1: Casual acknowledgments (single-word bare responses)
const CASUAL_ACK_PATTERNS: RegExp[] = [
  /^(k|ok|oke|okay|dạ|da|vang|uh|uhm|roi|xong|nhon|cam\s*on|thanks)\s*$/i,
  /^(da\s+nhan|ghi\s*nhan|ok\s*nha|ok\s*nhe)\s*$/i,
];

// P2: Confirmation with "mà" at end — specific tone
const CONFIRMATION_PATTERNS: RegExp[] = [
  // "X đã ... rồi mà" / "X ... rồi mà" — ends with "mà"
  /\b(da\s+)?(hoan\s*thanh|lam|xong|fix|sua|deploy|push|release|done)\b.*\b(ma|dung)\s*$/i,
  // "X đã rồi" / "X xong rồi" — strong completion
  /\b(da\s+)?(roi|xong\s+roi|hoan\s*thanh\s+roi)\b\s*$/i,
];

// P3: Temporal updates — "X là tuần rồi", "X was last week" — MUST come before completion
const TEMPORAL_UPDATE_PATTERNS: RegExp[] = [
  // "X là tuần rồi" / "X was last week" — "la" + temporal marker
  /\b(la|là)\b.*\b(tuan\s*truoc|hom\s*qua|ngay\s*kia|thang\s*truoc|dau\s*tuan|thang\s*nay)\b/i,
  // "X hoàn thành tuần trước" — completion + temporal
  /\b(hoan\s*thanh|completed|done|finished)\b.*\b(tuan\s*truoc|hom\s*qua|ngay\s*kia|thang\s*truoc)\b/i,
  // "X xong tuần rồi" — completion + temporal
  /\b(xong|done|finished)\b.*\b(tuan\s*truoc|hom\s*qua|ngay\s*kia)\b/i,
  // "X last week" / "X was yesterday"
  /\b(last\s*week|yesterday|earlier|before)\b/i,
];

// P4: Completion statements — "X đã hoàn thành rồi", "X done", "X xong"
const COMPLETION_PATTERNS: RegExp[] = [
  // "X đã hoàn thành rồi" / "X hoàn thành rồi"
  /\b(da\s+)?(hoan\s*thanh|completed|done|xong|finish|ket\s*thuc)\b.*\b(roi|ma|nha|that)\b/i,
  // "X đã xong" / "X xong rồi" — "đã xong" or "xong rồi"
  /\b(da\s+)?(xong|done|hoan\s*thanh|finished)\b.*\b(roi|xong)\b/i,
  // "X đã fix xong" / "X đã post xong" — "đã [verb] xong"
  /\bda\s+(fix|sua|xu\s*ly|post|launch|push|deploy|lam)\s+(xong|roi)\b/i,
  // "X done" / "X finished" / "X completed" / "X resolved" — standalone EN
  /\b(finished|sorted|resolved|completed|done)\b\s*$/i,
  // "X post rồi" / "X sync rồi" — EN verb + VN completion
  /\b(post|published|launch|deployed|pushed|sync)\s+(roi|ma|nha)\b/i,
  // "X đã hoàn thành" (no rồi) — bare "đã hoàn thành"
  /\bda\s+hoan\s*thanh\b/i,
];

// P5: Generic statement (CEO informing, not requesting)
const INFORM_PATTERNS: RegExp[] = [
  /\b(dang|vua|moi|sắp)\b.*\b(lam|xu\s*ly|fix|deploy|check|handle)\b/i,
  /\b(dang\s+lam|dang\s+xu\s*ly|dang\s+chay)\b/i,
  /\b(nghi|off|meeting|hop)\b/i,
];

// ── Anti-patterns: queries/requests that should NOT be statements ────────────

const QUERY_ANTI_PATTERNS: RegExp[] = [
  /\?/,
  /\b(sao|the nao|nhu the nao|bao nhieu|bao gio|o dau|where|what|when|how|why)\b/i,
  /\b(co khong|co gi|co ai|co the|duoc khong)\b/i,
  // Action request verbs (only if no completion marker is present)
  /\b(tao|create|send|gui|deploy|audit)\b/i,
  /\b(kiem\s*tra|check|xem|coi)\b.*\b(dau|o dau|sao|the nao|check)\b/i,
  // "viet" (write) only when NOT "bai viet" (article)
  /\bviet\b(?!\s+(bai|viet))/i,
  // "lam" only when NOT "đã xử lý" / "đã làm"
  /\b(da\s+)?lam\b(?!.*\b(xong|roi|hoan\s*thanh|hoan thanh)\b)/i,
  // "fix" only when NOT "đã fix" / "fix xong"
  /\b(da\s+)?fix\b(?!.*\b(xong|roi|hoan\s*thanh)\b)/i,
];

// ── Completion markers override anti-patterns ──────────────────────────────
const COMPLETION_MARKERS = /\b(xong|roi|hoan\s*thanh|done|completed|finished|resolved|da\s+(fix|sua|xu\s*ly|post|launch|push|deploy|lam))\b/i;

// ── Core detector ─────────────────────────────────────────────────────────────

export function detectStatement(rawText: string): StatementDetectionResult {
  const text = rawText.trim();
  const n = norm(text);

  if (n.length < 2) {
    return { is_statement: true, type: 'casual_ack', subject: '', temporal: '', reply: 'Dạ.' };
  }

  // Anti-pattern gate: if completion markers present, skip anti-pattern check
  const hasCompletion = COMPLETION_MARKERS.test(n) || COMPLETION_MARKERS.test(text);
  if (!hasCompletion && QUERY_ANTI_PATTERNS.some(p => p.test(text) || p.test(n))) {
    return { is_statement: false, type: null, subject: '', temporal: '', reply: null };
  }

  // P1: Casual acknowledgments
  for (const pat of CASUAL_ACK_PATTERNS) {
    if (pat.test(text) || pat.test(n)) {
      return { is_statement: true, type: 'casual_ack', subject: '', temporal: '', reply: 'OK anh.' };
    }
  }

  // P2: Confirmation with "mà" — must check before completion
  for (const pat of CONFIRMATION_PATTERNS) {
    if (pat.test(n) || pat.test(text)) {
      const subject = extractSubject(text, n);
      const temporal = extractTemporal(text);
      return {
        is_statement: true,
        type: 'confirmation',
        subject,
        temporal,
        reply: `Em đã xác nhận.${subject ? ` ${subject}` : ''} đã được hoàn thành.`,
      };
    }
  }

  // P3: Temporal updates — MUST come before completion to catch "hoàn thành tuần trước"
  for (const pat of TEMPORAL_UPDATE_PATTERNS) {
    if (pat.test(n) || pat.test(text)) {
      const subject = extractSubject(text, n);
      const temporal = extractTemporal(text);
      return {
        is_statement: true,
        type: 'temporal_update',
        subject,
        temporal,
        reply: `Đã ghi nhận anh.${subject ? ` ${subject}` : ''}${temporal ? ` (${temporal})` : ''} — em cập nhật context.`,
      };
    }
  }

  // P4: Completion statements
  for (const pat of COMPLETION_PATTERNS) {
    if (pat.test(n) || pat.test(text)) {
      const subject = extractSubject(text, n);
      const temporal = extractTemporal(text);
      return {
        is_statement: true,
        type: 'completion',
        subject,
        temporal,
        reply: `Đã ghi nhận anh.${subject ? ` ${subject}` : ''}${temporal ? ` (${temporal})` : ''} đã hoàn thành.`,
      };
    }
  }

  // P5: Generic statement
  for (const pat of INFORM_PATTERNS) {
    if (pat.test(n) || pat.test(text)) {
      const subject = extractSubject(text, n);
      return {
        is_statement: true,
        type: 'inform',
        subject,
        temporal: '',
        reply: `Em đã ghi nhận${subject ? ` ${subject}` : ''}.`,
      };
    }
  }

  return { is_statement: false, type: null, subject: '', temporal: '', reply: null };
}
