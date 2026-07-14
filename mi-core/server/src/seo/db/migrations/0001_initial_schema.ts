/**
 * Migration 0001 — initial schema.
 *
 * This is a verbatim move of the inline `db.exec(...)` bootstrap that used to
 * live in `seo-db.ts`'s `getSeoDb()`. No columns, types, defaults, or index
 * definitions were changed — only the mechanism by which they get created.
 *
 * All statements use `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`
 * so this migration is safe to run against:
 *   - a brand-new empty database, or
 *   - a database that already has some/all of these tables from the old
 *     pre-migration inline-bootstrap code path (see upgrade-from-partial test).
 */

import type Database from 'better-sqlite3';
import type { Migration } from '../migration-runner';

const SQL = `
    -- Keyword research
    CREATE TABLE IF NOT EXISTS seo_keywords (
      id                  TEXT PRIMARY KEY,
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL,
      brand_id            TEXT NOT NULL,
      location_id         TEXT,
      keyword             TEXT NOT NULL,
      normalized_keyword  TEXT NOT NULL,
      language            TEXT DEFAULT 'en-US',
      search_intent        TEXT,
      funnel_stage        TEXT,
      estimated_demand    INTEGER,
      difficulty_estimate INTEGER,
      local_relevance     REAL,
      business_relevance  REAL,
      menu_relevance      REAL,
      conversion_potential REAL,
      seasonal_relevance  TEXT,
      target_url          TEXT,
      current_ranking     INTEGER,
      impressions         INTEGER,
      clicks              INTEGER,
      ctr                 REAL,
      avg_position        REAL,
      assigned_content_id TEXT,
      cannibalization_risk TEXT,
      status              TEXT NOT NULL DEFAULT 'DISCOVERED',
      source              TEXT,
      evidence_id         TEXT,
      last_reviewed_at    TEXT,
      deleted_at          TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_kw_brand ON seo_keywords(brand_id);
    CREATE INDEX IF NOT EXISTS idx_kw_status ON seo_keywords(status);
    CREATE INDEX IF NOT EXISTS idx_kw_normalized ON seo_keywords(normalized_keyword);

    -- Topic clusters
    CREATE TABLE IF NOT EXISTS seo_topic_clusters (
      id           TEXT PRIMARY KEY,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL,
      brand_id     TEXT NOT NULL,
      name         TEXT NOT NULL,
      pillar_content_id TEXT,
      health_status TEXT DEFAULT 'unknown',
      deleted_at   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_cluster_brand ON seo_topic_clusters(brand_id);

    CREATE TABLE IF NOT EXISTS seo_cluster_nodes (
      id           TEXT PRIMARY KEY,
      created_at   TEXT NOT NULL,
      cluster_id   TEXT NOT NULL,
      node_type    TEXT NOT NULL, -- pillar | supporting_article | location | menu_category
      ref_id       TEXT,
      label        TEXT NOT NULL,
      status       TEXT DEFAULT 'MISSING',
      link_status  TEXT DEFAULT 'unknown',
      ranking_status TEXT DEFAULT 'unknown'
    );
    CREATE INDEX IF NOT EXISTS idx_clusternode_cluster ON seo_cluster_nodes(cluster_id);

    -- Site pages (URL registry — backs internal link engine + CTA engine)
    CREATE TABLE IF NOT EXISTS seo_site_pages (
      id           TEXT PRIMARY KEY,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL,
      brand_id     TEXT NOT NULL,
      location_id  TEXT,
      url          TEXT NOT NULL,
      page_type    TEXT NOT NULL, -- money | location | menu | blog | home | other
      title        TEXT,
      meta_title   TEXT,
      meta_description TEXT,
      canonical    TEXT,
      is_orphan    INTEGER DEFAULT 0,
      last_crawled_at TEXT,
      deleted_at   TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_page_url ON seo_site_pages(brand_id, url);
    CREATE INDEX IF NOT EXISTS idx_page_brand ON seo_site_pages(brand_id);
    CREATE INDEX IF NOT EXISTS idx_page_type ON seo_site_pages(page_type);

    -- Content items (articles) + versions
    CREATE TABLE IF NOT EXISTS seo_content_items (
      id                TEXT PRIMARY KEY,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL,
      brand_id          TEXT NOT NULL,
      location_id       TEXT,
      title             TEXT,
      slug              TEXT,
      primary_keyword_id TEXT,
      search_intent     TEXT,
      article_type      TEXT,
      status            TEXT NOT NULL DEFAULT 'IDEA',
      quality_score     REAL,
      ai_provider       TEXT,
      scheduled_publish_at TEXT,
      published_at      TEXT,
      approval_id       TEXT,
      current_version_id TEXT,
      deleted_at        TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_content_brand ON seo_content_items(brand_id);
    CREATE INDEX IF NOT EXISTS idx_content_status ON seo_content_items(status);

    CREATE TABLE IF NOT EXISTS seo_article_versions (
      id            TEXT PRIMARY KEY,
      created_at    TEXT NOT NULL,
      content_id    TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      body          TEXT,
      meta_title    TEXT,
      meta_description TEXT,
      headings      TEXT, -- JSON
      faq           TEXT, -- JSON
      internal_links TEXT, -- JSON
      external_links TEXT, -- JSON
      cta           TEXT, -- JSON
      schema_json   TEXT,
      hero_image_url TEXT,
      author        TEXT,
      created_by_provider TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_articlever_content ON seo_article_versions(content_id);

    -- Business Fact Registry
    CREATE TABLE IF NOT EXISTS seo_business_facts (
      id             TEXT PRIMARY KEY,
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL,
      brand_id       TEXT NOT NULL,
      location_id    TEXT,
      category       TEXT NOT NULL,
      field_name     TEXT NOT NULL,
      value          TEXT NOT NULL,
      source         TEXT NOT NULL,
      source_ref     TEXT,
      verification_date TEXT,
      expiration_date TEXT,
      verified_by    TEXT,
      confidence     REAL,
      usage_restrictions TEXT,
      status         TEXT NOT NULL DEFAULT 'UNVERIFIED'
    );
    CREATE INDEX IF NOT EXISTS idx_fact_brand ON seo_business_facts(brand_id);
    CREATE INDEX IF NOT EXISTS idx_fact_status ON seo_business_facts(status);
    CREATE INDEX IF NOT EXISTS idx_fact_field ON seo_business_facts(brand_id, field_name);

    CREATE TABLE IF NOT EXISTS seo_article_facts (
      id          TEXT PRIMARY KEY,
      content_id  TEXT NOT NULL,
      fact_id     TEXT NOT NULL,
      claim_text  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_articlefact_content ON seo_article_facts(content_id);

    -- Internal links
    CREATE TABLE IF NOT EXISTS seo_internal_links (
      id            TEXT PRIMARY KEY,
      created_at    TEXT NOT NULL,
      brand_id      TEXT NOT NULL,
      source_url    TEXT NOT NULL,
      target_url    TEXT NOT NULL,
      anchor_text   TEXT,
      status        TEXT DEFAULT 'active', -- active | broken | removed
      last_verified_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_intlink_brand ON seo_internal_links(brand_id);
    CREATE INDEX IF NOT EXISTS idx_intlink_status ON seo_internal_links(status);

    -- Backlinks
    CREATE TABLE IF NOT EXISTS seo_backlinks (
      id                TEXT PRIMARY KEY,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL,
      brand_id          TEXT NOT NULL,
      source_domain     TEXT NOT NULL,
      source_url        TEXT NOT NULL,
      destination_url   TEXT NOT NULL,
      anchor_text       TEXT,
      domain_authority  REAL,
      page_authority    REAL,
      spam_score        REAL,
      topical_relevance REAL,
      local_relevance   REAL,
      link_type         TEXT, -- dofollow | nofollow
      sponsorship       TEXT, -- sponsored | ugc | none
      first_seen_at     TEXT,
      last_checked_at   TEXT,
      status            TEXT NOT NULL DEFAULT 'PENDING',
      risk_score        REAL,
      estimated_value   REAL,
      evidence_id       TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_backlink_brand ON seo_backlinks(brand_id);
    CREATE INDEX IF NOT EXISTS idx_backlink_status ON seo_backlinks(status);

    CREATE TABLE IF NOT EXISTS seo_backlink_checks (
      id           TEXT PRIMARY KEY,
      backlink_id  TEXT NOT NULL,
      checked_at   TEXT NOT NULL,
      result       TEXT -- JSON
    );

    -- Technical audits + issues
    CREATE TABLE IF NOT EXISTS seo_audits (
      id           TEXT PRIMARY KEY,
      created_at   TEXT NOT NULL,
      brand_id     TEXT NOT NULL,
      audit_type   TEXT NOT NULL, -- technical | local | gbp | backlink
      status       TEXT NOT NULL DEFAULT 'running',
      summary      TEXT, -- JSON
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_brand ON seo_audits(brand_id);

    CREATE TABLE IF NOT EXISTS seo_issues (
      id            TEXT PRIMARY KEY,
      created_at    TEXT NOT NULL,
      audit_id      TEXT,
      brand_id      TEXT NOT NULL,
      severity      TEXT NOT NULL, -- critical | warning | info
      issue_type    TEXT NOT NULL,
      affected_url  TEXT,
      description   TEXT,
      evidence_id   TEXT,
      recommended_fix TEXT,
      safe_auto_fix INTEGER DEFAULT 0,
      approval_required INTEGER DEFAULT 1,
      status        TEXT NOT NULL DEFAULT 'open', -- open | resolved | ignored
      resolved_at   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_issue_brand ON seo_issues(brand_id);
    CREATE INDEX IF NOT EXISTS idx_issue_status ON seo_issues(status);

    -- Automation / actions / policy
    CREATE TABLE IF NOT EXISTS seo_actions (
      id            TEXT PRIMARY KEY,
      created_at    TEXT NOT NULL,
      brand_id      TEXT,
      category      TEXT NOT NULL,
      policy_tier   TEXT NOT NULL, -- SAFE_AUTO | AUTO_WITH_NOTIFICATION | REQUIRES_APPROVAL | BLOCKED
      description   TEXT,
      status        TEXT NOT NULL DEFAULT 'pending', -- pending | ran | blocked | approved | rejected
      approval_id   TEXT,
      idempotency_key TEXT,
      evidence_id   TEXT,
      result        TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_action_idempotency ON seo_actions(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_action_brand ON seo_actions(brand_id);

    CREATE TABLE IF NOT EXISTS seo_automation_runs (
      id           TEXT PRIMARY KEY,
      started_at   TEXT NOT NULL,
      completed_at TEXT,
      job_id       TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'running',
      detail       TEXT -- JSON
    );

    CREATE TABLE IF NOT EXISTS seo_policy_versions (
      id           TEXT PRIMARY KEY,
      created_at   TEXT NOT NULL,
      version      INTEGER NOT NULL,
      policy_yaml  TEXT NOT NULL,
      changed_by   TEXT
    );

    -- Evidence (SEO-specific; mirrors company-os/evidence-store.ts pattern)
    CREATE TABLE IF NOT EXISTS seo_evidence (
      id           TEXT PRIMARY KEY,
      created_at   TEXT NOT NULL,
      action_id    TEXT,
      brand_id     TEXT,
      category     TEXT NOT NULL,
      summary      TEXT,
      payload      TEXT, -- JSON, may include before/after state, screenshots paths, QA results
      sha256       TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_evidence_action ON seo_evidence(action_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_brand ON seo_evidence(brand_id);

    -- GBP snapshots (table lives alongside the pre-existing gbp-snapshots.db file;
    -- kept here too so a single seo-control-center.db can be queried end-to-end)
    CREATE TABLE IF NOT EXISTS seo_gbp_snapshots (
      id           TEXT PRIMARY KEY,
      captured_at  TEXT NOT NULL,
      brand_id     TEXT NOT NULL,
      location_id  TEXT NOT NULL,
      raw_payload  TEXT, -- JSON
      nap_conflicts TEXT -- JSON
    );
    CREATE INDEX IF NOT EXISTS idx_gbpsnap_location ON seo_gbp_snapshots(brand_id, location_id);

    -- Rankings (GSC-derived, daily)
    CREATE TABLE IF NOT EXISTS seo_rankings (
      id           TEXT PRIMARY KEY,
      captured_at  TEXT NOT NULL,
      brand_id     TEXT NOT NULL,
      url          TEXT,
      query        TEXT,
      impressions  INTEGER,
      clicks       INTEGER,
      ctr          REAL,
      position     REAL
    );
    CREATE INDEX IF NOT EXISTS idx_ranking_brand ON seo_rankings(brand_id, captured_at);

    CREATE TABLE IF NOT EXISTS seo_analytics_daily (
      id           TEXT PRIMARY KEY,
      date         TEXT NOT NULL,
      brand_id     TEXT NOT NULL,
      location_id  TEXT,
      metric       TEXT NOT NULL,
      value        REAL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_unique ON seo_analytics_daily(date, brand_id, location_id, metric);

    -- AI jobs (ChatGPT-browser / manual-paste / local-model jobs)
    CREATE TABLE IF NOT EXISTS seo_ai_jobs (
      id             TEXT PRIMARY KEY,
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL,
      task_id        TEXT,
      brand_id       TEXT,
      location_id    TEXT,
      article_id     TEXT,
      provider       TEXT NOT NULL, -- chatgpt_browser | local_model | manual_paste
      template       TEXT,
      idempotency_key TEXT,
      status         TEXT NOT NULL DEFAULT 'queued', -- queued | running | waiting_for_login | completed | failed
      prompt         TEXT,
      error          TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_aijob_idempotency ON seo_ai_jobs(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_aijob_status ON seo_ai_jobs(status);

    CREATE TABLE IF NOT EXISTS seo_ai_responses (
      id           TEXT PRIMARY KEY,
      created_at   TEXT NOT NULL,
      job_id       TEXT NOT NULL,
      raw_response TEXT,
      parsed_json  TEXT,
      validated    INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_airesponse_job ON seo_ai_responses(job_id);

    -- Publish snapshots (for rollback)
    CREATE TABLE IF NOT EXISTS seo_publish_snapshots (
      id           TEXT PRIMARY KEY,
      created_at   TEXT NOT NULL,
      brand_id     TEXT NOT NULL,
      content_id   TEXT,
      target       TEXT NOT NULL, -- preview | production
      before_state TEXT, -- JSON
      after_state  TEXT, -- JSON
      status       TEXT NOT NULL DEFAULT 'pending', -- pending | live | rolled_back | failed
      rolled_back_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_publishsnap_brand ON seo_publish_snapshots(brand_id);

    -- Reports
    CREATE TABLE IF NOT EXISTS seo_reports (
      id           TEXT PRIMARY KEY,
      created_at   TEXT NOT NULL,
      brand_id     TEXT,
      report_type  TEXT NOT NULL, -- daily | weekly | monthly
      period_start TEXT,
      period_end   TEXT,
      content      TEXT -- JSON or HTML
    );
    CREATE INDEX IF NOT EXISTS idx_report_brand ON seo_reports(brand_id);
`;

const migration: Migration = {
  version: 1,
  name: 'initial_schema',
  // Checksum is derived from this exact SQL string by the runner (see
  // migration-runner.ts) rather than from up.toString(), so re-formatting
  // this file's TypeScript wrapper (e.g. prettier reflow) without touching
  // the SQL won't falsely trip the tamper-detection warning.
  sql: SQL,
  up(db: InstanceType<typeof Database>): void {
    db.exec(SQL);
  },
};

export default migration;
