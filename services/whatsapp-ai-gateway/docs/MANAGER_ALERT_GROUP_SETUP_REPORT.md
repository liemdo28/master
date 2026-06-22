# Manager Alert Group Setup Report

**Phase:** C — Manager Alert Group Setup
**Date:** 2026-06-04
**Status:** READY TO EXECUTE

---

## Goal

Configure a dedicated manager WhatsApp group that receives alerts when food safety values are out-of-range or critical.

## Steps

### 1. Create WhatsApp group

Create a new WhatsApp group named: **`Bakudan Manager Alerts`**

**Members (recommended):**
- CEO
- GM
- WhatsApp Account A (the same account running the bot)
- Optional: one or more store managers (pilot scope only)

### 2. Open dashboard

`http://localhost:3210`

Navigate: **Admin Control Center → WhatsApp Groups**

### 3. Click **Refresh Groups**

The new `Bakudan Manager Alerts` group should appear in the list.

### 4. Set as Manager Alert Group

- Select row: `Bakudan Manager Alerts`
- Click **Set as Manager Alert Group** button
- Confirm: a banner shows "Manager alert group saved"

### 5. Save

Click **Save Manager Alert Group**.

### 6. Test Alert

Click **Test Alert** button.

**Expected:**
- Test alert message appears in `Bakudan Manager Alerts` WhatsApp group
- Message body roughly:
```
🧪 TEST ALERT
Manager alert group is configured correctly.
Store: Test
Time: <ISO timestamp>
```

---

## Deliverable

This report at: `docs/MANAGER_ALERT_GROUP_SETUP_REPORT.md`

## Screenshots Required

- `screenshots/manager-alert-group-config.png` — dashboard showing `Bakudan Manager Alerts` selected as Manager Alert Group
- `screenshots/manager-alert-test-message.png` — WhatsApp message confirming test alert received

---

## Verification Checklist

- [ ] `Bakudan Manager Alerts` WhatsApp group created with required members
- [ ] Group visible in dashboard after Refresh Groups
- [ ] "Set as Manager Alert Group" succeeds
- [ ] Test Alert button triggers a message in the group
- [ ] Dashboard indicates group as configured

---

## Notes

- Only ONE Manager Alert Group can be configured at a time
- Manager group is global — receives alerts from ALL stores
- A confirmed out-of-range reading is the trigger (not the raw 44 input)
- Bot sends alert **after CONFIRM**, not on raw input
- Debounce prevents duplicate alerts (per scenario MA-05/MA-06)