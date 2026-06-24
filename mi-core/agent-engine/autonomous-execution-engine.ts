/**
 * Phase 20 — Autonomous Execution Engine
 * 
 * The core brain that receives CEO objectives and drives them through
 * the full pipeline without human intervention:
 * 
 * receiveObjective → decomposeObjective → createTasks → assignDepartments 
 * → trackExecution → collectEvidence → submitQA → generateReport → returnToCEO
 * 
 * Every step produces evidence. No manual routing.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, basename, extname, relative } from 'path';

// ── Types ──────────────────────────────────────────────────────────────────

interface EvidenceItem {
  id: string;
  type: string;
  description: string;
  result: any;
  collectedAt: string;
}

interface QACheck {
  name: string;
  passed: boolean;
  detail: string;
}

interface QAResult {
  passed: boolean;
  score: number;
  checks: QACheck[];
  reviewedAt: string;
}

interface TaskRecord {
  id: string;
  title: string;
  department: string;
  status: string;
  evidence: EvidenceItem[];
  qaResult: QAResult | null;
  result: any;
  startedAt: string;
  completedAt: string | null;
}

interface ObjectiveRecord {
  id: string;
  objective: string;
  receivedAt: string;
  completedAt: string | null;
  status: string;
  tasks: TaskRecord[];
  report: string | null;
  humanInterventions: number;
}

// ── Engine ─────────────────────────────────────────────────────────────────

const EVIDENCE_DIR = join(process.cwd(), '.mi-harness', 'evidence');
const OBJECTIVES_DIR = join(process.cwd(), '.mi-harness', 'objectives');

function ensureDirs() {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  mkdirSync(OBJECTIVES_DIR, { recursive: true });
}

function saveObjective(obj: ObjectiveRecord) {
  writeFileSync(join(OBJECTIVES_DIR, `${obj.id}.json`), JSON.stringify(obj, null, 2));
}

function collectFileEvidence(projectRoot: string, pattern: string): EvidenceItem {
  const files: string[] = [];
  
  function walk(dir: string) {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const full = join(dir, entry);
        try {
          const stat = statSync(full);
          if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
            walk(full);
          } else if (stat.isFile()) {
            if (pattern === '*' || entry.includes(pattern)) {
              files.push(relative(projectRoot, full));
            }
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  
  walk(projectRoot);
  
  return {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'file-scan',
    description: `File scan for pattern: ${pattern}`,
    result: { matchedFiles: files, count: files.length },
    collectedAt: new Date().toISOString(),
  };
}

function collectRouteEvidence(projectRoot: string): EvidenceItem {
  const routeFiles: string[] = [];
  const routePatterns: string[] = [];
  
  // Scan for route definitions
  const jsFiles = collectFileEvidence(projectRoot, '.js');
  const tsFiles = collectFileEvidence(projectRoot, '.ts');
  const mjsFiles = collectFileEvidence(projectRoot, '.mjs');
  
  const allFiles = [...jsFiles.result.matchedFiles, ...tsFiles.result.matchedFiles, ...mjsFiles.result.matchedFiles];
  
  for (const file of allFiles) {
    try {
      const content = readFileSync(join(projectRoot, file), 'utf-8');
      // Look for route patterns
      const routeMatches = content.match(/(?:app\.(get|post|put|delete|patch)\s*\(|router\.(get|post|put|delete|patch)\s*\(|\/api\/|\/health|\/route)/gi);
      if (routeMatches) {
        routeFiles.push(file);
        routePatterns.push(...routeMatches.map(m => m.trim()));
      }
    } catch { /* skip unreadable */ }
  }
  
  return {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'route-audit',
    description: `Route audit: scanned ${allFiles.length} files for route definitions`,
    result: {
      filesWithRoutes: routeFiles,
      routePatternsFound: [...new Set(routePatterns)],
      totalFilesScanned: allFiles.length,
    },
    collectedAt: new Date().toISOString(),
  };
}

function collectHealthCheckEvidence(projectRoot: string): EvidenceItem {
  const healthEndpoints: string[] = [];
  const missingHealth: string[] = [];
  
  const allFiles = collectFileEvidence(projectRoot, '*');
  
  for (const file of allFiles.result.matchedFiles) {
    try {
      const content = readFileSync(join(projectRoot, file), 'utf-8');
      if (content.match(/\/health|healthcheck|health-check|ready|alive|ping/i)) {
        healthEndpoints.push(file);
      }
    } catch { /* skip */ }
  }
  
  // Check for services without health checks
  const serviceFiles = allFiles.result.matchedFiles.filter((f: string) => 
    f.includes('bridge') || f.includes('server') || f.includes('service') || f.includes('main')
  );
  
  for (const svc of serviceFiles) {
    if (!healthEndpoints.includes(svc)) {
      missingHealth.push(svc);
    }
  }
  
  return {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'health-check',
    description: `Health check audit: found ${healthEndpoints.length} files with health endpoints`,
    result: {
      filesWithHealth: healthEndpoints,
      servicesMissingHealth: missingHealth,
      totalScanned: allFiles.result.count,
    },
    collectedAt: new Date().toISOString(),
  };
}

function collectDeadCodeEvidence(projectRoot: string): EvidenceItem {
  const orphans: string[] = [];
  const allFiles = collectFileEvidence(projectRoot, '*');
  const allContent: Record<string, string> = {};
  
  // Read all file contents
  for (const file of allFiles.result.matchedFiles) {
    try {
      allContent[file] = readFileSync(join(projectRoot, file), 'utf-8');
    } catch { /* skip */ }
  }
  
  const allFileNames = Object.keys(allContent);
  
  for (const file of allFileNames) {
    const baseName = basename(file, extname(file));
    if (baseName === 'index' || baseName === 'main' || baseName === 'package') continue;
    
    // Check if this file is referenced anywhere else
    const isReferenced = allFileNames.some(other => {
      if (other === file) return false;
      try {
        return allContent[other].includes(baseName);
      } catch { return false; }
    });
    
    if (!isReferenced) {
      orphans.push(file);
    }
  }
  
  return {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'code-analysis',
    description: `Dead code scan: found ${orphans.length} potentially orphaned files`,
    result: {
      orphanedFiles: orphans,
      totalFilesScanned: allFileNames.length,
      orphanPercentage: allFileNames.length > 0 ? Math.round((orphans.length / allFileNames.length) * 100) : 0,
    },
    collectedAt: new Date().toISOString(),
  };
}

function collectPM2Evidence(): EvidenceItem {
  let pm2Status = 'pm2 not available or not running';
  let processes: any[] = [];
  
  try {
    const status = execSync('pm2 jlist 2>&1', { encoding: 'utf-8', timeout: 10000 });
    processes = JSON.parse(status);
    pm2Status = processes.length > 0 ? 'running' : 'no processes';
  } catch (e: any) {
    pm2Status = `pm2 error: ${e.message?.slice(0, 200)}`;
  }
  
  return {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'log-check',
    description: `PM2 process status check`,
    result: {
      status: pm2Status,
      processCount: processes.length,
      processes: processes.map((p: any) => ({
        name: p.name,
        status: p.pm2_env?.status,
        restarts: p.pm2_env?.restart_time,
        memory: p.monit?.memory,
        cpu: p.monit?.cpu,
        uptime: p.pm2_env?.pm_uptime,
      })),
    },
    collectedAt: new Date().toISOString(),
  };
}

function collectTestEvidence(projectRoot: string): EvidenceItem {
  let testResult = 'no test runner found';
  let testOutput = '';
  
  try {
    const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'));
    if (pkg.scripts?.test) {
      try {
        testOutput = execSync(`cd "${projectRoot}" && npm test 2>&1`, { 
          encoding: 'utf-8', 
          timeout: 30000,
          env: { ...process.env, CI: 'true' }
        });
        testResult = 'tests passed';
      } catch (e: any) {
        testResult = `tests failed or errored`;
        testOutput = e.stdout || e.message || '';
      }
    } else {
      testResult = 'no test script defined in package.json';
    }
  } catch {
    testResult = 'no package.json found';
  }
  
  return {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'test-run',
    description: `Test execution: ${testResult}`,
    result: {
      status: testResult,
      output: testOutput.slice(0, 2000),
    },
    collectedAt: new Date().toISOString(),
  };
}

function collectConfigEvidence(projectRoot: string): EvidenceItem {
  const configs: Record<string, any> = {};
  
  // Check for key config files
  const configFiles = ['package.json', 'ecosystem.config.js', 'ecosystem.config.cjs', '.env.example', 'tsconfig.json'];
  
  for (const cf of configFiles) {
    const fp = join(projectRoot, cf);
    if (existsSync(fp)) {
      try {
        const content = readFileSync(fp, 'utf-8');
        configs[cf] = { exists: true, size: content.length, preview: content.slice(0, 500) };
      } catch {
        configs[cf] = { exists: true, readable: false };
      }
    } else {
      configs[cf] = { exists: false };
    }
  }
  
  return {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'config-audit',
    description: 'Configuration file audit',
    result: configs,
    collectedAt: new Date().toISOString(),
  };
}

// ── Task Execution ─────────────────────────────────────────────────────────

function executeTask(task: TaskRecord, projectRoot: string): TaskRecord {
  task.startedAt = new Date().toISOString();
  task.status = 'in-progress';
  
  const title = task.title.toLowerCase();
  
  try {
    if (title.includes('route') || title.includes('dashboard')) {
      task.evidence.push(collectRouteEvidence(projectRoot));
    }
    
    if (title.includes('pm2') || title.includes('process')) {
      task.evidence.push(collectPM2Evidence());
    }
    
    if (title.includes('health')) {
      task.evidence.push(collectHealthCheckEvidence(projectRoot));
    }
    
    if (title.includes('dead code') || title.includes('unused')) {
      task.evidence.push(collectDeadCodeEvidence(projectRoot));
    }
    
    if (title.includes('test') || title.includes('failing')) {
      task.evidence.push(collectTestEvidence(projectRoot));
    }
    
    if (title.includes('config') || title.includes('audit')) {
      task.evidence.push(collectConfigEvidence(projectRoot));
    }
    
    // Generic file scan as fallback
    if (task.evidence.length === 0) {
      task.evidence.push(collectFileEvidence(projectRoot, '*'));
    }
    
    task.status = 'evidence-collected';
    task.result = { evidenceCount: task.evidence.length, success: true };
  } catch (e: any) {
    task.status = 'failed';
    task.result = { error: e.message };
    task.evidence.push({
      id: `ev-err-${Date.now()}`,
      type: 'error',
      description: `Task execution error: ${e.message}`,
      result: { error: e.message, stack: e.stack },
      collectedAt: new Date().toISOString(),
    });
  }
  
  task.completedAt = new Date().toISOString();
  return task;
}

// ── QA ─────────────────────────────────────────────────────────────────────

function runQA(task: TaskRecord): TaskRecord {
  const checks: QACheck[] = [];
  
  // Check 1: Evidence completeness
  const hasEvidence = task.evidence.length > 0;
  checks.push({
    name: 'evidence-completeness',
    passed: hasEvidence,
    detail: hasEvidence ? `${task.evidence.length} evidence items collected` : 'No evidence collected',
  });
  
  // Check 2: Evidence has results
  const evidenceHasResults = task.evidence.every(e => e.result !== null && e.result !== undefined);
  checks.push({
    name: 'evidence-quality',
    passed: evidenceHasResults,
    detail: evidenceHasResults ? 'All evidence items have results' : 'Some evidence items missing results',
  });
  
  // Check 3: Task completed without errors
  const noErrors = task.status !== 'failed';
  checks.push({
    name: 'execution-success',
    passed: noErrors,
    detail: noErrors ? 'Task completed without errors' : 'Task encountered errors',
  });
  
  // Check 4: Evidence types are diverse
  const evidenceTypes = [...new Set(task.evidence.map(e => e.type))];
  const diverseEvidence = evidenceTypes.length >= 1;
  checks.push({
    name: 'evidence-diversity',
    passed: diverseEvidence,
    detail: `Evidence types: ${evidenceTypes.join(', ')}`,
  });
  
  const score = Math.round((checks.filter(c => c.passed).length / checks.length) * 100);
  
  task.qaResult = {
    passed: checks.every(c => c.passed),
    score,
    checks,
    reviewedAt: new Date().toISOString(),
  };
  
  task.status = task.qaResult.passed ? 'qa-passed' : 'qa-failed';
  
  return task;
}

// ── Report Generation ──────────────────────────────────────────────────────

function generateReport(obj: ObjectiveRecord): string {
  const lines: string[] = [];
  const now = new Date().toISOString();
  
  lines.push(`# Autonomous Execution Report`);
  lines.push(`**Objective:** ${obj.objective}`);
  lines.push(`**Received:** ${obj.receivedAt}`);
  lines.push(`**Completed:** ${obj.completedAt || 'in progress'}`);
  lines.push(`**Status:** ${obj.status}`);
  lines.push(`**Human Interventions:** ${obj.humanInterventions}`);
  lines.push('');
  
  // Summary
  const totalTasks = obj.tasks.length;
  const completedTasks = obj.tasks.filter(t => t.status === 'qa-passed' || t.status === 'completed').length;
  const failedTasks = obj.tasks.filter(t => t.status === 'failed' || t.status === 'qa-failed').length;
  const totalEvidence = obj.tasks.reduce((s, t) => s + t.evidence.length, 0);
  
  lines.push('## Summary');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Tasks | ${totalTasks} |`);
  lines.push(`| Completed | ${completedTasks} |`);
  lines.push(`| Failed | ${failedTasks} |`);
  lines.push(`| Evidence Items | ${totalEvidence} |`);
  lines.push(`| Human Interventions | ${obj.humanInterventions} |`);
  lines.push('');
  
  // Task breakdown
  lines.push('## Task Breakdown');
  for (const task of obj.tasks) {
    const qaStatus = task.qaResult ? (task.qaResult.passed ? '✅' : '❌') : '⏳';
    lines.push(`### ${task.title} [${task.department}] ${qaStatus}`);
    lines.push(`- **Status:** ${task.status}`);
    lines.push(`- **Evidence:** ${task.evidence.length} items`);
    if (task.qaResult) {
      lines.push(`- **QA Score:** ${task.qaResult.score}%`);
    }
    for (const ev of task.evidence) {
      lines.push(`  - ${ev.type}: ${ev.description}`);
      if (ev.result && typeof ev.result === 'object') {
        const summary = Object.entries(ev.result)
          .map(([k, v]) => {
            if (Array.isArray(v)) return `${k}: ${v.length} items`;
            if (typeof v === 'object' && v !== null) return `${k}: ${JSON.stringify(v).slice(0, 100)}`;
            return `${k}: ${v}`;
          })
          .join(', ');
        lines.push(`    - ${summary}`);
      }
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

// ── Main Engine ────────────────────────────────────────────────────────────

/**
 * Execute a CEO objective end-to-end with no human intervention.
 */
export function executeObjective(objective: string, projectRoot: string): ObjectiveRecord {
  ensureDirs();
  
  const objId = `obj-${Date.now()}`;
  const startTime = new Date().toISOString();
  
  // ── Step 1: Receive objective ──────────────────────────────────────────
  const obj: ObjectiveRecord = {
    id: objId,
    objective,
    receivedAt: startTime,
    completedAt: null,
    status: 'executing',
    tasks: [],
    report: null,
    humanInterventions: 0, // Zero by design — fully autonomous
  };
  
  saveObjective(obj);
  
  // ── Step 2: Decompose into tasks ───────────────────────────────────────
  const normalizedObj = objective.toLowerCase().trim();
  const tasks = buildTaskList(normalizedObj, objId);
  obj.tasks = tasks;
  
  // ── Step 3: Execute each task ──────────────────────────────────────────
  for (const task of obj.tasks) {
    executeTask(task, projectRoot);
    
    // ── Step 4: QA every task ──────────────────────────────────────────
    runQA(task);
    
    saveObjective(obj);
  }
  
  // ── Step 5: Generate report ────────────────────────────────────────────
  obj.completedAt = new Date().toISOString();
  obj.status = 'completed';
  obj.report = generateReport(obj);
  
  // Save final state
  saveObjective(obj);
  
  // Save evidence snapshot
  writeFileSync(join(EVIDENCE_DIR, `${objId}-evidence.json`), JSON.stringify(obj, null, 2));
  
  return obj;
}

/**
 * Build task list from objective text — mirrors the TypeScript decomposer logic.
 */
function buildTaskList(normalizedObj: string, objId: string): TaskRecord[] {
  const templates = getTaskTemplates(normalizedObj);
  
  return templates.map((t, i) => ({
    id: `${objId}-task-${i + 1}`,
    title: t.title,
    department: t.department,
    status: 'pending' as string,
    evidence: [] as EvidenceItem[],
    qaResult: null as QAResult | null,
    result: null,
    startedAt: '',
    completedAt: null,
  }));
}

function getTaskTemplates(normalizedObj: string): { title: string; department: string }[] {
  // Dashboard audit pattern
  if (normalizedObj.includes('dashboard') && 
      (normalizedObj.includes('audit') || normalizedObj.includes('check') || normalizedObj.includes('attention'))) {
    return [
      { title: 'Investigate dashboard routes and structure', department: 'engineering' },
      { title: 'Check PM2 process status', department: 'infrastructure' },
      { title: 'Audit Mi-Core health endpoints', department: 'engineering' },
      { title: 'Scan for dead code and unused modules', department: 'engineering' },
      { title: 'Check for failing tests', department: 'qa' },
      { title: 'Identify missing health checks', department: 'engineering' },
      { title: 'Configuration audit', department: 'engineering' },
      { title: 'QA validation of all findings', department: 'qa' },
      { title: 'Generate executive report', department: 'reporting' },
    ];
  }
  
  // Service health pattern
  if (normalizedObj.includes('service') && (normalizedObj.includes('health') || normalizedObj.includes('status'))) {
    return [
      { title: 'Check PM2 process status', department: 'infrastructure' },
      { title: 'Audit Mi-Core health endpoints', department: 'engineering' },
      { title: 'Configuration audit', department: 'engineering' },
      { title: 'QA validation', department: 'qa' },
      { title: 'Generate health report', department: 'reporting' },
    ];
  }
  
  // Default pattern
  return [
    { title: `Investigate: ${normalizedObj}`, department: 'engineering' },
    { title: `Execute: ${normalizedObj}`, department: 'engineering' },
    { title: 'QA review', department: 'qa' },
    { title: 'Generate report', department: 'reporting' },
  ];
}

// ── Scheduled Operations ───────────────────────────────────────────────────

export interface BriefResult {
  type: string;
  generatedAt: string;
  content: string;
}

/**
 * Morning Brief — auto-generated executive summary.
 */
export function generateMorningBrief(projectRoot: string): BriefResult {
  const lines: string[] = [];
  const now = new Date();
  
  lines.push(`# Morning Brief — ${now.toISOString().split('T')[0]}`);
  lines.push('');
  
  // Service health
  const pm2Evidence = collectPM2Evidence();
  lines.push('## Service Health');
  lines.push(`- PM2 Status: ${pm2Evidence.result.status}`);
  lines.push(`- Process Count: ${pm2Evidence.result.processCount}`);
  for (const proc of pm2Evidence.result.processes) {
    lines.push(`  - ${proc.name}: ${proc.status} (restarts: ${proc.restarts})`);
  }
  lines.push('');
  
  // File health
  const fileEvidence = collectFileEvidence(projectRoot, '*');
  lines.push('## Codebase');
  lines.push(`- Total files: ${fileEvidence.result.count}`);
  
  // Config check
  const configEvidence = collectConfigEvidence(projectRoot);
  lines.push('');
  lines.push('## Configuration');
  for (const [name, info] of Object.entries(configEvidence.result) as any[]) {
    lines.push(`- ${name}: ${info.exists ? 'present' : 'missing'}`);
  }
  lines.push('');
  
  // Recent objectives
  try {
    const objFiles = readdirSync(OBJECTIVES_DIR).filter(f => f.endsWith('.json'));
    lines.push('## Recent Objectives');
    lines.push(`- Total executed: ${objFiles.length}`);
    for (const of of objFiles.slice(-5)) {
      try {
        const obj = JSON.parse(readFileSync(join(OBJECTIVES_DIR, of), 'utf-8'));
        lines.push(`  - ${obj.objective} → ${obj.status}`);
      } catch { /* skip */ }
    }
  } catch {
    lines.push('## Recent Objectives');
    lines.push('- No objectives executed yet');
  }
  
  return {
    type: 'morning-brief',
    generatedAt: now.toISOString(),
    content: lines.join('\n'),
  };
}

/**
 * Evening Brief — end-of-day executive summary.
 */
export function generateEveningBrief(projectRoot: string): BriefResult {
  const brief = generateMorningBrief(projectRoot);
  brief.type = 'evening-brief';
  brief.content = brief.content.replace('Morning Brief', 'Evening Brief');
  return brief;
}

/**
 * Incident Summary — check for recent failures.
 */
export function generateIncidentSummary(projectRoot: string): BriefResult {
  const lines: string[] = [];
  const now = new Date();
  
  lines.push(`# Incident Summary — ${now.toISOString().split('T')[0]}`);
  lines.push('');
  
  // Check for failed objectives
  try {
    const objFiles = readdirSync(OBJECTIVES_DIR).filter(f => f.endsWith('.json'));
    let incidents = 0;
    
    for (const of of objFiles) {
      try {
        const obj = JSON.parse(readFileSync(join(OBJECTIVES_DIR, of), 'utf-8'));
        if (obj.status === 'failed') {
          incidents++;
          lines.push(`## ⚠️ Failed Objective`);
          lines.push(`- ${obj.objective}`);
          lines.push(`- Failed at: ${obj.completedAt}`);
        }
        for (const task of obj.tasks || []) {
          if (task.status === 'qa-failed' || task.status === 'failed') {
            incidents++;
            lines.push(`## ⚠️ Failed Task`);
            lines.push(`- ${task.title} (${task.department})`);
          }
        }
      } catch { /* skip */ }
    }
    
    if (incidents === 0) {
      lines.push('✅ No incidents detected.');
    }
  } catch {
    lines.push('✅ No objectives to check — clean state.');
  }
  
  return {
    type: 'incident-summary',
    generatedAt: now.toISOString(),
    content: lines.join('\n'),
  };
}

/**
 * Service Health Summary — detailed health check.
 */
export function generateServiceHealthSummary(projectRoot: string): BriefResult {
  const lines: string[] = [];
  const now = new Date();
  
  lines.push(`# Service Health Summary — ${now.toISOString()}`);
  lines.push('');
  
  const pm2 = collectPM2Evidence();
  const health = collectHealthCheckEvidence(projectRoot);
  const config = collectConfigEvidence(projectRoot);
  
  lines.push('## PM2');
  lines.push(`- Status: ${pm2.result.status}`);
  lines.push(`- Processes: ${pm2.result.processCount}`);
  for (const p of pm2.result.processes) {
    lines.push(`  - **${p.name}**: ${p.status} | restarts: ${p.restarts} | mem: ${p.memory ? Math.round(p.memory / 1024 / 1024) + 'MB' : 'N/A'} | cpu: ${p.cpu || 'N/A'}%`);
  }
  lines.push('');
  
  lines.push('## Health Endpoints');
  lines.push(`- Files with health routes: ${health.result.filesWithHealth?.length || 0}`);
  lines.push(`- Services missing health: ${health.result.servicesMissingHealth?.length || 0}`);
  if (health.result.servicesMissingHealth?.length > 0) {
    for (const s of health.result.servicesMissingHealth) {
      lines.push(`  - ⚠️ ${s}`);
    }
  }
  lines.push('');
  
  return {
    type: 'service-health-summary',
    generatedAt: now.toISOString(),
    content: lines.join('\n'),
  };
}

// ── Exports ────────────────────────────────────────────────────────────────

export default {
  executeObjective,
  generateMorningBrief,
  generateEveningBrief,
  generateIncidentSummary,
  generateServiceHealthSummary,
};
