import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const PROFILE_DIR = path.resolve(__dirname, '../../../owner-profile');
const CONSENT_LOG = path.join(PROFILE_DIR, 'consent_log.json');

const FILES = {
  profile: path.join(PROFILE_DIR, 'owner_profile.json'),
  preferences: path.join(PROFILE_DIR, 'preferences.json'),
  health: path.join(PROFILE_DIR, 'health_context.json'),
  relationships: path.join(PROFILE_DIR, 'relationships.json'),
  work_style: path.join(PROFILE_DIR, 'work_style.json'),
};

function ensureDir() {
  if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });
}

function readJson(filePath: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return {};
  }
}

function writeJson(filePath: string, data: Record<string, unknown>) {
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function logConsent(action: 'save' | 'delete', category: string, field?: string) {
  ensureDir();
  const log: unknown[] = readJson(CONSENT_LOG) as unknown as unknown[] || [];
  (log as unknown[]).push({
    timestamp: new Date().toISOString(),
    action,
    category,
    field: field || null,
  });
  fs.writeFileSync(CONSENT_LOG, JSON.stringify(log, null, 2));
}

export const ownerProfile = {
  getAll(): Record<string, unknown> {
    return {
      profile: readJson(FILES.profile),
      preferences: readJson(FILES.preferences),
      work_style: readJson(FILES.work_style),
      relationships: readJson(FILES.relationships),
      // health NOT included in bulk — explicit request only
    };
  },

  getHealth(): Record<string, unknown> {
    return readJson(FILES.health);
  },

  remember(category: string, key: string, value: unknown): void {
    const isHealth = category === 'health';
    const target = FILES[isHealth ? 'health' : category === 'preferences' ? 'preferences'
      : category === 'work_style' ? 'work_style'
      : category === 'relationships' ? 'relationships'
      : 'profile'] as string;
    const data = readJson(target);
    data[key] = value;
    writeJson(target, data);
    logConsent('save', category, key);
  },

  forget(category: string, key?: string): void {
    const isHealth = category === 'health';
    const target = FILES[isHealth ? 'health' : 'profile'] as string;
    if (!key) {
      // Wipe entire category file
      writeJson(target, {});
      logConsent('delete', category);
    } else {
      const data = readJson(target);
      delete data[key];
      writeJson(target, data);
      logConsent('delete', category, key);
    }
  },

  getConsentLog(): unknown[] {
    try {
      return JSON.parse(fs.readFileSync(CONSENT_LOG, 'utf-8'));
    } catch {
      return [];
    }
  },
};
