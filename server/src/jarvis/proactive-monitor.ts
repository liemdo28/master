/**
 * Proactive Monitor — Phase 4 Jarvis Build
 * Runs periodic risk checks and pushes WhatsApp alerts to CEO.
 * Respects mute rules. Deduplicates alerts within a window.
 */

import { evaluateSystemRisk, formatRiskSummary, RiskSignal } from './risk-engine';
import { generateSuggestions } from './suggestion-engine';
import { isMuted, getPreferences } from './ceo-preference-store';
import { queueToCeo } from '../services/whatsapp-sender';

export type AlertType = 'critical' | 'warning' | 'info' | 'daily_briefing' | 'approval_required' | 'task_complete' | 'task_failed';

export interface ProactiveAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  suggestions: string[];
  sent_at?: string;
  acknowledged?: boolean;
  pushed_to_whatsapp?: boolean;
}

const ALERT_HISTORY: ProactiveAlert[] = [];
// Dedup: track last sent content to avoid spam (30 min window)
const LAST_SENT: Map<string, number> = new Map();
const DEDUP_WINDOW_MS = 30 * 60_000;

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let alertCallback: ((alert: ProactiveAlert) => void) | null = null;

export function onAlert(cb: (alert: ProactiveAlert) => void) {
  alertCallback = cb;
}

function isDuplicate(key: string): boolean {
  const last = LAST_SENT.get(key);
  return !!last && Date.now() - last < DEDUP_WINDOW_MS;
}

function markSent(key: string) {
  LAST_SENT.set(key, Date.now());
  // Prune old keys
  if (LAST_SENT.size > 100) {
    const cutoff = Date.now() - DEDUP_WINDOW_MS * 2;
    for (const [k, v] of LAST_SENT) { if (v < cutoff) LAST_SENT.delete(k); }
  }
}

function fire(alert: ProactiveAlert) {
  alert.sent_at = new Date().toISOString();
  ALERT_HISTORY.push(alert);
  if (ALERT_HISTORY.length > 200) ALERT_HISTORY.shift();
  if (alertCallback) alertCallback(alert);

  // Push to WhatsApp (non-blocking)
  const message = formatAlertForWhatsApp(alert);
  const dedupKey = alert.type + ':' + alert.title;
  if (!isDuplicate(dedupKey)) {
    markSent(dedupKey);
    alert.pushed_to_whatsapp = true;
    queueToCeo(message);
  }
}

function formatAlertForWhatsApp(alert: ProactiveAlert): string {
  const lines = [alert.title, '', alert.message];
  if (alert.suggestions.length > 0) {
    lines.push('', '💡 *Gợi ý:*');
    alert.suggestions.slice(0, 2).forEach(s => lines.push(`• ${s}`));
  }
  return lines.join('\n');
}

export async function runMonitorCycle(): Promise<ProactiveAlert[]> {
  const prefs = getPreferences();
  const alerts: ProactiveAlert[] = [];

  const signals: RiskSignal[] = await evaluateSystemRisk();
  const criticals = signals.filter(s => s.level === 'critical');
  const warnings  = signals.filter(s => s.level === 'warning');

  if (criticals.length > 0 && !isMuted('critical') && !isMuted('all')) {
    const sug = generateSuggestions(criticals);
    const alert: ProactiveAlert = {
      id: 'alert_' + Date.now(),
      type: 'critical',
      title: `🔴 ${criticals.length} vấn đề CRITICAL`,
      message: formatRiskSummary(criticals),
      suggestions: sug.map(s => s.whatsapp_prompt),
    };
    fire(alert);
    alerts.push(alert);
  }

  if (warnings.length > 0 && prefs.alert_level !== 'critical_only' &&
      !isMuted('warning') && !isMuted('all')) {
    const sug = generateSuggestions(warnings);
    const alert: ProactiveAlert = {
      id: 'alert_' + Date.now() + 1,
      type: 'warning',
      title: `🟡 ${warnings.length} cảnh báo`,
      message: formatRiskSummary(warnings),
      suggestions: sug.map(s => s.whatsapp_prompt),
    };
    fire(alert);
    alerts.push(alert);
  }

  return alerts;
}

export function startProactiveMonitor(intervalMinutes = 15) {
  if (monitorInterval) return;
  monitorInterval = setInterval(async () => {
    try { await runMonitorCycle(); } catch { /* never crash */ }
  }, intervalMinutes * 60_000);
  console.log(`[ProactiveMonitor] Started — interval ${intervalMinutes}min, WhatsApp push enabled`);
}

export function stopProactiveMonitor() {
  if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; }
}

export function getAlertHistory(limit = 20): ProactiveAlert[] {
  return ALERT_HISTORY.slice(-limit).reverse();
}

export function acknowledgeAlert(id: string) {
  const a = ALERT_HISTORY.find(a => a.id === id);
  if (a) a.acknowledged = true;
}

/**
 * Fire an ad-hoc alert (called from autonomous tasks, approval events, etc.)
 */
export function fireAlert(type: AlertType, title: string, message: string, suggestions: string[] = []) {
  fire({ id: 'adhoc_' + Date.now(), type, title, message, suggestions });
}
