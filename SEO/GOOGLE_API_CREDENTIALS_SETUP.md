# Google API Credentials Setup Guide

## Overview
GSC, GBP, and GA4 connectors require Google API credentials to pull real data.
This guide explains how to set them up.

## Option 1: Service Account (Recommended)

### Steps:
1. Go to Google Cloud Console: https://console.cloud.google.com
2. Create a new project or select existing
3. Enable APIs:
   - Search Console API (for GSC)
   - Google Business Profile API (for GBP)
   - Google Analytics Data API (for GA4)
4. Create Service Account:
   - IAM & Admin → Service Accounts → Create
   - Name: `seo-connector`
   - Role: None (skip)
   - Create key → JSON → Download
5. Place JSON file in a secure location (not in git)
6. Share the Google Search Console property with the service account email
7. Share the GA4 property with the service account email

### .env keys:
```bash
GOOGLE_SERVICE_ACCOUNT_JSON=C:\\path\\to\\service-account.json
```

## Option 2: OAuth2

### Steps:
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application or Desktop)
3. Download client ID and secret
4. Generate refresh token using OAuth Playground:
   - https://developers.google.com/oauthplayground
   - Select the APIs you need
   - Authorize and exchange for refresh token

### .env keys:
```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token
```

## Property/Site IDs

### GSC Property:
```bash
GSC_SITE_URL=sc-domain:bakudanramen.com
# or: https://bakudanramen.com/
```

### GA4 Property:
```bash
GA4_PROPERTY_ID=123456789  # Numeric property ID from GA4
```

## Validation
Run: `node SEO/shared/base/validate-google-credentials.js`

## Security
- Never commit .env or JSON files to git
- Add .env to .gitignore
- Store JSON keys outside project directory
- Rotate credentials periodically

