/**
 * Risk Propagation Engine — Phase 14.5
 * Models cascading failure scenarios through the dependency graph.
 * Example: Mi-Core offline → Review Automation degraded → Dashboard degraded → CEO alert
 */

import { getEntity, getInEdges, getAllEntities, type Entity } from './graph-db';
import { analyzeImpact } from './dependency-intelligence';

// ── Types ──────────────────────────────────────────────────────────────────────

export type PropagationSeverity = 'DEGRADED' | 'IMPAIRED' | 'OFFLINE' | 'UNKNOWN';

export interface PropagationStep {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  severity: PropagationSeverity;
  reason: string;
  depth: number;
}

export interface RiskChain {
  origin_id: string;
  origin_name: string;
  failure_scenario: string;
  propagation_steps: PropagationStep[];
  blast_radius: number;          // total entities affected
  max_severity: PropagationSeverity;
  overall_risk_score: number;    // 0-100
  ceo_alert_required: boolean;
  alert_message: string;
  remediation_steps: string[];
}

export interface SystemRiskReport {
  generated_at: string;
  spof_entities: Array<{ id: string; name: string; risk_score: number }>;
  highest_risk_entity: string;
  total_risk_surface: number;    // sum of all impact scores
  critical_chains: RiskChain[];
  recommendations: string[];
}

// ── Severity computation ───────────────────────────────────────────────────────

function propagateSeverity(triggerSeverity: PropagationSeverity, weight: number): PropagationSeverity {
  const ORDER: PropagationSeverity[] = ['DEGRADED', 'IMPAIRED', 'OFFLINE', 'UNKNOWN'];
  const idx = ORDER.indexOf(triggerSeverity);

  if (weight >= 9) return triggerSeverity;                    // full propagation
  if (weight >= 7) return ORDER[Math.max(0, idx - 1)] as PropagationSeverity;  // one step down
  return 'DEGRADED';                                          // low weight → just degraded
}

// ── Risk chain traversal ───────────────────────────────────────────────────────

function buildRiskChain(
  entityId: string,
  triggerSeverity: PropagationSeverity,
  visited = new Set<string>(),
  depth = 0,
  maxDepth = 6,
): PropagationStep[] {
  if (depth >= maxDepth || visited.has(entityId)) return [];
  visited.add(entityId);

  const inEdges = getInEdges(entityId, 'depends_on');
  const steps: PropagationStep[] = [];

  for (const edge of inEdges) {
    const dependent = getEntity(edge.from_id);
    if (!dependent || visited.has(edge.from_id)) continue;

    const stepSeverity = propagateSeverity(triggerSeverity, edge.weight);
    steps.push({
      entity_id: edge.from_id,
      entity_name: dependent.name,
      entity_type: dependent.type,
      severity: stepSeverity,
      reason: `Depends on ${getEntity(entityId)?.name} (weight: ${edge.weight}/10)`,
      depth,
    });

    steps.push(...buildRiskChain(edge.from_id, stepSeverity, visited, depth + 1, maxDepth));
  }

  return steps;
}

function severityScore(s: PropagationSeverity): number {
  return { DEGRADED: 25, IMPAIRED: 50, OFFLINE: 90, UNKNOWN: 10 }[s] || 10;
}

// ── Alert logic ────────────────────────────────────────────────────────────────

function requiresCeoAlert(chain: PropagationStep[]): boolean {
  return chain.some(s => s.severity === 'OFFLINE' || s.severity === 'IMPAIRED') ||
    chain.filter(s => s.entity_type === 'project').length >= 3;
}

function buildAlertMessage(originName: string, chain: PropagationStep[]): string {
  const offline = chain.filter(s => s.severity === 'OFFLINE').map(s => s.entity_name);
  const impaired = chain.filter(s => s.severity === 'IMPAIRED').map(s => s.entity_name);
  const parts = [`🚨 [CASCADE ALERT] ${originName} failure detected.`];
  if (offline.length) parts.push(`OFFLINE: ${offline.join(', ')}`);
  if (impaired.length) parts.push(`IMPAIRED: ${impaired.join(', ')}`);
  parts.push(`Total impact: ${chain.length} system(s).`);
  return parts.join(' | ');
}

function buildRemediation(originId: string, chain: PropagationStep[]): string[] {
  const steps: string[] = [];
  steps.push(`1. Xác nhận trạng thái ${getEntity(originId)?.name} qua PM2 status`);
  steps.push(`2. Kiểm tra logs: pm2 logs ${originId.split(':')[1]} --lines 50`);
  if (chain.some(s => s.severity === 'OFFLINE')) {
    steps.push(`3. Khởi động lại service: pm2 restart ${originId.split(':')[1]}`);
    steps.push(`4. Chạy health check sau khi restart`);
  }
  steps.push(`5. Chạy regression suite để verify hệ thống ổn định`);
  steps.push(`6. Báo cáo CEO nếu downtime > 2 phút`);
  return steps;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function simulateFailure(entityId: string, severity: PropagationSeverity = 'OFFLINE'): RiskChain {
  const entity = getEntity(entityId);
  if (!entity) throw new Error(`Entity not found: ${entityId}`);

  const chain = buildRiskChain(entityId, severity, new Set([entityId]));

  const maxSev: PropagationSeverity = chain.reduce<PropagationSeverity>((max, step) => {
    const scores = { UNKNOWN: 0, DEGRADED: 1, IMPAIRED: 2, OFFLINE: 3 };
    return scores[step.severity] > scores[max] ? step.severity : max;
  }, 'DEGRADED');

  const overallScore = Math.min(100, chain.length * 8 +
    chain.reduce((s, step) => s + severityScore(step.severity), 0) / (chain.length || 1));

  return {
    origin_id: entityId,
    origin_name: entity.name,
    failure_scenario: `${entity.name} goes ${severity}`,
    propagation_steps: chain,
    blast_radius: chain.length,
    max_severity: maxSev,
    overall_risk_score: Math.round(overallScore),
    ceo_alert_required: requiresCeoAlert(chain),
    alert_message: buildAlertMessage(entity.name, chain),
    remediation_steps: buildRemediation(entityId, chain),
  };
}

export function generateSystemRiskReport(): SystemRiskReport {
  const entities = getAllEntities().filter(e => !['owner', 'team', 'repository'].includes(e.type));
  const chains: RiskChain[] = [];
  const spofs: Array<{ id: string; name: string; risk_score: number }> = [];

  for (const entity of entities) {
    const inDeps = getInEdges(entity.id, 'depends_on');
    if (inDeps.length === 0) continue; // nothing depends on it

    const chain = simulateFailure(entity.id, 'OFFLINE');
    if (chain.blast_radius >= 2) chains.push(chain);

    const highWeight = inDeps.filter(e => e.weight >= 8);
    if (highWeight.length >= 2) {
      spofs.push({ id: entity.id, name: entity.name, risk_score: chain.overall_risk_score });
    }
  }

  chains.sort((a, b) => b.overall_risk_score - a.overall_risk_score);
  spofs.sort((a, b) => b.risk_score - a.risk_score);

  const totalRisk = chains.reduce((s, c) => s + c.overall_risk_score, 0);

  return {
    generated_at: new Date().toISOString(),
    spof_entities: spofs,
    highest_risk_entity: chains[0]?.origin_name || 'None',
    total_risk_surface: totalRisk,
    critical_chains: chains.slice(0, 5),
    recommendations: [
      'Add redundancy for SPOF services (especially mi-core)',
      'Implement circuit breaker pattern for Dashboard → Mi-Core dependency',
      'Set up PM2 auto-restart with health check for WhatsApp Gateway',
      'Create failover store for Skills Registry JSON',
      'Configure CEO WhatsApp alert when mi-core restarts unexpectedly',
    ],
  };
}
