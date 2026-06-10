# Mi Big Data — CEO Query Examples

Use these queries via Mi chat or directly via `GET /api/bigdata/query?q=...`

---

## Store Performance

```
Mi, store nào có nhiều issue nhất 30 ngày qua?
→ Bakudan: 12 issues, Raw: 4 issues

Mi, Stone Oak tuần rồi có lỗi gì?
→ [task] Opening checklist missed — overdue (dashboard)
  [task] Inventory not submitted — missed (dashboard)

Mi, store nào doanh thu giảm tuần này?
→ Search across normalized_events for revenue/sale events
```

---

## DoorDash / Disputes

```
Mi, DoorDash dispute nào chưa xử lý?
→ DD-8829341: "Order never delivered" — pending (2026-06-08)
  DD-8831002: "Wrong order" — pending (2026-06-09)

Mi, DoorDash payout tuần này bao nhiêu?
→ Search bank_feed events with "DOORDASH PAYOUT"
```

---

## Reviews

```
Mi, review xấu nào cần escalate?
→ 3 reviews (1-2 stars) without reply:
  • Google: "Waited 40 minutes" — Jane Smith (2026-06-09)
  • Yelp: "Cold food, no apology" — Tom K. (2026-06-08)

Mi, Yelp rating tuần này thế nào?
→ Search review events, platform=yelp, last 7 days
```

---

## QuickBooks

```
Mi, QB ngày nào thiếu activity?
→ Missing QB activity: 2026-06-07, 2026-06-08

Mi, tháng này có refund nào lớn không?
→ Search normalized_events, event_type=refund, amount > 100

Mi, Sysco invoice tháng này tổng bao nhiêu?
→ Search events, customer=Sysco, event_type=expense
```

---

## Tasks / Operations

```
Mi, manager nào miss submission nhiều nhất?
→ Maria: 3 lần, Hoang: 1 lần (30 ngày)

Mi, có invoice nào duplicate không?
→ Không có invoice duplicate. ✅

Mi, có approval nào đang pending không?
→ Search normalized_events, event_type=approval, status=pending
```

---

## Combined / Cross-source

```
Mi, hôm nay có gì cần xử lý gấp?
→ 1 overdue task, 2 pending disputes, 1 low-rating review without reply

Mi, Raw Sushi Bar tháng này thế nào?
→ store_id=raw, last 30 days: 245 sale events, 3 disputes, 2 reviews

Mi, tìm tất cả event liên quan Maria
→ search actor=Maria across all event types
```

---

## API Usage

```bash
# Via CLI
npm run bigdata:search -- "Stone Oak issue"

# Via API
curl "http://localhost:4001/api/bigdata/query?q=DoorDash+dispute+chưa+xử+lý"
curl "http://localhost:4001/api/bigdata/events?store_id=bakudan&event_type=review&date_from=2026-06-01"
curl "http://localhost:4001/api/bigdata/search?q=manager+miss+submission"
```
