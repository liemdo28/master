import type { EngineeringEvidence, EngineeringTask, EvidenceType, ProviderResult, TestRunResult } from './types';

export function createEvidence(type: EvidenceType, value: string): EngineeringEvidence {
  return { type, value, capturedAt: new Date().toISOString() };
}

export function evidenceFromProvider(result: ProviderResult): EngineeringEvidence[] {
  const evidence: EngineeringEvidence[] = [createEvidence('log', result.summary)];
  if (result.branch) evidence.push(createEvidence('branch', result.branch));
  if (result.commit) evidence.push(createEvidence('commit', result.commit));
  if (result.pr) evidence.push(createEvidence('pr', result.pr));
  return evidence;
}

export function evidenceFromTests(result: TestRunResult): EngineeringEvidence {
  return createEvidence('test-output', `${result.command}: ${result.passed}/${result.tests} passed, ${result.failed} failed`);
}

export function hasRequiredCloseEvidence(task: EngineeringTask): boolean {
  const types = new Set(task.evidence.map((e) => e.type));
  return types.has('branch') && types.has('commit') && types.has('pr') && types.has('test-output');
}
