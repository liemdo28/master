#!/usr/bin/env node
// kb/generate-stats.js — write kb/stats.json from the live database
// Safe to run offline; reads .local-agent/kb/knowledge.db
// Usage: node kb/generate-stats.js
//        npm run kb:generate-stats

import { resolve, dirname, join } from 'path';
import { fileURLToPath }          from 'url';
import { writeFileSync }          from 'fs';
import { openKnowledgeBase }      from './KnowledgeBase.js';

const ROOT     = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = join(ROOT, 'kb', 'stats.json');

const kb = openKnowledgeBase(ROOT);
const db = kb.db;

const total = {
  documents: db.prepare('SELECT COUNT(*) as n FROM documents').get().n,
  chunks:    db.prepare('SELECT COUNT(*) as n FROM chunks').get().n,
  words:     db.prepare('SELECT COALESCE(SUM(word_count),0) as n FROM documents').get().n,
};

const domainRows = db.prepare(`
  SELECT dm.slug as domain, dm.name as domainName,
         COUNT(DISTINCT d.id)    as documents,
         COUNT(DISTINCT c.id)    as chunks,
         COALESCE(SUM(d.word_count),0) as words,
         MIN(d.ingested_at)      as firstIngested,
         MAX(d.updated_at)       as lastUpdated
  FROM   domains dm
  JOIN   topics  t  ON t.domain_id = dm.id
  JOIN   documents d ON d.topic_id = t.id
  LEFT JOIN chunks c ON c.doc_id = d.id
  GROUP  BY dm.id
  ORDER  BY dm.slug
`).all();

const byDomain = domainRows.map(row => {
  const samples = db.prepare(`
    SELECT d.title, d.source_url, d.license, d.word_count,
           COUNT(c.id) as chunk_count
    FROM   documents d
    JOIN   topics t ON t.id = d.topic_id
    JOIN   domains dm ON dm.id = t.domain_id
    LEFT JOIN chunks c ON c.doc_id = d.id
    WHERE  dm.slug = ?
    GROUP  BY d.id
    ORDER  BY d.word_count DESC
    LIMIT  5
  `).all(row.domain);

  return {
    domain:         row.domain,
    domainName:     row.domainName,
    documents:      row.documents,
    chunks:         row.chunks,
    words:          row.words,
    firstIngested:  row.firstIngested,
    lastUpdated:    row.lastUpdated,
    sampleDocuments: samples.map(s => ({
      title:       s.title,
      source_url:  s.source_url,
      license:     s.license,
      word_count:  s.word_count,
      chunk_count: s.chunk_count,
    })),
  };
});

kb.close();

const stats = {
  generatedAt: new Date().toISOString(),
  total,
  byDomain,
};

writeFileSync(OUT_FILE, JSON.stringify(stats, null, 2));
console.log(`kb/stats.json updated — ${total.documents} documents, ${total.chunks} chunks, ${total.words.toLocaleString()} words`);
