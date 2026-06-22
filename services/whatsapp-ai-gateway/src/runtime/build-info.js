const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const packageJson = require('../../package.json');

const versionJson = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '../../version.json'), 'utf8')); } catch (_) { return null; }
})();

const startedAt = new Date().toISOString();
const buildTime = process.env.BUILD_TIME || startedAt;
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: path.resolve(__dirname, '../..'),
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
  } catch (_) {
    return 'unknown';
  }
})();

const buildId = process.env.BUILD_ID || `${buildTime.replace(/[-:T.Z]/g, '').slice(0, 12)}-${commit}`;

function getBuildInfo() {
  return {
    name: 'Admin Control Center v1',
    version: versionJson ? `v${versionJson.version}` : `v${packageJson.version}`,
    app_version: versionJson?.version || packageJson.version,
    app_build: versionJson?.build || null,
    app_channel: versionJson?.channel || 'stable',
    app_release_date: versionJson?.releaseDate || null,
    build_id: buildId,
    build_time: buildTime,
    commit,
    startedAt,
    language_engine: 'v2',
    pid: process.pid,
    cwd: process.cwd(),
    node: process.version,
    entry: process.argv.slice(1).join(' '),
  };
}

function formatVersionReply() {
  const info = getBuildInfo();
  let template = { version: null, rowCount: 0, source: 'unavailable' };
  try {
    template = require('../templates/template-cache').getStatus();
  } catch (_) {}
  return [
    '*WhatsApp AI Gateway Version*',
    '',
    'Build:',
    info.build_id,
    '',
    'Commit:',
    info.commit,
    '',
    'Template:',
    `${template.rowCount || 0} items`,
    `Version: ${template.version || '—'}`,
    `Source: ${template.source || 'unavailable'}`,
    '',
    'Language:',
    `Engine: ${info.language_engine}`,
    'Persistence: session.language + user memory',
    '',
    `Build Time: ${info.build_time}`,
    `Started: ${info.startedAt}`,
    `PID: ${info.pid}`,
  ].join('\n');
}

module.exports = { getBuildInfo, formatVersionReply };
