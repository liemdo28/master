/**
 * Layered retrieval ranking.
 *
 * The ordering principle: evidence that identifies a file *structurally* — an
 * exact route, an exact symbol, a response key — outweighs evidence that merely
 * mentions it. A filename token is the weakest signal in the system, because a
 * word in the request ("engine") frequently names a value rather than a file.
 *
 * Weights live in one table so ordering is inspectable and testable, and every
 * contribution carries an explanation so a ranking can be justified after the
 * fact.
 */

import * as path from 'path';
import { normalizeName } from './intent';
import type { FileNode, RepoGraph } from './graph';
import {
  DEFAULT_RETRIEVAL_LIMITS,
  type CodingIntent,
  type EvidenceKind,
  type RetrievalCandidate,
  type RetrievalEvidence,
  type RetrievalLimits,
  type RetrievalResult,
  type StructuralRole,
} from './types';

/**
 * Layer weights. Layer 1 signals are an order of magnitude above lexical ones
 * so no accumulation of weak matches can outvote one exact structural match.
 */
export const EVIDENCE_WEIGHTS: Record<EvidenceKind, number> = {
  // Layer 1 — exact structural
  EXPLICIT_PATH: 100,
  EXACT_ROUTE: 60,
  EXACT_SYMBOL: 45,
  EXACT_RESPONSE_KEY: 40,
  EXACT_STRING: 25,
  // Layer 2 — framework structure
  ROUTE_DEFINITION: 20,
  ROUTE_HANDLER: 18,
  ARTIFACT_ROLE: 15,
  CLI_DEFINITION: 30,
  // Layer 3 — dependency graph
  DIRECT_IMPORT: 12,
  ONE_HOP_IMPORT: 5,
  IMPORTED_BY_SELECTED: 10,
  RELATED_TEST: 16,
  // Layer 4 — symbol graph
  SYMBOL_DEFINITION: 14,
  TYPE_REFERENCE: 8,
  // Layer 5 — lexical
  FILENAME_TOKEN: 3,
  DIRECTORY_TOKEN: 1,
  CONTENT_TOKEN: 1,
  // Layer 6
  SEMANTIC_SIMILARITY: 6,
  // negative
  NEGATIVE_GENERATED: -100,
  NEGATIVE_UNRELATED_ROLE: -12,
  NEGATIVE_ORPHAN_TEST: -10,
  NEGATIVE_DIRECTORY_ONLY: -2,
};

/** Roles a request about a given artifact is actually asking for. */
const ROLE_AFFINITY: Record<string, StructuralRole[]> = {
  HTTP_RESPONSE: ['ROUTE', 'HANDLER', 'CONTROLLER'],
  HTTP_ROUTE: ['ROUTE', 'HANDLER', 'CONTROLLER'],
  SERVICE: ['SERVICE', 'CONTROLLER'],
  TYPE: ['TYPE', 'MODEL'],
  CLI: ['CLI', 'ENTRYPOINT'],
  TEST: ['TEST'],
  CONFIG: ['CONFIG'],
  MODEL: ['MODEL', 'TYPE'],
};

function normalizeRoute(routePath: string): string {
  return routePath
    .toLowerCase()
    .replace(/:[A-Za-z0-9_]+/g, ':param')
    .replace(/\/+$/, '')
    .replace(/\/{2,}/g, '/');
}

/** Route segments that carry meaning, ignoring parameters. */
function routeSegments(routePath: string): string[] {
  return normalizeRoute(routePath)
    .split('/')
    .filter(segment => segment && segment !== ':param');
}

function addEvidence(
  bucket: RetrievalEvidence[],
  kind: EvidenceKind,
  value: string,
  explanation: string,
  sourcePath?: string,
  weightOverride?: number
): void {
  bucket.push({
    kind,
    value,
    weight: weightOverride ?? EVIDENCE_WEIGHTS[kind],
    sourcePath,
    explanation,
  });
}

export interface RankInput {
  graph: RepoGraph;
  intent: CodingIntent;
  /** Paths allowed by the context pack / registry boundary. */
  allowedPaths: string[];
  limits?: RetrievalLimits;
}

export function rankCandidates(input: RankInput): RetrievalResult {
  const startedAt = Date.now();
  const limits = input.limits ?? DEFAULT_RETRIEVAL_LIMITS;
  const { graph, intent } = input;

  const allowed = new Set(input.allowedPaths);
  const nodes = [...graph.files.values()].filter(node => allowed.size === 0 || allowed.has(node.path));

  const requestRouteSegments = new Set(intent.routePaths.flatMap(routeSegments));
  const normalizedRequestRoutes = new Set(intent.routePaths.map(normalizeRoute));
  const targetNameSet = new Set(intent.targetNames.map(name => name.toLowerCase()));
  const symbolSet = new Set(intent.symbols);
  const explicitPaths = intent.symbols.filter(symbol => symbol.includes('/') || /\.[cm]?[jt]sx?$/.test(symbol));

  const affinity = ROLE_AFFINITY[intent.artifactType] ?? [];
  const wantsApiSurface = intent.artifactType === 'HTTP_RESPONSE' || intent.artifactType === 'HTTP_ROUTE';
  // An explicit route path in the request also makes route evidence relevant,
  // even when the phrasing did not read as an API request.
  const routeEvidenceApplies = wantsApiSurface || intent.routePaths.length > 0;

  const candidates: RetrievalCandidate[] = nodes.map(node => {
    const evidence: RetrievalEvidence[] = [];
    const matchedRoutes: string[] = [];
    const matchedSymbols: string[] = [];
    const lexicalMatches: string[] = [];
    const exclusionReasons: string[] = [];

    // ── Layer 1: exact structural signals ─────────────────────────────────
    for (const explicit of explicitPaths) {
      if (node.path === explicit || node.path.endsWith(`/${explicit}`)) {
        addEvidence(evidence, 'EXPLICIT_PATH', explicit, 'the request names this file explicitly');
      }
    }

    // Route and response evidence answers "which route serves this", which is
    // only the question being asked when the request is about routes. Crediting
    // it unconditionally made any file defining several routes the top hit for
    // every request, including a test-only change and a configuration lookup —
    // its response keys collide with ordinary nouns like "status" or "task".
    for (const route of routeEvidenceApplies ? node.routes : []) {
      const normalized = normalizeRoute(route.fullPath);
      const segments = routeSegments(route.fullPath);

      if (normalizedRequestRoutes.has(normalized)) {
        matchedRoutes.push(route.fullPath);
        addEvidence(evidence, 'EXACT_ROUTE', route.fullPath, 'route path matches the request exactly');
      } else if (segments.some(segment => requestRouteSegments.has(segment))) {
        matchedRoutes.push(route.fullPath);
        addEvidence(evidence, 'EXACT_ROUTE', route.fullPath, 'route shares a path segment with the request', undefined, EVIDENCE_WEIGHTS.EXACT_ROUTE * 0.7);
      } else if (segments.some(segment => targetNameSet.has(segment))) {
        // "the plan endpoint" — the noun matches a route segment, which is a
        // structural match even though the request contained no slash.
        matchedRoutes.push(route.fullPath);
        addEvidence(evidence, 'EXACT_ROUTE', route.fullPath, 'route segment matches a noun in the request', undefined, EVIDENCE_WEIGHTS.EXACT_ROUTE * 0.6);
      }

      for (const key of route.responseKeys) {
        if (targetNameSet.has(key.toLowerCase())) {
          addEvidence(evidence, 'EXACT_RESPONSE_KEY', key, `handler already returns "${key}" in its response`);
        }
      }
    }

    for (const symbol of node.symbols) {
      if (symbolSet.has(symbol.symbolName)) {
        matchedSymbols.push(symbol.symbolName);
        addEvidence(evidence, 'EXACT_SYMBOL', symbol.symbolName, 'file declares a symbol named in the request');
      }
    }

    for (const literal of node.stringLiterals) {
      if (normalizedRequestRoutes.has(normalizeRoute(literal))) {
        addEvidence(evidence, 'EXACT_STRING', literal, 'file contains the exact operational string from the request');
      }
    }

    // ── Layer 2: framework-aware structure ────────────────────────────────
    if (node.routes.length && routeEvidenceApplies) {
      addEvidence(evidence, 'ROUTE_DEFINITION', String(node.routes.length), 'file defines HTTP routes and the request is about API surface');
    }
    if (node.cliCommands.length && intent.artifactType === 'CLI') {
      addEvidence(evidence, 'CLI_DEFINITION', node.cliCommands.map(c => c.name).join(','), 'file registers CLI commands');
    }
    if (affinity.includes(node.role)) {
      addEvidence(evidence, 'ARTIFACT_ROLE', node.role, `structural role ${node.role} matches the requested artifact`);
    }

    // ── Layer 4: symbol graph ─────────────────────────────────────────────
    let strongSymbolMatch = false;
    for (const symbol of node.symbols) {
      // Score by how much of the symbol's name the request accounts for.
      // `normaliseTonnage` against "normalise the tonnage" covers both parts and
      // is a real match; `assignmentLabel` against a request that merely says
      // "assignment" shares one generic word and is not.
      const parts = symbol.symbolName
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map(part => part.toLowerCase());
      const matchedParts = [...new Set(parts.filter(part => targetNameSet.has(part)))];

      if (matchedParts.length) {
        matchedSymbols.push(symbol.symbolName);
        if (matchedParts.length >= 2 || (parts.length === 1 && matchedParts.length === 1)) strongSymbolMatch = true;
        addEvidence(
          evidence,
          'SYMBOL_DEFINITION',
          symbol.symbolName,
          `symbol name matches ${matchedParts.length} of ${parts.length} request nouns`,
          undefined,
          EVIDENCE_WEIGHTS.SYMBOL_DEFINITION * (matchedParts.length / Math.max(1, parts.length))
        );
      }
      for (const member of symbol.members) {
        if (targetNameSet.has(member.name.toLowerCase())) {
          addEvidence(evidence, 'TYPE_REFERENCE', `${symbol.symbolName}.${member.name}`, 'declared member matches a request noun');
        }
      }
    }

    // ── Layer 5: lexical (deliberately weak) ──────────────────────────────
    const base = path.posix.basename(node.path).toLowerCase();
    const dir = path.posix.dirname(node.path).toLowerCase();
    const baseTokens = base.split(/[^a-z0-9]+/).filter(Boolean);
    const dirTokens = dir.split(/[^a-z0-9]+/).filter(Boolean);

    let filenameHits = 0;
    for (const token of targetNameSet) {
      if (baseTokens.includes(token)) {
        filenameHits += 1;
        lexicalMatches.push(token);
        addEvidence(evidence, 'FILENAME_TOKEN', token, 'filename contains a request token');
      } else if (dirTokens.includes(token)) {
        lexicalMatches.push(token);
        addEvidence(evidence, 'DIRECTORY_TOKEN', token, 'directory contains a request token');
      }
    }

    // ── Negative evidence ─────────────────────────────────────────────────
    if (node.isGenerated) {
      exclusionReasons.push('generated or build output');
      addEvidence(evidence, 'NEGATIVE_GENERATED', node.path, 'generated files are never edit targets');
    }

    const hasStructuralEvidence = evidence.some(item =>
      ['EXPLICIT_PATH', 'EXACT_ROUTE', 'EXACT_SYMBOL', 'EXACT_RESPONSE_KEY', 'EXACT_STRING', 'ROUTE_DEFINITION', 'CLI_DEFINITION', 'ARTIFACT_ROLE'].includes(item.kind)
    );

    if (!hasStructuralEvidence && filenameHits === 0 && lexicalMatches.length > 0) {
      addEvidence(evidence, 'NEGATIVE_DIRECTORY_ONLY', node.path, 'selected only by a broad directory name');
    }

    const score = evidence.reduce((sum, item) => sum + item.weight, 0);

    return {
      path: node.path,
      score,
      rank: 0,
      evidence,
      matchedRoutes: [...new Set(matchedRoutes)],
      matchedSymbols: [...new Set(matchedSymbols)],
      structuralRole: node.role,
      relatedTests: [],
      dependencyDistance: hasStructuralEvidence ? 0 : null,
      lexicalMatches: [...new Set(lexicalMatches)],
      semanticScore: null,
      exclusionReasons,
      selected: false,
    };
  });

  const byPath = new Map(candidates.map(candidate => [candidate.path, candidate]));

  // ── Layer 3: dependency edges from whatever scored structurally ─────────
  const structuralSeeds = candidates
    .filter(candidate => candidate.dependencyDistance === 0 && candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  for (const seed of structuralSeeds) {
    const node = graph.files.get(seed.path);
    if (!node) continue;

    for (const imported of node.imports) {
      const candidate = byPath.get(imported);
      if (!candidate || candidate === seed) continue;
      addEvidence(candidate.evidence, 'DIRECT_IMPORT', seed.path, `imported directly by ${seed.path}`, seed.path);
      candidate.dependencyDistance = candidate.dependencyDistance === 0 ? 0 : 1;

      const nested = graph.files.get(imported);
      for (const secondHop of nested?.imports ?? []) {
        const hopCandidate = byPath.get(secondHop);
        if (!hopCandidate || hopCandidate.dependencyDistance === 0) continue;
        addEvidence(hopCandidate.evidence, 'ONE_HOP_IMPORT', imported, `reached in two hops from ${seed.path}`, imported);
        hopCandidate.dependencyDistance = hopCandidate.dependencyDistance ?? 2;
      }
    }

    // Tests that exercise the seed: by import edge, or by naming its route.
    for (const [testPath, testNode] of graph.files) {
      if (!testNode.isTest) continue;
      const candidate = byPath.get(testPath);
      if (!candidate) continue;

      const importsSeed = testNode.imports.includes(seed.path);
      const namesRoute = seed.matchedRoutes.some(route =>
        testNode.stringLiterals.some(literal => normalizeRoute(literal) === normalizeRoute(route))
      );
      const referencesSymbol = seed.matchedSymbols.some(symbolName =>
        testNode.stringLiterals.includes(symbolName) || testNode.symbols.some(s => s.symbolName === symbolName)
      );

      if (importsSeed || namesRoute || referencesSymbol) {
        addEvidence(candidate.evidence, 'RELATED_TEST', seed.path, `test covers ${seed.path}`, seed.path);
        candidate.dependencyDistance = candidate.dependencyDistance ?? 1;
        seed.relatedTests.push(testPath);
      }
    }
  }

  // Tests unrelated to anything selected are noise.
  for (const candidate of candidates) {
    const node = graph.files.get(candidate.path);
    if (!node?.isTest) continue;
    const related = candidate.evidence.some(item => item.kind === 'RELATED_TEST');
    if (!related && intent.artifactType !== 'TEST') {
      addEvidence(candidate.evidence, 'NEGATIVE_ORPHAN_TEST', candidate.path, 'test with no relationship to any selected source');
      candidate.exclusionReasons.push('test unrelated to the selected source');
    }
  }

  // Isolation rule.
  //
  // A module that nothing in the repository imports, that serves no route and
  // is not a test, and that matched only by name, is almost never the target:
  // it is a decoy sharing vocabulary with the request. This generalises the
  // API-surface reachability rule to every intent, and is what separates
  // `validation/assignment-rules.ts` (imported by a handler, has a test) from
  // `lib/assignment.ts` (imported by nothing).
  for (const candidate of candidates) {
    const node = graph.files.get(candidate.path);
    if (!node) continue;
    // A symbol whose name the request fully accounts for is real evidence,
    // even in a module nothing imports — a standalone utility is a legitimate
    // target. A symbol sharing one generic word is not, which is what keeps a
    // decoy like `assignmentLabel` out.
    const strongSymbol = candidate.evidence.some(
      item => item.kind === 'SYMBOL_DEFINITION' && item.weight >= EVIDENCE_WEIGHTS.SYMBOL_DEFINITION * 0.75
    );
    const hasStrong = strongSymbol || candidate.evidence.some(item =>
      ['EXPLICIT_PATH', 'EXACT_ROUTE', 'EXACT_SYMBOL', 'EXACT_RESPONSE_KEY', 'EXACT_STRING', 'CLI_DEFINITION', 'ARTIFACT_ROLE'].includes(item.kind)
    );
    const connected = candidate.evidence.some(item =>
      ['DIRECT_IMPORT', 'ONE_HOP_IMPORT', 'RELATED_TEST', 'IMPORTED_BY_SELECTED'].includes(item.kind)
    );
    if (hasStrong || connected) continue;
    if (node.importedBy.length === 0 && node.routes.length === 0 && !node.isTest) {
      addEvidence(
        candidate.evidence,
        'NEGATIVE_UNRELATED_ROLE',
        candidate.path,
        'no file imports this module and it matched only by name',
        undefined,
        EVIDENCE_WEIGHTS.NEGATIVE_UNRELATED_ROLE * 2
      );
      candidate.exclusionReasons.push('unreferenced module matched only by name');
    }
  }

  // Reachability rule for API-surface requests.
  //
  // A request about a route or its response is about the API surface. Internal
  // implementation that no handler reaches is not the target, however strongly
  // its filename or an exported symbol name happens to match — that is exactly
  // how a library called `manifest.ts` competes with the handler serving
  // `/manifest`. Applied after dependency edges exist, so "reachable" means an
  // actual import or test edge from something that matched structurally, not a
  // guess. This is a role rule; it names no file, route or symbol.
  if (wantsApiSurface) {
    for (const candidate of candidates) {
      const node = graph.files.get(candidate.path);
      if (!node) continue;
      const servesRoute = node.routes.length > 0;
      const reachable = candidate.evidence.some(item =>
        item.kind === 'DIRECT_IMPORT' || item.kind === 'ONE_HOP_IMPORT' || item.kind === 'RELATED_TEST' || item.kind === 'IMPORTED_BY_SELECTED'
      );
      const namedExplicitly = candidate.evidence.some(item => item.kind === 'EXPLICIT_PATH' || item.kind === 'EXACT_SYMBOL');
      if (servesRoute || reachable || namedExplicitly) continue;

      addEvidence(
        candidate.evidence,
        'NEGATIVE_UNRELATED_ROLE',
        candidate.path,
        'the request targets API surface and no route handler reaches this file',
        undefined,
        EVIDENCE_WEIGHTS.NEGATIVE_UNRELATED_ROLE * 4
      );
      candidate.exclusionReasons.push('not reachable from any route handler');
    }
  }

  for (const candidate of candidates) {
    candidate.score = candidate.evidence.reduce((sum, item) => sum + item.weight, 0);
    candidate.relatedTests = [...new Set(candidate.relatedTests)];
  }

  const ordered = candidates.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  ordered.forEach((candidate, index) => {
    candidate.rank = index + 1;
  });

  // Select only what clears the bar. No padding to a fixed count: a small
  // relevant set beats eight arbitrary files.
  const selected = ordered.filter(candidate => candidate.score >= limits.minScore).slice(0, limits.topK);
  for (const candidate of selected) candidate.selected = true;

  const excluded = ordered.filter(candidate => !candidate.selected);

  return {
    intent,
    candidates: ordered,
    selected,
    excluded,
    stats: {
      filesConsidered: nodes.length,
      routesDiscovered: graph.routes.length,
      symbolsDiscovered: nodes.reduce((sum, node: FileNode) => sum + node.symbols.length, 0),
      graphBuildMs: graph.buildMs,
      rankMs: Date.now() - startedAt,
      cacheHit: false,
    },
  };
}
