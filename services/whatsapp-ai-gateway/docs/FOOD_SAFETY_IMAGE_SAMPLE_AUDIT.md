# Food Safety Image Sample Audit

## Source

Google Sheet:

```text
https://docs.google.com/spreadsheets/d/12J9CRkTpDJ4boKClVaz0qiev9KV7dEyr-TK4KA1ugJs/edit?usp=sharing
```

Validated tabs:

```text
Thresholds_SOP
Extracted_Data
Daily_Entry_Template
```

`Thresholds_SOP` exports correctly as CSV and provides 19 active threshold rules.

## Image Templates Observed

The submitted photos include at least three form layouts:

- Bandera Road weekly AM line-check board
- Older Bakudan daily line-check board
- Stone Oak line-check board

The OCR/threshold layer now accepts the row labels used by these photos, including:

```text
FREEZER - PHOTO -> Walk-in Freezer
FREEZER - LINE -> Line Freezer
RAMEN - TOP -> Ramen Refrigeration Top
RAMEN - BELOW -> Ramen Refrigeration Below
TAPAS - TOP -> Tapas Refrigeration Top
TAPAS - BELOW -> Tapas Refrigeration Below
FRYER - LEFT -> Fryer 1
FRYER - RIGHT -> Fryer 2
BOILER - LEFT -> Pasta Boiler 1
BOILER - RIGHT -> Pasta Boiler 2
PORK SOUP BROTH -> Pork Broth
CHICKEN SOUP BROTH -> Chicken Broth
```

## Critical Readings From Sheet

The public sheet's dashboard flags these sample-image readings for review:

| Store | Date/Time | Item | Reading | Target | Status |
|---|---|---|---:|---|---|
| Bandera Road | Tue AM | Walk-in Cooler | 44 | <= 40F | FAIL |
| Bandera Road | Thu AM | Walk-in Cooler | 42 | <= 40F | FAIL |
| Bandera Road | Sat AM | Walk-in Cooler | 44 | <= 40F | FAIL |
| Bandera Road | Sun AM | Walk-in Cooler | 45 | <= 40F | FAIL |
| Bandera Road | Sun AM | Tapas Refrigeration Top | 50 | <= 40F | FAIL |
| Bakudan - Location not specified | 2026-05-31 10:45 AM | Chicken Chashu | 45 | <= 40F | FAIL |
| Stone Oak | 2026-05-27 11:00 AM | Ramen Refrigeration Top | 41 | <= 40F | FAIL |

## Build Update

The app now reads `Thresholds_SOP` from the sharing URL by default:

```text
FOOD_SAFETY_SHEET_URL=https://docs.google.com/spreadsheets/d/12J9CRkTpDJ4boKClVaz0qiev9KV7dEyr-TK4KA1ugJs/edit?usp=sharing
FOOD_SAFETY_RULE_SHEET_NAME=Thresholds_SOP
```

Test mode remains enabled. With an empty `FOOD_SAFETY_ALLOWED_CHAT_IDS`, image processing is blocked until a separate test chat/group ID is added.
