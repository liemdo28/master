# Translation Gate Report

**Date:** 2026-06-22

## Gate Implementation

### Files
| File | Purpose |
|------|---------|
| `scripts/verify-translations.php` | Standalone verification script |
| `deploy.php` | Integration point — blocks deploy on failure |

### Verification Checks
1. ✅ All translation keys exist in all 3 language files
2. ✅ No missing keys between locales
3. ✅ No duplicate keys within any file
4. ✅ No placeholder text (TODO, XXX, FIXME, lorem ipsum)
5. ⚠️ Hardcoded visible strings in views (warnings only — not blocking)

### Exit Codes
| Code | Meaning |
|------|---------|
| 0 | PASS — all checks passed |
| 1 | FAIL — one or more checks failed |

### Deploy Integration
```php
// In deploy.php, after schema gate:
exec("cd {$root} && php scripts/verify-translations.php 2>&1", $output, $code);
if ($code !== 0) {
    echo "FATAL: Translation verification FAILED.\n";
    exit(1);
}
```

### How to Add New Translation Keys
1. Add key with values for all 3 locales to `scripts/gen_lang.py`
2. Run `python scripts/gen_lang.py`
3. Run `scripts/verify-translations.php` to verify
4. Commit all `lang/*.php` files

### Mandatory Rule
Any PR/commit that adds or changes visible UI must update all 3 language files.
If any key is missing in any locale, deploy will fail.
