// kb/pipeline/EmbeddingEngine.js — offline TF-IDF sparse embedding (no cloud)
// Implements TF-IDF vectorisation + cosine similarity for offline RAG.

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','is','are','was','were','be','been','being','have','has',
  'had','do','does','did','will','would','could','should','may','might',
  'this','that','these','those','it','its','i','you','he','she','we',
  'they','their','them','our','your','his','her','not','no','as','if',
  'can','so','up','out','about','into','than','then','when','where',
  'how','what','which','who','all','any','each','both','more','also',
]);

function tokenise(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function stem(word) {
  // Very light Porter-inspired suffix stripping (no external deps)
  if (word.length <= 4) return word;
  if (word.endsWith('ing'))  return word.slice(0, -3);
  if (word.endsWith('tion')) return word.slice(0, -4);
  if (word.endsWith('ness')) return word.slice(0, -4);
  if (word.endsWith('ment')) return word.slice(0, -4);
  if (word.endsWith('ly'))   return word.slice(0, -2);
  if (word.endsWith('ed'))   return word.slice(0, -2);
  if (word.endsWith('er'))   return word.slice(0, -2);
  if (word.endsWith('es'))   return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function termFreq(tokens) {
  const freq = new Map();
  for (const t of tokens) {
    const s = stem(t);
    freq.set(s, (freq.get(s) ?? 0) + 1);
  }
  return freq;
}

/**
 * Build an IDF map from a corpus of texts.
 * @param {string[]} corpus
 * @returns {Map<string, number>} term → idf score
 */
export function buildIDF(corpus) {
  const N   = corpus.length;
  const df  = new Map();

  for (const text of corpus) {
    const seen = new Set(tokenise(text).map(stem));
    for (const term of seen) df.set(term, (df.get(term) ?? 0) + 1);
  }

  const idf = new Map();
  for (const [term, count] of df) {
    idf.set(term, Math.log((N + 1) / (count + 1)) + 1);  // smoothed
  }
  return idf;
}

/**
 * Compute TF-IDF vector for a single text given an IDF map.
 * Returns a sparse Map<term, score>.
 */
export function vectorise(text, idf) {
  const tokens = tokenise(text);
  if (tokens.length === 0) return new Map();
  const tf  = termFreq(tokens);
  const vec = new Map();
  for (const [term, freq] of tf) {
    const idfVal = idf.get(term) ?? (Math.log((idf.size + 1) / 1) + 1);
    vec.set(term, (freq / tokens.length) * idfVal);
  }
  return vec;
}

/**
 * Cosine similarity between two sparse vectors (Map<term, score>).
 */
export function cosineSim(vecA, vecB) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, valA] of vecA) {
    const valB = vecB.get(term) ?? 0;
    dot   += valA * valB;
    normA += valA * valA;
  }
  for (const [, valB] of vecB) normB += valB * valB;

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Rank chunks by cosine similarity to a query vector.
 * @param {string}              query
 * @param {Map<string,number>}  idf
 * @param {{ id, text }[]}      chunks
 * @param {number}              topK
 * @returns {{ id, text, score }[]}
 */
export function rankChunks(query, idf, chunks, topK = 10) {
  const qVec = vectorise(query, idf);

  const scored = chunks.map(({ id, text }) => ({
    id,
    text,
    score: cosineSim(qVec, vectorise(text, idf)),
  }));

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Serialise IDF map to a plain object for JSON storage.
 */
export function serialiseIDF(idf) {
  return Object.fromEntries(idf);
}

/**
 * Deserialise IDF from plain object.
 */
export function deserialiseIDF(obj) {
  return new Map(Object.entries(obj));
}
