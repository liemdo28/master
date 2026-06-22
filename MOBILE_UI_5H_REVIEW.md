# MOBILE_UI_5H_REVIEW
**Generated:** 2026-06-10

---

## Scope

Review `ui/mobile.html` and `ui/index.html` for iPhone/mobile usability issues.
Primary concern: double-tap zoom, input font-size triggering iOS auto-zoom.

---

## Viewport Check — mobile.html

```html
<meta name="viewport" content="width=device-width, initial-scale=1, 
  maximum-scale=1, user-scalable=no, viewport-fit=cover">
```

| Check | Value | Result |
|---|---|---|
| user-scalable=no | YES | ✅ Double-tap zoom disabled |
| maximum-scale=1 | YES | ✅ Pinch zoom blocked |
| viewport-fit=cover | YES | ✅ iPhone notch safe |

---

## Input Font-Size Check — mobile.html

```html
<!-- Chat input found at line 204 -->
<input type="text" id="cin" placeholder="Chat với Mi..." ...>
```

**CSS for input (line 97-99):**
```css
.cinput-row input { 
  flex:1; 
  background:var(--card); 
  border:1px solid var(--border);
  ... 
}
```

**Issue identified:** Chat input (`#cin`) does not have explicit `font-size: 16px` set. iOS Safari auto-zooms inputs with `font-size < 16px`. Default inherited font-size may be below 16px based on parent styles.

**Mitigation present:** `user-scalable=no` and `maximum-scale=1` prevent zoom even if the input triggers it. The zoom trigger is suppressed at the viewport level.

**Risk level:** LOW — viewport constraints prevent any visible zoom behavior.

---

## Touch Behavior Check

```css
html, body, #app { touch-action: manipulation; }
.pin-screen, .mobile-shell { touch-action: manipulation; }
```

✅ `touch-action: manipulation` — disables double-tap-to-zoom at CSS level (separate from viewport)

```css
-webkit-text-size-adjust: 100%;
```
✅ Prevents iOS from auto-scaling text.

---

## Responsive Structure Check

```css
html, body, #app { width: 100%; min-height: 100%; overflow-x: hidden; }
```

✅ No horizontal scroll possible.

---

## index.html Viewport Check

```html
<!-- Confirmed present at line review -->
<meta name="viewport" content="width=device-width, initial-scale=1">
```

**Status:** Basic viewport set. `user-scalable=no` not present — expected, as desktop UI is not a touch-first interface.

---

## Findings

| Finding | Severity | Status |
|---|---|---|
| mobile.html: user-scalable=no present | N/A | ✅ PASS |
| mobile.html: maximum-scale=1 present | N/A | ✅ PASS |
| mobile.html: touch-action: manipulation | N/A | ✅ PASS |
| Chat input font-size < 16px possible | LOW | ⚠️ WARNING — mitigated by viewport |
| index.html: no user-scalable (desktop) | N/A | ✅ Acceptable for desktop |

---

## Recommendation

Add explicit `font-size: 16px` to `.cinput-row input` as defense-in-depth, even though viewport constraints already prevent zoom. One-line fix.

---

## VERDICT: PASS WITH WARNING ⚠️

iPhone double-tap zoom is prevented via viewport + touch-action. One non-critical improvement: explicit `font-size: 16px` on chat input.
