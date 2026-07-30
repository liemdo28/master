# ROLE-BASED UI MATRIX
**Date:** 2026-06-16
**Roles:** ceo | admin | manager | member

---

## Sidebar Sections

| Section | CEO | Admin | Manager | Member | Current Gate | Status |
|---------|-----|-------|---------|--------|-------------|--------|
| OPERATIONS (stores, health, vendors) | ✅ | ✅ | ✅ | ❌ | `canManage()` | ✅ |
| BILLS (all-store view) | ✅ | ✅ | ✅ | ❌ | `canManage()` | ✅ |
| STORE COMMAND | ✅ | ✅ | ❌ | ❌ | `canAdmin()` | ⚠️ CEO OK |
| STORE HEALTH | ✅ | ✅ | ❌ | ❌ | `canAdmin()` | ⚠️ CEO OK |
| VENDORS / PROCUREMENT | ✅ | ✅ | ❌ | ❌ | `canAdmin()` | ❌ CEO shouldn't manage vendors |
| PLAYBOOKS | ✅ | ✅ | ✅ | ✅ | all | ✅ |
| SECURITY (Vault, Rotation, Audit Logs) | ✅ | ✅ | ❌ | ❌ | `canAdmin()` | ⚠️ CEO OK for read |
| TASKS | ✅ | ✅ | ✅ | ✅ | all | ✅ |
| MY DAY | ✅ | ✅ | ✅ | ✅ | all | ✅ |
| EXECUTIVE (Scorecard, Boardroom) | ✅ | ✅ | ❌ | ❌ | `canAdmin()` | ✅ |
| ADMIN (Users, Data Hygiene, etc.) | ❌ | ✅ | ❌ | ❌ | `isAdmin()` | ✅ Fixed |

---

## Route-Level Access

### CEO Routes

| Route | Access | Purpose |
|-------|--------|---------|
| `/overview` | CEO ✅ | Executive command center |
| `/overview/drilldown/*` | CEO ✅ | KPI drilldowns |
| `/ceo/scorecard` | CEO ✅ | Franchise scorecard |
| `/ceo/boardroom` | CEO ✅ | Boardroom mode |
| `/ceo/war-room` | CEO ✅ | Incident war room |
| `/ceo/penalties` | CEO ✅ | Read-only penalty summary |
| `/control-tower` | CEO ✅ | Company digest |
| `/operations/today` | CEO ✅ | Daily operations view |
| `/health` | CEO ✅ | Store health |
| `/company/calendar` | CEO ✅ | Company calendar |
| `/action-center` | CEO ✅ | Action items |
| `/admin/users` | CEO ❌ BLOCKED | Admin only |
| `/admin/data-hygiene` | CEO ❌ BLOCKED | Admin only |
| `/admin/releases` | CEO ❌ BLOCKED | Admin only |

### Admin Routes

| Route | Access | Purpose |
|-------|--------|---------|
| All CEO routes | Admin ✅ | Inherited |
| `/admin/users` | Admin ✅ | User management |
| `/admin/data-hygiene` | Admin ✅ | Data cleanup |
| `/admin/penalties` | Admin ✅ | Penalty management |
| `/admin/penalty-rules` | Admin ✅ | Penalty config |
| `/admin/duplicates` | Admin ✅ | Duplicate management |
| `/admin/extensions` | Admin ✅ | Deadline extensions |
| `/admin/releases` | Admin ✅ | Release management |
| `/security/credentials` | Admin ✅ | Credential vault |
| `/asana` | Admin ✅ | Integrations |

### Manager Routes

| Route | Access | Purpose |
|-------|--------|---------|
| `/overview` | Manager ✅ | Team overview |
| `/manager/command` | Manager ✅ | Manager command center |
| `/manager/penalties` | Manager ✅ | Team penalties |
| `/bills/store/{id}` | Manager ✅ (own stores) | Store bills |
| `/store/{id}` | Manager ✅ (own stores) | Store detail |
| `/tasks` | Manager ✅ | All tasks |
| `/admin/*` | Manager ❌ BLOCKED | Admin only |

### Member Routes

| Route | Access | Purpose |
|-------|--------|---------|
| `/my-tasks` | Member ✅ | Own tasks |
| `/my-day` | Member ✅ | Daily view |
| `/notifications` | Member ✅ | Notifications |
| `/penalties` or `/my-penalties` | Member ✅ | Own penalties |
| `/tasks/{id}` | Member ✅ (own tasks) | Task detail |
| `/inbox` | Member ✅ | Review inbox |
| `/overview` | Member ❌ BLOCKED | Manager+ only |
| `/bills` | Member ❌ BLOCKED | Manager+ only |

---

## Page Design Per Role

### CEO Landing (/)
**Should show:**
- Company health score (single number)
- Critical alerts with owner + store
- Top 5 overdue bills by store
- Top 5 overdue tasks by team member
- One-click drilldown on each

**Currently shows:** Overview command center (good base, needs refinement)

### Admin Landing (/)
**Should show:**
- System health (pending migrations, errors)
- User management quick links
- Pending approvals
- Recent releases

**Currently shows:** Same overview as CEO (too executive-focused for admin)

### Manager Landing (/)
**Should show:**
- My stores status
- Team load per member
- Bills due this week (own stores)
- Tasks behind schedule (own team)

**Currently shows:** Same overview (not store-filtered for manager)

### Member Landing (/)
**Should show:**
- My tasks today
- Overdue tasks
- Upcoming deadlines
- Notifications

**Currently shows:** my-tasks page (good)

---

## Penalty System RBAC (After This Session)

| Action | CEO | Admin | Manager | Member |
|--------|-----|-------|---------|--------|
| View own penalties | ✅ `/penalties` | ✅ | ✅ | ✅ |
| View company summary (read-only) | ✅ `/ceo/penalties` | ✅ | ❌ | ❌ |
| View team penalties | ❌ | ✅ | ✅ `/manager/penalties` | ❌ |
| Configure penalty rules | ❌ | ✅ `/admin/penalty-rules` | ❌ | ❌ |
| Add/remove members | ❌ | ✅ `/admin/penalty/add` | ❌ | ❌ |
| Submit appeal | N/A | N/A | N/A | ✅ `/penalties/appeal` |
| Review appeal | ❌ | ✅ | ❌ | ❌ |

---

## Gaps Requiring Fix

| Gap | Impact | Priority |
|----|--------|---------|
| CEO sees Vendors/Procurement in sidebar | Low — operational confusion | P1 |
| Manager gets full `/overview` not store-filtered | Medium — data overload | P1 |
| Admin landing = CEO landing | Low — UX confusion | P2 |
| Member can't see store context | Low | P2 |
| No CEO-only Finance CFO panel | Medium | P1 |
