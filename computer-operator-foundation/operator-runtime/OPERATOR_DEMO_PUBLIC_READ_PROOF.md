# OPERATOR_DEMO_PUBLIC_READ_PROOF

## Status
**PASSED** — Public read against https://example.com executed successfully.

## Target
`https://example.com`

## Execution Summary
- **Run ID:** run-410d1c9d1563
- **Task ID:** task-844dc9650040 (re-run)
- **Status:** COMPLETED
- **Duration:** 3532 ms
- **Actions:** 5 (navigate, read_title, extract_links, screenshot, done)
- **Evidence IDs:** ev-186de944ef, ev-296708aecf, ev-d994c07435

## Required Evidence

### 1. Screenshot
- **Path:** `evidence/demo1_public_read.png`
- **Type:** Full-page PNG

### 2. Execution Log
- **Path:** `evidence/demo1_public_read_log.json`
- **Actions:** navigate, read_title, extract_links, screenshot

### 3. HTML Title
- **Title:** `Example Domain`

### 4. Links Extracted
- **Count:** 1
- **Link:** https://www.iana.org/domains/example (text: "More information...")

### 5. Duration
- **3.532 seconds**

### 6. HTML Snapshot
- **Path:** `evidence/demo1_public_read.html`

## Policy Decision
- **Classification:** SAFE
- **Status:** APPROVED
- **Approval Level:** READ_ONLY

## Conclusion
Demo 1 confirms browser control, title reading, link extraction, screenshot capture, and evidence registration. Phase B complete.
