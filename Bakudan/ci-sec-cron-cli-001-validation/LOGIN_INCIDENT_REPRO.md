# LOGIN_INCIDENT_REPRO.md — P0 Login Page Incident Reproduction

**Date:** 2026-06-22
**Production URL:** https://dashboard.bakudanramen.com/login
**Status at investigation:** ✅ RESOLVED

---

## Reproduction Results

### HTTP Status
```
GET https://dashboard.bakudanramen.com/login
HTTP/1.1 200 OK
```

### Response Headers
```
HTTP/1.1 200 OK
Set-Cookie: PHPSESSID=86e8f933b1f98c8e62c352663e15c34d; path=/; secure; HttpOnly; SameSite=Strict
Content-Type: text/html; charset=UTF-8
Cache-Control: no-store, no-cache, must-revalidate
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
```

### PHP Error Log
**Production log path:** `/var/www/html/logs/errors/php-errors.log`

**Last production error:**
```
[16-Jun-2026 15:24:16 UTC] [CONFIG] Missing required environment variables: DB_PASS — check .env file is deployed on the server
```
This was a transient incident (June 16) — `.env` was restored before investigation.

### POST /login Error (Secondary Issue — Fixed)
**Error:** "⚠️ Something went wrong — The server encountered an error. It has been logged."
**Trigger:** POST /login with "Remember Me" checked
**Root cause:** `remember_tokens.token_hash` column mismatch (see LOGIN_ROOT_CAUSE.md)
**Fix deployed:** commit `a720835` — column detection added to `setRememberToken()` and `clearRememberToken()`

### MySQL Error Log
Not applicable for `/login` GET — login form renders without any database query.
For POST, the error was a PHP exception, not a MySQL error log entry.

### Diagnosis at Investigation Time (2026-06-22 09:32 ICT)
| Check | Result |
|---|---|
| GET /login | HTTP 200 ✅ |
| PHPSESSID cookie set | ✅ Secure, HttpOnly, SameSite=Strict |
| CSRF token present | ✅ 64-char hex token embedded |
| Login form rendered | ✅ Email, password, remember_me, submit |
| POST /login | HTTP 302 redirect (correct after fix) ✅ |
| GET /logout | HTTP 200 ✅ |
| GET /password-reset | HTTP 200 ✅ |
| GET /session | HTTP 200 ✅ |
| GET /me | HTTP 200 ✅ |

---

## Conclusion

Two separate issues were found and resolved:

1. **June 16 transient incident:** `.env` missing from DreamHost production server → HTTP 503 → browser shows HTTP 500. Resolved externally before investigation.

2. **POST /login with Remember Me:** `AuthController::setRememberToken()` queries `remember_tokens.token_hash` but production table has `token VARCHAR(255)` → SQL exception → "Something went wrong" error. Fixed by adding dynamic column name detection (`columnExists('token_hash') ? 'token_hash' : 'token'`).
