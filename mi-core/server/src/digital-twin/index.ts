/**
 * Phase 25E — Digital Twin
 * 
 * One number: MI_COMPANY_SCORE (0–100), updated daily.
 * Composed of: Company Health Score, Traffic Score, Revenue Score,
 *              Operations Score, Compliance Score, Technology Score
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const DATA_DIR = join(process.cwd(), '.mi-harness', 'phase25');
const TWIN_DIR = join(DATA_DIR, 'digital-twin');

function ensureDirs() {
  mkdirSync(TWIN_DIR, { recursive: true });
}

// ── Score types ──────────────────────────────────────────────────────────────

export interface DigitalTwinSnapshot {
  id: string;
  timestamp: string;
  companyScore: number;        // 0-100
  healthScore: number;         // 0-100
  trafficScore: number;        // 0-100
  revenueScore: number;        // 0-100
  operationsScore: number;     // 0-100
  complianceScore: number;     // 0-100
  technologyScore: number;     // 0-100
  breakdown: Record<string, any>;
}

// ── Health Score (0-100) ────────────────────────────────────────────────────

function computeHealthScore(): { score: number; breakdown: any } {
  const breakdown: any = {};
  let score = 50; // baseline

  // PM2 processes online?
  try {
    const pm2 = JSON.parse(execSync('pm2 jlist 2>&1', { encoding: 'utf-8', timeout: 5000 }));
    const running = pm2.filter((p: any) => p.pm2_env?.status === 'online').length;
    const total = pm2.length || 1;
    breakdown.pm2Running = running;
    breakdown.pm2Total = total;
    score += (running / total) * 20;
  } catch { score -= 10; breakdown.pm2Error = true; }

  // SEO agents online?
  try {
    const seoStatePath = join(process.cwd(), 'data', 'seo', 'seo-state.json');
    if (existsSync(seoStatePath)) {
      const seo = JSON.parse(readFileSync(seoStatePath, 'utf-8'));
      const agents = Object.values(seo.agents || {});
      const online = agents.filter((a: any) => a.status === 'online').length;
      breakdown.seoAgentsOnline = online;
      breakdown.seoAgentsTotal = agents.length || 1;
      score += (online / (agents.length || 1)) * 20;
    }
  } catch { score -= 5; breakdown.seoError = true; }

  // DB accessible?
  try {
    const dbPath = join(process.cwd(), 'data', 'health.db');
    if (existsSync(dbPath)) {
      score += 5;
      breakdown.dbAccessible = true;
    }
  } catch { score -= 5; breakdown.dbError = true; }

  return { score: Math.min(100, Math.max(0, score)), breakdown };
}

// ── Traffic Score (0-100) ────────────────────────────────────────────────────

function computeTrafficScore(): { score: number; breakdown: any } {
  const breakdown: any = {};
  let score = 30; // baseline — assume zero traffic until proven

  try {
    const seoStatePath = join(process.cwd(), 'data', 'seo', 'seo-state.json');
    if (existsSync(seoStatePath)) {
      const seo = JSON.parse(readFileSync(seoStatePath, 'utf-8'));

      // Has analytics agent data?
      const analytics = seo.agents?.['seo-analytics-agent'];
      if (analytics?.last_report?.payload?.dashboard_payload?.weekly_kpis) {
        const kpis = analytics.last_report.payload.dashboard_payload.weekly_kpis;
        const pagesAudited = kpis.pages_audited || 0;
        const keywordsTracked = kpis.keywords_tracked || 0;
        const techIssues = kpis.technical_issues || 0;

        breakdown.pagesAudited = pagesAudited;
        breakdown.keywordsTracked = keywordsTracked;
        breakdown.techIssues = techIssues;

        score += Math.min(20, pagesAudited * 2);
        score += Math.min(20, keywordsTracked * 3);
        score -= Math.min(10, techIssues * 2);

        // Ranking data?
        const rankings = analytics.last_report.payload.dashboard_payload?.rankings || [];
        const rankedCount = rankings.filter((r: any) => r.position !== null).length;
        breakdown.rankedKeywords = rankedCount;
        score += Math.min(15, rankedCount * 2);
      }

      // Schema agent has data?
      const schema = seo.agents?.['seo-schema-agent'];
      if (schema?.last_report?.payload?.schema_items_count > 0) {
        score += 5;
        breakdown.schemaItems = schema.last_report.payload.schema_items_count;
      }
    }
  } catch { score -= 5; breakdown.trafficError = true; }

  return { score: Math.min(100, Math.max(0, score)), breakdown };
}

// ── Revenue Score (0-100) ────────────────────────────────────────────────────

function computeRevenueScore(): { score: number; breakdown: any } {
  const breakdown: any = {};

  // Base: 40 if no accounting data (can't assume)
  let score = 40;

  try {
    const qbDb = join(process.cwd(), 'data', 'qb-agent.db');
    if (existsSync(qbDb)) {
      const stat = require('fs').statSync(qbDb);
      const ageHours = (Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60);
      breakdown.qbDataAgeHours = Math.round(ageHours);
      if (ageHours < 24) {
        score += 30; // fresh data
      } else if (ageHours < 72) {
        score += 10;
      } else {
        score -= 10; // stale
      }
      breakdown.qbStatus = ageHours < 24 ? 'fresh' : 'stale';
    }
  } catch { score -= 5; breakdown.qbError = true; }

  return { score: Math.min(100, Math.max(0, score)), breakdown };
}

// ── Operations Score (0-100) ─────────────────────────────────────────────────

function computeOperationsScore(): { score: number; breakdown: any } {
  const breakdown: any = {};
  let score = 50;

  // Check scheduler status
  try {
    const schedulerPath = join(process.cwd(), '.mi-harness', 'scheduler');
    if (existsSync(schedulerPath)) {
      score += 10;
      breakdown.schedulerDirectory = true;
    }
  } catch {}

  // Check objectives are being created
  try {
    const objDir = join(process.cwd(), '.mi-harness', 'phase25', 'objectives');
    if (existsSync(objDir)) {
      const files = require('fs').readdirSync(objDir).filter((f: string) => f.endsWith('.json'));
      breakdown.totalObjectives = files.length;
      if (files.length > 0) score += 10;
    }
  } catch {}

  // Check auto-tasks
  try {
    const autoTasksDir = join(process.cwd(), '.mi-harness', 'phase25', 'auto-tasks');
    if (existsSync(autoTasksDir)) {
      const files = require('fs').readdirSync(autoTasksDir).filter((f: string) => f.endsWith('.json'));
      breakdown.totalAutoTasks = files.length;
      score += 5;
    }
  } catch {}

  return { score: Math.min(100, Math.max(0, score)), breakdown };
}

// ── Compliance Score (0-100) ─────────────────────────────────────────────────

function computeComplianceScore(): { score: number; breakdown: any } {
  const breakdown: any = {};
  let score = 50;

  // Check .env exists (not hardcoded secrets)
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) { score += 10; breakdown.envFile = true; }

  // Check .gitignore exists
  const gitignorePath = join(process.cwd(), '.gitignore');
  if (existsSync(gitignorePath)) { score += 5; breakdown.gitignore = true; }

  // Check data security
  try {
    const dataDir = join(process.cwd(), 'data');
    if (existsSync(dataDir)) {
      score += 10;
      breakdown.dataDirectory = true;
    }
  } catch {}

  // Check evidence dir exists (audit trail)
  try {
    const evidenceDir = join(process.cwd(), '.mi-harness', 'evidence');
    if (existsSync(evidenceDir)) {
      score += 10;
      breakdown.evidenceTrail = true;
    }
  } catch {}

  return { score: Math.min(100, Math.max(0, score)), breakdown };
}

// ── Technology Score (0-100) ─────────────────────────────────────────────────

function computeTechnologyScore(): { score: number; breakdown: any } {
  const breakdown: any = {};
  let score = 40;

  // Package.json exists?
  const pkgPath = join(process.cwd(), 'package.json');
  if (existsSync(pkgPath)) { score += 10; breakdown.packageJson = true; }

  // Ecosystem config?
  const ecoPath = join(process.cwd(), 'ecosystem.config.cjs');
  if (existsSync(ecoPath)) { score += 5; breakdown.ecosystemConfig = true; }

  // Agent engine?
  const bridgePath = join(process.cwd(), 'agent-engine', 'bridge.mjs');
  if (existsSync(bridgePath)) { score += 5; breakdown.agentEngine = true; }

  // SEO agents registered?
  try {
    const seoStatePath = join(process.cwd(), 'data', 'seo', 'seo-state.json');
    if (existsSync(seoStatePath)) {
      const seo = JSON.parse(readFileSync(seoStatePath, 'utf-8'));
      const count = Object.keys(seo.agents || {}).length;
      breakdown.seoAgentCount = count;
      score += Math.min(15, count * 3);
    }
  } catch {}

  // Phase 25 modules?
  const objectiveEngine = join(process.cwd(), 'server', 'src', 'objective-engine', 'index.ts');
  if (existsSync(objectiveEngine)) { score += 10; breakdown.phase25ObjectiveEngine = true; }

  const execOrch = join(process.cwd(), 'server', 'src', 'execution-orchestrator', 'index.ts');
  if (existsSync(execOrch)) { score += 5; breakdown.phase25ExecutionOrchestrator = true; }

  return { score: Math.min(100, Math.max(0, score)), breakdown };
}

// ── Main: Compute MI_COMPANY_SCORE ───────────────────────────────────────────

export function computeCompanyScore(): DigitalTwinSnapshot {
  ensureDirs();

  const { score: health, breakdown: healthBD } = computeHealthScore();
  const { score: traffic, breakdown: trafficBD } = computeTrafficScore();
  const { score: revenue, breakdown: revenueBD } = computeRevenueScore();
  const { score: operations, breakdown: operationsBD } = computeOperationsScore();
  const { score: compliance, breakdown: complianceBD } = computeComplianceScore();
  const { score: tech, breakdown: techBD } = computeTechnologyScore();

  // Weighted average
  const companyScore = Math.round(
    health * 0.25 +
    traffic * 0.20 +
    revenue * 0.15 +
    operations * 0.15 +
    compliance * 0.10 +
    tech * 0.15
  );

  const snapshot: DigitalTwinSnapshot = {
    id: `twin-${Date.now()}`,
    timestamp: new Date().toISOString(),
    companyScore,
    healthScore: health,
    trafficScore: traffic,
    revenueScore: revenue,
    operationsScore: operations,
    complianceScore: compliance,
    technologyScore: tech,
    breakdown: {
      health: healthBD,
      traffic: trafficBD,
      revenue: revenueBD,
      operations: operationsBD,
      compliance: complianceBD,
      technology: techBD,
    },
  };

  // Persist
  const snapshotPath = join(TWIN_DIR, `${snapshot.id}.json`);
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));

  // Keep latest pointer
  writeFileSync(join(TWIN_DIR, 'latest.json'), JSON.stringify(snapshot, null, 2));

  return snapshot;
}

// ── Query ────────────────────────────────────────────────────────────────────

export function getLatestSnapshot(): DigitalTwinSnapshot | null {
  const latestPath = join(TWIN_DIR, 'latest.json');
  if (!existsSync(latestPath)) return null;
  try { return JSON.parse(readFileSync(latestPath, 'utf-8')); } catch { return null; }
}

export function getHistory(limit: number = 30): DigitalTwinSnapshot[] {
  ensureDirs();
  try {
    const files = require('fs').readdirSync(TWIN_DIR)
      .filter((f: string) => f.startsWith('twin-') && f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit);
    return files.map((f: string) => {
      try { return JSON.parse(readFileSync(join(TWIN_DIR, f), 'utf-8')); } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}

export default {
  computeCompanyScore,
  getLatestSnapshot,
  getHistory,
};
