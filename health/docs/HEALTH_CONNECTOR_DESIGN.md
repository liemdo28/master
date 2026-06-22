# HEALTH CONNECTOR DESIGN
**MI Health V1 — Phase 1**  
**Date:** 2026-06-13  
**Status:** IMPLEMENTED

---

## Architecture Decision

### Constraint
- No App Store deployment
- No custom iOS application
- No jailbreak
- No Huawei API reverse engineering

### Chosen Architecture

```
Huawei Watch
    ↓ (Bluetooth auto-sync)
Huawei Health App (iOS)
    ↓ (HealthKit write permission)
Apple Health (HealthKit)
    ↓ (iOS Shortcut)
mi-health-export.json
    ↓ (iCloud Drive sync)
iCloud Drive / HealthExports/
    ↓ (iCloud for Windows)
C:\Users\liemdo\iCloudDrive\HealthExports\
    ↓ (HealthConnector.mjs watcher)
health.db (SQLite local)
    ↓
Knowledge Universe + Jarvis
```

**Why this works without a custom app:**  
iOS Shortcuts has full read access to HealthKit since iOS 14. A Shortcut can query any health metric, format it as JSON, and save to iCloud Drive — all without code signing or App Store review. This is the official, Apple-supported approach for personal health automation.

---

## iOS Shortcut Specification

### Shortcut Name: "Mi Health Export"

**Trigger:** Manual + Automation (06:00 daily, 22:00 daily)

**Actions sequence:**
```
1. Get Health Samples: Steps (last 24h, daily totals)
2. Get Health Samples: Resting Heart Rate (last 7 days)
3. Get Health Samples: Heart Rate (last 24h, all samples)
4. Get Health Samples: Heart Rate Variability (last 7 days)
5. Get Health Samples: Oxygen Saturation (last 24h)
6. Get Health Samples: Sleep Analysis (last 7 days)
7. Get Health Samples: Active Energy Burned (last 24h)
8. Get Health Samples: Workouts (last 7 days)
9. Format as JSON (see HEALTH_EXPORT_FORMAT.md)
10. Save File → iCloud Drive/HealthExports/mi-health-export.json
```

**Permissions needed on iPhone:**
- Settings → Shortcuts → Allow Untrusted Shortcuts: ON
- Health app → Sharing → Shortcuts: all metrics ON

---

## HealthConnector Interface

File: `mi-core/health/HealthConnector.mjs`

```javascript
class HealthConnector {
  isConfigured()           // → bool: iCloud path exists
  getSnapshot()            // → connector status + today summary
  sync(options)            // → { ok, synced: { days, sleep, hr, workouts } }
  getToday()               // → { daily, sleep, workouts }
  getWeek(offset)          // → weekly summary
  getMonth(yearMonth)      // → monthly summary
  getRecentDays(n)         // → array of daily_health rows
  answerQuery(text)        // → structured query result
}
```

---

## iCloud for Windows Setup

1. Install iCloud for Windows from Microsoft Store
2. Sign in with same Apple ID as iPhone
3. Enable iCloud Drive sync
4. Health export folder auto-appears at:  
   `C:\Users\liemdo\iCloudDrive\HealthExports\`
5. Files sync within ~30 seconds of Shortcut saving

---

## Data Flow Timing

| Event | Delay |
|-------|-------|
| Watch → iPhone sync | Real-time (Bluetooth) |
| iPhone HealthKit update | ~1 min |
| Shortcut run (manual) | Immediate |
| Shortcut run (automation) | 06:00 / 22:00 |
| iCloud Drive sync | ~30 sec |
| Mi-Core import | On-demand or cron |
| Jarvis query available | After import completes |

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| iCloud path not found | `isConfigured()` returns false, Jarvis explains setup needed |
| Export file missing | Sync returns descriptive error with setup instructions |
| File unchanged since last sync | Skips sync, returns "No new data" |
| Partial/corrupt JSON | Parser catches and skips malformed records |
| XML export fallback | Full streaming parse of export.xml |

---

## Privacy

- Zero cloud processing — all parsing happens locally
- health.db is gitignored
- No third-party analytics
- Export files never leave the local machine after iCloud sync
