# MI Responsive UI Redesign Report

## Overview
Complete responsive overhaul of Mi UI. Merged separate `index.html` (desktop) and `mobile.html` into a single responsive shell that adapts to all screen sizes.

## Architecture
- **Single HTML file** (`ui/index.html`) with CSS + JS
- **CSS custom properties** for theming (dark premium)
- **Minified compact CSS** for performance (~5KB)
- **Breakpoint-based layout** with 5 tiers

## Files Changed
| File | Change |
|------|--------|
| `ui/index.html` | Complete rewrite — responsive assistant shell |
| `ui/mobile.html` | Updated viewport + font-size for iPhone zoom fix |

## Key Decisions
1. Compact class names (e.g., `.shell`, `.hdr`, `.mchip`) to keep file small
2. All interactive elements ≥ 44px tap target
3. `font-size: 16px!important` on inputs globally to prevent iPhone zoom
4. `env(safe-area-inset-*)` for iPhone notch/home bar
5. Viewport: `maximum-scale=1, viewport-fit=cover`

## Remaining
- `mobile.html` still has separate PIN login screen — can be merged if needed
- `approval.html`, `brain.html`, `liveboard.html` remain standalone pages
