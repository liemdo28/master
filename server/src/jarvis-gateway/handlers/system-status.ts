/**
 * SYSTEM_STATUS — directive §12, §23. Uses the Phase 7B canonical health
 * model exclusively; never jarvis/phase26-observability/health-center.ts
 * (a confirmed, unintegrated duplicate — see PHASE7C_COMPONENT_AUDIT.md §9).
 */
import { getSystemHealth } from '../../health-truth/aggregate';
import type { JarvisResponse } from '../types';
import { baseResponse } from '../response';

export async function handleSystemStatus(requestId: string): Promise<JarvisResponse> {
  const response = baseResponse(requestId, 'SYSTEM_STATUS', null);
  const health = await getSystemHealth();

  const degraded = health.dependencies.filter(d => d.state !== 'HEALTHY' && d.state !== 'INTENTIONALLY_DISABLED');
  const lines = [`Overall: ${health.overall} (${health.overallReason}).`];
  for (const dep of degraded) {
    lines.push(`- ${dep.id}: ${dep.state} — ${dep.detail}`);
  }
  if (degraded.length === 0) lines.push('All monitored dependencies are healthy or intentionally disabled.');

  response.answer = lines.join('\n');
  response.facts = health.dependencies.map(dep => ({ kind: 'FACT' as const, statement: `${dep.id} is ${dep.state} (${dep.reasonCode}).` }));
  response.healthImpact = { overall: health.overall, degradedDependencies: degraded.map(d => d.id) };
  response.degradedCapabilities = degraded.flatMap(d => d.capabilityImpact);
  response.status = health.overall === 'HEALTHY' ? 'ANSWERED' : health.overall === 'BLOCKED' ? 'BLOCKED' : 'DEGRADED';
  return response;
}
