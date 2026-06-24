# GOOGLE MAPS INTEGRATION REPORT — Mi-Core CEO OS
> Generated: 2026-06-16T05:36:00+07:00
> Status: 🔴 NOT IMPLEMENTED — Design & Architecture Ready

---

## Current State

**Google Maps integration does not exist in the codebase.** A comprehensive search across all `.mjs`, `.ts`, and `.md` files returned zero matches for: `maps`, `google maps`, `directions`, `geocoding`, `eta`, `routing`, `distance matrix`.

The CEO directive requires 6 capabilities:
1. Route planning
2. ETA (estimated time of arrival)
3. Traffic-aware routing
4. Place search
5. Geocoding
6. Distance matrix

---

## Required Architecture

### API Key Configuration

**Add to `.env.example`:**
```
# ── Google Maps ──────────────────────────────────────────────────────────────
GOOGLE_MAPS_API_KEY=
# Saved locations for CEO convenience
MI_HOME_ADDRESS=
MI_HOME_GEOCODE=
```

### Google Maps APIs Needed

| API | Purpose | Pricing Tier |
|-----|---------|-------------|
| Directions API | Route planning, ETA, traffic-aware routing | $5/1000 requests |
| Geocoding API | Address ↔ coordinates conversion | $5/1000 requests |
| Places API (New) | Place search, nearby places | $32/1000 requests (basic) |
| Distance Matrix API | Multi-origin/destination distance/time | $5/1000 elements |

**Estimated monthly cost:** $20-50 for CEO personal use

---

## Proposed Implementation

### 1. Server-Side Connector

**File:** `server/src/visibility/connectors/google/maps-connector.ts`

```typescript
// Proposed interface:

export interface RouteResult {
  origin: string;
  destination: string;
  distance: { text: string; value: number }; // meters
  duration: { text: string; value: number }; // seconds
  duration_in_traffic: { text: string; value: number } | null;
  departure_time: string;
  arrival_time: string;
  steps: RouteStep[];
  polyline: string;
  warnings: string[];
}

export interface RouteStep {
  instruction: string;
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  start_location: { lat: number; lng: number };
  end_location: { lat: number; lng: number };
}

export interface PlaceResult {
  place_id: string;
  name: string;
  address: string;
  rating: number | null;
  types: string[];
  location: { lat: number; lng: number };
  distance_meters: number | null;
  duration_seconds: number | null;
}

export interface GeocodeResult {
  formatted_address: string;
  location: { lat: number; lng: number };
  place_id: string;
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

export interface DistanceMatrixResult {
  origins: string[];
  destinations: string[];
  elements: Array<Array<{
    distance: { text: string; value: number };
    duration: { text: string; value: number };
    duration_in_traffic: { text: string; value: number } | null;
    status: string;
  }>>;
}

// Core functions:
export function getRoute(origin: string, destination: string, options?: {
  departure_time?: Date;
  alternatives?: boolean;
  avoid?: string[];
  units?: 'metric' | 'imperial';
}): Promise<RouteResult>;

export function getDistanceMatrix(origins: string[], destinations: string[], options?: {
  departure_time?: Date;
  avoid?: string[];
  units?: 'metric' | 'imperial';
}): Promise<DistanceMatrixResult>;

export function geocode(address: string): Promise<GeocodeResult[]>;

export function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult[]>;

export function searchPlaces(query: string, location?: { lat: number; lng: number }, radius?: number): Promise<PlaceResult[]>;

export function findNearbyPlaces(location: { lat: number; lng: number }, type: string, radius?: number): Promise<PlaceResult[]>;
```

### 2. Local-Agent Connector

**File:** `local-agent/universal-visibility/GoogleMapsVisibilityConnector.mjs`

```javascript
// Proposed interface (follows existing connector pattern):

export class GoogleMapsVisibilityConnector {
  constructor() {
    this.id = 'google-maps';
    this.name = 'Google Maps';
  }

  isConfigured() { /* check GOOGLE_MAPS_API_KEY */ }

  getSnapshot() {
    // Returns: { status, connector, data }
    // Pattern matches GmailVisibilityConnector
  }

  // Read methods:
  getRoute(origin, destination, options) { /* route planning */ }
  getETA(origin, destination) { /* traffic-aware ETA */ }
  searchPlaces(query, location, radius) { /* place search */ }
  geocode(address) { /* address → coordinates */ }
  getDistanceMatrix(origins, destinations) { /* distance/time matrix */ }

  // Convenience methods:
  getRouteToHome(from) { /* uses MI_HOME_ADDRESS */ }
  getRouteToStoneOak(from) { /* common CEO route */ }
  getSummaryText() { /* one-line context for AI */ }
}

export const mapsConnector = new GoogleMapsVisibilityConnector();
```

### 3. Action Service

**File:** `local-agent/action-layer/MapsActionService.mjs`

```javascript
// Maps are READ-ONLY — no approval required
// All route/place/geocode queries are Level 1 (auto-allowed)

export class MapsActionService {
  static getRoute(origin, destination) { /* → auto-allowed */ }
  static getETA(origin, destination) { /* → auto-allowed */ }
  static searchPlace(query) { /* → auto-allowed */ }
  static geocode(address) { /* → auto-allowed */ }
  static getDistanceMatrix(origins, destinations) { /* → auto-allowed */ }
}
```

### 4. ConnectorRegistry Entry

```javascript
{
  connector_id: 'google-maps',
  name: 'Google Maps',
  type: 'api',
  status: 'pending',
  auth_status: 'not_configured',
  last_sync: null,
  read_capability: ['routes', 'eta', 'traffic', 'places', 'geocoding', 'distance'],
  write_capability: [],  // Maps is read-only
  approval_required: false,
  cache_path: 'google-maps/',
  health_status: 'unknown',
  setup_hint: 'Set GOOGLE_MAPS_API_KEY in .env — Google Cloud Console → APIs & Services → Credentials',
}
```

---

## Capability Details

### 1. Route Planning
- **API:** Directions API
- **Endpoint:** `https://maps.googleapis.com/maps/api/directions/json`
- **Parameters:** origin, destination, mode (driving/walking/bicycling/transit), alternatives, avoid
- **Response:** Multiple route options with step-by-step instructions
- **CEO use case:** "Đường từ nhà đến Stone Oak?"

### 2. ETA (Estimated Time of Arrival)
- **API:** Directions API with `departure_time=now`
- **Key:** `duration_in_traffic` field provides real-time ETA
- **CEO use case:** "Giờ này đến Stone Oak bao lâu?"

### 3. Traffic-Aware Routing
- **API:** Directions API with `departure_time=now` + `traffic_model=best_guess`
- **Options:** departure_time (live traffic), traffic_model (best_guess/pessimistic/optimistic)
- **CEO use case:** Route optimization during rush hour

### 4. Place Search
- **API:** Places API (New) — Text Search
- **Endpoint:** `https://maps.googleapis.com/maps/api/place/textsearch/json`
- **Parameters:** query, location bias, type filter, open_now
- **CEO use case:** "Tìm quán sushi gần Stone Oak"

### 5. Geocoding
- **API:** Geocoding API
- **Endpoint:** `https://maps.googleapis.com/maps/api/geocode/json`
- **Parameters:** address (forward) or latlng (reverse)
- **CEO use case:** Convert "123 Main St, San Antonio TX" → coordinates

### 6. Distance Matrix
- **API:** Distance Matrix API
- **Endpoint:** `https://maps.googleapis.com/maps/api/distancematrix/json`
- **Parameters:** origins[], destinations[], mode, departure_time
- **CEO use case:** Compare routes from home vs office to multiple stores

---

## Saved Locations (CEO Convenience)

Pre-configured addresses in env or config:

```javascript
const SAVED_LOCATIONS = {
  home: process.env.MI_HOME_ADDRESS || 'CEO home address',
  stone_oak: 'Stone Oak, San Antonio, TX',
  bandera: 'Bandera, San Antonio, TX',
  raw_stockton: 'Raw Japanese Bistro, Stockton, CA',
  bakudan: 'Bakudan Ramen location',
  office: 'Office address',
};
```

---

## Failure Handling

| Failure | Handling |
|---------|----------|
| API key missing | Return `CONNECTOR_NOT_CONFIGURED` |
| API key invalid | Return `AUTH_EXPIRED` with setup instructions |
| Quota exceeded | Return `QUOTA_EXCEEDED` with reset time |
| Network timeout | 5s timeout, return `NETWORK_ERROR` |
| Invalid address | Return `NOT_FOUND` with suggestions |
| No route found | Return `NO_ROUTE` with alternative suggestions |

---

## Acceptance Test: CEO Scenario

**CEO:** "Đường từ nhà đến Stone Oak giờ này bao lâu?"

**Mi flow:**
1. Intent: `check_status` with domain `transportation` + entity `Stone Oak`
2. Source selection: **Google Maps** (read-only, auto-allowed)
3. Call: `mapsConnector.getRoute(MI_HOME_ADDRESS, 'Stone Oak, San Antonio, TX', { departure_time: new Date() })`
4. Response: "Từ nhà đến Stone Oak giờ này khoảng **23 phút** (14.2 km), traffic đang đông. Nếu đi trước 7PM thì khoảng 18 phút."
5. Audit: Maps query logged as Level 1 (read-only, auto-allowed)

---

## Implementation Priority

| Step | Task | Est. Time |
|------|------|-----------|
| 1 | Add GOOGLE_MAPS_API_KEY to .env | 5 min |
| 2 | Enable Directions + Geocoding APIs in Google Cloud Console | 10 min |
| 3 | Create maps-connector.ts | 2 hours |
| 4 | Create GoogleMapsVisibilityConnector.mjs | 1 hour |
| 5 | Create MapsActionService.mjs | 30 min |
| 6 | Register in ConnectorRegistry + VisibilityHub | 30 min |
| 7 | Add intent patterns to action-intent-engine.ts | 30 min |
| 8 | CEO acceptance test | 15 min |
| **Total** | | **~5 hours** |

---

## Certification Status

**🔴 NOT CERTIFIED — Implementation required before Google Maps can be used as a source.**

All 6 capabilities are architecturally designed and documented above. The codebase has established patterns (ConnectorRegistry, VisibilityHub, ActionService) that make implementation straightforward following existing connector patterns.
