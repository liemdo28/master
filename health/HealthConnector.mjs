/**
 * HealthConnector — Apple Health data bridge for Mi-Core
 *
 * Reads from iCloud-synced JSON/XML export files.
 * Writes to local health.db via HealthDatabase.
 * Follows the same interface as AsanaVisibilityConnector et al.
 *
 * Zero cloud writes. All data stays local.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseJSONExport, parseXMLExport, parseIndividualFiles } from './HealthParser.mjs';
import {
  upsertDailyHealth, upsertSleepSession, bulkInsertHRSamples, upsertWorkout,
  getDailyHealth, getSleepByDate, getRecentDailyHealth, getRecentSleep,
  getRecentWorkouts, getWeeklySummary, getMonthSummary,
  getSyncState, setSyncState,
} from './HealthDatabase.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Preferred iCloud paths (Windows)
const ICLOUD_CANDIDATES = [
  process.env.HEALTH_EXPORT_PATH,
  'C:/Users/liemdo/iCloudDrive/HealthExports',
  path.join(process.env.USERPROFILE || 'C:/Users/liemdo', 'iCloudDrive', 'HealthExports'),
  path.join(process.env.USERPROFILE || 'C:/Users/liemdo', 'iCloud Drive', 'HealthExports'),
  path.join(process.env.USERPROFILE || 'C:/Users/liemdo', 'iCloudDrive', 'Mi Health'),
].filter(Boolean);

export class HealthConnector {
  constructor() {
    this.connectorId = 'apple-health';
    this.name = 'Apple Health (Huawei Watch)';
    this.exportPath = null;
  }

  // ── ConnectorRegistry interface ─────────────────────────────────────────────

  isConfigured() {
    if (this.exportPath) return true;
    for (const p of ICLOUD_CANDIDATES) {
      if (fs.existsSync(p)) {
        this.exportPath = p;
        return true;
      }
    }
    return false;
  }

  async getSnapshot() {
    const today = new Date().toISOString().split('T')[0];
    const daily = getDailyHealth(today);
    const sleep = getSleepByDate(today) || getSleepByDate(this._yesterday());

    return {
      connector_id: this.connectorId,
      name: this.name,
      status: this.isConfigured() ? 'active' : 'unconfigured',
      auth_status: 'local',
      last_sync: getSyncState('last_sync') || null,
      today: daily,
      last_sleep: sleep,
      read_capability: ['steps', 'sleep', 'heart-rate', 'hrv', 'spo2', 'workouts', 'calories'],
    };
  }

  // ── Sync ────────────────────────────────────────────────────────────────────

  async sync(options = {}) {
    if (!this.isConfigured()) {
      return { ok: false, error: 'Export path not found. Run iOS Shortcut first.' };
    }

    const lastSync = options.force ? null : getSyncState('last_sync');

    // Detect format: individual files (Shortcuts native) > combined JSON > XML
    const hasIndividualFiles = fs.existsSync(path.join(this.exportPath, 'steps.json'));
    const jsonPath = path.join(this.exportPath, 'mi-health-export.json');
    const xmlPath  = path.join(this.exportPath, 'export.xml');

    let parsed;
    if (hasIndividualFiles) {
      parsed = parseIndividualFiles(this.exportPath, lastSync);
    } else if (fs.existsSync(jsonPath)) {
      const stat = fs.statSync(jsonPath);
      if (lastSync && stat.mtime <= new Date(lastSync)) {
        return { ok: true, message: 'No new data since last sync.', synced: 0 };
      }
      parsed = parseJSONExport(jsonPath, lastSync);
    } else if (fs.existsSync(xmlPath)) {
      parsed = await parseXMLExport(xmlPath, lastSync);
    } else {
      return { ok: false, error: `No export files found in ${this.exportPath}. Run iOS Shortcut first.` };
    }

    const stats = { days: 0, sleep: 0, hr: 0, workouts: 0 };

    for (const [, day] of Object.entries(parsed.dailyHealth)) {
      upsertDailyHealth(day);
      stats.days++;
    }
    for (const s of parsed.sleepSessions) {
      upsertSleepSession(s);
      stats.sleep++;
    }
    if (parsed.hrSamples.length) {
      bulkInsertHRSamples(parsed.hrSamples);
      stats.hr = parsed.hrSamples.length;
    }
    for (const w of parsed.workouts) {
      upsertWorkout(w);
      stats.workouts++;
    }

    setSyncState('last_sync', new Date().toISOString());

    return { ok: true, synced: stats };
  }

  // ── Query API ────────────────────────────────────────────────────────────────

  getToday() {
    const today = new Date().toISOString().split('T')[0];
    return {
      daily: getDailyHealth(today),
      sleep: getSleepByDate(today) || getSleepByDate(this._yesterday()),
      workouts: [],
    };
  }

  getWeek(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1 - offset * 7); // Monday
    const weekStart = d.toISOString().split('T')[0];
    return getWeeklySummary(weekStart);
  }

  getMonth(yearMonth = null) {
    const ym = yearMonth || new Date().toISOString().slice(0, 7);
    return getMonthSummary(ym);
  }

  getRecentDays(n = 7) {
    return getRecentDailyHealth(n);
  }

  getRecentSleepSessions(n = 7) {
    return getRecentSleep(n);
  }

  getRecentWorkouts(n = 7) {
    return getRecentWorkouts(n);
  }

  // ── Health query answer (used by HealthQueryHandler) ────────────────────────

  answerQuery(query) {
    const q = query.toLowerCase();
    const today = new Date().toISOString().split('T')[0];

    if (/bước|steps/.test(q)) {
      const daily = getDailyHealth(today);
      return {
        type: 'steps',
        date: today,
        value: daily?.steps,
        data: daily,
      };
    }
    if (/ngủ|sleep/.test(q)) {
      const sleep = getSleepByDate(today) || getSleepByDate(this._yesterday());
      return { type: 'sleep', date: today, data: sleep };
    }
    if (/tim|heart|hrv|nhịp/.test(q)) {
      const daily = getDailyHealth(today);
      return { type: 'heart', date: today, data: daily };
    }
    if (/tuần|week/.test(q)) {
      return { type: 'weekly', data: this.getWeek() };
    }
    if (/tháng|month/.test(q)) {
      return { type: 'monthly', data: this.getMonth() };
    }
    return { type: 'summary', data: this.getToday() };
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _yesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }
}

export default new HealthConnector();
