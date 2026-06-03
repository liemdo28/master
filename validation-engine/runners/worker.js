/**
 * Worker Validation Runner
 * Validates Worker service startup and health
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const WORKER_PORT = 3002;
const HEALTH_URL = 'http://localhost:3002/health';
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
        const cmd = `tasklist /FI "IMAGENAME eq ${processName}" /NH`;
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
 * Check if port is in use
 */
function checkPort(port) {
    return new Promise((resolve) => {
        const cmd = `netstat -ano | findstr ":${port}"`;
        exec(cmd, { timeout: 10000 }, (err, stdout) => {
            if (err) {
                resolve({ detected: false, details: '', port });
                return;
            }
            const lines = stdout.trim().split('\n').filter(l => l.length > 0);
            resolve({ detected: lines.length > 0, details: stdout.trim(), port });
        });
    });
}

/**
 * Check health endpoint
 */
function checkHealth(url) {
    return new Promise((resolve) => {
        const req = http.get(url, { timeout: 5000 }, (res) => {
            resolve({ reachable: true, statusCode: res.statusCode, url });
        });
        req.on('error', (err) => {
            resolve({ reachable: false, error: err.message, url });
        });
        req.on('timeout', () => {
            req.destroy();
            resolve({ reachable: false, error: 'Timeout', url });
        });
    });
}

/**
 * Capture logs
 */
function captureLogs() {
    ensureLogDir();
    const logFile = path.join(LOG_DIR, 'worker-validation.log');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] Worker validation check\n`;

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

    console.log('[Worker Runner] Starting validation...');

    // 1. Check if process is running
    const processResult = await checkProcess('node.exe');
    result.details.process = processResult;
    console.log(`[Worker Runner] Process check: ${processResult.detected ? 'Detected' : 'Not detected'}`);

    if (processResult.detected) {
        artifacts.push('process:node.exe:detected');
    }

    // 2. Check if port is in use
    const portResult = await checkPort(WORKER_PORT);
    result.details.port = portResult;
    console.log(`[Worker Runner] Port ${WORKER_PORT} check: ${portResult.detected ? 'In use' : 'Not in use'}`);

    if (portResult.detected) {
        artifacts.push(`port:${WORKER_PORT}:in-use`);
    }

    // 3. Check health endpoint
    const healthResult = await checkHealth(HEALTH_URL);
    result.details.health = healthResult;
    console.log(`[Worker Runner] Health check: ${healthResult.reachable ? 'Reachable' : 'Not reachable'}`);

    if (healthResult.reachable) {
        artifacts.push(`health:${HEALTH_URL}:${healthResult.statusCode}`);
    }

    // 4. Capture logs
    const logResult = captureLogs();
    result.details.logs = logResult.content;
    artifacts.push(`logs:${logResult.path}`);

    // Determine exit code
    if (!processResult.detected && !portResult.detected) {
        result.exitCode = 1;
    } else if (!healthResult.reachable) {
        result.exitCode = 1;
    }

    result.artifacts = artifacts;
    result.endedAt = new Date().toISOString();

    console.log(`[Worker Runner] Validation complete. Exit code: ${result.exitCode}`);
    console.log(`[Worker Runner] Artifacts: ${artifacts.length}`);

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
    console.error('[Worker Runner] Error:', err.message);
    process.exit(1);
});
