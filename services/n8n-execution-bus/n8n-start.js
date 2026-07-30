/**
 * n8n launcher for PM2 on Windows.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'n8n-launch.log');
const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
  process.stdout.write(line);
};

const n8nBin = 'C:/Users/liemdo/AppData/Roaming/npm/node_modules/n8n/bin/n8n';
log('Starting n8n wrapper...');
log(`process.execPath: ${process.execPath}`);
log(`process.argv: ${JSON.stringify(process.argv)}`);
log(`CWD: ${process.cwd()}`);

const env = {
  ...process.env,
  N8N_PORT: '5678',
  N8N_LOG_LEVEL: 'info',
};

const child = spawn(process.execPath, [n8nBin, 'start'], {
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

log(`Spawned n8n PID: ${child.pid}`);

child.stdout.on('data', (d) => {
  const s = d.toString();
  fs.appendFileSync(LOG_FILE, s);
  process.stdout.write(s);
});
child.stderr.on('data', (d) => {
  const s = d.toString();
  fs.appendFileSync(LOG_FILE, '[ERR] ' + s);
  process.stderr.write(s);
});

child.on('exit', (code, signal) => {
  log(`n8n exited code=${code} signal=${signal}`);
  process.exit(code ?? 1);
});

child.on('error', (err) => {
  log(`spawn error: ${err.message}`);
  process.exit(1);
});

log('Event handlers set up. Waiting for n8n...');
