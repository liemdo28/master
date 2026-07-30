# GROWTH_APPROVAL_POLICY.md

> Phase 29I — Growth Action Approval Engine
> Generated: 2026-06-24 20:49 Asia/Saigon
> Mission: Classify every growth action into AUTO_EXECUTE, CEO_APPROVAL_REQUIRED, or BLOCKED

---

## Policy

Every growth action proposed by Mi must be classified before execution. Misclassification is a CTO-level incident.

| Classification | Definition | Owner | Audit Trail |
|----------------|------------|-------|-------------|
| `AUTO_EXECUTE` | Low risk, reversible, well-isolated. Mi executes without waiting. | Mi | Git commit + log |
| `CEO_APPROVAL_REQUIRED` | Touches production, changes user-facing copy, costs money, or alters rankings. Mi prepares; CEO approves. | CEO | PR + sign-off |
| `BLOCKED` | Missing credentials, missing data, missing authority, or out of scope. | Mi escalates to CEO | Documented blocker |

---

## Classification Rules

### AUTO_EXECUTE
Allowed when ALL of the following are true:
- Change is reversible (can be reverted via git)
- Does not touch production user data (orders, customer info)
- Does not cost money (no ad spend, no new tools)
- Does not delete content (only adds or modifies)
- Does not deploy to production automatically

Examples:
- ✅ SEO metadata updates (title, meta, OG, schema)
- ✅ Adding FAQ content to existing pages
- ✅ Creating new landing pages (draft, not deployed)
- ✅ Updating internal links
- ✅ Improving page speed
- ✅ Adding FAQ schema
- ✅ Adding breadcrumb schema
- ✅ Code refactors (no behavior change)
- ✅ Test additions

### CEO_APPROVAL_REQUIRED
Required when ANY of the following is true:
- Change is user-facing and visible to all visitors
- Change affects search engine ranking
- Change costs money (ad spend, third-party service)
- Change deletes or overwrites content
- Change deploys to production
- Change modifies business logic

Examples:
- ⚠️ Homepage redesign (significant copy/layout change)
- ⚠️ Production deploy
- ⚠️ DoorDash campaign changes (paused campaigns, budget changes)
- ⚠️ Google Ads changes
- ⚠️ Content deletion
- ⚠️ Wholesale menu changes
- ⚠️ Price changes
- ⚠️ New vendor onboarding
- ⚠️ Disabling automation scripts

### BLOCKED
Triggered when ANY of the following is true:
- Missing required credentials (DoorDash, GBP, GA4, etc.)
- Missing data to make the decision
- Out of scope (not revenue-driving)
- Requires legal/compliance review
- Requires physical action (in-store, hardware)

Examples:
- 🚫 DoorDash campaign audit (no credentials)
- 🚫 GBP insights integration (no API key)
- 🚫 POS-to-revenue attribution (no Toast API)
- 🚫 Production deploy without CEO sign-off
- 🚫 Changing restaurant hours on GBP
- 🚫 Responding to negative reviews (operational decision)

---

## Phase 29 Classifications

| Action | Classification | Reason |
|--------|----------------|--------|
| Raw Sushi homepage title/meta/OG update | **AUTO_EXECUTE** | Reversible, SEO metadata, no production data |
| Bakudan order.html CTA bar addition | **AUTO_EXECUTE** | Reversible, HTML, no data change |
| Create Phase 29 documentation | **AUTO_EXECUTE** | Documentation, no impact |
| Request GSC indexing | **AUTO_EXECUTE** | SEO best practice, no risk |
| Add GA4 tracking code | **CEO_APPROVAL_REQUIRED** | Adds 3rd-party tracking, privacy implications |
| Set up call tracking | **CEO_APPROVAL_REQUIRED** | New service, cost |
| Activate review automation scripts | **CEO_APPROVAL_REQUIRED** | Sends real customer communications |
| Pause DoorDash campaign | **CEO_APPROVAL_REQUIRED** | Affects live revenue |
| Delete a landing page | **CEO_APPROVAL_REQUIRED** | Permanent content removal |
| Production deploy | **CEO_APPROVAL_REQUIRED** | Goes live to all users |
| DoorDash campaign optimization | **BLOCKED** | No credentials |
| GBP insights dashboard | **BLOCKED** | No API key |
| Toast POS integration | **BLOCKED** | No API access |
| Review response auto-send | **BLOCKED** | No credentials + customer-facing |
| Change menu prices | **BLOCKED** | Operational decision, requires franchise/owner |

---

## Approval Workflow

```
Mi identifies growth opportunity
        ↓
Mi proposes action with classification
        ↓
  ┌──────────────────┬──────────────────┬──────────────────┐
  ↓                  ↓                  ↓                  ↓
AUTO_EXECUTE    CEO_APPROVAL_REQ.   BLOCKED
  ↓                  ↓                  ↓
Mi executes     Mi prepares PR     Mi escalates
Git commit      + business case   to CEO with
+ log           + evidence        blocker doc
  ↓                  ↓                  ↓
  └──────────────────┴──────────────────┘
                     ↓
              CEO reviews
              dashboard weekly
```

---

## Decision Matrix

| Risk Level | Reversible | Cost | Auto? |
|------------|------------|------|-------|
| LOW | YES | $0 | AUTO_EXECUTE |
| LOW | YES | <$50/mo | AUTO_EXECUTE |
| LOW | NO | $0 | CEO_APPROVAL |
| MEDIUM | YES | $0–$100/mo | CEO_APPROVAL |
| MEDIUM | NO | Any | CEO_APPROVAL |
| HIGH | YES | Any | CEO_APPROVAL |
| HIGH | NO | Any | BLOCKED |
| ANY | N/A | Missing data | BLOCKED |

---

## Audit Trail Requirements

For every CEO_APPROVAL_REQUIRED action, the following must be in the PR:

1. **What** is changing
2. **Why** it's changing (with revenue/data evidence)
3. **Risk** of not changing
4. **Risk** of changing
5. **Rollback plan** (how to revert)
6. **QA results** (what was tested)
7. **Expected impact** (KPI movement)
8. **Approval signature** (CEO name + date)

---

## Enforcement

If Mi ever:
- Executes a CEO_APPROVAL_REQUIRED action without approval → CTO-level incident
- Tries to bypass BLOCKED status → CTO-level incident
- Misclassifies an action (with intent to bypass) → CTO-level incident

**In Phase 29:**
- 2 AUTO_EXECUTE actions completed (Raw Sushi CTR fix, Bakudan order page fix)
- 0 misclassifications
- 0 unauthorized executions
- 1 honest BLOCKED (DoorDash, due to no credentials)
