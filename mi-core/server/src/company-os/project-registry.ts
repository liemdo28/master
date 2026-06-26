/**
 * Mi Company OS — Project Registry
 * Every active project in D:/Project/Master registered with owner, purpose, runtime.
 * Source evidence: ecosystem.config.js, package.json, .env.example, MI_LINKED_SOURCES_AUDIT.md
 * Updated: 2026-06-26
 */

export type ProjectStatus   = 'ACTIVE' | 'SHADOW' | 'BROKEN' | 'ARCHIVED' | 'UNKNOWN';
export type ProjectCriticality = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Project {
  id: string;
  name: string;
  path: string;             // relative to D:/Project/Master/
  owner_dept: string;       // department id
  business_purpose: string;
  repo: boolean;            // has .git
  has_package_json: boolean;
  runtime: 'node' | 'python' | 'static' | 'docker' | 'electron' | 'none';
  pm2_name?: string;
  port?: number;
  health_endpoint?: string;
  startup_cmd?: string;
  restart_cmd?: string;
  status: ProjectStatus;
  criticality: ProjectCriticality;
  dependencies: string[];   // other project ids this depends on
  notes?: string;
}

export const PROJECTS: Project[] = [
  // ── EXECUTIVE LAYER ────────────────────────────────────────────────────────
  {
    id: 'mi-core',
    name: 'Mi-Core Central Command',
    path: 'mi-core',
    owner_dept: 'dispatch',
    business_purpose: 'CEO OS — WhatsApp command center, 19-dept orchestration, all APIs, PM2 master',
    repo: false,
    has_package_json: true,
    runtime: 'node',
    pm2_name: 'mi-core',
    port: 4001,
    health_endpoint: 'http://localhost:4001/api/health',
    startup_cmd: 'pm2 start ecosystem.config.js --only mi-core',
    restart_cmd: 'pm2 restart mi-core',
    status: 'ACTIVE',
    criticality: 'CRITICAL',
    dependencies: [],
  },
  {
    id: 'whatsapp-ai-gateway',
    name: 'WhatsApp AI Gateway',
    path: 'whatsapp-ai-gateway',
    owner_dept: 'executive-assistant',
    business_purpose: 'WhatsApp message receive/send gateway. Routes CEO iPhone → mi-core. Also serves food-safety-gateway traffic.',
    repo: false,
    has_package_json: true,
    runtime: 'node',
    pm2_name: 'whatsapp-ai-gateway',
    port: 3211,
    health_endpoint: 'http://localhost:3211/health',
    startup_cmd: 'pm2 start ecosystem.config.js --only whatsapp-ai-gateway',
    restart_cmd: 'pm2 restart whatsapp-ai-gateway',
    status: 'ACTIVE',
    criticality: 'CRITICAL',
    dependencies: ['mi-core'],
  },
  {
    id: 'mi-ceo-observer',
    name: 'Mi CEO Observer',
    path: 'mi-ceo-observer',
    owner_dept: 'executive-assistant',
    business_purpose: 'Reads CEO main WhatsApp account (Session A). Detects tasks from CEO conversations. Runs headless.',
    repo: false,
    has_package_json: true,
    runtime: 'node',
    pm2_name: 'mi-ceo-observer',
    port: 3212,
    health_endpoint: 'http://localhost:3212/health',
    startup_cmd: 'pm2 start ecosystem.config.js --only mi-ceo-observer',
    restart_cmd: 'pm2 restart mi-ceo-observer',
    status: 'ACTIVE',
    criticality: 'HIGH',
    dependencies: ['mi-core'],
  },
  {
    id: 'mi-ai-service',
    name: 'Mi AI Python Service',
    path: 'mi-core/ai-service',
    owner_dept: 'dispatch',
    business_purpose: 'FastAPI wrapper for Ollama. Exposes local LLM inference at port 4002.',
    repo: false,
    has_package_json: false,
    runtime: 'python',
    pm2_name: 'mi-ai-service',
    port: 4002,
    health_endpoint: 'http://localhost:4002/health',
    startup_cmd: 'pm2 start ecosystem.config.js --only mi-ai-service',
    restart_cmd: 'pm2 restart mi-ai-service',
    status: 'ACTIVE',
    criticality: 'HIGH',
    dependencies: [],
    notes: 'Runs inside mi-core cwd. uvicorn main:app',
  },
  {
    id: 'mi-node-agent',
    name: 'Mi Node Agent',
    path: 'mi-node-agent',
    owner_dept: 'technical-operations',
    business_purpose: 'Secondary device discovery. Registers this PC as mi-core-primary in the node registry. Heartbeat to mi-core.',
    repo: false,
    has_package_json: true,
    runtime: 'node',
    pm2_name: 'mi-node-agent',
    port: 4004,
    startup_cmd: 'pm2 start ecosystem.config.js --only mi-node-agent',
    restart_cmd: 'pm2 restart mi-node-agent',
    status: 'ACTIVE',
    criticality: 'MEDIUM',
    dependencies: ['mi-core'],
  },
  {
    id: 'mi-n8n-automation-fabric',
    name: 'Mi n8n Automation Fabric',
    path: 'Mi/n8n',
    owner_dept: 'technical-operations',
    business_purpose: 'Externalized n8n workflow registry, workflow JSON, execution logs, and Mi-Core automation contract.',
    repo: false,
    has_package_json: false,
    runtime: 'none',
    status: 'ACTIVE',
    criticality: 'HIGH',
    dependencies: ['mi-core'],
    notes: 'Canonical source path is D:/Project/Master/Mi/n8n.',
  },
  {
    id: 'mi-open-source-lab',
    name: 'Mi Open-Source Extension Lab',
    path: 'Mi-OpenSource-Lab',
    owner_dept: 'technical-operations',
    business_purpose: 'Isolated lab for auditing open-source AI tools before any Mi-Core or n8n production integration.',
    repo: false,
    has_package_json: false,
    runtime: 'none',
    status: 'SHADOW',
    criticality: 'MEDIUM',
    dependencies: ['mi-core', 'mi-n8n-automation-fabric'],
    notes: 'Canonical source path is D:/Project/Master/Mi-OpenSource-Lab. Legacy duplicate archived on 2026-06-26.',
  },
  {
    id: 'laptop1-node',
    name: 'Laptop1 Managed Node',
    path: '../laptop1',
    owner_dept: 'technical-operations',
    business_purpose: 'External laptop node managed by Mi. Hosts laptop-side operational tooling and transfer/setup artifacts.',
    repo: true,
    has_package_json: false,
    runtime: 'none',
    status: 'ACTIVE',
    criticality: 'HIGH',
    dependencies: ['mi-core', 'mi-node-agent'],
    notes: 'External repo at D:/Project/laptop1. It is managed by Mi but intentionally remains outside D:/Project/Master.',
  },
  {
    id: 'laptop2-node',
    name: 'Laptop2 Managed Node',
    path: '../laptop2',
    owner_dept: 'technical-operations',
    business_purpose: 'Prepared standby laptop node for Mi multi-node operations.',
    repo: false,
    has_package_json: false,
    runtime: 'none',
    status: 'SHADOW',
    criticality: 'MEDIUM',
    dependencies: ['mi-core', 'mi-node-agent'],
    notes: 'Setup target. Mi exposes /mi laptop2 status and node APIs; physical source path may not exist until setup begins.',
  },

  // ── FINANCE LAYER ──────────────────────────────────────────────────────────
  {
    id: 'accounting-engine',
    name: 'Accounting Engine',
    path: 'accounting-engine',
    owner_dept: 'finance',
    business_purpose: 'P&L, cash flow, expense categorization. Local API at 127.0.0.1:8844. QuickBooks truth layer.',
    repo: false,
    has_package_json: true,
    runtime: 'node',
    pm2_name: 'mi-accounting',
    port: 8844,
    health_endpoint: 'http://127.0.0.1:8844/health',
    startup_cmd: 'pm2 start ecosystem.config.js --only mi-accounting',
    restart_cmd: 'pm2 restart mi-accounting',
    status: 'ACTIVE',
    criticality: 'CRITICAL',
    dependencies: [],
  },
  {
    id: 'qb-ops-agent',
    name: 'QuickBooks Ops Agent',
    path: 'qb-ops-agent',
    owner_dept: 'finance',
    business_purpose: 'Syncs QuickBooks Desktop data from laptop1. Writes to mi-core/data/qb-agent.db. Read-only in Phase 1.',
    repo: false,
    has_package_json: true,
    runtime: 'node',
    pm2_name: undefined,
    port: undefined,
    status: 'ACTIVE',
    criticality: 'HIGH',
    dependencies: ['accounting-engine'],
    notes: 'Runs on laptop1 (QB Desktop host). Connects to gateway API at port 3456.',
  },

  // ── OPERATIONS LAYER ───────────────────────────────────────────────────────
  {
    id: 'food-safety-gateway',
    name: 'Food Safety Gateway',
    path: 'food-safety-gateway',
    owner_dept: 'restaurant-intelligence',
    business_purpose: 'WhatsApp-based food safety form collection. Staff submit photos → OCR → Google Sheets. All Bakudan stores.',
    repo: false,
    has_package_json: false,
    runtime: 'node',
    pm2_name: undefined,
    port: 3211,
    status: 'ACTIVE',
    criticality: 'HIGH',
    dependencies: ['whatsapp-ai-gateway'],
    notes: 'Library package — consumed by whatsapp-ai-gateway. Not a standalone service.',
  },
  {
    id: 'bakudan-integration-system',
    name: 'Bakudan Integration System',
    path: 'Bakudan/integration-system',
    owner_dept: 'restaurant-intelligence',
    business_purpose: 'Toast POS Manager desktop app. Packaged as Electron-like dist. Runs on POS laptops.',
    repo: false,
    has_package_json: false,
    runtime: 'electron',
    pm2_name: undefined,
    port: undefined,
    status: 'ACTIVE',
    criticality: 'HIGH',
    dependencies: [],
    notes: 'Distributed via installer to Bakudan laptop1/laptop2. Contains Playwright for Toast automation.',
  },
  {
    id: 'doordash-agent',
    name: 'DoorDash Campaign Agent',
    path: 'data/doordash-agent',
    owner_dept: 'marketing',
    business_purpose: 'DoorDash promotion management. Playwright-based browser automation for menu pricing and promos.',
    repo: false,
    has_package_json: true,
    runtime: 'node',
    pm2_name: undefined,
    port: undefined,
    status: 'ACTIVE',
    criticality: 'MEDIUM',
    dependencies: ['mi-core'],
    notes: 'Called via mi-core doordash-agent router. Package installed at data/doordash-agent/packages/',
  },

  // ── MARKETING / GROWTH ────────────────────────────────────────────────────
  {
    id: 'review-automation-system',
    name: 'Review Automation System',
    path: 'Bakudan/review-automation-system',
    owner_dept: 'marketing',
    business_purpose: 'Google + Yelp review monitoring and AI reply generation. FastAPI + PostgreSQL + Redis.',
    repo: false,
    has_package_json: false,
    runtime: 'docker',
    pm2_name: undefined,
    port: 8000,
    health_endpoint: 'http://localhost:8000/health',
    startup_cmd: 'cd Bakudan/review-automation-system && docker-compose up -d',
    restart_cmd: 'docker-compose restart',
    status: 'ACTIVE',
    criticality: 'HIGH',
    dependencies: [],
    notes: 'Docker: postgres:5432, redis:6379, review-api:8000. Python FastAPI.',
  },
  {
    id: 'bakudan-dashboard',
    name: 'Bakudan Dashboard',
    path: 'Bakudan/dashboard.bakudanramen.com',
    owner_dept: 'report-center',
    business_purpose: 'CEO-facing web dashboard at dashboard.bakudanramen.com. Calls mi-core /api/mi/snapshot.',
    repo: false,
    has_package_json: false,
    runtime: 'static',
    pm2_name: undefined,
    port: undefined,
    status: 'ACTIVE',
    criticality: 'MEDIUM',
    dependencies: ['mi-core'],
    notes: 'Network access from mi-core degraded — DNS/proxy issue. Cosmetic impact only.',
  },

  // ── AI PLATFORM ───────────────────────────────────────────────────────────
  {
    id: 'antigravity-gateway',
    name: 'Antigravity AI Gateway',
    path: 'Agent/agent-coding-api-keys',
    owner_dept: 'engineering',
    business_purpose: 'Universal AI Gateway at port 3456. Protocol translation (Anthropic ↔ OpenAI). Used by Claude Code, Cline, and coding agents. API key rotation.',
    repo: false,
    has_package_json: true,
    runtime: 'node',
    pm2_name: undefined,
    port: 3456,
    health_endpoint: 'http://localhost:3456/health',
    startup_cmd: 'cd Agent/agent-coding-api-keys && npm start',
    restart_cmd: 'pm2 restart antigravity-gateway',
    status: 'ACTIVE',
    criticality: 'HIGH',
    dependencies: [],
    notes: 'qb-ops-agent connects to this at AGENT_OS_API_URL=http://127.0.0.1:3456/api',
  },
  {
    id: 'computer-operator-foundation',
    name: 'Computer Operator Foundation',
    path: 'computer-operator-foundation',
    owner_dept: 'engineering',
    business_purpose: 'Foundation docs, operator runtime proof, financial intelligence, and OSS governance work that Mi manages from Master.',
    repo: false,
    has_package_json: false,
    runtime: 'python',
    status: 'ACTIVE',
    criticality: 'MEDIUM',
    dependencies: ['mi-core'],
    notes: 'Moved from D:/Project/computer-operator-foundation to D:/Project/Master/computer-operator-foundation during the 2026-06-26 root path fix.',
  },

  // ── STATIC / ASSETS ───────────────────────────────────────────────────────
  {
    id: 'bakudan-website',
    name: 'Bakudan Website',
    path: 'Bakudan/bakudanramen.com-current',
    owner_dept: 'brand-creative',
    business_purpose: 'bakudanramen.com website. Static HTML + photos. Deployed via Cloudflare.',
    repo: false,
    has_package_json: false,
    runtime: 'static',
    status: 'ACTIVE',
    criticality: 'HIGH',
    dependencies: [],
  },
  {
    id: 'rawsushi-website',
    name: 'Raw Sushi Website',
    path: 'RawSushi/RawWebsite',
    owner_dept: 'brand-creative',
    business_purpose: 'rawsushi.com website. CDN-hosted. No local service.',
    repo: false,
    has_package_json: false,
    runtime: 'static',
    status: 'ACTIVE',
    criticality: 'MEDIUM',
    dependencies: [],
  },
  {
    id: 'bakudan-releases',
    name: 'Bakudan Releases',
    path: 'bakudan-releases',
    owner_dept: 'technical-operations',
    business_purpose: 'Git repo for Bakudan app release artifacts.',
    repo: true,
    has_package_json: false,
    runtime: 'none',
    status: 'ACTIVE',
    criticality: 'LOW',
    dependencies: [],
  },

  // ── ARCHIVED / SHADOW ─────────────────────────────────────────────────────
  {
    id: '_archive',
    name: 'Archive',
    path: '_archive',
    owner_dept: 'technical-operations',
    business_purpose: 'Archived old projects and experiments.',
    repo: false,
    has_package_json: false,
    runtime: 'none',
    status: 'ARCHIVED',
    criticality: 'LOW',
    dependencies: [],
  },
  {
    id: '_transfer_packages',
    name: 'Transfer Packages',
    path: '_transfer_packages',
    owner_dept: 'technical-operations',
    business_purpose: 'Staging area for package transfers between machines.',
    repo: false,
    has_package_json: false,
    runtime: 'none',
    status: 'SHADOW',
    criticality: 'LOW',
    dependencies: [],
  },
  {
    id: 'mi-core-backups',
    name: 'Mi-Core Backups',
    path: 'mi-core-backups',
    owner_dept: 'technical-operations',
    business_purpose: 'Backup snapshots of mi-core. Not a runtime — storage only.',
    repo: false,
    has_package_json: false,
    runtime: 'none',
    status: 'ACTIVE',
    criticality: 'MEDIUM',
    dependencies: [],
  },
  {
    id: 'docs',
    name: 'Docs',
    path: 'docs',
    owner_dept: 'library',
    business_purpose: 'Project documentation storage.',
    repo: false,
    has_package_json: false,
    runtime: 'none',
    status: 'ACTIVE',
    criticality: 'LOW',
    dependencies: [],
  },
  {
    id: 'reports',
    name: 'Reports',
    path: 'reports',
    owner_dept: 'report-center',
    business_purpose: 'Certification and audit report storage.',
    repo: false,
    has_package_json: false,
    runtime: 'none',
    status: 'ACTIVE',
    criticality: 'LOW',
    dependencies: [],
  },
  {
    id: 'agent-doordash-campaigns',
    name: 'DoorDash Campaign Scripts',
    path: 'Agent/doordash-compaigns',
    owner_dept: 'marketing',
    business_purpose: 'DoorDash promotion automation scripts. Runbooks and validation reports.',
    repo: false,
    has_package_json: false,
    runtime: 'none',
    status: 'ACTIVE',
    criticality: 'MEDIUM',
    dependencies: ['doordash-agent'],
  },
  {
    id: 'agent-review-mcp',
    name: 'Review Management MCP',
    path: 'Agent/review-management-mcp',
    owner_dept: 'marketing',
    business_purpose: 'MCP server for review management. Connects Claude Code to review-automation-system.',
    repo: false,
    has_package_json: false,
    runtime: 'none',
    status: 'SHADOW',
    criticality: 'LOW',
    dependencies: ['review-automation-system'],
    notes: 'Contains only data/ folder. Development paused.',
  },
  {
    id: 'bakudan-growth-dashboard',
    name: 'Bakudan Growth Dashboard',
    path: 'Bakudan/growth-dashboard',
    owner_dept: 'marketing',
    business_purpose: 'Growth metrics dashboard for Bakudan.',
    repo: false,
    has_package_json: false,
    runtime: 'static',
    status: 'UNKNOWN',
    criticality: 'LOW',
    dependencies: [],
    notes: 'Contents not fully scanned — needs verification.',
  },
];

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function getProject(id: string): Project | undefined {
  return PROJECTS.find(p => p.id === id);
}

export function getActiveProjects(): Project[] {
  return PROJECTS.filter(p => p.status === 'ACTIVE');
}

export function getProjectsByDept(deptId: string): Project[] {
  return PROJECTS.filter(p => p.owner_dept === deptId);
}

export function getCriticalProjects(): Project[] {
  return PROJECTS.filter(p => p.criticality === 'CRITICAL' && p.status === 'ACTIVE');
}

export function getProjectsWithPm2(): Project[] {
  return PROJECTS.filter(p => p.pm2_name && p.status === 'ACTIVE');
}

export function getProjectSummary(): string {
  const byStatus: Record<string, number> = {};
  for (const p of PROJECTS) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  }
  return [
    `Project Registry — ${PROJECTS.length} total`,
    ...Object.entries(byStatus).map(([s, n]) => `  ${s}: ${n}`),
    `  CRITICAL: ${PROJECTS.filter(p => p.criticality === 'CRITICAL').length}`,
    `  PM2-managed: ${getProjectsWithPm2().length}`,
  ].join('\n');
}
