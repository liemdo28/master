/**
 * Graph Execution Context — Phase 14.7
 * Advisory-only enrichment for the Dev3 execution pipeline.
 * Adds ownership, dependency, and impact context to work orders — WITHOUT
 * modifying the existing /api/execution-package contract or any Dev3 engine.
 */

import { getEntity, findEntities } from './graph-db';
import { getOwnership } from './ownership-graph';
import { analyzeImpact, getDependencyTree } from './dependency-intelligence';
import { simulateFailure } from './risk-propagation';
import type { ImpactAnalysis, DependencyTree } from './dependency-intelligence';
import type { OwnershipInfo } from './ownership-graph';
import type { RiskChain } from './risk-propagation';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GraphExecutionContext {
  project_id: string | null;
  project_name: string | null;
  ownership: OwnershipInfo | null;
  dependencies: DependencyTree | null;
  impact: ImpactAnalysis | null;
  risk_chain: Pick<RiskChain, 'blast_radius' | 'overall_risk_score' | 'ceo_alert_required' | 'remediation_steps'> | null;
  advisory: string[];               // human-readable advisory notes for CEO
}

// ── Project resolution ─────────────────────────────────────────────────────────

function resolveProject(targetProject?: string): string | null {
  if (!targetProject) return null;

  // Direct match
  const directId = `project:${targetProject}`;
  if (getEntity(directId)) return directId;

  // Name search
  const matches = findEntities('project', targetProject);
  if (matches.length > 0) return matches[0].id;

  return null;
}

// ── Advisory generation ────────────────────────────────────────────────────────

function buildAdvisory(
  ownership: OwnershipInfo | null,
  impact: ImpactAnalysis | null,
  risk: RiskChain | null,
): string[] {
  const notes: string[] = [];

  if (ownership && !ownership.has_owner) {
    notes.push('⚠️ No owner assigned for this project — escalate to CEO directly');
  }

  if (impact && impact.severity === 'CRITICAL') {
    notes.push(`🚨 This project has CRITICAL impact — ${impact.total_impacted} dependent systems`);
  } else if (impact && impact.severity === 'HIGH') {
    notes.push(`⚠️ HIGH impact entity — ${impact.total_impacted} systems depend on it`);
  }

  if (risk && risk.ceo_alert_required) {
    notes.push(`📣 CEO alert required if this project fails (blast radius: ${risk.blast_radius})`);
  }

  if (impact && impact.directly_impacted.some(d => d.type === 'project')) {
    const projectImpacts = impact.directly_impacted.filter(d => d.type === 'project').map(d => d.name);
    notes.push(`🔗 Directly impacts: ${projectImpacts.join(', ')}`);
  }

  return notes;
}

// ── Main API ──────────────────────────────────────────────────────────────────

export function buildGraphContext(targetProject?: string): GraphExecutionContext {
  const projectId = resolveProject(targetProject);

  if (!projectId) {
    return {
      project_id: null,
      project_name: null,
      ownership: null,
      dependencies: null,
      impact: null,
      risk_chain: null,
      advisory: ['Graph context unavailable: project not found in ownership graph'],
    };
  }

  try {
    const entity = getEntity(projectId)!;
    const ownership = getOwnership(projectId);
    const deps = getDependencyTree(projectId);
    const impact = analyzeImpact(projectId);
    const fullRisk = simulateFailure(projectId, 'OFFLINE');
    const risk = {
      blast_radius: fullRisk.blast_radius,
      overall_risk_score: fullRisk.overall_risk_score,
      ceo_alert_required: fullRisk.ceo_alert_required,
      remediation_steps: fullRisk.remediation_steps,
    };

    return {
      project_id: projectId,
      project_name: entity.name,
      ownership,
      dependencies: deps,
      impact,
      risk_chain: risk,
      advisory: buildAdvisory(ownership, impact, fullRisk),
    };
  } catch {
    return {
      project_id: projectId,
      project_name: getEntity(projectId)?.name || null,
      ownership: null,
      dependencies: null,
      impact: null,
      risk_chain: null,
      advisory: ['Graph context partially unavailable'],
    };
  }
}
