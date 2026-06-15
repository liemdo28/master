# MI HEALTH INTEGRATION V1
### CEO Directive — Executive Health Intelligence
**Date:** 2026-06-13  
**Branch:** feature/mi-core-big-data-foundation  
**Status:** DESIGN COMPLETE — Ready for Implementation

---

## Executive Summary

Mi sẽ có khả năng hiểu và trả lời về sức khỏe của CEO theo thời gian thực.  
Data pipeline: **Huawei Watch → Huawei Health → Apple Health → Mi-Core Knowledge Layer → Jarvis Query Engine**

---

## Phase 1 — Apple Health Research

### 1.1 Integration Model

Apple Health không có public REST API. Data chỉ accessible qua hai con đường:

| Method | Mô tả | Use Case |
|--------|-------|----------|
| **HealthKit (Swift/native)** | iOS app đọc trực tiếp từ HealthKit store | Production iOS app |
| **Health Export (XML/CSV)** | Export từ Settings → Health → Export All Health Data | Current use case — manual/automated |
| **Shortcuts automation** | iOS Shortcut tự động export → iCloud Drive | Lightweight automation |

**Chosen approach cho V1:** iOS Shortcut export → iCloud Drive → Mi-Core watcher daemon.  
Không cần App Store, không cần developer certificate, deploy trong 1 ngày.

### 1.2 Supported Metrics (từ Huawei Watch qua Apple Health)

| Metric | HealthKit Type | Unit | Typical Frequency |
|--------|---------------|------|-------------------|
| Steps | `HKQuantityTypeStepCount` | count | Every 10 min |
| Heart Rate | `HKQuantityTypeHeartRate` | bpm | Every 5 min |
| Resting Heart Rate | `HKQuantityTypeRestingHeartRate` | bpm | Daily |
| Sleep Analysis | `HKCategoryTypeSleepAnalysis` | stages | Per sleep session |
| Active Calories | `HKQuantityTypeActiveEnergyBurned` | kcal | Every 10 min |
| Total Calories | `HKQuantityTypeBasalEnergyBurned` | kcal | Daily |
| Workout | `HKWorkoutType` | duration/distance | Per session |
| SpO2 | `HKQuantityTypeOxygenSaturation` | % | Periodic |
| HRV | `HKQuantityTypeHeartRateVariabilitySDNN` | ms | Daily |
| Respiratory Rate | `HKQuantityTypeRespiratoryRate` | /min | Sleep only |

### 1.3 Authentication Model

- **No OAuth required** cho export approach
- iCloud Drive path: `~/Library/Mobile Documents/com~apple~CloudDocs/HealthExports/`
- iOS Shortcut trigger: manual OR automated via Shortcut automation (morning/evening)
- Mi-Core reads từ iCloud Drive folder (synced to local disk via iCloud for Windows)

### 1.4 Update Frequency

| Tier | Frequency | Trigger |
|------|-----------|---------|
| Real-time | N/A (no HealthKit direct) | — |
| Morning sync | 06:00 daily | iOS Shortcut automation |
| Evening sync | 22:00 daily | iOS Shortcut automation |
| On-demand | Manual shortcut run | CEO request |

---

## Phase 2 — Health Connector

### 2.1 Architecture

```
HealthConnector.mjs
├── isConfigured()          — check iCloud sync path exists
├── getSnapshot()           — return latest daily summary
├── syncFromExport()        — parse XML export → SQLite
├── getDailyMetrics(date)   — steps, cals, HR for a day
├── getSleepSession(date)   — sleep stages, duration, quality score
├── getWorkouts(range)      — workout list with type/duration
└── getWeeklySummary(week)  — aggregated weekly view
```

### 2.2 File: `mi-core/health/HealthConnector.mjs`

```javascript
/**
 * HealthConnector — Apple Health data bridge for Mi-Core
 * Reads from iCloud-synced export files, stores in health.db
 */
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const ICLOUD_HEALTH_PATH = process.env.HEALTH_EXPORT_PATH || 
  `${process.env.USERPROFILE}/iCloudDrive/HealthExports`;
const DB_PATH = 'E:/Project/Master/mi-core/data/health.db';

export class HealthConnector {
  constructor() {
    this.db = null;
    this.connectorId = 'apple-health';
    this.name = 'Apple Health (Huawei Watch)';
  }

  isConfigured() {
    return fs.existsSync(ICLOUD_HEALTH_PATH);
  }

  async getSnapshot() {
    const today = new Date().toISOString().split('T')[0];
    const metrics = await this.getDailyMetrics(today);
    return {
      connector_id: this.connectorId,
      status: this.isConfigured() ? 'active' : 'unconfigured',
      last_sync: new Date().toISOString(),
      summary: metrics,
    };
  }
}
```

### 2.3 Database Schema: `health.db`

```sql
-- Daily aggregate (1 row per day)
CREATE TABLE daily_health (
  date          TEXT PRIMARY KEY,  -- YYYY-MM-DD
  steps         INTEGER,
  active_cals   REAL,
  total_cals    REAL,
  resting_hr    REAL,
  avg_hr        REAL,
  min_hr        REAL,
  max_hr        REAL,
  spo2_avg      REAL,
  hrv_ms        REAL,
  updated_at    TEXT
);

-- Sleep sessions
CREATE TABLE sleep_sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT,             -- night of (YYYY-MM-DD)
  bedtime       TEXT,             -- ISO datetime
  wake_time     TEXT,
  total_mins    INTEGER,
  deep_mins     INTEGER,
  light_mins    INTEGER,
  rem_mins      INTEGER,
  awake_mins    INTEGER,
  quality_score REAL              -- 0-100 computed
);

-- Workouts
CREATE TABLE workouts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT,
  type          TEXT,             -- Running, Walking, Strength, etc.
  duration_mins INTEGER,
  distance_km   REAL,
  active_cals   REAL,
  avg_hr        REAL,
  started_at    TEXT
);

-- HR time series (for trend analysis)
CREATE TABLE heart_rate_samples (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_at TEXT,
  value     REAL,
  context   TEXT                  -- resting, workout, normal
);
```

### 2.4 ConnectorRegistry Entry

Add to `ConnectorRegistry.mjs` DEFAULT_CONNECTORS:

```javascript
{
  connector_id: 'apple-health',
  name: 'Apple Health (Huawei Watch)',
  type: 'health',
  status: 'active',
  auth_status: 'connected',
  read_capability: ['steps', 'sleep', 'heart-rate', 'workouts', 'calories', 'spo2', 'hrv'],
  write_capability: [],
  approval_required: false,
  cache_path: 'health/',
  health_status: 'healthy',
  config: {
    export_path: '%USERPROFILE%/iCloudDrive/HealthExports',
    db_path: 'mi-core/data/health.db',
    sync_schedule: ['06:00', '22:00']
  }
}
```

---

## Phase 3 — Knowledge Integration

### 3.1 Entity Types

| Entity | Knowledge Kind | Update Frequency | Retention |
|--------|---------------|------------------|-----------|
| `daily_health` | `health-daily` | Daily | 90 days hot / 2 years archive |
| `weekly_health` | `health-weekly` | Weekly (Monday) | 1 year |
| `sleep_trend` | `health-trend` | Weekly | 6 months |
| `activity_trend` | `health-trend` | Weekly | 6 months |
| `recovery_trend` | `health-trend` | Weekly | 6 months |

### 3.2 Knowledge Ingestion Format

Mỗi entity được ingest vào `knowledge.db` theo format chuẩn `UnifiedKnowledgeDatabase`:

```javascript
// Ví dụ: daily_health entity
{
  kind: 'health-daily',
  subtype: 'steps-sleep-hr',
  title: 'CEO Health — 2026-06-13',
  content: `
    Steps: 8,432 (Goal: 10,000 — 84%)
    Sleep: 7h 12m | Deep: 1h 45m | REM: 1h 20m
    Resting HR: 58 bpm | HRV: 42ms
    Active calories: 486 kcal
    Recovery score: 78/100 (Good)
  `,
  path: 'health/daily/2026-06-13',
  tags: ['health', 'daily', 'ceo', 'steps', 'sleep', 'heart-rate'],
  metadata: {
    date: '2026-06-13',
    steps: 8432,
    sleep_mins: 432,
    resting_hr: 58,
    recovery_score: 78,
  }
}
```

### 3.3 Trend Computation

```
Sleep Trend: 7-day rolling average (bedtime, duration, deep%, REM%)
Activity Trend: 7-day rolling avg steps + active cals
Recovery Trend: 7-day HRV trend + resting HR trend
Alert threshold: resting HR > 75 OR sleep < 5h OR HRV drop > 20% from baseline
```

### 3.4 File Structure

```
mi-core/health/
├── HealthConnector.mjs       — data connector
├── HealthParser.mjs          — XML/CSV export parser
├── HealthKnowledgeBuilder.mjs — entity builder → knowledge.db
├── HealthAlertEngine.mjs     — anomaly detection
└── sync-health.mjs           — CLI sync runner
```

---

## Phase 4 — Jarvis Query Engine

### 4.1 Query Routing

`FederationSearch.mjs` cần thêm health search domain:

```javascript
// Thêm vào FederationSearch.searchAll()
const healthResults = await this._searchHealthDomain(query, context);

async _searchHealthDomain(query, context) {
  const keywords = ['bước', 'steps', 'ngủ', 'sleep', 'tim', 'heart', 
                    'sức khỏe', 'health', 'calories', 'workout', 'tập'];
  const isHealthQuery = keywords.some(k => query.toLowerCase().includes(k));
  if (!isHealthQuery) return [];
  
  return this.healthConnector.answerQuery(query, context);
}
```

### 4.2 Response Examples

**Query:** "Mi ơi hôm nay anh đi bao nhiêu bước?"

```
Response:
Dạ thưa Anh, hôm nay (13/06) Anh đã đi được 8,432 bước — đạt 84% mục tiêu 10,000 bước/ngày.
Còn cách mục tiêu khoảng 1,568 bước (~15 phút đi bộ).
Nếu Anh có kế hoạch đi lại buổi tối, đây là thời điểm tốt để hoàn thành chỉ tiêu.
```

**Query:** "Mi ơi tuần này sức khỏe sao rồi?"

```
Response:
Dạ thưa Anh, tổng quan sức khỏe tuần này (09-13/06):

• Vận động: Trung bình 7,821 bước/ngày — dưới mục tiêu 10,000. Hôm Thứ Tư đạt cao nhất 11,200 bước.
• Giấc ngủ: Trung bình 6h 48m/đêm. Chất lượng tốt — deep sleep đạt 22%.
• Tim mạch: Resting HR ổn định 57-61 bpm. HRV trung bình 44ms — mức tốt.
• Calories: Đốt trung bình 2,340 kcal/ngày.

Nhìn chung tuần này sức khỏe ổn định. Điểm cần cải thiện: tăng vận động ngày thường để đạt mục tiêu bước chân.
```

**Query:** "Mi ơi có gì đáng lo không?"

```
Response:
Dạ thưa Anh, Mi kiểm tra và không phát hiện dấu hiệu đáng lo ngại:

✓ Nhịp tim nghỉ ngơi: 58 bpm — trong ngưỡng tốt (<65 bpm)
✓ HRV: 42ms — ổn định, không giảm bất thường
✓ Giấc ngủ: Đủ thời gian, không có đêm nào dưới 5 tiếng
⚠ Bước chân: 3 ngày liên tiếp dưới 6,000 bước — có thể cân nhắc tăng vận động

Không có cảnh báo sức khỏe quan trọng tại thời điểm này.
```

### 4.3 Response Tone Rules (Executive Assistant Style)

```
1. Luôn mở đầu bằng "Dạ thưa Anh"
2. Đưa số liệu cụ thể, không nói chung chung
3. So sánh với baseline / mục tiêu / tuần trước
4. Đề xuất hành động ngắn gọn nếu cần
5. Không lo lắng thái quá — chỉ alert khi thực sự bất thường
6. Kết thúc bằng tóm tắt tích cực nếu tình trạng tốt
```

---

## Implementation Plan

### Sprint 1 — Foundation (2-3 ngày)
- [ ] Setup iCloud Drive sync path + test export
- [ ] Build `HealthParser.mjs` — parse Apple Health XML
- [ ] Create `health.db` schema + migration
- [ ] Build `HealthConnector.mjs` — getSnapshot, getDailyMetrics

### Sprint 2 — Knowledge Layer (2 ngày)
- [ ] Build `HealthKnowledgeBuilder.mjs` — daily/weekly entity ingestion
- [ ] Integrate vào `FederationSearch.mjs` — health domain routing
- [ ] Register connector trong `ConnectorRegistry.mjs`

### Sprint 3 — Jarvis Queries (1-2 ngày)
- [ ] Build health query handler với tone rules
- [ ] Build `HealthAlertEngine.mjs` — anomaly detection
- [ ] Test end-to-end: Huawei Watch → Apple Health → Mi query

### Sprint 4 — Automation (1 ngày)
- [ ] iOS Shortcut: auto export buổi sáng/tối
- [ ] Windows scheduled task: sync từ iCloud → health.db
- [ ] Daily health snapshot vào `daily-snapshot.json`

---

## Technical Notes

### iCloud for Windows Path
```
C:\Users\{username}\iCloudDrive\HealthExports\
```
Huawei Health app tự động sync vào Apple Health.  
Apple Health export tạo file `export.xml` (~50MB cho 1 năm data).

### Parser Performance
- Full XML parse: ~3-5 giây cho 1 năm data
- Incremental parse (chỉ records mới): <1 giây
- Recommend: incremental parse dựa trên `startDate` > last_sync timestamp

### Privacy
- Health data ở local only — không upload lên server
- `health.db` được đánh dấu trong `.gitignore`
- CEO data không đi qua bất kỳ third-party API nào

---

## Deliverable Files

| File | Path | Status |
|------|------|--------|
| Integration Report | `mi-core/reports/MI_HEALTH_INTEGRATION_REPORT.md` | ✅ Done |
| Health Connector | `mi-core/health/HealthConnector.mjs` | Pending Sprint 1 |
| Health Parser | `mi-core/health/HealthParser.mjs` | Pending Sprint 1 |
| Knowledge Builder | `mi-core/health/HealthKnowledgeBuilder.mjs` | Pending Sprint 2 |
| Alert Engine | `mi-core/health/HealthAlertEngine.mjs` | Pending Sprint 3 |
| Sync Runner | `mi-core/health/sync-health.mjs` | Pending Sprint 3 |
| DB Schema | `mi-core/data/health.db` | Pending Sprint 1 |

---

*Report generated by Mi-Core AI · CEO Directive Health Integration V1 · 2026-06-13*
