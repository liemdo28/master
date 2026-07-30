-- ============================================================================
-- SEO Phase 6.5: Multi-Brand Support Migration
-- Created: 2026-06-24
-- Purpose: Upgrade SEO Operating System from single-brand to multi-brand
-- ============================================================================

-- ============================================================================
-- CORE BRAND ENTITIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS brands (
  brand_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',  -- active | inactive | needs_config
  industry TEXT,
  cuisine TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS brand_domains (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(brand_id),
  domain TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 1,
  ssl_status TEXT DEFAULT 'pending',
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS brand_locations (
  location_id TEXT NOT NULL,
  brand_id TEXT NOT NULL REFERENCES brands(brand_id),
  name TEXT NOT NULL,
  short_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',  -- active | inactive | needs_location_config
  address TEXT,
  phone TEXT,
  website_url TEXT,
  menu_url TEXT,
  order_url TEXT,
  hours TEXT,
  geo_lat REAL DEFAULT 0,
  geo_lng REAL DEFAULT 0,
  gbp_place_id TEXT,
  categories TEXT,  -- JSON array
  apple_status TEXT DEFAULT 'pending_audit',
  bing_status TEXT DEFAULT 'pending_audit',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (brand_id, location_id)
);

CREATE TABLE IF NOT EXISTS brand_platform_accounts (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(brand_id),
  location_id TEXT,  -- nullable for brand-level accounts
  platform TEXT NOT NULL,  -- gsc | ga4 | gbp | apple | bing | facebook | instagram | yelp
  account_id TEXT,
  property_id TEXT,
  credentials_profile TEXT,
  status TEXT DEFAULT 'needs_config',  -- ready | needs_config | missing_credentials | blocked
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS brand_keywords (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(brand_id),
  location_id TEXT,
  keyword TEXT NOT NULL,
  intent TEXT,  -- informational | commercial | transactional | navigational
  search_volume_estimate TEXT,
  competition TEXT,  -- low | medium | high
  priority INTEGER DEFAULT 0,
  source TEXT DEFAULT 'seeded',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS brand_pages (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(brand_id),
  location_id TEXT,
  url TEXT NOT NULL,
  page_type TEXT,  -- home | menu | location | blog | about | contact
  title TEXT,
  status TEXT DEFAULT 'pending',
  source TEXT DEFAULT 'seeded',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS brand_connectors (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(brand_id),
  connector_type TEXT NOT NULL,  -- crawler | gsc | ga4 | gbp | citation_scan | apple | bing
  status TEXT DEFAULT 'needs_config',  -- ready | needs_config | missing_credentials | blocked | error
  credentials_configured INTEGER DEFAULT 0,
  last_run_at TEXT,
  last_success_at TEXT,
  last_error TEXT,
  config TEXT,  -- JSON for connector-specific config
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS brand_permissions (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(brand_id),
  user_id TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',  -- admin | editor | viewer
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS brand_dashboard_snapshots (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(brand_id),
  snapshot_at TEXT NOT NULL DEFAULT (datetime('now')),
  payload TEXT,  -- JSON snapshot
  source TEXT DEFAULT 'seeded'
);

-- ============================================================================
-- UPGRADED EXISTING ENTITIES — add brand_id, location_id, source, fetched_at
-- ============================================================================

-- locations (wrapped via brand_locations above, but keep for backward compat)

-- GBP Profiles
CREATE TABLE IF NOT EXISTS gbp_profiles_v2 (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  location_id TEXT,
  gbp_account_id TEXT,
  gbp_location_id TEXT,
  place_id TEXT,
  name TEXT,
  address TEXT,
  phone TEXT,
  website TEXT,
  categories TEXT,
  hours TEXT,
  rating REAL,
  review_count INTEGER DEFAULT 0,
  photo_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  source TEXT DEFAULT 'seeded',
  fetched_at TEXT,
  raw_payload_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Apple Profiles
CREATE TABLE IF NOT EXISTS apple_profiles (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  location_id TEXT,
  apple_place_id TEXT,
  name TEXT,
  status TEXT DEFAULT 'pending',
  source TEXT DEFAULT 'seeded',
  fetched_at TEXT,
  raw_payload_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Bing Profiles
CREATE TABLE IF NOT EXISTS bing_profiles (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  location_id TEXT,
  bing_place_id TEXT,
  name TEXT,
  status TEXT DEFAULT 'pending',
  source TEXT DEFAULT 'seeded',
  fetched_at TEXT,
  raw_payload_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pages
CREATE TABLE IF NOT EXISTS pages_v2 (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  location_id TEXT,
  url TEXT NOT NULL,
  title TEXT,
  meta_description TEXT,
  h1 TEXT,
  page_type TEXT,
  status TEXT DEFAULT 'pending',
  source TEXT DEFAULT 'seeded',
  fetched_at TEXT,
  raw_payload_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Keywords
CREATE TABLE IF NOT EXISTS keywords_v2 (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  location_id TEXT,
  keyword TEXT NOT NULL,
  intent TEXT,
  position INTEGER,
  impressions INTEGER,
  clicks INTEGER,
  ctr REAL,
  url TEXT,
  source TEXT DEFAULT 'seeded',
  fetched_at TEXT,
  raw_payload_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Schema Items
CREATE TABLE IF NOT EXISTS schema_items_v2 (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  location_id TEXT,
  url TEXT NOT NULL,
  schema_type TEXT,
  payload TEXT,
  valid INTEGER DEFAULT 1,
  issues TEXT,
  source TEXT DEFAULT 'seeded',
  fetched_at TEXT,
  raw_payload_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Content Briefs
CREATE TABLE IF NOT EXISTS content_briefs_v2 (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  location_id TEXT,
  topic TEXT NOT NULL,
  target_keyword TEXT,
  intent TEXT,
  outline TEXT,
  status TEXT DEFAULT 'planned',
  source TEXT DEFAULT 'seeded',
  fetched_at TEXT,
  raw_payload_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews_v2 (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  location_id TEXT,
  platform TEXT,
  rating REAL,
  text TEXT,
  author TEXT,
  date TEXT,
  response TEXT,
  source TEXT DEFAULT 'seeded',
  fetched_at TEXT,
  raw_payload_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Citations
CREATE TABLE IF NOT EXISTS citations_v2 (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  location_id TEXT,
  directory TEXT,
  url TEXT,
  nap_match INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  source TEXT DEFAULT 'seeded',
  fetched_at TEXT,
  raw_payload_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Technical Issues
CREATE TABLE IF NOT EXISTS technical_issues_v2 (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  location_id TEXT,
  page_id TEXT,
  url TEXT,
  check_type TEXT,
  status TEXT DEFAULT 'pending',
  severity TEXT DEFAULT 'info',
  detail TEXT,
  source TEXT DEFAULT 'seeded',
  fetched_at TEXT,
  raw_payload_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ranking Snapshots
CREATE TABLE IF NOT EXISTS ranking_snapshots_v2 (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  location_id TEXT,
  keyword TEXT NOT NULL,
  position INTEGER,
  impressions INTEGER,
  clicks INTEGER,
  ctr REAL,
  url TEXT,
  source TEXT DEFAULT 'seeded',
  fetched_at TEXT,
  raw_payload_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Analytics Metrics
CREATE TABLE IF NOT EXISTS analytics_metrics (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  location_id TEXT,
  metric_type TEXT,
  value REAL,
  dimension TEXT,
  period TEXT,
  source TEXT DEFAULT 'seeded',
  fetched_at TEXT,
  raw_payload_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- UTM Links
CREATE TABLE IF NOT EXISTS utm_links_v2 (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  location_id TEXT,
  url TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  source TEXT DEFAULT 'seeded',
  fetched_at TEXT,
  raw_payload_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Agent Status
CREATE TABLE IF NOT EXISTS agent_status_v2 (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  brand_id TEXT,
  status TEXT DEFAULT 'online',
  health TEXT DEFAULT 'healthy',
  port INTEGER,
  version TEXT,
  uptime_s INTEGER DEFAULT 0,
  error_state TEXT,
  source TEXT DEFAULT 'seeded',
  fetched_at TEXT,
  raw_payload_path TEXT,
  registered_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_sync_at TEXT
);

-- Agent Tasks
CREATE TABLE IF NOT EXISTS agent_tasks_v2 (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  brand_id TEXT,
  location_id TEXT,
  type TEXT NOT NULL,
  payload TEXT,
  status TEXT DEFAULT 'pending',
  result TEXT,
  source TEXT DEFAULT 'seeded',
  fetched_at TEXT,
  raw_payload_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

-- MI Sync Logs
CREATE TABLE IF NOT EXISTS mi_sync_logs_v2 (
  id TEXT PRIMARY KEY,
  agent_id TEXT,
  brand_id TEXT,
  location_id TEXT,
  action TEXT NOT NULL,
  payload TEXT,
  source TEXT DEFAULT 'seeded',
  fetched_at TEXT,
  raw_payload_path TEXT,
  ts TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Reports
CREATE TABLE IF NOT EXISTS reports_v2 (
  id TEXT PRIMARY KEY,
  agent_id TEXT,
  brand_id TEXT,
  location_id TEXT,
  type TEXT,
  payload TEXT,
  source TEXT DEFAULT 'seeded',
  fetched_at TEXT,
  raw_payload_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Connector Runs
CREATE TABLE IF NOT EXISTS connector_runs (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  connector_type TEXT NOT NULL,
  location_id TEXT,
  status TEXT DEFAULT 'running',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  records_processed INTEGER DEFAULT 0,
  error TEXT,
  result TEXT,
  source TEXT DEFAULT 'seeded',
  raw_payload_path TEXT
);

-- Orchestrator Jobs
CREATE TABLE IF NOT EXISTS orchestrator_jobs_v2 (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  brand_id TEXT,
  location_id TEXT,
  status TEXT DEFAULT 'running',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  records_processed INTEGER DEFAULT 0,
  error TEXT,
  result TEXT,
  source TEXT DEFAULT 'seeded',
  raw_payload_path TEXT
);

-- ============================================================================
-- SEED DATA: Brands
-- ============================================================================

INSERT OR REPLACE INTO brands (brand_id, name, domain, status, industry, cuisine) VALUES
  ('bakudan', 'Bakudan Ramen', 'https://bakudanramen.com', 'active', 'restaurant', 'japanese_ramen'),
  ('raw_sushi', 'Raw Sushi', 'https://rawsushibar.com', 'active', 'restaurant', 'japanese_sushi');

-- ============================================================================
-- SEED DATA: Locations
-- ============================================================================

INSERT OR REPLACE INTO brand_locations (location_id, brand_id, name, short_name, status, website_url, menu_url, order_url, categories) VALUES
  ('bandera', 'bakudan', 'Bakudan Ramen - Bandera', 'Bandera', 'active', 'https://bakudanramen.com/locations/bandera', 'https://bakudanramen.com/menu', 'https://order.bakudanramen.com/bandera', '["Japanese Restaurant","Ramen Restaurant"]'),
  ('stone-oak', 'bakudan', 'Bakudan Ramen - Stone Oak', 'Stone Oak', 'active', 'https://bakudanramen.com/locations/stone-oak', 'https://bakudanramen.com/menu', 'https://order.bakudanramen.com/stone-oak', '["Japanese Restaurant","Ramen Restaurant"]'),
  ('the-rim', 'bakudan', 'Bakudan Ramen - The Rim', 'The Rim', 'active', 'https://bakudanramen.com/locations/the-rim', 'https://bakudanramen.com/menu', 'https://order.bakudanramen.com/the-rim', '["Japanese Restaurant","Ramen Restaurant"]'),
  ('raw-sushi-hq', 'raw_sushi', 'Raw Sushi - Main', 'Main', 'needs_location_config', 'https://rawsushibar.com', NULL, NULL, '["Japanese Restaurant","Sushi Restaurant"]');

-- ============================================================================
-- SEED DATA: Connectors
-- ============================================================================

INSERT OR REPLACE INTO brand_connectors (id, brand_id, connector_type, status, credentials_configured) VALUES
  ('conn_bakudan_crawler', 'bakudan', 'crawler', 'ready', 1),
  ('conn_bakudan_citation', 'bakudan', 'citation_scan', 'ready', 1),
  ('conn_bakudan_gsc', 'bakudan', 'gsc', 'missing_credentials', 0),
  ('conn_bakudan_ga4', 'bakudan', 'ga4', 'missing_credentials', 0),
  ('conn_bakudan_gbp', 'bakudan', 'gbp', 'missing_credentials', 0),
  ('conn_raw_sushi_crawler', 'raw_sushi', 'crawler', 'ready', 1),
  ('conn_raw_sushi_citation', 'raw_sushi', 'citation_scan', 'ready', 1),
  ('conn_raw_sushi_gsc', 'raw_sushi', 'gsc', 'missing_credentials', 0),
  ('conn_raw_sushi_ga4', 'raw_sushi', 'ga4', 'missing_credentials', 0),
  ('conn_raw_sushi_gbp', 'raw_sushi', 'gbp', 'missing_credentials', 0);

-- ============================================================================
-- INDEXES (for fast brand-scoped queries)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_brand_locations_brand ON brand_locations(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_pages_brand ON brand_pages(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_keywords_brand ON brand_keywords(brand_id);
CREATE INDEX IF NOT EXISTS idx_pages_v2_brand ON pages_v2(brand_id);
CREATE INDEX IF NOT EXISTS idx_keywords_v2_brand ON keywords_v2(brand_id);
CREATE INDEX IF NOT EXISTS idx_technical_issues_v2_brand ON technical_issues_v2(brand_id);
CREATE INDEX IF NOT EXISTS idx_ranking_snapshots_v2_brand ON ranking_snapshots_v2(brand_id);
CREATE INDEX IF NOT EXISTS idx_citations_v2_brand ON citations_v2(brand_id);
CREATE INDEX IF NOT EXISTS idx_schema_items_v2_brand ON schema_items_v2(brand_id);
CREATE INDEX IF NOT EXISTS idx_content_briefs_v2_brand ON content_briefs_v2(brand_id);
CREATE INDEX IF NOT EXISTS idx_orchestrator_jobs_v2_brand ON orchestrator_jobs_v2(brand_id);
CREATE INDEX IF NOT EXISTS idx_connector_runs_brand ON connector_runs(brand_id);
CREATE INDEX IF NOT EXISTS idx_gbp_profiles_v2_brand ON gbp_profiles_v2(brand_id);
CREATE INDEX IF NOT EXISTS idx_apple_profiles_brand ON apple_profiles(brand_id);
CREATE INDEX IF NOT EXISTS idx_bing_profiles_brand ON bing_profiles(brand_id);
CREATE INDEX IF NOT EXISTS idx_reviews_v2_brand ON reviews_v2(brand_id);
CREATE INDEX IF NOT EXISTS idx_utm_links_v2_brand ON utm_links_v2(brand_id);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_brand ON analytics_metrics(brand_id);
CREATE INDEX IF NOT EXISTS idx_agent_status_v2_brand ON agent_status_v2(brand_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_v2_brand ON agent_tasks_v2(brand_id);
CREATE INDEX IF NOT EXISTS idx_mi_sync_logs_v2_brand ON mi_sync_logs_v2(brand_id);
CREATE INDEX IF NOT EXISTS idx_reports_v2_brand ON reports_v2(brand_id);

-- ============================================================================
-- DONE: Multi-brand support added
-- To add Brand N: insert row in brands + brand_locations, no source code change
-- ============================================================================
