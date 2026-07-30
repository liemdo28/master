/**
 * Shared utilities for walkthrough recording.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const config = require('../playwright.config');

/**
 * Launch a persistent browser context with video recording.
 */
async function launchRecorder(role) {
    const outputDir = path.join(config.RECORDING_DIR);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(config.SCREENSHOT_DIR, { recursive: true });
    fs.mkdirSync(config.OUTPUT_DIR, { recursive: true });

    const userDataDir = path.join(config.USER_DATA_DIR, role);
    fs.mkdirSync(userDataDir, { recursive: true });

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: config.HEADLESS,
        slowMo: config.SLOW_MO,
        viewport: config.VIEWPORT,
        recordVideo: {
            dir: outputDir,
            size: config.VIEWPORT,
        },
        ignoreHTTPSErrors: process.env.WALKTHROUGH_IGNORE_HTTPS_ERRORS === '1',
    });

    const page = context.pages()[0] || await context.newPage();
    return { context, page };
}

/**
 * Login to the dashboard with given credentials.
 */
async function login(page, role) {
    const creds = config.CREDENTIALS[role];
    if (!creds || !creds.email || !creds.password) {
        throw new Error(`No credentials configured for role: ${role}. Check .env.local`);
    }

    await page.goto(`${config.TARGET_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Check if already logged in
    if (!page.url().includes('/login')) {
        console.log(`  ✓ Already logged in`);
        return;
    }

    await page.fill('input[name="email"]', creds.email);
    await page.fill('input[name="password"]', creds.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/overview**', { timeout: 15000 }).catch(() => {
        // May redirect to my-tasks for members
        return page.waitForURL('**/my-tasks**', { timeout: 5000 });
    });
    console.log(`  ✓ Logged in as ${role} (${creds.email})`);
}

/**
 * Navigate through all required routes for a role, taking screenshots.
 */
async function walkRoutes(page, role) {
    const routes = config.ROLE_ROUTES[role] || [];
    const results = [];
    let stepNum = 1;

    for (const route of routes) {
        const url = `${config.TARGET_URL}${route}`;
        console.log(`  [${stepNum}/${routes.length}] ${route}`);

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(2000); // Let page render

            // Check for errors
            const hasError = await page.$('.alert-error, [class*="error"]');
            const is404 = await page.title().then(t => t.includes('404'));
            const status = hasError ? 'ERROR' : is404 ? '404' : 'PASS';

            // Screenshot
            const screenshotPath = path.join(
                config.SCREENSHOT_DIR,
                `${role}`,
                `${String(stepNum).padStart(2, '0')}-${route.replace(/\//g, '_').slice(1)}.png`
            );
            fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
            await page.screenshot({ path: screenshotPath, fullPage: false });

            results.push({ route, status, screenshot: screenshotPath });
            if (status !== 'PASS') {
                console.log(`    ⚠ ${status}`);
            }
        } catch (err) {
            results.push({ route, status: 'TIMEOUT', error: err.message });
            console.log(`    ✗ TIMEOUT: ${err.message}`);
        }

        stepNum++;
    }

    return results;
}

/**
 * Finalize recording — close context, rename video file.
 */
async function finalize(context, page, role) {
    // Get video path before closing
    const video = page.video();
    await context.close();

    if (video) {
        const videoPath = await video.path();
        const finalPath = path.join(config.OUTPUT_DIR, `${role}-walkthrough.webm`);
        try {
            fs.renameSync(videoPath, finalPath);
            console.log(`  ✓ Video saved: ${finalPath}`);
            return finalPath;
        } catch (e) {
            console.log(`  ⚠ Video at: ${videoPath}`);
            return videoPath;
        }
    }
    return null;
}

/**
 * Generate a JSON report for the walkthrough.
 */
function saveReport(role, results, videoPath, startTime) {
    const duration = (Date.now() - startTime) / 1000;
    const report = {
        role,
        date: new Date().toISOString(),
        duration_seconds: Math.round(duration),
        min_duration_seconds: config.MIN_DURATION_SECONDS,
        duration_pass: duration >= config.MIN_DURATION_SECONDS,
        video: videoPath,
        steps: results,
        pass_count: results.filter(r => r.status === 'PASS').length,
        fail_count: results.filter(r => r.status !== 'PASS').length,
        total_steps: results.length,
        overall: results.every(r => r.status === 'PASS') && duration >= config.MIN_DURATION_SECONDS ? 'PASS' : 'FAIL',
    };

    const reportPath = path.join(config.REPORT_DIR, `${role}-walkthrough-report.json`);
    fs.mkdirSync(config.REPORT_DIR, { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`  ✓ Report saved: ${reportPath}`);
    return report;
}

module.exports = { launchRecorder, login, walkRoutes, finalize, saveReport, config };
