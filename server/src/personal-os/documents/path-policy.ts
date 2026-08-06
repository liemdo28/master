/**
 * Approved-root policy for document ingestion.
 *
 * Mi may only read files the owner has already approved: a registered Project Registry
 * root, an explicitly configured document root, or a single explicitly approved file.
 * Everything else is refused before it is opened.
 *
 * Containment is checked on the *real* path, after symlink and junction resolution, so
 * a link inside an approved root that points outside it does not grant access.
 */

import * as fs from 'fs';
import * as path from 'path';

export type PathRejectionCode =
  | 'NOT_FOUND' | 'OUTSIDE_APPROVED_ROOTS' | 'TRAVERSAL' | 'LINK_ESCAPE'
  | 'EXCLUDED_PATH_CLASS' | 'NOT_A_FILE' | 'NOT_A_DIRECTORY' | 'NO_APPROVED_ROOTS';

export class PathPolicyError extends Error {
  constructor(readonly code: PathRejectionCode, safeMessage: string) {
    super(safeMessage);
    this.name = 'PathPolicyError';
  }
}

/**
 * Directory and file classes that are never ingestible, regardless of where they sit.
 * Matched case-insensitively against every path segment.
 */
const EXCLUDED_SEGMENTS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'generated', 'coverage', 'out',
  '.next', '.nuxt', '.cache', 'cache', 'tmp', 'temp', '.tmp',
  '.local-agent-global', 'logs', 'secrets', 'credentials', '.ssh', '.aws', '.gnupg',
  '.wwebjs_auth', '.wwebjs_cache', 'ceo-session', 'whatsapp', 'session',
  'mi-core-pm2-backups', 'pm2-backups', '.pm2',
  'visibility', 'models', '.ollama', '.cache-puppeteer', 'puppeteer',
  'browser-profiles', 'user data', 'default',
]);

/** Filename patterns that are never ingestible. */
const EXCLUDED_FILE_PATTERNS: RegExp[] = [
  /^\.env(\..*)?$/i,
  /(^|[.-])secrets?\.(json|ya?ml|txt)$/i,
  /(^|[.-])credentials?\.(json|ya?ml|txt)$/i,
  /google-tokens\.json$/i,
  /service-?account.*\.json$/i,
  /\.(pem|key|pfx|p12|keystore|jks|ppk)$/i,
  /id_(rsa|dsa|ecdsa|ed25519)$/i,
  /\.(db|db-wal|db-shm|sqlite|sqlite3)$/i,
  /\.pm2$/i,
  /session\.json$/i,
  /cookies?\.(json|sqlite|txt)$/i,
];

export interface ApprovedRoots {
  /** Registered Project Registry roots, keyed by project id. */
  projectRoots: Record<string, string>;
  /** Explicitly configured document roots. */
  documentRoots: string[];
  /** Explicitly approved single files. */
  approvedFiles: string[];
}

export function loadApprovedRoots(input?: Partial<ApprovedRoots>): ApprovedRoots {
  const fromEnv = (name: string): string[] =>
    (process.env[name] || '').split(path.delimiter).map(v => v.trim()).filter(Boolean);
  return {
    projectRoots: input?.projectRoots ?? {},
    documentRoots: input?.documentRoots ?? fromEnv('MI_DOCUMENT_ROOTS'),
    approvedFiles: input?.approvedFiles ?? fromEnv('MI_APPROVED_DOCUMENT_FILES'),
  };
}

/**
 * Resolves to the real on-disk path. Windows adds two wrinkles worth handling
 * explicitly: drive letters vary in case between callers, and `realpathSync.native`
 * returns the `\\?\` namespace form for some paths.
 */
export function realPath(input: string): string {
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved)) return normalise(resolved);
  return normalise(fs.realpathSync.native(resolved));
}

function normalise(input: string): string {
  let value = input.replace(/^\\\\\?\\(UNC\\)?/, (_m, unc) => (unc ? '\\\\' : ''));
  value = path.resolve(value);
  // Drive letters are case-insensitive on Windows; normalise so comparisons are stable.
  if (process.platform === 'win32' && /^[a-z]:/.test(value)) {
    value = value[0].toUpperCase() + value.slice(1);
  }
  return value;
}

function isWithin(target: string, root: string): boolean {
  const t = process.platform === 'win32' ? target.toLowerCase() : target;
  const r = process.platform === 'win32' ? root.toLowerCase() : root;
  if (t === r) return true;
  const rel = path.relative(r, t);
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function isExcludedPath(candidate: string, root?: string): boolean {
  // Only inspect the portion below the approved root — an approved root may itself
  // legitimately live under a directory whose name collides with the excluded list.
  const relative = root && isWithin(candidate, root) ? path.relative(root, candidate) : candidate;
  const segments = relative.split(/[\\/]+/).filter(Boolean);
  for (const segment of segments) {
    if (EXCLUDED_SEGMENTS.has(segment.toLowerCase())) return true;
  }
  const base = path.basename(candidate);
  return EXCLUDED_FILE_PATTERNS.some(pattern => pattern.test(base));
}

export interface ResolvedDocumentPath {
  canonicalPath: string;
  /** Path relative to the approved root; safe to return from the API. */
  sourceUri: string;
  rootKind: 'PROJECT' | 'DOCUMENT_ROOT' | 'APPROVED_FILE';
  projectId: string | null;
  ingestionPolicy: 'PROJECT_DOCS' | 'APPROVED_FOLDER' | 'MANUAL_ONLY';
}

/**
 * The single gate every ingestion request passes through. Throws PathPolicyError with a
 * code and a message that never contains an absolute path.
 */
export function resolveApprovedFile(requested: string, roots: ApprovedRoots): ResolvedDocumentPath {
  if (typeof requested !== 'string' || !requested.trim()) {
    throw new PathPolicyError('NOT_FOUND', 'a document path is required');
  }
  // Reject traversal in the *request* before touching the filesystem, so an attempt is
  // reported as traversal rather than as a generic containment failure.
  if (/(^|[\\/])\.\.([\\/]|$)/.test(requested)) {
    throw new PathPolicyError('TRAVERSAL', 'path traversal is not permitted');
  }

  const hasRoots = Object.keys(roots.projectRoots).length || roots.documentRoots.length || roots.approvedFiles.length;
  if (!hasRoots) throw new PathPolicyError('NO_APPROVED_ROOTS', 'no approved document roots are configured');

  const resolvedRequest = path.resolve(requested);
  if (!fs.existsSync(resolvedRequest)) {
    throw new PathPolicyError('NOT_FOUND', 'the requested document does not exist');
  }
  const stat = fs.statSync(resolvedRequest);
  if (!stat.isFile()) throw new PathPolicyError('NOT_A_FILE', 'the requested path is not a file');

  const canonicalPath = realPath(resolvedRequest);
  const linkResolvedDiffers = normalise(resolvedRequest) !== canonicalPath;

  for (const approved of roots.approvedFiles) {
    const approvedReal = realPath(approved);
    if (canonicalPath === approvedReal) {
      // Scope the exclusion check to the file's own directory, not the full machine
      // path. An unscoped check against every ancestor segment down to the drive root
      // would spuriously reject a file the owner explicitly approved just because some
      // ancestor directory happens to be named "temp", "cache", "build" and so on —
      // exactly the invariant the project/document-root branches below already respect.
      // Dangerous basenames (.env, *.pem, session.json, tokens, …) are still caught:
      // that half of isExcludedPath matches on the filename alone, independent of root.
      if (isExcludedPath(canonicalPath, path.dirname(approvedReal))) {
        throw new PathPolicyError('EXCLUDED_PATH_CLASS', 'this file class is never ingestible');
      }
      return {
        canonicalPath,
        sourceUri: path.basename(canonicalPath),
        rootKind: 'APPROVED_FILE',
        projectId: null,
        ingestionPolicy: 'MANUAL_ONLY',
      };
    }
  }

  for (const [projectId, root] of Object.entries(roots.projectRoots)) {
    const realRoot = realPath(root);
    if (!isWithin(canonicalPath, realRoot)) continue;
    // A symlink inside an approved root that resolves back inside it is fine; one that
    // escapes has already failed isWithin above, so reaching here is safe.
    assertIngestible(canonicalPath, realRoot, linkResolvedDiffers, resolvedRequest);
    return {
      canonicalPath,
      sourceUri: toPosix(path.relative(realRoot, canonicalPath)),
      rootKind: 'PROJECT',
      projectId,
      ingestionPolicy: 'PROJECT_DOCS',
    };
  }

  for (const root of roots.documentRoots) {
    const realRoot = realPath(root);
    if (!isWithin(canonicalPath, realRoot)) continue;
    assertIngestible(canonicalPath, realRoot, linkResolvedDiffers, resolvedRequest);
    return {
      canonicalPath,
      sourceUri: toPosix(path.relative(realRoot, canonicalPath)),
      rootKind: 'DOCUMENT_ROOT',
      projectId: null,
      ingestionPolicy: 'APPROVED_FOLDER',
    };
  }

  // A link whose target left every approved root is reported as a link escape rather
  // than a plain containment failure, because the two need different follow-up.
  throw new PathPolicyError(
    linkResolvedDiffers ? 'LINK_ESCAPE' : 'OUTSIDE_APPROVED_ROOTS',
    linkResolvedDiffers
      ? 'the link target resolves outside every approved root'
      : 'the document is outside every approved root',
  );
}

function assertIngestible(canonicalPath: string, root: string, linkDiffers: boolean, requested: string): void {
  if (isExcludedPath(canonicalPath, root)) {
    throw new PathPolicyError('EXCLUDED_PATH_CLASS', 'this path class is never ingestible');
  }
  // Also screen the requested path: a link *named* innocuously inside an excluded
  // directory should still be refused on the basis of where it was requested from.
  if (linkDiffers && isExcludedPath(normalise(requested))) {
    throw new PathPolicyError('EXCLUDED_PATH_CLASS', 'this path class is never ingestible');
  }
}

export function resolveApprovedDirectory(requested: string, roots: ApprovedRoots): ResolvedDocumentPath {
  if (/(^|[\\/])\.\.([\\/]|$)/.test(requested || '')) {
    throw new PathPolicyError('TRAVERSAL', 'path traversal is not permitted');
  }
  const resolved = path.resolve(requested || '');
  if (!fs.existsSync(resolved)) throw new PathPolicyError('NOT_FOUND', 'the requested directory does not exist');
  if (!fs.statSync(resolved).isDirectory()) throw new PathPolicyError('NOT_A_DIRECTORY', 'the requested path is not a directory');

  const canonicalPath = realPath(resolved);
  for (const [projectId, root] of Object.entries(roots.projectRoots)) {
    const realRoot = realPath(root);
    if (isWithin(canonicalPath, realRoot)) {
      if (isExcludedPath(canonicalPath, realRoot)) {
        throw new PathPolicyError('EXCLUDED_PATH_CLASS', 'this path class is never ingestible');
      }
      return {
        canonicalPath,
        sourceUri: toPosix(path.relative(realRoot, canonicalPath)) || '.',
        rootKind: 'PROJECT',
        projectId,
        ingestionPolicy: 'PROJECT_DOCS',
      };
    }
  }
  for (const root of roots.documentRoots) {
    const realRoot = realPath(root);
    if (isWithin(canonicalPath, realRoot)) {
      if (isExcludedPath(canonicalPath, realRoot)) {
        throw new PathPolicyError('EXCLUDED_PATH_CLASS', 'this path class is never ingestible');
      }
      return {
        canonicalPath,
        sourceUri: toPosix(path.relative(realRoot, canonicalPath)) || '.',
        rootKind: 'DOCUMENT_ROOT',
        projectId: null,
        ingestionPolicy: 'APPROVED_FOLDER',
      };
    }
  }
  throw new PathPolicyError('OUTSIDE_APPROVED_ROOTS', 'the directory is outside every approved root');
}

function toPosix(input: string): string {
  return input.split(path.sep).join('/');
}

/** Strips anything path-shaped from a message before it leaves the process. */
export function redactPaths(message: string): string {
  return String(message || '')
    .replace(/[A-Za-z]:[\\/][^\s'"]*/g, '[path]')
    .replace(/\\\\[^\s'"]+/g, '[path]')
    .replace(/(^|\s)\/[^\s'"]{2,}/g, '$1[path]');
}
