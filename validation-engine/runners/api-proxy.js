/**
 * API Proxy Validator Runner
 * Validates API Proxy startup and health
 */

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const PROJECT_ROOT = 'E:\\Project\\Master';
const PROXY_SCRIPT = path.join(PROJECT_ROOT, 'Agent', 'agent-coding-api-keys', 'start-proxy-background.ps1');
const PROXY_MAIN = path.join(PROJECT_ROOT, 'Agent', 'agent-coding-api-keys', 'proxy.js');
const PORT = 3456;
const HEALTH_ENDPOINT = `http://localhost:${PORT}/health`;

async function checkHealthEndpoint(url, timeout = 5000) {
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

function checkProcess(processName) {
    return new Promise((resolve) => {
        exec(`tasklist /FI "IMAGENAME eq ${processName}" /NH`, { timeout: 10000 }, (err, stdout) => {
            if (err) {
                resolve({ detected: false, details: err.message });
                return;
            }
            const detected = stdout.toLowerCase().includes(processName.toLowerCase());
            resolve({ detected, details: stdout.trim() });
        });
    });
}

function checkPort(port) {
    return new Promise((resolve) => {
        exec(`netstat -ano | findstr ":${port}"`, { timeout: 10000 }, (err, stdout) => {
            if (err) {
                resolve({ detected: false, details: '' });
                return;
            }
            const lines = stdout.trim().split('\n').filter(l => l.length > 0);
            resolve({ detected: lines.length > 0, details: stdout.trim(), port });
        });
    });
}

async function runValidation() {
    const artifacts = [];
    const details = {};
    let exitCode = 0;

    // Check if proxy script exists
    if (fs.existsSync(PROXY_SCRIPT)) {
        const stats = fs.statSync(PROXY_SCRIPT);
        artifacts.push(PROXY_SCRIPT);
        details.script = {
            exists: true,
            path: PROXY_SCRIPT,
            size: stats.size
        };
    } else {
        details.script = { exists: false, path: PROXY_SCRIPT };
        exitCode = 1;
    }

    // Check if proxy main file exists
    if (fs.existsSync(PROXY_MAIN)) {
        const stats = fs.statSync(PROXY_MAIN);
        artifacts.push(PROXY_MAIN);
        details.main = {
            exists: true,
            path: PROXY_MAIN,
            size: stats.size
        };
    } else {
        details.main = { exists: false, path: PROXY_MAIN };
        exitCode = 1;
    }

    // Check if proxy process is running
    const nodeProcess = await checkProcess('node.exe');
    details.process = nodeProcess;
    
    // Check if port is active
    const portCheck = await checkPort(PORT);
    details.port = portCheck;

    // Check health endpoint
    if (portCheck.detected) {
        const health = await checkHealthEndpoint(HEALTH_ENDPOINT);
        details.health = health;
        if (!health.reachable) {
            exitCode = 1;
        }
    } else {
        details.health = { reachable: false, error: 'Port not active', status: 'FAIL' };
        exitCode = 1;
    }

    // Log file check
    const logFile = path.join(PROJECT_ROOT, 'artifact-registry', 'logs', 'api-proxy.log');
    if (fs.existsSync(logFile)) {
        artifacts.push(logFile);
        details.logs = logFile;
    }

    // Validation report
    const reportPath = path.join(PROJECT_ROOT, 'artifact-registry', 'api-proxy', 'API_PROXY_START_TEST.md');
    if (fs.existsSync(reportPath)) {
        artifacts.push(reportPath);
    }

    return {
        exitCode,
        details,
        artifacts
    };
}

// Run if executed directly
if (require.main === module) {
    runValidation().then(result => {
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.exitCode);
    }).catch(err => {
        console.error(JSON.stringify({ exitCode: 1, error: err.message }));
        process.exit(1);
    });
}

module.exports = { runValidation };
