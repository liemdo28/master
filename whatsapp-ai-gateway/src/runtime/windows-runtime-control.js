const path = require('path');
const { execFile } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_DIR = path.join(PROJECT_ROOT, 'scripts', 'windows');

const SCRIPTS = {
  start: 'start-gateway-hidden.ps1',
  stop: 'stop-gateway.ps1',
  status: 'status-gateway.ps1',
  installAutostart: 'install-autostart.ps1',
  uninstallAutostart: 'uninstall-autostart.ps1',
};

function scriptPath(name) {
  if (!SCRIPTS[name]) throw new Error(`Unknown runtime action: ${name}`);
  return path.join(SCRIPT_DIR, SCRIPTS[name]);
}

function runScript(name, timeoutMs = 30000) {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath(name)],
      { cwd: PROJECT_ROOT, windowsHide: true, timeout: timeoutMs },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          action: name,
          stdout: String(stdout || '').trim(),
          stderr: String(stderr || '').trim(),
          error: error ? error.message : null,
        });
      }
    );
  });
}

async function getStatus() {
  return runScript('status', 15000);
}

module.exports = {
  PROJECT_ROOT,
  SCRIPT_DIR,
  SCRIPTS,
  getStatus,
  runScript,
};
