# HEALTH EXPORT FORMAT
**MI Health V1 — Phase 1 Deliverable**  
**Date:** 2026-06-13

---

## Primary Format: `mi-health-export.json`

Produced by the iOS Shortcut "Mi Health Export".  
Saved to: `iCloud Drive/HealthExports/mi-health-export.json`

```json
{
  "exportDate": "2026-06-13T06:00:00+07:00",
  "exportVersion": "1.0",
  "steps": [
    { "date": "2026-06-13", "value": 8432 },
    { "date": "2026-06-12", "value": 11205 }
  ],
  "heartRate": [
    { "timestamp": "2026-06-13T07:32:00+07:00", "value": 72, "context": "normal" },
    { "timestamp": "2026-06-13T07:45:00+07:00", "value": 145, "context": "workout" }
  ],
  "restingHeartRate": [
    { "date": "2026-06-13", "value": 58 },
    { "date": "2026-06-12", "value": 60 }
  ],
  "hrv": [
    { "date": "2026-06-13", "value": 42.3 },
    { "date": "2026-06-12", "value": 38.7 }
  ],
  "spo2": [
    { "timestamp": "2026-06-13T02:15:00+07:00", "value": 97.2 },
    { "timestamp": "2026-06-13T04:30:00+07:00", "value": 98.1 }
  ],
  "sleep": [
    {
      "date": "2026-06-13",
      "bedtime": "2026-06-12T23:10:00+07:00",
      "wakeTime": "2026-06-13T06:22:00+07:00",
      "totalMins": 432,
      "deepMins": 105,
      "lightMins": 198,
      "remMins": 94,
      "awakeMins": 35
    }
  ],
  "workouts": [
    {
      "startedAt": "2026-06-13T07:00:00+07:00",
      "type": "Running",
      "durationMins": 32,
      "distanceKm": 4.8,
      "activeCals": 342,
      "avgHR": 148,
      "maxHR": 172,
      "elevationM": 45
    }
  ],
  "calories": [
    { "date": "2026-06-13", "activeCals": 486, "totalCals": 2340 },
    { "date": "2026-06-12", "activeCals": 620, "totalCals": 2480 }
  ]
}
```

---

## Field Specifications

### steps
| Field | Type | Description |
|-------|------|-------------|
| date  | YYYY-MM-DD | Calendar date |
| value | integer | Total step count for the day |

### heartRate
| Field | Type | Description |
|-------|------|-------------|
| timestamp | ISO 8601 | Exact measurement time |
| value | number | BPM |
| context | string | "normal" \| "workout" \| "resting" \| "sleep" |

### restingHeartRate
| Field | Type | Description |
|-------|------|-------------|
| date | YYYY-MM-DD | Date of measurement |
| value | number | BPM — lowest daily resting HR |

### hrv
| Field | Type | Description |
|-------|------|-------------|
| date | YYYY-MM-DD | Date |
| value | number | SDNN in milliseconds |

**Note:** Huawei Watch exports HRV via Huawei Health → Apple Health. If HRV is missing, it means the watch did not capture enough overnight data.

### spo2
| Field | Type | Description |
|-------|------|-------------|
| timestamp | ISO 8601 | Measurement time (usually during sleep) |
| value | number | SpO2 percentage (0-100) |

### sleep
| Field | Type | Description |
|-------|------|-------------|
| date | YYYY-MM-DD | The morning date (date you woke up) |
| bedtime | ISO 8601 | When you went to sleep |
| wakeTime | ISO 8601 | When you woke up |
| totalMins | integer | Total sleep duration in minutes |
| deepMins | integer | Deep sleep minutes |
| lightMins | integer | Light sleep minutes |
| remMins | integer | REM sleep minutes |
| awakeMins | integer | Awake in bed minutes |

**Sleep Quality Score formula:**
- Duration (40 pts): scale from 0 to 7.5h
- Deep sleep (25 pts): target 20% of total
- REM (20 pts): target 22% of total
- Low awake time (15 pts): target <5% of total

### workouts
| Field | Type | Description |
|-------|------|-------------|
| startedAt | ISO 8601 | Start time |
| type | string | "Running" \| "Walking" \| "Cycling" \| "Swimming" \| "Strength" \| "HIIT" \| "Yoga" \| "Other" |
| durationMins | integer | Duration in minutes |
| distanceKm | number | Distance (0 if N/A) |
| activeCals | number | Active calories burned |
| avgHR | number \| null | Average heart rate |
| maxHR | number \| null | Peak heart rate |
| elevationM | number \| null | Elevation gain in meters |

### calories
| Field | Type | Description |
|-------|------|-------------|
| date | YYYY-MM-DD | Calendar date |
| activeCals | number | Active energy burned (exercise) |
| totalCals | number | Total energy (basal + active) |

---

## Fallback Format: Apple Health XML Export

If the iOS Shortcut cannot be set up, the full Apple Health XML export is supported.

**How to export:**
1. Open Health app on iPhone
2. Tap profile picture → Export All Health Data
3. Share to iCloud Drive → HealthExports folder
4. Rename to `export.xml`

**Parser:** `HealthParser.mjs` → `parseXMLExport()`  
**Note:** XML export does not include sleep stages from Huawei Watch (HealthKit limitation for third-party devices). Use JSON export for full stage data.

---

## Incremental Sync

The parser uses `lastSyncAt` to skip records older than the last sync:

```javascript
// Only parse records newer than this timestamp
const parsed = parseJSONExport(filePath, '2026-06-12T22:00:00Z');
```

`lastSyncAt` is stored in `sync_state` table and updated after each successful sync.
