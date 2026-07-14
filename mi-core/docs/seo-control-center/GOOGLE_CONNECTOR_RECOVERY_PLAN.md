# SEO Control Center Google Connector Recovery Plan

Date: 2026-07-13
Scope: GSC, GA4, and GBP OAuth refresh recovery for controlled preview.

## Current Status

Local connector checks using the configured SEO environment reached Google OAuth but returned `invalid_grant` for:

- Google Search Console
- Google Analytics 4
- Google Business Profile

No token values are documented here. Treat all existing refresh tokens as expired, revoked, malformed, or issued for a mismatched OAuth client until proven otherwise.

## Recovery Steps

1. Confirm OAuth client alignment in the Google Cloud Console:
   - Client ID and client secret match the values used by Mi-Core.
   - Redirect URI matches the route used by the local auth flow.
   - OAuth consent app includes the intended user as a test or production user.

2. Re-authorize with the correct Google account:
   - Use the Mi-Core Google OAuth start route from a browser session owned by the operator.
   - Grant the required scopes for GSC, GA4, and GBP.
   - Do not paste refresh tokens into chat or reports.

3. Replace stored tokens only through the existing auth callback/storage path.

4. Re-run connector health checks:
   - GSC: verify site access and at least one read-only query.
   - GA4: verify property access and one read-only report call.
   - GBP: verify account/location listing or read-only location fetch.

5. Update the certification verdict only after live read calls pass.

## Preview Boundary

Until the above checks pass, SEO Control Center may run in controlled preview for:

- Local database operations
- Draft generation
- Preview-only publishing adapters
- Read-only dashboard views that clearly show connector degraded/blocked state

It must not claim live Google data freshness for GSC, GA4, or GBP while `invalid_grant` remains unresolved.
