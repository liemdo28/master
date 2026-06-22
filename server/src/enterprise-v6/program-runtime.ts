import fs from 'fs';
import path from 'path';

type Program = 'V4' | 'V5' | 'V6';
type PhaseStatus = 'runtime_partial' | 'package_ready' | 'design_ready' | 'certification_gate' | 'missing_package';

export interface ProgramPhase {
  program: Program;
  phase: string;
  name: string;
  target: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'vision' | 'gate';
  packages: string[];
  status: PhaseStatus;
  production_certified: boolean;
}

const ROOT_CANDIDATES = [
  process.cwd(),
  path.resolve(process.cwd(), '..'),
  path.resolve(__dirname, '..', '..', '..'),
  path.resolve(__dirname, '..', '..', '..', '..'),
];

function findRepoRoot(): string {
  for (const candidate of ROOT_CANDIDATES) {
    if (fs.existsSync(path.join(candidate, 'package.json')) && fs.existsSync(path.join(candidate, 'server'))) {
      return candidate;
    }
  }
  return process.cwd();
}

const repoRoot = findRepoRoot();

function packageExists(file: string): boolean {
  return fs.existsSync(path.join(repoRoot, file));
}

function phaseStatus(packages: string[], fallback: PhaseStatus = 'design_ready'): PhaseStatus {
  if (!packages.length) return 'missing_package';
  return packages.every(packageExists) ? fallback : 'missing_package';
}

const phases: ProgramPhase[] = [
  {
    program: 'V4',
    phase: '37',
    name: 'People Digital Twins',
    target: 'PEOPLE_DIGITAL_TWIN_READY',
    priority: 'gate',
    packages: ['PEOPLE_DIGITAL_TWIN_ENGINE.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V4',
    phase: '43',
    name: 'Executive Negotiation AI',
    target: 'NEGOTIATION_AI_READY',
    priority: 'gate',
    packages: ['EXECUTIVE_NEGOTIATION_AI.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V4',
    phase: '50',
    name: 'Jarvis Omega',
    target: 'JARVIS_OMEGA_READY',
    priority: 'gate',
    packages: ['JARVIS_OMEGA_ACCEPTANCE_TEST.md', 'JARVIS_OMEGA_CERTIFICATION_GATE.md'],
    status: 'certification_gate',
    production_certified: false,
  },
  {
    program: 'V5',
    phase: '51-100',
    name: 'Artificial Enterprise Vision',
    target: 'JARVIS_SINGULARITY_READY',
    priority: 'vision',
    packages: ['MI_PROGRAM_V5_PHASE_51_100_ROADMAP.md'],
    status: 'package_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '51',
    name: 'Enterprise Digital Twin',
    target: 'ENTERPRISE_DIGITAL_TWIN_READY',
    priority: 'P2',
    packages: ['ENTERPRISE_DIGITAL_TWIN_ENGINE.md', 'ENTERPRISE_TWIN_GRAPH.md', 'TWIN_SYNC_ENGINE.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '52',
    name: 'Enterprise Simulation',
    target: 'ENTERPRISE_SIMULATION_READY',
    priority: 'P2',
    packages: ['ENTERPRISE_SIMULATION_ENGINE.md', 'IMPACT_SIMULATION_ENGINE.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '53',
    name: 'CFO AI',
    target: 'CFO_AI_READY',
    priority: 'P0',
    packages: ['CFO_AI_ENGINE.md', 'FINANCIAL_FORECASTING.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '54',
    name: 'Vendor Intelligence',
    target: 'VENDOR_INTELLIGENCE_READY',
    priority: 'vision',
    packages: ['VENDOR_INTELLIGENCE_ENGINE.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '55',
    name: 'Procurement AI',
    target: 'PROCUREMENT_AI_READY',
    priority: 'vision',
    packages: ['PROCUREMENT_AI_ENGINE.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '56',
    name: 'Talent Intelligence',
    target: 'TALENT_INTELLIGENCE_READY',
    priority: 'P0',
    packages: ['TALENT_INTELLIGENCE_ENGINE.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '57',
    name: 'Recruitment AI',
    target: 'RECRUITMENT_AI_READY',
    priority: 'vision',
    packages: ['RECRUITMENT_AI_ENGINE.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '58',
    name: 'Training AI',
    target: 'TRAINING_AI_READY',
    priority: 'vision',
    packages: ['TRAINING_AI_ENGINE.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '59',
    name: 'Knowledge Evolution',
    target: 'KNOWLEDGE_EVOLUTION_READY',
    priority: 'vision',
    packages: ['KNOWLEDGE_EVOLUTION_ENGINE.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '60',
    name: 'Organizational Health',
    target: 'ORG_HEALTH_READY',
    priority: 'P0',
    packages: ['ORGANIZATIONAL_HEALTH_ENGINE.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '61',
    name: 'Strategy Advisor',
    target: 'STRATEGY_ADVISOR_READY',
    priority: 'vision',
    packages: ['STRATEGY_ADVISOR_ENGINE.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '62',
    name: 'Market Intelligence',
    target: 'MARKET_INTELLIGENCE_READY',
    priority: 'P1',
    packages: ['MARKET_INTELLIGENCE_ENGINE.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '63',
    name: 'Competitor Intelligence',
    target: 'COMPETITOR_INTELLIGENCE_READY',
    priority: 'P1',
    packages: ['COMPETITOR_INTELLIGENCE_ENGINE.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '64',
    name: 'Expansion Planning',
    target: 'EXPANSION_PLANNING_READY',
    priority: 'vision',
    packages: ['EXPANSION_PLANNING_ENGINE.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '65',
    name: 'Store Growth Predictor',
    target: 'STORE_GROWTH_READY',
    priority: 'P2',
    packages: ['STORE_GROWTH_PREDICTOR.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '66',
    name: 'Franchise Intelligence',
    target: 'FRANCHISE_INTELLIGENCE_READY',
    priority: 'vision',
    packages: ['FRANCHISE_INTELLIGENCE_ENGINE.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '67',
    name: 'Customer Sentiment',
    target: 'CUSTOMER_SENTIMENT_READY',
    priority: 'P0',
    packages: ['CUSTOMER_SENTIMENT_ENGINE.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '68',
    name: 'Brand Intelligence',
    target: 'BRAND_INTELLIGENCE_READY',
    priority: 'vision',
    packages: ['BRAND_INTELLIGENCE_ENGINE.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '69',
    name: 'Reputation Defense',
    target: 'REPUTATION_DEFENSE_READY',
    priority: 'vision',
    packages: ['REPUTATION_DEFENSE_SYSTEM.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '70',
    name: 'Executive War Room',
    target: 'EXECUTIVE_WAR_ROOM_READY',
    priority: 'P1',
    packages: ['EXECUTIVE_WAR_ROOM.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '74',
    name: 'Corporate Risk Forecasting',
    target: 'CORPORATE_RISK_FORECASTING_READY',
    priority: 'P1',
    packages: ['CORPORATE_RISK_FORECASTING_ENGINE.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '71-80',
    name: 'Executive Decision Lab',
    target: 'EXECUTIVE_DECISION_LAB_READY',
    priority: 'vision',
    packages: ['EXECUTIVE_DECISION_LAB.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '81',
    name: 'Self-Healing Infrastructure',
    target: 'SELF_HEALING_INFRASTRUCTURE_READY',
    priority: 'P0',
    packages: ['SELF_HEALING_INFRASTRUCTURE.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '81-90',
    name: 'Autonomous Enterprise',
    target: 'AUTONOMOUS_ENTERPRISE_READY',
    priority: 'vision',
    packages: ['AUTONOMOUS_ENTERPRISE_ENGINE.md', 'AUTONOMOUS_COMPANY_MANAGEMENT.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '95',
    name: 'CEO Shadow Model',
    target: 'CEO_SHADOW_MODEL_READY',
    priority: 'P2',
    packages: ['CEO_SHADOW_MODEL.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '99',
    name: 'Corporate Guardian',
    target: 'CORPORATE_GUARDIAN_READY',
    priority: 'P0',
    packages: ['CORPORATE_GUARDIAN.md'],
    status: 'design_ready',
    production_certified: false,
  },
  {
    program: 'V6',
    phase: '100',
    name: 'Jarvis Singularity',
    target: 'JARVIS_SINGULARITY_READY',
    priority: 'P3',
    packages: ['JARVIS_SINGULARITY_ARCHITECTURE.md', 'JARVIS_SINGULARITY_ENGINE.md'],
    status: 'certification_gate',
    production_certified: false,
  },
];

function materializePhase(phase: ProgramPhase) {
  const missing_packages = phase.packages.filter(file => !packageExists(file));
  return {
    ...phase,
    status: missing_packages.length ? phaseStatus(phase.packages) : phase.status,
    package_evidence: phase.packages.map(file => ({
      file,
      exists: packageExists(file),
      path: path.join(repoRoot, file),
    })),
    missing_packages,
    ready_for_runtime_build: missing_packages.length === 0 && !phase.production_certified,
  };
}

export function getProgramRuntimeStatus() {
  const phase_status = phases.map(materializePhase);
  const missing = phase_status.flatMap(phase => phase.missing_packages.map(file => ({ phase: phase.phase, file })));
  const priority0 = phase_status.filter(phase => phase.priority === 'P0');

  return {
    status: missing.length ? 'packages_incomplete' : 'packages_ready',
    repo_root: repoRoot,
    totals: {
      tracked_phases: phase_status.length,
      package_ready: phase_status.filter(phase => !phase.missing_packages.length).length,
      missing_packages: missing.length,
      production_certified: phase_status.filter(phase => phase.production_certified).length,
    },
    priority0,
    missing,
    guardrail: 'Production certification requires live runtime evidence, QA, stress test, and CEO acceptance.',
  };
}

export function listProgramPhases(program?: string) {
  return phases
    .filter(phase => !program || phase.program.toLowerCase() === program.toLowerCase())
    .map(materializePhase);
}

export function getProgramPhase(phaseId: string) {
  const phase = phases.find(item => item.phase === phaseId || `${item.program}-${item.phase}`.toLowerCase() === phaseId.toLowerCase());
  return phase ? materializePhase(phase) : null;
}

export function getPriorityPlan(priority: string) {
  return phases
    .filter(phase => phase.priority.toLowerCase() === priority.toLowerCase())
    .map(materializePhase);
}

export function buildOmegaBriefing(input = '') {
  const status = getProgramRuntimeStatus();
  const packageReady = status.missing.length === 0;
  const priority0 = status.priority0.map(phase => ({
    phase: phase.phase,
    name: phase.name,
    target: phase.target,
    package_ready: phase.missing_packages.length === 0,
    production_certified: phase.production_certified,
  }));

  return {
    input,
    answer_mode: 'runtime_guarded_briefing',
    executive_answer: packageReady
      ? 'Anh can uu tien CFO AI, Talent Intelligence, Organizational Health, Customer Sentiment, Self-Healing Infrastructure va Corporate Guardian. Package da san sang de build runtime, nhung chua duoc production-certified vi con thieu live evidence.'
      : 'Em thay con thieu package evidence nen chua the day sang runtime-certification.',
    health: {
      program_packages: packageReady ? 'ready' : 'incomplete',
      missing_packages: status.missing,
    },
    business: {
      highest_roi: ['CFO AI', 'Customer Sentiment', 'Market Intelligence'],
      current_gate: 'read-only advisory runtime before any production mutation',
    },
    projects: {
      v4: 'package_ready_not_certified',
      v5: 'roadmap_ready',
      v6: packageReady ? 'execution_master_ready' : 'package_gap',
    },
    risks: [
      'Production certification is blocked until live runtime evidence exists.',
      'Finance, HR, public reputation, and production mutation must stay approval-gated.',
    ],
    approvals: {
      required_for: ['financial mutation', 'HR action', 'public response', 'production recovery above P3'],
    },
    forecasts: {
      next_runtime_build: 'Priority 0 engines',
      expected_value: 'higher executive visibility, reduced incident response time, better cash and people decisions',
    },
    recommendations: [
      'Build Priority 0 runtime adapters first.',
      'Keep all engines read-only until evidence and approval gates pass.',
      'Use /api/enterprise/program/status as the runtime control plane for V4/V5/V6 package readiness.',
    ],
    priority0,
    guardrail: status.guardrail,
  };
}

