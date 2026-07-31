// Unit test for the task state machine itself (types.ts ALLOWED_TRANSITIONS),
// with no disk/SQLite involvement — fast, deterministic, isolated from engine.ts.
//
// Run: cd mi-core/server && npx tsx src/task-runtime/__tests__/state-machine.test.ts

import assert from 'assert';
import { ALLOWED_TRANSITIONS } from '../types';
import type { TaskStatus } from '../types';

function log(msg: string) {
  console.log(`[state-machine] ${msg}`);
}

const ALL_STATUSES: TaskStatus[] = [
  'CREATED', 'CONTEXT_BUILDING', 'PLANNING', 'WAITING_APPROVAL', 'READY', 'RUNNING',
  'VALIDATING', 'RECOVERING', 'BLOCKED', 'FAILED', 'COMPLETED', 'CANCELLED', 'ROLLED_BACK',
];

const TERMINAL_STATUSES: TaskStatus[] = ['COMPLETED', 'CANCELLED', 'ROLLED_BACK'];

function run() {
  // Every status must have an entry, even if its allowed-list is empty.
  for (const status of ALL_STATUSES) {
    assert.ok(status in ALLOWED_TRANSITIONS, `ALLOWED_TRANSITIONS missing entry for ${status}`);
  }
  log('all 13 statuses have a transitions entry');

  // Terminal statuses must have zero outgoing transitions.
  for (const status of TERMINAL_STATUSES) {
    assert.deepStrictEqual(ALLOWED_TRANSITIONS[status], [], `${status} must be terminal (no outgoing transitions)`);
  }
  log('confirmed COMPLETED / CANCELLED / ROLLED_BACK are terminal');

  // Every non-terminal status must be able to reach CANCELLED or FAILED
  // eventually (no dead-end that traps a task forever) — check direct or
  // one-hop reachability, which is enough for this slice's state graph.
  for (const status of ALL_STATUSES) {
    if (TERMINAL_STATUSES.includes(status)) continue;
    const direct = ALLOWED_TRANSITIONS[status];
    const oneHop = direct.flatMap(s => ALLOWED_TRANSITIONS[s] ?? []);
    const reachesTerminal = [...direct, ...oneHop].some(s => TERMINAL_STATUSES.includes(s));
    assert.ok(reachesTerminal, `${status} cannot reach a terminal state within 2 hops — possible dead end`);
  }
  log('confirmed no non-terminal status is a dead end (all can reach a terminal state within 2 hops)');

  // No status transitions to itself (would be a silent no-op transition).
  for (const status of ALL_STATUSES) {
    assert.ok(!ALLOWED_TRANSITIONS[status].includes(status), `${status} must not allow a self-transition`);
  }
  log('confirmed no self-transitions are declared');

  // Spot-check the exact acceptance-test path is legal end-to-end.
  const path: TaskStatus[] = ['CREATED', 'CONTEXT_BUILDING', 'PLANNING', 'READY', 'RUNNING', 'VALIDATING', 'COMPLETED'];
  for (let i = 0; i < path.length - 1; i++) {
    assert.ok(
      ALLOWED_TRANSITIONS[path[i]].includes(path[i + 1]),
      `expected ${path[i]} -> ${path[i + 1]} to be legal`
    );
  }
  log('confirmed the full acceptance-test path is legal end-to-end');

  // Spot-check a few transitions that must NOT be legal.
  const illegal: [TaskStatus, TaskStatus][] = [
    ['CREATED', 'COMPLETED'],
    ['CREATED', 'RUNNING'],
    ['COMPLETED', 'RUNNING'],
    ['PLANNING', 'RUNNING'],
  ];
  for (const [from, to] of illegal) {
    assert.ok(!ALLOWED_TRANSITIONS[from].includes(to), `expected ${from} -> ${to} to be illegal`);
  }
  log('confirmed known-illegal jumps remain illegal');

  log('PASS');
}

try {
  run();
  process.exit(0);
} catch (err) {
  console.error('[state-machine] FAIL:', err);
  process.exit(1);
}
