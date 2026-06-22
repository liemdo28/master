# Test Store Mapping Report

**Phase:** A — Test Store Setup
**Date:** 2026-06-04
**Status:** READY TO EXECUTE

---

## Goal

Use **LD Agent-Log** as a sandbox test store before enabling real store pilot.

## Steps

### 1. Start gateway

```bash
cd E:\Project\Master\whatsapp-ai-gateway
npm start
```

Expected: gateway running, dashboard on `http://localhost:3210`.

### 2. Open dashboard

Navigate to: `http://localhost:3210`

### 3. Go to

**Admin Control Center → WhatsApp Groups**

### 4. Click

**Refresh Groups**

### 5. Verify

Group `LD Agent-Log` appears in the list.

### 6. Map store

| Field | Value |
|---|---|
| Store ID | `test` |
| Store Name | `Test` |
| WhatsApp Group | `LD Agent-Log` |
| Locked | `ON` |
| Active | `ON` |

### 7. Save mapping

Click **Save**.

### 8. Test

In WhatsApp group `LD Agent-Log`, send:
```
/ldagent
```

Expected bot reply:
```
🤖 Bakudan LD Agent ready.
Store: Test
Choose workflow:
1 — Daily Entry Log
2 — Broth Log
3 — ...
```

---

## Deliverable

This report at: `docs/TEST_STORE_MAPPING_REPORT.md`

## Screenshots Required

- `screenshots/test-store-mapping.png` — dashboard showing LD Agent-Log mapped to Test store
- `screenshots/ldagent-test-store-response.png` — WhatsApp showing bot reply

---

## Verification Checklist

- [ ] Gateway started successfully
- [ ] Dashboard accessible at http://localhost:3210
- [ ] LD Agent-Log group listed after Refresh Groups
- [ ] Store mapping saved (Test / LD Agent-Log / Locked=ON / Active=ON)
- [ ] `/ldagent` in group triggers bot response
- [ ] Bot response identifies Store: Test

---

## Notes

- `Store ID = test` is reserved for pilot testing only
- `Locked = ON` prevents accidental remap during pilot
- `Active = ON` enables workflow for the group
- This mapping is the foundation for all subsequent pilot phases
