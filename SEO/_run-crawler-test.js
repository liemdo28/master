#!/usr/bin/env node
/**
 * Quick test: run the website crawler against bakudanramen.com
 */
const path = require('path');
process.chdir(path.join(__dirname));
const c = require('./shared/connectors/crawler');

(async () => {
  console.log('Starting crawler...');
  const result = await c.crawl({ check_broken_links: true });
  console.log(JSON.stringify({
    status: result.status,
    records: result.records,
    successful_pages: result.successful_pages,
    failed_pages: result.failed_pages,
    broken_links_found: result.broken_links_found,
    pages: (result.data || []).map(p => ({
      url: p.url,
      status_code: p.status_code,
      title: p.title,
      h1: p.h1,
      meta_description: p.meta_description,
      canonical: p.canonical,
      robots_status: p.robots_status,
      schema_present: p.schema_present,
      schema_types: p.schema_types,
      images_total: p.images_total,
      images_missing_alt: p.images_missing_alt,
      internal_links_count: p.internal_links_count,
      broken_links_count: p.broken_links_count,
    })),
    raw_payload_path: result.raw_payload_path,
    credentials_configured: result.credentials_configured,
  }, null, 2));
})().catch(e => { console.error('CRAWLER ERROR:', e.message); process.exit(1); });