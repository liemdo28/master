# Real Store Mapping Prep Report

**Phase:** F — Real Store Mapping Prep
**Date:** 2026-06-04
**Status:** READY TO EXECUTE

---

## Goal

Map real WhatsApp groups to real stores from the dashboard. Lock mappings. Test each `/ldagent` resolves the correct store.

**Do NOT add employees yet.** Only map groups.

## Required Stores

| Store | WhatsApp Group |
|---|---|
| Stone Oak | Stone Oak LD Agent |
| Bandera | Bandera LD Agent |
| Rim | Rim LD Agent |

## Per-Store Steps

For each store, repeat:

### 1. Add WhatsApp Account A to the store's group

Open WhatsApp → find the store group → add the bot's WhatsApp account.

### 2. Refresh Groups in dashboard

Dashboard → Admin Control Center → WhatsApp Groups → **Refresh Groups**

### 3. Select group

Select the correct group row.

### 4. Map to store

| Field | Value |
|---|---|
| Store ID | (from store list above) |
| Store Name | (from store list above) |
| WhatsApp Group | (correct group for this store) |
| Locked | `ON` |
| Active | `ON` |

### 5. Save mapping

Click **Save**.

### 6. Test `/ldagent`

In the store's WhatsApp group, send:
```
/ldagent
```

**Expected:** Bot replies identifying the correct store name.

If bot says the wrong store → STOP, mapping is wrong, fix immediately.

---

## Per-Store Verification

| Store | Group | Mapping Saved | Locked | Active | /ldagent Correct Store | ✓/✗ |
|---|---|---|---|---|---|---|
| Stone Oak | Stone Oak LD Agent | | | | | |
| Bandera | Bandera LD Agent | | | | | |
| Rim | Rim LD Agent | | | | | |

---

## Deliverable

This report at: `docs/REAL_STORE_MAPPING_PREP_REPORT.md`

## Screenshots Required

- `screenshots/stone-oak-mapping.png` — Stone Oak group mapped and locked
- `screenshots/bandera-mapping.png` — Bandera group mapped and locked
- `screenshots/rim-mapping.png` — Rim group mapped and locked

---

## Critical Rules

- **Lock = ON** before real pilot starts — prevents accidental remap
- **Active = ON** enables the workflow
- Mapping is group-level — all members of the group share the same store
- Do NOT map two groups to the same store
- Do NOT skip a store — map all three before Phase G

---

## Failure Modes

- Wrong group selected → STOP, wrong store logs will be written — P0
- Lock = OFF → accidental remap during pilot — P1
- /ldagent returns wrong store → mapping error — P0

Log all failures to `docs/PILOT_FIX_LOG.md`.