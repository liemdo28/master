import { execFileSync } from 'child_process';
import type { TestRunResult } from './types';

export function runTestCommand(command: string, args: string[], cwd: string): TestRunResult {
  try {
    const output = execFileSync(command, args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    return {
      tests: 1,
      passed: 1,
      failed: 0,
      suites: [args.join(' ') || command],
      command: [command, ...args].join(' '),
      executed: true,
      output,
      capturedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      tests: 1,
      passed: 0,
      failed: 1,
      suites: [args.join(' ') || command],
      command: [command, ...args].join(' '),
      executed: true,
      output: String(err?.stdout || err?.stderr || err?.message || err),
      capturedAt: new Date().toISOString(),
    };
  }
}

export function noTestsExecuted(reason: string): TestRunResult {
  return {
    tests: 0,
    passed: 0,
    failed: 0,
    suites: [],
    command: 'none',
    executed: false,
    output: reason,
    capturedAt: new Date().toISOString(),
  };
}
