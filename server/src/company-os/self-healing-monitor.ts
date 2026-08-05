/**
 * Mi Company OS — Self-Healing Monitor (Phase 12)
 * Monitors 11 services every 60 seconds.
 * Auto-restarts failed PM2 services.
 * Alerts CEO via WhatsApp if unresolved after 2 attempts.
 * Target: NO_SILENT_FAILURE
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ServiceCheck {
  id: string;
  name: string;
  type: 'pm2' | 'http' | 'port';
  pm2_name?: string;         // for pm2 services
  health_url?: string;       // for http health checks
  port?: number;             // for port checks
  critical: boolean;         // if true, CEO alert immediately
  /**
   * Set for Mi Core's own routes, which sit behind the API-key guard. The probe then
   * sends MI_CORE_API_KEY so an authenticated endpoint is not misread as an outage.
   * Third-party endpoints (Ollama, accounting) stay unauthenticated.
   */
  authenticated?: boolean;
  /**
   * Optional body-level assertion. HTTP 200 alone is not always proof of health —
   * an endpoint can answer 200 while reporting internal corruption.
   */
  validateBody?: (body: unknown) => boolean;
}

const miCoreUrl = (route: string): string => `http://localhost:${process.env.MI_PORT || 4001}${route}`;

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * The API key is only ever sent to Mi Core on this machine. Anything else — a
 * reconfigured URL, a DNS surprise, a redirect target — must not receive it.
 */
function isLoopbackUrl(url: string): boolean {
  try {
    return LOOPBACK_HOSTNAMES.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function personalOsIntegrityIsHealthy(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const report = body as { integrityCheck?: unknown; foreignKeyViolations?: unknown };
  return report.integrityCheck === 'ok'
    && Array.isArray(report.foreignKeyViolations)
    && report.foreignKeyViolations.length === 0;
}

const SERVICES_TO_MONITOR: ServiceCheck[] = [
  { id: 'mi-core',              name: 'Mi Core Server',        type: 'pm2',  pm2_name: 'mi-core',             critical: true  },
  { id: 'whatsapp-gateway',     name: 'WhatsApp Gateway',      type: 'pm2',  pm2_name: 'mi-whatsapp-gateway', critical: true  },
  { id: 'mi-accounting',        name: 'Accounting Engine',     type: 'pm2',  pm2_name: 'mi-accounting',       critical: true  },
  { id: 'mi-ceo-observer',      name: 'CEO Observer',          type: 'pm2',  pm2_name: 'mi-ceo-observer',     critical: false },
  { id: 'mi-core-http',         name: 'Mi Core HTTP',          type: 'http', health_url: miCoreUrl('/api/health'), authenticated: true, critical: true },
  { id: 'accounting-http',      name: 'Accounting HTTP',       type: 'http', health_url: 'http://localhost:8844/health', critical: false },
  { id: 'ollama',               name: 'Ollama AI',             type: 'http', health_url: 'http://localhost:11434/api/tags', critical: true },
  // Kept under monitoring on purpose: no food-safety-gateway PM2 process exists, and
  // hiding that would defeat NO_SILENT_FAILURE. Note for whoever triages it — the
  // standalone services/food-safety-gateway/ directory has no package.json and appears
  // in no ecosystem config, while the food-safety logic now lives inside
  // mi-whatsapp-gateway (food-safety-agent, food-safety-command-center-routes). The
  // entry most likely needs retiring rather than the service starting, but that is a
  // product decision, not a probe fix.
  { id: 'food-safety-gw',       name: 'Food Safety Gateway',   type: 'pm2',  pm2_name: 'food-safety-gateway', critical: false },
  { id: 'qb-ops-agent',         name: 'QB Ops Agent',          type: 'pm2',  pm2_name: 'qb-ops-agent',        critical: false },
  { id: 'evidence-db',          name: 'Evidence DB',           type: 'http', health_url: miCoreUrl('/api/company-os/health'), authenticated: true, critical: true },
  // Personal OS integrity is a genuine readiness signal and, unlike /api/knowledge/health,
  // cannot be shadowed by the generic /api/knowledge/:id route.
  { id: 'knowledge-db',         name: 'Knowledge DB',          type: 'http', health_url: miCoreUrl('/api/personal/integrity'), authenticated: true, validateBody: personalOsIntegrityIsHealthy, critical: false },
];

export const MONITORED_SERVICES: readonly ServiceCheck[] = SERVICES_TO_MONITOR;

export interface ServiceStatus {
  id: string;
  name: string;
  healthy: boolean;
  error?: string;
  restart_attempted?: boolean;
  restart_count: number;
  last_checked: string;
}

const restartCounts: Record<string, number> = {};
const MAX_AUTO_RESTART = 2;

export async function checkPm2Service(svc: ServiceCheck): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`pm2 describe ${svc.pm2_name} --no-color`, {
      timeout: 5000,
      windowsHide: true,
    });
    return stdout.includes('online');
  } catch { return false; }
}

export async function checkHttpService(svc: ServiceCheck): Promise<boolean> {
  if (!svc.health_url) return false;
  const headers: Record<string, string> = {};
  if (svc.authenticated) {
    // Never send the key anywhere but Mi Core on this machine.
    if (!isLoopbackUrl(svc.health_url)) return false;
    const apiKey = process.env.MI_CORE_API_KEY || '';
    // No key configured means the probe cannot authenticate. Report unhealthy rather
    // than dropping the guard, and never log the key itself.
    if (!apiKey) return false;
    headers['x-api-key'] = apiKey;
  }
  try {
    const res = await fetch(svc.health_url, {
      headers,
      // Redirects are never followed. fetch does not strip custom headers such as
      // x-api-key when it follows a cross-origin redirect, so following one would
      // hand the key to whatever host the redirect names, and would then judge
      // health from that host's response. A health endpoint that redirects is not
      // healthy, so treating 3xx as unhealthy loses nothing.
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    if (!svc.validateBody) return true;
    const body = await res.json().catch(() => null);
    return svc.validateBody(body);
  } catch { return false; }
}

async function restartPm2Service(svc: ServiceCheck): Promise<boolean> {
  if (svc.type !== 'pm2' || !svc.pm2_name) return false;
  try {
    await execAsync(`pm2 restart ${svc.pm2_name}`, {
      timeout: 15_000,
      windowsHide: true,
    });
    return true;
  } catch { return false; }
}

async function sendCeoAlert(message: string): Promise<void> {
  try {
    const apiKey = process.env.MI_CORE_API_KEY || '';
    await fetch(`http://localhost:${process.env.MI_PORT || 4001}/api/whatsapp/send-ceo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.error('[SelfHeal] Alert failed:', err instanceof Error ? err.message : err);
  }
}

export async function runHealthScan(): Promise<ServiceStatus[]> {
  const results: ServiceStatus[] = [];
  const now = new Date().toISOString();

  for (const svc of SERVICES_TO_MONITOR) {
    const healthy = svc.type === 'pm2'
      ? await checkPm2Service(svc)
      : await checkHttpService(svc);

    const count = restartCounts[svc.id] || 0;
    let restartAttempted = false;

    if (!healthy) {
      if (svc.type === 'pm2' && count < MAX_AUTO_RESTART) {
        restartAttempted = await restartPm2Service(svc);
        restartCounts[svc.id] = count + 1;
        console.log(`[SelfHeal] Restarted ${svc.name} (attempt ${count + 1}/${MAX_AUTO_RESTART})`);
      } else if (count >= MAX_AUTO_RESTART || svc.critical) {
        const alertMsg = `🔴 *SERVICE DOWN*\n${svc.name} is DOWN.\n${count >= MAX_AUTO_RESTART ? 'Auto-restart exhausted.' : 'Critical service.'}\nManual action required.`;
        await sendCeoAlert(alertMsg);
        console.error(`[SelfHeal] CEO ALERT: ${svc.name} DOWN after ${count} restart(s)`);
        restartCounts[svc.id] = 0; // reset after alert
      }
    } else {
      // Service recovered — reset counter
      if (count > 0) {
        console.log(`[SelfHeal] ${svc.name} recovered after ${count} restart(s)`);
        restartCounts[svc.id] = 0;
      }
    }

    results.push({
      id: svc.id,
      name: svc.name,
      healthy,
      restart_attempted: restartAttempted,
      restart_count: restartCounts[svc.id] || 0,
      last_checked: now,
    });
  }

  return results;
}

let _monitorInterval: ReturnType<typeof setInterval> | null = null;

export function startSelfHealingMonitor(intervalMs = 60_000): void {
  if (_monitorInterval) return; // already running

  console.log(`[SelfHeal] Starting — monitoring ${SERVICES_TO_MONITOR.length} services every ${intervalMs / 1000}s`);

  _monitorInterval = setInterval(async () => {
    try {
      const results = await runHealthScan();
      const down = results.filter(r => !r.healthy);
      if (down.length > 0) {
        console.warn(`[SelfHeal] ${down.length} service(s) DOWN: ${down.map(r => r.name).join(', ')}`);
      }
    } catch (err) {
      console.error('[SelfHeal] Scan error:', err instanceof Error ? err.message : err);
    }
  }, intervalMs);
}

export function stopSelfHealingMonitor(): void {
  if (_monitorInterval) {
    clearInterval(_monitorInterval);
    _monitorInterval = null;
  }
}

export function getMonitoredServices(): ServiceCheck[] {
  return SERVICES_TO_MONITOR;
}
