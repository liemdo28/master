// kb/KBQuery.js — offline RAG query engine: FTS5 + TF-IDF re-rank
import { rankChunks, vectorise, deserialiseIDF } from './pipeline/EmbeddingEngine.js';
import { loadIDF } from './pipeline/Ingester.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const FTS_LIMIT     = 50;   // FTS5 candidates before TF-IDF re-rank
const DEFAULT_TOP_K = 5;

/**
 * Full hybrid search: FTS5 candidate retrieval + TF-IDF cosine re-rank.
 *
 * @param {object}  db      - better-sqlite3 connection
 * @param {string}  dbDir   - directory of the KB db (for IDF file)
 * @param {string}  query
 * @param {object}  [opts]
 * @param {number}  [opts.topK]
 * @param {string}  [opts.domain]   - filter by domain slug
 * @param {string}  [opts.topic]    - filter by topic slug
 * @returns {{ chunkId, docId, docTitle, domain, topic, text, score, rank }[]}
 */
export function search(db, dbDir, query, { topK = DEFAULT_TOP_K, domain = null, topic = null } = {}) {
  if (!query || !query.trim()) return [];

  // Sanitise query for FTS5: keep only alphanumeric tokens, join with OR
  const ftsQuery = query
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .join(' OR ');
  if (!ftsQuery) return [];

  // ── 1. FTS5 candidate retrieval ───────────────────────────────────────────
  let sql = `
    SELECT
      c.id      AS chunkId,
      c.doc_id  AS docId,
      c.content AS text,
      d.title   AS docTitle,
      d.source_url,
      d.license,
      d.attribution,
      dm.slug   AS domain,
      t.slug    AS topic,
      bm25(chunks_fts) AS ftsScore
    FROM chunks_fts
    JOIN chunks   c  ON c.id = chunks_fts.rowid
    JOIN documents d  ON d.id = c.doc_id
    JOIN topics    t  ON t.id = d.topic_id
    JOIN domains   dm ON dm.id = t.domain_id
    WHERE chunks_fts MATCH ?
  `;
  const params = [ftsQuery];

  if (domain) { sql += ' AND dm.slug = ?'; params.push(domain); }
  if (topic)  { sql += ' AND t.slug = ?';  params.push(topic);  }

  sql += ` ORDER BY ftsScore LIMIT ${FTS_LIMIT}`;

  let candidates;
  try {
    candidates = db.prepare(sql).all(...params);
  } catch {
    // FTS5 syntax error — fall back to LIKE search
    candidates = fallbackLike(db, query, domain, topic);
  }

  if (candidates.length === 0) return [];

  // ── 2. TF-IDF re-rank ────────────────────────────────────────────────────
  const idf     = loadIDF(db, dbDir);
  const chunks  = candidates.map((r) => ({ id: r.chunkId, text: r.text }));
  const ranked  = rankChunks(query, idf, chunks, topK);

  // Merge scores with metadata
  const metaMap = new Map(candidates.map((r) => [r.chunkId, r]));
  return ranked.map((r, i) => ({
    rank:        i + 1,
    chunkId:     r.id,
    docId:       metaMap.get(r.id)?.docId,
    docTitle:    metaMap.get(r.id)?.docTitle,
    domain:      metaMap.get(r.id)?.domain,
    topic:       metaMap.get(r.id)?.topic,
    source_url:  metaMap.get(r.id)?.source_url,
    license:     metaMap.get(r.id)?.license,
    attribution: metaMap.get(r.id)?.attribution,
    text:        r.text,
    score:       Math.round(r.score * 1000) / 1000,
  }));
}

function fallbackLike(db, query, domain, topic) {
  const term   = `%${query.replace(/%/g, '')}%`;
  let sql = `
    SELECT
      c.id AS chunkId, c.doc_id AS docId, c.content AS text,
      d.title AS docTitle, d.source_url, d.license, d.attribution,
      dm.slug AS domain, t.slug AS topic, 0 AS ftsScore
    FROM chunks c
    JOIN documents d  ON d.id = c.doc_id
    JOIN topics    t  ON t.id = d.topic_id
    JOIN domains   dm ON dm.id = t.domain_id
    WHERE c.content LIKE ?
  `;
  const params = [term];
  if (domain) { sql += ' AND dm.slug = ?'; params.push(domain); }
  if (topic)  { sql += ' AND t.slug = ?';  params.push(topic);  }
  sql += ` LIMIT ${FTS_LIMIT}`;
  return db.prepare(sql).all(...params);
}

/**
 * List all documents in a domain/topic with basic metadata.
 */
export function listDocs(db, { domain, topic } = {}) {
  let sql = `
    SELECT
      d.id, d.slug, d.title, d.word_count, d.chunk_count, d.license,
      d.ingested_at, dm.slug AS domain, t.slug AS topic
    FROM documents d
    JOIN topics  t  ON t.id = d.topic_id
    JOIN domains dm ON dm.id = t.domain_id
    WHERE 1=1
  `;
  const params = [];
  if (domain) { sql += ' AND dm.slug = ?'; params.push(domain); }
  if (topic)  { sql += ' AND t.slug = ?';  params.push(topic);  }
  sql += ' ORDER BY dm.slug, t.slug, d.slug';
  return db.prepare(sql).all(...params);
}
