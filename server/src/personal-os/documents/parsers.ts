/**
 * Foundation parsers.
 *
 * Every parser is pure text handling: no shell, no macros, no network fetch, no include
 * resolution, no code evaluation. Each returns sections carrying enough provenance
 * (heading path, character offsets, page number) to build a citation later.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  DOCUMENT_LIMITS, DocumentParseError, PARSER_VERSION,
  type DocumentSourceType, type ParsedDocument, type ParsedSection,
} from './types';

export function classifySourceType(filePath: string): DocumentSourceType {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.md': case '.markdown': return 'MARKDOWN';
    case '.txt': case '.log': case '.rst': case '.adoc': return 'TEXT';
    case '.json': return 'JSON';
    case '.yaml': case '.yml': return 'YAML';
    case '.pdf': return 'PDF';
    case '.html': case '.htm': return 'HTML';
    default:
      throw new DocumentParseError('UNSUPPORTED_MIME', `unsupported document type: ${ext || '(none)'}`);
  }
}

export function mimeFor(sourceType: DocumentSourceType): string {
  return {
    MARKDOWN: 'text/markdown', TEXT: 'text/plain', JSON: 'application/json',
    YAML: 'application/yaml', PDF: 'application/pdf', HTML: 'text/html',
    TASK_SUMMARY: 'text/plain', GOAL_OUTCOME: 'text/plain',
    PROJECT_MAP: 'application/json', EXTERNAL_ITEM: 'text/plain',
  }[sourceType];
}

function readTextFile(filePath: string): string {
  const size = fs.statSync(filePath).size;
  if (size > DOCUMENT_LIMITS.maxFileBytes) {
    throw new DocumentParseError('FILE_TOO_LARGE', 'document exceeds the maximum ingestible size');
  }
  const buffer = fs.readFileSync(filePath);
  // A NUL byte in the first block means this is binary, whatever the extension says.
  if (buffer.subarray(0, 8192).includes(0)) {
    throw new DocumentParseError('BINARY_CONTENT', 'document appears to be binary, not text');
  }
  const text = buffer.toString('utf8');
  if (text.includes('\uFFFD')) {
    throw new DocumentParseError('ENCODING_INVALID', 'document is not valid UTF-8 text');
  }
  return text.length > DOCUMENT_LIMITS.maxTextChars
    ? text.slice(0, DOCUMENT_LIMITS.maxTextChars)
    : text;
}

/** Detects a document's dominant language cheaply; used only for metadata. */
function detectLanguage(text: string): string {
  return /[ăâđêôơưàáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/i.test(text) ? 'vi' : 'en';
}

// ── Markdown ────────────────────────────────────────────────────────────────────

export function parseMarkdown(raw: string): ParsedDocument {
  const warnings: string[] = [];
  let text = raw;
  const metadata: Record<string, unknown> = {};

  // Front matter is metadata, not body content, and must not be chunked as prose.
  const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (frontMatter) {
    try {
      Object.assign(metadata, parseYamlSubset(frontMatter[1], DOCUMENT_LIMITS.maxYamlDepth));
    } catch {
      warnings.push('front matter could not be parsed and was skipped');
    }
    text = ' '.repeat(frontMatter[0].length) + text.slice(frontMatter[0].length);
  }

  const lines = text.split(/\r?\n/);
  const sections: ParsedSection[] = [];
  const headingStack: Array<{ level: number; title: string }> = [];
  let buffer: string[] = [];
  let bufferStart = 0;
  let offset = 0;
  let inFence = false;
  let fenceMarker = '';
  let title = '';

  const flush = (end: number) => {
    const body = buffer.join('\n').trim();
    buffer = [];
    if (!body) return;
    sections.push({
      headingPath: headingStack.map(h => h.title),
      text: body,
      sourceStart: bufferStart,
      sourceEnd: end,
      pageNumber: null,
      sectionTitle: headingStack.length ? headingStack[headingStack.length - 1].title : null,
    });
  };

  for (const line of lines) {
    const lineStart = offset;
    offset += line.length + 1;

    const fence = /^\s*(```+|~~~+)/.exec(line);
    if (fence) {
      // Inside a fence, a line starting with # is code, not a heading.
      if (!inFence) { inFence = true; fenceMarker = fence[1][0]; }
      else if (fence[1][0] === fenceMarker) { inFence = false; }
      buffer.push(line);
      continue;
    }
    if (inFence) { buffer.push(line); continue; }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush(lineStart);
      const level = heading[1].length;
      const headingTitle = heading[2].replace(/#+\s*$/, '').trim();
      while (headingStack.length && headingStack[headingStack.length - 1].level >= level) headingStack.pop();
      headingStack.push({ level, title: headingTitle });
      if (!title && level <= 2) title = headingTitle;
      bufferStart = lineStart;
      continue;
    }

    if (!buffer.length) bufferStart = lineStart;
    buffer.push(line);
  }
  flush(offset);

  if (sections.length > DOCUMENT_LIMITS.maxSections) {
    warnings.push('document exceeded the section limit and was truncated');
    sections.length = DOCUMENT_LIMITS.maxSections;
  }

  return {
    title: title || String(metadata.title || '').trim() || 'Untitled document',
    language: detectLanguage(raw),
    mimeType: 'text/markdown',
    sections,
    metadata,
    warnings,
    parserVersion: PARSER_VERSION,
  };
}

// ── Plain text ──────────────────────────────────────────────────────────────────

export function parsePlainText(raw: string): ParsedDocument {
  const sections: ParsedSection[] = [];
  let offset = 0;
  for (const block of raw.split(/\r?\n\s*\r?\n/)) {
    const start = offset;
    offset += block.length + 2;
    const body = block.trim();
    if (!body) continue;
    sections.push({
      headingPath: [], text: body, sourceStart: start, sourceEnd: start + block.length,
      pageNumber: null, sectionTitle: null,
    });
    if (sections.length >= DOCUMENT_LIMITS.maxSections) break;
  }
  const firstLine = raw.split(/\r?\n/).find(l => l.trim());
  return {
    title: (firstLine || 'Untitled document').trim().slice(0, 200),
    language: detectLanguage(raw),
    mimeType: 'text/plain',
    sections, metadata: {}, warnings: [], parserVersion: PARSER_VERSION,
  };
}

// ── JSON ────────────────────────────────────────────────────────────────────────

/** Keys whose values are redacted regardless of content. */
const SENSITIVE_KEY = /(pass(word|wd)?|secret|token|api[_-]?key|credential|private[_-]?key|authorization|cookie|session)/i;

/**
 * Groups the flattened leaves of a structured document by their parent path.
 *
 * Emitting one section per leaf produces lines like `steps.0: build`, almost all of
 * which fall under the minimum chunk size and would be discarded — so a whole YAML file
 * could ingest to nothing. Grouping siblings keeps related keys together and yields
 * chunks that are both meaningful and large enough to survive.
 */
function groupStructuredSections(leaves: ParsedSection[]): ParsedSection[] {
  const groups = new Map<string, ParsedSection[]>();
  for (const leaf of leaves) {
    const key = leaf.headingPath.join('.');
    groups.set(key, [...(groups.get(key) ?? []), leaf]);
  }
  const out: ParsedSection[] = [];
  for (const [key, items] of groups) {
    out.push({
      headingPath: items[0].headingPath,
      text: items.map(i => i.text).join('\n'),
      sourceStart: 0,
      sourceEnd: 0,
      pageNumber: null,
      sectionTitle: key || items[0].sectionTitle,
    });
  }
  return out;
}

function flattenStructured(
  value: unknown, keyPath: string[], depth: number, maxDepth: number, out: ParsedSection[],
): void {
  if (out.length >= DOCUMENT_LIMITS.maxSections) return;
  if (depth > maxDepth) {
    out.push({
      headingPath: keyPath.slice(0, -1), text: `${keyPath.join('.')}: [depth limit reached]`,
      sourceStart: 0, sourceEnd: 0, pageNumber: null,
      sectionTitle: keyPath[keyPath.length - 1] ?? null,
    });
    return;
  }
  if (value === null || typeof value !== 'object') {
    const key = keyPath[keyPath.length - 1] ?? '';
    const rendered = SENSITIVE_KEY.test(key) ? '[REDACTED]' : String(value);
    if (!keyPath.length) return;
    out.push({
      headingPath: keyPath.slice(0, -1),
      text: `${keyPath.join('.')}: ${rendered}`.slice(0, 2000),
      sourceStart: 0, sourceEnd: 0, pageNumber: null, sectionTitle: key || null,
    });
    return;
  }
  if (Array.isArray(value)) {
    value.slice(0, 200).forEach((item, i) => flattenStructured(item, [...keyPath, String(i)], depth + 1, maxDepth, out));
    return;
  }
  // Stable ordering so the same document always produces the same chunks.
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    flattenStructured((value as Record<string, unknown>)[key], [...keyPath, key], depth + 1, maxDepth, out);
  }
}

export function parseJson(raw: string): ParsedDocument {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new DocumentParseError('JSON_INVALID', 'document is not valid JSON'); }
  const leaves: ParsedSection[] = [];
  flattenStructured(value, [], 0, DOCUMENT_LIMITS.maxJsonDepth, leaves);
  const sections = groupStructuredSections(leaves);
  return {
    title: 'JSON document', language: 'en', mimeType: 'application/json',
    sections, metadata: {}, warnings: [], parserVersion: PARSER_VERSION,
  };
}

// ── YAML (safe subset) ──────────────────────────────────────────────────────────

/**
 * Deliberately a *subset*: block maps, block sequences, scalars, and simple inline
 * lists. Anchors, aliases, custom tags and merge keys are refused rather than
 * interpreted, which is what "safe schema only, no custom object constructors" means
 * with no YAML library available. Documents relying on those features fail cleanly.
 */
export function parseYamlSubset(raw: string, maxDepth: number): Record<string, unknown> {
  if (/(^|\s)(&\w+|\*\w+|!!?[\w:/.]+|<<\s*:)/m.test(raw)) {
    throw new DocumentParseError('YAML_UNSUPPORTED', 'YAML anchors, aliases, tags and merge keys are not supported');
  }
  type Frame =
    | { kind: 'map'; indent: number; container: Record<string, unknown>; lastKey: string | null;
        ownerContainer?: Record<string, unknown>; ownerKey?: string }
    | { kind: 'seq'; indent: number; container: unknown[] };

  const root: Record<string, unknown> = {};
  const stack: Frame[] = [{ kind: 'map', indent: -1, container: root, lastKey: null }];
  const top = (): Frame => stack[stack.length - 1];

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, '  ');
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const indent = line.length - line.trimStart().length;
    const content = line.trim();
    const item = /^-\s+(.*)$|^-$/.exec(content);

    // Sequence items at the same indent belong to the same sequence, so only strictly
    // shallower frames are closed for them. A mapping key at the same indent as a
    // sequence ends that sequence, so it also closes equal-indent frames.
    while (stack.length > 1 && (item ? indent < top().indent : indent <= top().indent)) stack.pop();
    if (stack.length > maxDepth) throw new DocumentParseError('YAML_TOO_DEEP', 'YAML nesting exceeds the supported depth');

    if (item) {
      const value = (item[1] ?? '').trim();
      let frame = top();
      if (frame.kind !== 'seq') {
        // Promote the mapping key that introduced this block into a real sequence. The
        // key lives on the *parent* container, recorded as ownerKey when this empty
        // mapping frame was created.
        const arr: unknown[] = [];
        if (frame.kind === 'map' && frame.ownerContainer && frame.ownerKey) {
          frame.ownerContainer[frame.ownerKey] = arr;
        } else if (frame.kind === 'map' && frame.lastKey) {
          frame.container[frame.lastKey] = arr;
        }
        const seq: Frame = { kind: 'seq', indent, container: arr };
        stack.push(seq);
        frame = seq;
      }
      const seq = frame as Extract<Frame, { kind: 'seq' }>;
      const pair = /^([\w.\-]+)\s*:\s*(.*)$/.exec(value);
      if (pair) {
        const child: Record<string, unknown> = {};
        if (pair[2]) child[pair[1]] = scalar(pair[2]);
        seq.container.push(child);
        stack.push({ kind: 'map', indent: indent + 2, container: child, lastKey: pair[1] || null });
      } else if (value) {
        seq.container.push(scalar(value));
      }
      continue;
    }

    const pair = /^([^:#]+):\s*(.*)$/.exec(content);
    if (!pair) continue;
    const key = pair[1].trim();
    const rest = pair[2].trim();

    let frame = top();
    if (frame.kind === 'seq') {
      // A bare key directly under a sequence attaches to its last mapping element.
      const last = frame.container[frame.container.length - 1];
      const target = last && typeof last === 'object' && !Array.isArray(last)
        ? (last as Record<string, unknown>)
        : root;
      const mapFrame: Frame = { kind: 'map', indent, container: target, lastKey: null };
      stack.push(mapFrame);
      frame = mapFrame;
    }
    const map = frame as Extract<Frame, { kind: 'map' }>;
    map.lastKey = key;

    if (!rest) {
      // Left empty: it becomes a mapping now and is promoted to a sequence if the next
      // line turns out to be a "- " item.
      const child: Record<string, unknown> = {};
      map.container[key] = child;
      stack.push({ kind: 'map', indent, container: child, lastKey: null, ownerContainer: map.container, ownerKey: key });
    } else if (/^\[.*\]$/.test(rest)) {
      map.container[key] = rest.slice(1, -1).split(',').map(v => scalar(v.trim())).filter(v => v !== '');
    } else {
      map.container[key] = scalar(rest);
    }
  }
  return root;
}

function scalar(input: string): unknown {
  const value = input.replace(/\s+#.*$/, '').trim().replace(/^["'](.*)["']$/, '$1');
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^-?\d*\.\d+$/.test(value)) return Number(value);
  return value;
}

export function parseYaml(raw: string): ParsedDocument {
  const value = parseYamlSubset(raw, DOCUMENT_LIMITS.maxYamlDepth);
  const leaves: ParsedSection[] = [];
  flattenStructured(value, [], 0, DOCUMENT_LIMITS.maxYamlDepth, leaves);
  const sections = groupStructuredSections(leaves);
  return {
    title: String((value as Record<string, unknown>).title || 'YAML document'),
    language: 'en', mimeType: 'application/yaml',
    sections, metadata: {}, warnings: [], parserVersion: PARSER_VERSION,
  };
}

// ── HTML ────────────────────────────────────────────────────────────────────────

export function parseHtml(raw: string): ParsedDocument {
  if (Buffer.byteLength(raw, 'utf8') > DOCUMENT_LIMITS.maxHtmlBytes) {
    throw new DocumentParseError('FILE_TOO_LARGE', 'HTML document exceeds the maximum ingestible size');
  }
  const titleMatch = /<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(raw);

  // Strip whole elements whose content must never survive, then remote resources, then
  // comments (a classic hiding place for injected instructions), then all remaining tags.
  const stripped = raw
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<head\b[\s\S]*?<\/head\s*>/gi, ' ')
    .replace(/<iframe\b[\s\S]*?<\/iframe\s*>/gi, ' ')
    .replace(/<object\b[\s\S]*?<\/object\s*>/gi, ' ')
    .replace(/<embed\b[^>]*>/gi, ' ')
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const sections: ParsedSection[] = [];
  const headingStack: Array<{ level: number; title: string }> = [];
  const parts = stripped.split(/(<h[1-6][^>]*>[\s\S]*?<\/h[1-6]\s*>)/i);
  let offset = 0;

  for (const part of parts) {
    const start = offset;
    offset += part.length;
    const heading = /^<h([1-6])[^>]*>([\s\S]*?)<\/h[1-6]\s*>$/i.exec(part);
    if (heading) {
      const level = Number(heading[1]);
      while (headingStack.length && headingStack[headingStack.length - 1].level >= level) headingStack.pop();
      headingStack.push({ level, title: decodeEntities(stripTags(heading[2])).trim() });
      continue;
    }
    const body = decodeEntities(stripTags(part)).replace(/[ \t\u00a0]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (!body) continue;
    sections.push({
      headingPath: headingStack.map(h => h.title),
      text: body, sourceStart: start, sourceEnd: start + part.length, pageNumber: null,
      sectionTitle: headingStack.length ? headingStack[headingStack.length - 1].title : null,
    });
    if (sections.length >= DOCUMENT_LIMITS.maxSections) break;
  }

  return {
    title: decodeEntities(stripTags(titleMatch?.[1] || '')).trim() || 'HTML document',
    language: detectLanguage(raw), mimeType: 'text/html',
    sections, metadata: {}, warnings: [], parserVersion: PARSER_VERSION,
  };
}

function stripTags(input: string): string {
  return input.replace(/<\/?[a-z][^>]*>/gi, ' ');
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'").replace(/&amp;/gi, '&');
}

// ── PDF ─────────────────────────────────────────────────────────────────────────

/**
 * Reuses the existing data-analyst extractor rather than adding a parser dependency.
 * That extractor needs `pdf-parse`, which is not installed in this repo, so PDF
 * ingestion reports a controlled failure instead of pretending to work. No OCR here.
 */
export async function parsePdf(filePath: string): Promise<ParsedDocument> {
  let extract: (p: string) => Promise<{ success: boolean; text?: string; pages?: number; error?: string; status?: string }>;
  try {
    ({ extractPDFText: extract } = await import('../../data-analyst/pdf-extractor'));
  } catch {
    throw new DocumentParseError('PARSER_UNAVAILABLE', 'PDF text extraction is not available in this deployment');
  }

  const result = await extract(filePath);
  if (!result?.success || !result.text) {
    const reason = /encrypt|password|protect/i.test(String(result?.error || result?.status || ''))
      ? 'PDF is encrypted or password protected'
      : 'PDF text could not be extracted';
    throw new DocumentParseError('PDF_UNREADABLE', reason);
  }

  const text = result.text.slice(0, DOCUMENT_LIMITS.maxTextChars);
  const pageTexts = text.split(/\f/);
  const sections: ParsedSection[] = [];
  let offset = 0;
  pageTexts.forEach((pageText, index) => {
    const start = offset;
    offset += pageText.length + 1;
    for (const block of pageText.split(/\r?\n\s*\r?\n/)) {
      const body = block.trim();
      if (!body) continue;
      sections.push({
        headingPath: [], text: body, sourceStart: start, sourceEnd: start + pageText.length,
        pageNumber: index + 1, sectionTitle: null,
      });
      if (sections.length >= DOCUMENT_LIMITS.maxSections) return;
    }
  });

  return {
    title: path.basename(filePath, '.pdf'), language: detectLanguage(text), mimeType: 'application/pdf',
    sections, metadata: { pages: result.pages ?? pageTexts.length }, warnings: [], parserVersion: PARSER_VERSION,
  };
}

// ── Dispatcher ──────────────────────────────────────────────────────────────────

export async function parseDocument(filePath: string, sourceType: DocumentSourceType): Promise<ParsedDocument> {
  if (sourceType === 'PDF') return parsePdf(filePath);
  const raw = readTextFile(filePath);
  switch (sourceType) {
    case 'MARKDOWN': return parseMarkdown(raw);
    case 'TEXT': return parsePlainText(raw);
    case 'JSON': return parseJson(raw);
    case 'YAML': return parseYaml(raw);
    case 'HTML': return parseHtml(raw);
    default:
      throw new DocumentParseError('UNSUPPORTED_MIME', 'unsupported document type');
  }
}

export { readTextFile };
