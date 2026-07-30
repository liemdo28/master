# DUPLICATE CLEANUP PLAN
**P0 Emergency | Updated: 2026-06-12 | Source: CLI Production DB Audit**
_Supersedes 2026-06-10 draft — full audit found 307 bill duplicates (not 56) and 102 task duplicates_

**Summary:** 20 bill duplicate groups · 97 task duplicate groups · 307 bill duplicates · 102 task duplicates

> ⚠️ DO NOT auto-delete. DO NOT auto-merge. Human review required for every group.
> CEO Directive: Archive → Verify → then Purge. Never hard-delete first.

---

---

## P0 UPDATE — Full CLI Audit Findings (2026-06-12)

The previous scan (2026-06-10) only detected 8 bill groups (IDs 187–250, June batch).
The full CLI audit reveals **20 groups spanning three batches**:

| Batch | Groups | Bills to Archive | Root Cause |
|-------|--------|-----------------|------------|
| May (IDs 22–186) | 6 | 159 | Recurrence engine ran ~29× |
| June (IDs 187–279) | 8 | 142 | Recurrence engine ran ~21× |
| July (IDs 280–348) | 6 | 6 | Recurrence engine ran 2× |
| **Total** | **20** | **307** | No dedup guard |

All canonical bills currently have `amount = $0.00` — amounts must be assigned after cleanup.

---

## BILL DUPLICATE GROUPS (20 groups)

### MAY BATCH (IDs 22–186) — Recurrence engine ran 29×

All 8 bill groups follow the same pattern: **same bill created 8 times in a single bulk import**.
Root cause: a compliance bill import ran with multiplier=8 instead of multiplier=1.
Recommendation: Archive IDs 2–8 in each group. Keep lowest ID (canonical).

---

#### May — BILL-M1 — "Heo Holding Sale Tax"
| Keep | #22 | Archive | 28,34,40,46,52,58,64,70,76,82,88,94,100,106,112,118,124,130,136,142,148,154,160,175,181 |
|------|-----|---------|---|
| Store | Heo Holding | Amount | $0.00 (set real amount after cleanup) |
| Root cause | Recurrence engine ran 25× without dedup guard | Confidence | 99% |

#### May — BILL-M2 — "IFT Sale Tax"
| Keep | #23 | Archive | 29,35,41,47,53,59,65,71,77,83,89,95,101,107,113,119,125,131,137,143,149,155,161,176,182 |
|------|-----|---------|---|
| Store | IFT | Amount | $0.00 |

#### May — BILL-M3 — "Amtrust"
| Keep | #24 | Archive | 30,36,42,48,54,60,66,72,78,84,90,96,102,108,114,120,126,132,138,144,150,156,162,177,183 |
|------|-----|---------|---|
| Store | Modesto | Vendor | Amtrust (Workers Comp) |

#### May — BILL-M4 — "Raw Sale Tax"
| Keep | #25 | Archive | 31,37,43,49,55,61,67,73,79,85,91,97,103,109,115,121,127,133,139,145,151,157,163,166,169,172,178,184 |
|------|-----|---------|---|
| Store | Raw Stockton | Vendor | CA CDTFA |

#### May — BILL-M5 — "Raw QB Tax"
| Keep | #26 | Archive | 32,38,44,50,56,62,68,74,80,86,92,98,104,110,116,122,128,134,140,146,152,158,164,167,170,173,179,185 |
|------|-----|---------|---|
| Store | Raw Stockton | Vendor | QuickBooks |

#### May — BILL-M6 — "Raw PGE"
| Keep | #27 | Archive | 33,39,45,51,57,63,69,75,81,87,93,99,105,111,117,123,129,135,141,147,153,159,165,168,171,174,180,186 |
|------|-----|---------|---|
| Store | Raw Stockton | Vendor | PG&E |

---

### JUNE BATCH (IDs 187–279) — Recurrence engine ran ~21×

### BILL-001 — "Heo Holding Sale Tax"
| Field | Value |
|-------|-------|
| Group ID | 1 |
| Hash | `9bde4e011743186c7969eefa2d17ae0d` |
| Match reason | title + store_id + due_date + amount + vendor all identical |
| Store | store_id=12 (Heo Holding) |
| Vendor | CA CDTFA |
| Due date | 2026-06-20 |
| Amount | NULL (not set) |
| Status | all pending |

**IDs in group:** 187, 195, 203, 211, 219, 227, 235, 243

| ID | Role | Action |
|----|------|--------|
| 187 | **CANONICAL — KEEP** | No action |
| 195 | Duplicate | Archive |
| 203 | Duplicate | Archive |
| 211 | Duplicate | Archive |
| 219 | Duplicate | Archive |
| 227 | Duplicate | Archive |
| 235 | Duplicate | Archive |
| 243 | Duplicate | Archive |

**Human review required:** Confirm amount on ID 187 is correct before archiving others.

---

### BILL-002 — "IFT Sale Tax"
| Field | Value |
|-------|-------|
| Group ID | 2 |
| Hash | `1cc73c8b940dcc24620d6f50b71ec526` |
| Match reason | title + store_id + due_date + amount + vendor all identical |
| Store | store_id=8 (IFT) |
| Vendor | CA CDTFA |
| Due date | 2026-06-20 |

**IDs in group:** 188, 196, 204, 212, 220, 228, 236, 244

| ID | Role | Action |
|----|------|--------|
| 188 | **CANONICAL — KEEP** | No action |
| 196–244 | Duplicates (7) | Archive |

**Human review required:** Confirm ID 188 has correct amount.

---

### BILL-003 — "Amtrust"
| Field | Value |
|-------|-------|
| Group ID | 3 |
| Hash | `31f3aa726b30e8de07024dc03b89a23c` |
| Match reason | title + store_id + due_date + vendor all identical |
| Store | store_id=11 |
| Vendor | Amtrust |
| Due date | 2026-06-23 |

**IDs in group:** 189, 197, 205, 213, 221, 229, 237, 245

| ID | Role | Action |
|----|------|--------|
| 189 | **CANONICAL — KEEP** | No action |
| 197–245 | Duplicates (7) | Archive |

**Human review required:** Amtrust = Workers Comp insurance. Confirm this is monthly/annual, not per-store.

---

### BILL-004 — "Raw General"
| Field | Value |
|-------|-------|
| Group ID | 4 |
| Hash | `987269e6525a1213c310c0f0c3d5cc7a` |
| Match reason | title + store_id + due_date identical |
| Store | store_id=2 (Raw Stockton) |
| Vendor | (none) |
| Due date | 2026-06-01 |

**IDs in group:** 190, 198, 206, 214, 222, 230, 238, 246

| ID | Role | Action |
|----|------|--------|
| 190 | **CANONICAL — KEEP** | No action |
| 198–246 | Duplicates (7) | Archive |

**Human review required:** "Raw General" — unclear category. Confirm what this bill is for before archiving.

---

### BILL-005 — "Raw Sale Tax"
| Field | Value |
|-------|-------|
| Group ID | 5 |
| Hash | `61f155929afcdf819adad135b6fcb8e6` |
| Match reason | title + store_id + due_date + vendor identical |
| Store | store_id=2 (Raw Stockton) |
| Vendor | CA CDTFA |
| Due date | 2026-06-20 |

**IDs in group:** 191, 199, 207, 215, 223, 231, 239, 247

| ID | Role | Action |
|----|------|--------|
| 191 | **CANONICAL — KEEP** | No action |
| 199–247 | Duplicates (7) | Archive |

**Human review required:** Verify CA CDTFA tax amount is set on ID 191.

---

### BILL-006 — "Stockton - Prepayment"
| Field | Value |
|-------|-------|
| Group ID | 6 |
| Hash | `909754ccad120527cd9d6f47a1068013` |
| Match reason | title + store_id + due_date identical |
| Store | store_id=2 (Raw Stockton) |
| Vendor | (none) |
| Due date | 2026-06-01 |

**IDs in group:** 192, 200, 208, 216, 224, 232, 240, 248

| ID | Role | Action |
|----|------|--------|
| 192 | **CANONICAL — KEEP** | No action |
| 200–248 | Duplicates (7) | Archive |

**Human review required:** Prepayment — is this a recurring monthly or one-time? Confirm before archiving.

---

### BILL-007 — "Raw QB Tax"
| Field | Value |
|-------|-------|
| Group ID | 7 |
| Hash | `01dc5d87d8b65d585c8aac95140cd965` |
| Match reason | title + store_id + due_date + vendor identical |
| Store | store_id=2 (Raw Stockton) |
| Vendor | QuickBooks |
| Due date | 2026-06-20 |

**IDs in group:** 193, 201, 209, 217, 225, 233, 241, 249

| ID | Role | Action |
|----|------|--------|
| 193 | **CANONICAL — KEEP** | No action |
| 201–249 | Duplicates (7) | Archive |

**Human review required:** QuickBooks payroll tax — confirm amount and frequency on canonical ID 193.

---

### BILL-008 — "Raw PGE"
| Field | Value |
|-------|-------|
| Group ID | 8 |
| Hash | `ac931bbfaff553cab4a68c28731bc1a9` |
| Match reason | title + store_id + due_date + vendor identical |
| Store | store_id=2 (Raw Stockton) |
| Vendor | PG&E |
| Due date | 2026-06-20 |

**IDs in group:** 194, 202, 210, 218, 226, 234, 242, 250

| ID | Role | Action |
|----|------|--------|
| 194 | **CANONICAL — KEEP** | No action |
| 202–250 | Duplicates (7) | Archive |

**Human review required:** PG&E utility bill — confirm amount on ID 194.

---

## TASK DUPLICATE GROUPS (18 groups)

> Task data pending — scanner found 18 groups with 76 items (104 total - 28 bill items = 76 task items).
> Full task group details available at `/admin/duplicates` on the preview dashboard.

**Pattern observed:** Tasks with identical title + assignee + due_date across stores are flagged.
Likely cause: batch task creation for multi-store compliance/payroll schedules.

**Recommended action for all task groups:**
1. Open `/admin/duplicates` on preview dashboard
2. For each group: verify if tasks are truly identical or legitimately different stores
3. If truly identical: Archive duplicate, keep canonical (lowest ID)
4. If different stores: click "Not Duplicate" to resolve

---

## ROOT CAUSE ANALYSIS

All 8 bill groups are **8 copies of the same bill** created in a single bulk operation.
IDs are sequential in batches: 187–194 (set 1), 195–202 (set 2), ..., 243–250 (set 8).

This is consistent with a compliance import that ran 8 iterations for 8 compliance categories
but created the same bill for each iteration instead of one bill per unique combination.

**The bulk paid cleanup on 2026-05-30 already marked 176 bills as paid** — those are NOT in
the duplicate groups (they were cleaned separately). The 8 groups above are all in `pending`
status and date to June 2026, suggesting they were created in the most recent import cycle.

---

## CLEANUP EXECUTION PLAN

### Phase 1 — Bill Duplicates (8 groups × 7 archives = 56 bills to archive)
- Use `/admin/duplicates` UI → Archive for each non-canonical bill
- OR: CEO approves batch archive script targeting IDs 195–250 excluding canonicals 187–194

### Phase 2 — Task Duplicates (18 groups, review required)
- Manual review at `/admin/duplicates` — each group needs human judgement
- Do NOT auto-archive tasks without human review

### Phase 3 — Prevention
- DailyDuplicateTaskBillScanner is now active — catches new duplicates within 24h
- Duplicate modal on bill/task creation prevents future imports from creating duplicates
- Admin must resolve pending groups before scanner count accumulates

---

## APPROVAL GATE

- [ ] CEO reviews BILL-001 through BILL-008 canonical records
- [ ] CEO approves archive of duplicate IDs (or requests individual review)
- [ ] Task groups reviewed at `/admin/duplicates`
- [ ] All groups resolved (status = resolved or ignored, not pending)
- [ ] Duplicate cleanup complete confirmed by re-running scanner

**Status: PENDING CEO REVIEW — DO NOT AUTO-DELETE — DO NOT AUTO-MERGE**

---

## JULY BATCH (IDs 280–348) — Recurrence engine ran 2×

#### BILL-J1 through BILL-J6
| Keep | Archive | Title | Store |
|------|---------|-------|-------|
| #280 | 286 | TEST DUPLICATE BILL | Raw Stockton |
| #281 | 287 | Raw General | Raw Stockton |
| #282 | 288 | Raw Sale Tax | Raw Stockton |
| #283 | 289 | Stockton - Prepayment | Raw Stockton |
| #284 | 290 | Raw QB Tax | Raw Stockton |
| #285 | 291 | Raw PGE | Raw Stockton |

---

## TASK DUPLICATE GROUPS (97 groups, 102 tasks to archive)

Root cause: Two Asana sync batches re-imported existing tasks.
- **Batch A (IDs 18xxx)**: ~73 tasks duplicating originals IDs #106–8369
- **Batch B (IDs 20xxx)**: ~29 tasks duplicating 18xxx–20xxx range

See full group list: `reports/TASK_DUPLICATE_AUDIT.md`

**Archive IDs (Batch A):**
```
18226, 18233, 18250, 18257, 18264, 18278, 18279, 18294, 18295,
18323, 18324, 18325, 18326, 18354, 18355, 18356, 18357,
18385, 18386, 18387, 18388, 18395, 18407, 18414, 18421,
18436, 18464, 18465, 18466, 18467, 18481, 18482,
18510, 18511, 18512, 18513, 18542, 18543, 18544, 18545,
18573, 18574, 18575, 18576, 18589, 18616, 18617, 18618, 18619,
18626, 18633, 18640, 18654, 18655, 18664, 18671, 18678,
18693, 18694, 18695, 18696, 18697, 18698, 18707, 18710, 18711,
18718, 18725, 18740, 18747, 18750, 18762, 18778
```

**Archive IDs (Batch B + misc):**
```
20054, 20185, 20186, 20187, 20188, 20189, 20190, 20191, 20192,
20193, 20194, 20195, 20196, 20197, 20198, 20199, 20200, 20201,
20202, 20203, 20204, 20205, 20206, 20209,
18211, 18932, 19538, 19807, 20051
```

---

## PREVENTION — Engineering Fixes Required

### Fix 1: Bill Dedup Guard (P0)
```php
$exists = $db->fetch(
    "SELECT id FROM bills
     WHERE LOWER(TRIM(title))=LOWER(TRIM(?)) AND store_id=? AND amount=? AND due_date=?
     AND COALESCE(is_archived,0)=0 LIMIT 1",
    [$title, $storeId, $amount, $dueDate]
);
if ($exists) return $exists['id']; // skip INSERT
```

### Fix 2: Asana Sync UPSERT on asana_gid (P0)
```sql
ALTER TABLE tasks ADD COLUMN asana_gid VARCHAR(100) NULL;
ALTER TABLE tasks ADD UNIQUE INDEX idx_asana_gid (asana_gid);
```
```php
// Replace INSERT with:
$existing = $db->fetch("SELECT id FROM tasks WHERE asana_gid=? LIMIT 1", [$gid]);
if (!$existing) { /* INSERT */ } else { /* UPDATE */ }
```

### Fix 3: Cron Mutex (P1)
```php
$lock = fopen(sys_get_temp_dir().'/bakudan-cron.lock', 'w');
if (!flock($lock, LOCK_EX | LOCK_NB)) exit(0);
register_shutdown_function(fn() => flock($lock, LOCK_UN));
```

---

## CLEANUP EXECUTION TRACKER

| Step | Action | Status | Owner |
|------|--------|--------|-------|
| A1 | Archive 307 duplicate bills | ⏳ CEO approval required | Admin |
| A2 | Verify 40 canonical bills correct | ⏳ After A1 | Admin |
| A3 | Assign real amounts to 20 canonical bills | ⏳ After A2 | Finance |
| A4 | Update 28 bills to overdue status | ⏳ After A1 | Engineering |
| B1 | Archive 102 duplicate tasks | ⏳ Review required | Admin |
| B2 | Verify key canonical tasks intact | ⏳ After B1 | Admin |
| C1 | Bill dedup guard in code | ⏳ Engineering | Dev |
| C2 | Asana UPSERT + asana_gid column | ⏳ Engineering | Dev |
| C3 | Cron mutex deploy | ⏳ Engineering | Dev |
| D1 | Re-run dashboard recalculation | ⏳ After A+B | Engineering |
