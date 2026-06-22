/**
 * Phase 29 — Business Digital Twin
 * Real-time business graph, simulator, and risk analyzer.
 * CEO sees the business reflected digitally — every store, node, project.
 */

import { getAllEntities } from '../phase25-graph/knowledge-graph';
import { getObservabilityStats } from '../phase26-observability/health-center';
import { getWorkflowStats } from '../phase27-workflows/workflow-runner';

export interface TwinNode {
  id: string;
  type: 'store' | 'project' | 'node' | 'person';
  name: string;
  status: 'healthy' | 'degraded' | 'offline' | 'unknown';
  metrics: Record<string, number | string>;
  last_updated: string;
  risk_score: number;   // 0-100
  risk_factors: string[];
}

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  affected_nodes: string[];
  impact: 'low' | 'medium' | 'high' | 'critical';
  mitigations: string[];
}

export interface RiskReport {
  generated_at: string;
  overall_risk: number;
  nodes: TwinNode[];
  top_risks: { node: string; risk: number; factors: string[] }[];
  recommendations: string[];
}

const TWIN_STATE: Map<string, TwinNode> = new Map();

function buildTwinFromGraph(): void {
  const entities = getAllEntities();
  const obs = getObservabilityStats();
  const wf = getWorkflowStats();

  for (const entity of entities) {
    if (!['store', 'project', 'node', 'person'].includes(entity.type)) continue;

    const existingNode = TWIN_STATE.get(entity.id);
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Base risk by type
    if (entity.type === 'node') {
      if (entity.attributes.role?.includes('PASSIVE')) riskScore += 10;
      if (entity.attributes.role?.includes('ACTIVE')) riskScore += 5;
    }

    // Observability cross-reference
    if (obs.open_incidents > 0 && entity.type === 'project') {
      riskScore += 20;
      riskFactors.push(`${obs.open_incidents} open incident(s)`);
    }

    if (wf.running > 0 && entity.type === 'project') {
      riskScore += 5;
    }

    let status: TwinNode['status'] = existingNode?.status || 'unknown';

    const node: TwinNode = {
      id: entity.id,
      type: entity.type as TwinNode['type'],
      name: entity.name,
      status,
      metrics: { ...entity.attributes },
      last_updated: new Date().toISOString(),
      risk_score: Math.min(100, riskScore),
      risk_factors: riskFactors,
    };
    TWIN_STATE.set(entity.id, node);
  }
}

// Build on first import
buildTwinFromGraph();

export function getTwinState(): TwinNode[] {
  return Array.from(TWIN_STATE.values());
}

export function updateNodeStatus(nodeId: string, status: TwinNode['status'], metrics?: Record<string, number | string>): boolean {
  const node = TWIN_STATE.get(nodeId);
  if (!node) return false;
  node.status = status;
  node.last_updated = new Date().toISOString();
  if (metrics) Object.assign(node.metrics, metrics);
  return true;
}

export function runRiskAnalysis(): RiskReport {
  buildTwinFromGraph();
  const nodes = getTwinState();
  const overall = nodes.length ? Math.round(nodes.reduce((s, n) => s + n.risk_score, 0) / nodes.length) : 0;
  const topRisks = nodes
    .filter(n => n.risk_score > 0)
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 5)
    .map(n => ({ node: n.name, risk: n.risk_score, factors: n.risk_factors }));

  const recommendations: string[] = [];
  if (overall > 50) recommendations.push('Critical: Investigate high-risk nodes immediately');
  if (topRisks.some(r => r.factors.length > 0)) recommendations.push('Review open incidents and resolve before EOD');
  if (overall < 20) recommendations.push('Business is healthy — continue current operations');

  return { generated_at: new Date().toISOString(), overall_risk: overall, nodes, top_risks: topRisks, recommendations };
}

const SCENARIOS: SimulationScenario[] = [
  {
    id: 'scenario.laptop1_down',
    name: 'Laptop1 Failure',
    description: 'Laptop1 (ACTIVE writer) goes offline — WhatsApp gateway, DoorDash, and review automation impacted',
    affected_nodes: ['node.laptop1', 'project.whatsapp_gateway', 'project.doordash', 'project.review_automation'],
    impact: 'critical',
    mitigations: [
      'Promote Laptop2 to ACTIVE writer',
      'Restart WhatsApp gateway on Laptop2',
      'Notify CEO via fallback channel',
      'Monitor for 30 min after failover',
    ],
  },
  {
    id: 'scenario.mi_core_down',
    name: 'Mi-Core Offline',
    description: 'Mi-Core server on PC becomes unavailable — all AI and automation stops',
    affected_nodes: ['node.pc', 'project.mi_core', 'project.dashboard'],
    impact: 'critical',
    mitigations: [
      'Check PM2 process list',
      'Restart mi-core via PM2',
      'Check disk and memory usage on PC',
    ],
  },
  {
    id: 'scenario.store_closure',
    name: 'Store Emergency Closure',
    description: 'A store needs same-day emergency closure (health, safety, or staffing issue)',
    affected_nodes: ['store.stone_oak', 'store.bandera'],
    impact: 'high',
    mitigations: [
      'Update DoorDash store status to closed',
      'Notify staff via WhatsApp',
      'Update POS system',
      'Document incident in knowledge base',
    ],
  },
];

export function getAllScenarios(): SimulationScenario[] { return SCENARIOS; }

export function simulateScenario(scenarioId: string): { scenario: SimulationScenario; impact_analysis: string } | null {
  const scenario = SCENARIOS.find(s => s.id === scenarioId);
  if (!scenario) return null;

  const affected = scenario.affected_nodes.map(id => TWIN_STATE.get(id)?.name || id).join(', ');
  const analysis = `📊 *Simulation: ${scenario.name}*\n\nImpact: *${scenario.impact.toUpperCase()}*\n\nAffected: ${affected}\n\n*Mitigations:*\n${scenario.mitigations.map((m, i) => `${i + 1}. ${m}`).join('\n')}`;
  return { scenario, impact_analysis: analysis };
}

export function formatTwinForWhatsApp(): string {
  const report = runRiskAnalysis();
  const riskEmoji = report.overall_risk > 60 ? '🔴' : report.overall_risk > 30 ? '🟡' : '✅';
  const lines = [
    `${riskEmoji} *Business Digital Twin*`,
    `Overall Risk: ${report.overall_risk}/100`,
    `Entities: ${report.nodes.length}`,
    '',
  ];
  if (report.top_risks.length) {
    lines.push('*Top Risks:*');
    for (const r of report.top_risks.slice(0, 3)) {
      lines.push(`  • ${r.node}: ${r.risk}/100 ${r.factors.length ? '— ' + r.factors[0] : ''}`);
    }
  }
  if (report.recommendations.length) {
    lines.push('');
    lines.push('*Recommendations:*');
    lines.push(report.recommendations[0]);
  }
  return lines.join('\n');
}
