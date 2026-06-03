/**
 * Antigravity IDE Validator Runner
 * Validates Antigravity IDE integration capabilities
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = 'E:\\Project\\Master';

async function checkProcess(processName) {
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

async function checkWindow(windowName) {
    return new Promise((resolve) => {
        exec(`tasklist /V /FI "IMAGENAME eq Antigravity IDE.exe" | findstr /I "${windowName}"`, 
            { timeout: 10000 }, (err, stdout) => {
            if (err) {
                resolve({ detected: false, details: '' });
                return;
            }
            resolve({ detected: stdout.trim().length > 0, details: stdout.trim() });
        });
    });
}

async function checkInstallation() {
    const paths = [
        'C:\\Program Files\\Antigravity IDE\\Antigravity IDE.exe',
        'C:\\Program Files (x86)\\Antigravity IDE\\Antigravity IDE.exe',
        'C:\\Users\\liemdo\\AppData\\Local\\Programs\\Antigravity IDE\\Antigravity IDE.exe'
    ];
    
    for (const exePath of paths) {
        if (fs.existsSync(exePath)) {
            return { detected: true, path: exePath };
        }
    }
    return { detected: false, path: null };
}

async function runValidation() {
    const artifacts = [];
    const details = {};
    let exitCode = 0;

    // Check installation
    const install = await checkInstallation();
    details.installation = install;
    if (!install.detected) {
        exitCode = 1;
    } else {
        artifacts.push(install.path);
    }

    // Check running process
    const process = await checkProcess('Antigravity IDE.exe');
    details.process = process;
    if (!process.detected) {
        exitCode = 1;
    }

    // Check window
    const window = await checkWindow('Antigravity');
    details.window = window;

    // Check .claude directory (for file-based integration)
    const claudeDir = path.join(PROJECT_ROOT, '.claude');
    details.claudeDirectory = {
        exists: fs.existsSync(claudeDir),
        path: claudeDir
    };
    if (fs.existsSync(claudeDir)) {
        artifacts.push(claudeDir);
    }

    // Check for existing capability report
    const reportPath = path.join(PROJECT_ROOT, 'agent-os', 'CLINE_ANTIGRAVITY_CAPABILITY_REPORT.md');
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
