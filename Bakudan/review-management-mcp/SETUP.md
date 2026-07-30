# Review Management MCP — Setup Guide

Headless Google review automation using GBP API + OAuth refresh token.
**No browser needed after the one-time setup below.**

---

## Step 1 — Install dependencies

```bash
cd Bakudan/review-management-mcp
npm install && npm run build
```

---

## Step 2 — Create Google Cloud credentials (once)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → Enable **"Google My Business API"**
3. Create **OAuth 2.0 Client ID** (type: Web application)
4. Add authorized redirect URI: `http://localhost:8080`
5. Copy **Client ID** and **Client Secret** into `.env`

```bash
cp .env.example .env
# Edit .env with your GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
```

---

## Step 3 — One-time OAuth authorization

```bash
node scripts/reauth.mjs
```

This opens a browser window, you sign in with Google, and it automatically
patches `.env` with `GOOGLE_REFRESH_TOKEN`. After this, everything is headless.

---

## Step 4 — Discover location IDs

```bash
node scripts/test-connection.mjs
```

Lists all your GBP locations with IDs and street addresses.
Copy the IDs into `.env` as `GOOGLE_LOCATION_ID_*` variables.

Also set `GOOGLE_ACCOUNT_ID` from the output.

---

## Step 5 — Test the auto-responder

```bash
bash scripts/auto-respond.sh
```

Check `logs/auto-respond.log` to verify it worked.

---

## Step 6 — Schedule it (every 12 hours)

**macOS (launchd):**
```bash
# Edit launchd/com.bakudan.review-responder.plist — update paths
cp launchd/com.bakudan.review-responder.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.bakudan.review-responder.plist
launchctl list | grep bakudan
```

**Linux (cron):**
```bash
crontab -e
# Add: 0 8,20 * * * /path/to/scripts/auto-respond.sh
```

**Windows (Task Scheduler):**
```
Action: Run bash.exe -c "/path/to/scripts/auto-respond.sh"
Trigger: Daily, repeat every 12 hours
```

---

## Day-to-day

| What | Where |
|------|-------|
| Auto-posted responses | Google Business Profile (live) |
| Pending 1-3★ drafts | `logs/pending-reviews.json` |
| Manager email alerts | Configured in `.env` per location |
| Full activity log | `logs/auto-respond.log` |
| Manual run | `bash scripts/auto-respond.sh` |

---

## Locations configured

| Key | Name | Env var |
|-----|------|---------|
| `raw-sushi-stockton` | Raw Sushi Bistro (Stockton) | `GOOGLE_LOCATION_ID_RAW_SUSHI_STOCKTON` |
| `bakudan-bandera` | Bakudan Ramen (Bandera) | `GOOGLE_LOCATION_ID_BAKUDAN_BANDERA` |
| `bakudan-rim` | Bakudan Ramen (The Rim) | `GOOGLE_LOCATION_ID_BAKUDAN_RIM` |
| `bakudan-stone-oak` | Bakudan Ramen (Stone Oak) | `GOOGLE_LOCATION_ID_BAKUDAN_STONE_OAK` |

---

## Re-authorization (if needed)

Token is revoked if you change your Google password or manually revoke access.
Just run reauth.mjs again:

```bash
node scripts/reauth.mjs
```

---

## Comparison with review-automation-system

| | `review-automation-system` | `review-management-mcp` |
|--|--|--|
| Google fetch | Playwright browser | GBP API (headless) |
| Google post reply | Playwright browser | GBP API (headless) |
| Setup | Session login in browser | OAuth once → token forever |
| Resource usage | Heavy (Chromium) | Lightweight (HTTP only) |
| Fragility | Breaks on UI changes | Stable API |
