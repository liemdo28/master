<?php
/**
 * Phase L5: Translation Verification Gate
 * Checks:
 * 1. All translation keys exist in all 3 language files
 * 2. No missing keys
 * 3. No duplicate keys
 * 4. No obvious placeholder text (TODO, XXX, FIXME, lorem ipsum)
 * 5. Exit code: 0 = PASS, 1 = FAIL
 *
 * Usage: C:\xampp\php\php.exe scripts/verify-translations.php
 *        python scripts/verify_translations.py  (alternative)
 */

$root = dirname(__DIR__);
$locales = ['en-US', 'es-US', 'vi-VN'];
$langDir = $root . '/lang';
$errors = [];
$warnings = [];
$keySets = [];

echo "=== Translation Verification Gate ===\n\n";

// ── 1. Load all language files ──
foreach ($locales as $locale) {
    $file = $langDir . "/{$locale}.php";
    if (!file_exists($file)) {
        $errors[] = "MISSING: lang/{$locale}.php";
        continue;
    }
    $data = require $file;
    if (!is_array($data)) {
        $errors[] = "INVALID: lang/{$locale}.php did not return an array";
        continue;
    }
    $keySets[$locale] = $data;
    echo "Loaded {$locale}: " . count($data) . " keys\n";
}

if (empty($keySets)) {
    echo "\nFATAL: No language files could be loaded.\n";
    exit(1);
}

// ── 2. Check key parity across all locales ──
echo "\n=== Key Parity Check ===\n";
$masterKeys = null;
foreach ($keySets as $locale => $keys) {
    if ($masterKeys === null) {
        $masterKeys = array_keys($keys);
        sort($masterKeys);
        continue;
    }
    $currentKeys = array_keys($keys);
    $missing = array_diff($masterKeys, $currentKeys);
    $extra = array_diff($currentKeys, $masterKeys);

    if (!empty($missing)) {
        foreach ($missing as $k) {
            $errors[] = "MISSING_KEY: '{$k}' exists in other locales but not in {$locale}";
        }
    }
    if (!empty($extra)) {
        foreach ($extra as $k) {
            $warnings[] = "EXTRA_KEY: '{$k}' exists in {$locale} but not in other locales";
        }
    }
}

echo "Missing keys: " . count(array_filter($errors, fn($e) => str_starts_with($e, 'MISSING_KEY'))) . "\n";
echo "Extra keys: " . count($warnings) . "\n";

// ── 3. Check for duplicates within each file ──
echo "\n=== Duplicate Key Check ===\n";
foreach ($locales as $locale) {
    $file = $langDir . "/{$locale}.php";
    if (!file_exists($file)) continue;
    $content = file_get_contents($file);
    preg_match_all("/'([^']+)'\s*=>/", $content, $matches);
    $allKeys = $matches[1];
    $dupes = array_unique(array_diff_key($allKeys, array_unique($allKeys)));
    if (!empty($dupes)) {
        foreach ($dupes as $d) {
            $errors[] = "DUPLICATE_KEY: '{$d}' appears multiple times in {$locale}";
        }
    }
    echo "{$locale}: " . count($dupes) . " duplicates\n";
}

// ── 4. Check for placeholder text ──
echo "\n=== Placeholder Text Check ===\n";
$placeholderPatterns = ['/TODO/i', '/XXX/i', '/FIXME/i', '/lorem ipsum/i', '/placeholder/i', '/CHANGE ME/i'];
foreach ($keySets as $locale => $keys) {
    foreach ($keys as $key => $value) {
        foreach ($placeholderPatterns as $pat) {
            if (preg_match($pat, $value)) {
                $warnings[] = "PLACEHOLDER: '{$key}' in {$locale} contains: {$value}";
            }
        }
    }
}
echo "Placeholder warnings: " . count(array_filter($warnings, fn($w) => str_starts_with($w, 'PLACEHOLDER'))) . "\n";

// ── 5. Check for hardcoded strings in views (basic scan) ──
echo "\n=== Hardcoded String Check (Views) ===\n";
$viewDirs = ['views', 'partials'];
$hardcodedPatterns = [
    '/Critical Tasks/',
    '/Compliance Risk/',
    '/Cash Risk/',
    '/Payment Risk/',
    '/Recommended Payment/',
    '/Store Health/',
    '/Overdue/',
    '/On Track/',
    '/At Risk/',
    '/Blocked/',
    '/Completed/',
    '/Active/',
    '/Inactive/',
];
$hardcodedCount = 0;
foreach ($viewDirs as $dir) {
    $fullDir = $root . '/' . $dir;
    if (!is_dir($fullDir)) continue;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($fullDir));
    foreach ($it as $file) {
        if ($file->getExtension() !== 'php') continue;
        $content = file_get_contents($file->getPathname());
        // Skip PHP comment lines and t() calls
        $lines = explode("\n", $content);
        foreach ($lines as $lineNum => $line) {
            $trimmed = trim($line);
            if (str_starts_with($trimmed, '//') || str_starts_with($trimmed, '/*') || str_starts_with($trimmed, '*')) continue;
            if (strpos($line, "t('") !== false || strpos($line, 't("') !== false) continue;
            foreach ($hardcodedPatterns as $pat) {
                if (preg_match($pat, $line) && strpos($line, '?>') === false) {
                    $relPath = str_replace($root . '/', '', $file->getPathname());
                    $hardcodedCount++;
                    if ($hardcodedCount <= 20) {
                        $warnings[] = "HARDCODED: {$relPath}:{$lineNum} — " . trim(substr($line, 0, 80));
                    }
                }
            }
        }
    }
}
echo "Hardcoded strings found: " . $hardcodedCount . " (showing first 20)\n";

// ── Summary ──
echo "\n=== SUMMARY ===\n";
echo "Errors: " . count($errors) . "\n";
echo "Warnings: " . count($warnings) . "\n";

if (!empty($errors)) {
    echo "\n--- ERRORS ---\n";
    foreach ($errors as $e) echo "  ✗ {$e}\n";
}
if (!empty($warnings)) {
    echo "\n--- WARNINGS ---\n";
    foreach ($warnings as $w) echo "  ⚠ {$w}\n";
}

if (count($errors) > 0) {
    echo "\nRESULT: FAIL (exit code 1)\n";
    exit(1);
} else {
    echo "\nRESULT: PASS (exit code 0)\n";
    exit(0);
}
