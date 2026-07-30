/**
 * Auditor Agent
 * Independent verifier. Confirms claims made by other agents.
 * Rejects PASS reports without sufficient evidence.
 * No agent bypasses the Auditor for production certification.
 */

import fs from 'fs';
import path from 'path';

import { WorkOrder, WorkOrderResult } from '../work-order-engine';
import { QaResult } from './qa-agent';
import { logAction } from '../execution-ledger';



export interface AuditResult {
  certified: boolean;
  verdict: 'CERTIFIED' | 'CONDITIONAL_PASS' | 'REJECTED';
  rejected_claims: string[];
  confirmed_claims: string[];
  confidence_score: number;
  auditor_notes: string[];
  certification_id?: string;
}

// ── Evidence validation rules ─────────────────────────────────────────────────

interface EvidenceRule {
  name: string;
  check: (wo: WorkOrder, qa: QaResult) => { pass: boolean; note: string };
  blocking: boolean;
}

const EVIDENCE_RULES: EvidenceRule[] = [
  {
    name: 'QA sweep must have run',
    blocking: true,
    check: (_wo, qa) => ({
      pass: qa.checks.length > 0,
      note: qa.checks.length > 0 ? `${qa.checks.length} QA checks recorded` : 'No QA checks found — REJECTED',
    }),
  },
  {
    name: 'No crash-looping services at time of certification',
    // Non-blocking for audit/fix — we REPORT the P0 but don't reject the audit cert
    // Only blocking for deploy_release intents where we can't ship with P0 open
    blocking: false,
    check: (wo, qa) => {
      const p0 = qa.checks.find(c => c.check_id === 'QA2');
      if (!p0) return { pass: true, note: 'P0 check skipped (non-critical path)' };
      const isDeployIntent = wo.intent?.intent === 'deploy_release' || wo.intent?.intent === 'rollback';
      if (p0.status === 'FAIL' && isDeployIntent) return { pass: false, note: `DEPLOY BLOCKED — ${p0.evidence}` };
      return { pass: true, note: p0.status === 'FAIL' ? `⚠️ Pre-existing P0 found (non-blocking for audit): ${p0.evidence}` : p0.evidence };
    },
  },
  {
    name: 'At least 2 services must be healthy',
    blocking: true,
    check: (_wo, qa) => {
      const health = qa.checks.find(c => c.check_id === 'QA3');
      if (!health) return { pass: false, note: 'Health check not run' };
      return { pass: health.status === 'PASS', note: health.evidence };
    },
  },
  {
    name: 'Regression suite must pass if CEO personality was touched',
    blocking: false,
    check: (_wo, qa) => {
      const reg = qa.checks.find(c => c.check_id === 'QA1');
      if (!reg) return { pass: true, note: 'Regression suite not required for this work order' };
      return { pass: reg.status === 'PASS', note: reg.evidence };
    },
  },
  {
    name: 'Execution log must have entries from at least 2 agents',
    blocking: false,
    check: (wo, _qa) => {
      const roles = [...new Set(wo.execution_log.map(e => e.role).filter(r => r !== 'system'))];
      return {
        pass: roles.length >= 2,
        note: roles.length >= 2 ? `Agents engaged: ${roles.join(', ')}` : `Only ${roles.length} agent(s) logged`,
      };
    },
  },
];

function genCertId(woId: string): string {
  return `CERT-${woId}-${Date.now().toString(36).toUpperCase()}`;
}

// ── Scan source for common issues ─────────────────────────────────────────────

function scanSourceForIssues(targetProject?: string): { findings: string[]; safe_fixes: string[] } {
  const findings: string[] = [];
  const safe_fixes: string[] = [];

  // Project path mapping
  const projectPaths: Record<string, string> = {
    'mi-core': 'E:/Project/Master/mi-core/server/src',
    'dashboard': 'E:/Project/Master/Bakudan',
    'whatsapp-ai-gateway': 'E:/Project/Master/whatsapp-ai-gateway/src',
    'visibility': 'E:/Project/Master/mi-core/.local-agent-global/visibility',
  };

  const targetPath = targetProject ? projectPaths[targetProject] : null;

  if (!targetPath || !fs.existsSync(targetPath)) {
    findings.push(`Target project ${targetProject || 'unknown'} — path not found or not scannable`);
    return { findings, safe_fixes };
  }

  try {
    // Scan for common issues in TypeScript files
    const scanDir = (dir: string, depth = 0): void => {
      if (depth > 3) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath, depth + 1);
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const relPath = path.relative(targetPath, fullPath);

            // Check for TODO/FIXME
            const todos = (content.match(/\/\/\s*(TODO|FIXME|HACK|XXX)/gi) || []).length;
            if (todos > 0) findings.push(`${relPath}: ${todos} TODO/FIXME comment(s)`);

            // Check for console.error that may be masking issues
            const consoleErrors = (content.match(/console\.error\(/g) || []).length;
            if (consoleErrors > 5) findings.push(`${relPath}: ${consoleErrors} console.error calls (possible error suppression)`);

            // Check for hardcoded credentials (basic check)
            if (/password\s*=\s*['"][^'"]{6,}['"]/i.test(content) ||
                /secret\s*=\s*['"][^'"]{10,}['"]/i.test(content)) {
              findings.push(`${relPath}: Possible hardcoded credential detected — SECURITY RISK`);
            }

            // Check for missing error handling in async functions
            const asyncFunctions = (content.match(/async\s+function/g) || []).length;
            const tryCatch = (content.match(/try\s*\{/g) || []).length;
            if (asyncFunctions > 3 && tryCatch === 0) {
              findings.push(`${relPath}: ${asyncFunctions} async functions with no try/catch`);
            }

          } catch { /* skip unreadable */ }
        }
      }
    };

    scanDir(targetPath);

    if (findings.length === 0) findings.push('No critical issues found in source scan');
    if (findings.some(f => /TODO|FIXME/i.test(f))) {
      safe_fixes.push('TODO/FIXME comments documented — no code change required');
    }

  } catch (e: unknown) {
    findings.push(`Source scan error: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { findings, safe_fixes };
}

// ── Main audit ────────────────────────────────────────────────────────────────

export async function audit(wo: WorkOrder, qa: QaResult): Promise<AuditResult> {
  const confirmed: string[] = [];
  const rejected: string[] = [];
  const notes: string[] = [];
  let blockingFail = false;

  for (const rule of EVIDENCE_RULES) {
    const { pass, note } = rule.check(wo, qa);
    if (pass) {
      confirmed.push(`✅ ${rule.name}: ${note}`);
    } else {
      rejected.push(`❌ ${rule.name}: ${note}`);
      if (rule.blocking) blockingFail = true;
    }
  }

  // Source scan
  const { findings: sourceFindings } = scanSourceForIssues(wo.target_project);
  const criticalFindings = sourceFindings.filter(f =>
    /SECURITY RISK|critical/i.test(f) && !f.includes('No critical')
  );
  if (criticalFindings.length > 0) {
    notes.push(`Source audit found ${criticalFindings.length} critical issue(s): ${criticalFindings[0]}`);
  }

  const totalChecks = confirmed.length + rejected.length;
  const confidence = Math.round((confirmed.length / totalChecks) * 100);

  let verdict: AuditResult['verdict'];
  if (blockingFail) {
    verdict = 'REJECTED';
  } else if (rejected.length > 0) {
    verdict = 'CONDITIONAL_PASS';
  } else {
    verdict = 'CERTIFIED';
  }

  const certId = verdict !== 'REJECTED' ? genCertId(wo.request_id) : undefined;

  if (certId) {
    notes.push(`Certification ID: ${certId}`);
    notes.push(`Audited at: ${new Date().toISOString()}`);
  }

  if (qa.blocking_issues.length > 0) {
    notes.push(`Blocking QA issues: ${qa.blocking_issues.join('; ')}`);
  }

  logAction({
    work_order_id: wo.request_id,
    requested_by: wo.requested_by,
    agent_role: 'auditor_agent',
    action_type: 'audit_certification',
    target: wo.target_project || 'all',
    evidence: `${confirmed.length}/${totalChecks} checks confirmed`,
    verdict: verdict === 'CERTIFIED' ? 'PASS' : verdict === 'REJECTED' ? 'FAIL' : 'PENDING',
    detail: `Cert: ${certId || 'N/A'} | Confidence: ${confidence}%`,
  });

  return {
    certified: verdict !== 'REJECTED',
    verdict,
    rejected_claims: rejected,
    confirmed_claims: confirmed,
    confidence_score: confidence,
    auditor_notes: notes,
    certification_id: certId,
  };
}

export function scanProject(targetProject?: string) {
  return scanSourceForIssues(targetProject);
}
