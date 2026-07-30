#!/usr/bin/env node
/**
 * CEO Walkthrough Recorder
 * Records a full CEO walkthrough: login → navigate all CEO routes → screenshot each → save video.
 */
const { launchRecorder, login, walkRoutes, finalize, saveReport } = require('./shared');

(async () => {
    const role = 'ceo';
    console.log(`\n🎬 Recording ${role.toUpperCase()} walkthrough...\n`);
    const startTime = Date.now();

    const { context, page } = await launchRecorder(role);

    try {
        await login(page, role);
        const results = await walkRoutes(page, role);
        const videoPath = await finalize(context, page, role);
        const report = saveReport(role, results, videoPath, startTime);

        console.log(`\n${report.overall === 'PASS' ? '✅' : '❌'} CEO Walkthrough: ${report.overall}`);
        console.log(`   Duration: ${report.duration_seconds}s (min: ${report.min_duration_seconds}s)`);
        console.log(`   Steps: ${report.pass_count}/${report.total_steps} passed\n`);

        process.exit(report.overall === 'PASS' ? 0 : 1);
    } catch (err) {
        console.error(`\n❌ CEO walkthrough failed: ${err.message}\n`);
        await context.close().catch(() => { });
        process.exit(1);
    }
})();
