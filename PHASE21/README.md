# Phase 21 — MI Executive Operating System

Transforming Mi from a dashboard into an **AI Executive Operating System**.

## Overview

This is the Phase 21 implementation codebase for the MI Executive UI/UX redesign. The goal is to create an experience where:

> "Tôi đang nói chuyện với COO AI."

NOT: "Tôi đang xem dashboard."

## Architecture

### 3-Level Navigation

```
EXECUTIVE (Default)     →  Mission, Health, Insights, Approvals
       ↓
BUSINESS                →  Finance, Marketing, Operations, Customer, Stores, Projects
       ↓
TECHNICAL (Hidden)      →  Runtime, Connectors, Logs, Queue, n8n, Database
```

### Key Principles

1. **AI-First**: Mi speaks, not just displays data
2. **5-Second Understanding**: CEO gets value within 5 seconds of opening
3. **Business Narrative**: Every data point tells a story
4. **Actionable Everything**: Every card has context-aware actions
5. **Mobile-Native**: Feels like a native app, not a responsive website

## Project Structure

```
PHASE21/
├── src/
│   └── components/
│       ├── ExecutiveShell.tsx      # Main app shell + state management
│       ├── TopBar.tsx              # Level tabs + Live indicator
│       ├── SideNav.tsx             # Desktop collapsible sidebar
│       ├── BottomNav.tsx           # Mobile bottom navigation
│       ├── ExecutiveLanding.tsx   # 5-Second Hero with AI Greeting
│       ├── BusinessHealth.tsx      # Health Cockpit grid
│       ├── MissionCenter.tsx       # Priority Engine
│       ├── AIInsights.tsx          # AI Recommendations
│       ├── ApprovalCenter.tsx      # Contextual Approvals
│       ├── ConnectorHealth.tsx      # Integration Status Grid
│       ├── ExecutiveTimeline.tsx   # Activity Timeline
│       ├── HealthBadge.tsx          # Status indicators
│       └── index.ts                # Component exports
├── tailwind.config.js              # Design System
└── API_SPEC.md                    # API Endpoints
```

## Design System

### Colors

| Status | Color | Hex |
|--------|-------|-----|
| Healthy | Green | #10B981 |
| Warning | Amber | #F59E0B |
| Critical | Red | #EF4444 |
| Offline | Gray | #6B7280 |

### Typography

- Font: Inter
- Scale: 12px → 36px

### Spacing

4px base unit: 4, 8, 16, 24, 32, 48, 64

## Mobile-First Features

- Bottom navigation with notification badges
- Safe area support for notch devices
- Haptic feedback ready
- Swipe gestures
- Native scroll behavior
- Pull-to-refresh

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## CEO Directive Reference

This implementation follows the CEO Directive with these key requirements:

### Executive Landing (5-Second Hero)

```
Good evening, Sen.

Everything is healthy.

Revenue +12%

DoorDash campaign #3 is underperforming.

I recommend pausing it.

Only 2 approvals require your attention.

Estimated decision time: 14 minutes.
```

### Business Health Cockpit

Visual status indicators for:
- Revenue
- Marketing
- Operations
- Finance
- Customer Experience
- Engineering
- Store Health

### AI Insights

Each insight includes:
- Root Cause
- Recommendation
- Impact
- Confidence
- Suggested Action

## Design Inspirations

- Linear (speed, keyboard-first)
- Notion (information density)
- Raycast (command palette, AI integration)
- Arc Browser (visual innovation)
- Apple Human Interface (polish, accessibility)
- Stripe Dashboard (data visualization)

## Status

Phase 21 specification and core components complete.

Ready for:
- Designer review
- QA testing
- CEO review
- Integration with Mi-Core backend
