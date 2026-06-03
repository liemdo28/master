#!/usr/bin/env tsx
/**
 * CLI runner for protocol compatibility tests.
 *
 * Usage:
 *   npx tsx src/tests/compatibility/run-tests.ts [client]
 *
 * Examples:
 *   npx tsx src/tests/compatibility/run-tests.ts          # Run all tests
 *   npx tsx src/tests/compatibility/run-tests.ts cline    # Run Cline tests only
 *   npx tsx src/tests/compatibility/run-tests.ts claude-code
 */

import { runAllTests, runClientTests } from './test-runner.js';

const client = process.argv[2];
const baseUrl = process.env.GATEWAY_TEST_URL ?? 'http://127.0.0.1:3456';

console.log(`\n┌─ Antigravity Gateway — Protocol Compatibility Tests ─────────`);
console.log(`│  Target: ${baseUrl}`);
console.log(`│  Client: ${client ?? 'ALL'}`);
console.log(`└──────────────────────────────────────────────────────────────\n`);

async function main() {
    try {
        const suites = client
            ? [await runClientTests(client, baseUrl)]
            : await runAllTests(baseUrl);

        let totalPass = 0;
        let totalFail = 0;

        for (const suite of suites) {
            console.log(`\n  ═══ ${suite.name} ═══`);
            for (const test of suite.tests) {
                const icon = test.passed ? '✅' : '❌';
                const time = `${test.durationMs}ms`;
                console.log(`  ${icon} ${test.name} (${time})`);
                if (!test.passed && test.error) {
                    console.log(`     └─ ${test.error}`);
                }
                if (!test.passed && test.details) {
                    console.log(`     └─ ${JSON.stringify(test.details)}`);
                }
            }
            console.log(`  ── ${suite.passCount}/${suite.tests.length} passed (${suite.totalDurationMs}ms)`);
            totalPass += suite.passCount;
            totalFail += suite.failCount;
        }

        console.log(`\n  ═══════════════════════════════════════════════════`);
        console.log(`  TOTAL: ${totalPass} passed, ${totalFail} failed`);
        console.log(`  ═══════════════════════════════════════════════════\n`);

        process.exit(totalFail > 0 ? 1 : 0);
    } catch (err) {
        console.error(`\n  ❌ Test runner failed:`, err instanceof Error ? err.message : err);
        console.error(`     Is the gateway running at ${baseUrl}?`);
        process.exit(1);
    }
}

main();
