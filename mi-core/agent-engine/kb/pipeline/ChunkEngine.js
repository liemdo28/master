// kb/pipeline/ChunkEngine.js — splits documents into overlapping text chunks
const DEFAULT_CHUNK_SIZE  = 400;  // words per chunk
const DEFAULT_OVERLAP     = 80;   // words of overlap between chunks
const MIN_CHUNK_WORDS     = 20;   // discard fragments smaller than this

/**
 * Split markdown content into overlapping word-window chunks.
 * Paragraph boundaries are preferred for splits.
 */
export function chunkDocument(content, {
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap    = DEFAULT_OVERLAP,
} = {}) {
  // Normalise whitespace / strip markdown fencing artefacts
  const cleaned = content
    .replace(/```[\s\S]*?```/g, '')   // remove code blocks (keep prose)
    .replace(/`[^`]+`/g, '')          // remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // keep link text, drop URL
    .replace(/#{1,6}\s+/g, '')        // strip heading markers
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')  // strip bold/italic
    .replace(/\n{3,}/g, '\n\n');      // collapse blank lines

  const paragraphs = cleaned.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const words      = [];

  // Flatten paragraphs into word array, tracking paragraph boundaries
  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/).filter(Boolean);
    words.push(...paraWords);
    words.push('\n\n');  // sentinel to track paragraph break
  }

  const chunks = [];
  let start = 0;

  while (start < words.length) {
    const end   = Math.min(start + chunkSize, words.length);
    const slice = words.slice(start, end).filter((w) => w !== '\n\n');

    if (slice.length >= MIN_CHUNK_WORDS) {
      chunks.push(slice.join(' '));
    }

    if (end >= words.length) break;

    // Advance by (chunkSize - overlap), but prefer a paragraph boundary nearby
    const advanceTarget = start + chunkSize - overlap;
    let   advance       = advanceTarget;

    // Look for a '\n\n' sentinel within ±30 words of the advance target
    const searchStart = Math.max(start, advanceTarget - 30);
    const searchEnd   = Math.min(words.length, advanceTarget + 30);
    let   bestBreak   = -1;
    for (let i = searchStart; i < searchEnd; i++) {
      if (words[i] === '\n\n') { bestBreak = i; break; }
    }
    if (bestBreak > start) advance = bestBreak + 1;

    start = Math.max(start + 1, advance);  // always advance at least 1
  }

  return chunks;
}

/**
 * Chunk all documents in an array of { content, ... } objects.
 * Returns [{ docIndex, chunkIndex, text }]
 */
export function chunkAll(documents, options = {}) {
  const result = [];
  for (const [docIndex, doc] of documents.entries()) {
    const chunks = chunkDocument(doc.content, options);
    for (const [chunkIndex, text] of chunks.entries()) {
      result.push({ docIndex, chunkIndex, text });
    }
  }
  return result;
}
