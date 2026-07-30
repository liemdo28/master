/**
 * MemoryConsentLog.mjs
 * Tracks consent for storing sensitive data.
 * Required before Mi saves health data, personal info, or financial data.
 */

import fs from 'fs';
import path from 'path';

const GLOBAL_DIR     = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const CONSENT_PATH   = path.join(GLOBAL_DIR, 'executive-memory-v2', 'consent_log.json');

export class MemoryConsentLog {
  static load() {
    try { return JSON.parse(fs.readFileSync(CONSENT_PATH, 'utf-8')); }
    catch { return { consents: [] }; }
  }

  static save(data) {
    fs.mkdirSync(path.dirname(CONSENT_PATH), { recursive: true });
    fs.writeFileSync(CONSENT_PATH, JSON.stringify(data, null, 2));
  }

  static hasConsent(category) {
    const log = this.load();
    const consent = (log.consents || []).find(c => c.category === category);
    if (!consent) return false;
    // Check if consent hasn't expired (default 365 days)
    const age_days = (Date.now() - new Date(consent.ts).getTime()) / 86400000;
    return age_days < (consent.expires_days || 365);
  }

  static grantConsent(category, notes = '') {
    const log = this.load();
    log.consents = (log.consents || []).filter(c => c.category !== category);
    log.consents.push({
      category,
      ts: new Date().toISOString(),
      granted: true,
      notes,
      expires_days: 365,
    });
    this.save(log);
    return true;
  }

  static revokeConsent(category) {
    const log = this.load();
    log.consents = (log.consents || []).filter(c => c.category !== category);
    log.consents.push({
      category,
      ts: new Date().toISOString(),
      granted: false,
      revoked_at: new Date().toISOString(),
    });
    this.save(log);
  }

  static getAll() {
    return this.load().consents || [];
  }

  /** Ask before storing sensitive data */
  static requireConsent(category, description) {
    if (this.hasConsent(category)) return { ok: true, category };
    return {
      ok: false,
      category,
      needs_consent: true,
      message: `Mi cần sự đồng ý của anh để lưu: ${description}\n\nAnh có đồng ý không? [Đồng ý] [Không]`,
    };
  }
}
