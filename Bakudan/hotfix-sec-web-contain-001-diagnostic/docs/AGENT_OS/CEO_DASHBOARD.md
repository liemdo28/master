# CEO DASHBOARD — Dashboard.bakudanramen.com
**Single screen — system status for Bakudan Dashboard.**
*Last updated: 2026-06-04 16:20 (Asia/Saigon, UTC+7)*

---

## 1. Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  BAKUDAN COMMAND CENTER                         🟢 GREEN  16:20  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Projects]  [Active Projects]  [Duplicates]  [Failed QA]       │
│  [Pending QA] [Production Deploys] [Recent Errors]              │
│  [Recent Builds]  [Recent Tasks]                               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  PROJECTS WIDGET                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │Dashboard│ │Obligation│ │ Command  │ │  Phase   │  ...     │
│  │ 🟢 LIVE │ │ 🟡 ACTIVE│ │ 🟢 LIVE  │ │ ⚠️ BUILD │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
├─────────────────────────────────────────────────────────────────┤
│  ACTIVE PROJECTS                  │  FAILED QA                 │
│  ┌──────────────────────────┐     │  ┌────────────────────┐    │
│  │ #5  Phase 2 Reviewer WS │     │  │ None — all green  │    │
│  │ #3  Compliance Engine  │     │  └────────────────────┘    │
│  └──────────────────────────┘     │                            │
├─────────────────────────────────────────────────────────────────┤
│  HEALTH SCORE: 82/100 🟢                                     │
│  Last full QA: 2026-06-04 | Deploy: 391be7d (DEPLOY_OK)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Widgets

| # | Widget | Data source | Refresh |
|---|--------|-------------|---------|
| 1 | **Projects** | `docs/AGENT_OS/PROJECT_BRAIN.md` | Manual |
| 2 | **Active Projects** | `git log --oneline` + phase roadmap | Auto |
| 3 | **Duplicates** | `git status` | Auto |
| 4 | **Failed QA** | `npm run qa` last result | Manual |
| 5 | **Pending QA** | `qa/artifacts/` unread reports | Manual |
| 6 | **Production Deploys** | `deploy.php` history | Auto |
| 7 | **Recent Errors** | `logs/errors/php-errors.log` last 10 | Auto |
| 8 | **Recent Builds** | `git log --oneline -10` | Auto |
| 9 | **Recent Tasks** | `/api/workflow/my-work?bucket=due_today` | Auto |

---

## 3. Health Scoring

**Overall score: 82/100** 🟢

| Category | Score | Weight |
|----------|-------|--------|
| PHP Errors (last 24h) | 10/10 | 25% |
| SQLSTATE errors (last 24h) | 10/10 | 25% |
| QA pass rate | 13/13 | 20% |
| Deploy sync | 8/10 | 15% |
| RBAC valid | 10/10 | 15% |

See `HEALTH_SCORING_ENGINE.md` for full algorithm.

---

## 4. Color Rules

| Color | Meaning | Trigger |
|-------|---------|---------|
| 🟢 GREEN | Healthy / All systems operational | Score 80–100 |
| 🟡 YELLOW | Needs attention | Score 50–79 |
| 🔴 RED | Critical — immediate action required | Score 0–49 |

**No dark gray text. No neutral/gray labels. All text must be readable at 2K resolution.**

---

## 5. Access

**Route:** `GET /ceo-dashboard` (Phase 7 page, also available at `/admin/ceo-overview`)

**Page file:** `views/ceo-dashboard.php`  
**CSS:** `assets/css/ceo-dashboard.css`  
**JS:** `assets/js/ceo-dashboard.js`

---

## 6. Quick Answers

> **"What is broken?"**
> Check Recent Errors widget (logs/errors/php-errors.log).
> Last error: none (0 SQLSTATE errors in last 24h).
> Health score: 82/100 🟢

> **"What should we fix first?"**
> See Risk Register (docs/AGENT_OS/PROJECT_RISK_REGISTER.md).
> Top fix: Add `'member'` to `users.role` enum (R01).

> **"What projects are risky?"**
> Dashboard = 🟢 GREEN (single project, low risk).
> Compliance Engine = 🟡 Active (Phase 3 partial).

> **"Run QA on Dashboard"**
> `npm run qa` — 13 PASS, 0 FAIL.