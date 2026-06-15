# HEALTH_INTELLIGENCE_ENGINE — Phase 23
**Target:** HEALTH_INTEL_READY ✅

## What It Does
Reads CEO biometric data (Apple Health / Huawei Health export) and includes
health context in the daily briefing. Mi notices when the CEO is tired.

## Data Sources
Export files in `.local-agent-global/health-export/`:
- `sleep.json` — nightly sleep duration (hours)
- `hrv.json` — heart rate variability readings
- `steps.json` — daily step count

## Snapshot Fields
```typescript
{
  as_of: string,
  data_source: 'apple_health' | 'huawei_health' | 'no_data',
  data_available: boolean,
  avg_sleep_7d: number,           // hours
  sleep_quality_trend: 'improving' | 'declining' | 'stable',
  hrv_trend: 'improving' | 'declining' | 'stable' | 'unknown',
  stress_signal: 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN',
  recommendations_vi: string[]    // Vietnamese health tips
}
```

## Graceful Degradation
If no health export data exists:
- `data_available: false`
- Returns setup instructions for Apple Health / Huawei Health export
- Does not crash briefing engine

## Setup (Apple Health)
1. Open Health app → Profile → Export All Health Data
2. Unzip → extract sleep, hrv, steps data
3. Place in `.local-agent-global/health-export/`
4. Mi will auto-detect on next briefing cycle

## API Routes
```
GET /api/health-intel/snapshot   — current health snapshot
GET /api/health-intel/briefing   — formatted Vietnamese health summary
```
