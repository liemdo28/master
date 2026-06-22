/**
 * File Security Gate — blocks sensitive files from being sent.
 * Phase 7 of FILE FIND + EMAIL SEND WORKFLOW.
 */

import path from 'path';
import fs from 'fs';

// ── Blocked file patterns ────────────────────────────────────────────────────
const BLOCKED_NAMES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.staging',
  'id_rsa',
  'id_ed25519',
  'id_ecdsa',
  'private.key',
  'public.key',
  'credentials.json',
  'secrets.json',
  'token',
  'oauth',
  'password',
  'passwd',
  'shadow',
  '.htpasswd',
  'service-account-key',
  'google_credentials',
  'client_secret',
  'access_token',
  'refresh_token',
  '.p12',
  '.pfx',
  'dump.sql',
  'database_dump',
  'backup.sql',
  'dump.rdb',
]);

const BLOCKED_EXTENSIONS = new Set([
  '.env',
  '.key',
  '.pem',
  '.p12',
  '.pfx',
  '.jks',
  '.keystore',
  '.p8',
  '.pk8',
  '.der',
  '.crt',
  '.ca-bundle',
]);

const BLOCKED_PATH_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /__pycache__/,
  /\.venv/,
  /venv\//,
  /vendor\//,
  /dist\//,
  /\.next\//,
  /build\//,
  /\.idea\//,
  /\.vscode\//,
  /windows[\/\\]system32/i,
  /etc[\/\\]ssl/i,
  /\.aws\//,
  /\.config\//,
  /\.kube\//,
  /\.ssh\//,
];

// Approved root directories for file search
export const APPROVED_ROOTS = [
  'E:/Project/Master',
  'E:/Project',
  'F:/Projects',
  'F:/',
  'G:/My Drive',
  process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global',
];

const APPROVED_ROOT_SET = new Set(APPROVED_ROOTS);

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
  severity: 'safe' | 'warning' | 'blocked';
  warning_message?: string;
}

// ── Check if a path is under an approved root ────────────────────────────────
export function isPathAllowed(filePath: string): boolean {
  const normalized = path.normalize(filePath).replace(/\\/g, '/').toLowerCase();
  for (const root of APPROVED_ROOTS) {
    const normRoot = path.normalize(root).replace(/\\/g, '/').toLowerCase();
    if (normalized.startsWith(normRoot + '/') || normalized === normRoot) {
      return true;
    }
  }
  return false;
}

// ── Get file size safely ─────────────────────────────────────────────────────
export function getFileSize(filePath: string): number {
  try {
    const stat = fs.statSync(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}

// ── Check if file contains obvious secrets (text-based files only) ──────────
const SECRET_PATTERNS = [
  /password\s*[:=]\s*["'][^"']+["']/i,
  /api[_-]?key\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/i,
  /secret[_-]?key\s*[:=]\s*["'][^"']+["']/i,
  /bearer\s+[A-Za-z0-9_\-\.]+/i,
  /sk-[A-Za-z0-9_\-]{20,}/i,
  /ghp_[A-Za-z0-9_\-]{36}/i,
  /xox[baprs]-[A-Za-z0-9_\-]{10,}/i,
  /AKIA[A-Z0-9]{16}/i,
  /[A-Za-z0-9/+=]{40,}/,  // long base64 strings (token-like)
];

export function scanForSecrets(filePath: string): string[] {
  const ext = path.extname(filePath).toLowerCase();
  // Only scan text-based files
  const scannable = ['.txt', '.md', '.json', '.js', '.ts', '.py', '.sh', '.yaml', '.yml', '.xml', '.csv', '.log', '.html', '.css'];
  if (!scannable.includes(ext)) return [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const found: string[] = [];
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        found.push(`Pattern match: ${pattern.toString()}`);
      }
    }
    return found;
  } catch {
    return [];
  }
}

// ── Main security gate ────────────────────────────────────────────────────────
export function securityCheck(filePath: string): SecurityCheckResult {
  if (!isPathAllowed(filePath)) {
    return {
      allowed: false,
      reason: `Path not in approved roots: ${filePath}`,
      severity: 'blocked',
    };
  }

  const normalized = path.normalize(filePath).replace(/\\/g, '/');
  const basename = path.basename(normalized).toLowerCase();
  const ext = path.extname(normalized).toLowerCase();

  // Block by exact name
  if (BLOCKED_NAMES.has(basename)) {
    return {
      allowed: false,
      reason: `Sensitive file name blocked: ${basename}`,
      severity: 'blocked',
    };
  }

  // Block by extension
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return {
      allowed: false,
      reason: `Sensitive file type blocked: ${ext}`,
      severity: 'blocked',
    };
  }

  // Block by path pattern
  for (const pattern of BLOCKED_PATH_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        allowed: false,
        reason: `Path matches blocked pattern: ${pattern.toString()}`,
        severity: 'blocked',
      };
    }
  }

  // Warning for large files
  const size = getFileSize(filePath);
  const SIZE_WARN_MB = 20;
  const SIZE_BLOCK_MB = 100;
  if (size > SIZE_BLOCK_MB * 1024 * 1024) {
    return {
      allowed: false,
      reason: `File too large (>${SIZE_BLOCK_MB}MB)`,
      severity: 'blocked',
      warning_message: `File is ${(size / 1024 / 1024).toFixed(1)}MB — exceeds ${SIZE_BLOCK_MB}MB limit`,
    };
  }
  if (size > SIZE_WARN_MB * 1024 * 1024) {
    return {
      allowed: true,
      reason: `Large file (${(size / 1024 / 1024).toFixed(1)}MB > ${SIZE_WARN_MB}MB)`,
      severity: 'warning',
      warning_message: `File is ${(size / 1024 / 1024).toFixed(1)}MB — consider Google Drive link instead`,
    };
  }

  // Scan for secrets in text files
  const secrets = scanForSecrets(filePath);
  if (secrets.length > 0) {
    return {
      allowed: true,
      reason: 'File may contain secrets — requires explicit confirmation',
      severity: 'warning',
      warning_message: `Potential secrets detected: ${secrets.slice(0, 2).join(', ')}`,
    };
  }

  return { allowed: true, severity: 'safe' };
}

// ── Format file size ─────────────────────────────────────────────────────────
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
}
