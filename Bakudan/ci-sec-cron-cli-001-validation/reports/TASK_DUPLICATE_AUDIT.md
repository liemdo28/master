# Task Duplicate Audit
**P0 Emergency | Audit Date: 2026-06-12**

## Verdict: ⚠️ FAIL — 102 Duplicate Tasks Found

| Metric | Value |
|--------|-------|
| Total active tasks | 1,670 |
| Duplicate groups | 97 |
| Tasks to archive | 102 |
| Post-cleanup estimate | 1,568 tasks |
| Detection method | title + store_id + due_date + assignee |

---

## Root Cause Pattern

**Two distinct Asana sync import batches created duplicate tasks:**

### Batch A — IDs 18xxx (primary source, ~73 duplicates)
The Asana sync job ran without a deduplication guard and re-imported tasks that already existed in the system (original IDs #106–8369). All created duplicate IDs in the 18xxx range.

Pattern: `canonical_id` ∈ {106, 122, 220, 515, 558, 654, 752, 1370, 1517...} → duplicate in {18226, 18233, 18250...}

### Batch B — IDs 20xxx (secondary source, ~29 duplicates)
A subsequent Asana sync run created additional duplicates. Tasks #18786, #18787, #18788, etc. were re-imported as #20188, #20198, #20199, etc.

### Pattern: 4× overduplicated tasks (#18788)
Task "Confirm all three Bakudan locations have the new menu" has **4 extra copies** (IDs 20198, 20201, 20202, 20205), suggesting the sync job ran 5 times on this particular task.

---

## Duplicate Groups — Full List

| Keep | Archive Count | Archive IDs | Title |
|------|--------------|-------------|-------|
| #18788 | 4 | 20198,20201,20202,20205 | Confirm all three Bakudan locations have the new menu |
| #20017 | 2 | 20186,20187 | Follow up on Discover Merchant Class Action Settlement |
| #20023 | 2 | 20054,20194 | Draft promissory note and deed of trust for Louise Street |
| #106 | 1 | 18226 | Pay Packinglist - B123 |
| #122 | 1 | 18233 | Pay HEO Creditcard - B123 |
| #220 | 1 | 18250 | Update Packing List |
| #515 | 1 | 18257 | JHT - Payroll Tax file/EmployeeTip |
| #558 | 1 | 18264 | Stockton - Pay Waste |
| #654 | 1 | 18278 | JHT - Update Withdraw Payroll |
| #655 | 1 | 18279 | JHT - Update Withdraw Payroll |
| #752 | 1 | 18294 | Cal Saver - Double check Raw Payroll |
| #753 | 1 | 18295 | Cal Saver - Double check Raw Payroll |
| #1370–1373 | 1 each | 18323–18326 | JHT - Labor Comparesion |
| #1517–1520 | 1 each | 18354–18357 | B3 - Labor Comparesion |
| #1678–1681 | 1 each | 18385–18388 | B2 - Labor Comparesion |
| #1738 | 1 | 18395 | Stockton - Sale Report |
| #1822 | 1 | 18407 | Report - Raw Stockton |
| #1873 | 1 | 18414 | Report - BackYard |
| #1924 | 1 | 18421 | Report - Domain |
| #2047 | 1 | 18436 | JHT - Pay Gas and Electric |
| #2281–2284 | 1 each | 18464–18467 | Stockton - Labor Tracking |
| #2575–2576 | 1 each | 18481–18482 | JHT - Payroll - Double Check Tip |
| #3604–3607 | 1 each | 18510–18513 | JHT - Send Weekly Report to David |
| #4448–4451 | 1 each | 18542–18545 | Stockton - 3rd partners weekly |
| #4745–4748 | 1 each | 18573–18576 | JHT - 3rd partners weekly |
| #5691 | 1 | 18589 | Stockton - Prepayment - Sale and Use Tax |
| #5985–5988 | 1 each | 18616–18619 | Weekly Report |
| #6058 | 1 | 18626 | B1- Sale Tax/ Mixed Beverage Tax |
| #6105 | 1 | 18633 | B2 - Sale Tax/ Mixed Beverage Tax |
| #6144 | 1 | 18640 | B3 - Sale Tax |
| #6892–6893 | 1 each | 18654–18655 | Stockton - Payroll - Liem |
| #7535 | 1 | 18664 | AirBnb - Report |
| #7584 | 1 | 18671 | Sunright - Tip Table |
| #7626 | 1 | 18678 | Coppers - Follow Up File Sale Tax |
| #7706–7711 | 1 each | 18693–18698 | Bakudan 2 & 3 - CPS Energy |
| #7762 | 1 | 18707 | Lowry & Associates, Inc. |
| #7831 | 1 | 18710 | Fill De9, De9C and 941 Form - QB |
| #7837 | 1 | 18711 | Fill Annually Form |
| #7951 | 1 | 18718 | Credit Card - Schedule to pay |
| #8020 | 1 | 18725 | Stockton - Pay Water |
| #8184 | 1 | 18740 | Stockton - PGE |
| #8208 | 1 | 18747 | Stockton - PGE |
| #8239 | 1 | 18750 | Raw Venture - Fill Tax |
| #8282 | 1 | 18762 | Stockton - Prepayment Tax |
| #8369 | 1 | 18778 | IFT - Fill and Pay Tax |
| #18186–18193 | 1 each | 20189–20197 | Various (Roth, K1s, Uber) |
| #18210 | 1 | 18211 | Pay HEO CC 2025 |
| #18784–18797 | 1 each | 20196–20205 | Recent Asana batch (DoorDash, Toast, etc.) |
| #18881 | 1 | 20191 | Research and execute mega backdoor Roth |
| #18930 | 1 | 18932 | Confirm transactional funding for Myra |
| #19526 | 1 | 19538 | Classify expenses - IFT |
| #19806 | 1 | 19807 | transfer money |
| #20025 | 1 | 20051 | Increase umbrella insurance to $2M with AAA |
| #20027 | 1 | 20193 | Evaluate hard money deal |
| #20048 | 1 | 20192 | Follow up with Clint (Utah) |
| #20066 | 1 | 20195 | Verify transactional funding for Myra |
| #20083 | 1 | 20206 | Reach out to Amex re Marriott Bonvoy |
| #20169 | 1 | 20185 | Pay HEO CC 2025 |
| #20208 | 1 | 20209 | PHASE F ASSIGNMENT TEST |

---

## CEO Directive Compliance
- ✅ No auto-delete — archive only
- ✅ Human review required
- ⏳ PENDING: Admin review and archive at `/admin/tasks` or equivalent
