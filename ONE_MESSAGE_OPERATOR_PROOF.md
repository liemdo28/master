# ONE_MESSAGE_OPERATOR_PROOF.md

## CEO Directive: SOURCE_TRUTH_STABILITY_CERTIFICATION

## PHASE 3 — ONE MESSAGE OPERATOR TEST

**Classification:** CEO EYES ONLY — OPERATIONAL CERTIFICATION

**Test Status:** 🔴 NOT STARTED — REQUIRES CEO COOPERATION

**CEO Test Message:**
> "Kiểm tra Dashboard, QB, Payroll, tạo SEO Raw rồi gửi Maria."

**Target:** All 5 intents executed, evidence verified, finance truth enforced, approvals only where needed, image evidence attached

---

## Purpose

Phase 3 is the **ultimate integration test** — a single CEO message containing 5 distinct operational intents, each requiring different capabilities:

1. **Dashboard Check** → Data analyst, dashboard connector
2. **QB (QuickBooks) Check** → Finance connector, QB heartbeat
3. **Payroll Check** → Payroll connector, HR data
4. **SEO Raw Creation** → Drive/Asana action, content generation
5. **Send to Maria** → Communication, recipient verification

This message is the CEO's **perfect storm test** — every capability at once, every gate tested, every source questioned.

---

## Intent Breakdown

### Intent 1: Dashboard Check

| Attribute | Value |
|-----------|-------|
| Intent | `dashboard_status` |
| Action | Query Dashboard connector, retrieve current KPIs |
| Evidence Required | Screenshot of Dashboard or API response JSON |
| Finance Related | No |
| Approval Required | No |
| Data Source | Dashboard connector (Google Sheets/API) |
| Deadline | Immediate |

**Success Criteria:**
- [ ] Dashboard queried
- [ ] Real data returned (not fabricated)
- [ ] Evidence screenshot attached OR API response included
- [ ] Response time < 30 seconds

**Verification:**
```
Dashboard Check: [PASS/FAIL]
Evidence: [screenshot or JSON]
Data Matches Source: [YES/NO - compare with actual Google Sheets]
Response Time: [seconds]
```

### Intent 2: QB (QuickBooks) Check

| Attribute | Value |
|-----------|-------|
| Intent | `quickbooks_status` |
| Action | Query QB connector, verify financial data freshness |
| Evidence Required | QB screenshot or API response |
| Finance Related | YES — Financial data |
| Approval Required | No (read-only) |
| Data Source | QuickBooks connector |
| Deadline | Immediate |

**Success Criteria:**
- [ ] QB connector queried
- [ ] Health status reported (healthy/degraded/stale)
- [ ] Last successful sync timestamp included
- [ ] Evidence screenshot or API response attached
- [ ] If stale → Finance Truth Lock response with "QB data is X hours stale"

**Verification:**
```
QB Check: [PASS/FAIL]
Connector Health: [healthy/degraded/stale]
Last Sync: [timestamp]
Evidence: [screenshot or JSON]
Finance Truth Lock Active: [YES/NO]
Data Matches Source: [YES/NO]
Response Time: [seconds]
```

### Intent 3: Payroll Check

| Attribute | Value |
|-----------|-------|
| Intent | `payroll_status` |
| Action | Query payroll data (likely Google Sheets or QB Payroll) |
| Evidence Required | Payroll screenshot or data export |
| Finance Related | YES — Payroll data |
| Approval Required | No (read-only status) |
| Data Source | Payroll sheet, QB Payroll, or HR connector |
| Deadline | Immediate |

**Success Criteria:**
- [ ] Payroll data queried
- [ ] Current payroll period identified
- [ ] Status reported (pending/completed/failed)
- [ ] Evidence attached
- [ ] If no data → "Payroll data unavailable" honest response

**Verification:**
```
Payroll Check: [PASS/FAIL]
Current Period: [date range]
Status: [pending/completed/unavailable]
Evidence: [screenshot or data]
Finance Truth Enforced: [YES/NO]
Response Time: [seconds]
```

### Intent 4: SEO Raw Creation

| Attribute | Value |
|-----------|-------|
| Intent | `create_seo_content` |
| Action | Generate SEO content for "Raw" (Raw Sushi Bar) |
| Evidence Required | Drive file created OR Asana task created |
| Finance Related | No |
| Approval Required | YES — if action creates external artifact |
| Data Source | Drive connector, Asana connector, content generation |
| Deadline | Non-urgent but must be done |

**Success Criteria:**
- [ ] Content generated for Raw Sushi Bar
- [ ] SEO-optimized (title, meta, keywords, structure)
- [ ] Saved to Drive (folder: /Raw Sushi/SEO/)
- [ ] OR created as Asana task for follow-up
- [ ] Evidence: File link or task ID attached

**Verification:**
```
SEO Raw Creation: [PASS/FAIL]
Content Generated: [YES/NO]
Location: [Drive folder / Asana]
File Link / Task ID: [URL/ID]
Evidence Attached: [YES/NO]
Approval Required: [YES/NO]
Approval Given: [YES/N/A]
Response Time: [seconds]
```

### Intent 5: Send to Maria

| Attribute | Value |
|-----------|-------|
| Intent | `send_to_recipient` |
| Action | Send results/evidence to Maria via WhatsApp or email |
| Evidence Required | Delivery confirmation |
| Finance Related | Depends on content sent |
| Approval Required | YES — if sending external communication |
| Recipient | Maria (verify contact exists) |
| Deadline | After other tasks complete |

**Success Criteria:**
- [ ] Maria's contact verified in system
- [ ] Message composed with all findings
- [ ] Evidence (screenshots) attached
- [ ] Sent via appropriate channel (WhatsApp/Email)
- [ ] Confirmation received

**Verification:**
```
Send to Maria: [PASS/FAIL]
Recipient Verified: [YES/NO]
Channel: [WhatsApp/Email]
Message Composed: [YES/partial]
Evidence Included: [YES/NO]
Delivery Confirmed: [YES/NO]
Approval Required: [YES/NO]
Approval Given: [YES/N/A]
Response Time: [seconds]
```

---

## Complete Execution Flow

```
CEO: "Kiểm tra Dashboard, QB, Payroll, tạo SEO Raw rồi gửi Maria."

System Pipeline:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: INTENT PARSING
  → Intent 1: dashboard_status ✓ detected
  → Intent 2: quickbooks_status ✓ detected
  → Intent 3: payroll_status ✓ detected
  → Intent 4: create_seo_content ✓ detected
  → Intent 5: send_to_recipient ✓ detected
  → Total: 5/5 intents detected

Step 2: SOURCE TRUTH VALIDATION (per intent)
  → Dashboard: Source = Google Sheets ✓
  → QB: Source = QuickBooks API ✓
  → Payroll: Source = Payroll Sheet/QB ✓
  → SEO: Source = Generation Engine ✓
  → Maria: Source = Contact List ✓

Step 3: FINANCE TRUTH LOCK (per intent)
  → Intent 1 (Dashboard): Non-finance → proceed
  → Intent 2 (QB): FINANCE DATA → Finance Truth Lock ACTIVE
    - Check QB connector health
    - Check last sync timestamp
    - If stale → hard block with honest response
    - If healthy → proceed with evidence
  → Intent 3 (Payroll): FINANCE DATA → Finance Truth Lock ACTIVE
    - Same checks as QB
  → Intent 4 (SEO): Non-finance → proceed
  → Intent 5 (Send): Depends on content → evaluate per item

Step 4: APPROVAL GATE (per intent)
  → Intent 1: Read-only → no approval needed
  → Intent 2: Read-only → no approval needed
  → Intent 3: Read-only → no approval needed
  → Intent 4: Creates artifact → APPROVAL REQUIRED
    - Wait for approval before creating
  → Intent 5: External communication → APPROVAL REQUIRED
    - Wait for approval before sending

Step 5: EXECUTION
  → Intent 1: Execute Dashboard query
  → Intent 2: Execute QB query
  → Intent 3: Execute Payroll query
  → Intent 4: Await approval... [APPROVED] → Execute SEO creation
  → Intent 5: Await approval... [APPROVED] → Execute send to Maria

Step 6: EVIDENCE COLLECTION
  → Intent 1: Dashboard screenshot → ✓ attached
  → Intent 2: QB screenshot/JSON → ✓ attached
  → Intent 3: Payroll screenshot/data → ✓ attached
  → Intent 4: Drive link / Asana task → ✓ attached
  → Intent 5: Delivery confirmation → ✓ attached

Step 7: RESPONSE TO CEO
  → Summary of all 5 tasks
  → Evidence links for each
  → Finance data marked with source verification
  → Approval confirmation for intents 4 & 5

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Evidence Requirements

For Phase 3 certification, ALL of the following must be present:

### Dashboard Evidence
```
Type: Screenshot or API Response JSON
Content: Current KPIs, date, data source verified
Source Match: YES (matches actual Google Sheets)
```

### QB Evidence
```
Type: Screenshot or API Response JSON
Content: Financial data with timestamp, QB company verified
Source Match: YES (matches actual QB data)
Finance Truth Lock Applied: YES
Stale Warning (if applicable): YES/NO
```

### Payroll Evidence
```
Type: Screenshot or Data Export
Content: Current payroll period, status, amounts
Source Match: YES (matches actual payroll