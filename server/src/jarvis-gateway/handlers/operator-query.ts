/**
 * OPERATOR_QUERY — directive §23. Consumes Health Truth + Operator Control
 * + Evidence only; never synthesizes a false execution claim.
 */
import { operatorControl } from '../services';
import type { JarvisResponse } from '../types';
import { baseResponse } from '../response';

export function handleOperatorQuery(requestId: string, projectId: string | null): JarvisResponse {
  const response = baseResponse(requestId, 'OPERATOR_QUERY', projectId);
  const overview = operatorControl.overview();
  const pending = operatorControl.pending().filter(i => !projectId || i.projectId === projectId);
  const blocked = operatorControl.blocked().filter(i => !projectId || i.projectId === projectId);

  response.answer = [
    `${overview.counts.total} operator item(s) total, ${pending.length} waiting on you, ${blocked.length} blocked.`,
    ...blocked.slice(0, 10).map(i => `- BLOCKED: ${i.title} — ${i.blockedReason}`),
    ...pending.slice(0, 10).map(i => `- WAITING: ${i.title}`),
  ].join('\n');
  response.facts = [
    ...blocked.slice(0, 10).map(i => ({ kind: 'FACT' as const, statement: `"${i.title}" is blocked: ${i.blockedReason}` })),
    ...pending.slice(0, 10).map(i => ({ kind: 'FACT' as const, statement: `"${i.title}" is waiting on operator approval.` })),
  ];
  response.evidenceRefs = [...blocked, ...pending].slice(0, 20).flatMap(i => i.evidenceRefs ?? []);
  return response;
}
