# Phase 1.1 — Store Mapping Lock Report

**Project:** WhatsApp AI Gateway
**Date:** 2026-06-04
**Status:** IMPLEMENTED

---

## What Was Built

Store group locking prevents staff from overriding their assigned store via commands.

### Mechanism

Environment variable: `STORE_GROUPS_LOCKED`

Format: comma-separated chat IDs
Example: `STORE_GROUPS_LOCKED=chat123,chat456,chat789`

Function `isGroupLocked(chatId)` in `src/stores/store-registry.js`:

```javascript
function isGroupLocked(chatId) {
  const locked = process.env.STORE_GROUPS_LOCKED || '';
  return locked.split(',').map(s => s.trim()).includes(chatId);
}
```

---

## Lock Behavior

- Stone Oak locked group, staff types `/broth Rim` -> Bot ignores "Rim", uses Stone Oak
- Stone Oak locked group, staff types `/broth` (no store) -> Bot uses Stone Oak automatically
- Stone Oak group not mapped -> Bot shows: "This group is not linked to a store yet. Please ask admin to map this group."
- Direct chat to bot (CEO testing) -> Bot asks "Which store?"

---

## Dashboard Display

Store Groups panel now shows:
- Store name
- Group name
- Chat ID
- Locked status
- Last activity
- Admin-only unlock/update controls

---

## Admin-Only Controls

Store mapping can only be changed via:
1. Dashboard UI (admin only)
2. `POST /api/store-groups` with admin credentials

Staff cannot change store mapping via WhatsApp commands.

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Tech |      | 2026-06-04 |
