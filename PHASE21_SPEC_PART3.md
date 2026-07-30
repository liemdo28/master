# PHASE 21 SPECIFICATION — PART 3 (Sections 15-20)

This document completes the Phase 21 Executive OS specification.

---

## 15. ANIMATION & MOTION DESIGN

### 15.1 Animation Principles

| Principle | Description |
|-----------|-------------|
| Subtle | Animations should enhance, not distract |
| Purposeful | Every animation should communicate meaning |
| Fast | 200-300ms for micro-interactions |
| Natural | Use ease-out for entries, ease-in for exits |
| Responsive | Animation speed matches user input |

### 15.2 Animation Specifications

#### Micro-interactions
| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Button hover | Scale 1.02 | 150ms | ease-out |
| Button press | Scale 0.98 | 100ms | ease-in |
| Card hover | Shadow elevation | 200ms | ease-out |
| Toggle switch | Slide + color | 200ms | spring |

#### Page Transitions
| Transition | Animation | Duration |
|------------|-----------|----------|
| Tab change | Fade + slide | 250ms |
| Modal open | Fade + scale from 0.95 | 300ms |
| Modal close | Fade + scale to 0.95 | 200ms |
| Drawer open | Slide from right | 300ms |
| Drawer close | Slide to right | 250ms |

#### Loading States
| State | Animation |
|-------|-----------|
| Skeleton | Shimmer gradient left-to-right, 1.5s infinite |
| Spinner | Rotate 360deg, 1s infinite linear |
| Progress | Width transition, 300ms ease-out |
| Pulse | Opacity 1 → 0.5 → 1, 2s infinite |

### 15.3 Breathing Indicators

```
┌─────────────────────────────────────────────────────────────┐
│  LIVE INDICATORS                                          │
├─────────────────────────────────────────────────────────────┤
│  Health Card Pulse:                                       │
│  ┌────────┐                                               │
│  │  🟢   │  ← Subtle pulse every 3s when healthy        │
│  └────────┘                                               │
│                                                             │
│  AI Thinking:                                              │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Mi is analyzing... ████░░░░░░ 40%                  │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                             │
│  Real-time Updates:                                        │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ ↑ +$200  ← Number animate up with green flash      │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 15.4 Realtime Refresh Animation

| Event | Animation |
|-------|-----------|
| New data arrives | Fade in new content (200ms) |
| Data updated | Flash highlight (yellow, 500ms) |
| Item removed | Fade out + collapse (200ms) |
| Item added | Fade in + expand (200ms) |

---

## 16. API INTEGRATION PATTERNS

### 16.1 Executive Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /api/executive/snapshot | GET | Full executive view data |
| /api/executive/health | GET | Business health grid |
| /api/executive/missions | GET | Today's missions |
| /api/executive/insights | GET | AI recommendations |
| /api/executive/approvals | GET | Pending approvals |
| /api/executive/timeline | GET | Activity timeline |

### 16.2 Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Mi-Core    │────▶│  API Layer   │────▶│   Frontend   │
│   (Brain)    │     │  (Express)   │     │   (React)    │
└──────────────┘     └──────────────┘     └──────────────┘
      │                    │                    │
      ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Executive  │     │   Cache      │     │    State     │
│  Intelligence│     │   (Redis)    │     │   (Zustand)  │
└──────────────┘     └──────────────┘     └──────────────┘
```

### 16.3 Response Structure

```json
{
  "executive": {
    "greeting": {
      "time": "evening",
      "message": "Good evening, Sen.",
      "status": "healthy"
    },
    "health": {
      "overall": "healthy",
      "departments": [
        {
          "name": "Revenue",
          "status": "healthy",
          "metric": "+12%",
          "trend": "up"
        }
      ]
    },
    "missions": {
      "critical": 2,
      "important": 5,
      "normal": 12,
      "estimated_minutes": 14
    },
    "insights": [
      {
        "type": "marketing",
        "title": "Campaign #3 underperforming",
        "confidence": 87,
        "action": "pause"
      }
    ],
    "approvals": {
      "count": 2,
      "estimated_minutes": 4,
      "items": []
    }
  },
  "meta": {
    "generated_at": "2026-06-29T22:02:00Z",
    "cache_ttl": 30
  }
}
```

### 16.4 WebSocket Events

| Event | Payload | Trigger |
|-------|---------|---------|
| health.update | { department, status } | Status change |
| mission.complete | { mission_id } | Mission done |
| approval.required | { approval_id } | New approval |
| insight.new | { insight } | New recommendation |

---

## 17. COMPONENT LIBRARY

### 17.1 Core Components

| Component | States | Purpose |
|-----------|--------|---------|
| ExecutiveCard | default, hover, loading, error | Main content container |
| HealthBadge | healthy, warning, critical, offline | Status indicator |
| MissionItem | pending, in_progress, completed, skipped | Task display |
| InsightCard | default, expanded, dismissed | AI recommendations |
| ApprovalCard | pending, approved, rejected | Approval items |
| TimelineEntry | complete, error, sync, report | Activity items |
| ConnectorTile | healthy, warning, offline | Integration status |
| MetricCard | default, trending_up, trending_down | KPI display |
| ActionButton | default, hover, active, loading, disabled | CTAs |
| Modal | default, loading | Overlays |

### 17.2 Component Props

```typescript
// HealthBadge
interface HealthBadgeProps {
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

// MissionItem
interface MissionItemProps {
  title: string;
  priority: 'critical' | 'important' | 'normal';
  department: string;
  due: string;
  estimatedMinutes: number;
  description?: string;
  onSkip?: () => void;
  onDelegate?: () => void;
  onDoNow?: () => void;
}

// InsightCard
interface InsightCardProps {
  title: string;
  type: 'revenue' | 'marketing' | 'operational' | 'customer' | 'financial';
  rootCause: string;
  recommendation: string;
  impact: string;
  confidence: number;
  onApply?: () => void;
  onDismiss?: () => void;
}
```

### 17.3 Layout Components

| Component | Description |
|-----------|-------------|
| ExecutiveShell | Main app shell with navigation |
| TopBar | Logo, level tabs, user menu |
| SideNav | Collapsible sidebar |
| BottomNav | Mobile bottom navigation |
| ContentArea | Main scrollable content |
| CardGrid | Responsive grid for cards |
| SectionHeader | Section titles with actions |

---

## 18. STATE MANAGEMENT

### 18.1 State Structure

```typescript
interface AppState {
  // Navigation
  navigation: {
    level: 'executive' | 'business' | 'technical';
    currentView: string;
    sidebarCollapsed: boolean;
  };
  
  // Executive Data
  executive: {
    greeting: Greeting;
    health: DepartmentHealth[];
    missions: Mission[];
    insights: Insight[];
    approvals: Approval[];
    timeline: TimelineEvent[];
  };
  
  // UI State
  ui: {
    loading: boolean;
    error: string | null;
    lastUpdated: Date;
    activeModal: string | null;
  };
  
  // User Preferences
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    compactMode: boolean;
  };
}
```

### 18.2 Data Fetching Strategy

| Data Type | Fetch Strategy | Cache TTL |
|-----------|---------------|-----------|
| Executive snapshot | Initial + polling | 30s |
| Health status | WebSocket + fallback | Real-time |
| Missions | Initial + refetch on change | 60s |
| Insights | Initial + refetch | 5min |
| Approvals | WebSocket + polling | 30s |
| Timeline | Initial + infinite scroll | 60s |

### 18.3 Optimistic Updates

For user actions (approve, reject, complete mission):
1. Update UI immediately
2. Send API request
3. On success: confirm state
4. On failure: rollback + show error

---

## 19. ACCESSIBILITY

### 19.1 WCAG 2.1 AA Compliance

| Requirement | Implementation |
|-------------|----------------|
| Color contrast | All text meets 4.5:1 ratio |
| Focus indicators | Visible focus ring on all interactive elements |
| Keyboard navigation | Full keyboard support for all features |
| Screen reader | ARIA labels on all components |
| Motion reduction | Respect prefers-reduced-motion |
| Text scaling | Support up to 200% zoom |

### 19.2 Keyboard Shortcuts

| Shortcut | Action |
|