# YoLink Warning Analysis

> Generated: 2026-06-04
> Status: Phase 2B Discovery Audit — In Progress

---

## Overview

This document tracks YoLink device warning states and analysis.
The YoLink API may return a `state` of `warning` for devices that need attention.
This report captures known device states and recommended actions.

---

## Device Registry

| Device EUI | Store | Item | Model | State | Signal | Battery | Last Reading |
|---|---|---|---|---|---|---|---|
| d88b4c01000f1398 | Stone Oak | Walk-in Cooler | YS8017-UC | pending | pending | pending | — |
| d88b4c01000f176f | Bandera | Walk-in Cooler | YS8017-UC | pending | pending | pending | — |
| d88b4c01000f069b | Rim | Walk-in Cooler | YS8017-UC | pending | pending | pending | — |

---

## Warning States

### What Triggers a Warning?

YoLink devices can report warning states for:

1. **Temperature out of range** — reading exceeds configured min/max
2. **Low battery** — battery level below threshold (typically <20%)
3. **Signal weak** — signal strength below acceptable level
4. **Offline** — device not communicating for extended period
5. **Sensor malfunction** — internal device error

### How Warnings Appear in Dashboard

The YoLink Device Setup panel shows device state as a badge:

```
🟢 Online  — Device communicating normally
🟡 Warning — Device in warning state, attention needed
🔴 Offline — Device not responding
⚫ Unknown — No data received yet
```

### Warning Details Panel

For each device in `warning` state, the dashboard shows:

```
Warning State: WARNING
Last Warning: [timestamp or "None"]
Current Reading: [value]°F
Configured Range: [min]–[max]°F
Battery: [level]%
Signal: [status]
Firmware: [version if available]
```

### API Warning Data

YoLink API returns warning data in device state response:

```json
{
  "device_id": "d88b4c01000f1398",
  "state": "warning",
  "last_warning": "temp_high",
  "battery_level": 85,
  "signal_status": "normal",
  "last_reported_temp": 42.5,
  "last_reported_time": "2026-06-04T..."
}
```

---

## Warning Reason Extraction

### If YoLink API provides warning_reason

The dashboard warning panel will display:

```
Warning reason: [from API]
```

### If YoLink API does NOT provide warning_reason

The dashboard will display:

```
Warning reason unavailable from API.
Please check YoLink app for device history.
```

---

## Threshold Configuration

Walk-in Cooler expected range: **33–41°F**

If reading > 41°F, device may show warning.

---

## Recommended Actions

| Warning Type | Action |
|---|---|
| `temp_high` | Check refrigeration unit, verify door seals |
| `temp_low` | Check compressor, verify thermostat setting |
| `battery_low` | Replace battery (CR2032 for YS8017-UC) |
| `signal_weak` | Relocate device or check hub connectivity |
| `offline` | Check device power, check WiFi/Zigbee connection |
| `unknown` | Force poll from dashboard, check YoLink app |

---

## Cross-Validation Behavior

When a human submits Daily Entry with a sensor mapped:

| Status | Behavior |
|---|---|
| `SENSOR_OK` | Shows sensor reading and diff from human value |
| `SENSOR_STALE` | Shows "Sensor reading stale (Xmin ago). Manual entry used." |
| `SENSOR_OFFLINE` | Shows "Sensor offline. Manual entry used." |
| `NO_SENSOR` | No cross-validation, pure human workflow |
| `NO_READING` | No cross-validation, pure human workflow |

---

## Manager Alert Integration

When YoLink device enters warning state, a manager alert should be triggered.

Configuration (via dashboard):
- Manager Alert Group chat ID
- Alert enabled/disabled toggle

Alert message format:
```
🚨 YoLink Alert — [Store Name]
Device: [device_name]
EUI: [device_eui]
Warning: [warning_reason]
Reading: [value]°F
Time: [timestamp]
```

---

## Update Frequency

- YoLink API polling: configurable via `YOLINK_POLL_INTERVAL_SECONDS`
- Dashboard refresh: every 10 seconds (auto-refresh meta tag)
- Reading age threshold: 30 minutes (configurable via `SENSOR_MATCH_WINDOW_MINUTES`)

---

## Manual Verification

To check device warnings manually:

1. Open: http://localhost:3210
2. Navigate to: YoLink Device Setup
3. Review "State" column for each device
4. Click "Test Reading" for any device in warning/offline state

Expected result with credentials configured:
- Live temperature reading
- Battery level
- Signal status
- Device state (online/offline/warning)

Expected result without credentials:
- Message: "YoLink API credentials are not configured."
- Message: "Device saved for manual mapping."
- Message: "Human workflow remains active."

---

## Phase 2C — YoLink Integration (Future)

After YoLink Discovery Audit (Phase 2B) completes:

- [ ] Verify Hub connectivity
- [ ] Verify API credentials
- [ ] Verify MQTT connection
- [ ] Verify Cloud sync
- [ ] Confirm warning_reason field availability
- [ ] Implement automatic manager alerts for warning states
- [ ] Implement dashboard real-time push for warning updates