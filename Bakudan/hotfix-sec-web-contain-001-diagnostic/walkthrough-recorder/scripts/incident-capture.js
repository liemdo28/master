#!/usr/bin/env node
/**
 * Incident Capture — Records a targeted walkthrough when an incident is reported.
 * Captures the current state of affected pages for post-mortem analysis.
 *
 * Usage: node scripts/incident-capture.js --routes "/overview,/admin/releases" --label "release-publish-fail"
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const config = require('../playwright.config');

const args = process.argv.slice(2);
const routeArg = args.find(a => a.startsWith('--routes='))?.split('=')[1]
    || args[args.indexOf('--routes') + 1]
    || '/overview';
const label = args.find(a => a.startsWith('--label='))?.split('=')[1]
    || args[args.indexOf('--label') + 1]
    || `incident-${Date.now()}`;

const routes = routeArg.split(',').map(r => r.trim());

(async () => {
    console.log(`\n🚨 Incident Capture: ${label}`);
    console.log(`   Routes: ${routes.join(', ')}\n`);

    const incidentDir = path.join(config.OUTPUT_DIR, 'incidents', label);
    fs.mkdirSync(incidentDir, { recursive: true });

    const context = await chromium.launchPersistentContext(config.USER_DATA_DIR, {
        headless: true,
        viewport: config.VIEWPORT,
        recordVideo: { dir: incidentDir, size: config.VIEWPORT },
        ignoreHTTPSErrors: true,
    });

    const page = context.pages()[0] || await context.newPage();
    const captures = [];

    for (let i = 0; i < routes.length; i++) {
        const route = routes[i];
        const url = `${config.TARGET_URL}${route}`;
        console.log(`  [${i + 1}/${routes.length}] ${route}`);

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(2000);

            const screenshotPath = path.join(incidentDir, `${String(i + 1).padStart(2, '0')}-${route.replace(/\//g, '_').slice(1)}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: true });

            // Capture console errors
            const consoleErrors = [];
            page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

            captures.push({ route, screenshot: screenshotPath, status: 'captured', errors: consoleErrors });
        } catch (err) {
            captures.push({ route, status: 'failed', error: err.message });
            console.log(`    ✗ ${err.message}`);
        }
    }

    await context.close();

    // Save incident report
    const report = {
        label,
        captured_at: new Date().toISOString(),
        routes: captures,
        total: captures.length,
        failed: captures.filter(c => c.status === 'failed').length,
    };

    const reportPath = path.join(incidentDir, 'incident-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n  ✓ Incident captured: ${incidentDir}`);
    console.log(`  ✓ Report: ${reportPath}\n`);
})();
