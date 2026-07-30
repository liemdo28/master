# Phase 1.1 — Internal Pilot Checklist

**Project:** WhatsApp AI Gateway — Human-Friendly Operations Assistant
**Date:** 2026-06-04
**Status:** READY — Awaiting Pilot Start

---

## Pre-Pilot Setup

### Store Groups
- [ ] Stone Oak group mapped to Bakudan Stone Oak Team
- [ ] Stone Oak group locked
- [ ] Bandera group mapped to Bakudan Bandera Team
- [ ] Bandera group locked
- [ ] Rim group mapped to Bakudan Rim Team
- [ ] Rim group locked

### Manager Configuration
- [ ] Bakudan Management Team WhatsApp group chat ID configured
- [ ] Manager alert group verified
- [ ] Daily health report chat ID configured

### System Verification
- [ ] Google Sheets credentials verified
- [ ] Template sync from Daily_Entry_Template verified
- [ ] Sheet queue recovery verified
- [ ] Audit trail tables created and accessible

### Language Testing
- [ ] EN: /ldagent tested in Stone Oak group
- [ ] ES: /ldagent tested in Stone Oak group
- [ ] VI: /ldagent tested in Stone Oak group

---

## Functional Tests (Per Store)

### /ldagent Flow
- [ ] /ldagent starts session in store group
- [ ] Menu shown in detected language
- [ ] Option 1 (Daily Entry Log) selected
- [ ] One-at-a-time workflow starts
- [ ] Out-of-range triggers warning before advancing

### Non-Owner Lock
- [ ] Second staff member cannot control session
- [ ] Non-owner sees warning message

### Timeout
- [ ] Session closes after inactivity
- [ ] User receives farewell message

### Confirmation
- [ ] CONFIRM writes to Google Sheet
- [ ] User sees confirmation message
- [ ] Audit trail shows submission

### Edit Before Confirm
- [ ] EDIT 3 0 changes item 3 to 0
- [ ] Summary updates
- [ ] Audit trail shows edit history

### Out-of-Range Manager Alert
- [ ] Out-of-range value triggers "1. Correct / 2. Re-enter"
- [ ] Manager alert sent to management group
- [ ] Manager alert includes: store, employee, time, item, range, value

---

## Sheet Queue Tests
- [ ] Simulate sheet API unavailable, payload queued
- [ ] User sees: "Saved locally. Google Sheet write queued."
- [ ] Dashboard shows pending count
- [ ] Retry sends queued item
- [ ] Failed item remains visible after max retries

---

## Daily Health Report Test
- [ ] Report includes all 3 stores
- [ ] Missing store marked Submitted: NO
- [ ] Warnings counted correctly
- [ ] Sheet queue status shown
- [ ] Test send works
- [ ] Scheduled send (8 PM) verified

---

## Final Checklist
- [ ] All 3 stores can operate independently
- [ ] Store mapping is locked
- [ ] Confirmed logs written or safely queued
- [ ] Audit trail records original, edited, and final values
- [ ] Manager alert sends on out-of-range values
- [ ] Daily health report sends to manager group
- [ ] Dashboard shows: mappings, sessions, queue, alerts, report status
- [ ] No data loss during Google Sheet failure
- [ ] Phase 1 tests pass: node tests/phase1-tests.js
- [ ] Package clean

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| CEO  |      |      |
| Tech |      |      |

*Do not start OCR/Vision Phase 2 until all items are checked.*
