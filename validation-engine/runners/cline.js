/**
 * Cline Validation Runner
 * Validates Cline integration and process
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROCESS_NAME = 'code';
const LOG_DIR = path.join(__dirname, '..', 'reports', 'logs');

/**
 * Ensure log directory exists
 */
function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

/**
 * Check if process is running
 */
function checkProcess(processName) {
    return new Promise((resolve) => {
        const cmd = `tasklist /FI "IMAGENAME eq ${processName}*" /NH`;
        exec(cmd, { timeout: 10000 }, (err, stdout) => {
            if (err) {
                resolve({ detected: false, details: err.message });
                return;
            }
            const detected = stdout.toLowerCase().includes(processName.toLowerCase());
            resolve({ detected, details: stdout.trim() });
        });
    });
}

/**
 * Check Cline extension
 */
function checkClineExtension() {
    return new Promise((resolve) => {
        const cmd = 'code --list-extensions';
        exec(cmd, { timeout: 10000 }, (err, stdout) => {
            if (err) {
                resolve({ installed: false, details: err.message });
                return;
            }
            const installed = stdout.toLowerCase().includes('cline');
            resolve({ installed, details: stdout.trim() });
        });
    });
}

/**
 * Capture logs
 */
function captureLogs() {
    ensureLogDir();
    const logFile = path.join(LOG_DIR, 'cline-validation.log');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] Cline validation check\n`;

    try {
        if (fs.existsSync(logFile)) {
            const existingLogs = fs.readFileSync(logFile, 'utf-8');
            return { path: logFile, content: existingLogs, truncated: logEntry };
        }
    } catch (e) {
        // Ignore
    }

    return { path: logFile, content: '', truncated: logEntry };
}

/**
 * Run validation
 */
async function runValidation() {
    const startedAt = new Date().toISOString();
    const artifacts = [];
    const result = {
        startedAt,
        endedAt: null,
        exitCode: 0,
        artifacts: [],
        details: {}
    };

    console.log('[Cline Runner] Starting validation...');

    // 1. Check if VS Code process is running
    const processResult = await checkProcess('code');
    result.details.process = processResult;
    console.log(`[Cline Runner] Process check: ${processResult.detected ? 'Detected' : 'Not detected'}`);

    if (processResult.detected) {
        artifacts.push('process:code:detected');
    }

    // 2. Check Cline extension
    const extensionResult = await checkClineExtension();
    result.details.extension = extensionResult;
    console.log(`[Cline Runner] Extension check: ${extensionResult.installed ? 'Installed' : 'Not installed'}`);

    if (extensionResult.installed) {
        artifacts.push('extension:cline:installed');
    }

    // 3. Capture logs
    const logResult = captureLogs();
    result.details.logs = logResult.content;
    artifacts.push(`logs:${logResult.path}`);

    // Determine exit code
    if (!processResult.detected) {
        result.exitCode = 1;
    }

    result.artifacts = artifacts;
    result.endedAt = new Date().toISOString();

    console.log(`[Cline Runner] Validation complete. Exit code: ${result.exitCode}`);
    console.log(`[Cline Runner] Artifacts: ${artifacts.length}`);

    return result;
}

/**
 * Main
 */
async function main() {
    const result = await runValidation();

    console.log('\n--- VALIDATION_RESULT ---');
    console.log(JSON.stringify(result));
    console.log('--- END_RESULT ---');

    process.exit(result.exitCode);
}

main().catch((err) => {
    console.error('[Cline Runner] Error:', err.message);
    process.exit(1);
});
