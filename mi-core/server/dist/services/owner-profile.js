"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ownerProfile = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const PROFILE_DIR = path_1.default.resolve(__dirname, '../../../owner-profile');
const CONSENT_LOG = path_1.default.join(PROFILE_DIR, 'consent_log.json');
const FILES = {
    profile: path_1.default.join(PROFILE_DIR, 'owner_profile.json'),
    preferences: path_1.default.join(PROFILE_DIR, 'preferences.json'),
    health: path_1.default.join(PROFILE_DIR, 'health_context.json'),
    relationships: path_1.default.join(PROFILE_DIR, 'relationships.json'),
    work_style: path_1.default.join(PROFILE_DIR, 'work_style.json'),
};
function ensureDir() {
    if (!fs_1.default.existsSync(PROFILE_DIR))
        fs_1.default.mkdirSync(PROFILE_DIR, { recursive: true });
}
function readJson(filePath) {
    try {
        return JSON.parse(fs_1.default.readFileSync(filePath, 'utf-8'));
    }
    catch {
        return {};
    }
}
function writeJson(filePath, data) {
    ensureDir();
    fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
function logConsent(action, category, field) {
    ensureDir();
    const log = readJson(CONSENT_LOG) || [];
    log.push({
        timestamp: new Date().toISOString(),
        action,
        category,
        field: field || null,
    });
    fs_1.default.writeFileSync(CONSENT_LOG, JSON.stringify(log, null, 2));
}
exports.ownerProfile = {
    getAll() {
        return {
            profile: readJson(FILES.profile),
            preferences: readJson(FILES.preferences),
            work_style: readJson(FILES.work_style),
            relationships: readJson(FILES.relationships),
            // health NOT included in bulk — explicit request only
        };
    },
    getHealth() {
        return readJson(FILES.health);
    },
    remember(category, key, value) {
        const isHealth = category === 'health';
        const target = FILES[isHealth ? 'health' : category === 'preferences' ? 'preferences'
            : category === 'work_style' ? 'work_style'
                : category === 'relationships' ? 'relationships'
                    : 'profile'];
        const data = readJson(target);
        data[key] = value;
        writeJson(target, data);
        logConsent('save', category, key);
    },
    forget(category, key) {
        const isHealth = category === 'health';
        const target = FILES[isHealth ? 'health' : 'profile'];
        if (!key) {
            // Wipe entire category file
            writeJson(target, {});
            logConsent('delete', category);
        }
        else {
            const data = readJson(target);
            delete data[key];
            writeJson(target, data);
            logConsent('delete', category, key);
        }
    },
    getConsentLog() {
        try {
            return JSON.parse(fs_1.default.readFileSync(CONSENT_LOG, 'utf-8'));
        }
        catch {
            return [];
        }
    },
};
