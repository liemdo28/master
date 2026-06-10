const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const scripts = [
  'scripts/windows/start-gateway-hidden.ps1',
  'scripts/windows/stop-gateway.ps1',
  'scripts/windows/status-gateway.ps1',
  'scripts/windows/install-autostart.ps1',
  'scripts/windows/uninstall-autostart.ps1',
  'scripts/windows/watchdog.ps1',
];

for (const script of scripts) {
  const full = path.join(root, script);
  assert.ok(fs.existsSync(full), `${script} exists`);
  const text = fs.readFileSync(full, 'utf8');
  assert.ok(!text.includes('E:\\Project\\Master\\whatsapp-ai-gateway'), `${script} has no hardcoded project path`);
  if (script !== 'scripts/windows/uninstall-autostart.ps1') {
    assert.ok(text.includes('$PSScriptRoot') || text.includes('$ProjectRoot'), `${script} uses portable project path`);
  }
}

const start = fs.readFileSync(path.join(root, 'scripts/windows/start-gateway-hidden.ps1'), 'utf8');
assert.ok(start.includes('data\\runtime\\gateway.pid'), 'PID path configured');
assert.ok(start.includes('logs\\runtime\\gateway-out.log'), 'stdout log configured');
assert.ok(start.includes('logs\\runtime\\gateway-error.log'), 'stderr log configured');
assert.ok(start.includes('logs\\runtime\\gateway-start.log'), 'startup log configured');
assert.ok(start.includes('Get-NetTCPConnection'), 'duplicate port guard configured');
assert.ok(start.includes('Start-Process'), 'hidden launcher uses Start-Process');
assert.ok(start.includes('Move-Item'), 'PID write uses temp file rename');
assert.ok(!/Add-Content\s+-Path\s+\$OutLog/.test(start), 'launcher does not write startup metadata to stdout log');

const install = fs.readFileSync(path.join(root, 'scripts/windows/install-autostart.ps1'), 'utf8');
assert.ok(install.includes('WhatsApp AI Gateway'), 'task name configured');
assert.ok(install.includes('New-ScheduledTaskTrigger -AtLogOn'), 'logon trigger configured');

const shortcuts = [
  'Start Gateway Hidden.bat',
  'Stop Gateway.bat',
  'Open Dashboard.bat',
  'Gateway Status.bat',
  'Install Auto Start.bat',
  'Uninstall Auto Start.bat',
];
for (const file of shortcuts) {
  assert.ok(fs.existsSync(path.join(root, 'shortcuts', file)), `${file} exists`);
}

try {
  const out = execFileSync('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts/windows/status-gateway.ps1')], { encoding: 'utf8', timeout: 15000 });
  assert.ok(out.includes('Gateway status:'), 'status script runs');
} catch (err) {
  assert.fail(`status script failed: ${err.message}`);
}

console.log('Windows runtime service tests passed');
