/**
 * Mi Company OS — Self-Healing Monitor (Phase 12)
 * Monitors 11 services every 60 seconds.
 * Auto-restarts failed PM2 services.
 * Alerts CEO via WhatsApp if unresolved after 2 attempts.
 * Target: NO_SILENT_FAILURE
 */

import { exec } from 'child_process';
import net from 'net';
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
}

const SERVICES_TO_MONITOR: ServiceCheck[] = [
  { id: 'mi-core',              name: 'Mi Core Server',        type: 'pm2',  pm2_name: 'mi-core',             critical: true  },
  { id: 'whatsapp-gateway',     name: 'WhatsApp Gateway',      type: 'pm2',  pm2_name: 'mi-whatsapp-gateway', critical: true  },
  { id: 'mi-accounting',        name: 'Accounting Engine',     type: 'pm2',  pm2_name: 'mi-accounting',       critical: true  },
  { id: 'mi-ceo-observer',      name: 'CEO Observer',          type: 'pm2',  pm2_name: 'mi-ceo-observer',     critical: false },
  { id: 'mi-core-http',         name: 'Mi Core HTTP',          type: 'http', health_url: `http://localhost:${process.env.MI_PORT || 4001}/api/health`, critical: true },
  { id: 'accounting-http',      name: 'Accounting HTTP',       type: 'http', health_url: 'http://localhost:8844/health', critical: false },
  { id: 'ollama',               name: 'Ollama AI',             type: 'http', health_url: 'http://localhost:11434/api/tags', critical: true },
  { id: 'food-safety-gw',       name: 'Food Safety Gateway',   type: 'http', health_url: 'http://localhost:3211/api/food-safety/health', critical: false },
  { id: 'qb-ops-agent',         name: 'QB Ops Agent',          type: 'pm2',  pm2_name: 'qb-ops-agent',        critical: false },
  { id: 'qb-ops-soap',          name: 'QB Ops SOAP Port',      type: 'port', port: 3457, critical: false },
  { id: 'evidence-db',          name: 'Evidence DB',           type: 'http', health_url: `http://localhost:${process.env.MI_PORT || 4001}/api/company-os/health`, critical: true },
  { id: 'knowledge-db',         name: 'Knowledge DB',          type: 'http', health_url: `http://localhost:${process.env.MI_PORT || 4001}/api/knowledge/us-compliance/health`, critical: false },
];

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
const SELF_PROCESS_IDS = new Set(['mi-core', 'mi-core-http', 'evidence-db', 'knowledge-db']);

async function checkPm2Service(svc: ServiceCheck): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`pm2 describe ${svc.pm2_name} --no-color`, {
      timeout: 5000,
      windowsHide: true,
    });
    return stdout.includes('online');
  } catch { return false; }
}

async function checkHttpService(svc: ServiceCheck): Promise<boolean> {
  if (!svc.health_url) return false;
  try {
    const res = await fetch(svc.health_url, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch { return false; }
}

async function checkPortService(svc: ServiceCheck): Promise<boolean> {
  if (!svc.port) return false;
  const port = svc.port;
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const done = (healthy: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(healthy);
    };
    socket.setTimeout(3000);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
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
      : svc.type === 'port'
        ? await checkPortService(svc)
        : await checkHttpService(svc);

    const count = restartCounts[svc.id] || 0;
    let restartAttempted = false;

    if (!healthy) {
      if (svc.type === 'pm2' && count < MAX_AUTO_RESTART) {
        if (SELF_PROCESS_IDS.has(svc.id)) {
          console.warn(`[SelfHeal] ${svc.name} is unhealthy; skipping self-restart to avoid port contention`);
        } else {
          restartAttempted = await restartPm2Service(svc);
          restartCounts[svc.id] = count + 1;
          console.log(`[SelfHeal] Restarted ${svc.name} (attempt ${count + 1}/${MAX_AUTO_RESTART})`);
        }
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
