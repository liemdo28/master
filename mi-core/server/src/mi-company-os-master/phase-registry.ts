import type { MasterPhase, MasterStatusDashboard, MasterPhaseStatus } from './types';

export const MASTER_PHASES: MasterPhase[] = [
  {
    phase: '0',
    name: 'Executive Coordination',
    status: 'OPERATIONAL',
    deliverables: ['Objective Registry', 'Task Registry', 'Ownership Engine', 'Approval Registry', 'Evidence Registry', 'Dashboard'],
    evidence: ['reports/PHASE_0_FINAL_REPORT.md', 'tests/phase0-runtime-test.mjs'],
    blockers: [],
    nextActions: ['Keep as prerequisite for all divisions.'],
  },
  {
    phase: '0.5',
    name: 'Open Source Governance',
    status: 'OPERATIONAL',
    deliverables: ['OSS Registry', 'OSS Scorecard', 'OSS Lifecycle Engine', 'OSS Dashboard'],
    evidence: ['reports/PHASE_0_5_OPEN_SOURCE_GOVERNANCE_FINAL_REPORT.md', 'tests/phase05-oss-governance-runtime-test.mjs'],
    blockers: ['External license audits still unverified per-project.'],
    nextActions: ['Run live license and security audits before Pilot/Production for any OSS project.'],
  },
  {
    phase: '0.6',
    name: 'Technology Portfolio Office',
    status: 'OPERATIONAL',
    deliverables: ['Portfolio Registry', 'Portfolio Scorecard', 'Portfolio Dashboard'],
    evidence: ['tests/phase06-technology-portfolio-runtime-test.mjs'],
    blockers: ['Approval evidence missing for approval-required portfolio items.'],
    nextActions: ['Record approval decisions for GitHub, QuickBooks, Engineering Division, and Operator Runtime.'],
  },
  {
    phase: '1',
    name: 'Engineering Division',
    status: 'PARTIAL',
    deliverables: ['Routing', 'Review', 'Tests', 'PR metadata', 'Evidence', 'Approval Gate'],
    evidence: ['reports/PHASE_1_ENGINEERING_FINAL_REPORT.md', 'PHASE_1B_ENGINEERING_OPERATIONAL_REPORT.md', 'tests/phase1-engineering-runtime-test.mjs'],
    blockers: ['No autonomous provider executor generates real implementation branch/commit/PR inside certification flow.'],
    nextActions: ['Build Phase 1C provider executor adapter.'],
  },
  {
    phase: '1C',
    name: 'Provider Executor Adapter',
    status: 'PARTIAL',
    deliverables: ['Qwen executor', 'DeepSeek executor', 'Kimi executor', 'Patch generation', 'Sandboxed test run'],
    evidence: ['ENGINEERING_LIVE_EXECUTION_PROOF.md', 'tests/phase1c-provider-executor-runtime-test.mjs'],
    blockers: ['Kimi has no approved local model mapping.', 'Live patch generation is safety-gated and not yet approved inside certification.', 'Generated patches are not yet applied in a sandboxed branch/test loop.'],
    nextActions: ['Run approved Qwen patch generation on a low-risk task with ENGINEERING_ALLOW_LIVE_MODEL_EXECUTION=1.', 'Add sandbox patch apply/test/revert loop.'],
  },
  {
    phase: '2',
    name: 'Computer Operator Foundation',
    status: 'READY',
    deliverables: ['Playwright', 'Browser Use', 'Windows Helper'],
    evidence: ['server/src/operator-runtime'],
    blockers: ['Needs live browser certification.'],
    nextActions: ['Run Phase 2B live execution tests.'],
  },
  {
    phase: '2A',
    name: 'Operator Runtime MVP',
    status: 'OPERATIONAL',
    deliverables: ['Operator runtime skeleton', 'Telemetry surface'],
    evidence: ['server/src/operator-runtime', 'tests/phase2b-operator-live-runtime-test.mjs'],
    blockers: [],
    nextActions: ['Keep production SaaS targets gated behind policy and human approval.'],
  },
  {
    phase: '2B',
    name: 'Operator Live Execution',
    status: 'OPERATIONAL',
    deliverables: ['Browser control', 'Form submit', 'Download', 'Crawl', 'Telemetry'],
    evidence: ['tests/phase2b-operator-live-runtime-test.mjs', 'reports/PHASE_2B_OPERATOR_LIVE_EXECUTION_REPORT.md'],
    blockers: [],
    nextActions: ['Do not use production SaaS targets without explicit approval and credential-safe workflow.'],
  },
  {
    phase: '3B',
    name: 'Financial Intelligence',
    status: 'PARTIAL',
    deliverables: ['Revenue Engine', 'Store Ranking', 'Source Health', 'Risk Engine', 'Question Engine'],
    evidence: ['tests/phase3b-financial-intelligence-runtime-test.mjs', 'reports/PHASE_3B_FINANCIAL_INTELLIGENCE_REPORT.md'],
    blockers: ['QuickBooks source is degraded and not certified.', 'Live revenue is not fresh enough to claim operational financial truth.'],
    nextActions: ['Restore/certify QB sync from Laptop1, then rerun Phase 3B against fresh live source evidence.'],
  },
  {
    phase: '4',
    name: 'Marketing Foundation',
    status: 'PARTIAL',
    deliverables: ['Brand Intelligence', 'Campaign Intelligence', 'Content Factory', 'Marketing Questions'],
    evidence: ['tests/phase4-marketing-foundation-runtime-test.mjs', 'reports/PHASE_4_MARKETING_FOUNDATION_REPORT.md'],
    blockers: ['GBP credentials missing for active brands.', 'Campaigns are not publish-ready without approval and live connector proof.'],
    nextActions: ['Connect/certify GBP/social publishing credentials, then run approval-gated live campaign proof.'],
  },
  {
    phase: '4A',
    name: 'Marketing Intelligence',
    status: 'PARTIAL',
    deliverables: ['Channel Health', 'Opportunity Engine', 'Recommendation Engine', 'Marketing Question Engine'],
    evidence: ['tests/phase4a-marketing-intelligence-runtime-test.mjs', 'reports/PHASE_4A_MARKETING_INTELLIGENCE_REPORT.md'],
    blockers: ['GBP credentials missing for active brands.', 'Campaign launch remains approval-gated.', 'Live publishing and live performance metrics are not certified.'],
    nextActions: ['Connect/certify GBP and publishing credentials, then run approval-gated live campaign launch proof with real metrics.'],
  },
  {
    phase: '5',
    name: 'IT Operations',
    status: 'NOT_STARTED',
    deliverables: ['Service Health', 'PM2', 'Docker', 'Logs', 'Backups'],
    evidence: [],
    blockers: ['No dedicated IT Operations division runtime certification.'],
    nextActions: ['Create service health registry and PM2/log backup dashboard.'],
  },
  {
    phase: '6',
    name: 'Creative Division',
    status: 'NOT_STARTED',
    deliverables: ['Video', 'Image', 'Design', 'Content Assets'],
    evidence: [],
    blockers: ['No creative asset governance/runtime certification.'],
    nextActions: ['Create creative asset registry and approval-gated generation workflow.'],
  },
  {
    phase: '7',
    name: 'Company Data Platform',
    status: 'FUTURE',
    deliverables: ['Finance data', 'Marketing data', 'Operations data', 'Reviews', 'QB', 'Toast', 'DoorDash'],
    evidence: [],
    blockers: ['Source divisions not fully certified.'],
    nextActions: ['Start after Finance/Marketing/Operator foundations are certified.'],
  },
  {
    phase: '8',
    name: 'Company Intelligence',
    status: 'FUTURE',
    deliverables: ['Cross-division reasoning'],
    evidence: [],
    blockers: ['Company Data Platform not operational.'],
    nextActions: ['Start after Phase 7.'],
  },
  {
    phase: '9',
    name: 'Company Autonomy',
    status: 'FUTURE',
    deliverables: ['Automatic objective creation'],
    evidence: [],
    blockers: ['Company Intelligence not operational.'],
    nextActions: ['Start after Phase 8.'],
  },
  {
    phase: '10',
    name: 'MI_COMPANY_OS_OPERATIONAL',
    status: 'FUTURE',
    deliverables: ['Coordinate', 'Execute', 'Observe', 'Reason', 'Report', 'Improve'],
    evidence: [],
    blockers: ['Phases 1C through 9 are not all operational.'],
    nextActions: ['Promote only when every preceding phase has runtime evidence.'],
  },
];

const buildOrder = ['1C', '2B', '3B', '4', '4A', '5', '6', '7', '8', '9', '10'];

export function getMasterPhases(): MasterPhase[] {
  return MASTER_PHASES;
}

export function buildMasterStatusDashboard(): MasterStatusDashboard {
  const summary = MASTER_PHASES.reduce((acc, phase) => {
    acc[phase.status] = (acc[phase.status] || 0) + 1;
    return acc;
  }, {} as Record<MasterPhaseStatus, number>);
  const allOperational = MASTER_PHASES.every((phase) => phase.status === 'OPERATIONAL');
  return {
    generatedAt: new Date().toISOString(),
    phases: MASTER_PHASES,
    summary,
    nextBuildOrder: buildOrder,
    finalStatus: allOperational ? 'MI_COMPANY_OS_OPERATIONAL' : 'MI_COMPANY_OS_PARTIAL',
  };
}
