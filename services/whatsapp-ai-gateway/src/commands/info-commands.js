/**
 * Info Commands — /template, /log, /status
 * These are read-only status commands, no session required.
 */

const templateCache = require('../templates/template-cache');
const { formatVersionReply } = require('../runtime/build-info');
const { makeLogger } = require('../logger');
const log = makeLogger('whatsapp');

// Lazy loads to avoid circular deps
function getSyncService()  { try { return require('../templates/template-sync-service'); } catch (_) { return null; } }
function getSessionMgr()   { try { return require('../whatsapp/session-manager'); } catch (_) { return null; } }
function getTgForwarder()  { try { return require('../telegram/telegram-forwarder'); } catch (_) { return null; } }
function getFsStorage()    { try { return require('../storage/food-safety-storage'); } catch (_) { return null; } }

// ── Command detection ─────────────────────────────────────────────────────────
function isInfoCommand(text) {
  return /^\/(?:template|log|status|version)\s*$/i.test(String(text || '').trim());
}

// ── Dispatch ──────────────────────────────────────────────────────────────────
async function handleInfoCommand(text) {
  const cmd = String(text || '').trim().toLowerCase();
  if (cmd === '/template') return templateReply();
  if (cmd === '/log')      return await logReply();
  if (cmd === '/status')   return await statusReply();
  if (cmd === '/version')  return formatVersionReply();
  return null;
}

// ── /template ─────────────────────────────────────────────────────────────────
function templateReply() {
  const s     = templateCache.getStatus();
  const items = templateCache.getItemNames();
  const lines = [
    '📋 *Template Status*',
    '',
    `Last Sync: ${s.syncedAt ? s.syncedAt.slice(0, 19).replace('T', ' ') : 'Never'}`,
    `Version:   ${s.version || '—'}`,
    `Items:     ${s.rowCount}`,
    `Source:    ${s.source}`,
    '',
    '*Current Items:*',
    ...items.map((name, idx) => {
      const item = templateCache.getItems().find(i => i.name === name);
      const range = (item?.min != null || item?.max != null)
        ? ` (${item.min ?? '—'} – ${item.max ?? '—'})`
        : '';
      return `  ${idx + 1}. ${name}${range}`;
    }),
  ];

  const syncSvc = getSyncService();
  if (syncSvc?.isSyncing()) lines.push('', '🔄 Sync in progress...');

  return lines.join('\n');
}

// ── /log ──────────────────────────────────────────────────────────────────────
async function logReply() {
  const logUrl = process.env.LOG_SHEET_URL || process.env.FOOD_SAFETY_LOG_SHEET_URL || '(not configured)';
  const lines  = [
    '📊 *Log Status*',
    '',
    `Sheet: ${logUrl}`,
  ];

  const fss = getFsStorage();
  if (fss) {
    try {
      const queue = await fss.getSheetQueueStatus();
      lines.push(`Pending queue: ${queue?.pending ?? 0}`);
      const lastLog = await fss.getLastBrothLog?.();
      if (lastLog) {
        lines.push('', `Last write: ${lastLog.created_at ? lastLog.created_at.slice(0, 19) : '—'}`);
        lines.push(`Store: ${lastLog.store || '—'}`);
        lines.push(`Status: ${lastLog.sheet_write_status || '—'}`);
      }
    } catch (_) {}
  }

  lines.push('', 'Send CONFIRM after your /broth session to write a row.');
  return lines.join('\n');
}

// ── /status ───────────────────────────────────────────────────────────────────
async function statusReply() {
  const waStatus  = getSessionMgr()?.getStatus?.()?.status  || 'unknown';
  const tgEnabled = getTgForwarder()?.isEnabled?.()          || false;
  const tmpl      = templateCache.getStatus();
  const syncSvc   = getSyncService();
  const lastSync  = syncSvc?.getLastResult?.();

  const sheetsOk  = process.env.GOOGLE_SHEETS_ENABLED === 'true';
  const visionOk  = !!(process.env.VISION_API_URL && process.env.VISION_API_KEY);

  const icon = (ok) => ok ? '✅' : '❌';

  const lines = [
    '🔍 *System Status*',
    '',
    `${icon(waStatus === 'ready')} WhatsApp: ${waStatus.toUpperCase()}`,
    `${icon(tgEnabled)} Telegram: ${tgEnabled ? 'CONNECTED' : 'DISABLED'}`,
    `${icon(sheetsOk)} Google Sheets: ${sheetsOk ? 'ENABLED' : 'DISABLED'}`,
    `${icon(visionOk)} Vision API: ${visionOk ? 'CONFIGURED' : 'NOT CONFIGURED'}`,
    '',
    `📋 Template: ${tmpl.source} (${tmpl.rowCount} items)`,
    `   Version: ${tmpl.version || '—'}`,
    `   Synced:  ${tmpl.syncedAt ? tmpl.syncedAt.slice(0, 19).replace('T', ' ') : 'Never'}`,
  ];

  if (lastSync) {
    const indicator = lastSync.status === 'SUCCESS' ? '✅' : '⚠️';
    lines.push(`   Last sync: ${indicator} ${lastSync.status}`);
  }
  if (syncSvc?.isSyncing()) lines.push('   🔄 Sync in progress...');

  return lines.join('\n');
}

module.exports = { isInfoCommand, handleInfoCommand };
