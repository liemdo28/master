# Google Sheet Column Mapping — Food Safety Line Check

Each scanned form row writes **one row per temperature item** to the Google Sheet.

| Col | Field              | Example Value                      | Notes                                |
|-----|--------------------|------------------------------------|--------------------------------------|
| A   | Submission Time    | 2026-06-09T17:23:45Z               | ISO 8601 UTC                         |
| B   | Store              | Stone Oak                          | From store_id mapping                |
| C   | Date               | 06/09/2026                         | From form header                     |
| D   | Shift              | PM                                 | AM or PM                             |
| E   | Employee           | Maria G.                           | From form header                     |
| F   | Field ID           | SO-04                              | Stable identifier per row            |
| G   | Item Name          | Ramen Refrig Below                 | From OCR map field_map               |
| H   | Required Range     | 40F_or_below                       | From OCR map field_map               |
| I   | 11:00 AM Value     | 41                                 | Handwritten temperature              |
| J   | 4:00 PM Value      | 38                                 | Handwritten temperature              |
| K   | OCR Confidence     | 0.94                               | Average of AM + PM zone confidence   |
| L   | Status             | FAIL                               | PASS / FAIL / NEEDS_REVIEW           |
| M   | Corrective Action  | SO-04 AM above 40F — moved items   | From notes column on form            |
| N   | Original Form Image| https://...SO-20260609-PM.jpg      | WhatsApp media URL                   |

## Tab Structure

| Tab Name        | Content                                      |
|-----------------|----------------------------------------------|
| Stone_Oak_Log   | All Stone Oak line check submissions         |
| Rim_Log         | All Rim line check submissions               |
| Bandera_Log     | All Bandera line check submissions           |
| Manager_Summary | Daily roll-up: store × shift × pass/fail     |
| Audit_Trail     | Edit history with pre/post values            |

## Status Values

| Status       | Condition                                              |
|--------------|--------------------------------------------------------|
| PASS         | All temperature values within required range           |
| FAIL         | One or more values out of range (corrective required)  |
| NEEDS_REVIEW | OCR confidence below 0.8 on one or more fields         |
| PENDING      | Sheet write queued, not yet confirmed                  |
