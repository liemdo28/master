# STORE MOBILE CERTIFICATION

**Date:** 2026-06-22  
**Status:** ⚠️ PARTIAL — CSS ready, screenshots pending device testing

## Responsive CSS Implementation

### Store Command Center Index (`views/admin/store_command/index.php`)
```css
.sc-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
@media(max-width:1100px) { .sc-grid { grid-template-columns: repeat(2, 1fr); } }
@media(max-width:600px) { .sc-grid { grid-template-columns: 1fr; } }
```

### Store Command Center Show (`views/admin/store_command/show.php`)
```css
.scs-stats { grid-template-columns: repeat(4, 1fr); }
.scs-main { grid-template-columns: 2fr 1fr; }
@media(max-width:1100px) { .scs-stats { grid-template-columns: repeat(2, 1fr); } .scs-main { grid-template-columns: 1fr; } }
@media(max-width:600px) { .scs-stats { grid-template-columns: 1fr; } }
```

### Store List (`views/admin/stores.php`)
- Uses existing `.data-table` responsive pattern
- Health drawer: `max-width: 95vw` on mobile

## Target Devices
| Device | Viewport | Expected Behavior |
|--------|----------|-------------------|
| iPhone 15 | 393×852 | 1 card/row, stacked stats, full-width drawer |
| iPhone 15 Plus | 430×932 | 1 card/row, stacked stats |
| Galaxy S23 | 360×780 | 1 card/row, stacked stats |
| iPad Air | 820×1180 | 2 cards/row, 2-col stats |
| Desktop | 1920×1080 | 4 cards/row, 4-col stats |

## Required Testing
- [ ] iPhone 15 screenshot
- [ ] iPhone 15 Plus screenshot
- [ ] Galaxy S23 screenshot
- [ ] iPad Air screenshot
- [ ] Desktop screenshot
- [ ] Health drawer scroll on mobile
- [ ] Store card tap targets (min 44×44px)

## Notes
All CSS uses `rem`-based sizing and `vw` fallbacks. Health drawer uses `max-width: 95vw` to prevent overflow on small screens. Card grid uses `minmax(0, 1fr)` for proper flex behavior.
