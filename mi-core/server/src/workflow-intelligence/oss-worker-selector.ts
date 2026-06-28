/**
 * oss-worker-selector.ts (workflow-intelligence) — pick an OSS worker for a step.
 *
 * Bridges the semantic router to the OSS runtime layer (Part A1): given a domain
 * it chooses the governed OSS worker, returning its live health + fallback so the
 * workflow can run on OSS when present or degrade safely.
 */
import { selectWorkerByRole, selectWorkerForPhase, type WorkerSelection } from '../oss-runtime';

const DOMAIN_TO_ROLE: Record<string, string> = {
  revenue: 'analytics',
  marketing: 'analytics',
  operations: 'monitoring',
  cx: 'conversation',
  cost: 'procurement',
  hr: 'hr',
  creative: 'creative',
  data: 'catalog',
  security: 'identity',
};

export interface StepWorker {
  domain: string;
  workerName: string | null;
  status: string | null;
  fallbackTo: string | null;
  ranOnOss: boolean;
}

export function selectOssWorkerForDomain(domain: string): StepWorker {
  const roleKeyword = DOMAIN_TO_ROLE[domain];
  let sel: WorkerSelection | null = roleKeyword ? selectWorkerByRole(roleKeyword) : null;
  // Fallback: map common domains to a concrete phase worker if role match misses.
  if (!sel) {
    const domainPhase: Record<string, number> = { revenue: 22, marketing: 22, operations: 23, cx: 21, cost: 24, hr: 25, creative: 26, data: 29, security: 27 };
    const phase = domainPhase[domain];
    if (phase) sel = selectWorkerForPhase(phase);
  }
  if (!sel) return { domain, workerName: null, status: null, fallbackTo: null, ranOnOss: false };
  const exec = sel.adapter.execute({ domain });
  return { domain, workerName: sel.worker.name, status: sel.status, fallbackTo: sel.fallbackTo, ranOnOss: exec.ranOnOss };
}
