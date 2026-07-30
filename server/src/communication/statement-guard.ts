/**
 * Statement Guard — P0-1: False Action Reduction
 * 
 * Detects CEO messages that are STATEMENTS, not commands.
 * These should be acknowledged — never trigger workflow creation.
 *
 * Patterns caught:
 *   - Status statements: "QB Report done", "Payroll Raw là tuần rồi"
 *   - Casual acknowledgments: "K", "Ok", "Da nhan"
 *   - Temporal context updates: "X là tuần rồi", "Y hom qua"
 *   - Informational observations: "Dashboard看起来不错" (Dashboard looks good)
 *   - Corrections: "Không phải X, là Y"
 */

export type StatementType =
  | 'status_update'        // CEO informing about completion/status
  | 'casual_ack'           // "K", "Ok", "Cam on"
  | 'temporal_update'      // "X là tuần rồi"
  | 'correction'           // "Không phải X, là Y"
  | 'observation'          // "Dashboard看起来不错"
  | 'none';               // Not a statement

export interface StatementGuardResult {
  is_statement: boolean;
  statement_type: StatementType;
  confidence: number;
  reply: string | null;
}

// ── Status completion patterns ──────────────────────────────────────────────

const STATUS_COMPLETION_PATTERNS: RegExp[] = [
  // "QB Report da hoan thanh" / "QB Report done" / "Xong roi"
  /\b(hoàn\s*thành|hoan\s*thanh|xong|done|completed|finish|finished|da\s*lam|xong\s*roi|hoan\s*tat|hoàn\s*tất)\b/i,
  // "Payroll Raw la tuan roi" (past tense temporal update)
  /\b(là\s*tuần\s*rồi|la\s*tuan\s*roi|tuần\s*sau|tuan\s*sau|next\s*week|last\s*week|hom\s*qua|hôm\s*qua|yesterday|ngày\s*kia)\b/i,
];

// ── Casual acknowledgment patterns ──────────────────────────────────────────

const CASUAL_ACK_PATTERNS: RegExp[] = [
  /^(k|ok|okie|cam\s*on|cám\s*on|thanks|thank|tks|got\s*it|nhan|nhận|da|đã|vâng|vang|dạ|yes|yep|y|👍|🙏|👌|✅)$/i,
  /^(ok\s*em|ok\s*anh|da\s*em|da\s*anh|cam\s*on\s*em|thank\s*you\s*em)$/i,
];

// ── Temporal update patterns ────────────────────────────────────────────────

const TEMPORAL_UPDATE_PATTERNS: RegExp[] = [
  // "X la tuan roi" / "X hom qua" / "X ngay kia"
  /\w+\s+(là|la)\s+(tuần\s*rồi|tuan\s*roi|tuần\s*sau|tuan\s*sau|hom\s*qua|hôm\s*qua|ngay\s*kia|ngày\s*kia)/i,
  // "X already done" / "X da xong"
  /\w+\s+(da|đã)\s+(xong|hoàn\s*thành|completed)/i,
];

// ── Correction patterns ─────────────────────────────────────────────────────

const CORRECTION_PATTERNS: RegExp[] = [
  /^(khong\s*phai|không\s*phải|not\s*)\s+\w+/i,
  /\b(sai\s*r roi|sai\s*rồi|wrong|that\s*khong|thật\s*không)\b/i,
];

// ── Observation patterns (no action needed) ─────────────────────────────────

const OBSERVATION_PATTERNS: RegExp[] = [
  /\b(tot|tốt|good|great|fine|ok\s*lam|ok\s*lắm|tot\s*lam|tốt\s*lắm|看起来不错|nice)\b/i,
  /\b(dang\s*chay|đang\s*chạy|running|working| hoạt\s*động)\b/i,
];

// ── Statement topic extraction (for context memory) ─────────────────────────

export function extractStatementTopic(message: string): string | undefined {
  const lower = message.toLowerCase();
  const topics: Array<{ pattern: RegExp; topic: string }> = [
    { pattern: /\bqb\b|quickbooks/i, topic: 'QuickBooks' },
    { pattern: /\bpayroll\b/i, topic: 'Payroll' },
    { pattern: /\bdashboard\b/i, topic: 'Dashboard' },
    { pattern: /\braw\s*sushi\b|\braw\b/i, topic: 'Raw Sushi' },
    { pattern: /\bbakudan\b/i, topic: 'Bakudan Ramen' },
    { pattern: /\bseo\b/i, topic: 'SEO' },
    { pattern: /\bdoordash\b|\bdoor\s*dash\b/i, topic: 'DoorDash' },
    { pattern: /\bmaria\b/i, topic: 'Maria' },
    { pattern: /\blaptop\s*1\b|\blaptop1\b/i, topic: 'Laptop1' },
    { pattern: /\blaptop\s*2\b|\blaptop2\b/i, topic: 'Laptop2' },
    { pattern: /\bstone\s*oak\b/i, topic: 'Stone Oak' },
    { pattern: /\bbandera\b/i, topic: 'Bandera' },
  ];
  for (const t of topics) {
    if (t.pattern.test(lower)) return t.topic;
  }
  return undefined;
}

// ── Main guard function ─────────────────────────────────────────────────────

export function evaluateStatement(message: string): StatementGuardResult {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  // 1. Casual acknowledgment
  if (CASUAL_ACK_PATTERNS.some(p => p.test(trimmed))) {
    return {
      is_statement: true,
      statement_type: 'casual_ack',
      confidence: 0.95,
      reply: 'Dạ.',
    };
  }

  // 2. Correction
  if (CORRECTION_PATTERNS.some(p => p.test(lower))) {
    const topic = extractStatementTopic(lower);
    return {
      is_statement: true,
      statement_type: 'correction',
      confidence: 0.85,
      reply: topic
        ? `Dạ em hiểu rồi. Em đã cập nhật: ${topic} — em sẽ ghi nhớ thông tin mới.`
        : 'Dạ em hiểu rồi. Em đã ghi nhận correction.',
    };
  }

  // 3. Status completion (but NOT if there's an action verb suggesting they want Mi to DO something)
  const hasActionVerb = /\b(tao|tạo|create|gui|gửi|send|post|dang|đăng|deploy|xoa|delete|fix|sua|sửa|update|cap\s*nhat|cập\s*nhật)\b/i.test(lower);
  if (!hasActionVerb && STATUS_COMPLETION_PATTERNS.some(p => p.test(lower))) {
    const topic = extractStatementTopic(lower);
    return {
      is_statement: true,
      statement_type: 'status_update',
      confidence: 0.90,
      reply: topic
        ? `Dạ em ghi nhận: ${topic} đã hoàn thành/status update.`
        : 'Dạ em ghi nhận.',
    };
  }

  // 4. Temporal update (no action verb)
  if (!hasActionVerb && TEMPORAL_UPDATE_PATTERNS.some(p => p.test(lower))) {
    const topic = extractStatementTopic(lower);
    return {
      is_statement: true,
      statement_type: 'temporal_update',
      confidence: 0.85,
      reply: topic
        ? `Dạ em hiểu. ${topic} — em đã cập nhật lịch.`
        : 'Dạ em đã cập nhật thông tin thời gian.',
    };
  }

  // 5. Observation (no action needed)
  if (!hasActionVerb && OBSERVATION_PATTERNS.some(p => p.test(lower)) && lower.length < 80) {
    return {
      is_statement: true,
      statement_type: 'observation',
      confidence: 0.75,
      reply: 'Dạ, em ghi nhận.',
    };
  }

  // Not a statement — proceed to normal routing
  return {
    is_statement: false,
    statement_type: 'none',
    confidence: 0,
    reply: null,
  };
}
