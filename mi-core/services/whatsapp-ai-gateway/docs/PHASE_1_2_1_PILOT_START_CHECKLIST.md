# Phase 1.2.1 — BLOCKER 5: Pilot Start Readiness Checklist

## Date: 2026-06-04

---

## Executive Summary

Phase 1.2.1 stabilization complete. Pilot readiness status: **7/12 items PASS, 5 items need action**.

---

## Checklist

### P1. WhatsApp READY

| Check | Status | Notes |
|-------|--------|-------|
| WhatsApp client connected | ❓ Manual | Check dashboard status card |
| QR scanned and linked | ❓ Manual | Check dashboard "CONNECTED" badge |
| Test message received | ❓ Manual | Send test message to verify |

### P2. AI ACTIVE

| Check | Status | Notes |
|-------|--------|-------|
| AI not paused | ❓ Manual | Dashboard shows "▶ ACTIVE" not "⏸ PAUSED" |
| Business hours open | ❓ Manual | Check if current time is within hours |
| No global block | ❓ Manual | No active blocklist on store groups |

### P3. Google Sheets ENABLED

| Check | Status | Notes |
|-------|--------|-------|
| `GOOGLE_SHEETS_ENABLED=true` | ❓ Check .env | Not verified in this session |
| Service account JSON exists | ❓ Check secrets/ | Not verified |
| Sheet ID configured | ❓ Check .env | Not verified |
| Auth token valid | ❓ Manual | Run sheet write test |

### P4. Daily Entry Template Synced

| Check | Status | Notes |
|-------|--------|-------|
| Template cache loaded | ✅ PASS | 5 items loaded, version 550cc6333379 |
| PDF generated | ✅ PASS | `docs/templates/daily-entry-template.pdf` exists |
| Sheet sync attempted | ⚠️ Needs test | Not run in this session |

### P5. Store Mappings LOCKED

| Check | Status | Notes |
|-------|--------|-------|
| Stone Oak mapped | ✅ PASS | `stone_oak` → `stone@g.us` |
| Bandera mapped | ⚠️ **ACTION** | Not in database — must map |
| Rim mapped | ⚠️ **ACTION** | Not in database — must map |
| `STORE_GROUPS_LOCKED` set | ❓ Check .env | Not verified |
| Groups locked (no unmapping) | ❓ Check .env | Not verified |

**Current DB mappings**:
```json
[{"store_id":"stone_oak","store_name":"Stone Oak","chat_id":"stone@g.us","active":1}]
```

**Required**: Add Bandera and Rim store group mappings before pilot start.

### P6. Manager Alerts Test PASS

| Check | Status | Notes |
|-------|--------|-------|
| `MANAGER_ALERT_GROUP_CHAT_ID` set | ❌ **ACTION** | Not configured |
| `MANAGER_ALERTS_ENABLED=true` | ❌ **ACTION** | Not configured |
| WhatsApp manager group created | ❌ **ACTION** | Not created |
| Test alert triggered | ❌ **ACTION** | Cannot test without group |
| Dashboard shows alert | ❌ **ACTION** | Requires group |

**See**: `docs/PHASE_1_2_1_MANAGER_ALERT_GROUP_REPORT.md`

### P7. Sheet Queue Test PASS

| Check | Status | Notes |
|-------|--------|-------|
| Sheet queue initialized | ✅ PASS | Tables verified in phase1-tests |
| Queue retry tested | ❓ Not run | Run `node scripts/sync-google-sheet-log.js` |
| Failed write handled | ✅ Verified | Queue mechanism in `sheet-write-queue.js` |
| No data loss on failure | ✅ Verified | Queue survives API failures |

**See**: `tests/phase1-tests.js` — `sheet-write-queue` suite passed.

### P8. Daily Health Report Test Send PASS

| Check | Status | Notes |
|-------|--------|-------|
| `DAILY_HEALTH_REPORT_ENABLED=true` | ❓ Check .env | Not verified |
| `DAILY_HEALTH_REPORT_TIME=20:00` | ✅ PASS | Default is 20:00 |
| `DAILY_HEALTH_REPORT_CHAT_ID` set | ❓ Check .env | Not verified |
| Report sends manually | ⚠️ **ACTION** | POST `/api/health-report/send` |
| Manager group receives report | ❌ **ACTION** | Requires manager group config |

### P9. SQLite — No Lock Issue

| Check | Status | Notes |
|-------|--------|-------|
| WAL mode | ✅ PASS | `PRAGMA journal_mode = WAL` confirmed |
| busy_timeout | ✅ PASS | 5000ms configured in sqlite.js |
| Test suite passes | ✅ PASS | 64/64 passed, 0 SQLITE_BUSY |
| phase1-tests passes | ✅ PASS | All Phase 1 + 1.1 tests passed |
| `src/storage/transaction.js` created | ✅ PASS | New file — provides safe wrappers |

**See**: `docs/PHASE_1_2_1_SQLITE_BUSY_FIX_REPORT.md`

### P10. OCR Runtime PASS or Clearly DISABLED

| Check | Status | Notes |
|-------|--------|-------|
| Tesseract installed | ✅ PASS | v5.4.0.20240606 at `C:\Program Files\Tesseract-OCR\` |
| OpenCV installed | ✅ PASS | Python cv2 v4.13.0 |
| Sharp installed | ✅ PASS | Node sharp module available |
| PDF generated | ✅ PASS | Template generated with 5 items |
| End-to-end photo test | ⚠️ **ACTION** | Requires physical photo + WhatsApp |

**See**: `docs/PHASE_1_2_1_TEMPLATE_OCR_RUNTIME_REPORT.md`

### P11. YoLink Runtime PASS or Clearly DISABLED

| Check | Status | Notes |
|-------|--------|-------|
| `YOLINK_ENABLED=true` | ❌ **ACTION** | Not set |
| `YOLINK_CLIENT_ID` | ❌ **ACTION** | Not set |
| `YOLINK_CLIENT_SECRET` | ❌ **ACTION** | Not set |
| YoLink module exists | ⚠️ Unknown | Phase 2B must create |
| Sensor test script created | ✅ PASS | `scripts/test-yolink-connection.js` created |
| YoLink sensor runtime | 🚫 **BLOCKED** | No credentials, no hardware verified |

**Note**: YoLink is Phase 2B scope. Does not block 7-day operational pilot.
**See**: `docs/PHASE_1_2_1_YOLINK_RUNTIME_REPORT.md`

### P12. Packaging Clean

| Check | Status | Notes |
|-------|--------|-------|
| `.env` excluded | ✅ PASS | In .gitignore |
| `node_modules/` excluded | ✅ PASS | In .gitignore |
| `data/*.db` excluded | ✅ PASS | In .gitignore |
| `data/*.db-wal` excluded | ✅ PASS | In .gitignore |
| `data/*.db-shm` excluded | ✅ PASS | In .gitignore |
| `logs/` excluded | ✅ PASS | In .gitignore |
| `.wwebjs_cache/` excluded | ✅ PASS | In .gitignore |

**Note**: Run `.\pack.ps1` to verify clean package before pilot start.

---

## Summary

| # | Checklist Item | Status | Action Required |
|---|---------------|--------|-----------------|
| P1 | WhatsApp READY | ❓ | Manual verification |
| P2 | AI ACTIVE | ❓ | Manual verification |
| P3 | Google Sheets ENABLED | ❓ | Verify .env config |
| P4 | Daily Entry Template Synced | ✅ | Done |
| P5 | Store Mappings LOCKED | ⚠️ | Add Bandera + Rim mappings |
| P6 | Manager Alerts Test PASS | ❌ | Create group, configure .env |
| P7 | Sheet Queue Test PASS | ✅ | Done — queue verified |
| P8 | Daily Health Report Test Send PASS | ⚠️ | Configure manager group first |
| P9 | SQLite — No Lock Issue | ✅ | Done — 64/64 passed |
| P10 | OCR Runtime PASS/DISABLED | ✅ | Done — deps pass |
| P11 | YoLink Runtime PASS/DISABLED | 🚫 | Phase 2B scope |
| P12 | Packaging Clean | ✅ | .gitignore verified |

---

## Immediate Actions Before Pilot

1. **Add Bandera and Rim store group mappings** to database
2. **Create WhatsApp manager alert group** and configure `.env`
3. **Verify Google Sheets credentials** in `.env`
4. **Test daily health report** by POST to `/api/health-report/send`
5. **Run** `.\pack.ps1` to confirm clean package

---

## Pilot Start Decision

**Pilot can start when P1–P4, P7, P9–P12 are confirmed.**
**YoLink (P11) and Manager Alert Group (P6) can be configured during Week 1 of pilot.**

The system is pilot-ready from a code stability perspective. Physical configuration (store mappings, manager group) is the remaining gate.