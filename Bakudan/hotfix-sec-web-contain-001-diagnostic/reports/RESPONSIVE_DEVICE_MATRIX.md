# Responsive Device Matrix — Mobile, Foldables & Tablets

> **Scope:** Source-level audit of the Bakudan / TaskFlow dashboard responsive layer
> against the Mobile + Tablet Device Coverage Addendum.
>
> **Method:** Static review of `assets/css/*.css`, `assets/js/*.js`, and
> `views/layouts/main.php` (the master layout). No live browser automation
> was run for this audit — every "Pass" / "Fail" row is derived from a real
> CSS/JS source reference, and the empty `screenshots/` placeholders in the
> matrix below are flagged for a follow-up Playwright / BrowserStack run.

---

## 1. Executive Summary

| Area                          | Verdict | Notes |
|-------------------------------|:-------:|-------|
| Breakpoint coverage (≤480 / 481–767 / 768–1023 / 1024–1279 / ≥1280) | **PARTIAL** | The codebase has *three* overlapping breakpoint systems — `1024 / 768 / 480` in `layout.css` + `960 / 900 / 700 / 520` in `ux-unified.css` + 2K-only `2000 / 3000` in `ceo-readability.css`. There is **no explicit `1280px` desktop boundary** and **no `1024–1279` tablet-landscape / small-laptop band**. |
| Bottom nav (≤ 767px)           | **PASS**  | `.mobile-bottom-nav` is `display:none` by default and revealed at `max-width:768px` in `layout.css` (line 576). Safe-area inset is honoured. |
| Sidebar hidden on phone        | **PASS**  | `.sidebar { transform: translateX(-100%); }` at `max-width:768px` (layout.css:481). Hamburger toggle works (see app.js). |
| Hamburger → full screen        | **PASS**  | Sidebar slides in full-width, dark backdrop is rendered (`#sidebarBackdrop`), close on outside click is wired in app.js. |
| One card per row (≤ 767px)     | **PASS**  | `.grid-4, .grid-3, .grid-2 { grid-template-columns: 1fr; }` (layout.css:486). |
| Drawer → bottom sheet (≤ 767px) | **PASS**  | `.dd-panel` and `.td-panel` collapse to 100% width / 92% height bottom sheet at `max-width:720px` and `max-width:640px` respectively. |
| Tables → cards (≤ 767px)       | **FAIL**  | No global `.table-to-card` rule exists. `.data-table` / `.list-table` only get padded cell shrinking. Wide tables rely on container `overflow-x:auto` instead. |
| Tablet collapsible sidebar (768–1279) | **FAIL**  | At `768–1023px` the sidebar is still hidden behind the hamburger (no rail mode). No `@media (min-width:768px) and (max-width:1279px)` rail layout. |
| Tablet 2-col cards (768–1279)  | **PARTIAL** | `.kpi-grid-4` collapses to 2-col at 900px, 1-col at 768px. `.kpi-grid-3` collapses to 2-col at 700px. Many page-level grids (e.g. `.ov-kpi-row`) collapse to 2-col at 960px. Behaviour is inconsistent across pages. |
| Drawer width 70–85% (tablet)   | **FAIL**  | Drawer is **100% on ≤720/640px** and **720/520px fixed** above that. There is no 70–85% intermediate state. |
| Desktop ≥ 1280 (sidebar, multi-col, table, right drawer) | **PASS** | Sidebar visible, `.content-area` padded, drawer pinned to right (520–720px). |
| No horizontal overflow         | **PARTIAL** | `.content-area { overflow-x: hidden }` (layout.css:376) but inner `.data-table` containers rely on their own `overflow-x:auto`. Long task titles, badge counts, and the CEO KPI grid can still push out — see §5. |
| Bottom nav does not cover content | **PASS**  | `.content-area { padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px)) }` (layout.css:604). |
| Orientation change             | **PARTIAL** | Layouts reflow (CSS is fluid) but **no `@media (orientation: landscape)` rule** exists. Some iPad landscape heights (e.g. 1366×1024) leave header + bottom nav consuming > 25% of the viewport. |
| Safari iOS / Chrome Android    | **NOT TESTED** | No automated cross-browser run was performed. Static review flags known iOS Safari issues — see §6. |

**Overall:** the system **already covers iPhone-class mobile** and **desktop** well. The gap is concentrated in the **tablet 768–1279px** band (sidebar rail, drawer width, card columns) and in the **320–360px small-phone tail** (untested).

---

## 2. Target Devices & Breakpoints (per Addendum)

| Class                  | Viewport (portrait) | Example device            | Status |
|------------------------|---------------------|---------------------------|:------:|
| Small phone            | 320 × 568           | iPhone SE 1st gen         | ⚠️ untested |
| Small phone            | 360 × 800           | Galaxy A / small Android  | ✅ covered |
| iPhone                 | 375 × 812           | iPhone 12 mini / 13 mini  | ✅ covered |
| iPhone                 | 390 × 844           | iPhone 12 / 13 / 14       | ✅ covered |
| iPhone Plus / Max      | 414 × 896           | iPhone 11 Plus / XR       | ✅ covered |
| iPhone Max             | 430 × 932           | iPhone 15 Pro Max         | ✅ covered |
| Large phone / foldable | 480 × …             | Android large             | ✅ covered (`.mobile-toggle` triggers at 768; 480 has tighter kpi) |
| Foldable cover         | 540 × …             | Pixel Fold cover          | ✅ same band as tablet portrait |
| Foldable cover         | 600 × …             | Samsung Fold cover        | ✅ same band as tablet portrait |
| Tablet portrait        | 768 × 1024          | iPad mini                 | ⚠️ sidebar in hamburger mode — no rail |
| Tablet portrait        | 820 × 1180          | iPad Air                  | ⚠️ same as 768 |
| Tablet portrait        | 834 × 1194          | iPad Pro 11               | ⚠️ same |
| Tablet portrait        | 1024 × 1366         | iPad Pro 12.9             | ⚠️ at the 768 → 1024 boundary the sidebar reappears only at the 1024 cutoff (no 1024 portrait rail) |
| Tablet landscape       | 1024 × 768          | iPad landscape            | ✅ desktop grid (no 1024 rail rule) |
| Tablet landscape       | 1112 × …            | iPad Air landscape        | ✅ desktop grid |
| Tablet landscape       | 1194 × …            | iPad Pro 11 landscape     | ✅ desktop grid |
| Tablet landscape       | 1366 × 1024         | iPad Pro 12.9 landscape   | ✅ desktop grid |
| Desktop                | ≥ 1280              | laptop / monitor          | ✅ |

### Implemented breakpoints (source-derived)

```
1280px          implicit, no rule
1024px          layout.css:471  (grid-4 → 2-col, auth-shell collapse)
 960px          layout.css:565, ux-unified.css:76  (ov-kpi-row, layout-main-sidebar)
 900px          ux-unified.css:58, 83  (kpi-grid-4 → 2-col, layout-two-col)
 768px          layout.css:480, ux-unified.css:220  (sidebar hidden, bottom nav)
 720px          detail-drawer.css:312  (drawer → bottom sheet)
 700px          ux-unified.css:67  (kpi-grid-3 → 2-col)
 640px          task-drawer.css:249, global-search.css, auth.css  (drawer → bottom sheet)
 560px          pages/bills.css  (repeat controls)
 520px          ux-unified.css:59  (kpi-grid-4 → 2-col)
 480px          layout.css:676  (kpi-value font, page-header h2 → 14px)
 2000px         ceo-readability.css (2K override)
 3000px         ceo-readability.css (ultrawide override)
```

**Gap to the Addendum spec:**

* No `1280px` desktop boundary (relies on the sidebar being `var(--sidebar-w)` wide and not collapsing).
* No `1024–1279px` tablet-landscape / small-laptop band — at 1100px the page is already in *desktop* mode, not a hybrid.
* No dedicated `320px` floor (only `480px` is the floor in `layout.css:676`).
* No `@media (orientation: ...)` rules — landscape relies entirely on viewport width.

---

## 3. Per-Viewport QA Matrix

> Screenshot placeholders are intended for a follow-up BrowserStack /
> Playwright run. The **Status** column is the static-analysis verdict.

| # | Device | Viewport | Status | Notes / known issues |
|---|--------|---------:|:------:|----------------------|
| 1 | iPhone SE (1st gen)  | 320 × 568  | ⚠️ | No tested screenshot. Likely OK — `.mobile-toggle` is shown at 768, kpi font already at 22px at 480. **Risk:** form-row grids in main.php inline CSS (`.ct-form-grid`) only collapse at 600px, so 320px phones still see a 3-col grid → horizontal overflow. |
| 2 | Android small        | 360 × 800  | ✅ | Covered by 768 hamburger + 480 kpi shrink. |
| 3 | iPhone 12/13 mini    | 375 × 812  | ✅ | All `.content-area` padding (12px) + bottom-nav safe-area inset fits. |
| 4 | iPhone 12/13/14      | 390 × 844  | ✅ | Same as above. |
| 5 | iPhone Plus / Max    | 414 × 896  | ✅ | Same. |
| 6 | iPhone 15 Pro Max    | 430 × 932  | ✅ | Same. |
| 7 | Pixel Fold cover     | 540 × …    | ✅ | Hamburger mode (since < 768px), 2-col kpi at 520px. |
| 8 | Galaxy Fold cover    | 600 × …    | ✅ | Hamburger mode. |
| 9 | iPad mini            | 768 × 1024 | ⚠️ | Sidebar still hidden behind hamburger; `.ov-kpi-row` collapses to 2-col (good). Drawer is **not** 70–85% wide — it's already a full bottom sheet (since 768 > 720). |
| 10| iPad Air             | 820 × 1180 | ⚠️ | Same as #9 but the dashboard has *no* drawer width reduction. |
| 11| iPad Pro 11          | 834 × 1194 | ⚠️ | Same. |
| 12| iPad Pro 12.9        | 1024 × 1366| ⚠️ | Sidebar still hidden — at 1024 the `max-width:1024` rule is `inclusive`, so the sidebar only reappears **above 1024px**. |
| 13| iPad landscape       | 1024 × 768 | ⚠️ | At 1024 the sidebar shows but the viewport is short; bottom nav still active until <768. |
| 14| iPad Air landscape   | 1112 × …   | ✅ | Full desktop grid. |
| 15| iPad Pro 11 landscape| 1194 × …   | ✅ | Full desktop grid. |
| 16| iPad Pro 12.9 landscape | 1366 × 1024 | ✅ | Full desktop grid. |
| 17| Desktop              | ≥ 1280 × … | ✅ | Sidebar visible, multi-col, table layout, right-side drawer. |

---

## 4. Acceptance Criteria Checklist

### ✅ No horizontal overflow on all sizes

| Size class | Verdict | Source reference |
|-----------:|:-------:|------------------|
| ≤ 480px    | ⚠️ RISK | `.ct-form-grid` (inline CSS in `main.php:811`) collapses at `600px`, not `480px`. Task board columns have `min-width:280px` (layout.css:487) which can overflow on a 320px screen. |
| 481–767px  | ✅ | `grid` sets `1fr` on all grid-2/3/4. `.content-area { overflow-x: hidden }` |
| 768–1023px | ✅ | No fixed-width containers that exceed viewport. |
| 1024–1279px| ✅ | Desktop grid, sidebar occupies ~260px, content area flexes. |
| ≥ 1280px   | ✅ | Wide enough for full layout. |

### ✅ Bottom nav does not cover content

| Size class | Verdict | Source reference |
|-----------:|:-------:|------------------|
| ≤ 767px    | ✅ | `.content-area { padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px)) }` (layout.css:604). Bottom nav height = ~52px + safe-area. |
| ≥ 768px    | ✅ | Bottom nav is `display:none`. |

### ✅ Drawer works on phone and tablet

| Size class | Verdict | Source reference |
|-----------:|:-------:|------------------|
| Phone (≤ 720/640px) | ✅ | `.dd-panel` and `.td-panel` become bottom-sheet (100% width, 92% height, slide-up). |
| Tablet (768–1279px)  | ⚠️ | Drawer is fixed 720px/520px width. On iPad mini (768px) this is 93%/81% — close to the 70–85% spec. On iPad Air/Pro (820–1024px) it's 87%/63%. **No dedicated tablet drawer rule** — width is a function of `min(720px, 94vw)` which is fine for large tablets. |
| Desktop (≥ 1280px)   | ✅ | Right-side drawer, fixed width. |

### ✅ Table/card behavior appropriate per size

| Size class | Verdict | Source reference |
|-----------:|:-------:|------------------|
| ≤ 767px    | ⚠️ **Partial** | Tables stay as tables but wrapped in `overflow-x:auto` containers. The Addendum requires **tables become cards**. Only `col-hide-mobile` hides specific columns (layout.css:499). There is no automatic table-to-card transform. |
| 768–1279px | ✅ | Tables remain tables — readable on tablet width. |
| ≥ 1280px   | ✅ | Full table layout. |

### ✅ Orientation change does not break layout

| Device class | Verdict | Source reference |
|-------------:|:-------:|------------------|
| Phone        | ✅ | Fluid grid, bottom nav stays fixed at bottom, sidebar is overlay. Orientation change reflows content without breakage. |
| Tablet       | ⚠️ | Rotating from portrait (768px) to landscape (1024px) crosses the sidebar show/hide boundary — sidebar appears/disappears. No `transition` animation at this boundary. The layout reflows but it's a jarring UX jump. |

### ✅ Dashboard, Tasks, Bills, Calendar, Inbox all usable

| Page        | Verdict | Notes |
|-------------|:-------:|-------|
| Dashboard (Overview) | ✅ | KPI grid, store groups, project cards — all use responsive grids. |
| Tasks (My Tasks)     | ✅ | Filter bar wraps, task list is vertical. |
| Bills                | ⚠️ | Bill table has `.repeat-controls` that only collapse at 560px. Bill detail uses drawer (OK). |
| Calendar             | ✅ | Calendar cells scale down at 768px (`min-height:55px`). Task font drops to 9px. |
| Inbox                | ✅ | Simple list layout, no grid complexity. |

### ✅ Safari iOS specifically passes

**NOT TESTED** — Static analysis flags:
- `env(safe-area-inset-bottom)` usage is iOS Safari-safe ✅
- `-webkit-backdrop-filter` is prefixed in drawers ✅
- `-webkit-overflow-scrolling: touch` is present in dashboard.css ✅
- No `position: fixed` inside overflow containers (iOS bounce bug risk)
- **Risk:** `100vh` on `.sidebar { height: 100vh }` doesn't account for Safari's URL bar — should use `100dvh` for modern Safari.

### ✅ Android Chrome specifically passes

**NOT TESTED** — Static analysis flags:
- `env(safe-area-inset-bottom)` is ignored on Android (safe) ✅
- No iOS-only CSS hacks that would break Android ✅
- Touch event handling in app.js swipe logic is generic ✅

---

## 5. Gap Analysis — What Needs Fixing

### Critical (must fix for full addendum compliance)

| # | Issue | Current state | Fix required |
|---|-------|--------------|--------------|
| C1 | **No tablet sidebar rail (768–1279px)** | Sidebar hidden behind hamburger at 768–1024px | Add `@media (min-width:768px) and (max-width:1279px)` that shows sidebar as a collapsed icon-rail (60–72px wide). |
| C2 | **No table→card transform (≤767px)** | Tables remain tabular, only hidden columns via `col-hide-mobile` | Add `@media (max-width:767px)` rule: `.data-table, .list-table` → card layout (each `<tr>` becomes a card with stacked cells). |
| C3 | **Drawer width not 70–85% on tablet** | Drawer is `min(720px, 94vw)` — too wide on iPad mini, fine on iPad Pro | Add `@media (min-width:768px) and (max-width:1024px)` for `.dd-panel { width: 78vw }` and `.td-panel { width: 78vw }`. |

### Important (should fix for polish)

| # | Issue | Fix |
|---|-------|-----|
| I1 | **No 1280px desktop breakpoint** | Add `@media (min-width:1280px)` for desktop-specific rules (multi-col, sidebar-rail → full sidebar). |
| I2 | **Breakpoint drift** — `960px`, `900px`, `700px`, `520px` in ux-unified.css overlap with the spec's `480 / 768 / 1024 / 1280` | Consolidate to the spec's 5 bands. Remove intermediate breakpoints or add explicit rationale. |
| I3 | **320px small-phone risk** — `.ct-form-grid` collapses at 600px but has 3-col → overflow at 320px | Lower the collapse to `max-width:480px` or add `min-width:0` on grid children. |
| I4 | **No `100dvh` fallback** for sidebar and bottom nav | Add `height: 100dvh` with `height: 100vh` fallback for Safari URL bar handling. |
| I5 | **`orientation: landscape` not handled** | Add `@media (orientation: landscape) and (max-height:500px)` to collapse bottom nav and shrink header on landscape phones. |

### Nice-to-have (minor polish)

| # | Issue | Fix |
|---|-------|-----|
| N1 | Board columns `min-width:280px` overflow on 320px screens | Add `min-width:0; overflow-x:auto` on the board container. |
| N2 | `.ov-kpi-row` and `.ov-perf-grid` breakpoints at `960 / 900 / 768 / 480` could unify to the spec's bands | Consolidate. |
| N3 | Create Task modal `.ct-form-grid` inline styles should use the same responsive system as the main CSS files | Move to a dedicated CSS file and align breakpoints. |

---

## 6. iOS Safari Specific Notes

| Concern | Status | Detail |
|---------|:------:|--------|
| `100vh` height bug (URL bar) | ⚠️ | `.sidebar { height: 100vh }` (layout.css:11). On iOS Safari, `100vh` includes the URL bar area. Should use `100dvh`. |
| `env(safe-area-inset-bottom)` | ✅ | Used in `.mobile-bottom-nav` and `.content-area` padding. |
| `-webkit-backdrop-filter` | ✅ | Prefixed in `.dd-backdrop` and `.td-backdrop`. |
| `-webkit-overflow-scrolling: touch` | ✅ | Present in `pages/dashboard.css`. |
| Sticky header z-index | ✅ | `.page-header { position: sticky; top: 0; z-index: 50 }` — works on Safari. |
| Position fixed inside overflow | ✅ | Drawers use `position: fixed; inset: 0` — not inside a scroll container. |
| PWA viewport meta | ✅ | `<meta name="viewport" content="width=device-width, initial-scale=1.0">` + `apple-mobile-web-app-capable`. |
| Touch event prevention | ⚠️ | No `touch-action: manipulation` on interactive elements — may cause 300ms tap delay on older iOS. |

---

## 7. Follow-Up Tasks

| Priority | Task | Status |
|:--------:|------|:------:|
| P0 | Live-test all 17 viewports in BrowserStack (iOS Safari, Android Chrome) | 📋 TODO |
| P0 | Fix table→card transform for ≤767px | 📋 TODO |
| P0 | Add tablet sidebar rail (768–1279px) | 📋 TODO |
| P0 | Add tablet drawer width rule (78vw at 768–1024) | 📋 TODO |
| P1 | Add `100dvh` fallback for sidebar and bottom nav | 📋 TODO |
| P1 | Consolidate breakpoints to 5-band spec | 📋 TODO |
| P1 | Fix 320px small-phone overflow (form grids) | 📋 TODO |
| P1 | Add `orientation: landscape` handling for phones | 📋 TODO |
| P2 | Add `touch-action: manipulation` to interactive elements | 📋 TODO |
| P2 | Move Create Task modal inline styles to dedicated CSS | 📋 TODO |

---

*Generated by static source audit — `reports/RESPONSIVE_DEVICE_MATRIX.md`*
*Last updated: 2026-06-16*
