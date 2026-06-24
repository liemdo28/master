'use strict';
/**
 * auto-updater-service.js
 *
 * Node.js AutoUpdaterService wrapping the existing update-service.js components.
 * Provides:
 *   - VersionManager    — read/write version.json, compare versions
 *   - UpdateDownloader  — HTTPS download with SHA256 verification + progress events
 *   - RollbackManager   — list backups, trigger rollback via bakudan-updater.ps1
 *   - AutoUpdaterService — orchestrates all the above
 *
 * The actual stop/replace/start is handled by updater/bakudan-updater.ps1 (PowerShell).
 * This module handles the Node.js side: version checks, download, signaling the UI.
 *
 * Usage:
 *   const { AutoUpdaterService } = require('./auto-updater-service');
 *   const updater = new AutoUpdaterService();
 *   await updater.checkAndNotify();
 */

const path   = require('path');
const fs     = require('fs');
const { EventEmitter } = require('events');

const BASE_SERVICE = require('./update-service');
const { makeLogger } = require('../logger');
const log = makeLogger('auto-updater');

const APP_ROOT   = process.cwd();
const DATA_ROOT  = process.env.PROGRAMDATA ? path.join(process.env.PROGRAMDATA, 'BakudanFoodSafety') : path.join(APP_ROOT, 'data');
const BACKUPS_DIR = path.join(DATA_ROOT, 'backups');
const VERSION_FILE = path.join(APP_ROOT, 'version.json');

// ── VersionManager ────────────────────────────────────────────────────────────

class VersionManager {
  read() {
    try {
      return JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
    } catch (_) {
      return { version: '0.0.0', build: 'unknown', channel: 'stable' };
    }
  }

  write(data) {
    fs.mkdirSync(path.dirname(VERSION_FILE), { recursive: true });
    fs.writeFileSync(VERSION_FILE, JSON.stringify(data, null, 2));
  }

  compare(a, b) {
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) > (pb[i] || 0)) return 1;
      if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    }
    return 0;
  }

  isNewer(candidate, current) {
    return this.compare(candidate, current) > 0;
  }

  getCurrentVersion() {
    return this.read().version || '0.0.0';
  }
}

// ── UpdateDownloader ──────────────────────────────────────────────────────────

class UpdateDownloader extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * Download a URL to destPath with SHA256 verification and progress events.
   * Emits: 'progress' { received, total, percent }
   * @returns {Promise<{ path, sha256, size }>}
   */
  async download(url, destPath, expectedSha256) {
    this.emit('start', { url, destPath });
    try {
      const result = await BASE_SERVICE.downloadFile(url, destPath, expectedSha256);
      this.emit('complete', result);
      return result;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Download the update package described by a manifest.
   * Saves to a temp file and returns the local path.
   * @param {{ downloadUrl, sha256, latestVersion }} manifest
   * @returns {Promise<string>} local zip path
   */
  async downloadFromManifest(manifest) {
    if (!manifest?.downloadUrl) throw new Error('Manifest missing downloadUrl');
    if (!manifest.downloadUrl.startsWith('https://')) throw new Error('downloadUrl must use HTTPS');
    const tmpDir = require('os').tmpdir();
    const destPath = path.join(tmpDir, `BakudanFoodSafety-${manifest.latestVersion || 'update'}.zip`);
    await this.download(manifest.downloadUrl, destPath, manifest.sha256);
    return destPath;
  }
}

// ── RollbackManager ───────────────────────────────────────────────────────────

class RollbackManager {
  listBackups() {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) return [];
      return fs.readdirSync(BACKUPS_DIR)
        .filter(name => {
          try { return fs.statSync(path.join(BACKUPS_DIR, name)).isDirectory(); } catch (_) { return false; }
        })
        .sort()
        .reverse()
        .map(name => {
          const dir = path.join(BACKUPS_DIR, name);
          const metaFile = path.join(dir, 'backup-meta.json');
          let meta = null;
          try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')); } catch (_) {}
          return { name, path: dir, meta };
        });
    } catch (_) {
      return [];
    }
  }

  getLatestBackup() {
    const backups = this.listBackups();
    return backups[0] || null;
  }

  /**
   * Trigger rollback via the PowerShell updater script (SSE-streamable).
   * Returns a child_process for the caller to pipe.
   * @param {string} target - backup folder name or 'latest'
   */
  spawnRollback(target = 'latest') {
    const { spawn } = require('child_process');
    const ps1 = path.join(APP_ROOT, 'updater', 'bakudan-updater.ps1');
    if (!fs.existsSync(ps1)) throw new Error('bakudan-updater.ps1 not found at ' + ps1);
    return spawn('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, 'rollback', target,
    ], { cwd: APP_ROOT });
  }

  /**
   * Record a rollback event in the update log.
   */
  recordRollback(fromVersion, toVersion, status, note = '') {
    BASE_SERVICE.appendUpdateLog({ action: 'rollback', from: fromVersion, to: toVersion, status, note });
  }
}

// ── AutoUpdaterService ────────────────────────────────────────────────────────

class AutoUpdaterService extends EventEmitter {
  constructor() {
    super();
    this.versionManager  = new VersionManager();
    this.downloader      = new UpdateDownloader();
    this.rollbackManager = new RollbackManager();
    this._autoCheckTimer = null;
  }

  /**
   * Check for updates and emit 'update-available' if one exists.
   * @returns {Promise<{ updateAvailable, current, manifest, error? }>}
   */
  async checkForUpdates() {
    try {
      const result = await BASE_SERVICE.checkForUpdates();
      if (result.updateAvailable) {
        log.info('Update available', { from: result.current?.version, to: result.manifest?.latestVersion });
        this.emit('update-available', result);
      } else if (result.ok) {
        log.info('No update available', { current: result.current?.version });
        this.emit('up-to-date', result);
      } else {
        log.warn('Update check failed', { error: result.error });
        this.emit('check-error', result);
      }
      return result;
    } catch (err) {
      const r = { ok: false, error: err.message, current: this.versionManager.read() };
      this.emit('check-error', r);
      return r;
    }
  }

  /**
   * Check and notify — convenience method for the startup check.
   */
  async checkAndNotify() {
    return this.checkForUpdates();
  }

  /**
   * Download the update package for a given manifest.
   * @param {Object} manifest
   * @returns {Promise<string>} local zip path
   */
  async downloadUpdate(manifest) {
    this.emit('download-start', manifest);
    try {
      const zipPath = await this.downloader.downloadFromManifest(manifest);
      this.emit('download-complete', { zipPath, manifest });
      BASE_SERVICE.appendUpdateLog({ action: 'download', from: this.versionManager.getCurrentVersion(), to: manifest.latestVersion, status: 'ok' });
      return zipPath;
    } catch (err) {
      this.emit('download-error', { error: err.message, manifest });
      BASE_SERVICE.appendUpdateLog({ action: 'download', from: this.versionManager.getCurrentVersion(), to: manifest.latestVersion, status: 'failed', note: err.message });
      throw err;
    }
  }

  /**
   * Spawn the PowerShell updater (update command) and return the child process.
   * The server's SSE endpoint streams this to the browser.
   */
  spawnInstall() {
    const { spawn } = require('child_process');
    const ps1 = path.join(APP_ROOT, 'updater', 'bakudan-updater.ps1');
    if (!fs.existsSync(ps1)) throw new Error('bakudan-updater.ps1 not found');
    return spawn('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, 'update',
    ], { cwd: APP_ROOT });
  }

  /**
   * Trigger rollback (spawns PS1).
   */
  spawnRollback(target = 'latest') {
    return this.rollbackManager.spawnRollback(target);
  }

  /**
   * List available rollback backups.
   */
  listBackups() {
    return this.rollbackManager.listBackups();
  }

  /**
   * Get current version info.
   */
  getVersionInfo() {
    return {
      ...this.versionManager.read(),
      backups: this.rollbackManager.listBackups().slice(0, 5).map(b => ({
        name: b.name,
        created_at: b.meta?.createdAt,
        app_version: b.meta?.appVersion,
      })),
    };
  }

  /**
   * Start background auto-check (delegates to base service).
   */
  startAutoCheck() {
    BASE_SERVICE.startAutoCheck();
    log.info('AutoUpdaterService: background check started');
  }

  /**
   * Stop background auto-check.
   */
  stopAutoCheck() {
    BASE_SERVICE.stopAutoCheck();
  }

  /**
   * Get last check result.
   */
  getLastCheckResult() {
    return BASE_SERVICE.getLastCheckResult();
  }

  /**
   * Get update log.
   */
  getUpdateLog() {
    return BASE_SERVICE.readUpdateLog();
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

let _instance = null;

function getInstance() {
  if (!_instance) _instance = new AutoUpdaterService();
  return _instance;
}

module.exports = {
  AutoUpdaterService,
  VersionManager,
  UpdateDownloader,
  RollbackManager,
  getInstance,
};
