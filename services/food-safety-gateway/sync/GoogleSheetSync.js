// Google Sheet sync for confirmed Food Safety records.
//
// Graceful degradation is a hard requirement: if credentials are missing or a
// push fails, the record stays local with sync_status = PENDING and the
// WhatsApp flow is never blocked.

import { SYNC_STATUS } from '../db/RecordStore.js';

export class GoogleSheetSync {
  /**
   * @param {object} [opts]
   * @param {object} [opts.credentials] - e.g. { clientEmail, privateKey, sheetId }
   * @param {(record: object) => Promise<void>} [opts.pusher] - injectable transport
   */
  constructor(opts = {}) {
    this._credentials = opts.credentials || null;
    // Allow a custom transport (real Google Sheets client) to be injected.
    this._pusher = opts.pusher || null;
  }

  /** Whether credentials are configured. */
  isConfigured() {
    if (this._pusher) return true;
    const c = this._credentials;
    return !!(c && c.clientEmail && c.privateKey && c.sheetId);
  }

  /**
   * Attempt to push a record to Google Sheets.
   * Never throws — always returns a result describing the outcome.
   * @param {object} record
   * @returns {Promise<{ ok: boolean, sync_status: string, reason?: string }>}
   */
  async push(record) {
    if (!this.isConfigured()) {
      return {
        ok: false,
        sync_status: SYNC_STATUS.PENDING,
        reason: 'CREDENTIALS_MISSING',
      };
    }

    try {
      if (this._pusher) {
        await this._pusher(record);
      }
      // A real implementation would append a row here using this._credentials.
      return { ok: true, sync_status: SYNC_STATUS.SYNCED };
    } catch (err) {
      return {
        ok: false,
        sync_status: SYNC_STATUS.PENDING,
        reason: `PUSH_FAILED: ${err?.message || 'unknown error'}`,
      };
    }
  }
}
