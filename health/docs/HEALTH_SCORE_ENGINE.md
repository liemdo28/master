# HEALTH SCORE ENGINE
**MI Health V1 — Phase 4 Deliverable**  
**Date:** 2026-06-13  
**File:** `mi-core/health/HealthScoreEngine.mjs`

---

## Score Overview

**Scale:** 0–100  
**Window:** 7-day rolling average  
**Update:** After each sync

---

## Components

| Component | Weight | Description |
|-----------|--------|-------------|
| Sleep | 30% | Duration, deep%, REM%, continuity |
| Recovery | 25% | HRV trend, resting HR trend |
| Activity | 25% | Steps, active calories, workout frequency |
| Heart Health | 15% | Absolute resting HR, SpO2, HR range |
| Consistency | 5% | Data completeness (days with data / 7) |

---

## Grading Scale

| Score | Grade | Meaning |
|-------|-------|---------|
| 90-100 | A | Excellent — peak performance window |
| 85-89 | A- | Very good |
| 80-84 | B+ | Good |
| 75-79 | B | Above average |
| 70-74 | B- | Average |
| 65-69 | C+ | Below average, some attention needed |
| 60-64 | C | Fair, needs improvement |
| 55-59 | C- | Poor, take action |
| <55 | D | Critical — rest and recovery priority |

---

## Sleep Score (0-100)

```
Duration pts  (max 40): score = min(40, (actual_mins / 450) * 40)
Deep sleep    (max 30): score = min(30, (deep_pct / 0.20) * 30)
REM sleep     (max 20): score = min(20, (rem_pct / 0.22) * 20)
Quality bonus (max 10): quality_score * 0.10

Target: 7.5h total | 20% deep | 22% REM
```

---

## Recovery Score (0-100)

```
HRV component (60% weight):
  ≥ 50ms → 100 pts
  35-50ms → 60 + ((hrv - 35) / 15 * 40) pts
  < 35ms  → (hrv / 35 * 60) pts

Resting HR component (40% weight):
  ≤ 55 bpm → 100 pts
  55-65 bpm → 100 - ((rhr - 55) / 10 * 30) pts
  > 65 bpm  → max(0, 70 - (rhr - 65) * 3) pts
```

---

## Activity Score (0-100)

```
Steps component  (max 60): min(60, (avg_steps / 10000) * 60)
Calories component (max 40): min(40, (avg_active_cals / 500) * 40)

Target: 10,000 steps/day | 500 kcal active/day
```

---

## Heart Health Score (0-100)

```
Resting HR (40 pts):
  ≤ 60 bpm → 40
  61-70 bpm → 30
  71-80 bpm → 15
  > 80 bpm  → 5

SpO2 (30 pts):
  ≥ 98% → 30
  96-97% → 20
  94-95% → 10
  < 94% → 0

HR range stability (30 pts):
  Daily range < 60 bpm → 30
  Daily range < 80 bpm → 20
  Otherwise → 10
```

---

## Example Output

```
Health Score: 81/100 (B+)
Delta: +3 vs last week

Components:
  Sleep:        B+  (82/100) — Trung bình 7h12m/đêm | Deep 22% | REM 20%
  Recovery:     B   (76/100) — HRV 42ms | RHR 59bpm
  Activity:     B-  (72/100) — 7,821 bước/ngày | 468 kcal active
  Heart Health: B+  (83/100) — RHR 59bpm | SpO2 97.8%
  Consistency:  A   (100/100) — 7/7 ngày có dữ liệu

Explanation: Sức khỏe cải thiện +3 điểm so với tuần trước. Điểm cần cải thiện: Vận động (72/100).

Recommendations:
  • Tăng vận động: 15 phút đi bộ sau bữa tối.
```

---

## Why Score Changed — Explanation Logic

The engine automatically explains score changes:

```
If delta > +5:  "Sức khỏe cải thiện +N điểm so với tuần trước."
If delta < -5:  "Sức khỏe giảm N điểm so với tuần trước."
Else:           "Sức khỏe ổn định so với tuần trước."

If weakest component < 70:
  "Điểm yếu nhất: {component} ({score}/100)."
```

The explanation is always factual, specific, and non-alarming.
