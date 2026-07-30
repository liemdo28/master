# Operational Validation — 14-Day Plan

> **Period:** 2026-05-29 → 2026-06-12  
> **Goal:** Prove that existing features deliver real operational value before building anything new.  
> **Rule:** No new feature development. Hotfixes only for login, permissions, tracking, or critical workflow blockers.

---

## Week 1: Real Usage (May 29 – Jun 4)

### Who does what

| Role | Daily Action | Route |
|------|-------------|-------|
| CEO | Open Control Tower, review status | `/control-tower` |
| CEO | Check today's operations | `/operations/today` |
| Manager | Open Command Center | `/manager/command` |
| Manager | Review Action Center | `/action-center` |
| Admin | Review releases without asking dev | `/admin/releases` |
| Admin | Check notifications | `/notifications` |
| Member | Use Workspace for tasks | `/my-workspace` |
| Member | Use Search to navigate | Search bar |

### Success criteria

- [ ] Control Tower opened by CEO at least 5 of 7 days
- [ ] Command Center opened by Manager at least 5 of 7 days
- [ ] At least 1 admin release review without dev involvement
- [ ] At least 3 members using Workspace
- [ ] Search used at least 10 times total

---

## Week 2: Metrics Review (Jun 5 – Jun 12)

### Actions

1. Open `/admin/adoption-metrics`
2. Check these specific events:
   - `search` — how often is search used?
   - `workspace_view` — are members going to My Workspace?
   - `notification_center_view` — are notifications being opened?
   - `control_tower_view` — is CEO using Control Tower?
3. Note any feature with **zero** events
4. Collect verbal feedback from at least 2 users per role
5. Document top 3 pain points

### Success criteria

- [ ] All 4 key metrics have non-zero values
- [ ] At least 1 feature shows daily usage pattern
- [ ] Pain points documented
- [ ] User feedback collected

---

## After 14 Days: Decision

### Fill the report

```
reports/PHASE11_6_ADOPTION_REVIEW.md
```

### Decision matrix

| Condition | Action |
|-----------|--------|
| 3+ key features used daily | Proceed to Payroll Center V2 |
| 1-2 features used, others ignored | Fix UX for ignored features first |
| Most features ignored | Full UX audit, no new build |

---

## What NOT to do during this period

- ❌ Start new feature development
- ❌ Add new database migrations
- ❌ Refactor existing working code
- ❌ Add "nice to have" improvements
- ❌ Change UI layout or navigation

## What IS allowed

- ✅ Fix bugs that block daily usage
- ✅ Fix permission issues
- ✅ Fix tracking/analytics if events aren't recording
- ✅ Update documentation
- ✅ Collect feedback

---

## Reminder

> The goal is not 1000 new features.  
> The goal is:  
> - CEO opens Control Tower every day  
> - Manager opens Command Center every day  
> - Admin reviews releases without asking dev  
> - Members use Workspace instead of searching for tasks  
>  
> If this happens, the system is working.  
> If this doesn't happen, more features won't help.
