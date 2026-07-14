/**
 * SEO Control Center — CTA Engine (spec §16).
 * Resolves a CTA type to a concrete {label, url} for a specific brand+location,
 * pulling real URLs from brand-config.ts's LocationRecord or, as a fallback,
 * from a location-specific seo_site_pages row.
 *
 * HARD RULE (spec §16): never fall back to a generic homepage URL when a
 * location-specific URL doesn't exist for the requested CTA type. If no
 * usable location-specific source exists, resolveCta returns null and lets
 * the caller decide (omit the CTA, try a different type, etc.) — it never
 * silently substitutes loc.website_url or a brand homepage as a stand-in.
 */

import { getLocationById, type LocationRecord } from '../brand-config';
import { getSeoDb } from '../seo-db';

export type CtaType =
  | 'view_menu'
  | 'order_online'
  | 'get_directions'
  | 'make_reservation'
  | 'call_restaurant'
  | 'visit_location'
  | 'view_specials'
  | 'read_reviews'
  | 'contact_us';

export interface ResolvedCta {
  label: string;
  url: string;
}

const CTA_LABELS: Record<CtaType, string> = {
  view_menu: 'View Menu',
  order_online: 'Order Online',
  get_directions: 'Get Directions',
  make_reservation: 'Make a Reservation',
  call_restaurant: 'Call Us',
  visit_location: 'Visit Us',
  view_specials: 'View Specials',
  read_reviews: 'Read Reviews',
  contact_us: 'Contact Us',
};

function isConfigured(value: string | undefined | null): value is string {
  return !!value && value !== 'needs_config';
}

function directionsUrl(loc: LocationRecord): string | null {
  if (loc.geo && typeof loc.geo.lat === 'number' && typeof loc.geo.lng === 'number') {
    return `https://www.google.com/maps/dir/?api=1&destination=${loc.geo.lat},${loc.geo.lng}`;
  }
  if (isConfigured(loc.address)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(loc.address)}`;
  }
  return null;
}

function telUrl(phone: string | undefined): string | null {
  if (!isConfigured(phone)) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

/**
 * Fall back to a location-specific seo_site_pages row of the requested type
 * (never a brand-wide/home page — location_id must match exactly) when
 * brand-config.ts has no matching structured field for this CTA type.
 */
function resolveFromLocationPage(brandId: string, locationId: string, pageType: 'money' | 'menu' | 'location', label: string): ResolvedCta | null {
  const row = getSeoDb().prepare(`
    SELECT url FROM seo_site_pages
    WHERE brand_id = ? AND location_id = ? AND page_type = ? AND deleted_at IS NULL
    ORDER BY updated_at DESC LIMIT 1
  `).get(brandId, locationId, pageType) as { url: string } | undefined;
  return row ? { label, url: row.url } : null;
}

export function resolveCta(brandId: string, locationId: string, ctaType: CtaType): ResolvedCta | null {
  const loc = getLocationById(brandId, locationId);
  if (!loc) return null;

  switch (ctaType) {
    case 'view_menu': {
      if (isConfigured(loc.menu_url)) return { label: CTA_LABELS.view_menu, url: loc.menu_url };
      return resolveFromLocationPage(brandId, locationId, 'menu', CTA_LABELS.view_menu);
    }

    case 'order_online': {
      if (isConfigured(loc.order_url)) return { label: CTA_LABELS.order_online, url: loc.order_url };
      return resolveFromLocationPage(brandId, locationId, 'money', CTA_LABELS.order_online);
    }

    case 'get_directions': {
      const url = directionsUrl(loc);
      return url ? { label: CTA_LABELS.get_directions, url } : null;
    }

    case 'make_reservation': {
      // LocationRecord has no dedicated reservation field. order_url is only
      // reused here if it visibly points at a reservation/booking platform —
      // never assumed. No match => null, never a homepage/order fallback.
      if (isConfigured(loc.order_url) && /reserv|opentable|booking|resy/i.test(loc.order_url)) {
        return { label: CTA_LABELS.make_reservation, url: loc.order_url };
      }
      return null;
    }

    case 'call_restaurant': {
      const url = telUrl(loc.phone);
      return url ? { label: CTA_LABELS.call_restaurant, url } : null;
    }

    case 'visit_location': {
      if (isConfigured(loc.website_url)) return { label: CTA_LABELS.visit_location, url: loc.website_url };
      return resolveFromLocationPage(brandId, locationId, 'location', CTA_LABELS.visit_location);
    }

    case 'view_specials': {
      // No structured "specials" field exists — only resolvable via a
      // location-scoped money page; otherwise null (no homepage fallback).
      return resolveFromLocationPage(brandId, locationId, 'money', CTA_LABELS.view_specials);
    }

    case 'read_reviews': {
      // No reviews-platform field exists on LocationRecord or seo_site_pages;
      // returning null rather than fabricating a Yelp/Google review URL.
      return null;
    }

    case 'contact_us': {
      if (isConfigured(loc.website_url)) return { label: CTA_LABELS.contact_us, url: loc.website_url };
      return null;
    }

    default:
      return null;
  }
}
