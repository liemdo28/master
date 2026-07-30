# MI EXECUTIVE OS — PHASE 21 SPECIFICATION
## From Dashboard → AI Executive Operating System

**Status:** Phase 21 Ready for Implementation  
**Created:** 2026-06-29  
**Directive:** CEO Directive — MI Executive UI/UX Redesign  
**Target:** UX/UI Team + Frontend Team

---

## TABLE OF CONTENTS

1. Design Philosophy
2. 3-Level Navigation Architecture
3. Executive Landing Screen
4. Business Health Cockpit
5. Mission Center
6. AI Insights Engine
7. Approval Center
8. Project Health Dashboard
9. Connector Health Grid
10. Executive Timeline
11. Department View
12. Technical View
13. Mobile-First Specifications
14. Visual Language & Design System
15. Animation & Motion Design
16. API Integration Patterns
17. Component Library
18. State Management
19. Accessibility
20. Implementation Checklist

---

## 1. DESIGN PHILOSOPHY

### 1.1 Core Principle: CEO First, Technical Second

The feeling users get when opening Mi: "Tôi đang nói chuyện với COO AI."

NOT: "Tôi đang xem dashboard."

### 1.2 Anti-Patterns (What NOT to Build)

- Card → Card → Card → Card → Card
- Admin Panel Layout
- Bootstrap Grid System
- CRM Dashboard
- Grafana Monitoring
- Email Inbox
- Step Counter
- Runtime Log Viewer

### 1.3 Inspiration Sources

| Product | What to Learn |
|---------|---------------|
| Linear | Speed, keyboard-first, minimal UI, instant transitions |
| Notion | Information density, clean hierarchy, block-based |
| Raycast | Command palette, AI integration, productivity focus |
| Arc Browser | Tab management, split views, visual innovation |
| Apple Human Interface | System-level polish, accessibility, consistency |
| Stripe Dashboard | Data visualization, clear numbers, action-oriented |

### 1.4 Design Principles

1. AI Personality First — Mi speaks, not just displays
2. Business Narrative — Every data point tells a story
3. Actionable Everything — Every card has context-aware actions
4. Progressive Disclosure — Simple by default, detailed on demand
5. 5-Second Understanding — CEO gets value within 5 seconds of opening
6. Mobile-Native — Feels like a native app, not a responsive website

---

## 2. 3-LEVEL NAVIGATION ARCHITECTURE

### 2.1 Navigation Hierarchy

Level 1 - EXECUTIVE (Default): Mission, Health, Insights, Approvals
Level 2 - BUSINESS: Finance, Marketing, Operations, Customer, Stores, Projects
Level 3 - TECHNICAL (Hidden): Runtime, Connectors, Logs, Queue, n8n, Database

### 2.2 Navigation Components

Top Bar: [Mi Logo] | Executive | Business | Technical | [User Avatar] [Settings]
Side Navigation: Collapsible, 240px expanded / 64px collapsed
Bottom Navigation (Mobile): Home, Mission, Health, Approvals, More

### 2.3 Navigation State

| State | Width | Behavior |
|-------|-------|----------|
| Desktop Expanded | 240px | Full sidebar + top bar |
| Desktop Collapsed | 64px | Icons only |
| Tablet | Full-width | Bottom tab navigation |
| Mobile | Full-width | Bottom tab + swipe gestures |

---

## 3. EXECUTIVE LANDING SCREEN

### 3.1 Layout Structure (5-Second Hero)

```
┌─────────────────────────────────────────────────────────────┐
│  GOOD EVENING, SEN.                          [Live] 22:02  │
│  Everything is healthy.                                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │  COMPANY HEALTH          REVENUE +12%               │   │
│  │  All systems nominal     DoorDash Campaign A        │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  TODAY'S MISSION                                    │   │
│  │  2 Critical  |  5 Important  |  12 Normal          │   │
│  │  Est. 14 min to complete                           │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  AI RECOMMENDATION                                  │   │
│  │  Pause DoorDash Campaign #3                         │   │
│  │  Underperforming since June 25                      │   │
│  │  [Apply]  [Details]  [Dismiss]                     │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PENDING APPROVALS                                  │   │
│  │  2 items require your attention                    │   │
│  │  [Review Now]                                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 AI Greeting Component

- Morning (5:00-12:00): "Good morning, [Name]."
- Afternoon (12:00-17:00): "Good afternoon, [Name]."
- Evening (17:00-21:00): "Good evening, [Name]."
- Night (21:00-5:00): "Late night, [Name]. Everything's running smoothly."

Content Structure: [Greeting] + [Status Summary] + [Key Metric] + [Attention Item] + [Estimated Action Time]

### 3.3 Real-time Update Indicator

- Live pulse animation on refresh button
- "Last updated: X seconds ago" with auto-refresh every 30s
- Pull-to-refresh on mobile
- Optimistic UI updates for user actions

---

## 4. BUSINESS HEALTH COCKPIT

### 4.1 Health Grid Layout

```
┌─────────────────────────────────────────────────────────────┐
│  BUSINESS HEALTH                                    [Live]  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   REVENUE   │  │  MARKETING  │  │ OPERATIONS  │         │
│  │     [G]     │  │     [Y]     │  │     [G]     │         │
│  │    +12%     │  │    -3%      │  │    +5%      │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   FINANCE   │  │  CUSTOMER   │  │ ENGINEERING │         │
│  │     [G]     │  │     [G]     │  │     [Y]     │         │
│  │  QB Synced  │  │   +15 NPS   │  │  3 Blocked  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│  ┌─────────────┐  ┌─────────────┐                           │
│  │STORE HEALTH │  │     HR      │                           │
│  │     [G]     │  │     [G]     │                           │
│  │  3/3 Online │  │ 2 Open Pos  │                           │
│  └─────────────┘  └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
Legend: [G] = Green Healthy, [Y] = Yellow Warning, [R] = Red Critical
```

### 4.2 Health Status Indicators

| Status | Color (Hex) | Meaning |
|--------|-------------|---------|
| Healthy | #10B981 | All systems nominal |
| Warning | #F59E0B | Attention required |
| Critical | #EF4444 | Immediate action required |
| Offline | #6B7280 | System unreachable |

### 4.3 Health Card Component

```
┌────────────────────────────────────────┐
│  [Icon]  DEPARTMENT NAME         [G]  │
│────────────────────────────────────────│
│  Primary Metric      Change            │
│  $124,500           +12.3%            │
│                                        │
│  Status Text                           │
│  DoorDash Campaign A performing well   │
│                                        │
│  [View Details]                       │
└────────────────────────────────────────┘
```

### 4.4 Drill-Down Behavior

- Click on health card → Full department view
- Long press (mobile) → Quick action menu
- Hover shows tooltip with last 7 days trend

---

## 5. MISSION CENTER

### 5.1 Mission Overview

```
┌─────────────────────────────────────────────────────────────┐
│  TODAY'S MISSION                                 [Open Plan]│
├─────────────────────────────────────────────────────────────┤
│  [C] CRITICAL (2)   [I] IMPORTANT (5)   [N] NORMAL (12)    │
│  [Progress Bar]     [Progress Bar]      [Progress Bar]      │
│                                                             │
│  Estimated completion time: 14 minutes                       │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Priority Engine

All missions dynamically sorted by:
1. Urgency — Deadline proximity
2. Impact — Business value if completed
3. Dependencies — What else is blocked
4. CEO Context — Recent conversations and priorities

### 5.3 Mission Item Component

```
┌─────────────────────────────────────────────────────────────┐
│  [ ]  [P1] Review DoorDash Weekly Report                   │
│       Marketing • Due 2:00 PM • Est. 5 min                 │
│       DoorDash campaign #3 is underperforming.              │
│       [Skip]  [Delegate]  [Do Now]                         │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Mission States

| State | Visual | Behavior |
|-------|--------|----------|
| Pending | Empty circle | Default state |
| In Progress | Half-filled + pulse | Currently working on |
| Completed | Filled checkmark | Done, archived after 24h |
| Skipped | Strikethrough | User chose to skip |
| Delegated | Arrow icon | Assigned to team member |

---

## 6. AI INSIGHTS ENGINE

### 6.1 Insights Card Structure

```
┌─────────────────────────────────────────────────────────────┐
│  TODAY'S INSIGHT                                      [Ref]│
├─────────────────────────────────────────────────────────────┤
│  "DoorDash Campaign #3 is underperforming"                  │
│  ───────────────────────────────────────────────────────── │
│  ROOT CAUSE                                             │
│  CPC increased by 45% while conversion rate dropped 12%    │
│  ───────────────────────────────────────────────────────── │
│  RECOMMENDATION                                          │
│  Pause Campaign #3 and reallocate budget to Campaign #1    │
│  ───────────────────────────────────────────────────────── │
│  IMPACT: Potential savings: $1,200/week                    │
│  CONFIDENCE: [██████████░░] 87%                          │
│  ───────────────────────────────────────────────────────── │
│  [Apply]  [Details]  [Watch]  [Dismiss]                   │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Confidence Indicator

| Level | Bar | Color |
|-------|-----|-------|
| 90-100% | [██████████] | Green |
| 70-89% | [████████░░] | Light Green |
| 50-69% | [██████░░░░] | Amber |
| Below 50% | [████░░░░░░] | Red |

### 6.3 Insight Types

1. Revenue Insights — Trending, anomalies, predictions
2. Marketing Insights — Campaign performance, attribution
3. Operational Insights — Efficiency, bottlenecks
4. Customer Insights — Sentiment, churn risk
5. Financial Insights — Cash flow, expense anomalies

---

## 7. APPROVAL CENTER

### 7.1 Approval Overview

```
┌─────────────────────────────────────────────────────────────┐
│  PENDING APPROVALS                                [View All]│
├─────────────────────────────────────────────────────────────┤
│  2 items require your attention                           │
│  Estimated review time: 4 minutes                         │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  DoorDash Campaign Budget Increase                   │  │
│  │  Operations • 2 hours ago                           │  │
│  │  $500 → $750/week (+50%)                          │  │
│  │  [Review]  [Delegate]                              │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Q3 Marketing Plan Review                          │  │
│  │  Marketing • 5 hours ago                            │  │
│  │  3 sections, 12 decisions                         │  │
│  │  [Review]  [Delegate]                              │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Approval Actions

| Action | Behavior |
|--------|----------|
| Approve | One-tap approval with optional comment |
| Reject | Requires reason selection from dropdown |
| Delegate | Assign to team member with optional deadline |
| Request Changes | Send back for revision with specific feedback |
| Snooze | Remind me in 1h, tomorrow, or custom time |

### 7.3 Approval Detail View

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Approvals                                       │
├─────────────────────────────────────────────────────────────┤
│  DoorDash Campaign Budget Increase                         │
│  Department: Operations                                    │
│  Requested: 2 hours ago by [User Name]                     │
│  Priority: High                                           │
│  ───────────────────────────────────────────────────────── │
│  CURRENT vs REQUESTED                                      │
│  [$500/week] → [$750/week (+50%)]                        │
│  ───────────────────────────────────────────────────────── │
│  REASON                                                   │
│  "Campaign #1 is exceeding targets. We need more budget    │
│   to scale successful campaigns before Q3 ends."           │
│  ───────────────────────────────────────────────────────── │
│  IMPACT ANALYSIS (by Mi)                                   │
│  • Monthly cost increase: +$1,000                         │
│  • Expected ROAS improvement: +15%                        │
│  • Break-even point: 4 weeks                              │
│  ───────────────────────────────────────────────────────── │
│  EVIDENCE                                                 │
│  [Campaign Performance Report]                             │
│  [Historical Budget vs Results]                           │
│  [Team Discussion Thread]                                 │
│  ───────────────────────────────────────────────────────── │
│  [Approve]  [Reject]  [Delegate]  [Request Changes]       │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. PROJECT HEALTH DASHBOARD

### 8.1 Project Overview

```
┌─────────────────────────────────────────────────────────────┐
│  PROJECT HEALTH                                   [Filter]  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐  │
│  │  DOORDASH OPERATIONS                      [Healthy] │  │
│  │  Last action: 2 min ago                            │  │
│  │  Active: 4 | Queued: 1 | Failed: 0                  │  │
│  │  [View]                                            │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  REVIEW AUTOMATION                     [Attention]   │  │
│  │  Last action: 15 min ago                           │  │
│  │  Active: 2 | Queued: 3 | Failed: 1                  │  │
│  │  [View]                                            │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  SEO AUTOMATION                          [Healthy]  │  │
│  │  Last action: 1 hour ago                           │  │
│  │  Active: 6 | Queued: 0 | Failed: 0                  │  │
│  │  [View]                                            │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  QUICKBOOKS SYNC                      [Offline]     │  │
│  │  Last sync: 4 hours ago                            │  │
│  │  Error: Desktop app offline                        │  │
│  │  [Fix]                                             │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  WEBSITE                                [Healthy]    │  │
│  │  Uptime: 99.9% (30 days)                          │  │
│  │  Active: 1 | Queued: 0 | Failed: 0                  │  │
│  │  [View]                                            │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Project Health States

| State | Icon | Color | Meaning |
|-------|------|-------|---------|
| Healthy | O | Green | All workflows running, no failures |
| Attention | A | Amber | Some failures or degradation |
| Blocked | B | Red | Major issues requiring action |
| Offline | - | Gray | Not syncing or unreachable |
| Running | R | Blue | Active processing |

### 8.3 Project Detail View

```
┌─────────────────────────────────────────────────────────────┐
│  DOORDASH OPERATIONS                               [Edit]  │
├─────────────────────────────────────────────────────────────┤
│  HEALTH STATUS: All systems operational                    │
│  ───────────────────────────────────────────────────────── │
│  WORKFLOWS (4 Active)                                     │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Daily Campaign Optimizer                            │  │
│  │  Runs: Daily 8:00 AM | Last: Success (2h ago)      │  │
│  │  [Logs] [Run Now] [Disable]                        │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Weekly Performance Report                          │  │
│  │  Runs: Monday 9:00 AM | Last: Success (2d ago)    │  │
│  │  [Logs] [Run Now] [Disable]                        │  │
│  └─────────────────────────────────────────────────────┘  │
│  ───────────────────────────────────────────────────────── │
│  RECENT ACTIVITY                                          │
│  • 22:02 — Campaign Optimizer completed (2 campaigns