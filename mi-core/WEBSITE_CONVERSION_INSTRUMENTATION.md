# Website Conversion Instrumentation — Phase 34F
**Generated:** 2026-06-25

## Status: CONVERSION_EVENTS_LIVE

Both brands instrumented. Bakudan: full manual onclick tracking. Raw Sushi: auto-detection layer already present + modal CTAs manually instrumented.

---

## Bakudan Ramen — bakudanramen.com

**GA4 Tag:** G-3GZ2RYDR6M (already present in all files)
**trackEvent helper added to:** index.html, order.html, locations.html, menu.html

### Files Modified

| File | Events Added |
|------|-------------|
| `index.html` | order_click (5), menu_click (3), phone_click (3) |
| `order.html` | phone_click (6), order_click (3) |
| `locations.html` | phone_click (6), order_click (3), directions_click (3), location_view (1) |
| `menu.html` | order_click (3), menu_click (1), phone_click (3) |

### CTA Inventory — Bakudan

| CTA Type | Count | Pages | Event |
|----------|-------|-------|-------|
| Order Now / Order Online (nav) | 2/page | index, order, locations, menu | `order_click` |
| Order Online (hero) | 1 | index | `order_click` |
| Toast order buttons (per location) | 3 | order, locations | `order_click` |
| View Menu / View Full Menu | 4 | index, menu | `menu_click` |
| Phone links (tel:) | 3/page | index, order, locations, menu | `phone_click` |
| Get Directions (Google Maps) | 3 | locations | `directions_click` |
| Order Delivery Now (popup) | 1 | index | `order_click` |
| location_view page event | 1 | locations | `location_view` |

### Event Labels Used

- `nav_order_now` — desktop nav
- `mobile_nav_order_now` — mobile nav
- `hero_order_online` — hero section
- `hero_view_menu` — hero section
- `cta_section_order_now` — mid-page CTA band
- `toast_bandera` / `toast_stone_oak` / `toast_the_rim` — Toast order links
- `order_card_bandera` / `order_card_stone_oak` / `order_card_the_rim` — order page phone
- `footer_bandera` / `footer_stone_oak` / `footer_the_rim` — footer phone
- `locations_bandera` / `locations_stone_oak` / `locations_the_rim` — locations page phone
- `footer_view_menu` / `footer_order_online` — footer explore links
- `popup_order_delivery` — delivery popup
- `menu_section_view_full` — menu section
- `locations_page` — location_view event

### trackEvent Helper (added once per file)

```js
function trackEvent(eventName, params) {
  if (typeof gtag !== 'undefined') { gtag('event', eventName, params); }
}
```

---

## Raw Sushi Bar — rawsushibar.com

**GA4 Tag:** G-WNHH66NT41 (loaded via `analytics.js`)
**Auto-detection layer:** analytics.js already captures tel:, toasttab.com, doordash.com, google.com/maps, menu-, order-sushi links automatically via click event listener.

### Files Modified

| File | Changes |
|------|---------|
| `index.html` | Manual trackEvent added to 5 modal CTAs (openLocationModal calls use href="#" so auto-detection misses them) |
| `stockton.html` | location_view event added after analytics.js load |
| `modesto.html` | location_view event added after analytics.js load |

### Files NOT Modified (auto-detection covers them)

| File | Coverage |
|------|---------|
| `order-sushi-stockton.html` | data-track attributes already present on all order buttons; auto-detection fires on toasttab.com, doordash.com, tel: links |
| `order-sushi-modesto.html` | data-track attributes on call buttons; auto-detection fires on tel:, doordash.com links |
| `stockton.html` | Auto-detection fires on tel:, google maps, order-sushi, menu- links |
| `modesto.html` | Auto-detection fires on tel:, google maps, menu- links |

### CTA Inventory — Raw Sushi

| CTA Type | Count | Coverage |
|----------|-------|---------|
| Order Online modal (index nav) | 1 | Manual onclick trackEvent |
| Order Online modal (index hero) | 1 | Manual onclick trackEvent |
| View Menu modal (index hero) | 1 | Manual onclick trackEvent |
| View Full Menu modal (index) | 1 | Manual onclick trackEvent |
| Order Now modal (index signup) | 1 | Manual onclick trackEvent |
| Order Online modal (index CTA) | 1 | Manual onclick trackEvent |
| Toast order links (order pages) | 2 | Auto-detection (toasttab.com) |
| DoorDash order links | 2 | Auto-detection (doordash.com) |
| Phone links (tel:) | multiple | Auto-detection (tel:) |
| Google Maps directions | multiple | Auto-detection (google.com/maps) |
| Menu page links | multiple | Auto-detection (menu-) |
| Order page links | multiple | Auto-detection (order-sushi) |
| location_view (stockton) | 1 | Manual script tag |
| location_view (modesto) | 1 | Manual script tag |

### Modal CTAs — Why Manual Tracking Required

Raw Sushi uses `openLocationModal('order')` with `href="#"`. The analytics.js auto-detection checks `href` for patterns like `toasttab.com`, `tel:`, etc. — `href="#"` matches none of these, so modal-triggered CTAs were invisible to GA4. Manual `trackEvent()` calls added directly in onclick handlers.

---

## Summary

| Brand | GA4 Tag | Events Live | Files Modified | Status |
|-------|---------|-------------|----------------|--------|
| Bakudan | G-3GZ2RYDR6M | order_click, menu_click, phone_click, directions_click, location_view | 4 | LIVE |
| Raw Sushi | G-WNHH66NT41 | order_click, menu_click, phone_click, directions_click, location_view + auto-detection | 3 | LIVE |

**Overall Status: CONVERSION_EVENTS_LIVE**
