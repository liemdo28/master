/**
 * Coding task classification.
 *
 * Treating every request as one large free-form patch is what made the two
 * unstable fixtures unstable: a type error needs a two-line correction driven
 * by a compiler diagnostic, and a refactor needs several small transformations,
 * but both were being asked for as a single unconstrained patch.
 *
 * Classification is deterministic and reuses the retrieval intent parser, so it
 * costs nothing and cannot itself become a source of variance.
 */

import type { CodingIntent } from '../retrieval/types';
import { parseCodingIntent } from '../retrieval/intent';

export type TaskClass =
  | 'TARGETED_EDIT'
  | 'TYPE_REPAIR'
  | 'MULTI_FILE_FEATURE'
  | 'BEHAVIOR_REFACTOR'
  | 'TEST_REPAIR'
  | 'CONFIG_CHANGE'
  | 'UNKNOWN';

export type EngineStrategy =
  /** One anchored edit, generated in a single pass. */
  | 'SINGLE_PATCH'
  /** Compiler diagnostics first, then a minimal correction per diagnostic. */
  | 'DIAGNOSTIC_GUIDED'
  /** A sequence of small validated transformations. */
  | 'DECOMPOSED'
  /** Several coordinated edits in one pass, bounded per file. */
  | 'COORDINATED_PATCH';

export interface TaskClassification {
  taskClass: TaskClass;
  confidence: number;
  strategy: EngineStrategy;
  /** Soft ceiling on changed lines for one patch in this class. */
  maxChangedLines: number;
  /** Soft ceiling on functions touched by one patch. */
  maxFunctionsPerPatch: number;
  maxOutputTokens: number;
  expectedValidation: string;
  reasoning: string;
  intent: CodingIntent;
}

const REFACTOR_PATTERN = /\b(refactor\w*|restructur\w*|extract\w*|split\s+(it|this|the)|deduplicat\w*|simplif\w*|tidy|clean\s*up|without changing (any )?(observable )?behaviou?r|behaviou?r[- ]preserving)\b/i;
const TYPE_ERROR_PATTERN = /\b(no longer compiles?|does not compile|type error|typescript errors?|does not exist on type|is not assignable|possibly ['"]?undefined|ts\d{4}|compile errors?)\b/i;
const TEST_REPAIR_PATTERN = /\b(failing test|pending test|test (is )?fail\w*|make the (existing )?test pass|assertion fails?)\b/i;
/**
 * Architectural layers a request can name.
 *
 * A request touching two or more distinct layers is a multi-file feature, even
 * when it also mentions a test — the test is the acceptance criterion, not the
 * subject. Counting layers is more robust than ordering regexes, which
 * misclassified "add filtering to the route and the service, and make the
 * pending test pass" as a test repair.
 */
const LAYER_PATTERNS: RegExp[] = [
  /\b(routes?|endpoints?|handlers?|controllers?|http layer|api layer)\b/i,
  /\b(services?|domain layer|business logic|use[- ]case)\b/i,
  /\b(models?|schemas?|tables?|repositor(y|ies)|persistence)\b/i,
  /\b(cli|command[- ]line)\b/i,
  /\b(validat\w+|middleware)\b/i,
];

function distinctLayers(text: string): number {
  return LAYER_PATTERNS.filter(pattern => pattern.test(text)).length;
}

/**
 * Per-class execution policy.
 *
 * The refactor budget is deliberately small: an unbounded whole-function
 * rewrite is exactly the request that overran the output budget and surfaced as
 * CONTEXT_INSUFFICIENT rather than as anything the model could act on.
 */
const POLICY: Record<TaskClass, Omit<TaskClassification, 'confidence' | 'reasoning' | 'intent' | 'taskClass'>> = {
  TARGETED_EDIT: {
    strategy: 'SINGLE_PATCH',
    maxChangedLines: 40,
    maxFunctionsPerPatch: 2,
    maxOutputTokens: 2048,
    expectedValidation: 'unit tests covering the edited behaviour',
  },
  TYPE_REPAIR: {
    strategy: 'DIAGNOSTIC_GUIDED',
    maxChangedLines: 20,
    maxFunctionsPerPatch: 3,
    maxOutputTokens: 1536,
    expectedValidation: 'the compiler, then the test suite',
  },
  MULTI_FILE_FEATURE: {
    strategy: 'COORDINATED_PATCH',
    maxChangedLines: 80,
    maxFunctionsPerPatch: 6,
    maxOutputTokens: 3072,
    expectedValidation: 'tests covering every touched layer',
  },
  BEHAVIOR_REFACTOR: {
    strategy: 'DECOMPOSED',
    maxChangedLines: 45,
    maxFunctionsPerPatch: 3,
    maxOutputTokens: 2560,
    expectedValidation: 'the existing tests, unchanged, still passing',
  },
  TEST_REPAIR: {
    strategy: 'SINGLE_PATCH',
    maxChangedLines: 30,
    maxFunctionsPerPatch: 2,
    maxOutputTokens: 2048,
    expectedValidation: 'the failing test, then the whole suite',
  },
  CONFIG_CHANGE: {
    strategy: 'SINGLE_PATCH',
    maxChangedLines: 20,
    maxFunctionsPerPatch: 1,
    maxOutputTokens: 1024,
    expectedValidation: 'build and startup',
  },
  UNKNOWN: {
    strategy: 'SINGLE_PATCH',
    maxChangedLines: 60,
    maxFunctionsPerPatch: 4,
    maxOutputTokens: 3072,
    expectedValidation: 'the configured validation commands',
  },
};

export function classifyTask(userRequest: string, intent = parseCodingIntent(userRequest)): TaskClassification {
  const text = String(userRequest ?? '');
  let taskClass: TaskClass = 'UNKNOWN';
  let confidence = 0.3;
  let reasoning = 'no distinguishing signal; treated as a general edit';

  if (TYPE_ERROR_PATTERN.test(text) || intent.artifactType === 'TYPE') {
    taskClass = 'TYPE_REPAIR';
    confidence = TYPE_ERROR_PATTERN.test(text) ? 0.9 : 0.6;
    reasoning = 'request describes a compilation or type failure';
  } else if (REFACTOR_PATTERN.test(text)) {
    taskClass = 'BEHAVIOR_REFACTOR';
    confidence = 0.85;
    reasoning = 'request asks for restructuring while preserving behaviour';
  } else if (distinctLayers(text) >= 2) {
    taskClass = 'MULTI_FILE_FEATURE';
    confidence = 0.75;
    reasoning = `request names ${distinctLayers(text)} distinct layers`;
  } else if (TEST_REPAIR_PATTERN.test(text)) {
    taskClass = 'TEST_REPAIR';
    confidence = 0.8;
    reasoning = 'request centres on an existing failing or pending test';
  } else if (intent.artifactType === 'CONFIG') {
    taskClass = 'CONFIG_CHANGE';
    confidence = 0.7;
    reasoning = 'request targets configuration';
  } else if (intent.action !== 'UNKNOWN') {
    taskClass = 'TARGETED_EDIT';
    confidence = 0.6;
    reasoning = `single ${intent.action} against ${intent.artifactType}`;
  }

  return { taskClass, confidence, reasoning, intent, ...POLICY[taskClass] };
}

export function policyFor(taskClass: TaskClass): Omit<TaskClassification, 'confidence' | 'reasoning' | 'intent' | 'taskClass'> {
  return POLICY[taskClass];
}
