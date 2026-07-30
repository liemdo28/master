#!/usr/bin/env node
// kb/ingest-all.js — BUILD-TIME TOOL — bulk ingest all domains from Wikipedia
// Requires outbound internet (Wikipedia API). DO NOT run on offline target machines.
// Target machines install a pre-built artifact: npm run kb:install <knowledge.db.gz>
import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';
import { openKnowledgeBase }           from './KnowledgeBase.js';
import { fetchArticle, extractToMarkdown } from './pipeline/WikipediaFetcher.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT        = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOMAINS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'domains');
const DOMAINS = [
  'coding', 'accounting', 'marketing', 'website', 'design',
  'machine-learning', 'data-analyst', 'hr', 'business-analyst', 'logistics',
];
const DELAY_MS      = 230;
const SKIP_EXISTING = true;   // idempotent — skip if already ingested

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function ingestDomain(kb, domainMod, stats) {
  const { DOMAIN, DOMAIN_NAME, ARTICLES } = domainMod;
  const db = kb.db;

  // Cache existing doc slugs to enable idempotent runs
  const existingSlugs = new Set(
    db.prepare(`
      SELECT d.slug FROM documents d
      JOIN topics  t  ON t.id = d.topic_id
      JOIN domains dm ON dm.id = t.domain_id
      WHERE dm.slug = ?
    `).all(DOMAIN).map((r) => r.slug)
  );

  let loaded = 0, skipped = 0, failed = 0;
  process.stdout.write(`  ${DOMAIN.padEnd(22)}: `);

  for (const art of ARTICLES) {
    const slug = art.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);

    if (SKIP_EXISTING && existingSlugs.has(slug)) {
      skipped++;
      continue;
    }

    try {
      const result = await fetchArticle(art.title);
      if (!result || result.wordCount < 50) {
        failed++;
        process.stdout.write('✗');
        await sleep(DELAY_MS);
        continue;
      }

      const content = extractToMarkdown(result.title, result.extract, result.url);
      kb.ingest({
        domainSlug:  DOMAIN,
        domainName:  DOMAIN_NAME,
        topicSlug:   art.topic,
        topicName:   art.topicName ?? art.topic,
        slug,
        title:       result.title,
        content,
        source_url:  result.url,
        license:     'CC BY-SA 4.0',
        attribution: 'Wikipedia contributors',
      });

      loaded++;
      process.stdout.write('.');
    } catch (err) {
      failed++;
      process.stdout.write('!');
    }

    await sleep(DELAY_MS);
  }

  console.log(` done — ${loaded} loaded, ${skipped} skipped, ${failed} failed`);
  stats.push({ domain: DOMAIN, loaded, skipped, failed, total: ARTICLES.length });
}

async function main() {
  const cliArgs       = process.argv.slice(2);
  const targetDomains = cliArgs.length > 0 ? cliArgs : DOMAINS;

  console.log(`\nKnowledge Base Bulk Ingest — Wikipedia`);
  console.log(`Targets: ${targetDomains.join(', ')}`);
  console.log(`Mode: ${SKIP_EXISTING ? 'idempotent (skip existing)' : 'full re-ingest'}\n`);

  const kb    = openKnowledgeBase(ROOT);
  const stats = [];
  const t0    = Date.now();

  for (const domainArg of targetDomains) {
    // domainArg can be:
    //   "coding"            → auto-discovers all coding-articles*.js batches
    //   "coding/2"          → domains/coding-articles-2.js (explicit batch)
    //   "machine-learning"  → auto-discovers all machine-learning-articles*.js

    if (domainArg.includes('/')) {
      // Explicit batch: coding/2 → coding-articles-2.js
      const [slug, batch] = domainArg.split('/');
      const fileName = `./domains/${slug}-articles-${batch}.js`;
      let mod;
      try { mod = await import(fileName); }
      catch { console.log(`  ${domainArg}: article list not found at ${fileName}`); continue; }
      await ingestDomain(kb, mod, stats);
    } else {
      // Auto-discover: load all batch files for this domain slug in order
      // Use existsSync so gaps in numbering (e.g. -2 and -4 but no -3) don't stop discovery
      const slug = domainArg;
      const batchFiles = [`./domains/${slug}-articles.js`];
      for (let n = 2; n <= 9; n++) {
        if (existsSync(join(DOMAINS_DIR, `${slug}-articles-${n}.js`)))
          batchFiles.push(`./domains/${slug}-articles-${n}.js`);
      }
      for (const fileName of batchFiles) {
        let mod;
        try { mod = await import(fileName); }
        catch { console.log(`  ${slug}: batch file not found at ${fileName}`); continue; }
        await ingestDomain(kb, mod, stats);
      }
    }
  }

  // Rebuild TF-IDF index once after all ingestion
  process.stdout.write('\nRebuilding TF-IDF index...');
  kb.rebuildIndex();
  console.log(' done');

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const s = kb.stats();
  kb.close();

  console.log('\n══════════════════════════════════════════════════════');
  console.log('Domain                  Loaded  Skipped  Failed  Total');
  console.log('──────────────────────────────────────────────────────');
  for (const r of stats) {
    console.log(
      `${r.domain.padEnd(24)}${String(r.loaded).padStart(6)}  ${String(r.skipped).padStart(7)}  ${String(r.failed).padStart(6)}  ${String(r.total).padStart(5)}`
    );
  }
  console.log('──────────────────────────────────────────────────────');
  console.log(`\nTotal docs in KB: ${s.documents}  Chunks: ${s.chunks}  Words: ${s.words.toLocaleString()}`);
  console.log(`Time: ${elapsed}s`);
}

main().catch((err) => { console.error(err); process.exit(1); });
