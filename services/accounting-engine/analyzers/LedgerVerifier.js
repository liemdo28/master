// analyzers/LedgerVerifier.js - Facade around AuditLedger.verifyChain with reporting
import { verifyChain, getAuditEvents } from '../core/AuditLedger.js';

export function verifyLedger(db) {
  const result = verifyChain(db);
  return {
    ...result,
    checkedAt: new Date().toISOString(),
    summary: result.valid
      ? `Chain intact — ${result.rowsChecked} rows verified`
      : `TAMPERED — first invalid row at sequence ${result.firstInvalid}: ${result.reason}`,
  };
}

export function getLedgerSummary(db) {
  const verification = verifyLedger(db);
  const recentEvents = getAuditEvents(db, 10);
  const eventCounts  = db.prepare(`
    SELECT event_type, COUNT(*) as count
    FROM audit_ledger GROUP BY event_type ORDER BY count DESC
  `).all();

  return { verification, recentEvents, eventCounts };
}
