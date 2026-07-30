// kb/SeedLoader.js — loads seed documents from sources/*.json into the KB
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { openKnowledgeBase } from './KnowledgeBase.js';

const KB_DIR    = dirname(fileURLToPath(import.meta.url));
const DOMAINS   = ['coding', 'accounting', 'marketing', 'website', 'design',
                   'machine-learning', 'data-analyst', 'hr', 'business-analyst', 'logistics'];

function loadSourceConfig(domain) {
  const p = join(KB_DIR, 'sources', `${domain}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

function loadSeedDoc(config, docDef) {
  const filePath = join(KB_DIR, docDef.file);
  if (!existsSync(filePath)) {
    console.warn(`  [warn] seed file not found: ${docDef.file}`);
    return null;
  }
  return {
    domainSlug:  config.domain,
    domainName:  config.domainName,
    topicSlug:   docDef.topicSlug,
    topicName:   docDef.topicName,
    slug:        docDef.slug,
    title:       docDef.title,
    content:     readFileSync(filePath, 'utf8'),
    license:     docDef.license,
    attribution: docDef.attribution ?? null,
    source_url:  docDef.sourceUrl   ?? null,
  };
}

/**
 * Seed all domains (or a specific list) into the knowledge base.
 *
 * @param {string}   workspaceRoot
 * @param {string[]} [domains] — defaults to all 10
 * @returns {{ domain, loaded, skipped }[]}
 */
export function seedAll(workspaceRoot, domains = DOMAINS) {
  const kb      = openKnowledgeBase(workspaceRoot);
  const results = [];

  for (const domain of domains) {
    const config = loadSourceConfig(domain);
    if (!config) {
      results.push({ domain, loaded: 0, skipped: 0, error: 'no source config' });
      continue;
    }

    const docs = (config.seedDocuments ?? [])
      .map((def) => loadSeedDoc(config, def))
      .filter(Boolean);

    if (docs.length === 0) {
      results.push({ domain, loaded: 0, skipped: 0 });
      continue;
    }

    const ingested = kb.ingestMany(docs);
    results.push({ domain, loaded: ingested.length, skipped: docs.length - ingested.length });
  }

  kb.rebuildIndex();
  kb.close();
  return results;
}

/**
 * Seed a single domain.
 */
export function seedDomain(workspaceRoot, domain) {
  return seedAll(workspaceRoot, [domain]);
}
