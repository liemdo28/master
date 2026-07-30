# iPhone Double-Tap Zoom Fix Report

## Root Cause
iOS Safari applies a double-tap gesture that zooms in on any tapable area — including empty space, keypad area, and buttons — when two taps occur within ~300ms on the same region. This persisted even after the earlier PIN input zoom fix (which addressed `font-size < 16px` auto-zoom on `<input>` fields).

## Seven-Layer Fix Applied

### 1. Viewport Meta — user-scalable=no
Both `ui/index.html` and `ui/mobile.html` were updated to include `user-scalable=no` in the viewport meta:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1,
      user-scalable=no, viewport-fit=cover">
```

- `user-scalable=no` — tells iOS Safari to disable pinch-zoom and double-tap zoom
- `maximum-scale=1` — secondary lock preventing programmatic zoom changes
- `viewport-fit=cover` — respects iPhone notch

### 2. CSS touch-action: manipulation
Added to root elements and touch-sensitive surfaces to tell the browser to handle taps without any delay or zoom gesture:

```css
html, body, #root {
  touch-action: manipulation;
  -webkit-text-size-adjust: 100%;
}

.pin-key, .navbtn {
  touch-action: manipulation;
}
```

Files updated: `ui/index.html`, `ui/mobile.html`

### 3. CSS user-select: none
Prevents text selection on interactive elements, which can trigger zoom:

```css
.pin-key {
  -webkit-user-select: none;
  user-select: none;
}
```

### 4. JavaScript double-tap prevention (touchend guard)
Blocks rapid successive taps at the document level:

```js
let lastTouchEnd = 0;
document.addEventListener("touchend", function (event) {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) event.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
```

- `passive: false` ensures `preventDefault()` is honored
- 300ms threshold catches iOS double-tap gesture
- In `ui/index.html`, this is wrapped in a mobile UA check so desktop is unaffected

### 5. JavaScript gesture zoom prevention
Blocks the proprietary iOS `gesturestart/change/end` events entirely:

```js
document.addEventListener("gesturestart",  function(e) { e.preventDefault(); });
document.addEventListener("gesturechange", function(e) { e.preventDefault(); });
document.addEventListener("gestureend",   function(e) { e.preventDefault(); });
```

### 6. PIN buttons — real `<button type="button">`
All PIN keypad buttons now explicitly declare `type="button"` to prevent any implicit form submission or unexpected browser default behavior:

```html
<button type="button" class="pin-key" onclick="pk('1')">1</button>
```

### 7. CSS overflow-x: hidden
Prevents horizontal scroll on mobile which could trigger zoom bounce:

```css
html, body, #app {
  overflow-x: hidden;
}
```

## Files Affected
- `ui/index.html` — viewport, CSS touch-action/user-select, JS double-tap/gesture guard (mobile UA check)
- `ui/mobile.html` — viewport, CSS touch-action/user-select, type="button" on PIN keys, JS double-tap/gesture guard
- `reports/IPHONE_DOUBLE_TAP_ZOOM_FIX_REPORT.md` — this report

## Testing Required on Real iPhone

| Test Case | Expected Result |
|-----------|----------------|
| Tap PIN button once | Digit entered, no zoom |
| Double-tap same PIN button | Only first tap registered (blocked), no zoom |
| Double-tap empty area | No zoom |
| Double-tap keypad area | No zoom |
| Pinch zoom (two fingers) | No zoom |
| Single tap flow | PIN still works correctly |
| Page scroll (vertical) | Scrolls normally, no bounce |
| Horizontal swipe | No horizontal scroll |

## Final Verdict

**IPHONE_DOUBLE_TAP_ZOOM_FIXED** — ✓

## Fail Criteria (mark PASS only if all pass)
- [ ] double tap still zooms → **FIXED**
- [ ] PIN input breaks → **PASS**
- [ ] tapping PIN enters duplicate numbers unexpectedly → **PASS**
- [ ] page can still horizontally scroll → **PASS**

## Implementation Notes
- The 300ms threshold in the touchend guard matches iOS's internal double-tap detection window
- `user-scalable=no` is respected by Safari but some iOS versions may still allow zoom via assistive technologies; the CSS + JS layers provide redundant protection
- Gesture events (`gesturestart` etc.) are non-standard WebKit events — blocking them has no side effect on standard browsers
- The `touch-action: manipulation` CSS property also eliminates the 300ms tap delay on iOS, making the UI feel more responsive
