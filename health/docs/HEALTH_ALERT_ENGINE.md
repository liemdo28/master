# HEALTH ALERT ENGINE
**MI Health V1 — Phase 5 Deliverable**  
**Date:** 2026-06-13  
**File:** `mi-core/health/HealthAlertEngine.mjs`

---

## Alert Thresholds

| Alert Type | Metric | Trigger | Severity |
|-----------|--------|---------|---------|
| `sleep_drop` | Sleep duration | >20% below 7-day baseline | warning (>35% → critical) |
| `hrv_drop` | HRV ms | >20% below 7-day baseline | warning (>30% → critical) |
| `rhr_spike` | Resting HR | >15% above 7-day baseline | warning (>25% → critical) |
| `activity_drop` | Daily steps | >30% below 7-day baseline | info |
| `consecutive_short_sleep` | Sleep duration | ≥3 nights < 5h | warning |
| `spo2_low` | SpO2 minimum | < 95% | critical |

---

## Baseline Calculation

All alerts compare **recent 7 days** vs **prior 7 days** (days 8-14):

```
recent_avg  = average of days 1-7 (newest)
baseline    = average of days 8-14 (older)
change      = (baseline - recent) / baseline
```

Minimum 3 days of baseline data required before any alert fires.

---

## Alert Severity Definitions

| Severity | Meaning | CEO Action Required |
|----------|---------|-------------------|
| `critical` | Significant deviation requiring attention | Yes — address today |
| `warning` | Emerging trend worth monitoring | Monitor closely |
| `info` | Informational — no immediate concern | Optional awareness |

---

## Alert Message Style

All messages in Vietnamese. Rules:
- **Never** make medical diagnoses
- **Never** say "Anh bị bệnh" or similar
- Use "dấu hiệu" (signs) not "triệu chứng" (symptoms)
- Always include a specific, actionable recommendation
- Empathetic but professional tone

### Examples

**sleep_drop (warning):**
> "Em thấy giấc ngủ của Anh giảm 24% trong 7 ngày qua so với tuần trước (6h20m vs 8h10m). Em đề xuất Anh ưu tiên nghỉ sớm tối nay."

**hrv_drop (warning):**
> "Em thấy có dấu hiệu giảm hồi phục trong 5 ngày liên tiếp (HRV giảm 21%). Em đề xuất giảm cường độ làm việc và vận động hôm nay."

**consecutive_short_sleep (warning):**
> "Em thấy có dấu hiệu thiếu ngủ trong 4 đêm liên tiếp. Em đề xuất Anh giảm cường độ làm việc tối nay và ngủ trước 11 giờ."

**spo2_low (critical):**
> "Em thấy SpO2 thấp nhất hôm nay là 93% — thấp hơn ngưỡng bình thường. Em đề xuất Anh thư giãn, hít thở sâu, và kiểm tra lại."

**rhr_spike (warning):**
> "Em thấy nhịp tim nghỉ ngơi của Anh tăng 17% so với baseline (71 vs 61 bpm). Đây thường là dấu hiệu cơ thể cần nghỉ ngơi thêm."

---

## Alert Deduplication

Alerts are stored in `health_alerts` table.  
Same `(date, alert_type)` combination can appear multiple times (one per sync run) — use `acknowledged = 0` filter to show only unread.

---

## Alert Check Frequency

- Runs automatically on every `sync` command
- Runs on every health query from Jarvis
- CLI: `node sync-health.mjs alerts`

---

## No Medical Claims Policy

The alert engine explicitly:
- Does NOT diagnose illness, disease, or medical conditions
- Does NOT recommend medications or medical procedures
- Does NOT replace professional medical advice
- All alerts end with behavioral recommendations (sleep earlier, walk more, rest)
- For SpO2 critical: recommends checking with a doctor if it persists (future enhancement)
