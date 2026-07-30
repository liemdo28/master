# PHASE 21 SPECIFICATION — APPENDIX (Sections 9-20)

This appendix contains the remaining sections of the Phase 21 Executive OS specification.

---

## 9. CONNECTOR HEALTH GRID

### 9.1 Connector Overview

```
┌─────────────────────────────────────────────────────────────┐
│  CONNECTOR HEALTH                                [Filter]   │
├─────────────────────────────────────────────────────────────┤
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐        │
│  │WHATSAPP│  │ OPENAI │  │ CLAUDE │  │ GEMINI │        │
│  │   G    │  │   G    │  │   G    │  │   Y    │        │
│  └────────┘  └────────┘  └────────┘  └────────┘        │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐        │
│  │   QB   │  │ TOAST  │  │DOORDASH│  │  GBP   │        │
│  │   -    │  │   G    │  │   G    │  │   G    │        │
│  └────────┘  └────────┘  └────────┘  └────────┘        │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐        │
│  │  GSC   │  │  GA4   │  │ ASANA  │  │  n8n   │        │
│  │   G    │  │   G    │  │   G    │  │   G    │        │
│  └────────┘  └────────┘  └────────┘  └────────┘        │
│  ──────────────────────────────────────────────────────────│
│  Legend: G=Healthy  Y=Warning  R=Critical  -=Offline     │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Connector Detail Modal

```
┌─────────────────────────────────────────────────────────────┐
│  QUICKBOOKS                                     [Offline]   │
│  ───────────────────────────────────────────────────────── │
│  LAST SYNC: 4 hours ago                                   │
│  Status: Desktop app not running                           │
│  ───────────────────────────────────────────────────────── │
│  WHAT HAPPENED:                                           │
│  "QuickBooks Desktop is not running on Laptop1.            │
│   Last successful sync: June 18 at 8:29 AM."               │
│  ───────────────────────────────────────────────────────── │
│  RECOMMENDED ACTION:                                       │
│  1. Open QuickBooks Desktop on Laptop1                     │
│  2. Click "Sync Now" in Mi settings                       │
│  3. Or: [Auto-fix with Mi]                                │
│  ───────────────────────────────────────────────────────── │
│  SYNC HISTORY (Last 7 Days)                               │
│  ✓ Jun 28, 8:29 AM — 47 transactions                      │
│  ✓ Jun 27, 8:15 AM — 52 transactions                      │
│  ✓ Jun 26, 8:45 AM — 38 transactions                      │
│  ✗ Jun 25 — No sync (Desktop offline)                     │
│  ✓ Jun 24, 8:30 AM — 61 transactions                      │
│  ✓ Jun 23, 8:20 AM — 44 transactions                      │
│  ✓ Jun 22, 8:35 AM — 49 transactions                      │
│  ───────────────────────────────────────────────────────── │
│  [Refresh Status]  [View Logs]  [Documentation]            │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 Connector Health Rules

| Connector | Check Frequency | Warning Threshold | Critical Threshold |
|-----------|----------------|-------------------|-------------------|
| WhatsApp | 1 min | > 5 min no message | > 15 min no message |
| QuickBooks | 15 min | > 1 hour stale | > 4 hours stale |
| DoorDash | 5 min | > 15 min stale | > 1 hour stale |
| Google APIs | 5 min | > 10 min stale | > 30 min stale |
| n8n | 1 min | > 3 min stale | > 10 min stale |

---

## 10. EXECUTIVE TIMELINE

### 10.1 Timeline Layout

```
┌─────────────────────────────────────────────────────────────┐
│  TODAY'S TIMELINE                                [Filter]   │
├─────────────────────────────────────────────────────────────┤
│  22:02                                                     │
│  • DoorDash optimized                                       │
│    Campaign #1 budget adjusted +$200                          │
│    [View Details]                                           │
│                                                             │
│  20:08                                                     │
│  • Review replied                                           │
│    3 new reviews responded (avg 2h response)                 │
│    [View Reviews]                                           │
│                                                             │
│  20:12                                                     │
│  • SEO crawl finished                                       │
│    13 pages audited, 2 issues found                          │
│    [View Report]                                            │
│                                                             │
│  18:45                                                     │
│  • QB synced                                                │
│    47 transactions imported                                 │
│    [View in QB]                                             │
│                                                             │
│  17:30                                                     │
│  • Daily brief sent                                          │
│    To: Sen, Dev1, Dev2 via WhatsApp                         │
│    [View Brief]                                            │
│  ───────────────────────────────────────────────────────── │
│  YESTERDAY                                                 │
│  16:45                                                     │
│  • SEO report generated                                     │
│    9 keywords tracked, 169 issues found                      │
│    [View Report]                                            │
│  10:00                                                     │
│  • Campaign Budget Review completed                          │
│    3 campaigns analyzed, 1 underperforming                  │
│    [View Report]                                            │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Timeline Event Types

| Event | Icon | Color | Category |
|-------|------|-------|----------|
| Workflow Complete | ✓ | Green | Automation |
| Error/Failure | ✗ | Red | Alert |
| Approval | 📋 | Blue | Action |
| Sync | 🔄 | Gray | Data |
| Report | 📊 | Purple | Analytics |
| Message | 💬 | Cyan | Communication |

---

## 11. DEPARTMENT VIEW

### 11.1 Department Layout

```
┌─────────────────────────────────────────────────────────────┐
│  MARKETING                                         [Back]   │
├─────────────────────────────────────────────────────────────┤
│  OVERVIEW                                               │
│  ┌─────────────────────────────────────────────────────┐│
│  │  Health: Attention Required                            ││
│  │  Active campaigns: 3 | Budget: $3,500/mo              ││
│  │  This month: $2,847 spent | ROAS: 4.2x               ││
│  └─────────────────────────────────────────────────────┘│
│  ─────────────────────────────────────────────────────────│
│  TEAM WORKLOAD                                           │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐             │
│  │ Campaign A│  │ Campaign B│  │ Campaign C│             │
│  │  Healthy  │  │  Warning  │  │  Healthy  │             │
│  │ $500/mo  │  │ $400/mo  │  │ $300/mo  │             │
│  │ROAS: 5.2x│  │ROAS: 2.1x│  │ROAS: 4.8x│             │
│  └───────────┘  └───────────┘  └───────────┘             │
│  ─────────────────────────────────────────────────────────│
│  ALERTS (2)                                               │
│  ⚠ Campaign B ROAS below target (2.1x vs 3.0x target)   │
│  ⚠ Campaign C budget at 95% for June                      │
│  ─────────────────────────────────────────────────────────│
│  TASKS (5 Active)                                         │
│  [ ] Review Campaign B performance (Due: Today)           │
│  [ ] Approve July budget allocation (Due: Tomorrow)       │
│  [ ] Launch A/B test for Campaign A (Due: Jul 1)         │
└─────────────────────────────────────────────────────────────┘
```

---

## 12. TECHNICAL VIEW (HIDDEN BY DEFAULT)

### 12.1 Access Control

Technical view is hidden by default and requires:
- Click user avatar → "Developer Mode" toggle
- Or URL parameter: ?view=technical
- Visual indicator when active: [TECH] badge next to logo

### 12.2 Technical Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  [TECH] RUNTIME DASHBOARD                       [Exit Tech]│
├─────────────────────────────────────────────────────────────┤
│  SYSTEM STATUS                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │    CPU      │  │   Memory    │  │   Uptime    │       │
│  │    23%     │  │   4.2 GB    │  │  15d 7h    │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
│  ─────────────────────────────────────────────────────────│
│  API ENDPOINTS                                             │
│  ┌─────────────────────────────────────────────────────┐│
│  │ POST /api/mi/tasks/dispatch    200 OK    45ms      ││
│  │ GET  /api/executive/snapshot  200 OK   120ms      ││
│  │ POST /api/whatsapp/send       200 OK    89ms      ││
│  │ GET  /api/health              200 OK    12ms      ││
│  └─────────────────────────────────────────────────────┘│
│  ─────────────────────────────────────────────────────────│
│  LOG STREAM (Last 50 entries)                             │
│  [22:02:01] INFO  Workflow "doordash-optimize" started  │
│  [22:02:03] INFO  Campaign data fetched (47 records)     │
│  [22:02:05] INFO  Budget adjusted: +$200 for Campaign A  │
│  [22:02:06] INFO  Workflow completed successfully        │
│  [22:01:45] WARN  QB sync delayed (desktop offline)      │
│  [22:01:00] INFO  Daily brief sent to 3 recipients      │
└─────────────────────────────────────────────────────────────┘
```

### 12.3 Technical Noise Hidden from CEO

| Hidden from Executive View | Visible in Technical View |
|---------------------------|--------------------------|
| Runtime Snapshot | Full system metrics |
| API endpoints | Request/response logs |
| JSON payloads | Raw data dumps |
| Heartbeat status | Detailed health checks |
| Log summaries | Full log stream |
| Queue overview | Queue depth + items |

---

## 13. MOBILE-FIRST SPECIFICATIONS

### 13.1 Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Single column, bottom nav |
| Tablet | 640-1024px | Two column, bottom nav |
| Desktop | > 1024px | Side nav + multi-column |

### 13.2 Mobile Gestures

| Gesture | Action |
|---------|--------|
| Swipe left | Next section/tab |
| Swipe right | Previous section/tab |
| Pull down | Refresh data |
| Long press | Quick action menu |
| Swipe card left | Quick actions (Approve/Reject) |
| Swipe card right | Archive/Dismiss |

### 13.3 Mobile Navigation

```
┌─────────────────────────────────────────────────────────────┐
│  Good evening, Sen.                               ⚙️      │
│  Everything is healthy.                                       │
├─────────────────────────────────────────────────────────────┤
│  [Content area - full width single column]                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  🏠     📋     📊     ✅     ⚙️                        │
│  Home   Mission Health Approvals More                       │
└─────────────────────────────────────────────────────────────┘
```

### 13.4 iOS-Specific Considerations

- Safe area insets for notch devices
- Haptic feedback on actions (approve/reject)
- Native-feeling scroll behavior
- Swipe-back gesture support
- Dynamic Type support (accessibility)

---

## 14. VISUAL LANGUAGE & DESIGN SYSTEM

### 14.1 Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Primary | #6366F1 | AI personality, buttons |
| Primary Hover | #4F46E5 | Hover states |
| Primary Light | #A5B4FC | Backgrounds |
| Healthy | #10B981 | Success states |
| Warning | #F59E0B | Attention states |
| Critical | #EF4444 | Error states |
| Offline | #6B7280 | Disabled states |
| Running | #3B82F6 | Processing states |
| Background Primary | #FFFFFF | Main background |
| Background Secondary | #F9FAFB | Card backgrounds |
| Text Primary | #111827 | Main text |
| Text Secondary | #6B7280 | Supporting text |
| Border Light | #E5E7EB | Dividers |

### 14.2 Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Heading 1 | Inter | 30px | 700 |
| Heading 2 | Inter | 24px | 600 |
| Heading 3 | Inter | 20px | 600 |
| Body | Inter | 16px | 400 |
| Body Small | Inter | 14px | 400 |
| Caption | Inter | 12px | 400 |
| Mono | JetBrains Mono | 14px | 400 |

### 14.3 Spacing Scale

| Token | Value |
|-------|-------|
| xs | 4px |
| sm | 8px |
| md | 16px |
| lg | 24px |
| xl | 32px |
| 2xl | 48px |
| 3xl | 64px |

### 14.4 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| sm | 6px | Buttons, inputs |
| md | 8px | Cards |
| lg | 12px | Modals |
| xl | 16px | Large