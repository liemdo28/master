/**
 * P2 — Evidence Gate Runtime
 *
 * Every response must pass through evidence classification BEFORE
 * any decision is made. Evidence states:
 *
 *   CONFIRMED   — verified source, fresh data, file exists
 *   STALE       — data exists but older than threshold
 *   MISSING     — no data source available
 *   UNCONFIRMED — data exists but not verified this session
 *
 * Rule: No decision before evidence state exists.
 * 100% of responses must be classified.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type EvidenceState = 'CONFIRMED' | 'STALE' | 'MISSING' | 'UNCONFIRMED';

export interface EvidenceClassification {
  state: EvidenceState;
  source: string;           // where the data comes from
  freshness_minutes: number | null;
  confidence: number;       // 0-100
  reason: string;           // human-readable explanation
  requires_disclaimer: boolean;
}

export interface EvidenceGateInput {
  response_type: 'data' | 'action' | 'acknowledgment' | 'clarification';
  data_source?: string;     // e.g. 'quickbooks', 'dashboard_api', 'health_check'
  data_age_minutes?: number;
  file_path?: string;       // for image/file claims
  file_exists?: boolean;
  file_readable?: boolean;
  file_size_bytes?: number;
  connector_status?: 'connected' | 'degraded' | 'offline' | 'not_configured';
  user_stated?: boolean;    // CEO said it themselves (higher trust)
}

// ── Freshness thresholds (minutes) ───────────────────────────────────────────

const FRESHNESS_THRESHOLDS: Record<string, number> = {
  quickbooks: 1440,       // 24 hours
  dashboard_api: 5,       // 5 minutes
  health_check: 10,       // 10 minutes
  finance_cache: 1440,    // 24 hours
  knowledge_base: 10080,  // 7 days
  asana: 60,              // 1 hour
  calendar: 30,           // 30 minutes
  default: 60,            // 1 hour
};

// ── Core classifier ───────────────────────────────────────────────────────────

export function classifyEvidence(input: EvidenceGateInput): EvidenceClassification {
  // Acknowledgments and clarifications don't need evidence
  if (input.response_type === 'acknowledgment') {
    return {
      state: 'CONFIRMED',
      source: 'acknowledge_engine',
      freshness_minutes: 0,
      confidence: 100,
      reason: 'Statement acknowledged — no data verification needed',
      requires_disclaimer: false,
    };
  }

  if (input.response_type === 'clarification') {
    return {
      state: 'CONFIRMED',
      source: 'conversation_context',
      freshness_minutes: 0,
      confidence: 100,
      reason: 'Clarification requested — no data to verify',
      requires_disclaimer: false,
    };
  }

  // File/image claims require physical file verification
  if (input.file_path !== undefined) {
    if (!input.file_exists) {
      return {
        state: 'MISSING',
        source: 'file_system',
        freshness_minutes: null,
        confidence: 0,
        reason: `File does not exist: ${input.file_path}`,
        requires_disclaimer: true,
      };
    }
    if (!input.file_readable) {
      return {
        state: 'MISSING',
        source: 'file_system',
        freshness_minutes: null,
        confidence: 0,
        reason: `File exists but not readable: ${input.file_path}`,
        requires_disclaimer: true,
      };
    }
    if (input.file_size_bytes !== undefined && input.file_size_bytes <= 0) {
      return {
        state: 'MISSING',
        source: 'file_system',
        freshness_minutes: null,
        confidence: 0,
        reason: `File is empty (0 bytes): ${input.file_path}`,
        requires_disclaimer: true,
      };
    }
    return {
      state: 'CONFIRMED',
      source: 'file_system',
      freshness_minutes: 0,
      confidence: 95,
      reason: `File verified: ${input.file_path} (${input.file_size_bytes} bytes)`,
      requires_disclaimer: false,
    };
  }

  // Connector offline → data is MISSING
  if (input.connector_status === 'offline' || input.connector_status === 'not_configured') {
    return {
      state: 'MISSING',
      source: input.data_source || 'unknown',
      freshness_minutes: input.data_age_minutes ?? null,
      confidence: 0,
      reason: `Connector ${input.connector_status}: ${input.data_source || 'unknown'}`,
      requires_disclaimer: true,
    };
  }

  // Connector degraded → UNCONFIRMED
  if (input.connector_status === 'degraded') {
    return {
      state: 'UNCONFIRMED',
      source: input.data_source || 'unknown',
      freshness_minutes: input.data_age_minutes ?? null,
      confidence: 40,
      reason: `Connector degraded — data may be incomplete`,
      requires_disclaimer: true,
    };
  }

  // Data source exists with age → check freshness
  if (input.data_source && input.data_age_minutes !== undefined) {
    const threshold = FRESHNESS_THRESHOLDS[input.data_source] || FRESHNESS_THRESHOLDS.default;
    if (input.data_age_minutes <= threshold) {
      return {
        state: 'CONFIRMED',
        source: input.data_source,
        freshness_minutes: input.data_age_minutes,
        confidence: 85,
        reason: `Data fresh from ${input.data_source} (${input.data_age_minutes}m old, threshold: ${threshold}m)`,
        requires_disclaimer: false,
      };
    }
    return {
      state: 'STALE',
      source: input.data_source,
      freshness_minutes: input.data_age_minutes,
      confidence: 30,
      reason: `Data stale: ${input.data_age_minutes}m old (threshold: ${threshold}m)`,
      requires_disclaimer: true,
    };
  }

  // No data source at all
  if (!input.data_source) {
    return {
      state: 'MISSING',
      source: 'none',
      freshness_minutes: null,
      confidence: 0,
      reason: 'No data source identified',
      requires_disclaimer: true,
    };
  }

  // Default: UNCONFIRMED
  return {
    state: 'UNCONFIRMED',
    source: input.data_source,
    freshness_minutes: input.data_age_minutes ?? null,
    confidence: 50,
    reason: `Data exists but not verified this session`,
    requires_disclaimer: true,
  };
}

// ── Evidence Gate Enforcement ─────────────────────────────────────────────────

export function enforceEvidenceGate(
  classification: EvidenceClassification,
  proposed_reply: string,
): { allowed: boolean; reply: string; state: EvidenceState } {
  if (classification.state === 'CONFIRMED' && !classification.requires_disclaimer) {
    return { allowed: true, reply: proposed_reply, state: classification.state };
  }

  if (classification.state === 'MISSING') {
    // Block the response entirely — replace with honest "no data" message
    return {
      allowed: true,
      reply: `⚠️ *Em chưa có dữ liệu để trả lời*\n\n*Lý do:* ${classification.reason}\n\nMi không tự bịa kết quả.`,
      state: classification.state,
    };
  }

  if (classification.state === 'STALE') {
    // Allow but WITH disclaimer
    const disclaimer = `\n\n⚠️ *Lưu ý:* Dữ liệu từ ${classification.source} đã ${classification.freshness_minutes} phút — có thể chưa cập nhật.`;
    return {
      allowed: true,
      reply: proposed_reply + disclaimer,
      state: classification.state,
    };
  }

  if (classification.state === 'UNCONFIRMED') {
    // Allow but WITH disclaimer
    const disclaimer = `\n\n⚠️ *Lưu ý:* Dữ liệu chưa được xác minh trong session này — anh nên kiểm tra lại.`;
    return {
      allowed: true,
      reply: proposed_reply + disclaimer,
      state: classification.state,
    };
  }

  return { allowed: true, reply: proposed_reply, state: classification.state };
}

// ── Convenience: check for false image claims ─────────────────────────────────

export function verifyImageExists(filePath: string): {
  exists: boolean;
  readable: boolean;
  size_bytes: number;
} {
  try {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) return { exists: false, readable: false, size_bytes: 0 };
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return { exists: false, readable: false, size_bytes: 0 };
    // Try to read first byte
    try {
      const fd = fs.openSync(filePath, 'r');
      const buf = Buffer.alloc(1);
      fs.readSync(fd, buf, 0, 1, 0);
      fs.closeSync(fd);
      return { exists: true, readable: true, size_bytes: stat.size };
    } catch {
      return { exists: true, readable: false, size_bytes: stat.size };
    }
  } catch {
    return { exists: false, readable: false, size_bytes: 0 };
  }
}
