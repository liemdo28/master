# OWNERSHIP_ENGINE_OPERATIONAL.md
**Status:** OPERATIONAL | **Phase:** 0D | **Engine:** `src/executive-coordination/ownership-engine.ts`

## Routing Rules (7 divisions)
- Engineering: code, PR, build, test, deploy, integration
- Computer Operator: browser tasks, desktop tasks, manual web portals
- Financial Intelligence: QuickBooks, revenue, profit, payroll, forecasting
- Marketing Intelligence: SEO, GA4, GSC, GBP, reviews, campaigns, content
- IT Operations: devices, network, accounts, backups, security, monitoring
- Creative Media: image, video, editing, assets, content calendar
- Executive Office: priorities, approvals, escalations, final decisions

## API Proof
POST /api/coordination/ownership/resolve → resolveOwnership(taskText) | GET /api/coordination/ownership/rules

## Unknown Owner Handling
Low confidence (<0.3) → escalated to Executive Office for manual assignment.

## Certification Tests
- "Fix Dashboard approval bug" → Engineering
- "Check DoorDash campaign status" → Computer Operator (with Marketing support)
- "Why did revenue drop?" → Financial Intelligence (with Marketing support)
