"use strict";
/**
 * Executive Memory V2 — persistent JSON store, survives restart.
 * Replaces old in-memory owner-profile with file-based, searchable memory.
 * Health data gated by explicit consent.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executiveMemory = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const MI_CORE_ROOT = path_1.default.resolve(__dirname, '..', '..', '..');
const GLOBAL_DIR = process.env.GLOBAL_DIR || path_1.default.join(MI_CORE_ROOT, '.local-agent-global');
const MEM_DIR = path_1.default.join(GLOBAL_DIR, 'executive-memory-v2');
const FILES = {
    owner_profile: path_1.default.join(MEM_DIR, 'owner_profile.json'),
    preferences: path_1.default.join(MEM_DIR, 'preferences.json'),
    business: path_1.default.join(MEM_DIR, 'business_memory.json'),
    decisions: path_1.default.join(MEM_DIR, 'decision_memory.json'),
    workflows: path_1.default.join(MEM_DIR, 'workflow_memory.json'),
    personal: path_1.default.join(MEM_DIR, 'personal_context.json'), // consent required
    consent_log: path_1.default.join(MEM_DIR, 'consent_log.json'),
};
function ensureDir() { fs_1.default.mkdirSync(MEM_DIR, { recursive: true }); }
function read(key) {
    try {
        return JSON.parse(fs_1.default.readFileSync(FILES[key], 'utf-8'));
    }
    catch {
        return {};
    }
}
function write(key, data) {
    ensureDir();
    fs_1.default.writeFileSync(FILES[key], JSON.stringify(data, null, 2));
}
function logConsent(action, category, field, note) {
    ensureDir();
    let log = [];
    try {
        log = JSON.parse(fs_1.default.readFileSync(FILES.consent_log, 'utf-8'));
    }
    catch { /* init */ }
    log.push({
        timestamp: new Date().toISOString(),
        action, category, field: field || null, note: note || null,
    });
    fs_1.default.writeFileSync(FILES.consent_log, JSON.stringify(log, null, 2));
}
function categoryToKey(category) {
    const map = {
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
const DEFAULT_PROFILE = {
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
    for (const key of Object.keys(FILES)) {
        if (key === 'consent_log')
            continue;
        if (!fs_1.default.existsSync(FILES[key])) {
            write(key, DEFAULT_PROFILE[key] || {});
        }
    }
    if (!fs_1.default.existsSync(FILES.consent_log)) {
        fs_1.default.writeFileSync(FILES.consent_log, JSON.stringify([], null, 2));
    }
}
// ---- PUBLIC API ----
exports.executiveMemory = {
    init() { initDefaults(); },
    // Core remember
    remember(category, key, value, requireConsent = false) {
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
    forget(category, key) {
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
    getOwnerProfile() {
        return {
            ...read('owner_profile'),
            preferences: read('preferences'),
            business: read('business'),
        };
    },
    getPreferences() { return read('preferences'); },
    getBusinessMemory() { return read('business'); },
    getDecisions() { return read('decisions'); },
    getWorkflows() { return read('workflows'); },
    getPersonalContext(withConsentLog = false) {
        logConsent('view', 'personal', undefined, 'owner_viewed');
        const data = read('personal');
        if (withConsentLog)
            return { ...data, _consent_log: this.getConsentLog().slice(-5) };
        return data;
    },
    getConsentLog() {
        try {
            return JSON.parse(fs_1.default.readFileSync(FILES.consent_log, 'utf-8'));
        }
        catch {
            return [];
        }
    },
    // Decision memory
    addDecision(title, detail, tags = []) {
        const decisions = read('decisions');
        if (!decisions.history)
            decisions.history = [];
        decisions.history.push({
            id: crypto_1.default.randomUUID(),
            title, detail, tags,
            decided_at: new Date().toISOString(),
        });
        write('decisions', decisions);
        return { ok: true };
    },
    // Lesson / workflow memory
    addLesson(context, lesson, outcome = 'good') {
        const wf = read('workflows');
        if (!wf.lessons)
            wf.lessons = [];
        wf.lessons.push({ context, lesson, outcome, at: new Date().toISOString() });
        write('workflows', wf);
    },
    addPreference(key, value) {
        const prefs = read('preferences');
        prefs[key] = value;
        write('preferences', prefs);
        logConsent('save', 'preferences', key);
        return { ok: true, message: `Preference "${key}" đã được lưu.` };
    },
    // Search memory — keyword match across all categories
    searchMemory(query) {
        const q = query.toLowerCase();
        const results = [];
        const searchIn = (cat, data) => {
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
    getRelevantMemoryForMessage(message) {
        const profile = read('owner_profile');
        const prefs = read('preferences');
        const business = read('business');
        const recentDecisions = (read('decisions').history || []).slice(-3);
        const name = profile.preferred_name || 'anh';
        const style = prefs.response_style || 'short, clear, actionable';
        const lang = prefs.language || 'vi';
        const companies = (business.companies || []).join(', ');
        const reportFmt = prefs.report_format || '';
        return [
            `Owner: ${name} | Role: CEO`,
            `Language: ${lang} | Style: ${style}`,
            companies ? `Companies: ${companies}` : '',
            reportFmt ? `Report format preference: ${reportFmt}` : '',
            recentDecisions.length > 0
                ? `Recent decisions: ${recentDecisions.map((d) => d['title']).join('; ')}`
                : '',
        ].filter(Boolean).join('\n');
    },
    // Export all (excluding personal unless forced)
    exportMemory(includePersonal = false) {
        const out = {
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
    deleteSensitiveMemory() {
        write('personal', {});
        logConsent('delete', 'personal', undefined, 'owner_requested_full_delete');
        return { ok: true };
    },
    summarizeOwnerProfile() {
        const profile = read('owner_profile');
        const prefs = read('preferences');
        const business = read('business');
        return [
            `Name: ${profile.preferred_name || 'CEO'}`,
            `Timezone: ${profile.timezone || 'Not set'}`,
            `Language: ${prefs.language || 'vi'}`,
            `Response style: ${prefs.response_style || 'short, clear'}`,
            `Report format: ${prefs.report_format || 'not set'}`,
            `Companies: ${(business.companies || []).join(', ')}`,
            `Active projects: ${(business.active_projects || []).join(', ')}`,
            `Key people: ${(business.key_people || []).join(', ')}`,
        ].join('\n');
    },
};
