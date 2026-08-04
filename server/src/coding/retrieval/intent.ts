/**
 * Deterministic coding-intent extraction.
 *
 * Parsing the request before ranking files is what lets retrieval distinguish
 * "the engine id returned by a handler" (an HTTP response field) from "the
 * engine implementation". Without it, "engine" is just a token that matches
 * engine.ts.
 *
 * Deliberately deterministic: no model call, no network, same output for the
 * same request. A model may later refine this, but the fallback must be sound
 * on its own.
 */

import type { ArtifactType, CodingIntent, IntentAction } from './types';

/** Words that carry no retrieval signal. */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'to', 'of', 'in', 'on', 'at', 'by', 'is', 'are',
  'was', 'were', 'be', 'been', 'that', 'this', 'it', 'its', 'so', 'can', 'do', 'does', 'not',
  'with', 'from', 'into', 'when', 'which', 'what', 'who', 'how', 'why', 'should', 'must', 'will',
  'would', 'could', 'have', 'has', 'had', 'we', 'you', 'they', 'i', 'me', 'my', 'our', 'their',
  'please', 'make', 'sure', 'also', 'now', 'then', 'than', 'there', 'here', 'each', 'any', 'all',
  'same', 'other', 'more', 'less', 'only', 'just', 'still', 'currently', 'does', 'using', 'use',
]);

const ACTION_PATTERNS: Array<[IntentAction, RegExp]> = [
  ['ADD', /\b(add|include|introduce|expose|support|extend|append|return also)\b/i],
  ['FIX', /\b(fix|repair|correct|broken|fails?|failing|bug|incorrect|wrong|does not|doesn't|silently)\b/i],
  ['REMOVE', /\b(remove|delete|drop|strip|exclude)\b/i],
  ['REFACTOR', /\b(refactor|restructure|simplify|extract|clean up|deduplicate|tidy)\b/i],
  ['TEST', /\b(add a test|write a test|test coverage|unit test for)\b/i],
  ['CHANGE', /\b(change|update|modify|adjust|rename|replace|set)\b/i],
];

/**
 * Artifact patterns, matched in priority order.
 *
 * Each stem is written to tolerate inflections — "configured" and "settings"
 * must match CONFIG just as "config" does. Requiring the exact base word made
 * a configuration request parse as UNKNOWN, which removed its role affinity and
 * left retrieval selecting nothing at all.
 */
const ARTIFACT_PATTERNS: Array<[ArtifactType, RegExp]> = [
  // Response before route: "the plan endpoint response" is about the payload.
  // "returns"/"returning" alone is not an HTTP signal — every function returns
  // something. Only payload vocabulary counts, or the word appears alongside an
  // endpoint noun, which the HTTP_ROUTE pattern below catches.
  ['HTTP_RESPONSE', /\b(response\w*|payload\w*|json body|api response|response field|http body)\b/i],
  ['HTTP_ROUTE', /\b(endpoint\w*|route\w*|handler\w*|controller\w*|api|http|get|post|put|patch|delete)\b/i],
  ['CLI', /\b(cli|command[- ]?line|subcommand\w*|command\w*|argv|flags?|options?)\b/i],
  ['TYPE', /\b(types?|interfaces?|typescript|compiles?|compilation|does not exist on type|type error)\b/i],
  ['MODEL', /\b(schemas?|migrations?|columns?|tables?|models?|databases?|db|entit(y|ies)|mapping\w*)\b/i],
  ['TEST', /\b(tests?|testing|specs?|assertions?)\b/i],
  ['CONFIG', /\b(config\w*|configur\w*|settings?|env var\w*|environment variable\w*)\b/i],
  ['SERVICE', /\b(services?|business logic|domain logic|helpers?|utilit(y|ies))\b/i],
];

/** Route-shaped tokens: /a/b, /a/:id/b, quoted or bare. */
const ROUTE_PATTERN = /(?:^|[\s'"`(])(\/[A-Za-z0-9_\-:./]*[A-Za-z0-9_\-:.])/g;

/** Identifier-shaped tokens worth treating as symbols. */
const PASCAL_CASE = /\b([A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+)\b/g;
const CAMEL_CASE = /\b([a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+)\b/g;
const BACKTICKED = /`([^`]{2,60})`/g;

const FRAMEWORK_HINTS: Array<[string, RegExp]> = [
  ['express', /\b(express|router|app\.use|req|res)\b/i],
  ['node-test', /\b(node --test|node:test)\b/i],
  ['typescript', /\b(typescript|tsc|\.ts\b|interface|type error)\b/i],
];

export function tokenizeRequest(userRequest: string): string[] {
  return [
    ...new Set(
      userRequest
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(token => token.length > 2 && !STOP_WORDS.has(token))
    ),
  ];
}

/**
 * Expands a name across casing conventions so `minQuantity`, `min_quantity` and
 * `min-quantity` all match, and splits compounds into their parts.
 */
export function normalizeName(name: string): string[] {
  const out = new Set<string>();
  const trimmed = name.trim();
  if (!trimmed) return [];
  out.add(trimmed);
  out.add(trimmed.toLowerCase());

  const parts = trimmed
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  for (const part of parts) out.add(part.toLowerCase());
  if (parts.length > 1) {
    const lower = parts.map(p => p.toLowerCase());
    out.add(lower.join(''));
    out.add(lower.join('-'));
    out.add(lower.join('_'));
    out.add(lower[0] + lower.slice(1).map(p => p[0].toUpperCase() + p.slice(1)).join(''));
  }
  return [...out].filter(value => value.length > 1);
}

/** Extracts route-shaped strings, ignoring things that are really file paths. */
function extractRoutePaths(userRequest: string): string[] {
  const found = new Set<string>();
  for (const match of userRequest.matchAll(ROUTE_PATTERN)) {
    const value = match[1];
    // A path with a file extension is a file reference, not a route.
    if (/\.[a-z]{1,4}$/i.test(value)) continue;
    if (value.length < 2) continue;
    found.add(value);
  }
  return [...found];
}

/** Explicit file paths named in the request. */
export function extractFilePaths(userRequest: string): string[] {
  const found = new Set<string>();
  for (const match of userRequest.matchAll(/([A-Za-z0-9_\-./]+\.[a-z]{1,4}[a-z0-9]?)\b/gi)) {
    const value = match[1];
    if (value.includes('/') || /\.[cm]?[jt]sx?$/.test(value)) found.add(value.replace(/^\.\//, ''));
  }
  return [...found];
}

function extractSymbols(userRequest: string): string[] {
  const found = new Set<string>();
  for (const match of userRequest.matchAll(PASCAL_CASE)) found.add(match[1]);
  for (const match of userRequest.matchAll(CAMEL_CASE)) found.add(match[1]);
  for (const match of userRequest.matchAll(BACKTICKED)) {
    const value = match[1].trim();
    if (/^[A-Za-z_$][\w$.]*$/.test(value)) found.add(value);
  }
  return [...found];
}

function firstMatch<T>(patterns: Array<[T, RegExp]>, text: string, fallback: T): T {
  for (const [value, pattern] of patterns) {
    if (pattern.test(text)) return value;
  }
  return fallback;
}

/**
 * Roles the request implies are *not* the target.
 *
 * A request about an HTTP response is about the API surface; the engine or
 * model internals that happen to share a word with it are not the target unless
 * a handler actually calls them. This is expressed as a role constraint rather
 * than a filename rule, so it carries no knowledge of any specific repository.
 */
function negativeConstraints(artifactType: ArtifactType): string[] {
  switch (artifactType) {
    case 'HTTP_RESPONSE':
    case 'HTTP_ROUTE':
      return ['internal implementation not reachable from a route handler'];
    case 'CLI':
      return ['internal implementation not reachable from a CLI command'];
    case 'TYPE':
      return ['unrelated runtime code with no reference to the type'];
    case 'TEST':
      return ['source files with no relationship to the failing test'];
    default:
      return [];
  }
}

export function parseCodingIntent(userRequest: string): CodingIntent {
  const text = String(userRequest ?? '');
  const action = firstMatch(ACTION_PATTERNS, text, 'UNKNOWN');
  const artifactType = firstMatch(ARTIFACT_PATTERNS, text, 'UNKNOWN');
  const routePaths = extractRoutePaths(text);
  const symbols = extractSymbols(text);
  const filePaths = extractFilePaths(text);

  const tokens = tokenizeRequest(text);
  // Target names are the content words, plus anything that looked like an
  // identifier, expanded across casing conventions.
  const targetNames = [...new Set([...tokens, ...symbols.flatMap(normalizeName)])];

  const frameworkHints = FRAMEWORK_HINTS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  const testHints = /\b(test|spec|assertion)\b/i.test(text) ? ['request mentions tests'] : [];

  const expectedOutput =
    artifactType === 'HTTP_RESPONSE'
      ? 'a field in an HTTP response payload'
      : artifactType === 'CLI'
        ? 'CLI output or option handling'
        : null;

  // Confidence reflects how much *structural* signal the parse found, since
  // that is what distinguishes this from plain tokenisation.
  let confidence = 0.3;
  if (routePaths.length) confidence += 0.3;
  if (filePaths.length) confidence += 0.2;
  if (symbols.length) confidence += 0.1;
  if (artifactType !== 'UNKNOWN') confidence += 0.1;

  return {
    action,
    artifactType,
    targetNames,
    routePaths,
    symbols: [...new Set([...symbols, ...filePaths])],
    behavior: text.trim().slice(0, 400),
    expectedOutput,
    frameworkHints,
    testHints,
    negativeConstraints: negativeConstraints(artifactType),
    confidence: Math.min(1, confidence),
  };
}
