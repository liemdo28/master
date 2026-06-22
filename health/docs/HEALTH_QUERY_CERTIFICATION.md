# HEALTH QUERY CERTIFICATION
**MI Health V1 — Phase 7 Deliverable**  
**Date:** 2026-06-13  
**File:** `mi-core/health/HealthQueryHandler.mjs`

---

## Query Detection

```javascript
isHealthQuery(text) → bool
```

Detects health queries via keyword matching across Vietnamese and English:
`bước, steps, ngủ, sleep, tim, heart, sức khỏe, health, calories, workout, tập, hrv, nhịp, hồi phục, recovery, spo2, đáng lo, cảnh báo, điểm sức khỏe, mệt, năng lượng`

---

## Supported Queries

### Steps Today
**Query:** `"Mi ơi hôm nay anh đi bao nhiêu bước?"`  
**Route:** `respondStepsToday()`

```
Dạ thưa Anh, em vừa kiểm tra dữ liệu hôm nay (Thứ Sáu, 13/6).

👟 Bước chân: 8,432 bước — đạt 84% mục tiêu 10,000 bước.

Còn cách mục tiêu 1,568 bước (~15 phút đi bộ).
Em đề xuất Anh đi bộ thêm một vòng nhỏ sau bữa tối là xong ạ.
```

---

### Sleep Last Night
**Query:** `"Mi ơi đêm qua anh ngủ thế nào?"`  
**Route:** `respondSleepLastNight()`

```
Dạ thưa Anh, em vừa xem dữ liệu giấc ngủ đêm Thứ Năm, 12/6.

🌙 Tổng thời gian ngủ: 7h12m (chất lượng: B+)
  • Deep sleep: 1h45m (24%)
  • REM: 1h34m (22%)
  • Thức giữa đêm: 18 phút

✅ Giấc ngủ tốt! Anh có đủ deep sleep và REM ạ.
```

---

### Weekly Health
**Query:** `"Mi ơi tuần này sức khỏe sao rồi?"`  
**Route:** `respondWeeklySummary()`

```
Dạ thưa Anh, đây là tổng quan sức khỏe tuần này (09/06 – 15/06):

🏆 Health Score: 81/100 (B+)
  Sleep: B+ | Recovery: B | Activity: B- | Heart: B+

👟 Vận động: Trung bình 7,821 bước/ngày (mục tiêu 10,000 bước)
🌙 Giấc ngủ: Trung bình 7h05m/đêm ✅
❤️  Nhịp tim nghỉ: 59.2 bpm ✅
📊 HRV: 41.5 ms ✅
🏋️ Tập luyện: 2 buổi trong tuần

💡 Em đề xuất: Tăng vận động: 15 phút đi bộ sau bữa tối.
```

---

### Monthly Sleep
**Query:** `"Mi ơi tháng này anh ngủ thế nào?"`  
**Route:** `respondMonthlySleep()`

```
Dạ thưa Anh, đây là tổng quan giấc ngủ tháng 2026-06:

🌙 Trung bình: 7h05m/đêm (13 ngày có dữ liệu)
✅ Nhìn chung tháng này Anh ngủ đủ giấc.
```

---

### Alerts / Concerns
**Query:** `"Mi ơi có gì đáng lo không?"`  
**Route:** `respondAlerts()`

**When all clear:**
```
Dạ thưa Anh, em vừa kiểm tra toàn bộ chỉ số sức khỏe 7 ngày qua.

✅ Không phát hiện dấu hiệu bất thường đáng lo ngại:
  • Nhịp tim nghỉ: trong ngưỡng bình thường
  • HRV: ổn định
  • Giấc ngủ: không có đêm nào dưới 5 tiếng
  • Vận động: không giảm bất thường

Sức khỏe tổng thể ổn định ạ.
```

**When alerts exist:**
```
Dạ thưa Anh, em vừa kiểm tra xong. Có một số điểm cần lưu ý:

🟡 Cần theo dõi:
  • Em thấy có dấu hiệu giảm hồi phục trong 4 ngày liên tiếp
    (HRV giảm 21%). Em đề xuất giảm cường độ làm việc và vận động hôm nay.
  • Em thấy giấc ngủ của Anh giảm 22% trong 7 ngày qua
    (6h20m vs 8h05m). Em đề xuất Anh ưu tiên nghỉ sớm tối nay.
```

---

### Health Score
**Query:** `"Mi ơi điểm sức khỏe hôm nay là bao nhiêu?"`  
**Route:** `respondHealthScore()`

```
Dạ thưa Anh, em vừa tính điểm sức khỏe 7 ngày qua:

🏆 Health Score: 81/100 (B+) (+3 so với tuần trước)

Phân tích theo thành phần:
  🌙 Sleep:        B+  (82/100) — Trung bình 7h12m/đêm | Deep 22% | REM 20%
  💪 Recovery:     B   (76/100) — HRV 42ms | RHR 59bpm
  👟 Activity:     B-  (72/100) — 7,821 bước/ngày | 468 kcal active
  ❤️  Heart:        B+  (83/100) — RHR 59bpm | SpO2 97.8%
  📅 Consistency:  A   (100/100) — 7/7 ngày có dữ liệu

📝 Sức khỏe cải thiện +3 điểm so với tuần trước.
   Điểm cần cải thiện: Vận động (72/100).

💡 Em đề xuất:
  • Tăng vận động: 15 phút đi bộ sau bữa tối.
```

---

## Response Tone Rules (Certified)

1. ✅ Open with: `"Dạ thưa Anh, em vừa kiểm tra..."`
2. ✅ Give concrete numbers, never generalities
3. ✅ Compare to goal / baseline / last week
4. ✅ End with one specific recommendation when score < target
5. ✅ End with confirmation when everything is good
6. ✅ Never alarm unnecessarily
7. ✅ Never diagnose medical conditions
8. ✅ Never say "Em không biết" without offering a next step

---

## CLI Testing

```bash
node sync-health.mjs query "Mi ơi hôm nay anh đi bao nhiêu bước?"
node sync-health.mjs query "Mi ơi tuần này sức khỏe sao rồi?"
node sync-health.mjs query "Mi ơi có gì đáng lo không?"
node sync-health.mjs query "Mi ơi tháng này anh ngủ thế nào?"
node sync-health.mjs query "Mi ơi điểm sức khỏe hôm nay là bao nhiêu?"
```
