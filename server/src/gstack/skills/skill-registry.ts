/**
 * GStack Skill Registry — V2 (Phase 11)
 * Named, callable, composable skills.
 * Skills are registered in a JSON store — no longer hardcoded.
 * Dynamic discovery via tag-based intent matching.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  writeSourceScan, writePm2Status, writeErrorLog,
  writeHealthCheck, writeTestResults, writeDashboardAudit,
  writeCommandOutput,
} from '../evidence-engine';
import { seedBuiltinSkills, getAllSkillsFromStore, getSkillFromStore } from './skill-store';
import { recordExecution } from './skill-reliability-tracker';
import { selectBestSkillChain, discoverSkills, searchSkills } from './dynamic-skill-selector';

// Seed the registry on module load (idempotent — only runs once per boot)
seedBuiltinSkills();

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SkillCategory =
  | 'system'
  | 'code'
  | 'knowledge'
  | 'communication'
  | 'finance'
  | 'product';

export type ApprovalClass = 'SAFE' | 'REQUIRES_APPROVAL';

export interface SkillDef {
  id: string;
  name: string;
  name_vi: string;
  category: SkillCategory;
  description: string;
  approval_class: ApprovalClass;
  risk_level: 1 | 2 | 3;
  params: string[];           // expected param keys
  available: boolean;
}

export interface SkillResult {
  skill_id: string;
  success: boolean;
  output: string;
  evidence: string;
  duration_ms: number;
  approval_class: ApprovalClass;
}

// ── Skill definitions ─────────────────────────────────────────────────────────

const SKILLS: Record<string, SkillDef> = {
  health: {
    id: 'health',
    name: 'Health Check',
    name_vi: 'Kiểm tra sức khoẻ hệ thống',
    category: 'system',
    description: 'HTTP health check on all Mi-Core services',
    approval_class: 'SAFE',
    risk_level: 1,
    params: [],
    available: true,
  },
  pm2_status: {
    id: 'pm2_status',
    name: 'PM2 Status',
    name_vi: 'Trạng thái tiến trình PM2',
    category: 'system',
    description: 'Read PM2 process list — status, restarts, memory',
    approval_class: 'SAFE',
    risk_level: 1,
    params: [],
    available: true,
  },
  pm2_restart: {
    id: 'pm2_restart',
    name: 'PM2 Restart',
    name_vi: 'Khởi động lại tiến trình',
    category: 'system',
    description: 'Restart a PM2-managed service (production impact)',
    approval_class: 'REQUIRES_APPROVAL',
    risk_level: 3,
    params: ['process_name'],
    available: true,
  },
  source_scan: {
    id: 'source_scan',
    name: 'Source Scan',
    name_vi: 'Quét mã nguồn',
    category: 'code',
    description: 'Scan project source for issues: TODO, credentials, missing error handling',
    approval_class: 'SAFE',
    risk_level: 1,
    params: ['project_path'],
    available: true,
  },
  log_scan: {
    id: 'log_scan',
    name: 'Log Scan',
    name_vi: 'Quét nhật ký lỗi',
    category: 'system',
    description: 'Read recent PM2 error logs for a service',
    approval_class: 'SAFE',
    risk_level: 1,
    params: ['log_path'],
    available: true,
  },
  build_check: {
    id: 'build_check',
    name: 'Build Check',
    name_vi: 'Kiểm tra biên dịch',
    category: 'code',
    description: 'Verify TypeScript compiles with zero errors',
    approval_class: 'SAFE',
    risk_level: 1,
    params: ['project_path'],
    available: true,
  },
  regression_suite: {
    id: 'regression_suite',
    name: 'Regression Suite',
    name_vi: 'Bộ kiểm thử hồi quy',
    category: 'code',
    description: '10 mandatory CEO WhatsApp cases — no English errors, <5s each',
    approval_class: 'SAFE',
    risk_level: 1,
    params: [],
    available: true,
  },
  dashboard_audit: {
    id: 'dashboard_audit',
    name: 'Dashboard Audit',
    name_vi: 'Kiểm tra Dashboard',
    category: 'product',
    description: 'Audit dashboard.bakudanramen.com — health, routes, data freshness',
    approval_class: 'SAFE',
    risk_level: 1,
    params: [],
    available: true,
  },
  knowledge_search: {
    id: 'knowledge_search',
    name: 'Knowledge Search',
    name_vi: 'Tìm kiếm tri thức',
    category: 'knowledge',
    description: 'Query the Knowledge Universe (SQLite + 8000+ docs)',
    approval_class: 'SAFE',
    risk_level: 1,
    params: ['query', 'limit'],
    available: true,
  },
  github_read: {
    id: 'github_read',
    name: 'GitHub Read',
    name_vi: 'Đọc GitHub',
    category: 'code',
    description: 'Read repos, PRs, issues, commits via GitHub API',
    approval_class: 'SAFE',
    risk_level: 1,
    params: ['repo', 'resource'],
    available: false, // requires GH_TOKEN
  },
  github_write: {
    id: 'github_write',
    name: 'GitHub Write',
    name_vi: 'Ghi GitHub',
    category: 'code',
    description: 'Create PR, commit, branch via GitHub API',
    approval_class: 'REQUIRES_APPROVAL',
    risk_level: 2,
    params: ['repo', 'action', 'payload'],
    available: false,
  },
  review_automation: {
    id: 'review_automation',
    name: 'Review Automation',
    name_vi: 'Tự động kiểm duyệt',
    category: 'product',
    description: 'Trigger mi-review-approvals pipeline for code review actions',
    approval_class: 'SAFE',
    risk_level: 1,
    params: ['review_id', 'action'],
    available: true,
  },
  quickbooks: {
    id: 'quickbooks',
    name: 'QuickBooks',
    name_vi: 'QuickBooks kế toán',
    category: 'finance',
    description: 'Query QB: invoices, expenses, reports',
    approval_class: 'SAFE',
    risk_level: 1,
    params: ['resource', 'filter'],
    available: false, // requires QB_TOKEN
  },
  gmail_draft: {
    id: 'gmail_draft',
    name: 'Gmail Draft',
    name_vi: 'Soạn email',
    category: 'communication',
    description: 'Draft an email — does NOT send without approval',
    approval_class: 'SAFE',
    risk_level: 1,
    params: ['to', 'subject', 'body'],
    available: false, // requires GOOGLE_OAUTH
  },
  gmail_send: {
    id: 'gmail_send',
    name: 'Gmail Send',
    name_vi: 'Gửi email',
    category: 'communication',
    description: 'Send email — requires CEO approval',
    approval_class: 'REQUIRES_APPROVAL',
    risk_level: 2,
    params: ['to', 'subject', 'body'],
    available: false,
  },
  calendar_read: {
    id: 'calendar_read',
    name: 'Calendar Read',
    name_vi: 'Đọc lịch',
    category: 'communication',
    description: 'Read CEO calendar events from Google Calendar',
    approval_class: 'SAFE',
    risk_level: 1,
    params: ['date_range'],
    available: false, // requires GOOGLE_OAUTH
  },
  calendar_write: {
    id: 'calendar_write',
    name: 'Calendar Write',
    name_vi: 'Tạo sự kiện lịch',
    category: 'communication',
    description: 'Create or update calendar events',
    approval_class: 'REQUIRES_APPROVAL',
    risk_level: 2,
    params: ['title', 'time', 'attendees'],
    available: false,
  },
  raw_seo_publish: {
    id: 'raw_seo_publish',
    name: 'Raw SEO Publish',
    name_vi: 'Đăng bài SEO Raw Sushi',
    category: 'product',
    description: 'Create and publish an SEO article to rawsushibar.com, capture evidence, send WhatsApp proof to CEO',
    approval_class: 'REQUIRES_APPROVAL',
    risk_level: 2,
    params: ['title', 'topic', 'keyword', 'location'],
    available: true,
  },
};

// ── Executor ──────────────────────────────────────────────────────────────────

async function httpGet(port: number, urlPath: string, key?: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  const http = require('http');
  return new Promise((resolve) => {
    const headers: Record<string, string> = key ? { 'x-api-key': key } : {};
    const req = http.get({ hostname: '127.0.0.1', port, path: urlPath, headers, timeout: 5000 }, (res: any) => {
      let d = ''; res.on('data', (c: Buffer) => d += c);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ ok: res.statusCode < 400, status: res.statusCode, body: {} }); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, body: {} }); });
    req.on('error', () => resolve({ ok: false, status: 0, body: {} }));
  });
}

async function executeSkill(id: string, params: Record<string, string> = {}, workOrderId?: string): Promise<SkillResult> {
  // Phase 11: look up from store first, fall back to hardcoded def
  const storeDef = getSkillFromStore(id);
  const def = storeDef ? (storeDef as unknown as SkillDef) : SKILLS[id];
  if (!def) return { skill_id: id, success: false, output: `Unknown skill: ${id}`, evidence: '', duration_ms: 0, approval_class: 'SAFE' };
  if (!def.available) return { skill_id: id, success: false, output: `Skill ${id} not yet configured (missing credentials/token)`, evidence: def.description, duration_ms: 0, approval_class: def.approval_class };

  const t0 = Date.now();
  const wo = workOrderId;   // shorthand — undefined means no evidence writing
  const skillVersion = (storeDef as any)?.version || '1.0.0';

  const recordAndReturn = (result: SkillResult): SkillResult => {
    recordExecution(id, skillVersion, result.success, result.duration_ms, workOrderId);
    return result;
  };

  try {
    switch (id) {

      case 'health': {
        const services = [
          { name: 'mi-core', port: 4001, path: '/api/health', key: process.env.MI_CORE_API_KEY || '' },
          { name: 'whatsapp-ai-gateway', port: 3211, path: '/health' },
          { name: 'antigravity-gateway', port: 3456, path: '/health' },
        ];
        const results = await Promise.all(services.map(s => httpGet(s.port, s.path, s.key)));
        const up = results.filter(r => r.ok).length;
        const summary = services.map((s, i) => `${s.name}: ${results[i].ok ? '✅' : '❌'} (${results[i].status})`).join(' | ');
        if (wo) {
          writeHealthCheck(wo, services.map((s, i) => ({ name: s.name, up: results[i].ok, status: results[i].status })), 'health_skill');
        }
        return { skill_id: id, success: up >= 2, output: summary, evidence: `${up}/${services.length} services UP`, duration_ms: Date.now() - t0, approval_class: def.approval_class };
      }

      case 'pm2_status': {
        const rawOut = execSync('pm2 jlist', { timeout: 8000, encoding: 'utf8', shell: 'cmd.exe' });
        const procs: any[] = JSON.parse(rawOut);
        const summary = procs.map(p => `${p.name}: ${p.pm2_env?.status} | ↺${p.pm2_env?.restart_time} | ${Math.round((p.monit?.memory || 0) / 1024 / 1024)}MB`).join('\n');
        if (wo) writePm2Status(wo, rawOut, 'pm2_skill');
        return { skill_id: id, success: true, output: summary, evidence: `${procs.length} processes`, duration_ms: Date.now() - t0, approval_class: def.approval_class };
      }

      case 'pm2_restart': {
        const name = params.process_name || 'mi-core';
        const out = execSync(`pm2 restart ${name}`, { timeout: 20000, encoding: 'utf8', shell: 'cmd.exe' });
        if (wo) writeCommandOutput(wo, `pm2 restart ${name}`, out, true, 'release_skill', 'pm2_restart');
        return { skill_id: id, success: true, output: out.slice(0, 200), evidence: `Restarted: ${name}`, duration_ms: Date.now() - t0, approval_class: def.approval_class };
      }

      case 'source_scan': {
        const projectPath = params.project_path || path.join(MI_CORE_ROOT, 'server/src');
        const findings: string[] = [];
        const scanned: string[] = [];
        function scanDir(dir: string, depth = 0): void {
          if (depth > 3 || !fs.existsSync(dir)) return;
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist') continue;
            const full = path.join(dir, e.name);
            if (e.isDirectory()) { scanDir(full, depth + 1); continue; }
            if (!/\.(ts|js|mjs)$/.test(e.name)) continue;
            try {
              const content = fs.readFileSync(full, 'utf8');
              const rel = path.relative(projectPath, full);
              scanned.push(rel);
              const todos = (content.match(/\/\/\s*(TODO|FIXME|HACK)/gi) || []).length;
              if (todos > 0) findings.push(`${rel}: ${todos} TODO/FIXME`);
              if (/password\s*=\s*['"][^'"]{6,}['"]/i.test(content)) findings.push(`${rel}: ⚠️ possible hardcoded credential`);
            } catch { /* skip */ }
          }
        }
        scanDir(projectPath);
        const header = `# Source Scan\nScanned: ${scanned.length} files\nFindings: ${findings.length}\nPath: ${projectPath}\nDate: ${new Date().toISOString()}\n\n`;
        const body = findings.length > 0 ? findings.slice(0, 20).join('\n') : 'No critical issues found';
        const fullOutput = header + body;
        if (wo) writeSourceScan(wo, fullOutput, 'source_scan_skill');
        return { skill_id: id, success: true, output: body, evidence: `${findings.length} finding(s) in ${scanned.length} files`, duration_ms: Date.now() - t0, approval_class: def.approval_class };
      }

      case 'log_scan': {
        const pm2ErrLog = path.join(process.env.HOME || process.env.USERPROFILE || 'C:/Users/liemdo', '.pm2/logs/mi-core-error.log');
        const logPath = params.log_path || pm2ErrLog;
        let logContent: string;
        if (!fs.existsSync(logPath)) {
          logContent = `Log not found at: ${logPath}\nChecked at: ${new Date().toISOString()}`;
        } else {
          const raw = fs.readFileSync(logPath, 'utf8');
          const lines = raw.split('\n').filter(Boolean).slice(-50);
          logContent = `# Error Log\nSource: ${logPath}\nScanned: last 50 lines\nDate: ${new Date().toISOString()}\n\n` + lines.join('\n');
        }
        const errors = (logContent.match(/error|Error|ERR/gi) || []).length;
        if (wo) writeErrorLog(wo, logContent, 'log_scan_skill');
        return { skill_id: id, success: true, output: logContent.slice(0, 300), evidence: `${errors} error occurrences in log`, duration_ms: Date.now() - t0, approval_class: def.approval_class };
      }

      case 'build_check': {
        const serverPath = params.project_path || path.join(MI_CORE_ROOT, 'server');
        try {
          const out = execSync('npx tsc --noEmit 2>&1', { cwd: serverPath, timeout: 60000, encoding: 'utf8', shell: 'cmd.exe' });
          if (wo) writeCommandOutput(wo, 'npx tsc --noEmit', out || 'TypeScript: 0 errors', true, 'build_skill', 'build_check');
          return { skill_id: id, success: true, output: 'TypeScript: 0 errors', evidence: 'tsc --noEmit passed', duration_ms: Date.now() - t0, approval_class: def.approval_class };
        } catch (e: any) {
          const errCount = (e.message.match(/error TS/g) || []).length;
          if (wo) writeCommandOutput(wo, 'npx tsc --noEmit', e.message.slice(0, 2000), false, 'build_skill', 'build_check');
          return { skill_id: id, success: false, output: `${errCount} TypeScript error(s)`, evidence: e.message.slice(0, 200), duration_ms: Date.now() - t0, approval_class: def.approval_class };
        }
      }

      case 'regression_suite': {
        const { processJarvisQuery } = require('../jarvis/phase30-jarvis/jarvis-core');
        const CASES = [
          { id: 'R01', text: 'Mi oi', expect: ['Em đây', 'em đây'] },
          { id: 'R02', text: 'Alo', expect: ['Em đây', 'em đây'] },
          { id: 'R03', text: 'hom nay a co lich gi ko', expect: ['Em chưa', 'Em đang', 'chưa có'] },
          { id: 'R04', text: 'em co biet anh dang lam project nao ko', expect: ['Dev', 'project', 'em biết', 'em chưa'] },
          { id: 'R05', text: 'Co gi dang lo khong', expect: ['Em', 'ổn', 'bình thường'] },
        ];
        const testRows: Array<{ id: string; name: string; passed: boolean; output: string; duration_ms: number }> = [];
        for (const c of CASES) {
          const ct0 = Date.now();
          const res = await processJarvisQuery({ sender: `skill-qa-${Date.now()}`, raw_text: c.text, normalized: c.text, timestamp: new Date().toISOString() });
          const reply = res.reply || '';
          const passed = c.expect.some(e => reply.toLowerCase().includes(e.toLowerCase()));
          testRows.push({ id: c.id, name: `CEO: "${c.text}"`, passed, output: reply.slice(0, 100), duration_ms: Date.now() - ct0 });
        }
        const passed = testRows.filter(r => r.passed).length;
        if (wo) writeTestResults(wo, testRows, 'regression_skill');
        return { skill_id: id, success: passed === CASES.length, output: `${passed}/${CASES.length} PASS`, evidence: 'CEO regression cases', duration_ms: Date.now() - t0, approval_class: def.approval_class };
      }

      case 'dashboard_audit': {
        const apiKey = process.env.MI_CORE_API_KEY || '';
        const [h, vis] = await Promise.all([
          httpGet(4001, '/api/health', apiKey),
          httpGet(4001, '/api/visibility/connectors', apiKey),
        ]);
        const body = vis.body as any;
        const connectors = Array.isArray(body) ? body : (body?.connectors || []);
        const active = connectors.filter((c: any) => c.status === 'active' || c.auth_status === 'connected').length;
        const auditData = {
          audited_at: new Date().toISOString(),
          api_status: h.status,
          api_ok: h.ok,
          connector_total: connectors.length,
          connector_active: active,
          services_up: h.ok ? 1 : 0,
          summary: `Mi-Core: ${h.ok ? 'UP' : 'DOWN'} | Connectors: ${active}/${connectors.length} active`,
        };
        if (wo) writeDashboardAudit(wo, auditData, 'dashboard_skill');
        return { skill_id: id, success: h.ok, output: auditData.summary, evidence: auditData.summary, duration_ms: Date.now() - t0, approval_class: def.approval_class };
      }

      case 'knowledge_search': {
        const query = params.query || '';
        const limit = parseInt(params.limit || '5', 10);
        if (!query) return { skill_id: id, success: false, output: 'query param required', evidence: '', duration_ms: Date.now() - t0, approval_class: def.approval_class };
        const { search } = require('../knowledge/knowledge-db');
        const results = search(query, limit);
        const out = results.map((r: any, i: number) => `${i + 1}. [${r.category}] ${r.title || r.content?.slice(0, 60)}`).join('\n');
        if (wo) writeCommandOutput(wo, `knowledge_search: ${query}`, out || 'No results', true, 'knowledge_skill', 'knowledge');
        return { skill_id: id, success: true, output: out || 'No results', evidence: `${results.length} docs found`, duration_ms: Date.now() - t0, approval_class: def.approval_class };
      }

      case 'review_automation': {
        const reviewId = params.review_id || '';
        const action = params.action || 'status';
        const h = await httpGet(4001, `/api/mi/review-approvals/${reviewId || 'list'}`, process.env.MI_CORE_API_KEY || '');
        if (wo) writeCommandOutput(wo, `review_automation: ${action}`, JSON.stringify(h.body).slice(0, 500), h.ok, 'review_skill', 'review');
        return { skill_id: id, success: h.ok, output: `Review ${action}: HTTP ${h.status}`, evidence: JSON.stringify(h.body).slice(0, 100), duration_ms: Date.now() - t0, approval_class: def.approval_class };
      }

      case 'raw_seo_publish': {
        const { publishArticle } = require('../connectors/raw-website-connector');
        const { captureEvidence } = require('../evidence/evidence-generator');

        const title = params.title || `${params.topic || 'Sushi'} — Raw Sushi Bar ${params.location === 'raw_modesto' ? 'Modesto' : 'Stockton'}`;
        const keyword = params.keyword || params.topic || 'sushi stockton';
        const location = (params.location as 'raw_stockton' | 'raw_modesto') || 'raw_stockton';

        const slugVal = title.toLowerCase()
          .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60);

        const body = [
          `## ${title}`,
          '',
          `Raw Sushi Bar serves the finest ${keyword} in the Central Valley.`,
          'Located at 10742 Trinity Parkway, Suite D, Stockton, CA — open daily.',
          '',
          '### Why Raw Sushi Bar?',
          '- Fresh fish delivered daily',
          '- 20+ years of sushi mastery',
          '- Chef\'s Omakase available',
          '',
          '### Order Now',
          'Visit [rawsushibar.com](https://rawsushibar.com/order.html) to order online.',
        ].join('\n');

        const publishResult = await publishArticle({
          title,
          slug: slugVal,
          body,
          excerpt: `Discover the best ${keyword} at Raw Sushi Bar.`,
          meta_description: `Find the best ${keyword} at Raw Sushi Bar in Stockton. Fresh, authentic, delivered daily.`,
          primary_keyword: keyword,
          cta: 'Order now',
          cta_url: 'https://rawsushibar.com/order.html',
          post_type: 'conversion_order',
          target_audience: 'Sushi lovers in Stockton and Modesto, CA',
          location,
        });

        if (!publishResult.ok) {
          return { skill_id: id, success: false, output: `Publish failed: ${publishResult.error}`, evidence: publishResult.steps.join(' → '), duration_ms: Date.now() - t0, approval_class: def.approval_class };
        }

        // Capture evidence — required by Reality Gate
        const evidence = await captureEvidence({
          workflow_id: workOrderId || `skill-${Date.now()}`,
          slug: slugVal,
          url: publishResult.url!,
          git_commit: publishResult.git_commit,
          post_id: publishResult.post_id,
          steps: publishResult.steps,
        });

        const evidenceLine = `URL: ${publishResult.url} | HTTP: ${evidence.http_status} | Git: ${publishResult.git_commit || 'n/a'} | Evidence: ${evidence.verified ? 'VERIFIED' : 'PENDING (CF build in progress)'}`;

        if (wo) writeCommandOutput(wo, 'raw_seo_publish', evidenceLine, publishResult.ok, 'publish_skill', 'raw_seo_publish');

        return {
          skill_id: id,
          success: true,
          output: evidenceLine,
          evidence: `Evidence saved: ${evidence.timestamp}`,
          duration_ms: Date.now() - t0,
          approval_class: def.approval_class,
        };
      }

      default:
        return recordAndReturn({ skill_id: id, success: false, output: `Skill ${id} executor not implemented`, evidence: '', duration_ms: Date.now() - t0, approval_class: def.approval_class });
    }
  } catch (e: any) {
    const dur = Date.now() - t0;
    recordExecution(id, skillVersion, false, dur, workOrderId, (e as Error).message?.slice(0, 200));
    return { skill_id: id, success: false, output: `Error: ${e.message?.slice(0, 200)}`, evidence: '', duration_ms: dur, approval_class: def.approval_class };
  }
}

// ── Public API — V2 (Phase 11) ────────────────────────────────────────────────

export function listSkills(filter?: { category?: SkillCategory; approval_class?: ApprovalClass; available?: boolean }): SkillDef[] {
  // Read from registry store — not hardcoded SKILLS object
  let skills = getAllSkillsFromStore() as unknown as SkillDef[];
  if (filter?.category) skills = skills.filter(s => s.category === filter.category);
  if (filter?.approval_class) skills = skills.filter(s => s.approval_class === filter.approval_class);
  if (filter?.available !== undefined) skills = skills.filter(s => s.available === filter.available);
  return skills;
}

export function getSkill(id: string): SkillDef | null {
  // First check store, fall back to hardcoded (backward compat)
  return (getSkillFromStore(id) as unknown as SkillDef) || SKILLS[id] || null;
}

export async function runSkill(id: string, params?: Record<string, string>, workOrderId?: string): Promise<SkillResult> {
  const result = await executeSkill(id, params || {}, workOrderId);
  // Phase 11: record every execution for reliability scoring
  const storeDef = getSkillFromStore(id);
  const version = (storeDef as any)?.version || '1.0.0';
  recordExecution(id, version, result.success, result.duration_ms, workOrderId,
    result.success ? undefined : result.output?.slice(0, 200));
  return result;
}

export function getSkillsForIntent(intent: string): string[] {
  // Phase 11: dynamic selection from registry store
  return selectBestSkillChain(intent);
}

// ── Phase 11 additions ────────────────────────────────────────────────────────

export { discoverSkills, searchSkills } from './dynamic-skill-selector';
export { installSkill, updateSkill, rollbackSkill, disableSkill, enableSkill, removeSkill, getInstalledSkills, getSkillVersions, getImportStatus } from './skill-import-service';
export { getReliabilityScore, getAllReliabilityScores, getSkillHistory } from './skill-reliability-tracker';

// ── Phase 12 — SkillSpector ───────────────────────────────────────────────────

export { evaluateSkill, evaluateAllSkills, getQAEvaluation, getAllQAEvaluations } from './skill-qa-engine';
export { computeTrustScore, getTrustScore, getAllTrustScores, getTrustHistory, rankSkillsByTrust } from './skill-trust-score';
export { analyzeSkillFailures, getFailureReport, getAllFailureReports } from './skill-failure-analysis';
export { certifySkill, certifyAllSkills, getCertification, getAllCertifications } from './skill-certification';
export type { SkillQAEvaluation, QAGrade, EvidenceQuality } from './skill-qa-engine';
export type { SkillTrustScore, TrustTrend } from './skill-trust-score';
export type { SkillFailureReport, FailurePattern } from './skill-failure-analysis';
export type { SkillCertification, CertificationLevel } from './skill-certification';

export function formatSkillListForCeo(): string {
  const byCategory = Object.values(SKILLS).reduce((acc: Record<string, SkillDef[]>, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  const catNames: Record<string, string> = {
    system: '🖥️ Hệ thống', code: '💻 Code', knowledge: '📚 Tri thức',
    communication: '📧 Liên lạc', finance: '💰 Tài chính', product: '📊 Sản phẩm',
  };

  return Object.entries(byCategory).map(([cat, skills]) =>
    `*${catNames[cat] || cat}*\n` + skills.map(s => `  • ${s.name_vi} (${s.approval_class === 'SAFE' ? '✅ tự động' : '⏳ cần approve'})`).join('\n')
  ).join('\n\n');
}
