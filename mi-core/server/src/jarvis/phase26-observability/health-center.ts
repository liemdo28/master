/**
 * Phase 26 — Observability
 * Health Center, Incident Center, Alert Center.
 * OpenTelemetry/Grafana optional; works standalone.
 */

export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ServiceHealth {
  id: string;
  name: string;
  endpoint?: string;
  status: HealthStatus;
  latency_ms?: number;
  last_check: string;
  message?: string;
  uptime_pct?: number;
}

export interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  service_id: string;
  detected_at: string;
  resolved_at?: string;
  status: 'open' | 'investigating' | 'resolved';
  description: string;
  auto_detected: boolean;
}

const SERVICES: Map<string, ServiceHealth> = new Map();
const INCIDENTS: Incident[] = [];

// ── Register services to monitor ────────────────────────────────────────────
const MONITORED_SERVICES = [
  { id: 'mi-core', name: 'Mi-Core', endpoint: 'http://localhost:4001/api/health' },
  { id: 'whatsapp-gateway', name: 'WhatsApp Gateway', endpoint: 'http://localhost:3211/api/health' },
  { id: 'ollama', name: 'Ollama AI', endpoint: 'http://localhost:11434/api/version' },
  { id: 'qdrant', name: 'Qdrant Vector DB', endpoint: 'http://localhost:6333/health' },
  { id: 'minio', name: 'MinIO Storage', endpoint: 'http://localhost:9000/minio/health/live' },
  { id: 'postgres', name: 'PostgreSQL', endpoint: undefined },
];

for (const svc of MONITORED_SERVICES) {
  SERVICES.set(svc.id, { ...svc, status: 'unknown', last_check: new Date(0).toISOString() });
}

export async function checkServiceHealth(serviceId: string): Promise<ServiceHealth> {
  const svc = SERVICES.get(serviceId);
  if (!svc || !svc.endpoint) {
    const result = { ...(svc || { id: serviceId, name: serviceId, last_check: new Date().toISOString() }), status: 'unknown' as HealthStatus };
    if (svc) SERVICES.set(serviceId, result);
    return result;
  }

  const start = Date.now();
  try {
    const res = await fetch(svc.endpoint, { signal: AbortSignal.timeout(3000) });
    const latency = Date.now() - start;
    const status: HealthStatus = res.ok ? 'healthy' : 'degraded';
    const updated = { ...svc, status, latency_ms: latency, last_check: new Date().toISOString() };
    SERVICES.set(serviceId, updated);

    // Auto-detect recovery
    if (svc.status !== 'healthy' && status === 'healthy') {
      resolveIncidentForService(serviceId);
    }
    return updated;
  } catch {
    const latency = Date.now() - start;
    const updated = { ...svc, status: 'down' as HealthStatus, latency_ms: latency, last_check: new Date().toISOString(), message: 'Connection failed' };
    SERVICES.set(serviceId, updated);

    // Auto-create incident
    if (svc.status !== 'down') {
      createIncident({
        title: `${svc.name} is down`,
        severity: serviceId === 'mi-core' || serviceId === 'whatsapp-gateway' ? 'critical' : 'medium',
        service_id: serviceId,
        description: `${svc.name} failed health check. Endpoint: ${svc.endpoint}`,
        auto_detected: true,
      });
    }
    return updated;
  }
}

let _sweepCache: { data: ServiceHealth[]; ts: number } | null = null;
let _sweepInFlight = false;

export interface SweepResult {
  services: ServiceHealth[];
  fromCache: boolean;
  cacheAgeSeconds: number | null;
}

export async function runHealthSweep(): Promise<ServiceHealth[]> {
  const now = Date.now();
  if (_sweepCache && now - _sweepCache.ts < 30000) return _sweepCache.data;
  if (_sweepInFlight) return _sweepCache?.data ?? [];
  _sweepInFlight = true;
  try {
    const results = await Promise.all(Array.from(SERVICES.keys()).map(id => checkServiceHealth(id)));
    _sweepCache = { data: results, ts: Date.now() };
    return results;
  } finally {
    _sweepInFlight = false;
  }
}

export async function runHealthSweepWithMeta(): Promise<SweepResult> {
  const now = Date.now();
  const hadCache = !!(_sweepCache && now - _sweepCache.ts < 30000);
  const services = await runHealthSweep();
  const cacheAgeSeconds = _sweepCache ? Math.round((Date.now() - _sweepCache.ts) / 1000) : null;
  return { services, fromCache: hadCache, cacheAgeSeconds };
}

export function getCachedHealth(): ServiceHealth[] | null {
  if (_sweepCache && Date.now() - _sweepCache.ts < 30000) return _sweepCache.data;
  return null;
}

export function setCachedHealth(data: ServiceHealth[]): void {
  _sweepCache = { data, ts: Date.now() };
}

export function getAllServiceHealth(): ServiceHealth[] {
  return Array.from(SERVICES.values());
}

export function createIncident(inc: Omit<Incident, 'id' | 'detected_at' | 'status'>): Incident {
  const incident: Incident = {
    ...inc,
    id: 'inc_' + Date.now().toString(36),
    detected_at: new Date().toISOString(),
    status: 'open',
  };
  INCIDENTS.push(incident);
  return incident;
}

export function resolveIncidentForService(serviceId: string) {
  const open = INCIDENTS.filter(i => i.service_id === serviceId && i.status !== 'resolved');
  for (const i of open) {
    i.status = 'resolved';
    i.resolved_at = new Date().toISOString();
  }
}

export function getOpenIncidents(): Incident[] {
  return INCIDENTS.filter(i => i.status !== 'resolved').sort((a, b) => {
    const sev = { critical: 0, high: 1, medium: 2, low: 3 };
    return sev[a.severity] - sev[b.severity];
  });
}

export function getIncidentHistory(limit = 20): Incident[] {
  return INCIDENTS.slice(-limit).reverse();
}

export function getHealthCacheAge(): number | null {
  return _sweepCache ? Math.round((Date.now() - _sweepCache.ts) / 1000) : null;
}

export function formatHealthForWhatsApp(services: ServiceHealth[], fromCache = false): string {
  const lines = services.map(s => {
    const icon = s.status === 'healthy' ? '✅' : s.status === 'degraded' ? '🟡' : s.status === 'down' ? '🔴' : '⚪';
    const latency = s.latency_ms ? ` ${s.latency_ms}ms` : '';
    return `${icon} *${s.name}*${latency}`;
  });
  const healthy = services.filter(s => s.status === 'healthy').length;
  const cacheAge = getHealthCacheAge();
  const freshness = fromCache && cacheAge !== null ? ` _(cached ${cacheAge}s ago)_` : '';
  return `🏥 *Health Center — ${healthy}/${services.length} healthy*${freshness}\n\n${lines.join('\n')}`;
}

export function formatIncidentsForWhatsApp(): string {
  const open = getOpenIncidents();
  if (!open.length) return '✅ *Incident Center*\n\nKhông có incident nào đang mở.';
  const lines = open.slice(0, 5).map(i => {
    const icon = i.severity === 'critical' ? '🚨' : i.severity === 'high' ? '🔴' : '🟡';
    return `${icon} *${i.title}* (${i.status})\n   ${i.description.slice(0, 80)}`;
  });
  return `🚨 *Incident Center — ${open.length} open*\n\n${lines.join('\n\n')}`;
}

export function getObservabilityStats() {
  const services = getAllServiceHealth();
  const byStatus = { healthy: 0, degraded: 0, down: 0, unknown: 0 };
  for (const s of services) byStatus[s.status]++;
  return { services: byStatus, open_incidents: getOpenIncidents().length, total_incidents: INCIDENTS.length };
}

// Run initial health sweep after startup
setTimeout(() => runHealthSweep().catch(() => {}), 8000);
