# PIN Input Zoom Fix Report

## Root Cause
iOS Safari auto-zooms into `<input>` fields when font-size < 16px if the viewport allows user scaling.

## Fix Applied

### Global CSS (all inputs)
```css
input, textarea, select, button {
    font-size: 16px !important;
    font-family: var(--font);
}
```

### Viewport Meta
```html
<meta name="viewport" content="width=device-width, initial-scale=1, 
      maximum-scale=1, viewport-fit=cover" />
```

- `maximum-scale=1` — prevents pinch-zoom that triggers auto-zoom behavior
- `viewport-fit=cover` — respects iPhone notch area
- `width=device-width` + `initial-scale=1` — standard responsive viewport

### Additional Safeguards
- All interactive elements set to `min-height: 44px`
- Safe-area padding via `env(safe-area-inset-*)`
- `-webkit-tap-highlight-color: transparent` prevents flash on tap

## Files Affected
- `ui/index.html` (new responsive shell)
- `ui/mobile.html` (viewport meta updated)
