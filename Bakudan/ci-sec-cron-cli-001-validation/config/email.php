<?php
// ── Email Notification Configuration ──────────────────────────────────────────

if (!defined('EMAIL_FROM_ADDRESS')) define('EMAIL_FROM_ADDRESS', 'noreply@dashboard.bakudanramen.com');
if (!defined('EMAIL_FROM_NAME'))    define('EMAIL_FROM_NAME', 'TaskFlow');
if (!defined('EMAIL_ENABLED'))      define('EMAIL_ENABLED', true);

// Overdue escalation thresholds (days overdue before notifying each level)
if (!defined('EMAIL_OVERDUE_L1_DAYS')) define('EMAIL_OVERDUE_L1_DAYS', 3);   // notify managers
if (!defined('EMAIL_OVERDUE_L2_DAYS')) define('EMAIL_OVERDUE_L2_DAYS', 7);   // notify admins
if (!defined('EMAIL_OVERDUE_L3_DAYS')) define('EMAIL_OVERDUE_L3_DAYS', 14);  // already covered by admin (top level)

// ── SMTP / Mail Driver ─────────────────────────────────────────────────────────
// MAIL_DRIVER: 'smtp' (recommended) or 'mail' (legacy PHP mail())
// Configure real credentials in config/email.local.php (gitignored)

if (!defined('MAIL_DRIVER'))     define('MAIL_DRIVER',     'smtp');
if (!defined('MAIL_HOST'))       define('MAIL_HOST',       'smtp.gmail.com');
if (!defined('MAIL_PORT'))       define('MAIL_PORT',       587);
if (!defined('MAIL_ENCRYPTION')) define('MAIL_ENCRYPTION', 'tls');   // 'tls', 'ssl', or ''
if (!defined('MAIL_USERNAME'))   define('MAIL_USERNAME',   '');
if (!defined('MAIL_PASSWORD'))   define('MAIL_PASSWORD',   '');

// Load local overrides (real credentials, never committed to git)
$_emailLocalCfg = __DIR__ . '/email.local.php';
if (file_exists($_emailLocalCfg)) {
    require_once $_emailLocalCfg;
}
unset($_emailLocalCfg);
