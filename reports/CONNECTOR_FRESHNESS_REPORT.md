# Connector Freshness Report
**Date:** 2026-06-15
**Phase:** DEV3 CEO_READY_V3 Closeout — D3

---

## Freshness by Connector

| Connector | Last Sync | Freshness | Acceptable? |
|-----------|-----------|-----------|-------------|
| Master Workspace (local) | Realtime | Always fresh | ✅ |
| Dashboard (local) | Realtime | Always fresh | ✅ |
| rawsushibar.com (local) | Realtime | Always fresh | ✅ |
| bakudanramen.com (local) | Realtime | Always fresh | ✅ |
| Food Safety (local) | Per export | Depends on export | ✅ |
| QuickBooks Runtime | Last QB sync | Stale until QB runs | ⚠️ Needs QB sync |
| Accounting Engine | Realtime (if online) | N/A if offline | ⚠️ Engine must be running |
| Gmail | Never | Not configured | ❌ Setup required |
| Google Calendar | Never | Not configured | ❌ Setup required |
| Google Drive | Never | Not configured | ❌ Setup required |
| Huawei Health | Never | Not configured | ❌ Setup required |
| Asana | Never | Not configured | ❌ Setup required |

---

## Freshness Thresholds

| Connector | Fresh | Stale | Dead |
|-----------|-------|-------|------|
| Local files | Always | N/A | N/A |
| QuickBooks | < 4 hours | 4–24 hours | > 24 hours |
| Accounting Engine | Realtime | N/A | offline |
| Finance Cache | < 6 hours | 6–24 hours | > 24 hours |

---

## CEO Impact of Stale Data

| Scenario | CEO Experience |
|----------|----------------|
| QB last synced today | "💼 Dữ liệu QB — cập nhật X phút trước" |
| QB last synced 2 days ago | "⚠️ Cảnh báo: dữ liệu QB 2 ngày trước — có thể lỗi thời" |
| QB never synced / no data | "❌ Không có dữ liệu — chạy QB Web Connector sync" |
| All connectors offline | "❌ Không có nguồn dữ liệu — liệt kê tất cả trạng thái connector" |

---

## Freshness Enforcement

Finance Truth Layer (D1) enforces freshness warnings automatically:

```typescript
const fresh = freshnessMinutes(qb.last_sync);
// If fresh > 1440 min (24h) AND source is cache:
staleWarning = `⚠️ Dữ liệu cache đã ${days} ngày — có thể lỗi thời.`
```

QuickBooks response always shows timestamp:
```
🕐 Cập nhật: 3 phút trước   ← fresh
🕐 Cập nhật: 2 ngày trước   ← stale (shown but not blocked)
```

---

## Recommendations for Dev5

1. **Automate QB sync** — schedule QB Web Connector to run daily at 06:00 before morning briefing
2. **Finance cache TTL** — auto-invalidate finance-cache.json after 6 hours
3. **Connector health poller** — O5 burn-in scheduler should poll connector health every hour
4. **Google OAuth flow** — implement web-based OAuth handshake for Gmail/Calendar/Drive
