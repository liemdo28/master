# Dependency Audit — dashboard.bakudanramen.com
**Date:** 2026-05-20

## Stack Detected

| Area | Result |
|---|---|
| Application type | PHP MVC / PWA |
| Frontend framework | Vanilla JavaScript, no React/Next runtime |
| Node package manifest | Not present |
| Composer manifest | Not present |
| Lockfiles | Not present |
| Runtime dependency source | First-party PHP classes, browser JS, PHP extensions |

## Requested Node/Next Checks

| Check | Status | Notes |
|---|---|---|
| Duplicate npm package | Not applicable | No `package.json` in repo |
| Version conflict | Not applicable | No npm/composer dependency graph |
| Deprecated package | Not applicable | No package manager metadata |
| Unused dependency | Not applicable | No third-party package manifest |
| React/Next compatibility | Not applicable | App is not React/Next |

## Source-Level Findings

| Finding | Status | Notes |
|---|---|---|
| PHP syntax | Pass | Full `php -l` scan completed |
| JS syntax | Pass | `node --check assets/js/*.js` completed |
| Shell syntax | Pass | `bash -n scripts/stress-test.sh` completed |
| PHP deprecation | Fixed | Replaced deprecated local `$http_response_header` access in `service/OpenAIService.php` fallback paths |
| Background polling | Hardened | Notification/sidebar polling now aborts stale requests, skips hidden tabs, and uses retry backoff |

## Risk Notes

- No npm install was run because the project has no Node dependency manifest. Running `npm install` here would create unrelated lockfiles and not validate this PHP app.
- No Composer install was run because the project has no `composer.json`.
- Production dependency risk is mainly PHP version/extension compatibility and MySQL schema/index health, not package resolution.
