/**
 * CEO Preference Store — persists CEO preferences, mutes, watch targets.
 * Backed by a JSON file. No sensitive data stored.
 */

import fs from 'fs';
import path from 'path';

const PREF_PATH = path.join(
  process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global',
  'jarvis', 'ceo-preferences.json'
);

export interface MuteRule {
  target: string;       // e.g. "reviews", "disputes", "Stone Oak"
  until: string;        // ISO timestamp
  reason?: string;
}

export interface WatchTarget {
  target: string;
  added_at: string;
  threshold?: string;
}

export interface CeoPreferences {
  language: 'vi' | 'en' | 'mixed';
  alert_level: 'all' | 'warning_only' | 'critical_only';
  daily_briefing_time: string;   // e.g. "07:00"
  mutes: MuteRule[];
  watches: WatchTarget[];
  preferences: Record<string, unknown>;
  updated_at: string;
}

const DEFAULT_PREFS: CeoPreferences = {
  language: 'vi',
  alert_level: 'all',
  daily_briefing_time: '07:00',
  mutes: [],
  watches: [],
  preferences: {},
  updated_at: new Date().toISOString(),
};

function load(): CeoPreferences {
  try {
    if (!fs.existsSync(PREF_PATH)) return { ...DEFAULT_PREFS };
    return JSON.parse(fs.readFileSync(PREF_PATH, 'utf8')) as CeoPreferences;
  } catch { return { ...DEFAULT_PREFS }; }
}

function save(prefs: CeoPreferences) {
  const dir = path.dirname(PREF_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  prefs.updated_at = new Date().toISOString();
  fs.writeFileSync(PREF_PATH, JSON.stringify(prefs, null, 2), 'utf8');
}

export function getPreferences(): CeoPreferences { return load(); }

export function addMute(target: string, durationHours: number, reason?: string) {
  const prefs = load();
  const until = new Date(Date.now() + durationHours * 3600_000).toISOString();
  prefs.mutes = prefs.mutes.filter(m => m.target !== target);
  prefs.mutes.push({ target, until, reason });
  save(prefs);
}

export function addWatch(target: string, threshold?: string) {
  const prefs = load();
  prefs.watches = prefs.watches.filter(w => w.target !== target);
  prefs.watches.push({ target, added_at: new Date().toISOString(), threshold });
  save(prefs);
}

export function isMuted(target: string): boolean {
  const prefs = load();
  const now = Date.now();
  return prefs.mutes.some(m => m.target === target && new Date(m.until).getTime() > now);
}

export function isWatched(target: string): boolean {
  const prefs = load();
  return prefs.watches.some(w => w.target === target);
}

export function setPreference(key: string, value: unknown) {
  const prefs = load();
  prefs.preferences[key] = value;
  save(prefs);
}
