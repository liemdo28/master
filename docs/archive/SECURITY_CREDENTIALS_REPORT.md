# SECURITY CREDENTIALS REPORT

**Date:** 2026-06-10  
**Status:** Credential source hardening applied

## Finding

`server/client_secret_*.json` contained a Google OAuth client secret in source. The runtime already supports environment variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

## Changes

- Added secret patterns to `mi-core/.gitignore`.
- Documented Google OAuth env setup in `server/.env.example`.
- Removed the local `server/client_secret_*.json` file from git tracking while leaving it on disk.

## Required Owner Action

Rotate the exposed Google OAuth client secret in Google Cloud Console. Treat the old secret as compromised because it existed in the working tree.

After rotation, set the new values in `server/.env` and restart Mi Core.

