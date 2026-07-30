import { createPatch, diffLines } from 'diff';

export class SourceDiffAnalyzer {
  buildDiff(filePath, before, after) {
    return createPatch(filePath, before ?? '', after ?? '', 'before', 'after');
  }

  summarize(filePath, before, after) {
    const parts = diffLines(before ?? '', after ?? '');
    let insertions = 0;
    let deletions = 0;
    for (const part of parts) {
      const count = part.value.split('\n').filter((line, index, arr) => line.length > 0 || index < arr.length - 1).length;
      if (part.added) insertions += count;
      if (part.removed) deletions += count;
    }
    return {
      filePath,
      changeType: before == null ? 'added' : after == null ? 'deleted' : before === after ? 'unchanged' : 'modified',
      insertions,
      deletions,
      timestamp: new Date().toISOString(),
    };
  }
}
