import * as fs from 'fs';
import * as path from 'path';

export function resolveRegistryDataDir(): string {
  return process.env.MI_PROJECT_REGISTRY_DIR
    ? path.resolve(process.env.MI_PROJECT_REGISTRY_DIR)
    : path.resolve(process.cwd(), '.local-agent-global', 'project-registry');
}

export function normalizePath(input: string): string {
  return path.resolve(input);
}

export function realPathIfExists(input: string): string {
  const resolved = normalizePath(input);
  if (!fs.existsSync(resolved)) return resolved;
  return stripWindowsNamespace(fs.realpathSync.native(resolved));
}

export function isWithinPath(target: string, root: string): boolean {
  const normalizedTarget = process.platform === 'win32' ? target.toLowerCase() : target;
  const normalizedRoot = process.platform === 'win32' ? root.toLowerCase() : root;
  const rel = path.relative(normalizedRoot, normalizedTarget);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

export function assertInsideRoot(target: string, root: string, label = 'path'): string {
  const realTarget = realPathIfExists(target);
  const realRoot = realPathIfExists(root);
  if (!isWithinPath(realTarget, realRoot)) {
    throw new Error(`${label} must stay inside project root`);
  }
  return realTarget;
}

export function allowedRegistryRoots(): string[] {
  const raw = process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS;
  const roots = raw
    ? raw.split(path.delimiter).map(v => v.trim()).filter(Boolean)
    : [process.cwd(), path.resolve(process.cwd(), '..')];
  return [...new Set(roots.map(root => realPathIfExists(root)))];
}

export function assertInsideAllowedRegistryRoots(target: string): string {
  const realTarget = realPathIfExists(target);
  const allowed = allowedRegistryRoots();
  if (!allowed.some(root => isWithinPath(realTarget, root))) {
    throw new Error('canonicalRoot must stay inside configured project registry workspace roots');
  }
  return realTarget;
}

export function toPosixRelative(root: string, target: string): string {
  return path.relative(root, target).replace(/\\/g, '/');
}

function stripWindowsNamespace(value: string): string {
  if (value.startsWith('\\\\?\\')) return value.slice(4);
  return value;
}
