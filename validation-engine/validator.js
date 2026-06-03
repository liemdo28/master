/**
 * Validation Engine - Core Validator
 * Validates Agent OS components
 */

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const REGISTRY_PATH = path.join(__dirname, 'validation-registry.json');
const REPORTS_DIR = path.join(__dirname, 'reports');

/**
 * Ensure reports directory exists
 */
function ensureReportsDir() {
    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
}

/**
 * Generate task ID
 */
function generateTaskId(validator) {
    const timestamp = Date.now();
    return `${validator.toUpperCase()}_${timestamp}`;
}

/**
 * HTTP health check
 */
function checkHealthEndpoint(url, timeout = 5000) {
    return new Promise((resolve) => {
        const protocol = url.startsWith('https') ? https : http;
        const req = protocol.get(url, { timeout }, (res) => {
            resolve({ reachable: true, statusCode: res.statusCode, status: 'OK' });
        });
        req.on('error', (err) => {
            resolve({ reachable: false, error: err.message, status: 'FAIL' });
        });
        req.on('timeout', () => {
            req.destroy();
            resolve({ reachable: false, error: 'Timeout', status: 'FAIL' });
        });
    });
}

/**
 * Check if process is running
 */
function checkProcess(processName) {
    return new Promise((resolve) => {
        const isWindows = process.platform === 'win32';
        const cmd = isWindows
            ? `tasklist /FI "IMAGENAME eq ${processName}" /NH`
            : `pgrep -f "${processName}"`;

        exec(cmd, { timeout: 10000 }, (err, stdout) => {
            if (err) {
                resolve({ detected: false, details: err.message });
                return;
            }
            const detected = isWindows
                ? stdout.toLowerCase().includes(processName.toLowerCase())
                : stdout.trim().length > 0;
            resolve({ detected, details: stdout.trim() });
        });
    });
}

/**
 * Check if port is in use
 */
function checkPort(port) {
    return new Promise((resolve) => {
        const isWindows = process.platform === 'win32';
        const cmd = isWindows
            ? `netstat -ano | findstr ":${port}"`
            : `lsof -i :${port}`;

        exec(cmd, { timeout: 10000 }, (err, stdout) => {
            if (err) {
                resolve({ detected: false, details: '' });
                return;
            }
            const lines = stdout.trim().split('\n').filter(l => l.length > 0);
            resolve({ detected: lines.length > 0, details: stdout.trim() });
        });
    });
}

/**
 * Execute validation runner
 */
function runValidation(runnerPath, args = []) {
    return new Promise((resolve) => {
        const runner = spawn('node', [runnerPath, ...args], {
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true
        });

        let stdout = '';
        let stderr = '';

        runner.stdout.on('data', (data) => { stdout += data.toString(); });
        runner.stderr.on('data', (data) => { stderr += data.toString(); });

        runner.on('close', (code) => {
            resolve({
                exitCode: code,
                stdout: stdout.trim(),
                stderr: stderr.trim()
            });
        });

        runner.on('error', (err) => {
            resolve({
                exitCode: -1,
                stdout: '',
                stderr: err.message
            });
        });

        // Timeout after 60 seconds
        setTimeout(() => {
            runner.kill();
            resolve({
                exitCode: -2,
                stdout: stdout.trim(),
                stderr: 'Validation timeout'
            });
        }, 60000);
    });
}

/**
 * Load registry
 */
function loadRegistry() {
    try {
        const content = fs.readFileSync(REGISTRY_PATH, 'utf-8');
        return JSON.parse(content);
    } catch (err) {
        return { validators: {} };
    }
}

/**
 * Generate validation report
 */
function generateReport(result, taskId, validatorName) {
    const report = {
        taskId,
        validator: validatorName,
        status: result.status,
        exitCode: result.exitCode,
        artifacts: result.artifacts || [],
        startedAt: result.startedAt,
        endedAt: result.endedAt,
        details: result.details || {}
    };

    // Write JSON report
    const jsonPath = path.join(REPORTS_DIR, `${taskId}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Generate markdown report - use underscore format for filename
    const validatorFileName = validatorName.toUpperCase().replace(/-/g, '_');
    const mdPath = path.join(REPORTS_DIR, `${validatorFileName}_START_TEST.md`);
    const md = generateMarkdownReport(report, validatorName);
    fs.writeFileSync(mdPath, md);

    return { jsonPath, mdPath, report };
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(report, validator) {
    const statusEmoji = report.status === 'PASS' ? '✅' : report.status === 'FAIL' ? '❌' : '⚠️';
    const timestamp = new Date().toISOString();

    let md = `# ${validator.toUpperCase()} Validation Report\n\n`;
    md += `**Generated:** ${timestamp}\n`;
    md += `**Task ID:** ${report.taskId}\n`;
    md += `**Status:** ${statusEmoji} ${report.status}\n`;
    md += `**Exit Code:** ${report.exitCode}\n\n`;

    md += `## Summary\n\n`;
    md += `- **Started:** ${report.startedAt}\n`;
    md += `- **Ended:** ${report.endedAt}\n`;
    md += `- **Artifacts Count:** ${report.artifacts.length}\n\n`;

    if (report.details.process) {
        md += `## Process Check\n\n`;
        md += `- **Detected:** ${report.details.process.detected ? 'Yes' : 'No'}\n`;
        if (report.details.process.details) {
            md += `\`\`\`\n${report.details.process.details}\n\`\`\`\n`;
        }
    }

    if (report.details.port) {
        md += `## Port Check\n\n`;
        md += `- **Detected:** ${report.details.port.detected ? 'Yes' : 'No'}\n`;
        md += `- **Port:** ${report.details.port.port || 'N/A'}\n`;
    }

    if (report.details.health) {
        md += `## Health Check\n\n`;
        md += `- **Endpoint:** ${report.details.health.url || 'N/A'}\n`;
        md += `- **Reachable:** ${report.details.health.reachable ? 'Yes' : 'No'}\n`;
        md += `- **Status Code:** ${report.details.health.statusCode || 'N/A'}\n`;
    }

    if (report.details.logs) {
        md += `## Logs\n\n`;
        md += `\`\`\`\n${report.details.logs}\n\`\`\`\n`;
    }

    if (report.artifacts.length > 0) {
        md += `## Artifacts\n\n`;
        report.artifacts.forEach((artifact, i) => {
            md += `${i + 1}. ${artifact}\n`;
        });
    } else {
        md += `## Artifacts\n\n`;
        md += `*No artifacts captured*\n`;
    }

    return md;
}

/**
 * Main validation function
 */
async function validate(validatorName, options = {}) {
    const registry = loadRegistry();
    const validator = registry.validators[validatorName];

    if (!validator) {
        return {
            taskId: generateTaskId(validatorName),
            validator: validatorName,
            status: 'UNKNOWN',
            exitCode: -1,
            artifacts: [],
            startedAt: new Date().toISOString(),
            endedAt: new Date().toISOString(),
            error: `Validator '${validatorName}' not found in registry`
        };
    }

    const taskId = generateTaskId(validatorName);
    const startedAt = new Date().toISOString();
    const result = {
        taskId,
        validator: validatorName,
        status: 'UNKNOWN',
        exitCode: 0,
        artifacts: [],
        startedAt,
        endedAt: null,
        details: {}
    };

    try {
        // Load runner
        const runnerPath = path.join(__dirname, 'runners', `${validatorName}.js`);

        if (!fs.existsSync(runnerPath)) {
            result.endedAt = new Date().toISOString();
            return { ...result, error: `Runner not found: ${runnerPath}` };
        }

        // Run validation
        const runnerResult = await runValidation(runnerPath, options.args || []);

        result.exitCode = runnerResult.exitCode;

        // Parse runner output - extract JSON between markers
        try {
            const stdout = runnerResult.stdout;
            const startMarker = '--- VALIDATION_RESULT ---';
            const endMarker = '--- END_RESULT ---';
            
            let parsed = null;
            
            // Try to extract JSON from markers
            if (stdout.includes(startMarker) && stdout.includes(endMarker)) {
                const startIdx = stdout.indexOf(startMarker) + startMarker.length;
                const endIdx = stdout.indexOf(endMarker);
                const jsonStr = stdout.substring(startIdx, endIdx).trim();
                parsed = JSON.parse(jsonStr);
            } else {
                // Try direct JSON parse
                parsed = JSON.parse(stdout);
            }
            
            result.details = parsed.details || {};
            result.artifacts = parsed.artifacts || [];
        } catch (e) {
            result.details = { rawOutput: runnerResult.stdout, errors: runnerResult.stderr };
        }

        // Determine status based on artifacts
        if (result.artifacts.length === 0) {
            result.status = 'FAIL';
        } else if (runnerResult.exitCode === 0) {
            result.status = 'PASS';
        } else {
            result.status = 'FAIL';
        }

        // Check for missing critical data - mark as UNKNOWN
        const hasProcess = result.details.process?.detected === true;
        const hasPort = result.details.port?.detected === true;

        if (!hasProcess && !hasPort && result.artifacts.length === 0) {
            result.status = 'UNKNOWN';
        }

    } catch (err) {
        result.status = 'FAIL';
        result.details = { error: err.message };
    }

    result.endedAt = new Date().toISOString();
    return result;
}

/**
 * CLI interface
 */
async function main() {
    ensureReportsDir();

    const args = process.argv.slice(2);
    const validatorName = args[0];

    if (!validatorName) {
        console.log('Usage: node validator.js <validator-name> [--report]');
        console.log('Available validators:');
        const registry = loadRegistry();
        Object.keys(registry.validators).forEach(name => {
            console.log(`  - ${name}`);
        });
        process.exit(1);
    }

    console.log(`[Validation Engine] Starting validation: ${validatorName}`);

    const result = await validate(validatorName);
    const report = generateReport(result, result.taskId, validatorName);

    console.log(`[Validation Engine] Status: ${result.status}`);
    console.log(`[Validation Engine] Report: ${report.mdPath}`);

    // Output result
    console.log('\n--- RESULT ---');
    console.log(JSON.stringify(result, null, 2));

    // Exit with appropriate code
    const exitCode = result.status === 'PASS' ? 0 : result.status === 'FAIL' ? 1 : 2;
    process.exit(exitCode);
}

// Export for use as module
module.exports = {
    validate,
    checkProcess,
    checkPort,
    checkHealthEndpoint,
    runValidation,
    generateReport
};

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}
