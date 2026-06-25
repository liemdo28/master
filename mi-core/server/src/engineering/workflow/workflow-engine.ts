import { classifyTask } from '../task-classifier';
import { route } from '../routing-engine';
import { createTask } from '../engineering-queue';
import { routeToProvider } from '../providers/provider-router';

export async function runWorkflow(input: string, project = 'mi-core', autoApprove = false) {
  const classification = classifyTask(input);
  const routing = route(classification);
  const task = createTask(input, project, classification, {
    ...routing,
    escalate_human: autoApprove ? false : routing.escalate_human,
  });

  return {
    ok: true,
    task_id: task.id,
    status: task.status,
    project,
    classification,
    routing,
    auto_approve: autoApprove,
  };
}

export async function benchmark(input: string) {
  const start = Date.now();
  const classification = classifyTask(input);
  const routing = route(classification);
  const result = await routeToProvider({
    tier: 'coding',
    prompt: input,
    context: `Task domain: ${classification.domain}. Language: ${classification.language}.`,
  });

  return {
    ok: !result.error,
    recommended_model: routing.selected_model,
    classification,
    result,
    latency_ms: Date.now() - start,
  };
}
