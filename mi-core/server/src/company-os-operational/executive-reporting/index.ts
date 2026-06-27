import { buildCommandCenterSnapshot } from '../command-center';
import { buildCrossDivisionCoordinationReport } from '../coordination-engine';
import type { ExecutiveQuestionAnswer, ExecutiveReport } from '../types';

function uniq(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

export function buildExecutiveReport(period: 'daily' | 'weekly' | 'incident' = 'daily'): ExecutiveReport {
  const command = buildCommandCenterSnapshot();
  const coordination = buildCrossDivisionCoordinationReport();
  const blocked = uniq([
    ...command.truthBlockers,
    coordination.orphanTasks > 0 ? `${coordination.orphanTasks} orphan tasks need owner cleanup` : '',
    coordination.conflictingOwners > 0 ? `${coordination.conflictingOwners} coordination conflicts need review` : '',
  ]);

  const revenueRisks = uniq([
    ...command.finance.risk,
    'No live POS/QB revenue certification for operational revenue claim.',
  ]);

  return {
    id: `EXR-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    period,
    whatHappened: [
      'Phase 10 execution loop can create objectives, route tasks, request approvals, collect evidence, and report status.',
      `Command center generated with status ${command.status}.`,
      `Coordination scan covered ${Object.keys(coordination.ownerCoverage).length} owners.`,
    ],
    blocked,
    lateProjects: blocked.length > 0 ? ['Live connector certification', 'Production approval evidence'] : [],
    overloadedDivisions: Object.entries(coordination.ownerCoverage)
      .filter(([, count]) => count >= 5)
      .map(([owner]) => owner),
    revenueRisks,
    unhealthySystems: command.truthBlockers,
    ceoFocus: [
      'Restore and certify QuickBooks/live revenue sync.',
      'Approve or reject pending marketing, website, DoorDash, and credential-use actions.',
      'Connect missing GSC/GA4/GBP/Toast/DoorDash evidence sources before operational promotion.',
    ],
    status: blocked.length === 0 ? 'MI_COMPANY_OS_OPERATIONAL' : 'MI_COMPANY_OS_PARTIAL',
  };
}

export function answerExecutiveQuestion(question: string): ExecutiveQuestionAnswer {
  const q = question.toLowerCase();
  const report = buildExecutiveReport('daily');

  if (/what happened|today|hôm nay/.test(q)) {
    return {
      question,
      answer: report.whatHappened.join(' '),
      confidence: 0.82,
      evidence: ['executive-report.whatHappened', 'command-center.snapshot'],
      warnings: report.status === 'MI_COMPANY_OS_PARTIAL' ? ['Live source certification gaps remain.'] : [],
    };
  }

  if (/blocked|late|trễ|kẹt/.test(q)) {
    return {
      question,
      answer: report.blocked.length > 0 ? report.blocked.join(' ') : 'No blockers in local coordination proof.',
      confidence: 0.78,
      evidence: ['coordination-report', 'command-center.truthBlockers'],
      warnings: [],
    };
  }

  if (/revenue|risk|doanh thu/.test(q)) {
    return {
      question,
      answer: report.revenueRisks.join(' '),
      confidence: 0.62,
      evidence: ['finance panel', 'data platform source health'],
      warnings: ['Revenue answer is not fresh live QB/POS truth until connectors are certified.'],
    };
  }

  if (/systems|unhealthy|health|down/.test(q)) {
    return {
      question,
      answer: report.unhealthySystems.join(' '),
      confidence: 0.74,
      evidence: ['it dashboard', 'command-center.truthBlockers'],
      warnings: [],
    };
  }

  if (/focus|ceo|priority/.test(q)) {
    return {
      question,
      answer: report.ceoFocus.join(' '),
      confidence: 0.8,
      evidence: ['executive-report.ceoFocus'],
      warnings: [],
    };
  }

  return {
    question,
    answer: 'Mi can answer today status, blockers, late projects, overloaded divisions, revenue risks, unhealthy systems, and CEO focus from the Phase 10 report.',
    confidence: 0.65,
    evidence: ['phase10.executive-reporting'],
    warnings: report.status === 'MI_COMPANY_OS_PARTIAL' ? ['Some live evidence sources remain blocked.'] : [],
  };
}

export function buildQuestionEngineProof() {
  const questions = [
    'What happened today?',
    'What is blocked?',
    'Which projects are late?',
    'What revenue risks exist?',
    'What systems are unhealthy?',
    'What should CEO focus on?',
  ];
  const answers = questions.map(answerExecutiveQuestion);
  return {
    questions: answers.length,
    answered: answers.filter(a => a.answer.length > 0).length,
    averageConfidence: answers.reduce((sum, a) => sum + a.confidence, 0) / answers.length,
    answers,
  };
}
