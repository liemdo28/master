#!/usr/bin/env node
/**
 * Release Gate Check
 * Verifies all walkthrough reports exist and pass before allowing release publish.
 *
 * Usage: npm run gate:check
 * Exit 0 = all pass, Exit 1 = blocked
 */
const fs = require('fs');
const path = require('path');
const config = require('../playwright.config');

const REQUIRED_ROLES = ['ceo', 'manager', 'member', 'admin'];

console.log('\n🔒 Release Gate Check\n');
console.log('─'.repeat(50));

let allPass = true;
const results = [];

for (const role of REQUIRED_ROLES) {
    const reportPath = path.join(config.REPORT_DIR, `${role}-walkthrough-report.json`);

    if (!fs.existsSync(reportPath)) {
        console.log(`  ❌ ${role.toUpperCase()}: Report MISSING (${reportPath})`);
        results.push({ role, status: 'MISSING', reason: 'Report file not found' });
        allPass = false;
        continue;
    }

    try {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

        // Check overall pass
        if (report.overall !== 'PASS') {
            console.log(`  ❌ ${role.toUpperCase()}: FAIL (${report.fail_count} steps failed)`);
            results.push({ role, status: 'FAIL', reason: `${report.fail_count} steps failed` });
            allPass = false;
            continue;
        }

        // Check minimum duration
        if (!report.duration_pass) {
            console.log(`  ❌ ${role.toUpperCase()}: DURATION FAIL (${report.duration_seconds}s < ${report.min_duration_seconds}s)`);
            results.push({ role, status: 'DURATION_FAIL', reason: `${report.duration_seconds}s < ${report.min_duration_seconds}s minimum` });
            allPass = false;
            continue;
        }

        // Check freshness (report must be < 7 days old)
        const reportDate = new Date(report.date);
        const daysSince = (Date.now() - reportDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 7) {
            console.log(`  ⚠️  ${role.toUpperCase()}: STALE (${Math.round(daysSince)} days old — re-record required)`);
            results.push({ role, status: 'STALE', reason: `Report is ${Math.round(daysSince)} days old` });
            allPass = false;
            continue;
        }

        console.log(`  ✅ ${role.toUpperCase()}: PASS (${report.pass_count}/${report.total_steps} steps, ${report.duration_seconds}s)`);
        results.push({ role, status: 'PASS', duration: report.duration_seconds, steps: report.total_steps });
    } catch (err) {
        console.log(`  ❌ ${role.toUpperCase()}: PARSE ERROR (${err.message})`);
        results.push({ role, status: 'ERROR', reason: err.message });
        allPass = false;
    }
}

console.log('─'.repeat(50));

if (allPass) {
    console.log('\n✅ RELEASE GATE: OPEN — All walkthroughs pass\n');
    // Write gate status file
    const gateFile = path.join(config.REPORT_DIR, 'gate-status.json');
    fs.writeFileSync(gateFile, JSON.stringify({
        status: 'OPEN',
        checked_at: new Date().toISOString(),
        roles: results,
    }, null, 2));
    process.exit(0);
} else {
    console.log('\n❌ RELEASE GATE: BLOCKED — Fix failures above before publishing\n');
    const gateFile = path.join(config.REPORT_DIR, 'gate-status.json');
    fs.writeFileSync(gateFile, JSON.stringify({
        status: 'BLOCKED',
        checked_at: new Date().toISOString(),
        roles: results,
    }, null, 2));
    process.exit(1);
}
