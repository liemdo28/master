<?php
/**
 * TaskFlow API v1 - Base Controller
 * Tất cả API controllers kế thừa class này
 */
require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../config/time.php';
require_once __DIR__ . '/../helpers/api_response.php';
require_once __DIR__ . '/../helpers/api_token.php';

class ApiController {
    protected $db;
    protected $user = null;
    protected $userId = null;
    protected $platform = 'unknown';
    protected $deviceId = null;

    public function __construct() {
        $this->db = Database::getInstance();
        app_set_timezone();
        $this->parseRequestHeaders();
    }

    // ── Request parsing ──────────────────────────────────────────

    protected function parseRequestHeaders() {
        // Lấy platform header
        $this->platform = $_SERVER['HTTP_X_PLATFORM'] ?? 'web';
        $this->deviceId = $_SERVER['HTTP_X_DEVICE_ID'] ?? null;
    }

    protected function getJsonInput() {
        $raw = file_get_contents('php://input');
        if (empty($raw)) return [];
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    protected function getBearerToken() {
        // getallheaders() returns the original HTTP request headers — works
        // correctly even after mod_rewrite internal redirects.
        if (function_exists('getallheaders')) {
            $hdrs = getallheaders();
            $header = $hdrs['Authorization'] ?? $hdrs['authorization'] ?? '';
            if ($header && preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
                return trim($m[1]);
            }
        }

        // Fallback: $_SERVER variants (HTTP_AUTHORIZATION or REDIRECT_ prefix)
        foreach (['HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION'] as $key) {
            $header = $_SERVER[$key] ?? '';
            if ($header && preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
                return trim($m[1]);
            }
        }

        // Last resort: token via query string (dev/debug only)
        if (!empty($_GET['_tok'])) {
            return trim($_GET['_tok']);
        }

        return null;
    }

    // ── Auth guard ──────────────────────────────────────────────

    /**
     * Yêu cầu token hợp lệ. Trả về user info hoặc throw 401.
     * @param bool $required — false: cho phép anonymous (chỉ đọc public data)
     */
    protected function requireAuth($required = true) {
        $token = $this->getBearerToken();

        if (!$token) {
            if ($required) {
                api_error('Token is required', 401);
            }
            return false;
        }

        $tokenData = ApiToken::validate($token);

        if (!$tokenData) {
            api_error('Invalid or expired token', 401);
        }

        $this->userId = (int)$tokenData['user_id'];
        $this->user = (new User())->findById($this->userId);

        if (!$this->user) {
            api_error('User not found', 401);
        }

        app_set_timezone($this->user['timezone'] ?? null);

        if (!isset($this->user['is_active']) || (int)$this->user['is_active'] !== 1) {
            api_error('Account is disabled', 403);
        }

        // Update last_used
        ApiToken::touch($token);

        return true;
    }

    protected function requireAdmin() {
        $this->requireAuth();
        if (($this->user['role'] ?? '') !== 'admin') {
            api_error('Admin access required', 403);
        }
    }

    // ── Input validation helpers ─────────────────────────────────

    protected function validateRequired($data, $fields) {
        $errors = [];
        foreach ($fields as $field) {
            if (!isset($data[$field]) || $data[$field] === '' || $data[$field] === null) {
                $errors[$field] = ["{$field} is required"];
            }
        }
        if (!empty($errors)) {
            api_error('Validation failed', 422, $errors);
        }
    }

    protected function validateEmail($email) {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            api_error('Invalid email format', 422, ['email' => ['Invalid email format']]);
        }
    }

    protected function safeInt($val, $default = 0) {
        return filter_var($val, FILTER_VALIDATE_INT) !== false ? (int)$val : $default;
    }

    protected function safeString($val, $maxLen = 1000) {
        $val = trim($val ?? '');
        return mb_substr($val, 0, $maxLen);
    }

    protected function paginationParams($defaultPerPage = 20, $maxPerPage = 100) {
        $page   = max(1, $this->safeInt($_GET['page'] ?? 1, 1));
        $perPage = min($maxPerPage, max(1, $this->safeInt($_GET['per_page'] ?? $defaultPerPage, $defaultPerPage)));
        $sortBy  = $_GET['sort_by'] ?? 'created_at';
        $sortDir = strtoupper($_GET['sort_dir'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';
        return compact('page', 'perPage', 'sortBy', 'sortDir');
    }

    // ── Sync helpers ─────────────────────────────────────────────

    /**
     * Ghi audit log khi có action trên entity
     */
    protected function auditLog($action, $entityType = null, $entityId = null, $metadata = []) {
        try {
            $this->db->insert(
                "INSERT INTO audit_log (user_id, action, entity_type, entity_id, device_id, ip_address, user_agent, metadata)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    $this->userId,
                    $action,
                    $entityType,
                    $entityId,
                    $this->deviceId,
                    $_SERVER['REMOTE_ADDR'] ?? null,
                    $_SERVER['HTTP_USER_AGENT'] ?? null,
                    !empty($metadata) ? json_encode($metadata) : null,
                ]
            );
        } catch (Exception $e) {
            // Non-critical — không fail request vì audit log fail
        }
    }

    /**
     * Broadcast event qua SSE channel
     * @param string $event event type (task_created, task_updated, etc.)
     * @param array $data payload
     */
    protected function broadcast($event, $data) {
        try {
            if (str_starts_with((string)$event, 'task_') && !empty($data['id'])) {
                $this->broadcastTaskEvent($event, $data);
                return;
            }

            // Ghi vào bảng sync_events để SSE poller đọc
            $this->db->insert(
                "INSERT INTO sync_events (event, payload, created_at) VALUES (?, ?, NOW())",
                [$event, json_encode($data, JSON_UNESCAPED_UNICODE)]
            );
        } catch (Exception $e) {
            // Non-critical
        }
    }

    private function broadcastTaskEvent($event, array $data) {
        if (!$this->db->tableExists('sync_events') ||
            !$this->db->columnExists('sync_events', 'channel') ||
            !$this->db->columnExists('sync_events', 'user_id')) {
            return;
        }

        $task = $this->db->fetch("SELECT * FROM tasks WHERE id = ?", [(int)$data['id']]) ?: $data;
        $userIds = [];

        $privileged = $this->db->fetchAll(
            "SELECT id FROM users WHERE is_active = 1 AND role IN ('admin', 'manager')"
        );
        foreach ($privileged as $u) {
            $userIds[] = (int)$u['id'];
        }

        foreach (['assignee_id', 'created_by'] as $field) {
            if (!empty($task[$field])) {
                $userIds[] = (int)$task[$field];
            }
        }

        if (($task['visibility'] ?? 'private') === 'public' && !empty($task['project_id'])) {
            $projectUsers = $this->db->fetchAll(
                "SELECT owner_id AS user_id FROM projects WHERE id = ?
                 UNION
                 SELECT user_id FROM project_members WHERE project_id = ?",
                [(int)$task['project_id'], (int)$task['project_id']]
            );
            foreach ($projectUsers as $u) {
                if (!empty($u['user_id'])) {
                    $userIds[] = (int)$u['user_id'];
                }
            }
        }

        $payload = json_encode($data, JSON_UNESCAPED_UNICODE);
        foreach (array_values(array_unique(array_filter($userIds))) as $uid) {
            $this->db->insert(
                "INSERT INTO sync_events (event, payload, user_id, channel, created_at)
                 VALUES (?, ?, ?, ?, NOW())",
                [$event, $payload, $uid, (string)$uid]
            );
        }
    }

    /**
     * Lấy user info clean (không trả password)
     */
    protected function userProfile($user) {
        if (!$user) return null;
        unset($user['password']);
        return $user;
    }
}
