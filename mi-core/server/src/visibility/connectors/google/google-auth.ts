/**
 * Google OAuth 2.0 Manager
 * Handles token storage, refresh, and auth flow for Gmail/Calendar/Drive.
 * Tokens stored locally — never sent externally.
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const TOKEN_PATH = path.join(GLOBAL_DIR, 'visibility', 'google-tokens.json');

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
  // SEO (full write needed for sitemap delete)
  'https://www.googleapis.com/auth/webmasters',
];

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  scope: string;
  token_type: string;
}

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4001/api/auth/google/callback'
  );
}

export function getAuthUrl(): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

export function isConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function hasTokens(): boolean {
  return fs.existsSync(TOKEN_PATH);
}

export function loadTokens(): GoogleTokens | null {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveTokens(tokens: GoogleTokens) {
  fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

export async function getAuthedClient() {
  if (!isConfigured()) throw new Error('Google OAuth not configured. Add GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET to .env');
  const tokens = loadTokens();
  if (!tokens) throw new Error('No Google tokens. Visit /api/auth/google/start to authorize.');

  const client = createOAuthClient();
  client.setCredentials(tokens);

  // Auto-refresh if expired
  if (tokens.expiry_date && Date.now() > tokens.expiry_date - 60_000) {
    const { credentials } = await client.refreshAccessToken();
    saveTokens(credentials as GoogleTokens);
    client.setCredentials(credentials);
  }

  return client;
}

export function getAuthStatus(): { configured: boolean; has_tokens: boolean; status: string } {
  const configured = isConfigured();
  const hasT = hasTokens();
  let status = 'not_configured';
  if (configured && hasT) status = 'connected';
  else if (configured && !hasT) status = 'needs_authorization';
  return { configured, has_tokens: hasT, status };
}
