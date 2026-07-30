import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function nextPatchId(root) {
  mkdirSync(root, { recursive: true });
  const ids = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^PATCH-\d+$/i.test(entry.name))
    .map((entry) => Number(entry.name.replace(/\D/g, '')))
    .filter(Number.isFinite);
  return `PATCH-${String((ids.length ? Math.max(...ids) : 0) + 1).padStart(3, '0')}`;
}

export class PatchEvidenceStore {
  constructor({ workspaceRoot, artifactsRoot } = {}) {
    this.workspaceRoot = path.resolve(workspaceRoot || process.cwd());
    this.root = path.resolve(artifactsRoot || path.join(this.workspaceRoot, 'artifacts', 'patches'));
    mkdirSync(this.root, { recursive: true });
  }

  createPatchDir(patchId = null) {
    const id = patchId || nextPatchId(this.root);
    const dir = path.join(this.root, id);
    mkdirSync(dir, { recursive: true });
    return { patchId: id, dir };
  }

  writeText(patchDir, name, content) {
    const target = path.join(patchDir, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, String(content ?? ''), 'utf8');
    return target;
  }

  writeJson(patchDir, name, data) {
    return this.writeText(patchDir, name, JSON.stringify(data, null, 2));
  }

  latest() {
    if (!existsSync(this.root)) return null;
    const entries = readdirSync(this.root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^PATCH-\d+$/i.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    const latest = entries.at(-1);
    if (!latest) return null;
    const dir = path.join(this.root, latest.name);
    const resultPath = path.join(dir, 'result.json');
    return {
      patchId: latest.name,
      dir,
      result: existsSync(resultPath) ? JSON.parse(readFileSync(resultPath, 'utf8')) : null,
    };
  }
}
