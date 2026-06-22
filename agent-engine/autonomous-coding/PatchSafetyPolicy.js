import path from 'node:path';

export const FORBIDDEN_ACTION_PATTERNS = [
  /\bgit\s+push\b/i,
  /\bgit\s+push\s+--force\b/i,
  /\bdeploy\b/i,
  /\bdelete\s+project\b/i,
  /\bdrop\s+table\b/i,
  /\bmigration\b/i,
];

export const FORBIDDEN_FILE_PATTERNS = [
  /(^|[/\\])\.env($|[./\\])/i,
  /(^|[/\\])\.env\.(local|prod|production|staging)$/i,
  /credential/i,
  /secret/i,
  /private[_-]?key/i,
  /id_rsa|id_ed25519|id_ecdsa/i,
  /\.pem$/i,
  /\.key$/i,
];

export const PRODUCTION_FILE_PATTERNS = [
  /(^|[/\\])prod(uction)?([/\\.]|$)/i,
  /(^|[/\\])deploy([/\\.]|$)/i,
  /(^|[/\\])terraform([/\\]|$)/i,
  /(^|[/\\])k8s([/\\]|$)/i,
  /(^|[/\\])migrations?([/\\]|$)/i,
];

export function normalizeRelativePath(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  return normalized.split('/').filter(Boolean).join('/');
}

export function classifyFileRisk(filePath) {
  const normalized = normalizeRelativePath(filePath);
  if (FORBIDDEN_FILE_PATTERNS.some((re) => re.test(normalized))) {
    return { level: 'blocked', reason: 'secret-or-credential-file' };
  }
  if (PRODUCTION_FILE_PATTERNS.some((re) => re.test(normalized))) {
    return { level: 'approval-required', reason: 'production-or-migration-file' };
  }
  if (/package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$/i.test(normalized)) {
    return { level: 'medium', reason: 'lockfile-change' };
  }
  if (/\.(test|spec)\.[cm]?[jt]sx?$/i.test(normalized)) {
    return { level: 'low', reason: 'test-file' };
  }
  return { level: 'normal', reason: 'source-file' };
}

export function detectForbiddenAction(text) {
  const value = String(text || '');
  const match = FORBIDDEN_ACTION_PATTERNS.find((re) => re.test(value));
  return match ? { blocked: true, pattern: String(match) } : { blocked: false };
}

export function toAbsoluteInside(workspaceRoot, filePath) {
  const rel = normalizeRelativePath(filePath);
  const absolute = path.resolve(workspaceRoot, rel);
  const root = path.resolve(workspaceRoot);
  const relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes workspace: ${filePath}`);
  }
  return { absolute, relative: rel };
}
