// kb/pipeline/Ingester.js — ingest documents into KB (chunk + index + tfidf)
import { chunkDocument } from './ChunkEngine.js';
import { buildIDF, vectorise, serialiseIDF, deserialiseIDF } from './EmbeddingEngine.js';
import {
  upsertDomain, upsertTopic, upsertDocument,
  insertChunks, getChunks,
} from '../KBDatabase.js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

function getIdfPath(dbDir) {
  return join(dbDir, 'idf.json');
}

/**
 * Rebuild the IDF map from all chunks currently in the DB.
 * Saves to <dbDir>/idf.json for fast loading.
 */
export function rebuildIDF(db, dbDir) {
  const rows   = db.prepare('SELECT content FROM chunks').all();
  const corpus = rows.map((r) => r.content);
  const idf    = buildIDF(corpus);
  writeFileSync(getIdfPath(dbDir), JSON.stringify(serialiseIDF(idf), null, 2));
  return idf;
}

/**
 * Load IDF from disk, or rebuild from DB if missing.
 */
export function loadIDF(db, dbDir) {
  const p = getIdfPath(dbDir);
  if (existsSync(p)) {
    return deserialiseIDF(JSON.parse(readFileSync(p, 'utf8')));
  }
  return rebuildIDF(db, dbDir);
}

/**
 * Save TF-IDF term weights for all chunks of a document into tfidf_terms table.
 */
function indexTFIDF(db, docId, idf) {
  const chunks = getChunks(db, docId);
  db.prepare('DELETE FROM tfidf_terms WHERE chunk_id IN (SELECT id FROM chunks WHERE doc_id = ?)').run(docId);
  const stmt = db.prepare('INSERT OR IGNORE INTO tfidf_terms (chunk_id, term, tf_idf) VALUES (?, ?, ?)');
  // node:sqlite has no .transaction() helper — use explicit BEGIN/COMMIT
  db.exec('BEGIN');
  try {
    for (const chunk of chunks) {
      const vec = vectorise(chunk.content, idf);
      for (const [term, score] of vec) {
        stmt.run(chunk.id, term, score);
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Ingest a single document into the knowledge base.
 *
 * @param {object} db         - better-sqlite3 connection
 * @param {string} dbDir      - directory containing the DB (for IDF file)
 * @param {object} opts
 * @param {string} opts.domainSlug
 * @param {string} opts.domainName
 * @param {string} opts.topicSlug
 * @param {string} opts.topicName
 * @param {string} opts.slug         - document slug (unique within topic)
 * @param {string} opts.title
 * @param {string} opts.content      - markdown content
 * @param {string} [opts.source_url]
 * @param {string} [opts.license]
 * @param {string} [opts.attribution]
 * @param {object} [opts.chunkOptions]
 */
export function ingestDocument(db, dbDir, {
  domainSlug, domainName,
  topicSlug,  topicName,
  slug, title, content,
  source_url  = null,
  license     = 'unknown',
  attribution = null,
  chunkOptions = {},
}) {
  // 1. Ensure domain + topic exist
  upsertDomain(db, { slug: domainSlug, name: domainName });
  const topic = upsertTopic(db, domainSlug, { slug: topicSlug, name: topicName });

  // 2. Upsert document
  const docId = upsertDocument(db, topic.id, { slug, title, content, source_url, license, attribution });

  // 3. Chunk
  const chunks = chunkDocument(content, chunkOptions);
  insertChunks(db, docId, chunks);

  // Log to ingest_log
  db.prepare("INSERT INTO ingest_log (doc_id, action, detail) VALUES (?, 'ingest', ?)")
    .run(docId, `${chunks.length} chunks`);

  return { docId, chunks: chunks.length };
}

/**
 * Ingest an array of documents, then rebuild IDF once.
 */
export function ingestBatch(db, dbDir, documents, chunkOptions = {}) {
  const results = [];
  for (const doc of documents) {
    const r = ingestDocument(db, dbDir, { ...doc, chunkOptions });
    results.push(r);
  }
  rebuildIDF(db, dbDir);
  return results;
}
