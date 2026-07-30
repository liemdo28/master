#!/usr/bin/env node
// kb/ingest-mdn.js — BUILD-TIME TOOL — ingest MDN Web Docs articles
// Requires outbound internet. DO NOT run on offline target machines.
// License: MDN content is CC BY-SA 2.5 (Mozilla contributors).
//
// Usage:
//   node kb/ingest-mdn.js coding           # ingest kb/domains/coding-mdn.js
//   node kb/ingest-mdn.js                  # ingest all domains with MDN files

import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';
import { existsSync, readdirSync } from 'fs';
import { openKnowledgeBase }                  from './KnowledgeBase.js';
import { fetchMDNPage }                       from './pipeline/MDNFetcher.js';
import { ingestDocument }                     from './pipeline/Ingester.js';

const ROOT    = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MDN_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'domains');

const DELAY_MS    = 300;
const SKIP_EXISTING = true;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Discover MDN domain files
function findMDNFiles(targetDomain) {
  if (targetDomain) return [`${targetDomain}-mdn.js`];
  return readdirSync(MDN_DIR).filter(f => f.endsWith('-mdn.js'));
}

async function ingestMDNDomain(kb, modFile, stats) {
  const mod = await import(`./domains/${modFile}`);
  const { DOMAIN, DOMAIN_NAME, ARTICLES } = mod;

  console.log(`\n  ${DOMAIN} (MDN)  ·  ${ARTICLES.length} pages`);

  const dbDir = resolve(ROOT, '.local-agent', 'kb');
  const db    = kb.db;

  // Get existing slugs to skip
  const existingSlugs = new Set(
    db.prepare(`
      SELECT d.slug FROM documents d
      JOIN topics t ON t.id = d.topic_id
      JOIN domains dm ON dm.id = t.domain_id
      WHERE dm.slug = ?
    `).all(DOMAIN).map(r => r.slug)
  );

  let loaded = 0, skipped = 0, failed = 0;

  for (const { slug, topic, priority } of ARTICLES) {
    if (SKIP_EXISTING && existingSlugs.has(slug)) {
      process.stdout.write('·'); skipped++; continue;
    }

    try {
      const article = await fetchMDNPage(slug);
      if (!article) {
        process.stdout.write('✗'); failed++; await sleep(DELAY_MS); continue;
      }

      await ingestDocument(db, dbDir, {
        slug,
        domainSlug:  DOMAIN,
        domainName:  DOMAIN_NAME,
        topicSlug:   topic,
        topicName:   topic,
        title:       article.title,
        content:     article.extract,
        url:         article.url,
        wordCount:   article.wordCount,
        priority:    priority ?? 2,
        license:     'CC BY-SA 2.5',
        source:      'MDN Web Docs',
      });
      process.stdout.write('.'); loaded++;
    } catch (err) {
      process.stdout.write('!'); failed++;
      console.error(`\n  ERROR ${slug}: ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n  ${DOMAIN}/mdn: loaded=${loaded}  skipped=${skipped}  failed=${failed}`);
  stats.push({ domain: `${DOMAIN}/mdn`, loaded, skipped, failed, total: ARTICLES.length });
}

async function main() {
  const targetDomain = process.argv[2];
  const files        = findMDNFiles(targetDomain);

  if (files.length === 0) {
    console.error('No MDN domain files found. Create kb/domains/<domain>-mdn.js first.');
    process.exit(1);
  }

  console.log('\nMDN Web Docs Ingest — BUILD-TIME TOOL');
  console.log(`Files: ${files.join(', ')}`);
  console.log('License: CC BY-SA 2.5 (Mozilla contributors)\n');

  const kb    = openKnowledgeBase(ROOT);
  const stats = [];

  for (const file of files) {
    await ingestMDNDomain(kb, file, stats);
  }

  process.stdout.write('\nRebuilding TF-IDF index...');
  kb.rebuildIndex();
  console.log(' done\n');

  kb.close();
  console.log('MDN ingest complete.');
  for (const r of stats) {
    console.log(`  ${r.domain.padEnd(20)} loaded=${r.loaded}  skipped=${r.skipped}  failed=${r.failed}`);
  }
}

await main();
