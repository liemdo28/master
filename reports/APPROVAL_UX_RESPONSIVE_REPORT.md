# Approval UX Responsive Report

## Approach
Approval UX is split into two surfaces:

### 1. Right Panel Approvals (Desktop)
- Shows pending approvals list (top 3)
- Each shows description + level badge
- Click-through to `approval.html` for full management

### 2. Double-Confirm Overlay (High Risk)
- `.dbl` overlay for Level 3 (dangerous) actions
- Fixed position, dark backdrop
- Requires second confirmation button
- Cancel available

### 3. Standalone Approval Gate (`approval.html`)
- Full approval management page
- Filter by status (Pending, All, Approved, Rejected, Executed)
- Risk level badges (L1 Safe, L2 Action, L3 Critical)
- Before/After/Rollback display
- Double-confirm for Level 3

## Responsive Behavior
- Desktop: right panel shows inline
- Mobile: launches as full-screen overlay or navigates to `approval.html`
- All buttons: 44px+ tap targets
- No accidental tap on high-risk items
