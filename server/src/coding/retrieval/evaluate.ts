/**
 * Retrieval-only evaluation.
 *
 * Measures whether retrieval finds the right files *before* any model runs, so
 * a coding failure can be attributed to retrieval or to reasoning rather than
 * guessed at. Ten tasks across two synthetic repositories with deliberately
 * different conventions; every task declares the files a competent engineer
 * would open.
 *
 * No Mi Core path or symbol appears here.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { clearRetrievalCache, retrieve } from './index';
import type { RetrievalCandidate } from './types';

export interface EvalTask {
  id: string;
  category: string;
  repo: 'harbour' | 'ledger';
  request: string;
  /** Files a competent engineer would open. Top-3 recall is measured on these. */
  expected: string[];
  /** Files that must not appear in the selection. */
  forbidden?: string[];
}

function write(root: string, relative: string, content: string): void {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

/** Express/TypeScript service with routes, services, models and CLI. */
function buildHarbourRepo(root: string): string[] {
  write(root, 'src/index.ts', `
import express from 'express';
import { berthRouter } from './routes/berth-routes';
const app = express();
app.use('/api/berths', berthRouter);
`);
  write(root, 'src/routes/berth-routes.ts', `
import { Router, Request, Response } from 'express';
import { BerthService } from '../services/berth-service';
import { validateAssignment } from '../validation/assignment-rules';

export const berthRouter = Router();
const service = new BerthService();

berthRouter.get('/:code/manifest', (req: Request, res: Response) => {
  const record = service.findBerth(req.params.code);
  res.json({ berthCode: record.berthCode, status: record.status, tonnage: record.tonnage });
});

berthRouter.post('/:code/assign', (req: Request, res: Response) => {
  const problem = validateAssignment(req.body);
  if (problem) return res.status(400).json({ error: problem });
  return res.json({ assigned: true });
});
`);
  write(root, 'src/services/berth-service.ts', `
import type { BerthRecord } from '../domain/berth-types';
import { BerthTable } from '../models/berth-table';

export class BerthService {
  findBerth(code: string): BerthRecord {
    return BerthTable.load(code);
  }
  releaseBerth(code: string): void { void code; }
}
`);
  write(root, 'src/domain/berth-types.ts', `
export interface BerthRecord {
  berthCode: string;
  status: string;
  tonnage: number;
  pilotName: string | null;
}
`);
  write(root, 'src/models/berth-table.ts', `
import type { BerthRecord } from '../domain/berth-types';

export const BERTH_COLUMNS = ['berth_code', 'status', 'tonnage'];

export const BerthTable = {
  load(code: string): BerthRecord {
    return { berthCode: code, status: 'FREE', tonnage: 0, pilotName: null };
  },
};
`);
  write(root, 'src/validation/assignment-rules.ts', `
export function validateAssignment(body: { tonnage?: number }): string | null {
  if ((body.tonnage ?? 0) > 100000) return 'tonnage exceeds limit';
  return null;
}
`);
  write(root, 'src/config/harbour-settings.ts', `
export const HARBOUR_SETTINGS = { maxBerths: 12, timezone: 'UTC' };
`);
  write(root, 'src/cli/harbour-cli.ts', `
export function main(argv: string[]): void {
  switch (argv[2]) {
    case 'drydock': return;
    case 'undock': return;
    default: return;
  }
}
`);
  write(root, 'test/berth-routes.test.ts', `
import { berthRouter } from '../src/routes/berth-routes';
export function run(): void { void berthRouter; }
`);
  write(root, 'test/assignment-rules.test.ts', `
import { validateAssignment } from '../src/validation/assignment-rules';
export function run(): void { void validateAssignment; }
`);
  // Lexical decoys: names collide with request vocabulary but serve nothing.
  write(root, 'src/lib/manifest.ts', 'export function buildManifest(rows: string[]): string { return rows.join(","); }');
  write(root, 'src/lib/status.ts', 'export function formatStatus(value: string): string { return value.toUpperCase(); }');
  write(root, 'src/lib/assignment.ts', 'export function assignmentLabel(code: string): string { return code; }');
  write(root, 'dist/berth-routes.js', 'exports.x = 1;');

  return [
    'src/index.ts',
    'src/routes/berth-routes.ts',
    'src/services/berth-service.ts',
    'src/domain/berth-types.ts',
    'src/models/berth-table.ts',
    'src/validation/assignment-rules.ts',
    'src/config/harbour-settings.ts',
    'src/cli/harbour-cli.ts',
    'test/berth-routes.test.ts',
    'test/assignment-rules.test.ts',
    'src/lib/manifest.ts',
    'src/lib/status.ts',
    'src/lib/assignment.ts',
    'dist/berth-routes.js',
  ];
}

/** An unfamiliar repository: snake_case, no src/, CommonJS, different layout. */
function buildLedgerRepo(root: string): string[] {
  write(root, 'app/http_handlers.js', `
const { post_entry } = require('../domain/entry_writer');
const express = require('express');
const api = express.Router();

api.post('/ledger/:book/entries', (req, res) => {
  const created = post_entry(req.params.book, req.body);
  res.json({ entryId: created.entry_id, balance: created.balance });
});

api.get('/ledger/:book/balance', (req, res) => {
  res.json({ balance: 0 });
});

module.exports = { api };
`);
  write(root, 'domain/entry_writer.js', `
const { ENTRY_FIELDS } = require('./entry_schema');
function post_entry(book, payload) {
  return { entry_id: book + '-1', balance: payload.amount || 0, fields: ENTRY_FIELDS };
}
module.exports = { post_entry };
`);
  write(root, 'domain/entry_schema.js', `
const ENTRY_FIELDS = ['entry_id', 'amount', 'currency'];
module.exports = { ENTRY_FIELDS };
`);
  write(root, 'spec/http_handlers_spec.js', `
const { api } = require('../app/http_handlers');
module.exports = { api };
`);
  write(root, 'tools/ledger_cli.js', `
function main(argv) {
  switch (argv[2]) {
    case 'reconcile': return;
    case 'export': return;
    default: return;
  }
}
module.exports = { main };
`);
  write(root, 'lib/balance.js', 'function balance() { return 0; } module.exports = { balance };');
  write(root, 'lib/entries.js', 'function entries() { return []; } module.exports = { entries };');

  return [
    'app/http_handlers.js',
    'domain/entry_writer.js',
    'domain/entry_schema.js',
    'spec/http_handlers_spec.js',
    'tools/ledger_cli.js',
    'lib/balance.js',
    'lib/entries.js',
  ];
}

export const EVAL_TASKS: EvalTask[] = [
  {
    id: 'route-response-change',
    category: 'route response change',
    repo: 'harbour',
    request: 'Add the pilot name to the berth manifest endpoint response.',
    expected: ['src/routes/berth-routes.ts'],
    forbidden: ['src/lib/manifest.ts', 'dist/berth-routes.js'],
  },
  {
    id: 'service-behaviour-change',
    category: 'service behaviour change',
    repo: 'harbour',
    request: 'The BerthService should refuse to release a berth that is already free.',
    expected: ['src/services/berth-service.ts'],
  },
  {
    id: 'type-property-error',
    category: 'TypeScript property error',
    repo: 'harbour',
    request: "Property 'pilotName' does not exist on type 'BerthRecord'. Fix the type error.",
    expected: ['src/domain/berth-types.ts'],
  },
  {
    id: 'cli-option-change',
    category: 'CLI option change',
    repo: 'harbour',
    request: 'The drydock CLI command should accept an extra option.',
    expected: ['src/cli/harbour-cli.ts'],
  },
  {
    id: 'database-mapping-change',
    category: 'database mapping change',
    repo: 'harbour',
    request: 'The berth table column mapping is missing a column for the pilot.',
    expected: ['src/models/berth-table.ts'],
  },
  {
    id: 'validation-rule-change',
    category: 'validation rule change',
    repo: 'harbour',
    request: 'Assignment validation should also reject a negative tonnage value.',
    expected: ['src/validation/assignment-rules.ts'],
    forbidden: ['src/lib/assignment.ts'],
  },
  {
    id: 'test-only-change',
    category: 'test-only change',
    repo: 'harbour',
    request: 'Add a test case to the assignment rules test covering the upper tonnage bound.',
    expected: ['test/assignment-rules.test.ts'],
  },
  {
    id: 'configuration-lookup',
    category: 'configuration lookup',
    repo: 'harbour',
    request: 'Where is the maximum number of berths configured? Raise the harbour settings limit.',
    expected: ['src/config/harbour-settings.ts'],
  },
  {
    id: 'multi-file-feature',
    category: 'multi-file feature',
    repo: 'harbour',
    request: 'Support filtering the berth manifest response by minimum tonnage in both the route and the service.',
    expected: ['src/routes/berth-routes.ts', 'src/services/berth-service.ts'],
  },
  {
    id: 'unfamiliar-repo-route',
    category: 'unfamiliar repository task',
    repo: 'ledger',
    request: 'The ledger entries endpoint response should also include the currency.',
    expected: ['app/http_handlers.js'],
    forbidden: ['lib/entries.js', 'lib/balance.js'],
  },
];

export interface TaskMetrics {
  id: string;
  category: string;
  top1Hit: boolean;
  top3Recall: number;
  reciprocalRank: number;
  unrelatedRate: number;
  candidateCount: number;
  contextBytes: number;
  latencyMs: number;
  forbiddenSelected: string[];
  selected: string[];
  topRanked: Array<{ rank: number; path: string; score: number }>;
}

export interface EvalReport {
  tasks: TaskMetrics[];
  top1Accuracy: number;
  top3Recall: number;
  meanReciprocalRank: number;
  unrelatedCandidateRate: number;
  averageCandidateCount: number;
  averageContextBytes: number;
  averageLatencyMs: number;
  pathViolations: string[];
  deterministic: boolean;
}

export function runRetrievalEvaluation(): { report: EvalReport; cleanup: () => void } {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-retrieval-eval-'));
  const harbourRoot = path.join(base, 'harbour');
  const ledgerRoot = path.join(base, 'ledger');
  fs.mkdirSync(harbourRoot, { recursive: true });
  fs.mkdirSync(ledgerRoot, { recursive: true });
  const harbourFiles = buildHarbourRepo(harbourRoot);
  const ledgerFiles = buildLedgerRepo(ledgerRoot);

  const repos = {
    harbour: { root: harbourRoot, files: harbourFiles },
    ledger: { root: ledgerRoot, files: ledgerFiles },
  };

  const tasks: TaskMetrics[] = [];
  const pathViolations: string[] = [];
  let deterministic = true;

  for (const task of EVAL_TASKS) {
    const repo = repos[task.repo];
    clearRetrievalCache();
    const startedAt = Date.now();
    const result = retrieve({
      projectId: task.repo,
      sourceSha: 'eval',
      worktreePath: repo.root,
      userRequest: task.request,
      filePaths: repo.files,
    });
    const latencyMs = Date.now() - startedAt;

    // Determinism: identical inputs must reproduce identical ranking.
    const repeat = retrieve({
      projectId: task.repo,
      sourceSha: 'eval',
      worktreePath: repo.root,
      userRequest: task.request,
      filePaths: repo.files,
    });
    if (
      JSON.stringify(result.candidates.map(c => [c.rank, c.path, c.score])) !==
      JSON.stringify(repeat.candidates.map(c => [c.rank, c.path, c.score]))
    ) {
      deterministic = false;
    }

    const ranked = result.candidates;
    const top3 = ranked.slice(0, 3).map(c => c.path);
    const selected = result.selected.map(c => c.path);

    const top1Hit = task.expected.includes(ranked[0]?.path ?? '');
    const found = task.expected.filter(expected => top3.includes(expected));
    const top3Recall = task.expected.length ? found.length / task.expected.length : 0;

    const firstExpectedRank = Math.min(
      ...task.expected.map(expected => ranked.find(c => c.path === expected)?.rank ?? Number.MAX_SAFE_INTEGER)
    );
    const reciprocalRank = firstExpectedRank === Number.MAX_SAFE_INTEGER ? 0 : 1 / firstExpectedRank;

    // "Unrelated" = selected, not expected, and carrying no dependency or test
    // relationship to an expected file.
    const unrelated = result.selected.filter(candidate => {
      if (task.expected.includes(candidate.path)) return false;
      return !candidate.evidence.some(item =>
        ['DIRECT_IMPORT', 'ONE_HOP_IMPORT', 'RELATED_TEST', 'IMPORTED_BY_SELECTED', 'EXACT_ROUTE', 'EXACT_SYMBOL', 'SYMBOL_DEFINITION', 'TYPE_REFERENCE'].includes(item.kind)
      );
    });

    const forbiddenSelected = (task.forbidden ?? []).filter(forbidden => selected.includes(forbidden));

    for (const candidate of ranked) {
      if (candidate.path.includes('..') || path.isAbsolute(candidate.path)) pathViolations.push(candidate.path);
    }

    const contextBytes = result.selected.reduce((sum, candidate) => {
      try {
        return sum + fs.statSync(path.join(repo.root, candidate.path)).size;
      } catch {
        return sum;
      }
    }, 0);

    tasks.push({
      id: task.id,
      category: task.category,
      top1Hit,
      top3Recall,
      reciprocalRank,
      unrelatedRate: result.selected.length ? unrelated.length / result.selected.length : 0,
      candidateCount: result.selected.length,
      contextBytes,
      latencyMs,
      forbiddenSelected,
      selected,
      topRanked: ranked.slice(0, 5).map(c => ({ rank: c.rank, path: c.path, score: c.score })),
    });
  }

  const mean = (values: number[]): number => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

  const report: EvalReport = {
    tasks,
    top1Accuracy: mean(tasks.map(t => (t.top1Hit ? 1 : 0))),
    top3Recall: mean(tasks.map(t => t.top3Recall)),
    meanReciprocalRank: mean(tasks.map(t => t.reciprocalRank)),
    unrelatedCandidateRate: mean(tasks.map(t => t.unrelatedRate)),
    averageCandidateCount: mean(tasks.map(t => t.candidateCount)),
    averageContextBytes: mean(tasks.map(t => t.contextBytes)),
    averageLatencyMs: mean(tasks.map(t => t.latencyMs)),
    pathViolations: [...new Set(pathViolations)],
    deterministic,
  };

  return {
    report,
    cleanup: () => {
      try {
        fs.rmSync(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      } catch {
        // best-effort
      }
    },
  };
}

if (require.main === module) {
  const { report, cleanup } = runRetrievalEvaluation();

  console.log('\n| task | category | top1 | top3 recall | MRR | unrelated | candidates | ms |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const task of report.tasks) {
    console.log(
      `| ${task.id} | ${task.category} | ${task.top1Hit ? 'HIT' : 'miss'} | ${(task.top3Recall * 100).toFixed(0)}% | ` +
        `${task.reciprocalRank.toFixed(2)} | ${(task.unrelatedRate * 100).toFixed(0)}% | ${task.candidateCount} | ${task.latencyMs} |`
    );
  }

  console.log(`\nTop-1 accuracy          ${(report.top1Accuracy * 100).toFixed(1)}%`);
  console.log(`Top-3 recall            ${(report.top3Recall * 100).toFixed(1)}%   (target >= 90%)`);
  console.log(`Mean reciprocal rank    ${report.meanReciprocalRank.toFixed(3)}`);
  console.log(`Unrelated candidate rate ${(report.unrelatedCandidateRate * 100).toFixed(1)}%  (target < 10%)`);
  console.log(`Average candidates      ${report.averageCandidateCount.toFixed(1)}`);
  console.log(`Average context bytes   ${report.averageContextBytes.toFixed(0)}`);
  console.log(`Average latency         ${report.averageLatencyMs.toFixed(0)} ms`);
  console.log(`Path violations         ${report.pathViolations.length}`);
  console.log(`Deterministic           ${report.deterministic}`);

  const forbidden = report.tasks.filter(task => task.forbiddenSelected.length);
  for (const task of forbidden) {
    console.log(`FORBIDDEN SELECTED in ${task.id}: ${task.forbiddenSelected.join(', ')}`);
  }

  const outDir = process.env.MI_RETRIEVAL_EVAL_OUT;
  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'retrieval-evaluation.json'), JSON.stringify({ generatedAt: new Date().toISOString(), report }, null, 2));
  }

  const passed =
    report.top3Recall >= 0.9 &&
    report.unrelatedCandidateRate < 0.1 &&
    report.pathViolations.length === 0 &&
    report.deterministic &&
    forbidden.length === 0;

  cleanup();
  console.log(`\nRetrieval evaluation: ${passed ? 'PASS' : 'FAIL'}`);
  if (!passed) process.exit(1);
}
