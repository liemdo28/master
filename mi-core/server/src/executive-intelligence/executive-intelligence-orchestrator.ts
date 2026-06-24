/**
 * Executive Intelligence Orchestrator — Phase 21H
 * The top-level orchestrator that wires all intelligence engines together.
 *
 * Flow: CEO message → Intent → Plan → Reflect → Reason → Decide → QA Gates → Brief
 *
 * This is the single entry point for the Executive Intelligence Layer.
 * It sits between CEO and Autonomous Execution Layer.
 *
 * Architecture:
 *   CEO
 *     ↓
 *   Executive Intelligence Orchestrator  ← THIS FILE
 *     ├── Intent Understanding (21A)
 *     ├── Planning (21B)
 *     ├── Reflection (21C)
 *     ├── Business Reasoning (21D)
 *     ├── Memory (21E)
 *     ├── Decision (21F)
 *     ├── Evidence Collection (21G)
 *     ├── QA Gates (before brief!)
 *     └── Brief Generation (21G)
 *     ↓
 *   Autonomous Execution Layer (classifyAutonomy → execute)
 *     ↓
 *   Departments → Evidence Store → QA → Reporting
 */

import { analyzeIntent, IntentAnalysis, isAmbiguousMessage } from './executive-intent-engine';
import { buildExecutionPlan, ExecutionPlan, summarizePlan } from './executive-planner';
import { reflectOnAnalysis, ReflectionInput, ReflectionResult, quickReflect } from './executive-reflection';
import { analyzeBusinessSignal, BusinessAnalysis, BusinessSignal, formatBusinessAnalysis } from './business-reasoning-engine';
import { executiveIntelligenceMemory, ContextSnapshot } from './executive-memory-layer';
import { prioritizeIssues, DecisionMatrix, DecisionIssue, formatDecisionMatrix, createIssueFromDescription } from './executive-decision-engine';
import {
  generateQuickStatusBrief,
  generateFullAnalysisBrief,
  generateEmergencyBrief,
  ExecutiveBrief,
} from './executive-brief';
import { runQAGates, QAGateInput } from './qa-gates';
import { evidenceStore } from './evidence-store';
import { objectiveRunStore } from './db/objective-run-store';
import { classifyAutonomy } from '../autonomous/autonomous-execution-engine';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProcessingMode = 'quick' | 'full' | 'emergency' | 'strategic';

export interface OrchestratorOptions {
  channel?: string;
  actor?: string;
  readOnlyDefault?: boolean;
}

export interface IntelligenceResult {
  mode: ProcessingMode;
  input: string;
  intent: IntentAnalysis;
  plan?: ExecutionPlan;
  reflection?: ReflectionResult;
  businessAnalysis?: BusinessAnalysis;
  decisionMatrix?: DecisionMatrix;
  brief: ExecutiveBrief;
  memorySnapshot: ContextSnapshot;
  processing_time_ms: number;
  entry_point: string;
  runId: string;
  evidenceCount: number;
  qaResult?: { overall: 'pass' | 'fail'; gateCount: number; passedGates: number };
  autonomyDecision?: { level: string; category: string; can_run_now: boolean };
}

// ── Evidence collection ───────────────────────────────────────────────────────

/**
 * Collect evidence from the orchestrator's processing pipeline.
 * Each piece of evidence is stored via the evidenceStore (immutable, SHA256-hashed).
 */
function collectEvidenceForRun(
  runId: string,
  intent: IntentAnalysis,
  plan?: ExecutionPlan,
  reflection?: ReflectionResult,
  businessAnalysis?: BusinessAnalysis,
  decisionMatrix?: DecisionMatrix,
): string[] {
  const evidenceIds: string[] = [];

  // 1. Intent analysis evidence
  const intentEvidence = evidenceStore.persistEvidence(
    runId,
    {
      sourceType: 'intent_analysis',
      objectiveRunId: runId,
      sourceRef: 'executive-intent-engine',
      summary: `Primary intent: ${intent.primary_intent.intent} (${Math.round(intent.primary_intent.confidence * 100)}%), ` +
          `Alternatives: ${intent.alternatives.length}, Ambiguous: ${intent.is_ambiguous}`,
      readOnly: true,
    },
    JSON.stringify({
      primary_intent: intent.primary_intent,
      alternatives: intent.alternatives,
      is_ambiguous: intent.is_ambiguous,
      confidence_threshold_met: intent.confidence_threshold_met,
    }, null, 2),
  );
  evidenceIds.push(intentEvidence.id);

  // 2. Plan evidence
  if (plan) {
    const planEvidence = evidenceStore.persistEvidence(
      runId,
      {
        sourceType: 'execution_plan',
        objectiveRunId: runId,
        sourceRef: 'executive-planner',
        summary: `Plan: ${plan.title} | ${plan.total_steps} steps, ~${Math.ceil(plan.estimated_total_seconds / 60)}min | Risk: ${plan.risk_level || 'medium'}`,
        readOnly: true,
      },
      JSON.stringify(plan, null, 2),
    );
    evidenceIds.push(planEvidence.id);
  }

  // 3. Reflection evidence
  if (reflection) {
    const reflectionEvidence = evidenceStore.persistEvidence(
      runId,
      {
        sourceType: 'reflection',
        objectiveRunId: runId,
        sourceRef: 'executive-reflection',
        summary: `Confidence: ${Math.round(reflection.overall_confidence * 100)}% (${reflection.confidence_level}) | ` +
          `Assumptions: ${reflection.assumptions.length} | Missing: ${reflection.missing_evidence.length}`,
        readOnly: true,
      },
      JSON.stringify(reflection, null, 2),
    );
    evidenceIds.push(reflectionEvidence.id);
  }

  // 4. Business analysis evidence
  if (businessAnalysis) {
    const baEvidence = evidenceStore.persistEvidence(
      runId,
      {
        sourceType: 'business_analysis',
        objectiveRunId: runId,
        sourceRef: 'business-reasoning-engine',
        summary: `Signal: ${businessAnalysis.signal.type} (${businessAnalysis.signal.magnitude}%) | ` +
          `Hypotheses: ${businessAnalysis.hypotheses.length}`,
        readOnly: true,
      },
      JSON.stringify(businessAnalysis, null, 2),
    );
    evidenceIds.push(baEvidence.id);
  }

  // 5. Decision matrix evidence
  if (decisionMatrix) {
    const dmEvidence = evidenceStore.persistEvidence(
      runId,
      {
        sourceType: 'decision_matrix',
        objectiveRunId: runId,
        sourceRef: 'executive-decision-engine',
        summary: decisionMatrix.summary,
        readOnly: true,
      },
      JSON.stringify({
        summary: decisionMatrix.summary,
        issues: decisionMatrix.prioritized.map(p => p.issue),
        recommended_priority: decisionMatrix.recommended_ceo_focus,
      }, null, 2),
    );
    evidenceIds.push(dmEvidence.id);
  }

  // 6. Context snapshot evidence
  const snapshot = executiveIntelligenceMemory.takeContextSnapshot();
  const snapEvidence = evidenceStore.persistEvidence(
    runId,
    {
      sourceType: 'context_snapshot',
      objectiveRunId: runId,
      sourceRef: 'executive-memory-layer',
      summary: snapshot.summary,
      readOnly: true,
    },
    JSON.stringify(snapshot, null, 2),
  );
  evidenceIds.push(snapEvidence.id);

  return evidenceIds;
}

// ── Orchestrator ───────────────────────────────────────────────────────────────

export function processCEOInput(message: string, options: OrchestratorOptions = {}): IntelligenceResult {
  const startTime = Date.now();

  // 0. Ensure memory is initialized
  executiveIntelligenceMemory.init();

  // 1. Create persistent objective run
  const run = objectiveRunStore.createRun(
    message,
    options.channel || 'api',
    options.actor || 'ceo',
  );
  const runId = run.id;

  // 2. Intent Understanding (Phase 21A)
  const intent = analyzeIntent(message);
  objectiveRunStore.updateStatus(runId, 'intent_analyzed');

  // 3. Determine processing mode
  const mode = determineMode(intent, message);

  // 4. Take memory snapshot for context
  const memorySnapshot = executiveIntelligenceMemory.takeContextSnapshot();

  // 5. Classify autonomy
  const autonomyDecision = classifyAutonomy({
    task_type: 'executive_intelligence',
    description: message,
  });

  // 6. Route to appropriate processing pipeline
  let result: IntelligenceResult;

  switch (mode) {
    case 'quick':
      result = processQuick(intent, message, memorySnapshot, runId);
      break;
    case 'emergency':
      result = processEmergency(intent, message, memorySnapshot, runId);
      break;
    case 'strategic':
      result = processStrategic(intent, message, memorySnapshot, runId);
      break;
    case 'full':
    default:
      result = processFull(intent, message, memorySnapshot, runId);
      break;
  }

  result.processing_time_ms = Date.now() - startTime;
  result.autonomyDecision = {
    level: autonomyDecision.level,
    category: autonomyDecision.category,
    can_run_now: autonomyDecision.can_run_now,
  };

  // 7. Record reasoning in memory
  executiveIntelligenceMemory.recordReasoning(
    message,
    intent.primary_intent.intent,
    `Mode: ${mode} | Brief: ${result.brief.id} | QA: ${result.qaResult?.overall || 'skipped'}`,
    result.brief.confidence,
  );

  // 8. Complete the objective run
  objectiveRunStore.completeRun(runId, result.brief.confidence);

  return result;
}

// ── Processing modes ───────────────────────────────────────────────────────────

function processQuick(
  intent: IntentAnalysis,
  message: string,
  snapshot: ContextSnapshot,
  runId: string,
): IntelligenceResult {
  // Quick mode: intent → snapshot → brief (no full plan/analysis)
  const brief = generateQuickStatusBrief(snapshot);

  // Collect minimal evidence
  const evidenceIds = collectEvidenceForRun(runId, intent, undefined, undefined);

  return {
    mode: 'quick',
    input: message,
    intent,
    brief,
    memorySnapshot: snapshot,
    processing_time_ms: 0,
    entry_point: intent.recommended_entry_point,
    runId,
    evidenceCount: evidenceIds.length,
  };
}

function processFull(
  intent: IntentAnalysis,
  message: string,
  snapshot: ContextSnapshot,
  runId: string,
): IntelligenceResult {
  // Full mode: intent → plan → reflect → evidence → QA → brief

  // 21B: Build plan
  const plan = buildExecutionPlan(intent);
  objectiveRunStore.updateStatus(runId, 'planned');

  // 21C: Reflect on the analysis
  const reflectionInput: ReflectionInput = {
    analysis_type: intent.primary_intent.intent,
    findings: intent.primary_intent.suggested_investigation,
    evidence_count: intent.primary_intent.evidence_keywords.length,
    conclusions: [intent.primary_intent.label_vi, ...intent.alternatives.map(a => a.label_vi)],
    data_sources: ['executive_memory', 'system_health', 'business_data'],
  };
  const reflection = reflectOnAnalysis(reflectionInput);
  objectiveRunStore.updateStatus(runId, 'reasoning');

  // Collect evidence for this run
  const evidenceIds = collectEvidenceForRun(runId, intent, plan, reflection);
  objectiveRunStore.updateStatus(runId, 'evidence_collected');

  // Get evidence packets for QA
  const evidencePackets = evidenceIds.map(id => evidenceStore.getEvidence(id)).filter(Boolean) as any[];

  // Generate brief
  const brief = generateFullAnalysisBrief(intent, plan, reflection);

  // Run QA gates BEFORE returning brief
  const qaInput: QAGateInput = {
    evidencePackets,
    reflection: reflection as any,
    brief: brief as any,
    isReadOnlyDefault: true, // default read-only
    hasApprovalForWrite: false,
    rawOutputs: {
      intent: intent.primary_intent as any,
      plan: plan as any,
    },
  };
  const qaResult = runQAGates(qaInput);
  objectiveRunStore.updateStatus(runId, qaResult.overall === 'pass' ? 'qa_passed' : 'qa_failed');

  return {
    mode: 'full',
    input: message,
    intent,
    plan,
    reflection,
    brief,
    memorySnapshot: snapshot,
    processing_time_ms: 0,
    entry_point: intent.recommended_entry_point,
    runId,
    evidenceCount: evidenceIds.length,
    qaResult: {
      overall: qaResult.overall,
      gateCount: qaResult.gates.length,
      passedGates: qaResult.gates.filter(g => g.passed).length,
    },
  };
}

function processEmergency(
  intent: IntentAnalysis,
  message: string,
  snapshot: ContextSnapshot,
  runId: string,
): IntelligenceResult {
  // Emergency mode: fast-track through intent → immediate findings → emergency brief

  const findings = [
    ...intent.primary_intent.suggested_investigation.slice(0, 3),
    `Active incidents: ${snapshot.active_incidents}`,
    `Overall status: ${snapshot.overall_status}`,
  ];

  const immediateActions = [
    'Kiểm tra hệ thống critical ngay lập tức',
    'Xác định nguyên nhân gốc sự cố',
    'Thông báo CEO trong vòng 5 phút',
  ];

  const reflection = reflectOnAnalysis({
    analysis_type: 'emergency',
    findings,
    evidence_count: findings.length,
    conclusions: [intent.primary_intent.label_vi],
    data_sources: ['system_health', 'active_incidents'],
  });

  const plan = buildExecutionPlan(intent);

  const brief = generateEmergencyBrief(intent, findings, immediateActions);

  // Collect evidence
  const evidenceIds = collectEvidenceForRun(runId, intent, plan, reflection);
  const evidencePackets = evidenceIds.map(id => evidenceStore.getEvidence(id)).filter(Boolean) as any[];

  // Run QA gates
  const qaInput: QAGateInput = {
    evidencePackets,
    reflection: reflection as any,
    brief: brief as any,
    isReadOnlyDefault: true,
    hasApprovalForWrite: false,
  };
  const qaResult = runQAGates(qaInput);
  objectiveRunStore.updateStatus(runId, qaResult.overall === 'pass' ? 'qa_passed' : 'qa_failed');

  return {
    mode: 'emergency',
    input: message,
    intent,
    plan,
    reflection,
    brief,
    memorySnapshot: snapshot,
    processing_time_ms: 0,
    entry_point: 'emergency-response',
    runId,
    evidenceCount: evidenceIds.length,
    qaResult: {
      overall: qaResult.overall,
      gateCount: qaResult.gates.length,
      passedGates: qaResult.gates.filter(g => g.passed).length,
    },
  };
}

function processStrategic(
  intent: IntentAnalysis,
  message: string,
  snapshot: ContextSnapshot,
  runId: string,
): IntelligenceResult {
  // Strategic mode: full analysis + business reasoning + decision matrix

  // 21B: Build plan
  const plan = buildExecutionPlan(intent);
  objectiveRunStore.updateStatus(runId, 'planned');

  // 21C: Reflect
  const reflection = reflectOnAnalysis({
    analysis_type: 'strategic',
    findings: intent.primary_intent.suggested_investigation,
    evidence_count: intent.primary_intent.evidence_keywords.length + 2,
    conclusions: [intent.primary_intent.label_vi],
    data_sources: ['business_data', 'market_data', 'executive_memory'],
  });
  objectiveRunStore.updateStatus(runId, 'reasoning');

  // 21D: Business reasoning (if applicable)
  let businessAnalysis: BusinessAnalysis | undefined;
  if (/revenue|doanh thu|profit|lợi nhuận|cost|chi phí/i.test(message)) {
    const magnitude = extractMagnitude(message);
    businessAnalysis = analyzeBusinessSignal({
      type: 'revenue_drop',
      magnitude,
      period: 'recent',
      context: {},
    });
  }

  // 21F: Decision matrix (generate issues from alternatives)
  const issues: DecisionIssue[] = intent.alternatives.map(alt =>
    createIssueFromDescription(
      alt.label_vi,
      alt.suggested_investigation.join('; '),
      alt.intent,
    )
  );
  // Also add primary intent as an issue
  issues.unshift(createIssueFromDescription(
    intent.primary_intent.label_vi,
    intent.primary_intent.suggested_investigation.join('; '),
    intent.primary_intent.intent,
    { revenue: 0.6, operational: 0.5 },
  ));

  const decisionMatrix = prioritizeIssues(issues);

  // Collect evidence
  const evidenceIds = collectEvidenceForRun(runId, intent, plan, reflection, businessAnalysis, decisionMatrix);
  objectiveRunStore.updateStatus(runId, 'evidence_collected');
  const evidencePackets = evidenceIds.map(id => evidenceStore.getEvidence(id)).filter(Boolean) as any[];

  // 21G: Full brief with all analysis
  const brief = generateFullAnalysisBrief(intent, plan, reflection, businessAnalysis, decisionMatrix);

  // Run QA gates BEFORE returning brief
  const qaInput: QAGateInput = {
    evidencePackets,
    reflection: reflection as any,
    brief: brief as any,
    isReadOnlyDefault: true,
    hasApprovalForWrite: false,
    rawOutputs: {
      intent: intent.primary_intent as any,
      plan: plan as any,
    },
  };
  const qaResult = runQAGates(qaInput);
  objectiveRunStore.updateStatus(runId, qaResult.overall === 'pass' ? 'qa_passed' : 'qa_failed');

  return {
    mode: 'strategic',
    input: message,
    intent,
    plan,
    reflection,
    businessAnalysis,
    decisionMatrix,
    brief,
    memorySnapshot: snapshot,
    processing_time_ms: 0,
    entry_point: intent.recommended_entry_point,
    runId,
    evidenceCount: evidenceIds.length,
    qaResult: {
      overall: qaResult.overall,
      gateCount: qaResult.gates.length,
      passedGates: qaResult.gates.filter(g => g.passed).length,
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function determineMode(intent: IntentAnalysis, message: string): ProcessingMode {
  // Emergency: urgent intervention or very high confidence critical
  if (intent.primary_intent.intent === 'urgent_intervention') return 'emergency';
  if (intent.primary_intent.confidence >= 0.9 && /gấp|emergency|critical/i.test(message)) return 'emergency';

  // Quick: general status check or low confidence
  if (intent.primary_intent.intent === 'general_status_check') return 'quick';
  if (!intent.confidence_threshold_met) return 'quick';

  // Strategic: strategic questions, business analysis needs
  if (intent.primary_intent.intent === 'strategic_question') return 'strategic';
  if (intent.primary_intent.intent === 'revenue_concern') return 'strategic';
  if (intent.primary_intent.intent === 'performance_review') return 'strategic';

  // Full: everything else
  return 'full';
}

function extractMagnitude(message: string): number {
  // Try to extract a percentage from the message
  const match = message.match(/(\d+)\s*%/);
  if (match) {
    // If negative context (down, drop, giảm, lỗ), make it negative
    if (/down|drop|giảm|lỗ|thấp/i.test(message)) {
      return -parseInt(match[1]);
    }
    return parseInt(match[1]);
  }
  return -10; // default assumption
}

// ── Ambiguity handler (Phase 21H test) ─────────────────────────────────────────

export function handleAmbiguousMessage(message: string): IntelligenceResult {
  // This is the main entry for ambiguous CEO messages
  // such as "Something feels wrong today" or "Are we okay?"
  return processCEOInput(message);
}

// ── Quick API for pipeline integration ─────────────────────────────────────────

export function getQuickBrief(message: string): ExecutiveBrief {
  const result = processCEOInput(message);
  return result.brief;
}

export function getIntelligenceSummary(message: string): string {
  const result = processCEOInput(message);
  return result.brief.formatted_whatsapp;
}
