/**
 * Mi Company OS — Self-Healing Monitor (Phase 12)
 * Monitors the registered services every 60 seconds.
 * Auto-restarts failed PM2 services.
 * Alerts CEO via WhatsApp if unresolved after 2 attempts.
 * Target: NO_SILENT_FAILURE
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { intentionallyStoppedServices } from '../runtime-preflight/validator';
import { ControlledActionStore } from '../personal-os/actions/store';
import { GovernanceStore } from '../personal-os/actions/governance/store';
import { KillSwitchService } from '../personal-os/actions/governance/kill-switch';
import { getOpsDb, nowIso as opsNowIso } from '../operations/ops-db';

const execAsync = promisify(exec);

export interface ServiceCheck {
  id: string;
  name: string;
  type: 'pm2' | 'http' | 'port' | 'internal';
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
  /**
   * Phase 7B — for type:'internal'. Calls the same logic the equivalent HTTP route
   * would run, but in-process — no loopback fetch, so this probe can never be starved
   * by the global rate limiter (the confirmed root cause of a prior false-positive
   * "Evidence DB DOWN"/"Knowledge DB DOWN" alert: both used to be HTTP checks against
   * mi-core's own /api/company-os/health and /api/personal/integrity, which sit behind
   * the same IP-keyed limiter as any other traffic and are not in the internal-bypass
   * allowlist). Must never throw — return false on any internal error.
   */
  check?: () => Promise<boolean>;
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

export function personalOsIntegrityIsHealthy(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const report = body as { integrityCheck?: unknown; foreignKeyViolations?: unknown };
  return report.integrityCheck === 'ok'
    && Array.isArray(report.foreignKeyViolations)
    && report.foreignKeyViolations.length === 0;
}

/** Same check GET /api/personal/integrity performs, called in-process. */
async function checkPersonalOsIntegrityInternal(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PersonalOsService } = require('../personal-os/service');
    const service = new PersonalOsService();
    try {
      return personalOsIntegrityIsHealthy(service.store.integrity());
    } finally {
      service.close();
    }
  } catch {
    return false;
  }
}

/** Same check GET /api/company-os/health performs, called in-process. */
async function checkCompanyOsHealthInternal(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getActiveDepts } = require('./departments');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { listBrainAssignments } = require('./brain-registry');
    getActiveDepts();
    listBrainAssignments();
    return true;
  } catch {
    return false;
  }
}

const SERVICES_TO_MONITOR: ServiceCheck[] = [
  { id: 'mi-core',              name: 'Mi Core Server',        type: 'pm2',  pm2_name: 'mi-core',             critical: true  },
  { id: 'whatsapp-gateway',     name: 'WhatsApp Gateway',      type: 'pm2',  pm2_name: 'mi-whatsapp-gateway', critical: true  },
  { id: 'mi-accounting',        name: 'Accounting Engine',     type: 'pm2',  pm2_name: 'mi-accounting',       critical: true  },
  { id: 'mi-ceo-observer',      name: 'CEO Observer',          type: 'pm2',  pm2_name: 'mi-ceo-observer',     critical: false },
  { id: 'mi-core-http',         name: 'Mi Core HTTP',          type: 'http', health_url: miCoreUrl('/api/health'), authenticated: true, critical: true },
  { id: 'accounting-http',      name: 'Accounting HTTP',       type: 'http', health_url: 'http://localhost:8844/health', critical: false },
  { id: 'ollama',               name: 'Ollama AI',             type: 'http', health_url: 'http://localhost:11434/api/tags', critical: true },
  // The standalone food-safety-gateway PM2 entry was retired here. It is superseded:
  // food-safety now runs inside mi-whatsapp-gateway (monitored above), which mounts
  // /api/food-safety and initialises the food-safety pipeline at boot. Monitoring a
  // process that is never meant to exist is a permanent false alarm, not a safety net —
  // see docs/operations/FOOD_SAFETY_GATEWAY_RETIREMENT.md for the full evidence.
  { id: 'qb-ops-agent',         name: 'QB Ops Agent',          type: 'pm2',  pm2_name: 'qb-ops-agent',        critical: false },
  // Phase 7B: converted from HTTP loopback checks to direct in-process calls — the
  // HTTP versions sat behind the same rate limiter as regular traffic and were not in
  // the internal-bypass allowlist (only /api/jarvis*/api/mi* are exempt), so a request
  // burst from anywhere could starve these self-checks into a false "DOWN" alert. Same
  // underlying logic, called directly instead of round-tripping through HTTP to itself.
  { id: 'evidence-db',          name: 'Evidence DB',           type: 'internal', check: checkCompanyOsHealthInternal, critical: true },
  { id: 'knowledge-db',         name: 'Knowledge DB',          type: 'internal', check: checkPersonalOsIntegrityInternal, critical: false },
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
  /** Phase 7B — undefined means "never observed healthy/failed since process start",
   *  not a fabricated historical timestamp. */
  last_healthy_at?: string;
  last_failure_at?: string;
}

const restartCounts: Record<string, number> = {};
const lastHealthyAt: Record<string, string> = {};
const lastFailureAt: Record<string, string> = {};
/** Phase 7B — the latest completed scan, cached so read-only health consumers (the
 *  new canonical health model) never trigger a fresh probe synchronously per HTTP
 *  request; they read whatever SelfHeal's own periodic scan last observed. */
let _lastScanResults: ServiceStatus[] | null = null;
let _lastScanAt: string | null = null;

export function getLastScanResults(): { results: ServiceStatus[] | null; scannedAt: string | null } {
  return { results: _lastScanResults, scannedAt: _lastScanAt };
}
const MAX_AUTO_RESTART = 2;

/**
 * Phase 9A — the deterministic, code-verified boundary on what this monitor may
 * ever restart. Derived from SERVICES_TO_MONITOR's own pm2-type entries, not a
 * separate list, so it can never drift from what's actually configured above.
 * `restartPm2Service` and `evaluateRestartEligibility` both re-check membership
 * before issuing a `pm2 restart` — defense-in-depth against any future change
 * that might otherwise let a dynamic/caller-influenced name reach exec().
 */
export const RESTART_ALLOWLIST: ReadonlySet<string> = new Set(
  SERVICES_TO_MONITOR.filter(s => s.type === 'pm2' && s.pm2_name).map(s => s.pm2_name as string)
);

export type RestartDecision =
  | 'eligible'
  | 'not_pm2_type'
  | 'not_allowlisted'
  | 'intentionally_stopped'
  | 'restart_limit_reached'
  | 'kill_switch_blocked';

let _actionStore: ControlledActionStore | null = null;
let _killSwitch: KillSwitchService | null = null;

/**
 * Phase 9A — lazily-constructed, read-only access to the same governance
 * kill-switch store ControlledActionService uses. This monitor never proposes,
 * approves, or executes a Controlled Action — it only reads whether a GLOBAL
 * kill switch is currently enabled, as one more gate before a `pm2 restart`.
 * Only GLOBAL-scope switches can ever match here: this restart capability has
 * no real ActionType (and Phase 9 explicitly must not add one), so a
 * PROJECT/ACTION_TYPE-scope switch can never be created against it. This is a
 * deliberate, honest constraint, not an oversight.
 */
function killSwitch(): KillSwitchService {
  if (!_killSwitch) {
    _actionStore = new ControlledActionStore();
    _killSwitch = new KillSwitchService(new GovernanceStore(_actionStore.handle));
  }
  return _killSwitch;
}

function isGlobalKillSwitchActive(): boolean {
  try {
    return killSwitch().state({ projectId: null, actionType: 'internal:self-healing-monitor:restart' }).blocked;
  } catch {
    // A governance-store read failure must never itself block or silently allow a
    // restart decision either way — treat it as "cannot confirm safe", i.e. blocked.
    return true;
  }
}

/** Phase 9A — closes the DB handle this monitor lazily opened, if any. Test/shutdown only. */
export function closeSelfHealingGovernanceHandle(): void {
  if (_actionStore) {
    _actionStore.close();
    _actionStore = null;
    _killSwitch = null;
  }
}

/**
 * Phase 9A — the single decision point for whether a restart may be attempted.
 * Every branch here is deterministic and independently testable; nothing here
 * ever consults a caller-supplied value — `svc` always comes from the fixed
 * SERVICES_TO_MONITOR array above.
 */
export function evaluateRestartEligibility(svc: ServiceCheck, restartCount: number): RestartDecision {
  if (svc.type !== 'pm2' || !svc.pm2_name) return 'not_pm2_type';
  if (!RESTART_ALLOWLIST.has(svc.pm2_name)) return 'not_allowlisted';
  if (intentionallyStoppedServices().includes(svc.pm2_name)) return 'intentionally_stopped';
  if (restartCount >= MAX_AUTO_RESTART) return 'restart_limit_reached';
  if (isGlobalKillSwitchActive()) return 'kill_switch_blocked';
  return 'eligible';
}

/** Phase 9A — durable evidence for every restart decision, replacing the previous
 *  console-only/in-memory-only trail. Never throws — a logging failure must not
 *  block or corrupt the actual health-scan/restart decision. */
function recordRestartEvidence(svc: ServiceCheck, decision: RestartDecision, outcome: 'command_issued' | 'command_failed' | null, attemptNumber: number, detail: string): void {
  try {
    getOpsDb().prepare(
      `INSERT INTO self_heal_restart_log (service_id, pm2_name, decision, outcome, restart_attempt_number, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(svc.id, svc.pm2_name ?? '', decision, outcome, attemptNumber, detail, opsNowIso());
  } catch (err) {
    console.error('[SelfHeal] evidence write failed (restart decision itself is unaffected):', err instanceof Error ? err.message : err);
  }
}

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
  // Phase 9A defense-in-depth: re-checked here, not just by the caller, so this
  // function can never be reached with an out-of-allowlist target even if a
  // future refactor changes how callers invoke it.
  if (svc.type !== 'pm2' || !svc.pm2_name || !RESTART_ALLOWLIST.has(svc.pm2_name)) return false;
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

async function dispatchCheck(svc: ServiceCheck): Promise<boolean> {
  if (svc.type === 'pm2') return checkPm2Service(svc);
  if (svc.type === 'internal') {
    if (!svc.check) return false;
    try { return await svc.check(); } catch { return false; }
  }
  return checkHttpService(svc);
}

export async function runHealthScan(): Promise<ServiceStatus[]> {
  const results: ServiceStatus[] = [];
  const now = new Date().toISOString();

  for (const svc of SERVICES_TO_MONITOR) {
    const healthy = await dispatchCheck(svc);

    const count = restartCounts[svc.id] || 0;
    let restartAttempted = false;

    if (!healthy) {
      const decision = evaluateRestartEligibility(svc, count);

      if (decision === 'intentionally_stopped') {
        // Phase 9A: this service is in runtime-preflight's canonical
        // intentionally-stopped set — it is SUPPOSED to be down. Never restart
        // it, and never raise a DOWN alert for it either (both would be a false
        // alarm about expected, deliberate state). This closes the gap where
        // this monitor's own hardcoded service list could restart a service
        // runtime-preflight explicitly says must not be auto-started.
        recordRestartEvidence(svc, decision, null, count, `${svc.pm2_name} is intentionally stopped; not eligible for restart or alert`);
      } else if (decision === 'eligible') {
        restartAttempted = await restartPm2Service(svc);
        restartCounts[svc.id] = count + 1;
        recordRestartEvidence(svc, decision, restartAttempted ? 'command_issued' : 'command_failed', count + 1, `attempt ${count + 1}/${MAX_AUTO_RESTART}`);
        // Phase 8C: this only proves the `pm2 restart` command was issued
        // (or, if false, that it threw) — never that the service is back up.
        // Recovery is only known truthfully on the *next* scan, via the
        // "recovered after N restart(s)" message below. The previous
        // "Restarted X" wording claimed success a full cycle before it could
        // actually be known, which read as a fixed outage in the log even
        // when the service was still down (confirmed live: immediately
        // followed by continued DOWN alerts for the same service).
        if (restartAttempted) {
          console.log(`[SelfHeal] Restart command issued for ${svc.name} (attempt ${count + 1}/${MAX_AUTO_RESTART}) — will confirm recovery on next scan`);
        } else {
          console.error(`[SelfHeal] Restart command FAILED for ${svc.name} (attempt ${count + 1}/${MAX_AUTO_RESTART})`);
        }
      } else if (decision === 'kill_switch_blocked') {
        recordRestartEvidence(svc, decision, null, count, 'global governance kill switch is active — restart withheld');
        console.error(`[SelfHeal] Restart WITHHELD for ${svc.name} — global kill switch active`);
      } else {
        // 'not_pm2_type' / 'not_allowlisted' — structurally unreachable given the
        // fixed SERVICES_TO_MONITOR/RESTART_ALLOWLIST above; recorded, not silently
        // dropped, in case that invariant is ever broken by a future change.
        recordRestartEvidence(svc, decision, null, count, 'restart not attempted — outside the deterministic allowlist');
      }

      if (decision !== 'eligible' && decision !== 'intentionally_stopped' && (count >= MAX_AUTO_RESTART || svc.critical)) {
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

    if (healthy) lastHealthyAt[svc.id] = now;
    else lastFailureAt[svc.id] = now;

    results.push({
      id: svc.id,
      name: svc.name,
      healthy,
      restart_attempted: restartAttempted,
      restart_count: restartCounts[svc.id] || 0,
      last_checked: now,
      last_healthy_at: lastHealthyAt[svc.id],
      last_failure_at: lastFailureAt[svc.id],
    });
  }

  _lastScanResults = results;
  _lastScanAt = now;
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
  closeSelfHealingGovernanceHandle();
}

export function getMonitoredServices(): ServiceCheck[] {
  return SERVICES_TO_MONITOR;
}
