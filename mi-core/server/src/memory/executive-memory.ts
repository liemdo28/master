/**
 * Executive Memory V2 — persistent JSON store, survives restart.
 * Replaces old in-memory owner-profile with file-based, searchable memory.
 * Health data gated by explicit consent.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MI_CORE_ROOT = path.resolve(__dirname, '..', '..', '..');
const GLOBAL_DIR = process.env.GLOBAL_DIR || path.join(MI_CORE_ROOT, '.local-agent-global');
const MEM_DIR = path.join(GLOBAL_DIR, 'executive-memory-v2');

const FILES = {
  owner_profile: path.join(MEM_DIR, 'owner_profile.json'),
  preferences: path.join(MEM_DIR, 'preferences.json'),
  business: path.join(MEM_DIR, 'business_memory.json'),
  decisions: path.join(MEM_DIR, 'decision_memory.json'),
  workflows: path.join(MEM_DIR, 'workflow_memory.json'),
  personal: path.join(MEM_DIR, 'personal_context.json'),   // consent required
  consent_log: path.join(MEM_DIR, 'consent_log.json'),
};

type MemoryKey = keyof typeof FILES;

function ensureDir() { fs.mkdirSync(MEM_DIR, { recursive: true }); }

function read(key: MemoryKey): Record<string, unknown> {
  try { return JSON.parse(fs.readFileSync(FILES[key], 'utf-8')); }
  catch { return {}; }
}

function write(key: MemoryKey, data: Record<string, unknown>) {
  ensureDir();
  fs.writeFileSync(FILES[key], JSON.stringify(data, null, 2));
}

function logConsent(action: 'save' | 'delete' | 'view', category: string, field?: string, note?: string) {
  ensureDir();
  let log: unknown[] = [];
  try { log = JSON.parse(fs.readFileSync(FILES.consent_log, 'utf-8')); } catch { /* init */ }
  (log as object[]).push({
    timestamp: new Date().toISOString(),
    action, category, field: field || null, note: note || null,
  });
  fs.writeFileSync(FILES.consent_log, JSON.stringify(log, null, 2));
}

function categoryToKey(category: string): MemoryKey {
  const map: Record<string, MemoryKey> = {
    profile: 'owner_profile', owner_profile: 'owner_profile',
    preferences: 'preferences', pref: 'preferences', preference: 'preferences',
    business: 'business',
    decisions: 'decisions', decision: 'decisions',
    workflows: 'workflows', workflow: 'workflows',
    personal: 'personal', health: 'personal',
  };
  return map[category.toLowerCase()] || 'preferences';
}

// ---- DEFAULT PROFILE (seed on first run) ----

const DEFAULT_PROFILE: Record<MemoryKey, Record<string, unknown>> = {
  owner_profile: {
    preferred_name: 'anh',
    timezone: 'Asia/Ho_Chi_Minh',
    country: 'Vietnam',
    city: 'Ho Chi Minh City',
    role: 'CEO',
    language_primary: 'vi',
    language_secondary: 'en',
  },
  preferences: {
    language: 'vi',
    response_style: 'short, clear, actionable',
    tone: 'warm, respectful, direct',
    report_format: 'checklist',
  },
  business: {
    companies: ['Bakudan Ramen', 'Raw Sushi Bar'],
    active_projects: ['Dashboard', 'Agent Coding', 'WhatsApp AI'],
    key_people: ['Maria', 'Hoang', 'Nguyen'],
  },
  decisions: {},
  workflows: {},
  personal: {},
  consent_log: {},
};

function initDefaults() {
  ensureDir();
  for (const key of Object.keys(FILES) as MemoryKey[]) {
    if (key === 'consent_log') continue;
    if (!fs.existsSync(FILES[key])) {
      write(key, DEFAULT_PROFILE[key] || {});
    }
  }
  if (!fs.existsSync(FILES.consent_log)) {
    fs.writeFileSync(FILES.consent_log, JSON.stringify([], null, 2));
  }
}

// ---- PUBLIC API ----

export const executiveMemory = {
  init() { initDefaults(); },

  // Core remember
  remember(category: string, key: string, value: unknown, requireConsent = false): { ok: boolean; message: string } {
    if (requireConsent || category === 'personal' || category === 'health') {
      logConsent('save', category, key, 'consent_required');
      write('personal', { ...read('personal'), [key]: value });
      logConsent('save', category, key, 'saved_with_consent');
      return { ok: true, message: `Đã lưu "${key}" vào personal context (có consent log).` };
    }
    const fileKey = categoryToKey(category);
    write(fileKey, { ...read(fileKey), [key]: value });
    logConsent('save', category, key);
    return { ok: true, message: `Đã lưu "${key}" vào ${category}.` };
  },

  forget(category: string, key?: string): { ok: boolean; message: string } {
    const fileKey = categoryToKey(category);
    if (!key) {
      write(fileKey, {});
      logConsent('delete', category);
      return { ok: true, message: `Đã xóa toàn bộ ${category}.` };
    }
    const data = read(fileKey);
    delete data[key];
    write(fileKey, data);
    logConsent('delete', category, key);
    return { ok: true, message: `Đã xóa "${key}" khỏi ${category}.` };
  },

  // Retrieve
  getOwnerProfile(): Record<string, unknown> {
    return {
      ...read('owner_profile'),
      preferences: read('preferences'),
      business: read('business'),
    };
  },

  getPreferences(): Record<string, unknown> { return read('preferences'); },
  getBusinessMemory(): Record<string, unknown> { return read('business'); },
  getDecisions(): Record<string, unknown> { return read('decisions'); },
  getWorkflows(): Record<string, unknown> { return read('workflows'); },

  getPersonalContext(withConsentLog = false): Record<string, unknown> {
    logConsent('view', 'personal', undefined, 'owner_viewed');
    const data = read('personal');
    if (withConsentLog) return { ...data, _consent_log: this.getConsentLog().slice(-5) };
    return data;
  },

  getConsentLog(): object[] {
    try { return JSON.parse(fs.readFileSync(FILES.consent_log, 'utf-8')); }
    catch { return []; }
  },

  // Decision memory
  addDecision(title: string, detail: string, tags: string[] = []) {
    const decisions = read('decisions') as Record<string, unknown[]>;
    if (!decisions.history) decisions.history = [];
    (decisions.history as object[]).push({
      id: crypto.randomUUID(),
      title, detail, tags,
      decided_at: new Date().toISOString(),
    });
    write('decisions', decisions);
    return { ok: true };
  },

  // Lesson / workflow memory
  addLesson(context: string, lesson: string, outcome: 'good' | 'bad' = 'good') {
    const wf = read('workflows') as Record<string, unknown[]>;
    if (!wf.lessons) wf.lessons = [];
    (wf.lessons as object[]).push({ context, lesson, outcome, at: new Date().toISOString() });
    write('workflows', wf);
  },

  addPreference(key: string, value: unknown) {
    const prefs = read('preferences');
    prefs[key] = value;
    write('preferences', prefs);
    logConsent('save', 'preferences', key);
    return { ok: true, message: `Preference "${key}" đã được lưu.` };
  },

  // Search memory — keyword match across all categories
  searchMemory(query: string): Array<{ category: string; key: string; value: unknown }> {
    const q = query.toLowerCase();
    const results: Array<{ category: string; key: string; value: unknown }> = [];
    const searchIn = (cat: string, data: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(data)) {
        if (k.toLowerCase().includes(q) || JSON.stringify(v).toLowerCase().includes(q)) {
          results.push({ category: cat, key: k, value: v });
        }
      }
    };
    searchIn('profile', read('owner_profile'));
    searchIn('preferences', read('preferences'));
    searchIn('business', read('business'));
    searchIn('decisions', read('decisions'));
    searchIn('workflows', read('workflows'));
    return results.slice(0, 20);
  },

  // Get relevant memory for a message — used by pipeline
  getRelevantMemoryForMessage(message: string): string {
    const profile = read('owner_profile');
    const prefs = read('preferences');
    const business = read('business');
    const recentDecisions = (read('decisions').history as object[] || []).slice(-3);

    const name = (profile.preferred_name as string) || 'anh';
    const style = (prefs.response_style as string) || 'short, clear, actionable';
    const lang = (prefs.language as string) || 'vi';
    const companies = (business.companies as string[] || []).join(', ');
    const reportFmt = (prefs.report_format as string) || '';

    return [
      `Owner: ${name} | Role: CEO`,
      `Language: ${lang} | Style: ${style}`,
      companies ? `Companies: ${companies}` : '',
      reportFmt ? `Report format preference: ${reportFmt}` : '',
      recentDecisions.length > 0
        ? `Recent decisions: ${recentDecisions.map((d) => (d as Record<string, unknown>)['title']).join('; ')}`
        : '',
    ].filter(Boolean).join('\n');
  },

  // Export all (excluding personal unless forced)
  exportMemory(includePersonal = false): Record<string, unknown> {
    const out: Record<string, unknown> = {
      owner_profile: read('owner_profile'),
      preferences: read('preferences'),
      business: read('business'),
      decisions: read('decisions'),
      workflows: read('workflows'),
      exported_at: new Date().toISOString(),
    };
    if (includePersonal) {
      logConsent('view', 'personal', undefined, 'exported');
      out.personal = read('personal');
    }
    return out;
  },

  deleteSensitiveMemory(): { ok: boolean } {
    write('personal', {});
    logConsent('delete', 'personal', undefined, 'owner_requested_full_delete');
    return { ok: true };
  },

  summarizeOwnerProfile(): string {
    const profile = read('owner_profile');
    const prefs = read('preferences');
    const business = read('business');
    return [
      `Name: ${profile.preferred_name || 'CEO'}`,
      `Timezone: ${profile.timezone || 'Not set'}`,
      `Language: ${prefs.language || 'vi'}`,
      `Response style: ${prefs.response_style || 'short, clear'}`,
      `Report format: ${prefs.report_format || 'not set'}`,
      `Companies: ${(business.companies as string[] || []).join(', ')}`,
      `Active projects: ${(business.active_projects as string[] || []).join(', ')}`,
      `Key people: ${(business.key_people as string[] || []).join(', ')}`,
    ].join('\n');
  },
};
