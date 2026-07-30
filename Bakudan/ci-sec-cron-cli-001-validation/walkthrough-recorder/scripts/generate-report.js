#!/usr/bin/env node
/**
 * Generate consolidated walkthrough report (Markdown).
 */
const fs = require('fs');
const path = require('path');
const config = require('../playwright.config');

const roles = ['ceo', 'manager', 'member', 'admin'];
const lines = ['# Walkthrough Report\n', `Generated: ${new Date().toISOString()}\n`];

for (const role of roles) {
    const rp = path.join(config.REPORT_DIR, `${role}-walkthrough-report.json`);
    if (!fs.existsSync(rp)) {
        lines.push(`## ${role.toUpperCase()}: MISSING\n`);
        continue;
    }
    const r = JSON.parse(fs.readFileSync(rp, 'utf8'));
    lines.push(`## ${role.toUpperCase()}: ${r.overall}`);
    lines.push(`Duration: ${r.duration_seconds}s | Steps: ${r.pass_count}/${r.total_steps}\n`);
}

const out = path.join(config.REPORT_DIR, 'walkthrough-summary.md');
fs.mkdirSync(config.REPORT_DIR, { recursive: true });
fs.writeFileSync(out, lines.join('\n'));
console.log(`Report: ${out}`);
