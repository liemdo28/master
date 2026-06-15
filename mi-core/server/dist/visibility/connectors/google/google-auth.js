"use strict";
/**
 * Google OAuth 2.0 Manager
 * Handles token storage, refresh, and auth flow for Gmail/Calendar/Drive.
 * Tokens stored locally — never sent externally.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOAuthClient = createOAuthClient;
exports.getAuthUrl = getAuthUrl;
exports.isConfigured = isConfigured;
exports.hasTokens = hasTokens;
exports.loadTokens = loadTokens;
exports.saveTokens = saveTokens;
exports.getAuthedClient = getAuthedClient;
exports.getAuthStatus = getAuthStatus;
const googleapis_1 = require("googleapis");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const TOKEN_PATH = path_1.default.join(GLOBAL_DIR, 'visibility', 'google-tokens.json');
const SCOPES = [
    // Read
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/contacts.readonly',
    // Write (required for send/create/upload actions)
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/drive.file',
];
function createOAuthClient() {
    return new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4001/api/auth/google/callback');
}
function getAuthUrl() {
    const client = createOAuthClient();
    return client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
    });
}
function isConfigured() {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
function hasTokens() {
    return fs_1.default.existsSync(TOKEN_PATH);
}
function loadTokens() {
    try {
        return JSON.parse(fs_1.default.readFileSync(TOKEN_PATH, 'utf-8'));
    }
    catch {
        return null;
    }
}
function saveTokens(tokens) {
    fs_1.default.mkdirSync(path_1.default.dirname(TOKEN_PATH), { recursive: true });
    fs_1.default.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}
async function getAuthedClient() {
    if (!isConfigured())
        throw new Error('Google OAuth not configured. Add GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET to .env');
    const tokens = loadTokens();
    if (!tokens)
        throw new Error('No Google tokens. Visit /api/auth/google/start to authorize.');
    const client = createOAuthClient();
    client.setCredentials(tokens);
    // Auto-refresh if expired
    if (tokens.expiry_date && Date.now() > tokens.expiry_date - 60_000) {
        const { credentials } = await client.refreshAccessToken();
        saveTokens(credentials);
        client.setCredentials(credentials);
    }
    return client;
}
function getAuthStatus() {
    const configured = isConfigured();
    const hasT = hasTokens();
    let status = 'not_configured';
    if (configured && hasT)
        status = 'connected';
    else if (configured && !hasT)
        status = 'needs_authorization';
    return { configured, has_tokens: hasT, status };
}
