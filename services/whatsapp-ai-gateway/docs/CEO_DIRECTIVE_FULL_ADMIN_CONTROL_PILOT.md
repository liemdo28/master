# CEO Directive — Full Admin Control + Pilot Readiness Cleanup

Gửi dev nguyên văn nội dung bên dưới. Ưu tiên fix đầu tiên là **PHASE A — Packaging Security Cleanup** vì bản zip hiện tại vẫn chứa `data/session-audit-smoke` và browser profile/cache.

---

```text
CEO Directive — Full Admin Control + Pilot Readiness Cleanup

Project:
E:\Project\Master\whatsapp-ai-gateway

Audit Target:
whatsapp-ai-gateway-v1.0.0.zip

Current audit result:
Most Admin Control Center APIs and UI are present, but package is NOT clean enough for pilot because runtime/session/cache files are included.

Goal:
Finish final cleanup and verify full no-dev dashboard control before 7-Day Pilot.

==================================================
PHASE A — P0 Packaging Security Cleanup
==================================================

Current zip contains dangerous/unwanted runtime files:

data/session-audit-smoke/
data/session-audit-smoke/session/
browser cache
Local Storage
Login Data
Chrome profile files
data/backup/gateway.db.malformed-*
data/backup/gateway.db-wal.malformed-*
data/backup/gateway.db-shm.malformed-*

This must be fixed immediately.

Required:
Update pack.ps1 and pack.sh to exclude:

data/session*/
data/session-*/*
data/*session*/*
data/backup/*.db*
data/backup/*.sqlite*
data/backup/*.malformed*
**/Cache/**
**/Local Storage/**
**/IndexedDB/**
**/Login Data*
**/Cookies*
**/Local State
**/Preferences
**/Secure Preferences
**/History*
**/Favicons*
**/LOCK
**/LOG
**/LOG.old

Also exclude:
.env
node_modules/
secrets/
.wwebjs_auth/
.wwebjs_cache/
logs/
*.zip
data/*.db
data/*.db-wal
data/*.db-shm
data/*.journal

After pack:
Inspect zip.

Success:
No browser session/cache/profile/database files in package.

Commands:
.\pack.ps1

Then verify:
PowerShell:
Expand-Archive whatsapp-ai-gateway-v1.0.0.zip -DestinationPath _verify -Force
Get-ChildItem _verify -Recurse | findstr /i "session cache login cookies localstorage indexeddb .db .db-wal .db-shm secrets .env"

Expected:
No results except safe source files.

Deliverable:
docs/PACKAGING_SECURITY_AUDIT.md

==================================================
PHASE B — Admin Control Center UI Verification
==================================================

Goal:
CEO/GM can control setup from browser.

Dashboard must show near top:

Admin Control Center

Required panels:
1. Google Sheets
2. WhatsApp Groups
3. Store Mapping
4. Manager Alert Group
5. YoLink Devices
6. OCR / Template PDF
7. Sheet Queue
8. Pilot Controls
9. Setup Checklist

Verify buttons exist and work:

Google Sheets:
- Open Daily Entry Template
- Open Daily Log
- Save URLs
- Test Template Access
- Test Log Access
- Force Sync Template
- Test Sheet Write
- Retry Queue

WhatsApp:
- Refresh Groups
- Copy Chat ID
- Test Message
- Map to Store

Store Mapping:
- Save Mapping
- Lock Mapping
- Unlock Mapping
- Remove Mapping
- Test /ldagent

Manager Alerts:
- Save Manager Alert Group
- Test Alert
- Disable Alerts

YoLink:
- Add Device
- Seed CEO Devices
- Test API
- Force Poll
- Test Reading
- Map Sensor
- Disable Sensor

OCR:
- Open Printable Template PDF
- Regenerate Template
- Check OCR Dependencies
- View Last OCR Result

Pilot:
- Start Pilot
- View Pilot Status
- Generate Pilot Report

Deliverable:
docs/ADMIN_CONTROL_CENTER_UI_AUDIT.md

Include screenshots:
screenshots/admin-control-center.png
screenshots/google-sheets-panel.png
screenshots/whatsapp-groups-panel.png
screenshots/store-mapping-panel.png
screenshots/yolink-panel.png
screenshots/setup-checklist.png

==================================================
PHASE C — Google Sheet Real Test Hardening
==================================================

Current risk:
Test Write may write into production tab if FOOD_SAFETY_TEST_TAB is not set.

Required:
1. Create dedicated safe test tab:
Dashboard_Test_Log

2. Update test-write endpoint:
Always write to Dashboard_Test_Log unless explicitly overridden by admin test mode.

3. Test Template Access must:
- Authenticate with service account
- Read Daily_Entry_Template
- Return item_count
- Return last_sync_at

4. Test Log Access must:
- Authenticate with service account
- Write one safe row to Dashboard_Test_Log
- Return range/tab/timestamp

5. If service account missing:
Return clear error:
GOOGLE_SERVICE_ACCOUNT_JSON missing or inaccessible.

6. Do not report PASS from URL format only.

Deliverable:
docs/GOOGLE_SHEET_ACCESS_AUDIT.md

Success:
- Template read PASS
- Test write PASS to Dashboard_Test_Log
- No production log pollution

==================================================
PHASE D — WhatsApp Group Discovery + Mapping Live Test
==================================================

Test group:
LD Agent-Log

Required:
1. Start gateway.
2. Scan WhatsApp QR.
3. Dashboard → Admin Control Center → Refresh Groups.
4. Verify LD Agent-Log appears.
5. Copy/display Chat ID.
6. Send Test Message to LD Agent-Log.
7. Map LD Agent-Log to store_id = test.
8. Lock mapping.
9. In group send:
/ldagent

Expected:
Bot detects Store = Test.

Fix:
Remove any dead/unclear code in group discovery such as unused pupPage/browser logic.

Deliverable:
docs/WHATSAPP_GROUP_MAPPING_LIVE_AUDIT.md

Screenshots:
screenshots/group-discovery.png
screenshots/group-test-message.png
screenshots/test-store-mapping.png

==================================================
PHASE E — Store Mapping Readiness
==================================================

Required final mapping support:

Stores:
- test
- stone_oak
- bandera
- rim

Rules:
- One active group per store.
- One group cannot map to multiple stores.
- Locked group cannot be overridden by staff command.
- Direct chat can still ask store for CEO testing.

Setup Checklist must show:
- Test group mapped
- Stone Oak mapped or NEEDS_ACTION
- Bandera mapped or NEEDS_ACTION
- Rim mapped or NEEDS_ACTION
- Manager alert group set or NEEDS_ACTION

Deliverable:
docs/STORE_MAPPING_FINAL_AUDIT.md

==================================================
PHASE F — Manager Alert Group Live Test
==================================================

Required:
1. Create or use Manager Alert test group.
2. Dashboard discovers the group.
3. Set as Manager Alert Group from UI.
4. Click Test Alert.
5. Trigger out-of-range Daily Entry value.
6. Verify:
- Store group receives warning
- Manager group receives alert
- Dashboard shows last alert

Deliverable:
docs/MANAGER_ALERT_LIVE_AUDIT.md

Screenshots:
screenshots/manager-alert-test-message.png
screenshots/manager-alert-real-warning.png

==================================================
PHASE G — YoLink Device UI Verification
==================================================

Known devices:
Model: YS8017-UC

Device EUIs:
- d88b4c01000f1398
- d88b4c01000f176f
- d88b4c01000f069b

Required:
1. Dashboard → YoLink Device Setup.
2. Click Seed CEO Devices.
3. Verify rows are drafts, not auto-saved.
4. Save devices.
5. Map:
   d88b4c01000f1398 → Stone Oak → Walk-in Cooler
   d88b4c01000f176f → Bandera → Walk-in Cooler
   d88b4c01000f069b → Rim → Walk-in Cooler
6. If credentials missing:
Show YoLink API not configured.
Human workflow remains active.
7. If credentials present:
Test API / Force Poll / Test Reading.

Deliverable:
docs/YOLINK_DEVICE_UI_AUDIT.md

==================================================
PHASE H — OCR Runtime Verification
==================================================

Required:
1. Check OCR dependencies.
2. Open printable template PDF from dashboard.
3. Generate/regenerate template.
4. Print or use generated image.
5. Send test photo to WhatsApp.
6. Verify:
- Template detected
- OCR summary appears
- EDIT works
- CONFIRM writes or queues sheet
- Dashboard shows OCR result

Deliverable:
docs/OCR_RUNTIME_FINAL_AUDIT.md

If OCR is disabled/missing:
Dashboard must show clear:
OCR dependencies missing.
Human workflow remains active.

==================================================
PHASE I — History + Audit Access Verification
==================================================

Verify:
- Dashboard History & Audit Logs exists
- /history today works in Manager Group
- /who Walk-in Cooler today works
- /summary today works
- CSV export works
- Excel export works or clearly disabled
- Staff cannot access global history

Deliverable:
docs/HISTORY_AUDIT_ACCESS_REPORT.md

==================================================
PHASE J — Full Test Suite + Packaging
==================================================

Run:

npm install
node --check tests/live/screenshot-capture.js
npm test
node tests/live/live-validator.js --no-telegram
node tests/live/sheet-write-test.js
node scripts/check-ocr-deps.js
node scripts/generate-daily-entry-template.js
.\pack.ps1

Expected:
- Full test suite PASS
- No SQLITE_BUSY
- Sheet write PASS or queued safely
- OCR dependency status clear
- Package clean
- No secrets/session/cache/DB files in zip

Deliverable:
docs/FULL_FINAL_VALIDATION_REPORT.md

==================================================
PHASE K — Pilot Start Gate
==================================================

Pilot may start only if:

P0 Required:
- Packaging clean
- Dashboard opens both Google Sheets
- Template sync PASS
- Test sheet write PASS
- WhatsApp group discovery PASS
- Test group mapping PASS
- Manager alert group test PASS
- Setup checklist visible and accurate
- No SQLITE_BUSY
- Store mappings locked

P1 Recommended:
- OCR runtime PASS or safely disabled
- YoLink devices saved and mapped
- History commands PASS

Output:
docs/PILOT_START_GATE.md

Status:
PASS / FAIL / BLOCKED

If PASS:
Start Day 0 Pilot.

If FAIL:
Fix only failed items.
No new features.

==================================================
Final Success Definition
==================================================

CEO/GM can do all of this without dev:
1. Open dashboard.
2. Open both Google Sheets.
3. Save sheet URLs.
4. Test sheet access/write.
5. Discover WhatsApp groups.
6. Map groups to stores.
7. Set manager alert group.
8. Add/map YoLink devices.
9. Regenerate/open OCR template.
10. View setup checklist.
11. Start pilot.

System package contains no secrets, no session data, no runtime DB/cache.
```
