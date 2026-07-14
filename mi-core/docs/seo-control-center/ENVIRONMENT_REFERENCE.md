# SEO Control Center Environment Reference

Required read-only safety flags:
- `SEO_CONTROL_CENTER_MODE=read_only`
- `SEO_AUTOMATION_ENABLED=false`
- `SEO_PRODUCTION_PUBLISH_ENABLED=false`
- `SEO_GBP_WRITE_ENABLED=false`
- `SEO_WEBSITE_WRITE_ENABLED=false`
- `SEO_BACKLINK_WRITE_ENABLED=false`
- `GOOGLE_CONNECTOR_WRITE_ENABLED=false`

Trusted auth:
- `MI_AUTH_DEFAULT_USER` selects the server-side account mapping.
- `MI_AUTH_USER_MAP_JSON` stores role, actor ID, brand scope, and location scope.
- Request body identity, role, brand scope, and location scope are ignored for login privilege assignment.

Never print or commit:
- PIN or PIN hash.
- OAuth credentials or tokens.
- Cookies or browser profiles.
- API keys.
- Local SQLite databases.
- Runtime logs or screenshots.

Connector status values:
- `CONNECTED_READ_ONLY`
- `BLOCKED_CREDENTIAL_REFRESH_REQUIRED`
- `BLOCKED_PERMISSION`
- `BLOCKED_PROPERTY_MAPPING`
- `FAILED_API`

Disabled dependency paths:
- Excel/XLSX parsing and generation are disabled because the previous `xlsx` dependency had high-severity advisories.
- Use CSV/JSON/PDF/DOCX ingestion until a maintained parser/writer replacement is approved.

Manual gates still required:
- Google OAuth authorization by the account owner.
- GitGuardian historical synthetic fixture incidents `34784093` and `34784094` are `RESOLVED_AS_FALSE_POSITIVE`; PR check status is `CHECK_STATUS_SKIPPING`.
- Explicit CEO approval before any live website or GBP canary.
