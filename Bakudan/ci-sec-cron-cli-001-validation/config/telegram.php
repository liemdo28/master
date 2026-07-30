<?php
/**
 * Telegram Bot + AI Router configuration
 *
 * Set these via environment variables on the server.
 * For local dev, create config/telegram.local.php returning an array.
 */

// ── Load optional local override ─────────────────────────────
$_tgLocal = __DIR__ . '/telegram.local.php';
$_tgOverrides = [];
if (is_file($_tgLocal) && is_readable($_tgLocal)) {
    $_tgOverrides = require $_tgLocal;
    if (!is_array($_tgOverrides)) $_tgOverrides = [];
}
$_tgEnv = function(string $key, string $default = '') use ($_tgOverrides): string {
    if (isset($_tgOverrides[$key]) && $_tgOverrides[$key] !== '') return (string)$_tgOverrides[$key];
    $v = getenv($key);
    return ($v !== false && $v !== '') ? (string)$v : $default;
};

// ── Telegram Bot credentials ─────────────────────────────────
if (!defined('TELEGRAM_BOT_TOKEN')) {
    define('TELEGRAM_BOT_TOKEN', $_tgEnv('TELEGRAM_BOT_TOKEN'));
}
// Secret sent by Telegram in X-Telegram-Bot-Api-Secret-Token header
if (!defined('TELEGRAM_WEBHOOK_SECRET')) {
    define('TELEGRAM_WEBHOOK_SECRET', $_tgEnv('TELEGRAM_WEBHOOK_SECRET'));
}
// Bot username WITHOUT @  (e.g. "taskflow_bot")
if (!defined('TELEGRAM_BOT_USERNAME')) {
    define('TELEGRAM_BOT_USERNAME', $_tgEnv('TELEGRAM_BOT_USERNAME', 'taskflow_bot'));
}

// ── AI Provider credentials ──────────────────────────────────
// Provider priority order (comma-separated): claude, openai, gemini
if (!defined('AI_PROVIDER_ORDER')) {
    define('AI_PROVIDER_ORDER', $_tgEnv('AI_PROVIDER_ORDER', 'claude,openai,gemini'));
}
if (!defined('ANTHROPIC_API_KEY')) {
    define('ANTHROPIC_API_KEY', $_tgEnv('ANTHROPIC_API_KEY'));
}
// OpenAI key already loaded by config/ai.php — reuse OPENAI_API_KEY
if (!defined('GEMINI_API_KEY')) {
    define('GEMINI_API_KEY', $_tgEnv('GEMINI_API_KEY'));
}

// ── AI model IDs ─────────────────────────────────────────────
// Use fast/cheap models for telegram (latency + cost sensitive)
if (!defined('TG_CLAUDE_MODEL')) {
    define('TG_CLAUDE_MODEL', $_tgEnv('TG_CLAUDE_MODEL', 'claude-haiku-4-5-20251001'));
}
if (!defined('TG_OPENAI_MODEL')) {
    define('TG_OPENAI_MODEL', $_tgEnv('TG_OPENAI_MODEL', 'gpt-4o-mini'));
}
if (!defined('TG_GEMINI_MODEL')) {
    define('TG_GEMINI_MODEL', $_tgEnv('TG_GEMINI_MODEL', 'gemini-1.5-flash'));
}

// ── Rate limits ───────────────────────────────────────────────
// Max inbound messages per user per hour (bot replies)
if (!defined('TG_RATE_MSG_PER_HOUR')) {
    define('TG_RATE_MSG_PER_HOUR', (int)$_tgEnv('TG_RATE_MSG_PER_HOUR', '30'));
}
// Max AI-backed calls (F2+F4) per user per day
if (!defined('TG_RATE_AI_PER_DAY')) {
    define('TG_RATE_AI_PER_DAY', (int)$_tgEnv('TG_RATE_AI_PER_DAY', '50'));
}

// ── Link token TTL (minutes) ──────────────────────────────────
if (!defined('TG_LINK_TOKEN_TTL_MIN')) {
    define('TG_LINK_TOKEN_TTL_MIN', 15);
}

unset($_tgLocal, $_tgOverrides, $_tgEnv);
