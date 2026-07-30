# MARKETPLACE AUDIT SETUP

**Phase:** 16.1 — P1 Marketplace Operations
**Date:** 2026-06-17 16:53 (Asia/Saigon)

---

## Required Weekly Recurring Tasks

All 4 marketplace operations follow the **Parent Task → Store Subtasks** pattern.

### 1. DoorDash Campaign Review — Weekly

```
Title: DoorDash Campaign Review — Week of [date]
Type: Recurring (weekly)
Pattern: Parent + Store Subtasks

Parent Task:
  - Store: ALL (B1, B2, B3, Raw Stockton)
  - Owner: Store Manager
  - Checker: CEO
  - SLA: Every Monday by EOD
  - Evidence: Screenshot of DoorDash dashboard per store

Subtasks:
  → Bakudan The Rim — Campaign status, spend, revenue, ROI, screenshot
  → Bakudan Stone Oak — Campaign status, spend, revenue, ROI, screenshot
  → Bakudan Bandera — Campaign status, spend, revenue, ROI, screenshot
  → Raw Sushi Stockton — Campaign status, spend, revenue, ROI, screenshot
```

### 2. DoorDash Error Charge Recovery — Weekly

```
Title: DoorDash Error Charge Recovery — Week of [date]
Type: Recurring (weekly)
Pattern: Parent + Store Subtasks

Workflow per store:
  DoorDash → Store → Insights → Operations Quality
  → View Missing or Incorrect Error Charges
  → Order Detail → Dispute → Other Reason → Submit For Review

Subtasks:
  → Bakudan The Rim — Check all orders, dispute errors, track case IDs
  → Bakudan Stone Oak — Check all orders, dispute errors, track case IDs
  → Bakudan Bandera — Check all orders, dispute errors, track case IDs
  → Raw Sushi Stockton — Check all orders, dispute errors, track case IDs

Statuses: Not Checked → Checked → Dispute Submitted → Waiting → Recovered/Rejected/No Issue
Evidence: Screenshot of dispute + case ID
```

### 3. Uber Eats Weekly Audit — Weekly

```
Title: Uber Eats Weekly Audit — Week of [date]
Type: Recurring (weekly)
Pattern: Parent + Store Subtasks

Check per store:
  - Missing items
  - Wrong charges
  - Customer refund issues
  - Promotion issues
  - Driver issues
  - Marketplace error charges

Subtasks:
  → Bakudan The Rim — Full audit + screenshots
  → Bakudan Stone Oak — Full audit + screenshots
  → Bakudan Bandera — Full audit + screenshots
  → Raw Sushi Stockton — Full audit + screenshots
```

### 4. Yelp Reviews Weekly Management — Weekly

```
Title: Yelp Reviews Weekly Management — Week of [date]
Type: Recurring (weekly)
Pattern: Parent + Store Subtasks

Check per store:
  - New reviews
  - 1-2 star reviews (escalate immediately)
  - Review replies needed
  - Unresolved complaints
  - Operational issues mentioned

Subtasks:
  → Bakudan The Rim — Review status + response status
  → Bakudan Stone Oak — Review status + response status
  → Bakudan Bandera — Review status + response status
  → Raw Sushi Stockton — Review status + response status
```

---

## Implementation Method

These tasks must be created through the **UI Task creation workflow** which supports:
- Recurring task templates (weekly frequency)
- Parent→Subtask hierarchy
- Store assignment
- Evidence attachment

**Cannot be seeded via SQL** because:
- Task creation triggers notification, calendar event, and activity feed
- Subtask parent-child relationships require application logic
- Recurring engine only activates through the UI flow

---

## Store Assignment

| Store | DoorDash | UberEats | Yelp |
|---|---|---|---|
| Bakudan The Rim (B1) | ✅ | ✅ | ✅ |
| Bakudan Stone Oak (B2) | ✅ | ✅ | ✅ |
| Bakudan Bandera (B3) | ✅ | ✅ | ✅ |
| Raw Sushi Stockton | ✅ | ✅ | ✅ |
| Modesto | ❓ | ❓ | ❓ |
| Copper | ❓ | ❓ | ❓ |
| Heo Holding | ❌ | ❌ | ❌ |
| IFT | ❌ | ❌ | ❌ |

**CEO to confirm:** Do Modesto and Copper use DoorDash/UberEats/Yelp?
