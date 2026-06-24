# Food Safety AI Template — Phase 3

## Overview

The Food Safety AI module extracts temperature readings from WhatsApp images, compares them against configurable thresholds stored in a Google Sheet, and immediately warns the team if any reading is out of range or unclear.

**Feature status:** Development complete. Awaiting test chat validation.

---

## Architecture

```
WhatsApp Image
     ↓
message-listener (image branch)
     ↓
food-safety-pipeline.runPipeline()
     ↓
   ┌──────────────────────────────────┐
   │  1. image-analyzer.analyzeImage()  │ → extracted JSON
   │  2. threshold-engine.checkAll()     │ → PASS/FAIL
   │  3. warning-generator.generateResult() → warning text
   │  4. food-safety-storage.saveCheck() → SQLite
   └──────────────────────────────────┘
     ↓
reply-service.send() (if FAIL or NEEDS_REVIEW)
     ↓
Dashboard / API updates
```

---

## Configuration

```bash
# .env

# Master switch
FOOD_SAFETY_ENABLED=false          # Set to true to enable
FOOD_SAFETY_TEST_MODE=true        # Always true until test chat passes

# Google Sheet (optional — hardcoded fallback rules are embedded)
FOOD_SAFETY_SHEET_URL=https://docs.google.com/spreadsheets/d/12J9CRkTpDJ4boKClVaz0qiev9KV7dEyr-TK4KA1ugJs/edit?gid=195905283#gid=195905283

# Comma-separated WhatsApp chat IDs allowed to send images
FOOD_SAFETY_ALLOWED_CHAT_IDS=

# Reply mode:
#   warning_only  — only warn on FAIL/NEEDS_REVIEW (default)
#   always_reply — also reply PASS confirmation to group
FOOD_SAFETY_REPLY_MODE=warning_only

# Vision API (required for real OCR — safe fallback returns NEEDS_REVIEW without it)
VISION_API_URL=
VISION_API_KEY=
VISION_MODEL=gpt-4o
```

---

## Google Sheet Format

| Category | Item | Operator | Target | Unit | Corrective Action |
|---|---|---|---|---|---|
| Walk-in Cooler | Walk-in Cooler | <= | 40 | F | Close door, re-temp in 10 min, alert MOD if still high. |
| Hot Holding | Fryer 1 | >= | 325 | F | Check oil quality. Do not use until temp is 325°F. |
| Hot Holding | Pork Broth | >= | 200 | F | Reheat to 200°F. Discard if below 140°F for >2hrs. |

The sheet is fetched via CSV export (`/export?format=csv&gid=...`). Results are cached to `data/food-safety-rules.json` with a 10-minute TTL. If fetch fails, the last cached version (or embedded hardcoded defaults) is used.

For the current Bakudan sheet sharing URL, the app reads the `Thresholds_SOP` tab via Google Sheets CSV (`gviz`) export. Configure a different tab with `FOOD_SAFETY_RULE_SHEET_NAME` if the rules tab changes.

Common labels from the submitted board photos are normalized before threshold checks. For example, `FREEZER - PHOTO` maps to `Walk-in Freezer`, `FRYER - LEFT` maps to `Fryer 1`, and `BOILER - LEFT` maps to `Pasta Boiler 1`.

---

## Thresholds

### Cold Storage (must be <=)
| Item | Target |
|---|---|
| Walk-in Cooler | <= 40°F |
| Walk-in Freezer | <= 0°F |
| Prep Area Cooler | <= 40°F |
| Ramen Refrigeration Top | <= 40°F |
| Ramen Refrigeration Below | <= 40°F |
| Line Freezer | <= 0°F |
| Tapas Refrigeration Top | <= 40°F |
| Tapas Refrigeration Below | <= 40°F |
| Chicken Chashu | <= 40°F |

### Hot Holding (must be >=)
| Item | Target |
|---|---|
| Bowl Warmers | >= 100°F |
| Pork Chashu | >= 100°F |
| Seasoned Eggs | >= 100°F |
| Fryer 1 | >= 325°F |
| Fryer 2 | >= 325°F |
| Pasta Boiler 1 | >= 200°F |
| Pasta Boiler 2 | >= 200°F |
| Pork Broth | >= 200°F |
| Chicken Broth | >= 200°F |
| Veggie Broth | >= 200°F |

---

## Result Types

### PASS
No violations detected. No group warning sent (unless `FOOD_SAFETY_REPLY_MODE=always_reply`). Logged to SQLite.

### FAIL
One or more threshold violations detected. Warning sent to WhatsApp group immediately:

```
⚠️ FOOD SAFETY WARNING
Store: Bandera Road
Item: Walk-in Cooler
Reading: 44°F
Target: <= 40°F
Action: Close door, re-temp in 10 min, alert MOD if still high.

Please re-temp and confirm.
```

### NEEDS_REVIEW
One or more readings are unclear or cannot be matched to a known item. Warning sent to group:

```
⚠️ NEEDS REVIEW
Store: Medical Center

The image was received, but some readings were unclear.
Please retake the photo or manually confirm:
• Walk-in Cooler
• Fryer 1

If the problem persists, please contact your manager.
```

---

## Storage

SQLite tables created automatically:

```sql
food_safety_checks     -- one row per image received
food_safety_readings   -- one row per extracted reading
food_safety_warnings   -- one row per warning sent
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/food-safety/status` | Module config and sheet sync status |
| GET | `/api/food-safety/checks?limit=20` | Recent checks with readings |
| GET | `/api/food-safety/stats` | PASS/FAIL/REVIEW counts and last warning |
| GET | `/health` | Health check includes `food_safety_enabled` field |

---

## Dashboard

When `FOOD_SAFETY_ENABLED=true`, the dashboard shows a **Food Safety Checks** section above the Conversations tab with:
- PASS / FAIL / REVIEW counts
- Last image received (store, time, result, link)
- Latest readings table
- Latest warning sent
- Configuration summary

---

## Image Storage

Images are saved to:
```
data/uploads/food-safety/YYYY-MM-DD/{timestamp}-{messageId}.jpg
data/uploads/food-safety/YYYY-MM-DD/{timestamp}-{messageId}.meta.json
```

---

## Module Files

| File | Purpose |
|---|---|
| `src/food-safety/sheet-source.js` | Google Sheet fetch, parse, cache |
| `src/food-safety/threshold-engine.js` | Compare readings vs thresholds |
| `src/food-safety/image-analyzer.js` | Vision API call + fallback |
| `src/food-safety/warning-generator.js` | Generate FAIL/NEEDS_REVIEW messages |
| `src/food-safety/food-safety-pipeline.js` | Orchestrate full pipeline |
| `src/storage/food-safety-storage.js` | SQLite persistence |

---

## Running Tests

```bash
# Full unit tests (existing suite + food-safety suite)
npm test

# Food safety tests only
node tests/food-safety-tests.js

# Live validator (no Telegram)
node tests/live/live-validator.js --no-telegram

# Package validation
.\pack.ps1
```
