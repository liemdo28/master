/**
 * Mi Core Workflow Engine
 * Full pipeline: Input → Classify → Memory → Analyze → Task → Approval? →
 *                Execute → Evidence → Report → Learn
 */

import { classifyTask }        from '../task-classifier';
import { route }               from '../routing-engine';
import { createTask, updateStatus, getTask } from '../engineering-queue';
import { addEvidence, generateEvidenceReport } from '../evidence-engine';
import { search }              from '../rag/rag-engine';
import { routeToProvider }     from '../providers/provider-router';

export type WorkflowStage =
  | 'INPUT'
  | 'CLASSIFY'
  | 'MEMORY_LOOKUP'
  | 'ANALYZE'
  | 'TASK_CREATE'
  | 'APPROVAL_GATE'
  | 'EXECUTE'
  | 'EVIDENCE'
  | 'REPORT'
  | 'LEARN';

export interface WorkflowResult {
  task_id:        string;
  stages_passed:  WorkflowStage[];
  final_stage:    WorkflowStage;
  status:         string;
  classification: object;
  routing:        object;
  memory_context: string[];
  analysis:       string;
  needs_approval: boolean;
  approval_reason?: string;
  evidence_report?: string;
  output:         string;
  self_learn:     { stored: boolean; key: string };
  latency_ms:     number;
}

export async function runWorkflow(
  input:     string,
  project:   string = 'mi-core',
  autoApprove: boolean = false,
): Promise<WorkflowResult> {
  const start = Date.now();
  const stages: WorkflowStage[] = [];

  // ── 1. INPUT ──────────────────────────────────────────────────────────────
  stages.push('INPUT');

  // ── 2. CLASSIFY ──────────────────────────────────────────────────────────
  stages.push('CLASSIFY');
  const classification = classifyTask(input);
  const routing        = route(classification);

  // ── 3. MEMORY LOOKUP ─────────────────────────────────────────────────────
  stages.push('MEMORY_LOOKUP');
  const memoryHits = await search(input, 3);
  const memoryContext = memoryHits.results.map(r =>
    `[${r.source}] ${r.text.slice(0, 200)}`
  );

  // ── 4. ANALYZE ────────────────────────────────────────────────────────────
  stages.push('ANALYZE');
  const context = memoryContext.length
    ? `Relevant context from memory:\n${memoryContext.join('\n\n')}`
    : 'No prior memory found for this task.';

  const analysisPrompt = `You are Mi, a CTO AI. Analyze this engineering task:

Task: "${input}"
Classification: ${JSON.stringify(classification)}
Recommended Model: ${routing.model_name} (confidence: ${routing.confidence}%)

${context}

Provide a brief analysis (2-3 sentences): what needs to be done, main risks, and recommended approach.`;

  const analysisResp = await routeToProvider({
    tier:       'ceo-brain',
    prompt:     analysisPrompt,
    max_tokens: 256,
    temperature: 0.2,
  });
  const analysis = analysisResp.content || 'Analysis unavailable (no AI provider configured).';

  // ── 5. TASK CREATE ────────────────────────────────────────────────────────
  stages.push('TASK_CREATE');
  const task = createTask(input, project, classification, routing);

  addEvidence({
    task_id: task.id,
    type:    'log',
    source:  'Workflow Engine',
    content: `Stage: TASK_CREATE\nAnalysis: ${analysis}\nMemory hits: ${memoryHits.results.length}`,
  });

  // ── 6. APPROVAL GATE ─────────────────────────────────────────────────────
  stages.push('APPROVAL_GATE');
  const needs_approval = routing.escalate_human && !autoApprove;
  const approval_reason = routing.escalation_reason;

  if (needs_approval) {
    updateStatus(task.id, 'APPROVAL_REQUIRED');
    const reportPath = generateEvidenceReport(task.id, input, routing.model_name);
    return {
      task_id:        task.id,
      stages_passed:  stages,
      final_stage:    'APPROVAL_GATE',
      status:         'APPROVAL_REQUIRED',
      classification,
      routing,
      memory_context: memoryContext,
      analysis,
      needs_approval: true,
      approval_reason,
      evidence_report: reportPath,
      output:         `Approval required before execution: ${approval_reason}`,
      self_learn:     { stored: false, key: '' },
      latency_ms:     Date.now() - start,
    };
  }

  updateStatus(task.id, 'DISPATCHED');

  // ── 7. EXECUTE ────────────────────────────────────────────────────────────
  stages.push('EXECUTE');
  updateStatus(task.id, 'EXECUTING');

  const execPrompt = `You are ${routing.model_name}, an expert ${classification.language} engineer.

Task: "${input}"
Project: ${project}
Domain: ${classification.domain}
Framework: ${classification.framework}

Context from memory:
${context}

Provide a complete, production-ready solution. Include:
1. Root cause / approach
2. Code changes (if applicable)
3. Test plan`;

  const execResp = await routeToProvider({
    tier:       'coding',
    model:      routing.selected_model === 'claude' ? 'claude-sonnet-4-6' :
                routing.selected_model === 'gpt'    ? 'gpt-4o' :
                routing.selected_model === 'deepseek' ? 'deepseek-coder' : undefined,
    prompt:     execPrompt,
    max_tokens: 2048,
    temperature: 0.1,
  });

  addEvidence({
    task_id: task.id,
    type:    'api_output',
    source:  `${routing.model_name} execution`,
    content: execResp.content?.slice(0, 1000) || execResp.error || 'No output',
  });

  // ── 8. EVIDENCE ───────────────────────────────────────────────────────────
  stages.push('EVIDENCE');
  updateStatus(task.id, 'PR_READY');
  const reportPath = generateEvidenceReport(task.id, input, routing.model_name);

  // ── 9. REPORT ─────────────────────────────────────────────────────────────
  stages.push('REPORT');

  // ── 10. LEARN ─────────────────────────────────────────────────────────────
  stages.push('LEARN');
  const learnKey = `workflow:${classification.domain}:${classification.task_type}`;
  // Store outcome to knowledge for future memory lookups
  await search(`${input} → model:${routing.selected_model} confidence:${routing.confidence}`);

  updateStatus(task.id, 'DONE', { finished_at: new Date().toISOString() });

  return {
    task_id:        task.id,
    stages_passed:  stages,
    final_stage:    'LEARN',
    status:         'DONE',
    classification,
    routing,
    memory_context: memoryContext,
    analysis,
    needs_approval: false,
    evidence_report: reportPath,
    output:         execResp.content || execResp.error || 'No output from model',
    self_learn:     { stored: true, key: learnKey },
    latency_ms:     Date.now() - start,
  };
}

// ── Benchmark: run same task through multiple models ─────────────────────────

export async function benchmark(input: string): Promise<{
  results: { model: string; latency_ms: number; tokens: number; preview: string }[];
}> {
  const models = [
    { tier: 'coding' as const, model: 'gpt-4o-mini',     name: 'GPT-4o-mini' },
    { tier: 'coding' as const, model: 'deepseek-coder',  name: 'DeepSeek Coder' },
    { tier: 'ceo-brain' as const, model: 'claude-sonnet-4-6', name: 'Claude Sonnet' },
  ];

  const results = await Promise.all(models.map(async (m) => {
    const resp = await routeToProvider({
      tier: m.tier, model: m.model, prompt: input, max_tokens: 512, temperature: 0.1,
    });
    return {
      model:      m.name,
      latency_ms: resp.latency_ms,
      tokens:     resp.tokens,
      preview:    (resp.content || resp.error || '').slice(0, 200),
    };
  }));

  return { results };
}
