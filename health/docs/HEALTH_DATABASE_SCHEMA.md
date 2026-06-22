# HEALTH DATABASE SCHEMA
**MI Health V1 — Phase 2 Deliverable**  
**Date:** 2026-06-13  
**File:** `mi-core/data/health.db` (SQLite)

---

## Tables Overview

| Table | Purpose | Retention | Rows (est. 1yr) |
|-------|---------|-----------|-----------------|
| `daily_health` | One row per calendar day | 365+ days | ~365 |
| `sleep_sessions` | One row per sleep session | 365+ days | ~370 |
| `heart_rate_samples` | Raw HR time series | 90 days hot | ~52,000 |
| `workouts` | Per-workout records | 365+ days | ~200 |
| `health_alerts` | Detected anomalies | 90 days | ~50 |
| `sync_state` | Sync metadata | Permanent | ~10 |

---

## Table: `daily_health`

```sql
CREATE TABLE daily_health (
  date             TEXT PRIMARY KEY,   -- YYYY-MM-DD
  steps            INTEGER DEFAULT 0,
  active_cals      REAL    DEFAULT 0,
  total_cals       REAL    DEFAULT 0,
  resting_hr       REAL,               -- bpm
  avg_hr           REAL,               -- bpm
  min_hr           REAL,               -- bpm
  max_hr           REAL,               -- bpm
  spo2_avg         REAL,               -- %
  spo2_min         REAL,               -- % (important for sleep apnea detection)
  hrv_ms           REAL,               -- SDNN ms
  respiratory_rate REAL,               -- breaths/min
  stand_hours      INTEGER DEFAULT 0,
  active_minutes   INTEGER DEFAULT 0,
  recovery_score   REAL,               -- 0-100 computed from sleep quality
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Upsert strategy:** All fields use `COALESCE(excluded.value, existing.value)` — later syncs can fill in nulls but never overwrite valid data.

---

## Table: `sleep_sessions`

```sql
CREATE TABLE sleep_sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT NOT NULL,       -- YYYY-MM-DD (morning date)
  source        TEXT DEFAULT 'apple-health',
  bedtime       TEXT,                -- ISO datetime
  wake_time     TEXT,
  total_mins    INTEGER DEFAULT 0,
  deep_mins     INTEGER DEFAULT 0,
  light_mins    INTEGER DEFAULT 0,
  rem_mins      INTEGER DEFAULT 0,
  awake_mins    INTEGER DEFAULT 0,
  quality_score REAL,                -- 0-100
  UNIQUE(date, bedtime)
);
```

**Quality Score formula (0-100):**
- Duration:   40 pts (max at 7.5h = 450 min)
- Deep sleep: 25 pts (target 20% of total)
- REM sleep:  20 pts (target 22% of total)
- Low awake:  15 pts (target <5% of total)

---

## Table: `heart_rate_samples`

```sql
CREATE TABLE heart_rate_samples (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_at TEXT NOT NULL UNIQUE,  -- ISO datetime
  value       REAL NOT NULL,         -- bpm
  context     TEXT DEFAULT 'normal'  -- resting|workout|normal|sleep
);

CREATE INDEX idx_hr_time ON heart_rate_samples(recorded_at);
```

**Retention policy:** Alert engine uses 14-day window. HR samples older than 90 days can be pruned (future: auto-archive to monthly aggregate).

---

## Table: `workouts`

```sql
CREATE TABLE workouts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at    TEXT NOT NULL UNIQUE,
  date          TEXT NOT NULL,
  type          TEXT NOT NULL,         -- Running|Walking|Cycling|Strength|HIIT|Yoga|Other
  duration_mins INTEGER DEFAULT 0,
  distance_km   REAL DEFAULT 0,
  active_cals   REAL DEFAULT 0,
  avg_hr        REAL,
  max_hr        REAL,
  elevation_m   REAL
);
```

---

## Table: `health_alerts`

```sql
CREATE TABLE health_alerts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  date         TEXT NOT NULL,
  alert_type   TEXT NOT NULL,   -- sleep_drop|hrv_drop|rhr_spike|activity_drop|consecutive_short_sleep|spo2_low
  severity     TEXT NOT NULL,   -- info|warning|critical
  metric       TEXT NOT NULL,
  value        REAL NOT NULL,
  baseline     REAL,
  change_pct   REAL,
  message_vi   TEXT NOT NULL,   -- human-readable Vietnamese message
  acknowledged INTEGER DEFAULT 0
);
```

**Alert types:**

| Type | Trigger | Severity |
|------|---------|---------|
| `sleep_drop` | Sleep avg drops >20% vs 7-day baseline | warning/critical |
| `hrv_drop` | HRV drops >20% vs 7-day baseline | warning/critical |
| `rhr_spike` | Resting HR rises >15% vs baseline | warning/critical |
| `activity_drop` | Steps drop >30% vs baseline | info |
| `consecutive_short_sleep` | ≥3 nights below 5h | warning |
| `spo2_low` | SpO2 min < 95% | critical |

---

## Table: `sync_state`

```sql
CREATE TABLE sync_state (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Keys used:**
- `last_sync` — ISO timestamp of last successful sync
- `last_alert_check` — ISO timestamp of last alert run
- `export_path` — resolved export path (cached)

---

## Indexes

```sql
CREATE INDEX idx_sleep_date ON sleep_sessions(date);
CREATE INDEX idx_hr_time    ON heart_rate_samples(recorded_at);
CREATE INDEX idx_wo_date    ON workouts(date);
CREATE INDEX idx_al_date    ON health_alerts(date, alert_type);
```

---

## Deduplication Strategy

| Table | Key | Strategy |
|-------|-----|---------|
| `daily_health` | `date` | `INSERT ... ON CONFLICT DO UPDATE SET` with COALESCE |
| `sleep_sessions` | `(date, bedtime)` | `INSERT OR IGNORE` |
| `heart_rate_samples` | `recorded_at` | `INSERT OR IGNORE` |
| `workouts` | `started_at` | `INSERT OR IGNORE` |
| `health_alerts` | auto-increment | No dedup (multiple alerts per day ok) |

---

## Retention Policy

| Table | Hot | Archive | Delete |
|-------|-----|---------|--------|
| `daily_health` | All | — | Never |
| `sleep_sessions` | All | — | Never |
| `heart_rate_samples` | 90 days | Monthly aggregate | >1 year |
| `workouts` | All | — | Never |
| `health_alerts` | 90 days | — | >1 year |

Minimum retention: **365 days** for all aggregate data per CEO directive.
