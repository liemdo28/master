# Language Architecture Report

**Date:** 2026-06-22

## Architecture Overview

### File Structure
```
config/i18n.php          — Core i18n engine (locale registry, translation loader, t() function)
lang/en-US.php           — English (US) language pack (811 keys)
lang/es-US.php           — Spanish (US) language pack (811 keys)
lang/vi-VN.php           — Vietnamese (VN) language pack (811 keys)
scripts/gen_lang.py      — Language file generator (reads i18n.php + new keys)
scripts/verify-translations.php — Translation gate verification
deploy.php               — Deployment script with translation gate
```

### Supported Locales
| Locale Code | Language | Default |
|-------------|----------|---------|
| en-US | English (US) | Yes (fallback) |
| es-US | Español (US) | No |
| vi-VN | Tiếng Việt | No |

### Legacy Support
Legacy codes `en`, `vi`, `es` are automatically mapped to `en-US`, `vi-VN`, `es-US`.

## Core Functions

| Function | Purpose |
|----------|---------|
| `available_locales()` | Returns array of supported locale codes |
| `normalize_locale($locale)` | Maps legacy codes, validates against available locales, defaults to `en-US` |
| `set_locale($locale)` | Persists locale to `$_SESSION` + cookie (`taskflow_locale`) |
| `current_locale($reset)` | Reads locale from session → cookie → default `en-US` |
| `locale_label($locale)` | Returns display name for locale |
| `language_switch_url($locale, $redirect)` | Generates `/language/{locale}` switch URL |
| `load_translations($locale)` | Loads `lang/{locale}.php` file |
| `tf_translations()` | Returns merged translation cache with legacy aliases |
| `t($key, $replace)` | Translation lookup with fallback chain |
| `user_preferred_locale($user)` | Gets user's preferred locale from DB or session |

### Fallback Chain
1. Requested locale (e.g., `es-US`)
2. `en-US` (English fallback)
3. Raw key string (never falls back to `vi` from `en`)

### Persistence
- **Session:** `$_SESSION['locale']`
- **Cookie:** `taskflow_locale` (1 year expiry)
- **DB (future):** `users.preferred_locale` column

## Language Switcher
- **Desktop:** EN | ES | VI chips in header (line ~670 of views/layouts/main.php)
- **Mobile:** Same switcher accessible from header
- **Persistence:** Cookie + session survive login/logout/refresh

## Deployment Gate
`deploy.php` runs `scripts/verify-translations.php` before deploying:
- Checks key parity across all 3 locales
- Blocks deploy if any key is missing
- Checks for duplicate keys, placeholder text, hardcoded strings
