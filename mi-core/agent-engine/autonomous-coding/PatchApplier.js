import { SourceDiffAnalyzer } from './SourceDiffAnalyzer.js';

export class PatchApplier {
  constructor({ editor, diffAnalyzer = new SourceDiffAnalyzer() } = {}) {
    this.editor = editor;
    this.diffAnalyzer = diffAnalyzer;
  }

  apply(plan, { patchId } = {}) {
    const results = [];
    for (const change of plan.changes || []) {
      const current = this.editor.read(change.filePath);
      const before = current.content ?? '';
      const after = this.applyChange(before, change);
      const write = this.editor.write(change.filePath, after, { patchId });
      const diff = this.diffAnalyzer.buildDiff(write.filePath, write.beforeContent ?? '', write.afterContent ?? '');
      const summary = this.diffAnalyzer.summarize(write.filePath, write.beforeContent ?? '', write.afterContent ?? '');
      results.push({ ...write, diff, summary, change });
    }
    return { ok: true, patchId, files: results };
  }

  applyChange(before, change) {
    if (change.type === 'write') return String(change.content ?? '');
    if (change.type === 'append') return `${before}${String(change.content ?? '')}`;
    if (change.type === 'replace') {
      const needle = String(change.search ?? '');
      if (!needle) throw new Error(`replace change for ${change.filePath} is missing search`);
      if (!before.includes(needle)) throw new Error(`search text not found in ${change.filePath}`);
      return before.replace(needle, String(change.replace ?? ''));
    }
    if (change.type === 'regexReplace') {
      const re = new RegExp(change.pattern, change.flags || 'm');
      if (!re.test(before)) throw new Error(`regex did not match in ${change.filePath}`);
      return before.replace(re, String(change.replace ?? ''));
    }
    throw new Error(`unsupported change type: ${change.type}`);
  }
}
