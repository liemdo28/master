/**
 * Mi Company OS — Service Registry
 * All runtime services: PM2, Docker, Node, Python, Windows.
 * Proven from: ecosystem.config.js, docker-compose.yml, package.json, .env files.
 * Updated: 2026-06-18
 */

export type ServiceType    = 'pm2' | 'docker' | 'windows' | 'external';
export type ServiceStatus  = 'RUNNING' | 'STOPPED' | 'DEGRADED' | 'UNKNOWN';

export interface Service {
  id: string;
  name: string;
  type: ServiceType;
  port?: number;
  host: string;
  owner_project: string;
  owner_dept: string;
  health_endpoint?: string;
  startup_cmd: string;
  restart_cmd: string;
  process_name?: string;   // PM2 app name or Docker container name
  runtime: string;
  max_memory?: string;
  notes?: string;
}

export const SERVICES: Service[] = [
  // ── PM2 SERVICES (proven from ecosystem.config.js) ────────────────────────
  {
    id: 'svc-mi-core',
    name: 'Mi-Core Server',
    type: 'pm2',
    port: 4001,
    host: '0.0.0.0',
    owner_project: 'mi-core',
    owner_dept: 'dispatch',
    health_endpoint: 'http://localhost:4001/api/health',
    startup_cmd: 'pm2 start ecosystem.config.js --only mi-core',
    restart_cmd: 'pm2 restart mi-core',
    process_name: 'mi-core',
    runtime: 'Node.js 18+ / TypeScript (CommonJS)',
    max_memory: '768M',
  },
  {
    id: 'svc-whatsapp-gateway',
    name: 'WhatsApp AI Gateway',
    type: 'pm2',
    port: 3211,
    host: '0.0.0.0',
    owner_project: 'whatsapp-ai-gateway',
    owner_dept: 'executive-assistant',
    health_endpoint: 'http://localhost:3211/health',
    startup_cmd: 'pm2 start ecosystem.config.js --only whatsapp-ai-gateway',
    restart_cmd: 'pm2 restart whatsapp-ai-gateway',
    process_name: 'whatsapp-ai-gateway',
    runtime: 'Node.js / Baileys WhatsApp',
    max_memory: '512M',
  },
  {
    id: 'svc-accounting',
    name: 'Accounting Engine API',
    type: 'pm2',
    port: 8844,
    host: '127.0.0.1',
    owner_project: 'accounting-engine',
    owner_dept: 'finance',
    health_endpoint: 'http://127.0.0.1:8844/health',
    startup_cmd: 'pm2 start ecosystem.config.js --only mi-accounting',
    restart_cmd: 'pm2 restart mi-accounting',
    process_name: 'mi-accounting',
    runtime: 'Node.js / Express',
    max_memory: '256M',
  },
  {
    id: 'svc-ceo-observer',
    name: 'Mi CEO Observer',
    type: 'pm2',
    port: 3212,
    host: '127.0.0.1',
    owner_project: 'mi-ceo-observer',
    owner_dept: 'executive-assistant',
    health_endpoint: 'http://127.0.0.1:3212/health',
    startup_cmd: 'pm2 start ecosystem.config.js --only mi-ceo-observer',
    restart_cmd: 'pm2 restart mi-ceo-observer',
    process_name: 'mi-ceo-observer',
    runtime: 'Node.js / Baileys (headless)',
    max_memory: '512M',
  },
  {
    id: 'svc-ai-service',
    name: 'Mi AI Python Service',
    type: 'pm2',
    port: 4002,
    host: '127.0.0.1',
    owner_project: 'mi-ai-service',
    owner_dept: 'dispatch',
    health_endpoint: 'http://127.0.0.1:4002/health',
    startup_cmd: 'pm2 start ecosystem.config.js --only mi-ai-service',
    restart_cmd: 'pm2 restart mi-ai-service',
    process_name: 'mi-ai-service',
    runtime: 'Python / uvicorn FastAPI',
    max_memory: '512M',
  },
  {
    id: 'svc-node-agent',
    name: 'Mi Node Agent',
    type: 'pm2',
    port: 4004,
    host: '127.0.0.1',
    owner_project: 'mi-node-agent',
    owner_dept: 'technical-operations',
    startup_cmd: 'pm2 start ecosystem.config.js --only mi-node-agent',
    restart_cmd: 'pm2 restart mi-node-agent',
    process_name: 'mi-node-agent',
    runtime: 'Node.js',
    max_memory: '128M',
  },

  // ── DOCKER SERVICES (proven from docker-compose.yml) ─────────────────────
  {
    id: 'svc-review-api',
    name: 'Review Automation API',
    type: 'docker',
    port: 8000,
    host: '127.0.0.1',
    owner_project: 'review-automation-system',
    owner_dept: 'marketing',
    health_endpoint: 'http://localhost:8000/health',
    startup_cmd: 'cd Bakudan/review-automation-system && docker-compose up -d',
    restart_cmd: 'docker-compose restart review-api',
    process_name: 'review-api',
    runtime: 'Python / FastAPI',
  },
  {
    id: 'svc-review-postgres',
    name: 'Review System PostgreSQL',
    type: 'docker',
    port: 5432,
    host: '127.0.0.1',
    owner_project: 'review-automation-system',
    owner_dept: 'marketing',
    startup_cmd: 'cd Bakudan/review-automation-system && docker-compose up -d postgres',
    restart_cmd: 'docker-compose restart postgres',
    process_name: 'postgres',
    runtime: 'PostgreSQL 16',
    notes: 'DB: review_system. User: reviews',
  },
  {
    id: 'svc-review-redis',
    name: 'Review System Redis',
    type: 'docker',
    port: 6379,
    host: '127.0.0.1',
    owner_project: 'review-automation-system',
    owner_dept: 'marketing',
    startup_cmd: 'cd Bakudan/review-automation-system && docker-compose up -d redis',
    restart_cmd: 'docker-compose restart redis',
    process_name: 'redis',
    runtime: 'Redis 7',
  },

  // ── STANDALONE NODE (not in PM2) ──────────────────────────────────────────
  {
    id: 'svc-antigravity-gateway',
    name: 'Antigravity AI Gateway',
    type: 'pm2',
    port: 3456,
    host: '127.0.0.1',
    owner_project: 'antigravity-gateway',
    owner_dept: 'engineering',
    health_endpoint: 'http://localhost:3456/health',
    startup_cmd: 'cd Agent/agent-coding-api-keys && npm start',
    restart_cmd: 'pm2 restart antigravity-gateway',
    process_name: 'antigravity-gateway',
    runtime: 'Node.js / TypeScript',
    notes: 'Dashboard at /. Used by Claude Code, Cline, qb-ops-agent.',
  },

  // ── EXTERNAL SERVICES ─────────────────────────────────────────────────────
  {
    id: 'svc-ollama',
    name: 'Ollama LLM Runtime',
    type: 'windows',
    port: 11434,
    host: '127.0.0.1',
    owner_project: 'mi-core',
    owner_dept: 'dispatch',
    health_endpoint: 'http://localhost:11434/api/tags',
    startup_cmd: 'ollama serve',
    restart_cmd: 'ollama serve',
    process_name: 'ollama',
    runtime: 'Ollama',
    notes: 'Must be running before mi-core. Models: qwen3:14b, qwen3:8b, gemma3:12b, qwen2.5-coder:7b',
  },
  {
    id: 'svc-quickbooks-laptop1',
    name: 'QuickBooks Desktop (laptop1)',
    type: 'external',
    host: 'laptop1 (Tailscale)',
    owner_project: 'qb-ops-agent',
    owner_dept: 'finance',
    startup_cmd: 'Manual: open QuickBooks Desktop on laptop1',
    restart_cmd: 'Manual restart on laptop1',
    runtime: 'QuickBooks Desktop + Web Connector',
    notes: 'Runs on laptop1, not this PC. Expected degraded when laptop1 offline.',
  },
  {
    id: 'svc-dashboard-port',
    name: 'Bakudan Dashboard',
    type: 'external',
    host: 'dashboard.bakudanramen.com',
    owner_project: 'bakudan-dashboard',
    owner_dept: 'report-center',
    health_endpoint: 'https://dashboard.bakudanramen.com/api/health',
    startup_cmd: 'Cloudflare-hosted. No local start needed.',
    restart_cmd: 'N/A',
    runtime: 'Static / Cloudflare',
    notes: 'dashboard.bakudanramen.com — network access from mi-core degraded (DNS/proxy).',
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function getService(id: string): Service | undefined {
  return SERVICES.find(s => s.id === id);
}

export function getServicesByDept(deptId: string): Service[] {
  return SERVICES.filter(s => s.owner_dept === deptId);
}

export function getPm2Services(): Service[] {
  return SERVICES.filter(s => s.type === 'pm2');
}

export function getDockerServices(): Service[] {
  return SERVICES.filter(s => s.type === 'docker');
}

export function getServiceByPort(port: number): Service | undefined {
  return SERVICES.find(s => s.port === port);
}

export function getServicesSummary(): string {
  const byType: Record<string, number> = {};
  for (const s of SERVICES) {
    byType[s.type] = (byType[s.type] || 0) + 1;
  }
  return [
    `Service Registry — ${SERVICES.length} total`,
    ...Object.entries(byType).map(([t, n]) => `  ${t}: ${n}`),
    `  With health endpoints: ${SERVICES.filter(s => s.health_endpoint).length}`,
  ].join('\n');
}

/**
 * Check a service health endpoint (real HTTP check).
 */
export async function checkServiceHealth(serviceId: string): Promise<{
  id: string;
  name: string;
  healthy: boolean;
  status_code?: number;
  error?: string;
}> {
  const svc = getService(serviceId);
  if (!svc || !svc.health_endpoint) {
    return { id: serviceId, name: svc?.name || serviceId, healthy: false, error: 'No health endpoint' };
  }

  try {
    const res = await fetch(svc.health_endpoint, {
      signal: AbortSignal.timeout(5000),
    });
    return { id: serviceId, name: svc.name, healthy: res.ok, status_code: res.status };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { id: serviceId, name: svc.name, healthy: false, error: msg };
  }
}

/**
 * Run health checks on all services with health endpoints.
 */
export async function checkAllServicesHealth(): Promise<Array<ReturnType<typeof checkServiceHealth> extends Promise<infer T> ? T : never>> {
  const withHealth = SERVICES.filter(s => s.health_endpoint);
  return Promise.all(withHealth.map(s => checkServiceHealth(s.id)));
}
