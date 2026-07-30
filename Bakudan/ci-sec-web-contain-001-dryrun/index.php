<?php
/**
 * TaskFlow v2 — Entry Point & Router
 *
 * Runtime requirements:
 *   PHP    >= 8.0  (match expressions, str_starts_with, named arguments, arrow functions)
 *   MySQL  >= 5.7  (utf8mb4, JSON_*, window functions)
 *   Node   >= 18   (dev tools only — not required at runtime)
 */

// ── PHP version guard ────────────────────────────────────────────────────────────────────────────
if (PHP_VERSION_ID < 80000) {
    http_response_code(500);
    $v = PHP_VERSION;
    die("PHP 8.0+ required. Server is running PHP {$v}. "
      . "Please upgrade on your hosting control panel (e.g. cPanel → PHP Selector → 8.0 or 8.2).");
}

ini_set('display_errors', 0);          // Never expose errors to browser
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/logs/errors/php-errors.log');
error_reporting(E_ALL);

if (!headers_sent()) {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
}

// ── Global exception handler — NO blank pages ────────────────────────────────
set_exception_handler(function (Throwable $e) {
    $isApi = isset($_SERVER['REQUEST_URI']) && (
        str_starts_with($_SERVER['REQUEST_URI'], '/api/') ||
        str_starts_with(ltrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'), 'api/')
    );
    $msg = $e->getMessage();
    $file = str_replace(dirname(__DIR__), '', $e->getFile());
    $line = $e->getLine();

    // Log full trace
    error_log("[EXCEPTION] {$msg} in {$file}:{$line}\n" . $e->getTraceAsString());

    if ($isApi || (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && $_SERVER['HTTP_X_REQUESTED_WITH'] === 'XMLHttpRequest')) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Server error', 'message' => $msg]);
        exit;
    }

    http_response_code(500);
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
    <title>Something went wrong</title>
    <style>body{font-family:system-ui,sans-serif;background:#09090b;color:#f4f4f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}
    .card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:40px;max-width:520px;width:100%;text-align:center}
    h1{color:#f87171;margin:0 0 12px;font-size:24px}p{color:#a1a1aa;margin:8px 0;font-size:14px}
    code{background:#27272a;padding:2px 8px;border-radius:4px;font-size:12px;color:#e4e4e7}
    a{color:#60a5fa;text-decoration:none;font-size:14px;display:inline-block;margin-top:20px;padding:10px 24px;background:#1e3a5f;border-radius:8px}
    a:hover{background:#1d4ed8}</style></head>
    <body><div class="card">
    <h1>⚠️ Something went wrong</h1>
    <p>The server encountered an error. It has been logged.</p>
    <p><code>An internal error occurred. Please try again or contact support.</code></p>
    <a href="javascript:history.back()">← Go back</a>
    &nbsp;<a href="/">🏠 Dashboard</a>
    </div></body></html>';
    exit;
});

set_error_handler(function (int $errno, string $errstr, string $errfile, int $errline): bool {
    if (!($errno & error_reporting())) return false;
    $file = str_replace(dirname(__DIR__), '', $errfile);
    error_log("[PHP-{$errno}] {$errstr} in {$file}:{$errline}");
    return false; // Let PHP handle fatal errors normally
});

// Secure session cookie — HttpOnly, SameSite=Strict, Secure on HTTPS
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'domain'   => '',
    'secure'   => $isHttps,
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

// Load .env file into $_ENV (Dreamhost shared hosting doesn't auto-inject .env)
$_envFile = __DIR__ . '/.env';
if (file_exists($_envFile)) {
    foreach (file($_envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $_line) {
        if (str_starts_with(trim($_line), '#') || !str_contains($_line, '=')) continue;
        [$_k, $_v] = array_pad(explode('=', $_line, 2), 2, '');
        $_k = trim($_k); $_v = trim($_v);
        $_v = trim($_v, " \t\r\n\"'");
        $_ENV[$_k] = $_v;
        putenv("$_k=$_v");
    }
}
unset($_envFile, $_line, $_k, $_v);

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/ai.php';
require_once __DIR__ . '/config/i18n.php';
require_once __DIR__ . '/config/icons.php';
require_once __DIR__ . '/config/time.php';
require_once __DIR__ . '/models/User.php';
require_once __DIR__ . '/models/Project.php';
require_once __DIR__ . '/models/Section.php';
require_once __DIR__ . '/models/Task.php';
require_once __DIR__ . '/models/Comment.php';
require_once __DIR__ . '/models/Notification.php';
require_once __DIR__ . '/models/Store.php';
require_once __DIR__ . '/models/Bill.php';
require_once __DIR__ . '/models/Business.php';
require_once __DIR__ . '/models/Payment.php';
require_once __DIR__ . '/models/SmartEngine.php';
// V4 Decision Operating System engines
require_once __DIR__ . '/models/ImpactEngine.php';
require_once __DIR__ . '/models/PredictionEngine.php';
require_once __DIR__ . '/models/SimulationEngine.php';
require_once __DIR__ . '/models/DecisionEngine.php';
// V5 Autonomy Layer
require_once __DIR__ . '/models/PolicyEngine.php';
require_once __DIR__ . '/models/ApprovalEngine.php';
require_once __DIR__ . '/models/AutonomyEngine.php';
// CEO+CFO Command Center engines
require_once __DIR__ . '/models/FinanceIntelligenceEngine.php';
require_once __DIR__ . '/models/ComplianceEngine.php';
require_once __DIR__ . '/models/UnifiedRiskEngine.php';
require_once __DIR__ . '/models/CommandSearchEngine.php';
// Phase 8: Autonomous Operations & Enterprise Scaling
require_once __DIR__ . '/config/phase8.php';
require_once __DIR__ . '/models/PredictiveIncidentEngine.php';
require_once __DIR__ . '/models/RecommendationEngine.php';
require_once __DIR__ . '/models/CorrectiveActionEngine.php';
require_once __DIR__ . '/models/WorkflowEngine.php';
require_once __DIR__ . '/models/CrossModuleAutomation.php';
require_once __DIR__ . '/models/NotificationHub.php';
require_once __DIR__ . '/models/EnterpriseScoreEngine.php';
require_once __DIR__ . '/models/OperationsTwin.php';
require_once __DIR__ . '/models/AIDecisionSupport.php';
require_once __DIR__ . '/models/OrgMemory.php';
require_once __DIR__ . '/service/DateService.php';
require_once __DIR__ . '/service/RecurringTaskService.php';
require_once __DIR__ . '/service/UniversalVerificationEngine.php';
require_once __DIR__ . '/service/TaskCompletionService.php';
require_once __DIR__ . '/service/TaskReviewService.php';
require_once __DIR__ . '/models/TaskStore.php';
require_once __DIR__ . '/service/TaskStoreService.php';
require_once __DIR__ . '/service/OverdueResolverService.php';
require_once __DIR__ . '/models/DeadlineExtension.php';
require_once __DIR__ . '/models/MonthlyExtensionUsage.php';
require_once __DIR__ . '/models/DeadlineExtensionAuditLog.php';
require_once __DIR__ . '/service/DeadlineExtensionPermissionService.php';
require_once __DIR__ . '/service/DeadlineExtensionService.php';
require_once __DIR__ . '/service/MonthlyExtensionUsageService.php';
require_once __DIR__ . '/service/PenaltySyncService.php';
require_once __DIR__ . '/service/OverdueResolverService.php';
require_once __DIR__ . '/validators/CreateDeadlineExtensionValidator.php';
require_once __DIR__ . '/validators/ApproveDeadlineExtensionValidator.php';
require_once __DIR__ . '/validators/RejectDeadlineExtensionValidator.php';
require_once __DIR__ . '/controllers/DeadlineExtensionController.php';
require_once __DIR__ . '/controllers/AdminDeadlineExtensionController.php';
// Workspace timezone — single source of truth for date math
if (!defined('APP_TIMEZONE')) define('APP_TIMEZONE', 'Asia/Ho_Chi_Minh');
// Skip per-request INFORMATION_SCHEMA checks after all migrations are applied.
// Set SKIP_SCHEMA_CHECKS=1 in the server environment for staging/production.
if (!defined('SKIP_SCHEMA_CHECKS')) define('SKIP_SCHEMA_CHECKS', getenv('SKIP_SCHEMA_CHECKS') === '1');
date_default_timezone_set(APP_TIMEZONE);
// Task Approval Workflow
require_once __DIR__ . '/controllers/TaskApprovalController.php';

// CEO Update: Reviewer Workspace — rich comments, @mentions, notifications
require_once __DIR__ . '/models/TaskComment.php';
require_once __DIR__ . '/models/TaskNotification.php';
require_once __DIR__ . '/models/ReviewerNote.php';
require_once __DIR__ . '/models/ApprovalNote.php';
require_once __DIR__ . '/controllers/TaskCommentController.php';
require_once __DIR__ . '/controllers/ReviewerNotesController.php';
require_once __DIR__ . '/controllers/ApprovalNoteController.php';
require_once __DIR__ . '/controllers/InboxController.php';

// Phase 14: Credential Management
require_once __DIR__ . '/service/EncryptionService.php';
require_once __DIR__ . '/service/CredentialAuditService.php';
require_once __DIR__ . '/service/CredentialPermissionService.php';
require_once __DIR__ . '/models/Credential.php';
require_once __DIR__ . '/controllers/CredentialController.php';

require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/DashboardController.php';
require_once __DIR__ . '/controllers/DataFreshnessController.php';
require_once __DIR__ . '/controllers/ProjectController.php';
require_once __DIR__ . '/controllers/TaskController.php';
require_once __DIR__ . '/controllers/CommentController.php';
require_once __DIR__ . '/controllers/BillController.php';
require_once __DIR__ . '/models/DuplicateDetector.php';
require_once __DIR__ . '/controllers/AdminDuplicatesController.php';
require_once __DIR__ . '/controllers/VerificationController.php';
require_once __DIR__ . '/models/Vendor.php';
require_once __DIR__ . '/controllers/VendorController.php';
require_once __DIR__ . '/controllers/StoreController.php';
require_once __DIR__ . '/models/OverallStore.php';
require_once __DIR__ . '/controllers/OverallStoreController.php';
require_once __DIR__ . '/controllers/StoreCommandController.php';
require_once __DIR__ . '/controllers/AiTaskController.php';
require_once __DIR__ . '/controllers/AsanaController.php';
require_once __DIR__ . '/controllers/TeamController.php';
require_once __DIR__ . '/models/Penalty.php';
require_once __DIR__ . '/models/PenaltyRule.php';
require_once __DIR__ . '/controllers/PenaltyController.php';
require_once __DIR__ . '/controllers/AccountabilityController.php';
require_once __DIR__ . '/models/TaskAudit.php';
require_once __DIR__ . '/controllers/TaskAuditController.php';
require_once __DIR__ . '/models/DeadlineExtension.php';
require_once __DIR__ . '/controllers/DeadlineExtensionController.php';
// Telegram integration (config first, then models, then controller)
require_once __DIR__ . '/config/telegram.php';
require_once __DIR__ . '/models/AiRouter.php';
require_once __DIR__ . '/models/TelegramAiTools.php';
require_once __DIR__ . '/models/TelegramBot.php';
require_once __DIR__ . '/controllers/TelegramController.php';
require_once __DIR__ . '/helpers/IconPresenter.php';
require_once __DIR__ . '/helpers/StatePresenter.php';
require_once __DIR__ . '/helpers/ProductionLogger.php';
require_once __DIR__ . '/helpers/ApiResponse.php';
require_once __DIR__ . '/models/Release.php';
require_once __DIR__ . '/controllers/ReleaseController.php';
// Phase 11.5: Operational Adoption Layer
require_once __DIR__ . '/controllers/SearchController.php';
require_once __DIR__ . '/controllers/ActivityFeedController.php';
require_once __DIR__ . '/controllers/NotificationCenterController.php';
require_once __DIR__ . '/controllers/FavoritesController.php';
require_once __DIR__ . '/controllers/MyWorkspaceController.php';
require_once __DIR__ . '/controllers/DashboardCustomizationController.php';
require_once __DIR__ . '/controllers/WorkflowExecutionApiController.php';
require_once __DIR__ . '/controllers/ReleaseArtifactsController.php';
require_once __DIR__ . '/controllers/HealthMonitorController.php';
require_once __DIR__ . '/controllers/AdoptionMetricsController.php';
require_once __DIR__ . '/service/UsageTracker.php';
require_once __DIR__ . '/models/Franchise.php';
require_once __DIR__ . '/models/KpiEngine.php';
require_once __DIR__ . '/controllers/FranchiseController.php';
require_once __DIR__ . '/controllers/OperationsController.php';
require_once __DIR__ . '/controllers/ManagerCommandController.php';
require_once __DIR__ . '/controllers/ActionCenterController.php';
require_once __DIR__ . '/controllers/StoreChecklistController.php';
require_once __DIR__ . '/controllers/CompanyCalendarController.php';
require_once __DIR__ . '/controllers/MyDayController.php';
require_once __DIR__ . '/controllers/ControlTowerController.php';
require_once __DIR__ . '/controllers/FranchisePlaybooksController.php';
require_once __DIR__ . '/validators/RequestValidator.php';
// ── Telegram Integration ───────────────────────────────────────────────────────────────────────
require_once __DIR__ . '/config/telegram.php';
require_once __DIR__ . '/models/TelegramUser.php';
require_once __DIR__ . '/models/TelegramNotificationLog.php';
require_once __DIR__ . '/models/TelegramInboundLog.php';
require_once __DIR__ . '/models/TelegramContext.php';
require_once __DIR__ . '/service/TelegramBotService.php';
require_once __DIR__ . '/service/TelegramUserLinkService.php';
require_once __DIR__ . '/service/TelegramNotificationService.php';
require_once __DIR__ . '/service/TelegramTaskParserService.php';
require_once __DIR__ . '/service/TelegramIntentClassifier.php';
require_once __DIR__ . '/service/TelegramTaskQueryService.php';
require_once __DIR__ . '/service/TelegramConversationService.php';
require_once __DIR__ . '/service/TelegramInboundService.php';
require_once __DIR__ . '/controllers/TelegramWebhookController.php';
require_once __DIR__ . '/controllers/TelegramConnectController.php';
// ── Email Notification System ────────────────────────────────────────────────────
require_once __DIR__ . '/config/email.php';
require_once __DIR__ . '/models/EmailLog.php';
require_once __DIR__ . '/models/EmailQueue.php';
require_once __DIR__ . '/service/SmtpMailer.php';
require_once __DIR__ . '/service/EmailQueueService.php';
require_once __DIR__ . '/service/EmailService.php';
require_once __DIR__ . '/service/EmailTemplateService.php';
require_once __DIR__ . '/service/EmailNotificationService.php';

function isLoggedIn() { return isset($_SESSION['user_id']); }
function currentUser() {
    if (!isLoggedIn()) return null;
    static $user = null;
    if ($user === null) { $user = (new User())->findById($_SESSION['user_id']); }
    return $user;
}
function isAdmin()       { $u = currentUser(); return $u && $u['role'] === 'admin'; }
function isCeo()         { $u = currentUser(); return $u && $u['role'] === 'ceo'; }
function isManager()     { $u = currentUser(); return $u && in_array($u['role'], ['admin', 'ceo', 'manager']); }
function isAccountant()  { $u = currentUser(); return $u && $u['role'] === 'accountant'; }
function canAdmin()      { $u = currentUser(); return $u && in_array($u['role'], ['admin', 'ceo']); }
function canManage()     { $u = currentUser(); return $u && in_array($u['role'], ['admin', 'ceo', 'manager']); }
function canViewFinance(){ $u = currentUser(); return $u && in_array($u['role'], ['admin', 'ceo', 'manager', 'accountant']); }
function redirect($path) {
    if (strpos($path, 'http://') === 0 || strpos($path, 'https://') === 0) {
        header("Location: " . $path);
    } else {
        header("Location: " . rtrim(APP_URL, '/') . "/" . ltrim($path, '/'));
    }
    exit;
}
function e($s) { return htmlspecialchars($s ?? '', ENT_QUOTES, 'UTF-8'); }
function csrf_token() {
    if (empty($_SESSION['csrf_token'])) $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    $token = $_SESSION['csrf_token'];
    // Double-submit cookie mirror — verify_csrf() falls back to this if the
    // server-side session value doesn't match, since PHP session-file
    // persistence between requests has proven unreliable in this hosting
    // environment (2026-07-04). The cookie is a second, browser-guaranteed
    // channel carrying the exact same random token, so security is unchanged.
    if (($_COOKIE['csrf_token'] ?? '') !== $token) {
        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
                || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
        setcookie('csrf_token', $token, [
            'expires'  => 0,
            'path'     => '/',
            'domain'   => '',
            'secure'   => $isHttps,
            'httponly' => false, // must be JS-readable; token itself carries no privilege without a session
            'samesite' => 'Strict',
        ]);
    }
    return $token;
}
function verify_csrf($t) {
    if (!is_string($t) || $t === '') return false;
    if (isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $t)) return true;
    if (isset($_COOKIE['csrf_token'])  && hash_equals($_COOKIE['csrf_token'], $t))  return true;
    return false;
}
function flash($key, $msg = null) { if ($msg !== null) { $_SESSION['flash'][$key] = $msg; } else { $m = $_SESSION['flash'][$key] ?? null; unset($_SESSION['flash'][$key]); return $m; } }
function json_response($data, $code = 200) { http_response_code($code); header('Content-Type: application/json'); echo json_encode($data); exit; }
function timeAgo($dt) { $d = (new DateTime())->diff(new DateTime($dt)); if ($d->y) return $d->y.'y ago'; if ($d->m) return $d->m.'mo ago'; if ($d->d) return $d->d.'d ago'; if ($d->h) return $d->h.'h ago'; if ($d->i) return $d->i.'m ago'; return 'Just now'; }
function notifyUser($data) { try { (new Notification())->create($data); } catch (Exception $e) {} }
function dueColor($dueDate, $status = 'pending') {
    if ($status === 'paid') return '#333333';
    if (!$dueDate) return '#2979ff';
    $days = (int)((strtotime($dueDate) - strtotime(app_today())) / 86400);
    if ($days < 0) return '#ff1744';
    if ($days === 0) return '#ff2bd6';
    if ($days <= 3) return '#ffea00';
    return '#2979ff';
}

app_set_timezone();
if (isLoggedIn()) {
    $activeUser = currentUser();
    if ($activeUser) {
        app_set_timezone($activeUser['timezone'] ?? null);
    }
}

$route = isset($_GET['route']) ? trim($_GET['route'], '/') : '';
$method = $_SERVER['REQUEST_METHOD'];
$publicRoutes = ['login', 'register', 'manifest.json', 'sw.js', 'migrate.php', 'admin_complete_overdue.php', 'release/review'];

// ── Remember-Me auto-login ────────────────────────────────────────────────────
// If user has a valid remember_token cookie but no active session, restore session.
// Hardened: wrapped in try/catch so a broken token never crashes the login page.
if (!isLoggedIn() && !empty($_COOKIE['remember_token'])) {
    try {
        $rawToken = $_COOKIE['remember_token'];
        if (strlen($rawToken) === 64 && ctype_xdigit($rawToken)) {
            $tokenHash = hash('sha256', $rawToken);
            $db = Database::getInstance();
            if ($db->tableExists('remember_tokens')) {
                // Schema-safe: production may have 'token' or 'token_hash' column
                $tokenCol = $db->columnExists('remember_tokens', 'token_hash') ? 'token_hash' : 'token';
                $row = $db->fetch(
                    "SELECT rt.user_id, rt.expires_at, u.name, u.role, u.store_id, u.is_active
                     FROM remember_tokens rt
                     JOIN users u ON u.id = rt.user_id
                     WHERE rt.{$tokenCol} = ? AND rt.expires_at > NOW()
                     LIMIT 1",
                    [$tokenHash]
                );
                if ($row && !empty($row['is_active'])) {
                    session_regenerate_id(true);
                    $_SESSION['user_id']   = (int)$row['user_id'];
                    $_SESSION['user_name'] = $row['name'];
                    $_SESSION['user_role'] = $row['role'];
                    if (!empty($row['store_id'])) $_SESSION['store_id'] = $row['store_id'];
                    // Rotate token — issue new one, invalidate old
                    require_once __DIR__ . '/controllers/AuthController.php';
                    (new AuthController())->setRememberToken((int)$row['user_id']);
                    // Load multi-store ids
                    try {
                        $userModel = new User();
                        $sids = $userModel->getUserStoreIds((int)$row['user_id']);
                        $_SESSION['store_ids'] = $sids ?: (!empty($row['store_id']) ? [(int)$row['store_id']] : []);
                    } catch (Throwable $_e) {}
                } else {
                    // Invalid or expired — clear cookie silently
                    setcookie('remember_token', '', ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Strict']);
                }
            }
        }
    } catch (Throwable $e) {
        // Remember-me is optional — on any failure, clear cookie and fall through to login page
        error_log('[AUTOLOGIN] remember-me failed: ' . $e->getMessage());
        setcookie('remember_token', '', ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Strict']);
    }
}

// Preview-only QA bypass: lets reviewers open the staging preview without credentials.
// Triple-guard: must be preview host + staging env + explicit flag. Never runs on production.
(function () use ($route) {
    $host      = $_SERVER['HTTP_HOST'] ?? '';
    $appEnv    = $_ENV['APP_ENV'] ?? getenv('APP_ENV') ?: '';
    $isPreviewHost = $host === 'preview.dashboard.bakudanramen.com';
    $isStaging     = $appEnv === 'staging';
    $enabled       = ($_ENV['PREVIEW_QA_BYPASS'] ?? getenv('PREVIEW_QA_BYPASS') ?: '') === '1';
    // Hard-block: never run on any non-preview host or production env
    if (!$isPreviewHost || !$isStaging || !$enabled || isLoggedIn()) return;
    if ($appEnv === 'production') return; // redundant safety net
    if (str_starts_with($route, 'api/v1/') || str_starts_with($route, 'webhook/')) return;

    $email = $_ENV['PREVIEW_QA_EMAIL'] ?? getenv('PREVIEW_QA_EMAIL') ?: 'phase11.preview@bakudanramen.com';
    $user = (new User())->findByEmail($email);
    if (!$user || empty($user['is_active'])) return;

    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_name'] = $user['name'];
    $_SESSION['user_role'] = $user['role'];

    if (in_array($route, ['login', 'register', ''])) {
        header('Location: ' . rtrim(APP_URL, '/') . '/dashboard');
        exit;
    }
})();

if (preg_match('/^language\/([a-zA-Z\-]+)$/', $route, $m)) {
    $locale = set_locale($m[1]);
    $redirectTo = $_GET['redirect'] ?? ($_SERVER['HTTP_REFERER'] ?? APP_URL . '/dashboard');
    $redirectTo = trim((string) $redirectTo);
    if ($redirectTo === '') {
        $redirectTo = APP_URL . '/dashboard';
    }
    if (strpos($redirectTo, APP_URL) !== 0 && strpos($redirectTo, '/') !== 0) {
        $redirectTo = APP_URL . '/dashboard';
    }
    // Ensure session is written before redirect
    session_write_close();
    header('Location: ' . $redirectTo);
    exit;
}

// PWA Manifest
if ($route === 'manifest.json') {
    header('Content-Type: application/json');
    echo json_encode([
        'name' => 'TaskFlow - Task Management',
        'short_name' => 'TaskFlow',
        'description' => 'Smart task & project management for teams',
        'start_url' => APP_URL . '/dashboard',
        'scope' => APP_URL . '/',
        'display' => 'standalone',
        'display_override' => ['window-controls-overlay', 'standalone'],
        'background_color' => '#09090b',
        'theme_color' => '#dc2626',
        'orientation' => 'any',
        'categories' => ['productivity', 'business'],
        'icons' => [
            ['src' => APP_URL . '/assets/icons/icon-192.png', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any maskable'],
            ['src' => APP_URL . '/assets/icons/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any maskable'],
        ],
        'shortcuts' => [
            ['name' => 'My Tasks', 'short_name' => 'Tasks', 'url' => APP_URL . '/my-tasks', 'icons' => [['src' => APP_URL . '/assets/icons/icon-192.png', 'sizes' => '192x192']]],
            ['name' => 'Calendar', 'short_name' => 'Calendar', 'url' => APP_URL . '/calendar', 'icons' => [['src' => APP_URL . '/assets/icons/icon-192.png', 'sizes' => '192x192']]],
            ['name' => 'Overview', 'short_name' => 'Overview', 'url' => APP_URL . '/overview', 'icons' => [['src' => APP_URL . '/assets/icons/icon-192.png', 'sizes' => '192x192']]],
        ],
    ], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}
// Service Worker
if ($route === 'sw.js') {
    header('Content-Type: application/javascript');
    echo <<<'SW'
const CACHE_NAME = 'taskflow-v3';
const STATIC_ASSETS = ['/dashboard', '/assets/css/style.css', '/assets/js/app.js'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);

    // Network-first for API & pages, cache-first for static assets
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/assets/')) {
        e.respondWith(
            fetch(e.request).then(r => {
                if (r.ok) {
                    const rc = r.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, rc));
                }
                return r;
            }).catch(() => caches.match(e.request))
        );
    } else {
        e.respondWith(
            fetch(e.request).then(r => {
                if (r.ok) {
                    const rc = r.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, rc));
                }
                return r;
            }).catch(() => caches.match(e.request).then(cached => {
                if (cached) return cached;
                return caches.match('/dashboard');
            }))
        );
    }
});
SW;
    exit;
}

// ── Version info endpoint (no auth required) ─────────────────────────────────
if ($route === 'api/version') {
    header('Content-Type: application/json');
    $db = Database::getInstance();
    $mysqlVer = $db->getConnection()->query("SELECT VERSION() AS v")->fetchColumn();
    echo json_encode([
        'app'   => APP_VERSION,
        'php'   => PHP_VERSION,
        'mysql' => $mysqlVer,
        'required' => [
            'php'   => REQUIRED_PHP_VERSION,
            'mysql' => REQUIRED_MYSQL_VERSION,
        ],
        'php_ok'   => version_compare(PHP_VERSION, REQUIRED_PHP_VERSION, '>='),
        'mysql_ok' => version_compare($mysqlVer,   REQUIRED_MYSQL_VERSION, '>='),
        'ai_model' => defined('OPENAI_TASK_MODEL') ? OPENAI_TASK_MODEL : 'gpt-4o-mini',
        'features' => [
            'match_expr'      => PHP_VERSION_ID >= 80000,
            'str_starts_with' => PHP_VERSION_ID >= 80000,
            'arrow_fn'        => PHP_VERSION_ID >= 70400,
            'utf8mb4'         => true,
        ],
    ]);
    exit;
}

// ── Frontend observability endpoint (rate-limited, structured logging) ───────
if ($route === 'api/client-log' && $method === 'POST') {
    require_once __DIR__ . '/controllers/api/ClientLogController.php';
    (new ClientLogController())->store();
    exit;
}

// ── Mi-Core internal snapshot (localhost only, no auth required) ─────────────
if ($route === 'api/mi/snapshot' && $method === 'GET') {
    require_once __DIR__ . '/controllers/api/MiSnapshotController.php';
    (new MiSnapshotController())->snapshot();
    exit;
}

// ── Production health & metrics endpoint (admin only) ────────────────────────
if ($route === 'api/health' && $method === 'GET') {
    header('Content-Type: application/json');
    if (!isLoggedIn() || !canAdmin()) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }
    $db = Database::getInstance();
    $taskStats = $db->fetch("SELECT COUNT(*) as total, SUM(is_completed=1) as completed, SUM(is_completed=0 AND due_date < CURDATE()) as overdue FROM tasks");
    $recurStats = $db->fetch("SELECT COUNT(*) as recurring_tasks, COUNT(DISTINCT recurring_root_id) as recurring_chains FROM tasks WHERE repeat_type != 'none'");
    $frontendLogSize = 0;
    $frontendLogPath = __DIR__ . '/logs/frontend.log';
    if (file_exists($frontendLogPath)) $frontendLogSize = filesize($frontendLogPath);
    $appLogSize = 0;
    $appLogPath = __DIR__ . '/logs/app.log';
    if (file_exists($appLogPath)) $appLogSize = filesize($appLogPath);
    echo json_encode([
        'status' => 'healthy',
        'timestamp' => date('c'),
        'metrics' => [
            'tasks_total' => (int)($taskStats['total'] ?? 0),
            'tasks_completed' => (int)($taskStats['completed'] ?? 0),
            'tasks_overdue' => (int)($taskStats['overdue'] ?? 0),
            'recurring_tasks' => (int)($recurStats['recurring_tasks'] ?? 0),
            'recurring_chains' => (int)($recurStats['recurring_chains'] ?? 0),
        ],
        'logs' => [
            'frontend_log_bytes' => $frontendLogSize,
            'app_log_bytes' => $appLogSize,
        ],
        'php_version' => PHP_VERSION,
        'memory_usage_mb' => round(memory_get_peak_usage(true) / 1048576, 2),
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

// ── Phase 13.5 Bill & Payment Deep Audit (admin/manager) ────────────────────
if ($route === 'api/bill-audit' && $method === 'GET') {
    require_once __DIR__ . '/controllers/BillAuditController.php';
    (new BillAuditController())->run(); // v3-real
    exit;
}

// ── API v1 dispatch (MUST be before session check) ──────────────────────────
if (preg_match('/^api\/v1\//', $route)) {
    require_once __DIR__ . '/controllers/api/api_bootstrap.php';
    api_dispatch($route, $method);
    exit; // api_dispatch exits on its own, but be safe
}

// ── Session check ──────────────────────────────────────────────────────────────────
$workflowApiRoute = str_starts_with($route, 'api/workflow/');
if (!isLoggedIn() && !in_array($route, $publicRoutes) && !str_starts_with($route, 'release/review/') && !$workflowApiRoute) redirect('login');

// Release session file lock — page render doesn't need it.
// Prevents concurrent tab requests from queuing behind each other.
// (POST routes that write to session must call session_start() again themselves.)
if ($method === 'GET' && !in_array($route, ['login', 'register', 'logout'])) {
    session_write_close();
}


try { switch (true) {
    case $route === 'login': $c = new AuthController(); $method === 'POST' ? $c->login() : $c->showLogin(); break;
    case $route === 'register': $c = new AuthController(); $method === 'POST' ? $c->register() : $c->showRegister(); break;
    case $route === 'logout': (new AuthController())->logout(); break;
    case $route === 'home':
        redirect('overview');
        break;
    case $route === '' || $route === 'dashboard':
        // CEO/Manager land on the unified Overview command center
        // Staff land on My Tasks (personal work queue)
        if (isAdmin() || isManager()) {
            redirect('overview');
        }
        (new DashboardController())->index();
        break;
    case $route === 'calendar': (new DashboardController())->calendar(); break;
    case $route === 'inbox': (new InboxController())->index(); break;
    case $route === 'my-tasks': (new DashboardController())->myTasks(); break;
    case $route === 'related-tasks': (new DashboardController())->relatedTasks(); break;
    case $route === 'new-tasks': header('Location: ' . APP_URL . '/my-tasks?filter=new', true, 302); exit; break;
    case $route === 'store-overview': (new DashboardController())->storeOverview(); break;
            case $route === 'overview': if (!isAdmin() && !isManager()) redirect('my-tasks'); (new DashboardController())->overview(); break;
    case $route === 'ceo':    redirect('overview'); break; // Deprecated — merged into /overview
    case $route === 'team':   (new TeamController())->index(); break;
    case $route === 'team-load': (new TeamController())->index('load'); break;
    case preg_match('/^team\/member\/(\d+)$/', $route, $m) && $method === 'GET': (new TeamController())->memberDetail((int)$m[1]); break;
    case $route === 'api/team/summary' && $method === 'GET': (new TeamController())->apiSummary(); break;
    case $route === 'api/team/members' && $method === 'GET': (new TeamController())->apiMembers(); break;
    case preg_match('/^api\/team\/member\/(\d+)$/', $route, $m) && $method === 'GET': (new TeamController())->apiMemberDetail((int)$m[1]); break;
    case $route === 'api/team/rebalance-plan'   && $method === 'GET':  (new TeamController())->apiRebalancePlan();   break;
    case $route === 'api/team/rebalance-apply'  && $method === 'POST': (new TeamController())->apiRebalanceApply();  break;
    // ── Phase 13.5 Bill & Payment Deep Audit ────────────────────────────────────────────────
    case ($route === 'api/bill-audit' || $route === 'api/phase13-5/bill-audit') && $method === 'GET':
        require_once __DIR__ . '/controllers/BillAuditController.php';
        (new BillAuditController())->run(); break;

    // ── Command Palette search ───────────────────────────────────────────────────────────────
    case $route === 'api/command-palette' && $method === 'GET':
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'], 401);
        header('Content-Type: application/json; charset=utf-8');
        try {
            $q    = trim((string)($_GET['q'] ?? ''));
            $mode = 'search';
            if (str_starts_with($q, '>')) { $mode = 'action'; $q = ltrim(substr($q,1)); }
            elseif (str_starts_with($q, '?')) { $mode = 'ai'; $q = ltrim(substr($q,1)); }
            $engine = new CommandSearchEngine();
            echo json_encode($engine->search($q, $mode), JSON_UNESCAPED_UNICODE);
        } catch (\Throwable $e) {
            echo json_encode(['query'=>'','mode'=>'search','pages'=>[],'stores'=>[],'bills'=>[],'tasks'=>[],'users'=>[],'actions'=>[],'ai'=>[]]);
        }
        exit;

    case $route === 'api/sidebar/badges' && $method === 'GET':
        header('Content-Type: application/json');
        try {
            $today = function_exists('app_today') ? app_today() : date('Y-m-d');
            $uid   = $_SESSION['user_id'] ?? 0;
            $_db   = Database::getInstance();
            $isPriv = isAdmin() || isManager();
            $overdue = (int)(($isPriv
                ? $_db->fetch("SELECT COUNT(*) AS c FROM tasks WHERE is_completed=0 AND status!='completed' AND due_date<?",[$today])
                : $_db->fetch("SELECT COUNT(*) AS c FROM tasks WHERE is_completed=0 AND status!='completed' AND due_date<? AND assignee_id=?",[$today,$uid])
            )['c'] ?? 0);
            $today_count = (int)(($isPriv
                ? $_db->fetch("SELECT COUNT(*) AS c FROM tasks WHERE is_completed=0 AND status!='completed' AND due_date=?",[$today])
                : $_db->fetch("SELECT COUNT(*) AS c FROM tasks WHERE is_completed=0 AND status!='completed' AND due_date=? AND assignee_id=?",[$today,$uid])
            )['c'] ?? 0);
            $payments = (int)($_db->fetch("SELECT COUNT(*) AS c FROM bills WHERE status='overdue' OR (due_date<? AND status='pending')",[$today])['c'] ?? 0);
            $filings  = (int)($_db->fetch("SELECT COUNT(*) AS c FROM bills WHERE (category IN ('tax','payroll') OR vendor LIKE '%CDTFA%' OR vendor LIKE '%IRS%' OR vendor LIKE '%EDD%' OR vendor LIKE '%FTB%') AND (status='overdue' OR (due_date<? AND status='pending'))",[$today])['c'] ?? 0);
            $inbox    = (int)((new Notification())->getUnreadCount($uid)) + (int)((new TaskNotification())->getUnreadCount($uid));
            $priority = min(99, $overdue + $payments + $filings);
            echo json_encode(['priority'=>$priority,'overdue'=>$overdue,'today'=>$today_count,'payments'=>$payments,'filings'=>$filings,'inbox'=>$inbox]);
        } catch (\Throwable $e) {
            echo json_encode(['priority'=>0,'overdue'=>0,'today'=>0,'payments'=>0,'filings'=>0,'inbox'=>0]);
        }
        exit;
    case $route === 'api/team/rebalance-status' && $method === 'GET':  (new TeamController())->apiRebalanceStatus(); break;
    case $route === 'api/verification/summary' && $method === 'GET': (new VerificationController())->apiSummary(); break;
    case $route === 'api/accounting/verification/summary' && $method === 'GET': (new VerificationController())->apiAccountingSummary(); break;
    case $route === 'api/decision/problems'    && $method === 'GET':  (new TeamController())->apiDecisionProblems(); break;
    case $route === 'api/decision/compare'     && $method === 'GET':  (new TeamController())->apiDecisionCompare();  break;
    // V4 Decision OS routes
    case $route === 'api/decision'             && $method === 'GET':  (new TeamController())->apiDecisionRank();     break;
    case $route === 'api/decision/next'        && $method === 'GET':  (new TeamController())->apiDecisionNext();     break;
    case $route === 'api/decision/simulate'    && $method === 'POST': (new TeamController())->apiDecisionSimulate(); break;
    // V5 Autonomy routes
    case $route === 'api/autonomy/decisions'   && $method === 'GET':  (new TeamController())->apiAutonomyDecisions();  break;
    case $route === 'api/autonomy/approve'     && $method === 'POST': (new TeamController())->apiAutonomyApprove();    break;
    case $route === 'api/autonomy/reject'      && $method === 'POST': (new TeamController())->apiAutonomyReject();     break;
    case $route === 'api/autonomy/execute-safe'&& $method === 'POST': (new TeamController())->apiAutonomyExecute();   break;
    case $route === 'api/autonomy/log'         && $method === 'GET':  (new TeamController())->apiAutonomyLog();       break;
    case $route === 'api/autonomy/settings'    && $method === 'GET':  (new TeamController())->apiAutonomySettings();  break;
    case preg_match('/^overview\/store\/(\d+)$/',  $route, $m): (new DashboardController())->businessDetail($m[1]); break;
    case preg_match('/^overview\/member\/(\d+)$/', $route, $m): (new DashboardController())->memberDetail($m[1]); break;
    // ── Executive Drill-Down ─────────────────────────────────────────────────
    case preg_match('#^overview/drilldown/overdue-bills$#', $route) && $method === 'GET':
        require_once __DIR__ . '/controllers/DrilldownController.php';
        (new DrilldownController())->overdueBills(); break;
    case preg_match('#^overview/drilldown/critical-tasks$#', $route) && $method === 'GET':
        require_once __DIR__ . '/controllers/DrilldownController.php';
        (new DrilldownController())->criticalTasks(); break;
    case preg_match('#^overview/drilldown/compliance-risk$#', $route) && $method === 'GET':
        require_once __DIR__ . '/controllers/DrilldownController.php';
        (new DrilldownController())->complianceRisk(); break;
    case preg_match('#^overview/drilldown/execution-risk$#', $route) && $method === 'GET':
        require_once __DIR__ . '/controllers/DrilldownController.php';
        (new DrilldownController())->executionRisk(); break;
    case preg_match('#^overview/drilldown/unified-risk$#', $route) && $method === 'GET':
        require_once __DIR__ . '/controllers/DrilldownController.php';
        (new DrilldownController())->unifiedRisk(); break;
    case preg_match('#^overview/drilldown/penalty$#', $route) && $method === 'GET':
        require_once __DIR__ . '/controllers/DrilldownController.php';
        (new DrilldownController())->penalty(); break;
    case preg_match('#^overview/drilldown/cash-risk$#', $route) && $method === 'GET':
        require_once __DIR__ . '/controllers/DrilldownController.php';
        (new DrilldownController())->cashRisk(); break;
    case preg_match('#^overview/drilldown/finance-bills$#', $route) && $method === 'GET':
        require_once __DIR__ . '/controllers/DrilldownController.php';
        (new DrilldownController())->financeBills(); break;
    case preg_match('#^overview/drilldown/execution-health$#', $route) && $method === 'GET':
        require_once __DIR__ . '/controllers/DrilldownController.php';
        (new DrilldownController())->executionHealth(); break;

    // ── P0: Bill workflow API ──────────────────────────────────────────────────
    case preg_match('#^bills/(\d+)/workflow/([a-z_-]+)$#', $route, $m) && $method === 'POST':
        (new BillController())->workflowTransition((int)$m[1], $m[2]); break;

    // ── P0: Duplicate check APIs ───────────────────────────────────────────────
    case $route === 'api/bills/check-duplicate' && $method === 'POST':
        (new BillController())->apiCheckDuplicate(); break;
    case $route === 'api/tasks/check-duplicate' && $method === 'POST':
        (new TaskController())->apiCheckDuplicate(); break;

    // ── P0: Admin duplicates UI ────────────────────────────────────────────────
    case $route === 'admin/duplicates' && $method === 'GET':
        (new AdminDuplicatesController())->index(); break;
    case preg_match('#^admin/duplicates/(\d+)/archive$#', $route, $m) && $method === 'POST':
        (new AdminDuplicatesController())->archive((int)$m[1]); break;
    case preg_match('#^admin/duplicates/(\d+)/ignore$#', $route, $m) && $method === 'POST':
        (new AdminDuplicatesController())->ignore((int)$m[1]); break;
    case preg_match('#^admin/duplicates/(\d+)/not-duplicate$#', $route, $m) && $method === 'POST':
        (new AdminDuplicatesController())->notDuplicate((int)$m[1]); break;

    // ── P0: Bill drilldown by category / store ────────────────────────────────
    case preg_match('#^overview/drilldown/bills/category/([a-z_-]+)$#', $route, $m) && $method === 'GET':
        require_once __DIR__ . '/controllers/DrilldownController.php';
        (new DrilldownController())->billsByCategory($m[1]); break;
    case preg_match('#^overview/drilldown/bills/store/(\d+)$#', $route, $m) && $method === 'GET':
        require_once __DIR__ . '/controllers/DrilldownController.php';
        (new DrilldownController())->billsByStore((int)$m[1]); break;
    // ── Exception Queue ───────────────────────────────────────────────────────
    case $route === 'exception-queue' && $method === 'GET':
        require_once __DIR__ . '/controllers/ExceptionQueueController.php';
        (new ExceptionQueueController())->index(); break;

    // ── Task Type View ────────────────────────────────────────────────────────
    case $route === 'task-type-view' && $method === 'GET':
        require_once __DIR__ . '/controllers/TaskTypeViewController.php';
        (new TaskTypeViewController())->index(); break;

    // ── API: GET /api/locations — admin sees all, others see own store only ──
    case $route === 'api/locations' && $method === 'GET':
        if (!isLoggedIn()) { http_response_code(401); echo json_encode(['error'=>'Unauthorized']); exit; }
        $db = Database::getInstance();
        if (canAdmin()) {
            $stores = $db->fetchAll("SELECT id, name, color, is_active FROM stores ORDER BY name");
        } else {
            $myStoreId = $_SESSION['store_id'] ?? 0;
            $stores = $myStoreId
                ? $db->fetchAll("SELECT id, name, color, is_active FROM stores WHERE id=?", [$myStoreId])
                : [];
        }
        header('Content-Type: application/json');
        echo json_encode(['locations' => $stores]); exit;

    // ── API: GET /api/task-templates ──────────────────────────────────────────
    case $route === 'api/task-templates' && $method === 'GET':
        $db = Database::getInstance();
        $templates = $db->tableExists('task_templates')
            ? $db->fetchAll("SELECT * FROM task_templates WHERE is_active=1 ORDER BY criticality DESC, task_type")
            : [];
        header('Content-Type: application/json');
        echo json_encode(['templates' => $templates]); exit;

    // ── API: GET /api/verification-results ────────────────────────────────────
    case $route === 'api/verification-results' && $method === 'GET':
        $db = Database::getInstance();
        $taskId = isset($_GET['task_id']) ? (int)$_GET['task_id'] : null;
        $results = [];
        if ($db->tableExists('verification_results')) {
            if ($taskId) {
                $results = $db->fetchAll("SELECT * FROM verification_results WHERE task_id=? ORDER BY created_at DESC", [$taskId]);
            } else {
                $results = $db->fetchAll("SELECT * FROM verification_results ORDER BY created_at DESC LIMIT 100");
            }
        }
        header('Content-Type: application/json');
        echo json_encode(['verification_results' => $results]); exit;

    // ── API: POST /api/tasks/:id/verification-result ──────────────────────────
    case preg_match('#^api/tasks/(\d+)/verification-result$#', $route, $m) && $method === 'POST':
        $db     = Database::getInstance();
        $taskId = (int)$m[1];
        $body   = json_decode(file_get_contents('php://input'), true) ?? [];
        $status = $body['verification_status'] ?? 'pending';
        $allowed = ['pending','verified','failed','exception'];
        if (!in_array($status, $allowed)) {
            http_response_code(422);
            echo json_encode(['error' => 'Invalid verification_status']);
            exit;
        }
        // Insert verification result
        if ($db->tableExists('verification_results')) {
            $db->execute(
                "INSERT INTO verification_results (task_id, verification_status, confidence_score, evidence_source, evidence_date, evidence_amount, evidence_payee, notes, verified_by)
                 VALUES (?,?,?,?,?,?,?,?,?)",
                [
                    $taskId,
                    $status,
                    isset($body['confidence_score']) ? (float)$body['confidence_score'] : null,
                    $body['evidence_source'] ?? null,
                    $body['evidence_date'] ?? null,
                    isset($body['evidence_amount']) ? (float)$body['evidence_amount'] : null,
                    $body['evidence_payee'] ?? null,
                    $body['notes'] ?? null,
                    $_SESSION['user_id'] ?? null,
                ]
            );
        }
        // Update verification_status on task
        if ($db->columnExists('tasks','verification_status')) {
            $db->execute("UPDATE tasks SET verification_status=? WHERE id=?", [$status, $taskId]);
        }
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'task_id' => $taskId, 'verification_status' => $status]); exit;

    case $route === 'ai-import': (new AiTaskController())->index(); break;
    case $route === 'ai-import/store': (new AiTaskController())->storeIndex(); break;
    case $route === 'ai-import/store/create' && $method === 'POST': (new AiTaskController())->createStoreForProjects(); break;
    case preg_match('/^ai-import\/store\/(\d+)$/', $route, $m): (new AiTaskController())->storeProjects($m[1]); break;
    case preg_match('/^ai-import\/store\/(\d+)\/project\/create$/', $route, $m) && $method === 'POST': (new AiTaskController())->createProjectForStore($m[1]); break;
    case $route === 'ai-import/bills': (new AiTaskController())->billIndex(); break;
    case $route === 'ai-import/bills/store/create' && $method === 'POST': (new AiTaskController())->createStoreForBills(); break;
    case preg_match('/^ai-import\/bills\/(\d+)$/', $route, $m): (new AiTaskController())->billImport($m[1]); break;
    case preg_match('/^ai-import\/bills\/(\d+)\/analyze$/', $route, $m) && $method === 'POST': (new AiTaskController())->analyzeBill($m[1]); break;
    case preg_match('/^ai-import\/bills\/(\d+)\/save$/', $route, $m) && $method === 'POST': (new AiTaskController())->saveBill($m[1]); break;
    case preg_match('/^ai-import\/bills\/(\d+)\/discard$/', $route, $m) && $method === 'POST': (new AiTaskController())->discardBill($m[1]); break;
    case $route === 'settings': $c = new AuthController(); $method === 'POST' ? $c->updateSettings() : $c->settings(); break;

    // ── Penalty: Admin management page (legacy config) ───────────────────────
    case $route === 'admin/penalty' && $method === 'GET': (new PenaltyController())->adminIndex(); break;
    case $route === 'admin/verification-rules-preview' && $method === 'GET': (new VerificationController())->rulesScreen(); break;
    case $route === 'admin/verification-rules' && $method === 'GET': redirect('admin/verification-rules-preview'); break;
    // ── Penalty: Admin AJAX actions ───────────────────────────────────────────
    case $route === 'admin/penalty/add'    && $method === 'POST': (new PenaltyController())->adminAdd();    break;
    case $route === 'admin/penalty/update' && $method === 'POST': (new PenaltyController())->adminUpdate(); break;
    case $route === 'admin/penalty/remove' && $method === 'POST': (new PenaltyController())->adminRemove(); break;
    case $route === 'admin/penalty/toggle' && $method === 'POST': (new PenaltyController())->adminToggle(); break;
    // ── Penalty: Admin API — detail per member ────────────────────────────────
    case preg_match('/^api\/admin\/penalty\/detail\/(\d+)$/', $route, $m) && $method === 'GET':
        (new PenaltyController())->adminDetail((int)$m[1]); break;
    // ── Penalty: Admin API — all summaries ───────────────────────────────────
    case $route === 'api/admin/penalty/summary' && $method === 'GET':
        (new PenaltyController())->adminSummaryApi(); break;
    // ── Penalty: Member API — own summary ────────────────────────────────────
    case $route === 'api/penalty/my-summary' && $method === 'GET':
        (new PenaltyController())->mySummaryApi(); break;
    // ── Penalty: CEO read-only summary ───────────────────────────────────────
    case $route === 'ceo/penalties' && $method === 'GET':
        (new PenaltyController())->ceoSummary(); break;

    // ── Phase 13.4 — Penalty & Accountability System ─────────────────────────
    // Admin: full penalty dashboard (log, analytics, appeals)
    case $route === 'admin/penalties' && $method === 'GET':
        (new PenaltyController())->adminDashboard(); break;
    case $route === 'admin/penalties/config' && $method === 'POST':
        (new PenaltyController())->adminDashboardConfig(); break;
    // Admin: penalty rules CRUD
    case $route === 'admin/penalty-rules' && $method === 'GET':
        (new PenaltyController())->adminRulesIndex(); break;
    case $route === 'admin/penalty-rules/save' && $method === 'POST':
        (new PenaltyController())->adminRuleSave(); break;
    case $route === 'admin/penalty-rules/toggle' && $method === 'POST':
        (new PenaltyController())->adminRuleToggle(); break;
    case $route === 'admin/penalty-rules/delete' && $method === 'POST':
        (new PenaltyController())->adminRuleDelete(); break;
    // Admin: appeal review
    case $route === 'admin/penalties/appeal/review' && $method === 'POST':
        (new PenaltyController())->adminReviewAppeal(); break;

    // ── Task Audit: admin review of suspicious completions / broken follow-ups ──
    case $route === 'admin/task-audit' && $method === 'GET':
        (new TaskAuditController())->index(); break;
    case $route === 'admin/task-audit/flag' && $method === 'POST':
        (new TaskAuditController())->flag(); break;
    case $route === 'admin/task-audit/resolve' && $method === 'POST':
        (new TaskAuditController())->resolve(); break;
    case $route === 'admin/task-audit/evidence' && $method === 'POST':
        (new TaskAuditController())->uploadEvidence(); break;
    case preg_match('#^admin/task-audit/evidence/(\d+)/download$#', $route, $m) && $method === 'GET':
        (new TaskAuditController())->downloadEvidence((int)$m[1]); break;
    // User: own penalty page (/penalties and /my-penalties both work)
    case $route === 'penalties' && $method === 'GET':
    case $route === 'my-penalties' && $method === 'GET':
        (new PenaltyController())->userMyPenalties(); break;
    // User: submit appeal
    case $route === 'penalties/appeal' && $method === 'POST':
        (new PenaltyController())->submitAppeal(); break;
    // Manager: team penalty dashboard (/manager/penalties)
    case $route === 'manager/penalties' && $method === 'GET':
        (new PenaltyController())->managerDashboard(); break;
    // CEO: accountability dashboard
    case $route === 'ceo/accountability' && $method === 'GET':
        (new AccountabilityController())->index(); break;

    // ── Deadline Extensions ───────────────────────────────────────────────────
    case $route === 'admin/extensions' && $method === 'GET':
        (new DeadlineExtensionController())->adminIndex(); break;
    case $route === 'api/extensions/pending-count' && $method === 'GET':
        (new DeadlineExtensionController())->pendingCount(); break;
    case preg_match('/^api\/tasks\/(\d+)\/extend$/', $route, $m) && $method === 'POST':
        (new DeadlineExtensionController())->selfExtend((int)$m[1]); break;
    case preg_match('/^api\/tasks\/(\d+)\/extend-request$/', $route, $m) && $method === 'POST':
        (new DeadlineExtensionController())->requestExtend((int)$m[1]); break;
    case preg_match('/^api\/extensions\/(\d+)\/approve$/', $route, $m) && $method === 'POST':
        (new DeadlineExtensionController())->approve((int)$m[1]); break;
    case preg_match('/^api\/extensions\/(\d+)\/reject$/', $route, $m) && $method === 'POST':
        (new DeadlineExtensionController())->reject((int)$m[1]); break;

    // ── Telegram: Webhook (no auth — validated by secret header) ─────────────
    case $route === 'webhook/telegram' && $method === 'POST':
        (new TelegramController())->handleWebhook(); break;
    // ── Telegram: Web UI account linking ─────────────────────────────────────
    case $route === 'telegram/link/init'   && $method === 'POST': (new TelegramController())->initLink();      break;
    case $route === 'telegram/link/unlink' && $method === 'POST': (new TelegramController())->unlink();         break;
    case $route === 'telegram/preferences' && $method === 'POST': (new TelegramController())->savePreferences(); break;
    // ── Telegram: Admin webhook setup ─────────────────────────────────────────
    case $route === 'telegram/setup-webhook' && $method === 'GET': (new TelegramController())->setupWebhook();  break;

    // Notifications API
    case $route === 'api/notifications':
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'],401);
        $n = new Notification();
        json_response(['notifications'=>$n->getByUser($_SESSION['user_id']),'unread'=>$n->getUnreadCount($_SESSION['user_id'])]);
        break;
    case preg_match('/^api\/notifications\/(\d+)\/read$/', $route, $m):
        (new Notification())->markRead($m[1], $_SESSION['user_id']); json_response(['ok'=>1]); break;
    case $route === 'api/notifications/read-all':
        (new Notification())->markAllRead($_SESSION['user_id']); json_response(['ok'=>1]); break;

    // Calendar API
    case $route === 'api/calendar':
        $mo = (int) ($_GET['month'] ?? date('m'));
        $yr = (int) ($_GET['year'] ?? date('Y'));
        $monthStart = app_month_start($yr, $mo)->format('Y-m-d');
        $monthEnd = app_month_end($yr, $mo)->format('Y-m-d');
        $tasks = (new Task())->getCalendarTasksForUser($_SESSION['user_id'], $monthStart, $monthEnd);
        json_response(['tasks'=>$tasks]); break;

    // Sprint 1.3.1 — session-auth day drawer: /api/calendar/day/YYYY-MM-DD[?project_id=N]
    case preg_match('/^api\/calendar\/day\/(\d{4}-\d{2}-\d{2})$/', $route, $m):
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        $date = $m[1];
        $uid = (int)$_SESSION['user_id'];
        $today = DateService::today();
        $projectId = (!empty($_GET['project_id']) && is_numeric($_GET['project_id'])) ? (int)$_GET['project_id'] : null;
        $rows = (new Task())->getTasksByDateForUser($uid, $date, $projectId);
        $repeatLabels = ['none'=>null,'daily'=>'Daily','weekly'=>'Weekly','weekly_multi'=>'Multi-day/week','monthly'=>'Monthly','yearly'=>'Yearly','custom_interval'=>'Custom'];
        $tasks = [];
        foreach ($rows as $t) {
            $isOverdue = !empty($t['due_date']) && $t['due_date'] < $today && empty($t['is_completed']);
            $isToday   = !empty($t['due_date']) && $t['due_date'] === $today;
            $rt = $t['repeat_type'] ?? 'none';
            $tasks[] = [
                'id' => (int)$t['id'],
                'title' => $t['title'],
                'description' => $t['description'] ?? '',
                'priority' => $t['priority'],
                'status' => $t['status'],
                'is_completed' => (int)$t['is_completed'],
                'due_date' => $t['due_date'],
                'project_name' => $t['project_name'],
                'project_color' => $t['project_color'],
                'store_name' => $t['store_name'],
                'store_color' => $t['store_color'],
                'section_name' => $t['section_name'],
                'assignee_id' => !empty($t['assignee_id']) ? (int)$t['assignee_id'] : null,
                'assignee_name' => $t['assignee_name'],
                'assignee_avatar' => $t['assignee_avatar'],
                'repeat_type' => $rt,
                'is_recurring' => $rt && $rt !== 'none',
                'recurrence_label' => $repeatLabels[$rt] ?? null,
                'badge' => $isOverdue ? 'overdue' : ($isToday ? 'today' : null),
            ];
        }
        json_response([
            'date' => $date,
            'is_today' => $date === $today,
            'is_overdue' => $date < $today,
            'is_future' => $date > $today,
            'count' => count($tasks),
            'tasks' => $tasks,
        ]); break;

    // Sprint 1.3.3 — session-auth quick actions
    case preg_match('/^api\/tasks\/(\d+)\/complete$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'],401);
        if (!verify_csrf($_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) json_response(['error'=>'Invalid CSRF'],403);
        $taskModel = new Task();
        if (!$taskModel->canEdit((int)$m[1], (int)$_SESSION['user_id'])) json_response(['error'=>'Forbidden'],403);
        // Guard: if task has a reviewer and current user is the assignee (not admin/reviewer), block direct complete
        if (!isAdmin()) {
            $_tForGuard = $taskModel->findById((int)$m[1]);
            if ($_tForGuard && !empty($_tForGuard['reviewer_id'])
                && (int)$_tForGuard['assignee_id'] === (int)$_SESSION['user_id']
                && (int)$_tForGuard['reviewer_id'] !== (int)$_SESSION['user_id']
                && !in_array($_tForGuard['status'] ?? '', ['pending_acceptance','done'], true)) {
                json_response(['error'=>'needs_review','message'=>'Task has a reviewer — please submit for review instead of marking done directly.'],409);
            }
        }
        $svc = new TaskCompletionService();
        $res = $svc->complete((int)$m[1], (int)$_SESSION['user_id']);
        json_response(['ok'=>true,'result'=>$res]); break;

    // Focus Card — next urgent task for current user (used by my-tasks auto-refresh)
    case $route === 'api/my-tasks/next-focus' && $method === 'GET':
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'],401);
        (new DashboardController())->apiFocusNext(); break;

    case preg_match('/^api\/tasks\/(\d+)\/move-date$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'],401);
        if (!verify_csrf($_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) json_response(['error'=>'Invalid CSRF'],403);
        $taskModel = new Task();
        if (!$taskModel->canEdit((int)$m[1], (int)$_SESSION['user_id'])) json_response(['error'=>'Forbidden'],403);
        $due = trim($_POST['due_date'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $due)) json_response(['error'=>'Invalid date'],422);
        $taskModel->update((int)$m[1], ['due_date'=>$due]);
        json_response(['ok'=>true,'due_date'=>$due]); break;

    case preg_match('/^api\/tasks\/(\d+)\/snooze$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'],401);
        if (!verify_csrf($_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) json_response(['error'=>'Invalid CSRF'],403);
        $days = max(1, min(30, (int)($_POST['days'] ?? 1)));
        $taskModel = new Task();
        if (!$taskModel->canEdit((int)$m[1], (int)$_SESSION['user_id'])) json_response(['error'=>'Forbidden'],403);
        $t = $taskModel->findById((int)$m[1]);
        if (!$t) json_response(['error'=>'Not found'],404);
        $base = $t['due_date'] ? substr($t['due_date'],0,10) : DateService::today();
        $newDue = DateService::addDays($base, $days);
        $taskModel->update((int)$m[1], ['due_date'=>$newDue]);
        json_response(['ok'=>true,'due_date'=>$newDue,'days'=>$days]); break;

    case preg_match('/^api\/tasks\/(\d+)\/reassign$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'],401);
        if (!verify_csrf($_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) json_response(['error'=>'Invalid CSRF'],403);
        $aid = isset($_POST['assignee_id']) && $_POST['assignee_id'] !== '' ? (int)$_POST['assignee_id'] : null;
        $taskModel = new Task();
        if (!$taskModel->canEdit((int)$m[1], (int)$_SESSION['user_id'])) json_response(['error'=>'Forbidden'],403);
        $taskModel->update((int)$m[1], ['assignee_id'=>$aid]);
        $u = $aid ? Database::getInstance()->fetch("SELECT name, avatar FROM users WHERE id = ?", [$aid]) : null;
        json_response(['ok'=>true,'assignee_id'=>$aid,'assignee_name'=>$u['name'] ?? null,'assignee_avatar'=>$u['avatar'] ?? null]); break;

    // TKT-106 · status + priority quick-change
    case preg_match('/^api\/tasks\/(\d+)\/status$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'],401);
        if (!verify_csrf($_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) json_response(['error'=>'Invalid CSRF'],403);
        $taskModel = new Task();
        if (!$taskModel->canEdit((int)$m[1], (int)$_SESSION['user_id'])) json_response(['error'=>'Forbidden'],403);
        $status = $_POST['status'] ?? '';
        if (!in_array($status, ['todo','in_progress','review','done'], true)) json_response(['error'=>'Invalid status'],422);
        // Guard: prevent assignee from marking done directly when task has a pending reviewer
        if ($status === 'done' && !isAdmin()) {
            $_tForGuard = $taskModel->findById((int)$m[1]);
            if ($_tForGuard && !empty($_tForGuard['reviewer_id'])
                && (int)$_tForGuard['assignee_id'] === (int)$_SESSION['user_id']
                && (int)$_tForGuard['reviewer_id'] !== (int)$_SESSION['user_id']
                && !in_array($_tForGuard['status'] ?? '', ['pending_acceptance','done'], true)) {
                json_response(['error'=>'needs_review','message'=>'Task has a reviewer — submit for review first. The task will be marked done after the reviewer approves.'],409);
            }
        }
        $data = ['status' => $status, 'is_completed' => $status === 'done' ? 1 : 0];
        $taskModel->update((int)$m[1], $data);
        json_response(['ok'=>true,'status'=>$status,'is_completed'=>$data['is_completed']]); break;

    case preg_match('/^api\/tasks\/(\d+)\/priority$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'],401);
        if (!verify_csrf($_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) json_response(['error'=>'Invalid CSRF'],403);
        $taskModel = new Task();
        if (!$taskModel->canEdit((int)$m[1], (int)$_SESSION['user_id'])) json_response(['error'=>'Forbidden'],403);
        $pri = $_POST['priority'] ?? '';
        if (!in_array($pri, ['low','medium','high','urgent'], true)) json_response(['error'=>'Invalid priority'],422);
        $taskModel->update((int)$m[1], ['priority' => $pri]);
        json_response(['ok'=>true,'priority'=>$pri]); break;

    // TKT-102 · Task context for drawer focus — returns just enough to open the drawer at the right day
    case preg_match('/^api\/tasks\/(\d+)\/quick$/', $route, $m):
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'],401);
        $taskModel = new Task();
        if (!$taskModel->canView((int)$m[1], (int)$_SESSION['user_id'])) json_response(['error'=>'Forbidden'],403);
        $row = Database::getInstance()->fetch(
            "SELECT t.id, t.title, t.due_date, t.project_id, t.is_completed
             FROM tasks t WHERE t.id = ?",
            [(int)$m[1]]
        );
        if (!$row) json_response(['error'=>'Not found'],404);
        json_response([
            'id' => (int)$row['id'],
            'title' => $row['title'],
            'due_date' => $row['due_date'],
            'project_id' => $row['project_id'] ? (int)$row['project_id'] : null,
            'is_completed' => (int)$row['is_completed'],
        ]); break;

    // TKT-205 · Comments in drawer (list + add)
    case preg_match('/^api\/tasks\/(\d+)\/comments$/', $route, $m):
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'],401);
        $tid = (int)$m[1];
        $taskModel = new Task();
        if (!$taskModel->canView($tid, (int)$_SESSION['user_id'])) json_response(['error'=>'Forbidden'],403);
        if ($method === 'POST' && !$taskModel->canEdit($tid, (int)$_SESSION['user_id'])) json_response(['error'=>'Forbidden'],403);
        if ($method === 'POST') {
            if (!verify_csrf($_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) json_response(['error'=>'Invalid CSRF'],403);
            $content = trim($_POST['content'] ?? '');
            if ($content === '') json_response(['error'=>'Content required'],422);
            $cid = (new Comment())->create($tid, (int)$_SESSION['user_id'], $content);
            $c = Database::getInstance()->fetch(
                "SELECT c.*, u.name as user_name, u.avatar as user_avatar FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?",
                [$cid]
            );
            json_response(['ok'=>true,'comment'=>[
                'id'=>(int)$c['id'],'content'=>$c['content'],'user_name'=>$c['user_name'],
                'user_avatar'=>$c['user_avatar'],'created_at'=>$c['created_at']
            ]]);
        } else {
            $rows = (new Comment())->getByTask($tid);
            $out = array_map(fn($c) => [
                'id'=>(int)$c['id'],'content'=>$c['content'],
                'user_name'=>$c['user_name'] ?? '—','user_avatar'=>$c['user_avatar'] ?? null,
                'created_at'=>$c['created_at']
            ], $rows);
            json_response(['comments'=>$out,'count'=>count($out)]);
        }
        break;

    // TKT-206 · Subtask summary — count + quick list for parent task
    case preg_match('/^api\/tasks\/(\d+)\/subtasks$/', $route, $m):
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'],401);
        $taskModel = new Task();
        if (!$taskModel->canView((int)$m[1], (int)$_SESSION['user_id'])) json_response(['error'=>'Forbidden'],403);
        $rows = Database::getInstance()->fetchAll(
            "SELECT id, title, is_completed, priority, due_date, assignee_id
             FROM tasks WHERE parent_task_id = ? ORDER BY is_completed ASC, created_at ASC",
            [(int)$m[1]]
        );
        $rows = array_values(array_filter($rows, fn($r) => $taskModel->canView((int)$r['id'], (int)$_SESSION['user_id'])));
        $done = 0; foreach ($rows as $r) if ($r['is_completed']) $done++;
        json_response([
            'count' => count($rows),
            'completed' => $done,
            'subtasks' => array_map(fn($r) => [
                'id'=>(int)$r['id'],'title'=>$r['title'],'is_completed'=>(int)$r['is_completed'],
                'priority'=>$r['priority'],'due_date'=>$r['due_date'],
            ], $rows),
        ]); break;

    // TKT-208 · Recurrence inspector — next 5 occurrences
    case preg_match('/^api\/tasks\/(\d+)\/recurrence-preview$/', $route, $m):
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'],401);
        $taskModel = new Task();
        if (!$taskModel->canView((int)$m[1], (int)$_SESSION['user_id'])) json_response(['error'=>'Forbidden'],403);
        $t = $taskModel->findById((int)$m[1]);
        if (!$t) json_response(['error'=>'Not found'],404);
        $occs = [];
        if (($t['repeat_type'] ?? 'none') !== 'none') {
            $svc = new RecurringTaskService($taskModel);
            $cur = $t;
            for ($i = 0; $i < 5 && $svc->shouldContinue($cur); $i++) {
                $next = $svc->computeNextDueDate($cur);
                if (!$next) break;
                $occs[] = $next;
                $cur['due_date'] = $next;
                $cur['occurrence_index'] = ($cur['occurrence_index'] ?? 0) + 1;
            }
        }
        json_response([
            'repeat_type' => $t['repeat_type'] ?? 'none',
            'current_due' => $t['due_date'],
            'next_occurrences' => $occs,
        ]); break;

    // TKT-202 · Inline title edit
    case preg_match('/^api\/tasks\/(\d+)\/title$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'],401);
        if (!verify_csrf($_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) json_response(['error'=>'Invalid CSRF'],403);
        $taskModel = new Task();
        if (!$taskModel->canEdit((int)$m[1], (int)$_SESSION['user_id'])) json_response(['error'=>'Forbidden'],403);
        $title = trim($_POST['title'] ?? '');
        if ($title === '') json_response(['error'=>'Title required'],422);
        $taskModel->update((int)$m[1], ['title'=>$title]);
        json_response(['ok'=>true,'title'=>$title]); break;

    // TKT-204 · Bulk action endpoint — { ids: [...], action: complete|reassign|move|snooze|delete }
    case $route === 'api/tasks/bulk' && $method === 'POST':
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'],401);
        if (!verify_csrf($_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) json_response(['error'=>'Invalid CSRF'],403);
        $ids = array_filter(array_map('intval', explode(',', (string)($_POST['ids'] ?? ''))));
        $action = $_POST['action'] ?? '';
        if (empty($ids) || !$action) json_response(['error'=>'ids + action required'],422);
        $taskModel = new Task();
        $svc = new TaskCompletionService($taskModel);
        $touched = 0; $nexts = [];
        foreach ($ids as $tid) {
            try {
                if ($action === 'complete') {
                    if (!$taskModel->canEdit($tid, (int)$_SESSION['user_id'])) continue;
                    $r = $svc->complete($tid, (int)$_SESSION['user_id']);
                    if (!empty($r['next_task_id'])) $nexts[] = $r['next_task_id'];
                    $touched++;
                } elseif ($action === 'reassign') {
                    if (!$taskModel->canEdit($tid, (int)$_SESSION['user_id'])) continue;
                    $aid = isset($_POST['assignee_id']) && $_POST['assignee_id'] !== '' ? (int)$_POST['assignee_id'] : null;
                    $taskModel->update($tid, ['assignee_id'=>$aid]); $touched++;
                } elseif ($action === 'snooze') {
                    if (!$taskModel->canEdit($tid, (int)$_SESSION['user_id'])) continue;
                    $days = max(1, min(30, (int)($_POST['days'] ?? 1)));
                    $t = $taskModel->findById($tid);
                    if ($t) {
                        $base = $t['due_date'] ? substr($t['due_date'],0,10) : DateService::today();
                        $taskModel->update($tid, ['due_date' => DateService::addDays($base, $days)]);
                        $touched++;
                    }
                } elseif ($action === 'move') {
                    if (!$taskModel->canEdit($tid, (int)$_SESSION['user_id'])) continue;
                    $d = trim($_POST['due_date'] ?? '');
                    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) { $taskModel->update($tid, ['due_date'=>$d]); $touched++; }
                } elseif ($action === 'delete') {
                    if ($taskModel->canEdit($tid, (int)$_SESSION['user_id'])) { $taskModel->delete($tid); $touched++; }
                }
            } catch (Exception $e) { /* skip */ }
        }
        json_response(['ok'=>true,'touched'=>$touched,'next_occurrences'=>$nexts]); break;

    // TKT-106 · assignable users list — scoped by role (admin sees all, others see own store)
    case $route === 'api/users/assignable':
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'],401);
        $db = Database::getInstance();
        if (canAdmin()) {
            $rows = $db->fetchAll(
                "SELECT id, name, email, avatar FROM users WHERE is_active=1 ORDER BY name ASC LIMIT 200"
            );
        } else {
            // Non-admins only see users in their own store
            $myStoreId = $_SESSION['store_id'] ?? 0;
            $rows = $myStoreId
                ? $db->fetchAll(
                    "SELECT id, name, email, avatar FROM users WHERE is_active=1 AND (store_id=? OR id=?) ORDER BY name ASC LIMIT 100",
                    [$myStoreId, $_SESSION['user_id']]
                  )
                : $db->fetchAll(
                    "SELECT id, name, email, avatar FROM users WHERE is_active=1 AND id=? LIMIT 50",
                    [$_SESSION['user_id']]
                  );
        }
        json_response(['users' => array_map(fn($u) => [
            'id' => (int)$u['id'], 'name' => $u['name'], 'email' => $u['email'], 'avatar' => $u['avatar']
        ], $rows)]); break;

    // ── Global search: /api/search?q=...&limit=8 ─────────────────────────────────────────────
    //    Categorised across tasks / projects / stores / users, scoped by user ACL.
    case $route === 'api/search':
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'],401);
        $q = trim((string)($_GET['q'] ?? ''));
        if (mb_strlen($q) < 1) { json_response(['query'=>'','results'=>['tasks'=>[],'projects'=>[],'stores'=>[],'users'=>[]]]); }
        $uid = (int)$_SESSION['user_id'];
        $isAdm = isAdmin() || isManager();
        $like = '%' . $q . '%';
        $limit = max(1, min(20, (int)($_GET['limit'] ?? 6)));
        $db = Database::getInstance();

        // Tasks — privacy scoped; watchers are notification-only.
        $taskModel = new Task();
        $taskVisibilitySql = $isAdm ? '' : 'AND ' . $taskModel->scopeVisibleToUserSql('t', $uid, currentUser()['role'] ?? 'member');
        // Defensive: only select t.visibility / t.repeat_type when the columns actually exist
        // (preview DB may lag behind this code path; see Phase 0 SQLSTATE errors).
        $hasVisCol     = $db->columnExists('tasks', 'visibility');
        $hasRepeatCol  = $db->columnExists('tasks', 'repeat_type');
        $visSelect     = $hasVisCol    ? 't.visibility'      : "'public' AS visibility";
        $repeatSelect  = $hasRepeatCol ? 't.repeat_type'     : "'none'   AS repeat_type";
        $taskSql = "SELECT DISTINCT t.id, t.title, t.status, t.priority, t.due_date, t.is_completed,
                           {$repeatSelect}, {$visSelect}, p.name as project_name, p.color as project_color,
                           p.store_id, st.name as store_name, u.name as assignee_name
                    FROM tasks t
                    LEFT JOIN projects p ON t.project_id = p.id
                    LEFT JOIN stores st ON p.store_id = st.id
                    LEFT JOIN users u ON t.assignee_id = u.id
                    LEFT JOIN project_members pm ON p.id = pm.project_id
                    WHERE (t.title LIKE ? OR t.description LIKE ?)
                      {$taskVisibilitySql}
                    ORDER BY t.is_completed ASC, t.due_date IS NULL, t.due_date ASC
                    LIMIT ?";
        $tParams = [$like, $like, $limit];
        $tasks = $db->fetchAll($taskSql, $tParams);

        // Projects — only those user can see
        $projSql = "SELECT DISTINCT p.id, p.name, p.color, p.store_id, s.name as store_name
                    FROM projects p
                    LEFT JOIN stores s ON p.store_id = s.id
                    LEFT JOIN project_members pm ON p.id = pm.project_id
                    WHERE p.name LIKE ?
                      " . ($isAdm ? "" : "AND (pm.user_id = ? OR p.owner_id = ?)") . "
                    ORDER BY p.name ASC LIMIT ?";
        $projects = $db->fetchAll($projSql, $isAdm ? [$like, $limit] : [$like, $uid, $uid, $limit]);

        // Stores
        $stores = [];
        if ($db->tableExists('stores')) {
            $stores = $db->fetchAll(
                "SELECT id, name, color FROM stores WHERE name LIKE ? ORDER BY name ASC LIMIT ?",
                [$like, $limit]
            );
        }

        // Users (admins+managers see all; regular users see people they collaborate with)
        $userSql = $isAdm
            ? "SELECT id, name, email, avatar, role FROM users WHERE is_active = 1 AND (name LIKE ? OR email LIKE ?) ORDER BY name ASC LIMIT ?"
            : "SELECT DISTINCT u.id, u.name, u.email, u.avatar, u.role
               FROM users u
               LEFT JOIN project_members pm ON pm.user_id = u.id
               LEFT JOIN projects p ON p.id = pm.project_id
               WHERE u.is_active = 1 AND (u.name LIKE ? OR u.email LIKE ?)
                 AND (pm.user_id = ? OR p.owner_id = ? OR u.id = ?)
               ORDER BY u.name ASC LIMIT ?";
        $uParams = $isAdm ? [$like, $like, $limit] : [$like, $like, $uid, $uid, $uid, $limit];
        $users = $db->fetchAll($userSql, $uParams);

        $today = DateService::today();
        $taskOut = array_map(function($t) use ($today) {
            return [
                'id' => (int)$t['id'],
                'title' => $t['title'],
                'status' => $t['status'],
                'priority' => $t['priority'],
                'due_date' => $t['due_date'],
                'is_completed' => (int)$t['is_completed'],
                'is_overdue' => !empty($t['due_date']) && $t['due_date'] < $today && empty($t['is_completed']),
                'is_recurring' => !empty($t['repeat_type']) && $t['repeat_type'] !== 'none',
                'project_name' => $t['project_name'],
                'project_color' => $t['project_color'],
                'store_name' => $t['store_name'],
                'assignee_name' => $t['assignee_name'],
                'url' => '/tasks/' . (int)$t['id'],
            ];
        }, $tasks);

        json_response([
            'query' => $q,
            'results' => [
                'tasks'    => $taskOut,
                'projects' => array_map(fn($p) => [
                    'id' => (int)$p['id'], 'name' => $p['name'], 'color' => $p['color'],
                    'store_name' => $p['store_name'] ?? null,
                    'url' => '/projects/' . (int)$p['id'],
                ], $projects),
                'stores' => array_map(fn($s) => [
                    'id' => (int)$s['id'], 'name' => $s['name'], 'color' => $s['color'],
                    'url' => '/bills/store/' . (int)$s['id'],
                ], $stores),
                'users' => array_map(fn($u) => [
                    'id' => (int)$u['id'], 'name' => $u['name'], 'email' => $u['email'],
                    'avatar' => $u['avatar'], 'role' => $u['role'],
                ], $users),
            ],
            'counts' => [
                'tasks' => count($taskOut), 'projects' => count($projects),
                'stores' => count($stores), 'users' => count($users),
            ],
        ]); break;


    // Bills API
    case preg_match('/^api\/bills\/(\d+)\/detail$/',   $route, $m): (new BillController())->apiDetail($m[1]); break;
    case preg_match('/^api\/bills\/(\d+)\/payments$/', $route, $m): (new BillController())->apiPayments($m[1]); break;
    case preg_match('/^api\/bills\/(\d+)\/pay$/', $route, $m) && $method === 'POST': (new BillController())->apiMarkPaid($m[1]); break;
    case $route === 'api/tasks/reassign/preview' && $method === 'POST' && (isAdmin() || isManager()): (new TaskController())->previewReassign(); break;
    case $route === 'api/tasks/reassign' && $method === 'POST' && (isAdmin() || isManager()): (new TaskController())->bulkReassign(); break;
    case preg_match('/^bills\/(\d+)\/pay$/',           $route, $m) && $method === 'POST': (new BillController())->recordPayment($m[1]); break;

    // Bills (Tracking)
    case $route === 'bills': (new BillController())->index(); break;
    case $route === 'bills/templates': (new BillController())->templates(); break;
    case $route === 'bills/templates/create' && $method === 'POST': (new BillController())->createTemplate(); break;
    case preg_match('/^bills\/templates\/(\d+)\/generate$/', $route, $m) && $method === 'POST': (new BillController())->generateTemplate($m[1]); break;
    case preg_match('/^bills\/store\/(\d+)$/', $route, $m): (new BillController())->storeView($m[1]); break;
    case $route === 'bills/store/create' && $method === 'POST': (new BillController())->createStore(); break;
    case preg_match('/^bills\/store\/(\d+)\/update$/', $route, $m) && $method === 'POST': (new BillController())->updateStore($m[1]); break;
    case preg_match('/^bills\/store\/(\d+)\/delete$/', $route, $m): (new BillController())->deleteStore($m[1]); break;
    case $route === 'bills/create' && $method === 'POST': (new BillController())->createBill(); break;
    case preg_match('/^bills\/(\d+)$/', $route, $m) && $method === 'GET': (new BillController())->show($m[1]); break;
    case preg_match('/^bills\/(\d+)\/paid$/', $route, $m): (new BillController())->markPaid($m[1]); break;
    case preg_match('/^bills\/(\d+)\/update$/', $route, $m) && $method === 'POST': (new BillController())->updateBill($m[1]); break;
    case preg_match('/^bills\/(\d+)\/create-task$/', $route, $m) && $method === 'POST': (new BillController())->createTaskFromBill($m[1]); break;
    case preg_match('/^bills\/(\d+)\/upload$/', $route, $m) && $method === 'POST': (new BillController())->uploadBillFile($m[1]); break;
    case preg_match('/^bills\/(\d+)\/delete$/', $route, $m): (new BillController())->deleteBill($m[1]); break;
    case preg_match('/^bills\/(\d+)\/duplicate$/', $route, $m): (new BillController())->duplicateBill($m[1]); break;
    case preg_match('/^bill-attachments\/(\d+)\/delete$/', $route, $m): (new BillController())->deleteBillAttachment($m[1]); break;
    case preg_match('/^bill-attachments\/(\d+)\/download$/', $route, $m): (new BillController())->downloadBillAttachment($m[1]); break;

    // Projects
    case $route === 'projects': $c = new ProjectController(); $method === 'POST' ? $c->store() : $c->index(); break;
    case preg_match('/^projects\/create$/', $route): (new ProjectController())->create(); break;
    case preg_match('/^projects\/(\d+)$/', $route, $m): (new ProjectController())->show($m[1]); break;
    case preg_match('/^projects\/(\d+)\/edit$/', $route, $m): $c = new ProjectController(); $method === 'POST' ? $c->update($m[1]) : $c->edit($m[1]); break;
    case preg_match('/^projects\/(\d+)\/delete$/', $route, $m): (new ProjectController())->delete($m[1]); break;
    case preg_match('/^projects\/(\d+)\/archive$/', $route, $m) && $method==='POST': (new ProjectController())->archive($m[1]); break;
    case preg_match('/^sections\/(\d+)\/rename$/', $route, $m) && $method==='POST': (new ProjectController())->renameSection($m[1]); break;
    case preg_match('/^projects\/(\d+)\/members$/', $route, $m): if ($method==='POST') (new ProjectController())->addMember($m[1]); break;
    case preg_match('/^projects\/(\d+)\/members\/(\d+)\/remove$/', $route, $m): (new ProjectController())->removeMember($m[1],$m[2]); break;
    case preg_match('/^projects\/(\d+)\/sections$/', $route, $m): if ($method==='POST') (new ProjectController())->addSection($m[1]); break;
    case preg_match('/^sections\/(\d+)\/delete$/', $route, $m): (new ProjectController())->deleteSection($m[1]); break;
    case preg_match('/^projects\/(\d+)\/ai-import$/', $route, $m): (new AiTaskController())->show($m[1]); break;
    case preg_match('/^projects\/(\d+)\/ai-import\/analyze$/', $route, $m) && $method === 'POST': (new AiTaskController())->analyze($m[1]); break;
    case preg_match('/^projects\/(\d+)\/ai-import\/create$/', $route, $m) && $method === 'POST': (new AiTaskController())->create($m[1]); break;
    case preg_match('/^projects\/(\d+)\/ai-import\/discard$/', $route, $m) && $method === 'POST': (new AiTaskController())->discard($m[1]); break;

    // Tasks
    case $route === 'tasks': $method === 'POST' ? (new TaskController())->store() : (new DashboardController())->myTasks(); break;
    case preg_match('/^tasks\/(\d+)$/', $route, $m): $c = new TaskController(); $method === 'POST' ? $c->update($m[1]) : $c->show($m[1]); break;
    case preg_match('/^tasks\/(\d+)\/delete$/', $route, $m): (new TaskController())->delete($m[1]); break;
    case preg_match('/^tasks\/(\d+)\/toggle$/', $route, $m): (new TaskController())->toggleComplete($m[1]); break;
    case preg_match('/^tasks\/(\d+)\/accept$/', $route, $m) && $method === 'POST': (new TaskController())->accept($m[1]); break;
    case preg_match('/^tasks\/(\d+)\/reschedule$/', $route, $m) && $method === 'POST': (new TaskController())->reschedule($m[1]); break;
    case preg_match('/^tasks\/(\d+)\/duplicate$/', $route, $m): (new TaskController())->duplicate($m[1]); break;
    case preg_match('/^tasks\/(\d+)\/watchers$/', $route, $m) && $method === 'POST': (new TaskController())->updateWatchers($m[1]); break;
    case $route === 'tasks/reorder' && $method === 'POST': (new TaskController())->reorder(); break;
    case preg_match('/^tasks\/(\d+)\/move$/', $route, $m) && $method === 'POST': (new TaskController())->move($m[1]); break;

    // Comments
    case preg_match('/^tasks\/(\d+)\/comments$/', $route, $m) && $method === 'POST': (new CommentController())->store($m[1]); break;
    case preg_match('/^comments\/(\d+)\/delete$/', $route, $m): (new CommentController())->delete($m[1]); break;

    // Attachments
    case preg_match('/^tasks\/(\d+)\/upload$/', $route, $m) && $method === 'POST': (new TaskController())->upload($m[1]); break;
    case preg_match('/^attachments\/(\d+)\/delete$/', $route, $m): (new TaskController())->deleteAttachment($m[1]); break;
    case preg_match('/^attachments\/(\d+)\/download$/', $route, $m): (new TaskController())->downloadAttachment($m[1]); break;

    // Admin - Projects merge tool
    case $route === 'admin/projects/merge':
        if (!isAdmin()) redirect('dashboard');
        $c = new ProjectController();
        $method === 'POST' ? $c->applyMerge() : $c->showMergeForm();
        break;
    case preg_match('/^admin\/projects\/(\d+)\/delete$/', $route, $m) && $method === 'POST':
        if (!isAdmin()) redirect('dashboard');
        (new ProjectController())->adminDelete((int)$m[1]);
        break;
    case $route === 'admin/tasks/bulk-complete' && $method === 'POST':
        if (!isAdmin()) redirect('dashboard');
        (new ProjectController())->bulkComplete();
        break;
    case $route === 'admin/tasks/classify-by-store' && $method === 'POST':
        if (!isAdmin()) redirect('dashboard');
        (new ProjectController())->classifyByStore();
        break;

    // Admin - Users
    case $route === 'admin/users': $c = new AuthController(); $method === 'POST' ? $c->createUser() : $c->listUsers(); break;
    case $route === 'admin/users/create' && $method === 'GET': (new AuthController())->showCreateUser(); break;
    case preg_match('/^admin\/users\/(\d+)\/edit$/', $route, $m) && $method === 'GET': (new AuthController())->editUser($m[1]); break;
    case preg_match('/^admin\/users\/(\d+)$/', $route, $m) && $method === 'POST': (new AuthController())->updateUser($m[1]); break;
    case preg_match('/^admin\/users\/(\d+)\/deactivate$/', $route, $m) && $method === 'POST': (new AuthController())->deactivateUser($m[1]); break;
    case preg_match('/^admin\/users\/(\d+)\/reset-password$/', $route, $m) && $method === 'POST': (new AuthController())->resetUserPassword($m[1]); break;
    case preg_match('/^admin\/users\/(\d+)\/toggle$/', $route, $m) && $method === 'POST': (new AuthController())->toggleUser($m[1]); break;
    case preg_match('/^admin\/users\/(\d+)\/delete$/', $route, $m) && $method === 'POST': (new AuthController())->deleteUser($m[1]); break;
    case preg_match('/^admin\/users\/(\d+)$/', $route, $m) && $method === 'GET': (new AuthController())->showUser($m[1]); break;
    case preg_match('/^api\/admin\/users\/(\d+)\/update$/', $route, $m) && $method === 'POST':
        if (!isAdmin()) json_response(['error' => 'Forbidden'], 403);
        (new AuthController())->adminUpdateUser((int)$m[1]);
        break;

    // Overall Store Dashboard
    case $route === 'overall-store' && $method === 'GET':
        if (!canManage()) redirect('dashboard');
        (new OverallStoreController())->index();
        break;
    case preg_match('/^api\/overall-store\/(\d+)$/', $route, $m) && $method === 'GET': (new OverallStoreController())->apiStoreDetail((int)$m[1]); break;
    case preg_match('/^api\/overall-store\/(\d+)\/calendar$/', $route, $m) && $method === 'GET': (new OverallStoreController())->apiStoreCalendar((int)$m[1]); break;
    case preg_match('/^api\/overall-store\/(\d+)\/tasks$/', $route, $m) && $method === 'GET': (new OverallStoreController())->apiStoreTasks((int)$m[1], $_GET['filter'] ?? 'open'); break;
    case preg_match('/^api\/overall-store\/(\d+)\/bills$/', $route, $m) && $method === 'GET': (new OverallStoreController())->apiStoreBills((int)$m[1], $_GET['filter'] ?? 'all'); break;

    // Admin - Stores
    case $route === 'admin/stores': if (!canAdmin()) redirect('dashboard'); $c = new StoreController(); $method === 'POST' && isAdmin() ? $c->create() : $c->index(); break;
    case preg_match('/^admin\/stores\/(\d+)\/update$/', $route, $m) && $method === 'POST': if (!isAdmin()) redirect('dashboard'); (new StoreController())->update($m[1]); break;
    case preg_match('/^admin\/stores\/(\d+)\/delete$/', $route, $m): if (!isAdmin()) redirect('dashboard'); (new StoreController())->delete($m[1]); break;
    case preg_match('/^admin\/stores\/(\d+)\/edit$/', $route, $m): if (!isAdmin()) redirect('dashboard'); (new StoreController())->show($m[1]); break;
    case preg_match('/^admin\/stores\/(\d+)$/', $route, $m) && $method === 'GET': if (!canAdmin()) redirect('dashboard'); (new StoreCommandController())->show((int)$m[1]); break;
    case $route === 'admin/store-command' && $method === 'GET': if (!canManage()) redirect('dashboard'); (new StoreCommandController())->index(); break;
    case preg_match('/^admin\/store-command\/(\d+)\/health$/', $route, $m) && $method === 'GET': (new StoreCommandController())->apiHealthScore((int)$m[1]); break;
    case preg_match('/^admin\/store-command\/(\d+)\/stats$/', $route, $m) && $method === 'GET': (new StoreCommandController())->apiStats((int)$m[1]); break;

    // Admin - Vendors
    case $route === 'admin/vendors': if (!isAdmin()) redirect('dashboard'); $c = new VendorController(); $method === 'POST' ? $c->create() : $c->index(); break;
    case preg_match('/^admin\/vendors\/(\d+)\/update$/', $route, $m) && $method === 'POST': if (!isAdmin()) redirect('dashboard'); (new VendorController())->update($m[1]); break;
    case preg_match('/^admin\/vendors\/(\d+)\/delete$/', $route, $m): if (!isAdmin()) redirect('dashboard'); (new VendorController())->delete($m[1]); break;
    case preg_match('/^admin\/vendors\/(\d+)\/toggle$/', $route, $m): if (!isAdmin()) redirect('dashboard'); $v = new Vendor(); $v->toggleActive($m[1]); flash('success','Vendor updated'); redirect('admin/vendors'); break;
    case preg_match('/^admin\/vendors\/(\d+)\/upload$/', $route, $m) && $method === 'POST': if (!isAdmin()) redirect('dashboard'); (new VendorController())->upload($m[1]); break;
    case preg_match('/^vendor-attachments\/(\d+)\/delete$/', $route, $m): if (!isAdmin()) redirect('dashboard'); (new VendorController())->deleteAttachment($m[1]); break;
    case preg_match('/^vendor-attachments\/(\d+)\/download$/', $route, $m): if (!isAdmin()) redirect('dashboard'); (new VendorController())->downloadAttachment($m[1]); break;

    // Asana Sync (all users)
    case $route === 'asana': (new AsanaController())->index(); break;
    case $route === 'asana/workspaces' && $method === 'POST': (new AsanaController())->fetchWorkspaces(); break;
    case $route === 'asana/save' && $method === 'POST': (new AsanaController())->saveSettings(); break;
    case $route === 'asana/sync' && $method === 'POST': (new AsanaController())->executeImport(); break;
    case $route === 'asana/disconnect' && $method === 'POST': (new AsanaController())->disconnect(); break;
    case $route === 'asana/settings' && $method === 'POST': (new AsanaController())->updateTargetProject(); break;
    case $route === 'asana/migrate' && $method === 'POST': if (!isAdmin()) redirect('dashboard'); (new ProjectController())->migrateAsanaProjects(); break;
    case $route === 'admin/projects/assign-stores' && $method === 'POST': if (!isAdmin()) redirect('dashboard'); (new ProjectController())->bulkAssignStores(); break;

    // Admin - Data Hygiene
    case $route === 'admin/data-hygiene': if (!isAdmin()) redirect('dashboard'); (new StoreController())->dataHygiene(); break;
    case $route === 'admin/data-freshness': if (!isAdmin()) redirect('dashboard'); (new DataFreshnessController())->index(); break;
    case $route === 'admin/cleanup/overdue' && $method === 'POST': if (!isAdmin()) redirect('dashboard'); (new ProjectController())->cleanupOverdueTasks(); break;
    case $route === 'admin/bills/convert-projects' && $method === 'POST': if (!isAdmin()) redirect('dashboard'); (new BillController())->convertProjectsToBills(); break;
    case $route === 'admin/stores/merge' && $method === 'POST': if (!isAdmin()) redirect('dashboard'); (new StoreController())->mergeStores(); break;

    // ── Release Management Center (/admin/releases) ──────────────────────────
    case $route === 'admin/releases' && $method === 'GET': (new ReleaseController())->index(); break;
    case $route === 'admin/releases/create' && $method === 'GET': (new ReleaseController())->create(); break;
    case $route === 'admin/releases/create' && $method === 'POST': (new ReleaseController())->create(); break;
    case preg_match('/^admin\/releases\/(\d+)$/', $route, $m) && $method === 'GET': (new ReleaseController())->show((int)$m[1]); break;
    case preg_match('/^admin\/releases\/(\d+)\/update$/', $route, $m) && $method === 'POST': (new ReleaseController())->update((int)$m[1]); break;
    // Release API endpoints (AJAX)
    case preg_match('/^api\/admin\/releases\/(\d+)\/transition$/', $route, $m) && $method === 'POST': (new ReleaseController())->transition((int)$m[1]); break;
    case preg_match('/^api\/admin\/releases\/(\d+)\/schedule$/', $route, $m) && $method === 'POST': (new ReleaseController())->schedule((int)$m[1]); break;
    case preg_match('/^api\/admin\/releases\/(\d+)\/cancel-schedule$/', $route, $m) && $method === 'POST': (new ReleaseController())->cancelSchedule((int)$m[1]); break;
    case preg_match('/^api\/admin\/releases\/(\d+)\/review$/', $route, $m) && $method === 'POST': (new ReleaseController())->addReview((int)$m[1]); break;
    case preg_match('/^api\/admin\/releases\/(\d+)\/link$/', $route, $m) && $method === 'POST': (new ReleaseController())->createLink((int)$m[1]); break;
    case preg_match('/^api\/admin\/releases\/links\/(\d+)\/deactivate$/', $route, $m) && $method === 'POST': (new ReleaseController())->deactivateLink((int)$m[1]); break;
    case preg_match('/^api\/admin\/releases\/(\d+)\/walkthrough$/', $route, $m) && $method === 'POST': (new ReleaseController())->updateWalkthrough((int)$m[1]); break;
    case preg_match('/^api\/admin\/releases\/(\d+)\/scores$/', $route, $m) && $method === 'POST': (new ReleaseController())->updateScores((int)$m[1]); break;
    case $route === 'api/admin/releases/stats' && $method === 'GET': (new ReleaseController())->apiStats(); break;
    case $route === 'api/admin/releases/freeze' && $method === 'POST': (new ReleaseController())->createFreeze(); break;
    case preg_match('/^api\/admin\/releases\/freeze\/(\d+)\/end$/', $route, $m) && $method === 'POST': (new ReleaseController())->endFreeze((int)$m[1]); break;
    case $route === 'api/releases/process-scheduled' && $method === 'GET': (new ReleaseController())->processScheduled(); break;
    // Public review link (no auth required)
    case preg_match('/^release\/review\/([a-f0-9]{64})$/', $route, $m): (new ReleaseController())->publicReview($m[1]); break;

    // ── Incident Management (Phase 5) ─────────────────────────────────────
    case $route === 'admin/incidents':
        require_once __DIR__ . '/controllers/IncidentController.php';
        (new IncidentController())->index();
        break;

    // ── Payroll Management (Phase 5) ─────────────────────────────────────
    case $route === 'admin/payroll':
        require_once __DIR__ . '/controllers/PayrollController.php';
        (new PayrollController())->index();
        break;
    case $route === 'admin/payroll/create':
        require_once __DIR__ . '/controllers/PayrollController.php';
        (new PayrollController())->create();
        break;
    case $route === 'admin/payroll' && $method === 'POST':
        require_once __DIR__ . '/controllers/PayrollController.php';
        (new PayrollController())->store();
        break;
    case preg_match('/^admin\/payroll\/(\d+)$/', $route, $m) && $method === 'GET':
        require_once __DIR__ . '/controllers/PayrollController.php';
        (new PayrollController())->show((int)$m[1]);
        break;
    case preg_match('/^admin\/payroll\/(\d+)\/process$/', $route, $m):
        require_once __DIR__ . '/controllers/PayrollController.php';
        (new PayrollController())->process((int)$m[1]);
        break;
    case preg_match('/^admin\/payroll\/(\d+)\/complete$/', $route, $m):
        require_once __DIR__ . '/controllers/PayrollController.php';
        (new PayrollController())->complete((int)$m[1]);
        break;
    case preg_match('/^admin\/payroll\/(\d+)\/cancel$/', $route, $m):
        require_once __DIR__ . '/controllers/PayrollController.php';
        (new PayrollController())->cancel((int)$m[1]);
        break;
    case $route === 'admin/payroll/mark-paid' && $method === 'POST':
        require_once __DIR__ . '/controllers/PayrollController.php';
        (new PayrollController())->markPaid();
        break;
    case preg_match('/^admin\/payroll\/(\d+)\/adjustment$/', $route, $m) && $method === 'POST':
        require_once __DIR__ . '/controllers/PayrollController.php';
        (new PayrollController())->addAdjustment((int)$m[1]);
        break;
    case $route === 'api/payroll/stats':
        require_once __DIR__ . '/controllers/PayrollController.php';
        (new PayrollController())->apiStats();
        break;
    case $route === 'admin/incidents/create':
        require_once __DIR__ . '/controllers/IncidentController.php';
        (new IncidentController())->create();
        break;
    case $route === 'admin/incidents' && $method === 'POST':
        require_once __DIR__ . '/controllers/IncidentController.php';
        (new IncidentController())->store();
        break;
    case preg_match('/^admin\/incidents\/(\d+)$/', $route, $m) && $method === 'GET':
        require_once __DIR__ . '/controllers/IncidentController.php';
        (new IncidentController())->show((int)$m[1]);
        break;
    case preg_match('/^admin\/incidents\/(\d+)\/update$/', $route, $m) && $method === 'POST':
        require_once __DIR__ . '/controllers/IncidentController.php';
        (new IncidentController())->update((int)$m[1]);
        break;
    case preg_match('/^admin\/incidents\/(\d+)\/acknowledge$/', $route, $m):
        require_once __DIR__ . '/controllers/IncidentController.php';
        (new IncidentController())->acknowledge((int)$m[1]);
        break;
    case preg_match('/^admin\/incidents\/(\d+)\/investigate$/', $route, $m):
        require_once __DIR__ . '/controllers/IncidentController.php';
        (new IncidentController())->investigate((int)$m[1]);
        break;
    case preg_match('/^admin\/incidents\/(\d+)\/resolve$/', $route, $m) && $method === 'POST':
        require_once __DIR__ . '/controllers/IncidentController.php';
        (new IncidentController())->resolve((int)$m[1]);
        break;
    case preg_match('/^admin\/incidents\/(\d+)\/close$/', $route, $m):
        require_once __DIR__ . '/controllers/IncidentController.php';
        (new IncidentController())->close((int)$m[1]);
        break;
    case preg_match('/^admin\/incidents\/(\d+)\/cancel$/', $route, $m) && $method === 'POST':
        require_once __DIR__ . '/controllers/IncidentController.php';
        (new IncidentController())->cancel((int)$m[1]);
        break;
    case preg_match('/^admin\/incidents\/(\d+)\/escalate$/', $route, $m) && $method === 'POST':
        require_once __DIR__ . '/controllers/IncidentController.php';
        (new IncidentController())->escalate((int)$m[1]);
        break;
    case preg_match('/^admin\/incidents\/(\d+)\/assign$/', $route, $m) && $method === 'POST':
        require_once __DIR__ . '/controllers/IncidentController.php';
        (new IncidentController())->assign((int)$m[1]);
        break;
    case preg_match('/^admin\/incidents\/(\d+)\/comment$/', $route, $m) && $method === 'POST':
        require_once __DIR__ . '/controllers/IncidentController.php';
        (new IncidentController())->addComment((int)$m[1]);
        break;
    case preg_match('/^api\/incidents\/list$/', $route, $m):
        require_once __DIR__ . '/controllers/IncidentController.php';
        (new IncidentController())->apiList();
        break;
    case preg_match('/^api\/incidents\/stats$/', $route, $m):
        require_once __DIR__ . '/controllers/IncidentController.php';
        (new IncidentController())->apiStats();
        break;

    // ── Franchise Platform (Phase 7) ─────────────────────────────────────────
    case $route === 'admin/org-chart' && $method === 'GET': (new FranchiseController())->orgChart(); break;
    case $route === 'ceo/scorecard' && $method === 'GET': (new FranchiseController())->scorecard(); break;
    case $route === 'admin/benchmarks' && $method === 'GET': (new FranchiseController())->benchmarks(); break;
    case $route === 'admin/goals' && $method === 'GET': (new FranchiseController())->goals(); break;
    case $route === 'admin/goals/create' && $method === 'POST': (new FranchiseController())->createGoal(); break;
    case $route === 'admin/budget' && $method === 'GET': (new FranchiseController())->budget(); break;
    case $route === 'admin/budget/create' && $method === 'POST': (new FranchiseController())->createBudgetRequest(); break;
    case preg_match('/^api\/admin\/budget\/(\d+)\/action$/', $route, $m) && $method === 'POST': (new FranchiseController())->approveBudget((int)$m[1]); break;
    // Franchise API
    case $route === 'api/franchise/regions' && $method === 'GET': (new FranchiseController())->apiRegions(); break;
    case $route === 'api/franchise/regions' && $method === 'POST': (new FranchiseController())->apiCreateRegion(); break;
    case $route === 'api/franchise/districts' && $method === 'GET': (new FranchiseController())->apiDistricts(); break;
    case $route === 'api/franchise/districts' && $method === 'POST': (new FranchiseController())->apiCreateDistrict(); break;
    case $route === 'api/franchise/hierarchy' && $method === 'GET': (new FranchiseController())->apiHierarchy(); break;
    case $route === 'api/franchise/org-chart' && $method === 'GET': (new FranchiseController())->apiOrgChart(); break;
    case $route === 'api/franchise/scorecard' && $method === 'GET': (new FranchiseController())->apiScorecard(); break;
    case $route === 'api/franchise/benchmarks' && $method === 'GET': (new FranchiseController())->apiBenchmarks(); break;
    case preg_match('/^api\/franchise\/stores\/(\d+)\/kpi$/', $route, $m) && $method === 'GET': (new FranchiseController())->apiStoreKpi((int)$m[1]); break;
    case $route === 'api/franchise/kpi/snapshot' && $method === 'GET': (new FranchiseController())->cronKpiSnapshot(); break;

    // Bills: Admin seed
    case $route === 'bills/seed-raw-stockton' && $method === 'POST': if (!isAdmin()) redirect('dashboard'); (new BillController())->seedRawStocktonBills(); break;

    // JSON API
    case $route === 'api/tasks/reorder' && $method === 'POST': (new TaskController())->reorder(); break;
    case preg_match('/^api\/tasks\/(\d+)\/move$/', $route, $m) && $method === 'POST': (new TaskController())->move($m[1]); break;
    case preg_match('/^api\/tasks\/(\d+)$/', $route, $m): (new TaskController())->getJson($m[1]); break;

    // ── Task-Store relations ────────────────────────────────────────────────────────────────────

    // GET /api/tasks/{id}/stores — stores linked to a task
    case preg_match('/^api\/tasks\/(\d+)\/stores$/', $route, $m) && $method === 'GET':
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'], 401);
        if (!(new Task())->canView((int)$m[1], (int)$_SESSION['user_id'])) json_response(['error'=>'Forbidden'], 403);
        $svc = new TaskStoreService();
        json_response(['stores' => $svc->getForTask((int)$m[1])]);
        break;

    // POST /api/tasks/{id}/stores — sync store links  { store_ids: [1,2,3] }
    case preg_match('/^api\/tasks\/(\d+)\/stores$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'], 401);
        if (!verify_csrf($_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) json_response(['error'=>'Invalid CSRF'], 403);
        if (!(new Task())->canEdit((int)$m[1], (int)$_SESSION['user_id'])) json_response(['error'=>'Forbidden'], 403);
        try {
            $rawIds = isset($_POST['store_ids']) ? (array)$_POST['store_ids'] : [];
            (new TaskStoreService())->sync((int)$m[1], $rawIds, (int)$_SESSION['user_id']);
            $stores = (new TaskStoreService())->getForTask((int)$m[1]);
            json_response(['ok'=>true,'stores'=>$stores]);
        } catch (\RuntimeException $e) {
            json_response(['error'=>$e->getMessage()], 422);
        }
        break;

    // GET /api/stores/{id}/tasks — tasks linked to a store (filter support)
    case preg_match('/^api\/stores\/(\d+)\/tasks$/', $route, $m) && $method === 'GET':
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'], 401);
        $storeId  = (int)$m[1];
        $uid      = (int)$_SESSION['user_id'];
        $isPriv   = isAdmin() || isManager();
        $db       = Database::getInstance();
        $today    = function_exists('app_today') ? app_today() : date('Y-m-d');
        $statusFilter = $_GET['status'] ?? '';
        $extraWhere = $statusFilter ? " AND t.status = ?" : "";
        $params = [$storeId];
        if ($statusFilter) $params[] = $statusFilter;
        if (!$isPriv) {
            $extraWhere .= " AND " . (new Task())->scopeVisibleToUserSql('t', $uid, currentUser()['role'] ?? 'member');
        }
        $rows = $db->fetchAll(
            "SELECT t.id, t.title, t.status, t.priority, t.due_date, t.is_completed,
                    p.name as project_name, u.name as assignee_name
             FROM task_stores ts
             JOIN tasks t ON ts.task_id = t.id
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE ts.store_id = ? {$extraWhere}
             ORDER BY t.due_date ASC, t.created_at DESC
             LIMIT 200",
            $params
        );
        json_response(['store_id'=>$storeId,'count'=>count($rows),'tasks'=>$rows]);
        break;

    // ── Deadline Extension System ───────────────────────────────────────────────────────────────
    case $route === 'deadline-extensions/history':
        if (!isLoggedIn()) redirect('login');
        (new DeadlineExtensionController())->history();
        break;

    case $route === 'admin/deadline-extensions':
        if (!isLoggedIn()) redirect('login');
        if (!isAdmin() && !isManager()) redirect('dashboard');
        (new AdminDeadlineExtensionController())->index();
        break;

    case $route === 'api/deadline-extensions/request' && $method === 'POST':
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        (new DeadlineExtensionController())->apiRequest();
        break;

    case preg_match('/^api\/deadline-extensions\/task\/(\d+)$/', $route, $m) > 0:
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        (new DeadlineExtensionController())->apiGetForTask((int)$m[1]);
        break;

    case $route === 'api/deadline-extensions/quota' && $method === 'GET':
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        (new DeadlineExtensionController())->apiQuota();
        break;

    case preg_match('/^api\/admin\/deadline-extensions\/(\d+)\/(approve|reject)$/', $route, $m) > 0 && $method === 'POST':
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        if (!isAdmin() && !isManager()) json_response(['error' => 'Forbidden'], 403);
        $adminExtCtrl = new AdminDeadlineExtensionController();
        $m[2] === 'approve' ? $adminExtCtrl->apiApprove((int)$m[1]) : $adminExtCtrl->apiReject((int)$m[1]);
        break;

    case $route === 'api/admin/deadline-extensions/pending' && $method === 'GET':
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        if (!isAdmin() && !isManager()) json_response(['error' => 'Forbidden'], 403);
        (new AdminDeadlineExtensionController())->apiPending();
        break;

    // ── Task Audit / CEO All-Tasks ────────────────────────────────────────────
    case $route === 'admin/tasks' && $method === 'GET':
    case $route === 'admin/tasks/all' && $method === 'GET':
        if (!isAdmin()) redirect('dashboard');
        (new AdminTaskAuditController())->allTasks(); break;

    case $route === 'admin/tasks/by-store' && $method === 'GET':
        if (!isAdmin()) redirect('dashboard');
        (new AdminTaskAuditController())->byStore(); break;

    case $route === 'admin/tasks/duplicates' && $method === 'GET':
        if (!isAdmin()) redirect('dashboard');
        (new AdminTaskAuditController())->duplicates(); break;

    case $route === 'admin/tasks/duplicates/group' && $method === 'GET':
        if (!isAdmin()) redirect('dashboard');
        (new AdminTaskAuditController())->duplicateGroup(); break;

    case $route === 'admin/tasks/duplicates/archive' && $method === 'POST':
        if (!isAdmin()) redirect('dashboard');
        (new AdminTaskAuditController())->archiveDuplicate(); break;

    case $route === 'admin/tasks/duplicates/merge' && $method === 'POST':
        if (!isAdmin()) redirect('dashboard');
        (new AdminTaskAuditController())->mergeDuplicates(); break;

    case $route === 'admin/tasks/workflow' && $method === 'GET':
        if (!isAdmin() && !isManager()) redirect('dashboard');
        (new AdminTaskAuditController())->workflow(); break;

    case $route === 'admin/tasks/workflow/check' && $method === 'POST':
        if (!isAdmin() && !isManager()) redirect('dashboard');
        (new AdminTaskAuditController())->workflowCheck(); break;

    case $route === 'admin/tasks/workflow/accept' && $method === 'POST':
        if (!isAdmin() && !isManager()) redirect('dashboard');
        (new AdminTaskAuditController())->workflowAccept(); break;

    case $route === 'admin/tasks/workflow/reject' && $method === 'POST':
        if (!isAdmin() && !isManager()) redirect('dashboard');
        (new AdminTaskAuditController())->workflowReject(); break;

    case $route === 'admin/tasks/workflow/reopen' && $method === 'POST':
        if (!isAdmin() && !isManager()) redirect('dashboard');
        (new AdminTaskAuditController())->workflowReopen(); break;

    // ── Penalty Config API ───────────────────────────────────────────────────────────────────────

    case $route === 'api/admin/penalty-config' && $method === 'GET':
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        if (!isAdmin()) json_response(['error' => 'Forbidden'], 403);
        require_once __DIR__ . '/controllers/api/v1/PenaltyConfigApiController.php';
        (new PenaltyConfigApiController())->show();
        break;

    case $route === 'api/admin/penalty-config' && $method === 'POST':
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        if (!isAdmin()) json_response(['error' => 'Forbidden'], 403);
        require_once __DIR__ . '/controllers/api/v1/PenaltyConfigApiController.php';
        (new PenaltyConfigApiController())->update();
        break;

    case $route === 'migrate.php': include __DIR__ . '/migrate.php'; break;
    case $route === 'admin_complete_overdue.php': include __DIR__ . '/admin_complete_overdue.php'; break;

    // ── Telegram Integration ──────────────────────────────────────────────────────────────────

    // POST /webhooks/telegram — public webhook (no session auth)
    case $route === 'webhooks/telegram' && $method === 'POST':
        (new TelegramWebhookController())->handle();
        break;

    // GET /settings/telegram — user settings page
    case $route === 'settings/telegram':
        if (!isLoggedIn()) redirect('login');
        (new TelegramConnectController())->settingsPage();
        break;

    // POST /api/telegram/connect/init — generate connect code
    case $route === 'api/telegram/connect/init' && $method === 'POST':
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        (new TelegramConnectController())->initConnect();
        break;

    // POST /api/telegram/disconnect
    case $route === 'api/telegram/disconnect' && $method === 'POST':
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        (new TelegramConnectController())->disconnect();
        break;

    // GET /api/telegram/status
    case $route === 'api/telegram/status' && $method === 'GET':
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        (new TelegramConnectController())->status();
        break;

    // POST /api/telegram/test-send (admin)
    case $route === 'api/telegram/test-send' && $method === 'POST':
        if (!isAdmin()) json_response(['error' => 'Forbidden'], 403);
        (new TelegramConnectController())->testSend();
        break;

    // POST /api/telegram/set-webhook (admin)
    case $route === 'api/telegram/set-webhook' && $method === 'POST':
        if (!isAdmin()) json_response(['error' => 'Forbidden'], 403);
        (new TelegramConnectController())->setWebhook();
        break;

    // GET /api/telegram/webhook-info — admin debug: check webhook status from Telegram
    case $route === 'api/telegram/webhook-info' && $method === 'GET':
        if (!isAdmin()) json_response(['error' => 'Forbidden'], 403);
        try {
            $bot = new TelegramBotService();
            if (!$bot->isConfigured()) {
                json_response(['ok' => false, 'error' => 'Bot token not configured — create config/telegram.local.php on the server']);
            }
            json_response($bot->getWebhookInfo());
        } catch (\Throwable $e) {
            json_response(['ok' => false, 'error' => $e->getMessage()], 500);
        }
        break;

    // GET /api/telegram/jobs/due-today — cron endpoint (secret-protected)
    case $route === 'api/telegram/jobs/due-today' && $method === 'GET':
        $cronSecret = defined('CRON_SECRET') ? CRON_SECRET : (getenv('CRON_SECRET') ?: '');
        if ($cronSecret && ($_GET['secret'] ?? '') !== $cronSecret) {
            json_response(['error' => 'Forbidden'], 403);
        }
        require_once __DIR__ . '/jobs/SendDueTodayTelegramRemindersJob.php';
        $result = (new SendDueTodayTelegramRemindersJob())->run();
        json_response($result);
        break;

    // GET /api/telegram/jobs/overdue — cron endpoint (secret-protected)
    case $route === 'api/telegram/jobs/overdue' && $method === 'GET':
        $cronSecret = defined('CRON_SECRET') ? CRON_SECRET : (getenv('CRON_SECRET') ?: '');
        if ($cronSecret && ($_GET['secret'] ?? '') !== $cronSecret) {
            json_response(['error' => 'Forbidden'], 403);
        }
        require_once __DIR__ . '/jobs/SendOverdueTelegramRemindersJob.php';
        $result = (new SendOverdueTelegramRemindersJob())->run();
        json_response($result);
        break;

    // GET /api/email/jobs/due-today
    case $route === 'api/email/jobs/due-today' && $method === 'GET':
        $cronSecret = defined('CRON_SECRET') ? CRON_SECRET : (getenv('CRON_SECRET') ?: '');
        if ($cronSecret && ($_GET['secret'] ?? '') !== $cronSecret) json_response(['error' => 'Forbidden'], 403);
        require_once __DIR__ . '/jobs/SendDueTodaySummaryJob.php';
        json_response((new SendDueTodaySummaryEmailJob())->run());
        break;

    // GET /api/email/jobs/overdue
    case $route === 'api/email/jobs/overdue' && $method === 'GET':
        $cronSecret = defined('CRON_SECRET') ? CRON_SECRET : (getenv('CRON_SECRET') ?: '');
        if ($cronSecret && ($_GET['secret'] ?? '') !== $cronSecret) json_response(['error' => 'Forbidden'], 403);
        require_once __DIR__ . '/jobs/SendOverdueEscalationJob.php';
        json_response((new SendOverdueEscalationJob())->run());
        break;

    // GET /api/email/jobs/process-queue — flush the email_queue (send pending emails via SMTP)
    case $route === 'api/email/jobs/process-queue' && $method === 'GET':
        $cronSecret = defined('CRON_SECRET') ? CRON_SECRET : (getenv('CRON_SECRET') ?: '');
        if ($cronSecret && ($_GET['secret'] ?? '') !== $cronSecret) json_response(['error' => 'Forbidden'], 403);
        $batch = max(1, min(100, (int)($_GET['batch'] ?? 20)));
        require_once __DIR__ . '/jobs/ProcessEmailQueueJob.php';
        json_response((new ProcessEmailQueueJob($batch))->run());
        break;

    // ── Phase 8: Autonomous Operations & Enterprise Scaling ──────────────────────────────────────

    // GET /admin/command-center — Operational Command Center
    case $route === 'admin/command-center':
        require_once __DIR__ . '/controllers/CommandCenterController.php';
        (new CommandCenterController())->index();
        break;

    // GET /admin/command-center/predictions
    case $route === 'admin/command-center/predictions':
        require_once __DIR__ . '/controllers/CommandCenterController.php';
        (new CommandCenterController())->predictions();
        break;

    // POST /admin/command-center/predictions/run
    case $route === 'admin/command-center/predictions/run' && $method === 'POST':
        require_once __DIR__ . '/controllers/CommandCenterController.php';
        (new CommandCenterController())->runPredictions();
        break;

    // POST /admin/command-center/predictions/{id}/acknowledge
    case preg_match('/^admin\/command-center\/predictions\/(\d+)\/acknowledge$/', $route, $m) && $method === 'POST':
        require_once __DIR__ . '/controllers/CommandCenterController.php';
        (new CommandCenterController())->acknowledgePrediction((int)$m[1]);
        break;

    // POST /admin/command-center/predictions/{id}/prevent
    case preg_match('/^admin\/command-center\/predictions\/(\d+)\/prevent$/', $route, $m) && $method === 'POST':
        require_once __DIR__ . '/controllers/CommandCenterController.php';
        $engine = new PredictiveIncidentEngine();
        $engine->markPrevented((int)$m[1]);
        json_response(['success' => true]);
        break;

    // GET /admin/command-center/recommendations
    case $route === 'admin/command-center/recommendations':
        require_once __DIR__ . '/controllers/CommandCenterController.php';
        (new CommandCenterController())->recommendations();
        break;

    // POST /admin/command-center/recommendations/{id}/accept
    case preg_match('/^admin\/command-center\/recommendations\/(\d+)\/accept$/', $route, $m) && $method === 'POST':
        require_once __DIR__ . '/controllers/CommandCenterController.php';
        (new CommandCenterController())->acceptRecommendation((int)$m[1]);
        break;

    // POST /admin/command-center/recommendations/{id}/reject
    case preg_match('/^admin\/command-center\/recommendations\/(\d+)\/reject$/', $route, $m) && $method === 'POST':
        require_once __DIR__ . '/controllers/CommandCenterController.php';
        $engine = new RecommendationEngine();
        $engine->reject((int)$m[1]);
        json_response(['success' => true]);
        break;

    // GET /admin/command-center/scores
    case $route === 'admin/command-center/scores':
        require_once __DIR__ . '/controllers/CommandCenterController.php';
        (new CommandCenterController())->scores();
        break;

    // GET /admin/command-center/workflows
    case $route === 'admin/command-center/workflows':
        require_once __DIR__ . '/controllers/CommandCenterController.php';
        (new CommandCenterController())->workflows();
        break;

    // POST /admin/command-center/workflows
    case $route === 'admin/command-center/workflows' && $method === 'POST':
        require_once __DIR__ . '/controllers/CommandCenterController.php';
        (new CommandCenterController())->createWorkflow();
        break;

    // GET /admin/command-center/notifications
    case $route === 'admin/command-center/notifications':
        require_once __DIR__ . '/controllers/CommandCenterController.php';
        (new CommandCenterController())->notifications();
        break;

    // GET /admin/command-center/simulations
    case $route === 'admin/command-center/simulations':
        require_once __DIR__ . '/controllers/CommandCenterController.php';
        (new CommandCenterController())->simulations();
        break;

    // POST /admin/command-center/simulate
    case $route === 'admin/command-center/simulate' && $method === 'POST':
        require_once __DIR__ . '/controllers/CommandCenterController.php';
        (new CommandCenterController())->runSimulation();
        break;

    // GET /admin/command-center/memory
    case $route === 'admin/command-center/memory':
        require_once __DIR__ . '/controllers/CommandCenterController.php';
        (new CommandCenterController())->memory();
        break;

    // GET /admin/command-center/ai-decisions
    case $route === 'admin/command-center/ai-decisions':
        require_once __DIR__ . '/controllers/CommandCenterController.php';
        (new CommandCenterController())->aiDecisions();
        break;

    // GET /admin/command-center/api/summary
    case $route === 'admin/command-center/api/summary' && $method === 'GET':
        require_once __DIR__ . '/controllers/CommandCenterController.php';
        (new CommandCenterController())->apiSummary();
        break;

    // GET /ceo/war-room — Executive War Room
    case $route === 'ceo/war-room' && $method === 'GET':
        require_once __DIR__ . '/controllers/WarRoomController.php';
        (new WarRoomController())->index();
        break;

    // POST /ceo/war-room
    case $route === 'ceo/war-room' && $method === 'POST':
        require_once __DIR__ . '/controllers/WarRoomController.php';
        (new WarRoomController())->create();
        break;

    // GET /ceo/war-room/{id}
    case preg_match('/^ceo\/war-room\/(\d+)$/', $route, $m) && $method === 'GET':
        require_once __DIR__ . '/controllers/WarRoomController.php';
        (new WarRoomController())->view((int)$m[1]);
        break;

    // POST /ceo/war-room/{id}/timeline
    case preg_match('/^ceo\/war-room\/(\d+)\/timeline$/', $route, $m) && $method === 'POST':
        require_once __DIR__ . '/controllers/WarRoomController.php';
        (new WarRoomController())->addTimeline((int)$m[1]);
        break;

    // POST /ceo/war-room/{id}/action
    case preg_match('/^ceo\/war-room\/(\d+)\/action$/', $route, $m) && $method === 'POST':
        require_once __DIR__ . '/controllers/WarRoomController.php';
        (new WarRoomController())->addAction((int)$m[1]);
        break;

    // POST /ceo/war-room/{id}/resolve
    case preg_match('/^ceo\/war-room\/(\d+)\/resolve$/', $route, $m) && $method === 'POST':
        require_once __DIR__ . '/controllers/WarRoomController.php';
        (new WarRoomController())->resolve((int)$m[1]);
        break;

    // POST /ceo/war-room/{id}/status
    case preg_match('/^ceo\/war-room\/(\d+)\/status$/', $route, $m) && $method === 'POST':
        require_once __DIR__ . '/controllers/WarRoomController.php';
        (new WarRoomController())->updateStatus((int)$m[1]);
        break;

    // ── Phase 11: Bakudan Business Execution Platform ─────────────────────────────────────

    // MODULE 1: Daily Operations Center
    case $route === 'operations/today':
        (new OperationsController())->today();
        break;

    // MODULE 3: Manager Command Center
    case $route === 'manager/command':
        (new ManagerCommandController())->command();
        break;

    // MODULE 8: Action Center
    case $route === 'action-center':
        (new ActionCenterController())->index();
        break;

    // MODULE 5 & 6: Store Opening/Closing
    case $route === 'store/checklist/open':
        (new StoreChecklistController())->open();
        break;
    case $route === 'store/checklist/open/submit' && $method === 'POST':
        (new StoreChecklistController())->submitOpen();
        break;
    case $route === 'store/checklist/close':
        (new StoreChecklistController())->close();
        break;
    case $route === 'store/checklist/close/submit' && $method === 'POST':
        (new StoreChecklistController())->submitClose();
        break;
    case $route === 'store/checklist/history':
        (new StoreChecklistController())->history();
        break;

    // MODULE 10: Company Operating Calendar
    case $route === 'company/calendar':
        (new CompanyCalendarController())->index();
        break;

    // MODULE 4: Employee App Mode — My Day
    case $route === 'my-day':
        (new MyDayController())->index();
        break;

    // MODULE 12: Control Tower
    case $route === 'control-tower':
        (new ControlTowerController())->index();
        break;

    // MODULE 9: Franchise Playbooks
    case $route === 'playbooks':
        (new FranchisePlaybooksController())->index();
        break;
    case preg_match('/^playbooks\/([a-z\-]+)$/', $route, $m) && !str_contains($route, '/run') && !str_contains($route, '/submit'):
        (new FranchisePlaybooksController())->show($m[1]);
        break;
    case preg_match('/^playbooks\/([a-z\-]+)\/run$/', $route, $m) && $method === 'POST':
        (new FranchisePlaybooksController())->run($m[1]);
        break;

    // ── New Modules (Build Session 2026-05-29) ────────────────────────────────────────

    // Release Dashboard
    case $route === 'admin/release-dashboard':
        if (!canAdmin()) redirect('dashboard');
        include __DIR__ . '/views/admin/release_dashboard.php';
        break;

    // Shift Management
    case $route === 'admin/shifts' && $method === 'GET':
        require_once __DIR__ . '/controllers/ShiftController.php';
        (new ShiftController())->index();
        break;
    case $route === 'admin/shifts' && $method === 'POST':
        require_once __DIR__ . '/controllers/ShiftController.php';
        (new ShiftController())->store();
        break;
    case preg_match('/^admin\/shifts\/(\d+)\/update$/', $route, $m) && $method === 'POST':
        require_once __DIR__ . '/controllers/ShiftController.php';
        (new ShiftController())->update((int)$m[1]);
        break;
    case preg_match('/^admin\/shifts\/(\d+)\/delete$/', $route, $m):
        require_once __DIR__ . '/controllers/ShiftController.php';
        (new ShiftController())->delete((int)$m[1]);
        break;

    // Employee Center
    case $route === 'admin/employees' && $method === 'GET':
        if (!canAdmin()) redirect('dashboard');
        require_once __DIR__ . '/models/Employee.php';
        $empModel = new Employee();
        $employees = $empModel->all($_GET, 50, 0);
        $empStats = $empModel->getStats();
        $stores = Database::getInstance()->fetchAll("SELECT id, name FROM stores ORDER BY name");
        $users = Database::getInstance()->fetchAll("SELECT id, name FROM users WHERE is_active = 1 ORDER BY name");
        $currentPage = 'admin-employees';
        ob_start();
        include __DIR__ . '/views/admin/employees/index.php';
        break;

    // Training Center
    case $route === 'admin/training' && $method === 'GET':
        if (!canAdmin()) redirect('dashboard');
        require_once __DIR__ . '/models/TrainingModule.php';
        $trainingModel = new TrainingModule();
        $modules = $trainingModel->all($_GET, 50);
        $trainingStats = $trainingModel->getStats();
        $currentPage = 'admin-training';
        ob_start();
        include __DIR__ . '/views/admin/training/index.php';
        break;

    // Procurement
    case $route === 'admin/procurement' && $method === 'GET':
        if (!canAdmin()) redirect('dashboard');
        require_once __DIR__ . '/models/Procurement.php';
        $procModel = new Procurement();
        $procurements = $procModel->all($_GET, 50);
        $procStats = $procModel->getStats();
        $currentPage = 'admin-procurement';
        ob_start();
        include __DIR__ . '/views/admin/procurement/index.php';
        break;

    // Documents
    case $route === 'admin/documents' && $method === 'GET':
        if (!canAdmin()) redirect('dashboard');
        require_once __DIR__ . '/models/Document.php';
        $docModel = new Document();
        $documents = $docModel->all($_GET, 50);
        $docStats = $docModel->getStats();
        $currentPage = 'admin-documents';
        ob_start();
        include __DIR__ . '/views/admin/documents/index.php';
        break;

    // Compliance
    case $route === 'admin/compliance' && $method === 'GET':
        if (!canAdmin()) redirect('dashboard');
        include __DIR__ . '/views/admin/compliance/index.php';
        break;

    // CEO Boardroom
    case $route === 'ceo/boardroom' && $method === 'GET':
        if (!canAdmin()) redirect('dashboard');
        include __DIR__ . '/views/ceo/boardroom.php';
        break;

    // Digital Twin
    case $route === 'admin/digital-twin' && $method === 'GET':
        if (!canAdmin()) redirect('dashboard');
        include __DIR__ . '/views/admin/digital_twin/index.php';
        break;

    // ── Phase 11.5: Operational Adoption Layer ────────────────────────────────────────

    // MODULE 1: Global Search
    case $route === 'search': (new SearchController())->index(); break;
    case $route === 'api/search/full' && $method === 'GET': (new SearchController())->apiSearch(); break;

    // MODULE 2: Universal Activity Feed
    case $route === 'activity': (new ActivityFeedController())->index(); break;
    case $route === 'api/activity' && $method === 'GET': (new ActivityFeedController())->apiActivity(); break;

    // MODULE 3: Notification Center
    case $route === 'notifications': (new NotificationCenterController())->index(); break;
    case $route === 'notifications/mark-read' && $method === 'POST': (new NotificationCenterController())->markRead(); break;
    case $route === 'notifications/snooze' && $method === 'POST': (new NotificationCenterController())->snooze(); break;

    // MODULE 4: Favorites / Pinned Items
    case $route === 'api/favorites' && $method === 'GET': (new FavoritesController())->index(); break;
    case $route === 'api/favorites' && $method === 'POST': (new FavoritesController())->store(); break;
    case $route === 'api/favorites/reorder' && $method === 'POST': (new FavoritesController())->reorder(); break;
    case preg_match('/^api\/favorites\/(\d+)\/delete$/', $route, $m) && $method === 'POST': (new FavoritesController())->destroy((int)$m[1]); break;

    // MODULE 5: My Workspace
    case $route === 'my-workspace': (new MyWorkspaceController())->index(); break;

    // ── Phase 1 — Workflow Execution API (session-auth, before the v1 token API) ─────
    case $route === 'api/workflow/my-work' && $method === 'GET':
        (new WorkflowExecutionApiController())->myWork();
        break;
    case $route === 'api/workflow/reviewer-queue' && $method === 'GET':
        (new WorkflowExecutionApiController())->reviewerQueue();
        break;
    case $route === 'api/workflow/approver-queue' && $method === 'GET':
        (new WorkflowExecutionApiController())->approverQueue();
        break;
    case $route === 'api/workflow/command-center' && $method === 'GET':
        (new WorkflowExecutionApiController())->commandCenter();
        break;
    case $route === 'api/workflow/my-work/list' && $method === 'GET':
        (new WorkflowExecutionApiController())->myWorkList();
        break;
    case $route === 'api/workflow/reviewer-queue/list' && $method === 'GET':
        (new WorkflowExecutionApiController())->reviewerQueueList();
        break;
    case $route === 'api/workflow/approver-queue/list' && $method === 'GET':
        (new WorkflowExecutionApiController())->approverQueueList();
        break;
    case $route === 'command-center' && $method === 'GET':
        (new DashboardController())->commandCenterPage();
        break;

    // MODULE 8: Dashboard Customization
    case $route === 'api/dashboard/layout' && $method === 'GET': (new DashboardCustomizationController())->getLayout(); break;
    case $route === 'api/dashboard/layout' && $method === 'POST': (new DashboardCustomizationController())->saveLayout(); break;
    case $route === 'api/dashboard/layout/reset' && $method === 'POST': (new DashboardCustomizationController())->resetLayout(); break;

    // MODULE 9: Release Artifacts
    case preg_match('/^admin\/releases\/(\d+)\/artifacts$/', $route, $m) && $method === 'GET': (new ReleaseArtifactsController())->index((int)$m[1]); break;
    case preg_match('/^admin\/releases\/(\d+)\/artifacts$/', $route, $m) && $method === 'POST': (new ReleaseArtifactsController())->store((int)$m[1]); break;
    case preg_match('/^admin\/releases\/artifacts\/(\d+)\/delete$/', $route, $m) && $method === 'POST': (new ReleaseArtifactsController())->destroy((int)$m[1]); break;

    // MODULE 10: Health Monitor
    case $route === 'health': (new HealthMonitorController())->index(); break;
    case $route === 'api/health/status' && $method === 'GET': (new HealthMonitorController())->apiStatus(); break;

    // Phase 11.6: Adoption Metrics
    case $route === 'admin/adoption-metrics' && $method === 'GET': (new AdoptionMetricsController())->index(); break;
    case $route === 'api/admin/adoption-metrics' && $method === 'GET': (new AdoptionMetricsController())->apiMetrics(); break;

    // Phase 11.7: Walkthrough Library
    case $route === 'admin/walkthrough-library' && $method === 'GET':
        require_once __DIR__ . '/controllers/WalkthroughLibraryController.php';
        (new WalkthroughLibraryController())->index();
        break;
    case $route === 'api/admin/walkthrough-library/summary' && $method === 'GET':
        require_once __DIR__ . '/controllers/WalkthroughLibraryController.php';
        (new WalkthroughLibraryController())->apiSummary();
        break;

    // Phase 11.7: CEO Review Mode
    case preg_match('/^admin\/releases\/(\d+)\/review$/', $route, $m) && $method === 'GET':
        require_once __DIR__ . '/controllers/ReleaseController.php';
        (new ReleaseController())->ceoReview((int)$m[1]);
        break;

    // ── Task Approval Workflow ────────────────────────────────────────────────────────────────────
    case preg_match('/^tasks\/(\d+)\/submit$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) redirect('login');
        (new TaskApprovalController())->submit((int)$m[1]);
        break;

    case preg_match('/^tasks\/(\d+)\/review-approve$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) redirect('login');
        (new TaskApprovalController())->reviewApprove((int)$m[1]);
        break;

    case preg_match('/^tasks\/(\d+)\/review-reject$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) redirect('login');
        (new TaskApprovalController())->reviewReject((int)$m[1]);
        break;

    case preg_match('/^tasks\/(\d+)\/accept$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) redirect('login');
        (new TaskApprovalController())->accept((int)$m[1]);
        break;

    case preg_match('/^tasks\/(\d+)\/accept-reject$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) redirect('login');
        (new TaskApprovalController())->acceptReject((int)$m[1]);
        break;

    case preg_match('/^tasks\/(\d+)\/reopen-approval$/', $route, $m) && $method === 'POST':
        if (!canAdmin()) json_response(['error' => 'Forbidden'], 403);
        (new TaskApprovalController())->reopenApproval((int)$m[1]);
        break;

    // ── CEO Update: Reviewer Workspace Routes ─────────────────────────────────────────

    // Inbox (route at line ~510 handles GET; only the sub-routes below are new)
    case $route === 'inbox/mark-read' && $method === 'POST': (new InboxController())->markRead(); break;
    case $route === 'inbox/mark-all-read' && $method === 'POST': (new InboxController())->markAllRead(); break;
    case $route === 'api/inbox' && $method === 'GET': (new InboxController())->apiList(); break;
    case preg_match('/^api\/inbox\/(n|t)?(\d+)\/read$/', $route, $m) && $method === 'POST':
        if (isLoggedIn()) {
            $uid = (int)$_SESSION['user_id'];
            if (($m[1] ?? '') === 'n') {
                (new Notification())->markRead((int)$m[2], $uid);
            } else {
                (new TaskNotification())->markRead((int)$m[2], $uid);
            }
        }
        json_response(['success' => true]); break;

    // Task Comments (rich)
    case preg_match('/^tasks\/(\d+)\/task-comments$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) redirect('login');
        (new TaskCommentController())->store((int)$m[1]); break;
    case preg_match('/^api\/tasks\/(\d+)\/task-comments$/', $route, $m) && $method === 'GET':
        (new TaskCommentController())->getJson((int)$m[1]); break;
    case preg_match('/^task-comments\/(\d+)$/', $route, $m) && $method === 'DELETE':
        (new TaskCommentController())->delete((int)$m[1]); break;
    case $route === 'api/users/mention-search' && $method === 'GET':
        (new TaskCommentController())->mentionSearch(); break;

    // Reviewer Notes
    case preg_match('/^tasks\/(\d+)\/reviewer-notes$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) redirect('login');
        (new ReviewerNotesController())->store((int)$m[1]); break;
    case preg_match('/^tasks\/(\d+)\/reviewer-notes\/(\d+)\/acknowledge$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        (new ReviewerNotesController())->acknowledge((int)$m[1], (int)$m[2]); break;
    case preg_match('/^tasks\/(\d+)\/reviewer-notes\/(\d+)\/checklist-item$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        (new ReviewerNotesController())->toggleChecklistItem((int)$m[1], (int)$m[2]); break;
    case preg_match('/^reviewer-notes\/(\d+)$/', $route, $m) && $method === 'DELETE':
        (new ReviewerNotesController())->delete((int)$m[1]); break;

    // Request Changes / Info
    case preg_match('/^tasks\/(\d+)\/request-changes$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) redirect('login');
        (new ReviewerNotesController())->requestChanges((int)$m[1]); break;
    case preg_match('/^tasks\/(\d+)\/request-info$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) redirect('login');
        (new ReviewerNotesController())->requestInfo((int)$m[1]); break;

    // Approval Notes
    case preg_match('/^tasks\/(\d+)\/approval-notes$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) redirect('login');
        $ctrl = new ReviewerNotesController(); // Reuse flow — store as approval note
        (new ApprovalNoteController())->store((int)$m[1]); break;
    case preg_match('/^approval-notes\/(\d+)$/', $route, $m) && $method === 'DELETE':
        if (!isLoggedIn()) json_response(['error' => 'Unauthorized'], 401);
        (new ApprovalNoteController())->delete((int)$m[1]); break;

    // ── Phase 14: Security — Credential Vault ────────────────────────────────────────────────────
    case $route === 'security/credentials' && $method === 'GET':
        if (!isLoggedIn()) redirect('login');
        (new CredentialController())->index();
        break;

    case $route === 'security/credentials/create' && $method === 'GET':
        if (!canAdmin()) { flash('error','Access denied.'); redirect('security/credentials'); }
        (new CredentialController())->create();
        break;

    case $route === 'security/credentials' && $method === 'POST':
        if (!canAdmin()) json_response(['error'=>'Forbidden'],403);
        (new CredentialController())->store();
        break;

    case preg_match('/^security\/credentials\/(\d+)$/', $route, $m) && $method === 'GET':
        if (!isLoggedIn()) redirect('login');
        (new CredentialController())->show((int)$m[1]);
        break;

    case preg_match('/^security\/credentials\/(\d+)\/edit$/', $route, $m) && $method === 'GET':
        if (!isLoggedIn()) redirect('login');
        (new CredentialController())->edit((int)$m[1]);
        break;

    case preg_match('/^security\/credentials\/(\d+)$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) redirect('login');
        (new CredentialController())->update((int)$m[1]);
        break;

    case preg_match('/^security\/credentials\/(\d+)\/delete$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) redirect('login');
        (new CredentialController())->delete((int)$m[1]);
        break;

    case preg_match('/^security\/credentials\/(\d+)\/view-password$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'],401);
        (new CredentialController())->viewPassword((int)$m[1]);
        break;

    case preg_match('/^security\/credentials\/(\d+)\/copy-password$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) json_response(['error'=>'Unauthorized'],401);
        (new CredentialController())->copyPassword((int)$m[1]);
        break;

    case preg_match('/^security\/credentials\/(\d+)\/grant-access$/', $route, $m) && $method === 'POST':
        if (!canAdmin()) json_response(['error'=>'Forbidden'],403);
        (new CredentialController())->grantAccess((int)$m[1]);
        break;

    case preg_match('/^security\/credentials\/(\d+)\/revoke-access$/', $route, $m) && $method === 'POST':
        if (!canAdmin()) json_response(['error'=>'Forbidden'],403);
        (new CredentialController())->revokeAccess((int)$m[1]);
        break;

    case preg_match('/^security\/credentials\/(\d+)\/create-rotation-task$/', $route, $m) && $method === 'POST':
        if (!isLoggedIn()) redirect('login');
        (new CredentialController())->createRotationTask((int)$m[1]);
        break;

    case $route === 'security/rotation' && $method === 'GET':
        if (!canAdmin()) { flash('error','Access denied.'); redirect('security/credentials'); }
        (new CredentialController())->rotation();
        break;

    case $route === 'security/audit-logs' && $method === 'GET':
        if (!canAdmin()) { flash('error','Access denied.'); redirect('security/credentials'); }
        (new CredentialController())->auditLogs();
        break;

    default: http_response_code(404); echo '<h1>404</h1>'; break;
} } catch (Throwable $e) { // Rethrow to global handler
    throw $e;
}
