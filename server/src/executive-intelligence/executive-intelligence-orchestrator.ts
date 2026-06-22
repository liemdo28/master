/**
 * Executive Intelligence Orchestrator — Phase 21H
 * The top-level orchestrator that wires all intelligence engines together.
 *
 * Flow: CEO message → Intent → Plan → Reflect → Reason → Decide → Brief
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
 *     └── Brief Generation (21G)
 *     ↓
 *   Autonomous Execution Layer
 *     ↓
 *   Departments → QA → Reporting
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

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProcessingMode = 'quick' | 'full' | 'emergency' | 'strategic';

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
}

// ── Orchestrator ───────────────────────────────────────────────────────────────

export function processCEOInput(message: string): IntelligenceResult {
  const startTime = Date.now();

  // 0. Ensure memory is initialized
  executiveIntelligenceMemory.init();

  // 1. Intent Understanding (Phase 21A)
  const intent = analyzeIntent(message);

  // 2. Determine processing mode
  const mode = determineMode(intent, message);

  // 3. Take memory snapshot for context
  const memorySnapshot = executiveIntelligenceMemory.takeContextSnapshot();

  // 4. Route to appropriate processing pipeline
  let result: IntelligenceResult;

  switch (mode) {
    case 'quick':
      result = processQuick(intent, message, memorySnapshot);
      break;
    case 'emergency':
      result = processEmergency(intent, message, memorySnapshot);
      break;
    case 'strategic':
      result = processStrategic(intent, message, memorySnapshot);
      break;
    case 'full':
    default:
      result = processFull(intent, message, memorySnapshot);
      break;
  }

  result.processing_time_ms = Date.now() - startTime;

  // 5. Record reasoning in memory
  executiveIntelligenceMemory.recordReasoning(
    message,
    intent.primary_intent.intent,
    `Mode: ${mode} | Brief: ${result.brief.id}`,
    result.brief.confidence,
  );

  return result;
}

// ── Processing modes ───────────────────────────────────────────────────────────

function processQuick(
  intent: IntentAnalysis,
  message: string,
  snapshot: ContextSnapshot,
): IntelligenceResult {
  // Quick mode: intent → snapshot → brief (no full plan/analysis)
  const brief = generateQuickStatusBrief(snapshot);

  return {
    mode: 'quick',
    input: message,
    intent,
    brief,
    memorySnapshot: snapshot,
    processing_time_ms: 0,
    entry_point: intent.recommended_entry_point,
  };
}

function processFull(
  intent: IntentAnalysis,
  message: string,
  snapshot: ContextSnapshot,
): IntelligenceResult {
  // Full mode: intent → plan → reflect → reason → decide → brief

  // 21B: Build plan
  const plan = buildExecutionPlan(intent);

  // 21C: Reflect on the analysis
  const reflectionInput: ReflectionInput = {
    analysis_type: intent.primary_intent.intent,
    findings: intent.primary_intent.suggested_investigation,
    evidence_count: intent.primary_intent.evidence_keywords.length,
    conclusions: [intent.primary_intent.label_vi, ...intent.alternatives.map(a => a.label_vi)],
    data_sources: ['executive_memory', 'system_health', 'business_data'],
  };
  const reflection = reflectOnAnalysis(reflectionInput);

  // 21G: Generate brief
  const brief = generateFullAnalysisBrief(intent, plan, reflection);

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
  };
}

function processEmergency(
  intent: IntentAnalysis,
  message: string,
  snapshot: ContextSnapshot,
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
  };
}

function processStrategic(
  intent: IntentAnalysis,
  message: string,
  snapshot: ContextSnapshot,
): IntelligenceResult {
  // Strategic mode: full analysis + business reasoning + decision matrix

  // 21B: Build plan
  const plan = buildExecutionPlan(intent);

  // 21C: Reflect
  const reflection = reflectOnAnalysis({
    analysis_type: 'strategic',
    findings: intent.primary_intent.suggested_investigation,
    evidence_count: intent.primary_intent.evidence_keywords.length + 2,
    conclusions: [intent.primary_intent.label_vi],
    data_sources: ['business_data', 'market_data', 'executive_memory'],
  });

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

  // 21G: Full brief with all analysis
  const brief = generateFullAnalysisBrief(intent, plan, reflection, businessAnalysis, decisionMatrix);

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
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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
