import { search, getStats } from '../knowledge/knowledge-db';
import { scanAllProjects } from '../projects/project-scanner';
import { getAllEntities } from '../jarvis/phase25-graph/knowledge-graph';
import { listSkills } from '../skills/skill-registry';
import { classifyIntent } from '../gstack/intent-router';
import { getActiveWorkOrders } from '../gstack/work-order-engine';

export type OperationalRiskLevel = 'P0' | 'P1' | 'P2' | 'P3';
export type OperationalRole = 'QA_AGENT' | 'RELEASE_AGENT' | 'DEV_AGENT' | 'AUDITOR_AGENT' | 'PM_AGENT' | 'CEO_INTERPRETER';

export interface OperationalSkill {
  id: string;
  name: string;
  category: string;
  reason: string;
  approval_required: boolean;
}

export interface DependencyIntelligence {
  blocked_by: string[];
  depends_on: string[];
  prerequisite_steps: string[];
}

export interface ReadinessScore {
  score: number;
  reasons: string[];
  missing: string[];
}

interface ProjectSeed {
  id: string;
  name: string;
  aliases: string[];
  location: string;
  repository: string;
  services: string[];
  dependencies: string[];
  known_risks: string[];
  owners: string[];
  reports: string[];
  deployment_history: string[];
  qa_history: string[];
  known_issues: string[];
  active_blockers: string[];
}

const PROJECT_SEEDS: ProjectSeed[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    aliases: ['dashboard', 'dashboard_audit', 'bakudan dashboard', 'dashboard.bakudanramen.com'],
    location: 'D:/Project/Master/Bakudan/dashboard.bakudanramen.com',
    repository: 'D:/Project/Master/Bakudan/dashboard.bakudanramen.com',
    services: ['Dashboard web app', 'Dashboard connector', 'QA walkthroughs'],
    dependencies: ['Mi-Core API', 'Review Automation', 'Visibility cache', 'Bakudan project data'],
    known_risks: ['Dashboard depends on Mi-Core availability', 'Review Automation integration can block complete audit evidence'],
    owners: ['Liêm Đỗ', 'Dev3 operating backend', 'QA agent'],
    reports: ['reports/PROJECT_ENCYCLOPEDIA.md', 'reports/KNOWLEDGE_ENTITY_REPORT.md', 'reports/DASHBOARD_CONNECTOR_SYNC_VALIDATION.md'],
    deployment_history: ['Dashboard connector sync reports are indexed in Knowledge Universe'],
    qa_history: ['Dashboard QA connector supports runDashboardQA', 'Previous QA evidence is indexed under dashboard and qa reports'],
    known_issues: ['Check connector cached errors before execution', 'Confirm API/live route health before QA signoff'],
    active_blockers: ['Review Automation dependency must be checked for blocker status'],
  },
  {
    id: 'mi-core',
    name: 'Mi-Core',
    aliases: ['mi-core', 'mi core', 'mi operating backend', 'jarvis'],
    location: 'D:/Project/Master/mi-core',
    repository: 'D:/Project/Master/mi-core',
    services: ['Express API on port 4001', 'Knowledge Universe', 'GStack work orders', 'Jarvis routes'],
    dependencies: ['PostgreSQL/BigData', 'Qdrant optional vector layer', 'WhatsApp Gateway', 'Visibility connectors'],
    known_risks: ['Global rate limiter can affect Dev3 if clients do not back off', 'Dirty workspace requires scoped changes'],
    owners: ['Liêm Đỗ', 'Dev2 knowledge layer', 'Dev3 operating backend'],
    reports: ['reports/KNOWLEDGE_HANDOVER_TO_DEV3.md', 'reports/KNOWLEDGE_UNIVERSE_MASTER_REPORT.md'],
    deployment_history: ['Mi-Core runtime runs locally on PC host port 4001'],
    qa_history: ['Knowledge final audit and master validation reports are indexed'],
    known_issues: ['Some source documents are metadata/path-only when OCR is unavailable'],
    active_blockers: ['External infra health can degrade BigData or vector search'],
  },
  {
    id: 'review-automation',
    name: 'Review Automation',
    aliases: ['review automation', 'review ops', 'review'],
    location: 'D:/Project/Master/Bakudan/Agent-Coding',
    repository: 'D:/Project/Master/Bakudan/Agent-Coding',
    services: ['Review operations proxy', 'Workflow integrations', 'Review QA evidence'],
    dependencies: ['Laptop1', 'Dashboard', 'Agent-Coding app stack'],
    known_risks: ['Laptop1 availability can block review evidence collection'],
    owners: ['Liêm Đỗ', 'QA agent'],
    reports: ['REVIEW_AUTOMATION_BUSINESS_AUDIT.md', 'REVIEW_OPERATIONS_INTEGRATION_PLAN.md'],
    deployment_history: ['Associated with Laptop1 deployment evidence'],
    qa_history: ['Workflow integration tests indexed in Knowledge Universe'],
    known_issues: ['Confirm review proxy route health before attaching as dependency evidence'],
    active_blockers: ['Laptop1 offline status blocks live automation checks'],
  },
  {
    id: 'whatsapp-ai-gateway',
    name: 'WhatsApp AI Gateway',
    aliases: ['whatsapp', 'whatsapp gateway', 'whatsapp-api'],
    location: 'D:/Project/Master/whatsapp-ai-gateway',
    repository: 'D:/Project/Master/whatsapp-ai-gateway',
    services: ['WhatsApp relay', 'CEO command router', 'Message listener'],
    dependencies: ['Mi-Core', 'WhatsApp session storage', 'API key manager'],
    known_risks: ['Session/auth resets can interrupt CEO command ingestion'],
    owners: ['Liêm Đỗ', 'Dev3 operating backend'],
    reports: ['reports/WHATSAPP_REVALIDATION.md', 'reports/REAL_WHATSAPP_E2E_PROOF.md'],
    deployment_history: ['Gateway runtime evidence is indexed in reports'],
    qa_history: ['WhatsApp revalidation and live relay validation reports exist'],
    known_issues: ['Check current session health before using as command source'],
    active_blockers: ['Missing or inactive WhatsApp API keys block approval callbacks'],
  },
];

const OPERATIONAL_SKILLS: OperationalSkill[] = [
  { id: 'github', name: 'GitHub Skill', category: 'source-control', reason: 'Inspect repository state, history, branches, and PR evidence', approval_required: false },
  { id: 'qa', name: 'QA Skill', category: 'quality', reason: 'Run audit, regression, connector, and smoke validation', approval_required: false },
  { id: 'report', name: 'Report Skill', category: 'executive', reason: 'Compile CEO-ready findings and evidence', approval_required: false },
  { id: 'dashboard', name: 'Dashboard Skill', category: 'project', reason: 'Operate Dashboard connector, status, and QA workflow', approval_required: false },
  { id: 'review', name: 'Review Skill', category: 'project', reason: 'Check Review Automation dependency and related blockers', approval_required: false },
  { id: 'quickbooks', name: 'QuickBooks Skill', category: 'finance', reason: 'Resolve finance/accounting data dependencies', approval_required: false },
  { id: 'health', name: 'Health Skill', category: 'observability', reason: 'Classify runtime health, incidents, and service status', approval_required: false },
  { id: 'gmail', name: 'Gmail Skill', category: 'communication', reason: 'Search or send email-backed evidence when requested', approval_required: true },
  { id: 'calendar', name: 'Calendar Skill', category: 'schedule', reason: 'Attach meeting/history context when work order is schedule-bound', approval_required: true },
];

function normalize(text = '') {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function findProject(input: string, targetProject?: string): ProjectSeed {
  const n = normalize(`${input} ${targetProject || ''}`);
  return PROJECT_SEEDS.find(project => project.aliases.some(alias => n.includes(normalize(alias)))) || PROJECT_SEEDS[1];
}

function safeSearch(query: string, limit = 5) {
  try {
    return search(query, limit).map(result => ({
      title: result.title,
      source: result.source,
      category: result.category,
      file_path: result.file_path,
      snippet: result.snippet,
    }));
  } catch {
    return [];
  }
}

export function classifyOperationalRisk(input: string, targetProject?: string): {
  risk_level: OperationalRiskLevel;
  reason: string;
  requires_approval: boolean;
  signals: string[];
} {
  const n = normalize(`${input} ${targetProject || ''}`);
  const signals: string[] = [];

  if (/production|prod|deploy|release|rollback|database migration|payment|payroll/.test(n)) {
    signals.push('Production, rollback, payment, payroll, or database-changing operation');
    return { risk_level: 'P0', reason: 'Can affect production or critical business state', requires_approval: true, signals };
  }

  if (/fix|bug|incident|outage|crash|security|credential|whatsapp|remote|blocker/.test(n)) {
    signals.push('Operational fix, incident, security, remote, or blocker signal');
    return { risk_level: 'P1', reason: 'Can affect execution continuity or security posture', requires_approval: true, signals };
  }

  if (/audit|kiem tra|check|qa|dashboard|review|integration|dependency/.test(n)) {
    signals.push('Audit, QA, dashboard, review, integration, or dependency check');
    return { risk_level: 'P2', reason: 'Operational inspection with possible follow-up actions', requires_approval: false, signals };
  }

  signals.push('Documentation, status, or read-only knowledge request');
  return { risk_level: 'P3', reason: 'Read-only or documentation-level work', requires_approval: false, signals };
}

export function recommendOperationalSkills(input: string, targetProject?: string): OperationalSkill[] {
  const project = findProject(input, targetProject);
  const n = normalize(`${input} ${targetProject || ''} ${project.id}`);
  const chosen = new Map<string, OperationalSkill>();
  const add = (id: string) => {
    const skill = OPERATIONAL_SKILLS.find(s => s.id === id);
    if (skill) chosen.set(id, skill);
  };

  if (/dashboard/.test(n)) add('dashboard');
  if (/review/.test(n) || project.dependencies.some(d => /review/i.test(d))) add('review');
  if (/github|repo|code|source|audit|fix|dashboard|mi-core/.test(n)) add('github');
  if (/qa|audit|kiem tra|check|test|health/.test(n)) add('qa');
  if (/health|incident|risk|blocker|deploy|production|runtime/.test(n)) add('health');
  if (/quickbooks|qb|accounting|finance|payroll/.test(n)) add('quickbooks');
  if (/gmail|email/.test(n)) add('gmail');
  if (/calendar|meeting|schedule/.test(n)) add('calendar');
  add('report');

  return Array.from(chosen.values());
}

export function recommendOperationalRole(input: string, workOrderType?: string): {
  recommended_role: OperationalRole;
  reason: string;
} {
  const n = normalize(`${input} ${workOrderType || ''}`);

  if (/production|prod|deploy|release|rollback/.test(n)) {
    return { recommended_role: 'RELEASE_AGENT', reason: 'Deployment, release, or rollback work requires release ownership' };
  }
  if (/security|credential|permission|compliance|audit.*security/.test(n)) {
    return { recommended_role: 'AUDITOR_AGENT', reason: 'Security/compliance work requires independent audit ownership' };
  }
  if (/fix|bug|code|implement|build|refactor|patch/.test(n)) {
    return { recommended_role: 'DEV_AGENT', reason: 'Code change or bug fix requires developer execution' };
  }
  if (/dashboard|qa|audit|kiem tra|check|test|validation/.test(n)) {
    return { recommended_role: 'QA_AGENT', reason: 'Audit/check/test work should start with QA ownership' };
  }
  if (/report|brief|summary|plan/.test(n)) {
    return { recommended_role: 'PM_AGENT', reason: 'Reporting and planning work should be packaged by product/PM' };
  }

  return { recommended_role: 'CEO_INTERPRETER', reason: 'Intent is unclear; route through interpretation first' };
}

export function getDependencyIntelligence(input: string, targetProject?: string): DependencyIntelligence {
  const project = findProject(input, targetProject);
  const n = normalize(input);
  const isDeploy = /deploy|release|production|prod/.test(n);

  const prerequisite_steps = [
    `Confirm ${project.name} repository is reachable`,
    `Check ${project.name} known issues and active blockers`,
    'Attach latest Knowledge Universe evidence',
  ];

  if (project.id === 'dashboard') {
    prerequisite_steps.push('Verify Review Automation API or evidence path before Dashboard signoff');
    prerequisite_steps.push('Run Dashboard connector health and QA checks');
  }

  if (isDeploy) {
    prerequisite_steps.push('Confirm QA gate is clear before deployment');
    prerequisite_steps.push('Prepare rollback plan and request CEO approval');
  }

  return {
    blocked_by: project.active_blockers,
    depends_on: project.dependencies,
    prerequisite_steps,
  };
}

export function generateSuccessCriteria(input: string, targetProject?: string): string[] {
  const project = findProject(input, targetProject);
  const n = normalize(input);

  if (/deploy|release|production|prod/.test(n)) {
    return [
      `${project.name} deployment target, version, and repository commit are recorded`,
      'Pre-deploy QA gate reports zero P0/P1 open issues',
      'Rollback plan is documented with owner and trigger condition',
      'Post-deploy health check returns passing status for all affected services',
      'CEO approval id is attached before production mutation',
    ];
  }

  if (/fix|bug|code|patch/.test(n)) {
    return [
      'Root cause is identified with source file, log, or evidence reference',
      'Fix scope is limited to the affected component',
      'Regression/build/test command output is attached',
      'No new P0/P1 risk is introduced by the change',
      'Final report lists files changed and verification evidence',
    ];
  }

  if (/security|credential|permission|compliance/.test(n)) {
    return [
      'Security scope and affected assets are listed',
      'Findings are classified by severity with evidence',
      'Credential or permission exposure is confirmed absent or remediated',
      'Required approval is captured before any sensitive change',
      'Audit report includes residual risk and owner',
    ];
  }

  if (/dashboard|audit|kiem tra|check|qa|test|validation/.test(n)) {
    return [
      `${project.name} repository and runtime target are identified`,
      'Previous audit and QA evidence are attached from Knowledge Universe',
      'Active blockers and dependencies are explicitly listed',
      'Dashboard health or connector QA check result is recorded',
      'Final report includes pass/fail findings with severity and next action',
    ];
  }

  return [
    'Target entity and source evidence are identified',
    'Required skills and owner role are selected',
    'Risk level and approval requirement are recorded',
    'Completion evidence is attached to the work order',
  ];
}

function estimateDurationMinutes(input: string, riskLevel: OperationalRiskLevel): number {
  const n = normalize(input);
  if (/deploy|release|production|rollback/.test(n)) return 90;
  if (/security|incident|outage/.test(n)) return 75;
  if (/fix|bug|code|patch/.test(n)) return 60;
  if (/dashboard|audit|qa|kiem tra|check/.test(n)) return 45;
  if (riskLevel === 'P0') return 90;
  if (riskLevel === 'P1') return 60;
  if (riskLevel === 'P2') return 45;
  return 20;
}

function buildWorkflowSteps(input: string, risk: ReturnType<typeof classifyOperationalRisk>, deps: DependencyIntelligence): Array<{
  step_id: string;
  owner_role: OperationalRole;
  action: string;
  approval_required: boolean;
}> {
  const role = recommendOperationalRole(input).recommended_role;
  const steps = [
    { step_id: 'EP1', owner_role: 'CEO_INTERPRETER' as OperationalRole, action: 'Normalize work order intent and target project', approval_required: false },
    { step_id: 'EP2', owner_role: role, action: 'Load project intelligence, repository, dependencies, blockers, and prior evidence', approval_required: false },
    { step_id: 'EP3', owner_role: role, action: deps.prerequisite_steps.join('; '), approval_required: false },
    { step_id: 'EP4', owner_role: role, action: 'Execute read-only health, QA, or source inspection workflow', approval_required: false },
    { step_id: 'EP5', owner_role: 'PM_AGENT' as OperationalRole, action: 'Attach measurable success criteria and produce CEO-ready report', approval_required: false },
  ];

  if (risk.requires_approval) {
    steps.splice(3, 0, {
      step_id: 'APPROVAL',
      owner_role: 'CEO_INTERPRETER' as OperationalRole,
      action: 'Request CEO approval before mutating production, remote systems, credentials, payroll, payment, or database state',
      approval_required: true,
    });
  }

  return steps.map((step, index) => ({ ...step, step_id: step.step_id === 'APPROVAL' ? step.step_id : `EP${index + 1}` }));
}

export function calculateReadinessScore(params: {
  input?: string;
  work_order_type?: string;
  target_project?: string;
}): ReadinessScore {
  const input = params.input || params.work_order_type || '';
  const enriched = enrichWorkOrder(params);
  const deps = getDependencyIntelligence(input, enriched.target_project.id);
  const successCriteria = generateSuccessCriteria(input, enriched.target_project.id);
  const reasons: string[] = [];
  const missing: string[] = [];
  let score = 0;

  if (enriched.knowledge_status.total_docs > 0) { score += 20; reasons.push('Knowledge available'); } else missing.push('Knowledge index has no documents');
  if (enriched.repository) { score += 20; reasons.push('Repo found'); } else missing.push('Repository not resolved');
  if (enriched.required_skills.length > 0) { score += 20; reasons.push('Skills found'); } else missing.push('No required skills found');
  if (enriched.recommended_workflow.length > 0) { score += 15; reasons.push('Workflow known'); } else missing.push('Workflow not generated');
  if (successCriteria.length >= 4) { score += 15; reasons.push('Measurable success criteria generated'); } else missing.push('Success criteria too weak');
  if (deps.depends_on.length > 0) { score += 10; reasons.push('Dependencies known'); } else missing.push('Dependencies not known');

  if (deps.blocked_by.length > 0) {
    score -= Math.min(8, deps.blocked_by.length * 8);
    reasons.push('Known blockers identified and attached');
  }

  return { score: Math.max(0, Math.min(100, score)), reasons, missing };
}

export function generateExecutionPackage(params: {
  input?: string;
  raw_request?: string;
  work_order_type?: string;
  target_project?: string;
}) {
  const input = params.input || params.raw_request || params.work_order_type || '';
  const enriched = enrichWorkOrder(params);
  const role = recommendOperationalRole(input, params.work_order_type || enriched.work_order_type);
  const dependencies = getDependencyIntelligence(input, enriched.target_project.id);
  const successCriteria = generateSuccessCriteria(input, enriched.target_project.id);
  const readiness = calculateReadinessScore({ input, work_order_type: params.work_order_type, target_project: enriched.target_project.id });
  const workflowSteps = buildWorkflowSteps(input, enriched.risk, dependencies);

  return {
    generated_at: new Date().toISOString(),
    input,
    work_order_type: params.work_order_type || enriched.work_order_type,
    target_project: enriched.target_project,
    risk_level: enriched.risk_level,
    required_skills: enriched.required_skills,
    recommended_role: role.recommended_role,
    role_reason: role.reason,
    workflow_steps: workflowSteps,
    estimated_duration: `${estimateDurationMinutes(input, enriched.risk_level)} minutes`,
    estimated_duration_minutes: estimateDurationMinutes(input, enriched.risk_level),
    approval_required: enriched.risk.requires_approval,
    success_criteria: successCriteria,
    dependency_intelligence: dependencies,
    readiness_score: readiness,
    execution_inputs: {
      repository: enriched.repository,
      project_location: enriched.project_location,
      previous_audits: enriched.previous_audits,
      active_blockers: enriched.active_blockers,
      deployment_history: enriched.deployment_history,
      qa_history: enriched.qa_history,
    },
  };
}

export function getProjectIntelligence(projectIdOrQuery?: string) {
  const scanned = scanAllProjects().map(project => ({
    id: project.project_id,
    name: project.name,
    path: project.path,
    repository: project.git_remote || project.path,
    branch: project.git_branch,
    dirty: project.git_dirty,
    services: project.ports.map(port => `http://localhost:${port}`),
    framework: project.framework,
    machine: project.machine,
  }));

  const seeds = PROJECT_SEEDS.map(seed => {
    const scannedMatch = scanned.find(project =>
      normalize(project.name).includes(normalize(seed.id)) ||
      normalize(project.path).includes(normalize(seed.location))
    );
    return {
      ...seed,
      repository: scannedMatch?.repository || seed.repository,
      location: scannedMatch?.path || seed.location,
      scanned_project: scannedMatch || null,
      relationships: {
        project: seed.name,
        repository: scannedMatch?.repository || seed.repository,
        services: seed.services,
        dependencies: seed.dependencies,
        known_risks: seed.known_risks,
        owners: seed.owners,
        reports: seed.reports,
      },
    };
  });

  if (!projectIdOrQuery) return { generated_at: new Date().toISOString(), projects: seeds };
  const target = findProject(projectIdOrQuery);
  return {
    generated_at: new Date().toISOString(),
    project: seeds.find(seed => seed.id === target.id) || target,
    related_evidence: safeSearch(`${target.name} deployment QA blocker audit`, 8),
  };
}

export function getOperationalEntities() {
  const graphEntities = getAllEntities().map(entity => ({
    id: entity.id,
    type: entity.type,
    name: entity.name,
    attributes: entity.attributes,
    source: 'knowledge-graph',
  }));
  const activeWorkOrders = getActiveWorkOrders().map(order => ({
    id: order.request_id,
    type: 'work_order',
    name: order.raw_request,
    attributes: {
      status: order.status,
      priority: order.priority,
      target_project: order.target_project || '',
      assigned_role: order.assigned_role,
    },
    source: 'gstack-work-orders',
  }));
  const seedEntities = PROJECT_SEEDS.flatMap(project => [
    ...project.active_blockers.map((blocker, index) => ({
      id: `blocker.${project.id}.${index + 1}`,
      type: 'blocker',
      name: blocker,
      attributes: { project: project.name, owner: project.owners.join(', ') },
      source: 'operational-seed',
    })),
    ...project.dependencies.map((dependency, index) => ({
      id: `dependency.${project.id}.${index + 1}`,
      type: 'dependency',
      name: dependency,
      attributes: { project: project.name },
      source: 'operational-seed',
    })),
    ...project.known_risks.map((risk, index) => ({
      id: `risk.${project.id}.${index + 1}`,
      type: 'risk',
      name: risk,
      attributes: { project: project.name },
      source: 'operational-seed',
    })),
  ]);

  return {
    generated_at: new Date().toISOString(),
    supported_types: ['work_order', 'blocker', 'deployment', 'certification', 'release', 'incident', 'risk', 'dependency'],
    entities: [...graphEntities, ...activeWorkOrders, ...seedEntities],
  };
}

export function getOperationalMemoryIndex(query?: string) {
  const q = query?.trim() || 'incident fix audit deployment QA blocker';
  return {
    generated_at: new Date().toISOString(),
    query: q,
    tracks: ['previous_incidents', 'previous_fixes', 'previous_audits', 'previous_deployments'],
    matches: safeSearch(q, 10),
  };
}

export function enrichWorkOrder(params: {
  input?: string;
  raw_request?: string;
  work_order_type?: string;
  target_project?: string;
}) {
  const input = params.input || params.raw_request || params.work_order_type || '';
  const intent = classifyIntent(input);
  const project = findProject(input, params.target_project || intent.target_project);
  const risk = classifyOperationalRisk(`${input} ${params.work_order_type || ''}`, project.id);
  const requiredSkills = recommendOperationalSkills(`${input} ${params.work_order_type || ''}`, project.id);
  const evidence = safeSearch(`${project.name} ${input} audit blocker deployment QA`, 8);
  const stats = getStats();

  return {
    enriched_at: new Date().toISOString(),
    input,
    work_order_type: params.work_order_type || intent.intent,
    target_project: {
      id: project.id,
      name: project.name,
      location: project.location,
      repository: project.repository,
      owners: project.owners,
    },
    repository: project.repository,
    project_location: project.location,
    known_issues: project.known_issues,
    active_blockers: project.active_blockers,
    previous_audits: evidence.filter(item => /audit|qa|validation|report/i.test(`${item.title} ${item.file_path}`)).slice(0, 5),
    deployment_history: project.deployment_history,
    qa_history: project.qa_history,
    dependencies: project.dependencies,
    required_skills: requiredSkills,
    risk_level: risk.risk_level,
    risk,
    recommended_workflow: [
      'Resolve target project and repository from Project Intelligence Graph',
      'Attach previous audits, QA evidence, blockers, deployment history, and dependencies',
      'Run read-only health and connector checks first',
      risk.requires_approval ? 'Request CEO approval before production, remote, or mutating actions' : 'Proceed with audit/QA workflow without production mutation',
      'Return evidence-backed report to Dev3 and CEO',
    ],
    evidence,
    knowledge_status: {
      total_docs: stats.total_docs || 0,
      source: 'Knowledge Universe local index',
    },
    available_runtime_skills: listSkills(),
  };
}
