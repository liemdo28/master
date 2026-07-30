<?php
/**
 * Internationalization (i18n) System
 * Supports: en-US, es-US, vi-VN
 * Backward compatible with legacy 'en' and 'vi' locale codes
 * Translation files: lang/{en-US,es-US,vi-VN}.php
 */

// ── Locale Registry ──
function available_locales() {
    return ['en-US', 'es-US', 'vi-VN'];
}

/**
 * Normalize locale codes.
 * Supports both new (en-US, es-US, vi-VN) and legacy (en, vi) codes.
 */
function normalize_locale($locale) {
    $locale = strtolower(trim((string) $locale));
    // Map legacy codes to new format
    $legacy_map = [
        'en' => 'en-US',
        'vi' => 'vi-VN',
        'es' => 'es-US',
    ];
    if (isset($legacy_map[$locale])) {
        $locale = $legacy_map[$locale];
    }
    return in_array($locale, available_locales(), true) ? $locale : 'en-US';
}

function set_locale($locale) {
    $locale = normalize_locale($locale);
    $_SESSION['locale'] = $locale;
    setcookie('taskflow_locale', $locale, time() + (86400 * 365), '/');
    // Reset the static cache so current_locale() returns updated value
    current_locale(true);
    return $locale;
}

function current_locale($reset = false) {
    static $locale = null;
    if ($reset) {
        $locale = null;
        return null;
    }
    if ($locale !== null) {
        return $locale;
    }

    if (!empty($_SESSION['locale'])) {
        $locale = normalize_locale($_SESSION['locale']);
        return $locale;
    }

    if (!empty($_COOKIE['taskflow_locale'])) {
        $locale = normalize_locale($_COOKIE['taskflow_locale']);
        $_SESSION['locale'] = $locale;
        return $locale;
    }

    $locale = 'en-US';
    $_SESSION['locale'] = $locale;
    return $locale;
}

function locale_label($locale) {
    $locale = normalize_locale($locale);
    $labels = [
        'en-US' => 'English',
        'es-US' => 'Español',
        'vi-VN' => 'Tiếng Việt',
    ];
    return $labels[$locale] ?? 'English';
}

function language_switch_url($locale, $redirect = null) {
    $locale = normalize_locale($locale);
    $redirect = $redirect ?? ($_SERVER['REQUEST_URI'] ?? '/');
    return APP_URL . '/language/' . $locale . '?redirect=' . rawurlencode($redirect);
}

/**
 * Load translation file for a given locale.
 * Returns the translation array from lang/{locale}.php
 */
function load_translations($locale) {
    $locale = normalize_locale($locale);
    $file = dirname(__DIR__) . "/lang/{$locale}.php";
    if (file_exists($file)) {
        return require $file;
    }
    // Fallback: try legacy locale code
    $legacy = $locale === 'en-US' ? 'en' : ($locale === 'vi-VN' ? 'vi' : null);
    if ($legacy) {
        $legacy_file = dirname(__DIR__) . "/lang/{$locale}.php";
        if (file_exists($legacy_file)) {
            return require $legacy_file;
        }
    }
    return [];
}

/**
 * Build the full translations cache (merged from lang files).
 * Returns ['en-US' => [...], 'es-US' => [...], 'vi-VN' => [...]]
 */
function tf_translations() {
    static $translations = null;
    if ($translations !== null) {
        return $translations;
    }

    $translations = [];
    foreach (available_locales() as $locale) {
        $translations[$locale] = load_translations($locale);
    }

    // Backward compatibility: map legacy 'en' and 'vi' to new locales
    $translations['en'] = $translations['en-US'] ?? [];
    $translations['vi'] = $translations['vi-VN'] ?? [];
    $translations['es'] = $translations['es-US'] ?? [];

    return $translations;
}

/**
 * Translation lookup with fallback.
 * Fallback order: requested locale → en-US → raw key
 */
function t($key, $replace = []) {
    $translations = tf_translations();
    $locale = current_locale();
    // Also support legacy locale codes in lookup
    $lookup_locale = $locale;

    if (isset($translations[$lookup_locale][$key])) {
        $text = $translations[$lookup_locale][$key];
    } elseif ($lookup_locale !== 'en-US' && isset($translations['en-US'][$key])) {
        $text = $translations['en-US'][$key];
    } elseif ($lookup_locale !== 'en' && isset($translations['en'][$key])) {
        $text = $translations['en'][$key];
    } else {
        $text = $key; // Return raw key for missing translations
        // Log missing key for monitoring
        if (defined('LOG_MISSING_KEYS') && LOG_MISSING_KEYS) {
            $missingLog = dirname(__DIR__) . '/logs/missing_keys.log';
            $msg = date('Y-m-d H:i:s') . " [{$locale}] Missing key: {$key}\n";
            @file_put_contents($missingLog, $msg, FILE_APPEND | LOCK_EX);
        }
    }

    foreach ($replace as $name => $value) {
        $text = str_replace(':' . $name, (string) $value, $text);
    }

    return $text;
}

/**
 * Get current user's preferred locale from database (if available).
 * Falls back to session/cookie locale.
 */
function user_preferred_locale($user = null) {
    if ($user && !empty($user['preferred_locale'])) {
        return normalize_locale($user['preferred_locale']);
    }
    return current_locale();
}
