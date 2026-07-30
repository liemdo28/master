# OVERLAY MAP — Create Task Modal Z-Index & Pointer-Events Audit

**Date:** 2026-06-03
**Environment:** https://preview.dashboard.bakudanramen.com
**Files Audited:** `assets/css/components/modal.css`, `views/layouts/main.php`

---

## DOM Structure

```
#createTaskModal  (.modal-overlay.ct-modal)
└── .modal-box
    └── <form id="quickTaskForm">
        ├── .modal-header
        │   └── .modal-close × + h3
        ├── .modal-body
        │   ├── input[name="title"]
        │   ├── textarea[name="description"]
        │   ├── select[name="project_id"]
        │   └── ... other fields
        └── .modal-footer
            ├── button[data-action="close-create-task"]
            └── button[type="submit"] ← TARGET BUTTON
```

---

## Z-Index Stack (Before Fix)

| Element | Selector | z-index | Notes |
|--------|----------|---------|-------|
| Sidebar | `.sidebar` | 100 | Fixed left nav |
| Page Header | `.page-header` | 50 | Sticky top bar |
| Notification Dropdown | `.notif-dropdown` | 60 | Floating dropdown |
| Modal Overlay (backdrop) | `.modal-overlay` | 3000 | Fixed full-screen backdrop |
| Modal Content | `.modal-box` | 3001 | Inside overlay, z above backdrop |

---

## Z-Index Stack (After Fix)

| Element | Selector | z-index | pointer-events | Notes |
|--------|----------|---------|---------------|-------|
| Sidebar | `.sidebar` | 100 | auto | |
| Page Header | `.page-header` | 50 | auto | |
| Notification Dropdown | `.notif-dropdown` | 60 | auto | |
| **Modal Overlay (hidden)** | `.modal-overlay` | 3000 | **none** | ← ROOT CAUSE FIX |
| **Modal Overlay (open)** | `.modal-overlay.open` | 3000 | **auto** | ← Enabled when open |
| Modal Content | `.modal-box` | 3001 | auto | Always above backdrop |

---

## Root Cause

**File:** `assets/css/components/modal.css` (Create Task Modal section)

The `.modal-overlay` rule used only `opacity: 0; visibility: hidden` to hide the modal. This **does NOT disable pointer events** — the overlay div still captured all clicks even when invisible.

```css
/* BEFORE (BUG) */
.modal-overlay {
    opacity: 0;
    visibility: hidden;
    /* pointer-events: ??? ← MISSING! */
}

.modal-overlay.open {
    opacity: 1;
    visibility: visible;
    /* pointer-events: ??? ← MISSING! */
}
```

**Result:** When the modal was added to the DOM, `position: fixed; inset: 0` made it cover the entire viewport. Even with `opacity: 0`, it intercepted ALL pointer events, blocking clicks on form fields and the submit button.

---

## Fix Applied

**File:** `assets/css/components/modal.css`

```css
.modal-overlay {
    /* ... existing styles ... */
    opacity: 0;
    visibility: hidden;
    transition: all .25s ease;
    /* ROOT CAUSE FIX: overlay must not capture pointer events when hidden */
    pointer-events: none;
}

.modal-overlay.open {
    opacity: 1;
    visibility: visible;
    /* Enable pointer events only when the modal is open */
    pointer-events: auto;
}
```

---

## Data-Testid Attributes Added

**File:** `views/layouts/main.php`

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-testid="create-task-modal"` | `#createTaskModal` | Modal container |
| `data-testid="create-task-close"` | Close button | Close button |
| `data-testid="create-task-title"` | `input[name="title"]` | Title input |
| `data-testid="create-task-submit"` | `button[type="submit"]` | Submit button |

---

## Test Selector Update

**File:** `qa/playwright/02-task-create.spec.ts`

Before:
```ts
const submitBtn = page.locator('#createTaskModal button[type="submit"]').first();
```

After (stable with fallback):
```ts
const submitBtn = page.locator('[data-testid="create-task-submit"]').first();
if (!await submitBtn.isVisible().catch(() => false)) {
  const fallbackBtn = page.locator('#createTaskModal button[type="submit"]').first();
  await expect(fallbackBtn).toBeVisible({ timeout: 5000 });
  await fallbackBtn.click();
} else {
  await submitBtn.click();
}
```

---

## CSS Cascade (Load Order)

```
tokens.css       → CSS custom properties (variables)
style.css        → Imports all below
  ├── base.css
  ├── layout.css
  ├── components/
  │   ├── modal.css    ← CONTAINS FIX
  │   ├── buttons.css
  │   ├── forms.css
  │   └── ...
  └── pages/
ux-unified.css   → Applied LAST (override layer)
ceo-readability.css → Applied LAST (override layer)
```

The `.modal-overlay.open { pointer-events: auto }` rule is applied after `ux-unified.css` since it is defined inside `components/modal.css`, which is imported by `style.css` before `ux-unified.css`. The CEO readability CSS is also loaded after, but neither overrides modal pointer-events.

---

## Verification Checklist

- [ ] Modal hidden: `opacity: 0`, `visibility: hidden`, `pointer-events: none`
- [ ] Modal open: `opacity: 1`, `visibility: visible`, `pointer-events: auto`
- [ ] Submit button has `data-testid="create-task-submit"`
- [ ] Playwright clicks correct button
- [ ] No `intercepts pointer events` error
- [ ] QA chain: Create Task → Save → Reload → Submit → Review → Approve → Done
