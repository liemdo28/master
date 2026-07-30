# Language Switcher QA Report

**Date:** 2026-06-22
**Status:** CODE VERIFIED — PENDING BROWSER VERIFICATION

## Code Verification (automated)

### ✅ Language chips in header (views/layouts/main.php line ~670)
```php
<a href="<?= e(language_switch_url('en-US')) ?>" class="lang-chip <?= current_locale() === 'en-US' || current_locale() === 'en' ? 'active' : '' ?>" data-testid="lang-en">EN</a>
<a href="<?= e(language_switch_url('es-US')) ?>" class="lang-chip <?= current_locale() === 'es-US' || current_locale() === 'es' ? 'active' : '' ?>" data-testid="lang-es">ES</a>
<a href="<?= e(language_switch_url('vi-VN')) ?>" class="lang-chip <?= current_locale() === 'vi-VN' || current_locale() === 'vi' ? 'active' : '' ?>" data-testid="lang-vi">VI</a>
```
**Verdict:** 3 chips rendered. Active state correctly checks both new and legacy locale codes.

### ✅ Persistence — Session + Cookie (config/i18n.php)
```php
function set_locale($locale) {
    $_SESSION['locale'] = $locale;
    setcookie('taskflow_locale', $locale, time() + (86400 * 365), '/');
}
function current_locale() {
    // Session → Cookie → Default en-US
}
```
**Verdict:** Locale persists across page refresh (session), logout/login (cookie), new tab (cookie).

### ✅ Language switch URL generation
```php
function language_switch_url($locale, $redirect = null) {
    return APP_URL . '/language/' . $locale . '?redirect=' . rawurlencode($redirect);
}
```
**Verdict:** URLs correctly format as `/language/en-US`, `/language/es-US`, `/language/vi-VN`.

### ✅ Fallback chain
- If key missing in `es-US` → falls back to `en-US`
- If key missing in `vi-VN` → falls back to `en-US`
- Never falls back from `en` to `vi` or vice versa

## Browser Testing Checklist
- [ ] Desktop Chrome: EN/ES/VI chips visible, clicking switches language
- [ ] Desktop Chrome: Active chip highlighted correctly
- [ ] Mobile Safari: Language switcher accessible from header
- [ ] Login page: Language switcher present (requires login page to include layout)
- [ ] After logout: Language persists from cookie
- [ ] New tab: Language persists from cookie
- [ ] Mobile PWA: Language persists after install
