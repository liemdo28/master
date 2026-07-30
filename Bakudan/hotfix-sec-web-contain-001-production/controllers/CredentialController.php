<?php
/**
 * CredentialController — Web/page controller for Credential Vault
 * Phase 14: Secure Credentials & Password Governance
 */
class CredentialController {
    private Credential $model;
    private CredentialAuditService $audit;
    private CredentialPermissionService $permission;
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
        try { $this->model = new Credential(); } catch (\Throwable $e) { error_log('[Credential] model init: ' . $e->getMessage()); $this->model = null; }
        try { $this->audit = new CredentialAuditService(); } catch (\Throwable $e) { error_log('[Credential] audit init: ' . $e->getMessage()); $this->audit = null; }
        try { $this->permission = new CredentialPermissionService(); } catch (\Throwable $e) { error_log('[Credential] perm init: ' . $e->getMessage()); $this->permission = null; }
    }

    // ── Access helpers ──────────────────────────────────────────────────────
    private function requireAdmin(): void {
        if (!canAdmin()) {
            flash('error', 'Access denied. CEO/Admin only.');
            redirect('security/credentials');
        }
    }

    private function requireCanViewCredential(int $id): array {
        $user = currentUser();
        $cred = $this->model->findById($id, $user['id'], $user['role']);
        if (!$cred) {
            flash('error', 'Credential not found or access denied.');
            redirect('security/credentials');
            exit;
        }
        return $cred;
    }

    private function ip(): string {
        return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }

    private function ua(): string {
        return $_SERVER['HTTP_USER_AGENT'] ?? '';
    }

    // ── Pages ──────────────────────────────────────────────────────────────

    /**
     * GET /security/credentials
     */
    public function index(): void {
        if (!isLoggedIn()) redirect('login');
        $user        = currentUser();
        $credentials = [];
        $stats       = [];
        if ($this->model) {
            try { $credentials = $this->model->getAccessibleCredentials($user['id'], $user['role']); } catch (\Throwable $e) { error_log('[Credential] index: ' . $e->getMessage()); }
            try { $stats = $this->model->getRotationStats(); } catch (\Throwable $e) {}
        }
        $stores      = $this->db->fetchAll("SELECT id, name FROM stores ORDER BY name");
        $currentPage = 'credentials';
        $pageTitle   = 'Credential Vault';
        require __DIR__ . '/../views/credentials/index.php';
    }

    /**
     * GET /security/credentials/create
     */
    public function create(): void {
        if (!isLoggedIn()) redirect('login');
        $this->requireAdmin();
        $stores      = $this->db->fetchAll("SELECT id, name FROM stores ORDER BY name");
        $users       = $this->db->fetchAll("SELECT id, name, role FROM users WHERE is_active=1 ORDER BY name");
        $currentPage = 'credentials';
        $pageTitle   = 'New Credential';
        require __DIR__ . '/../views/credentials/create.php';
    }

    /**
     * POST /security/credentials
     */
    public function store(): void {
        if (!isLoggedIn()) redirect('login');
        $this->requireAdmin();
        if (!verify_csrf($_POST['csrf'] ?? '')) {
            flash('error', 'Security token invalid.');
            redirect('security/credentials/create');
        }

        $data = [
            'service_name'                => trim($_POST['service_name'] ?? ''),
            'credential_type'             => in_array($_POST['credential_type'] ?? '', ['login','card','identity','link']) ? $_POST['credential_type'] : 'login',
            'website'                     => trim($_POST['website'] ?? ''),
            'login_url'                   => trim($_POST['login_url'] ?? ''),
            'username'                    => trim($_POST['username'] ?? ''),
            'email'                       => trim($_POST['email'] ?? ''),
            'password'                    => $_POST['password'] ?? '',
            'password_change_instructions'=> trim($_POST['password_change_instructions'] ?? ''),
            'rotation_frequency_days'     => !empty($_POST['rotation_frequency_days']) ? (int)$_POST['rotation_frequency_days'] : null,
            'last_changed_at'             => trim($_POST['last_changed_at'] ?? ''),
            'owner_user_id'               => !empty($_POST['owner_user_id']) ? (int)$_POST['owner_user_id'] : null,
            'store_id'                    => !empty($_POST['store_id']) ? (int)$_POST['store_id'] : null,
            'department'                  => trim($_POST['department'] ?? ''),
            'status'                      => $_POST['status'] ?? 'active',
            'notes'                       => trim($_POST['notes'] ?? ''),
        ];

        if (empty($data['service_name'])) {
            flash('error', 'Service name is required.');
            redirect('security/credentials/create');
        }

        try {
            $userId = (int)$_SESSION['user_id'];
            $id     = $this->model->create($data, $userId);

            $this->audit->log($userId, CredentialAuditService::ACTION_CREATED, $id, [
                'service_name' => $data['service_name'],
                'has_password' => !empty($data['password']),
            ], $this->ip(), $this->ua());

            flash('success', 'Credential "' . e($data['service_name']) . '" created successfully.');
            redirect('security/credentials/' . $id);
        } catch (Exception $ex) {
            error_log('[CredentialController::store] ' . $ex->getMessage());
            flash('error', 'Failed to create credential: ' . $ex->getMessage());
            redirect('security/credentials/create');
        }
    }

    /**
     * GET /security/credentials/:id
     */
    public function show(int $id): void {
        if (!isLoggedIn()) redirect('login');
        $user       = currentUser();
        $credential = $this->requireCanViewCredential($id);

        $userPerm   = canAdmin() ? null : $this->permission->getUserPermission($user['id'], $id);
        $permissions = canAdmin() ? $this->permission->getForCredential($id) : [];
        $auditLogs  = $this->audit->getForCredential($id, 20);

        // Rotation task
        $rotationTask = $this->db->fetch(
            "SELECT crt.*, t.title as task_title, t.status as task_status
             FROM credential_rotation_tasks crt
             LEFT JOIN tasks t ON crt.task_id = t.id
             WHERE crt.credential_id = ? AND crt.status NOT IN ('completed','cancelled')
             ORDER BY crt.created_at DESC LIMIT 1",
            [$id]
        );

        $stores      = $this->db->fetchAll("SELECT id, name FROM stores ORDER BY name");
        $users       = $this->db->fetchAll("SELECT id, name, role FROM users WHERE is_active=1 ORDER BY name");
        $currentPage = 'credentials';
        $pageTitle   = $credential['service_name'] . ' — Credential Detail';
        require __DIR__ . '/../views/credentials/show.php';
    }

    /**
     * GET /security/credentials/:id/edit
     */
    public function edit(int $id): void {
        if (!isLoggedIn()) redirect('login');
        $user       = currentUser();
        $credential = $this->requireCanViewCredential($id);

        if (!canAdmin() && !$this->permission->can($user['id'], $user['role'], $id, 'edit')) {
            flash('error', 'You do not have permission to edit this credential.');
            redirect('security/credentials/' . $id);
        }

        $stores      = $this->db->fetchAll("SELECT id, name FROM stores ORDER BY name");
        $users       = $this->db->fetchAll("SELECT id, name, role FROM users WHERE is_active=1 ORDER BY name");
        $currentPage = 'credentials';
        $pageTitle   = 'Edit Credential';
        require __DIR__ . '/../views/credentials/edit.php';
    }

    /**
     * POST /security/credentials/:id
     */
    public function update(int $id): void {
        if (!isLoggedIn()) redirect('login');
        if (!verify_csrf($_POST['csrf'] ?? '')) {
            flash('error', 'Security token invalid.');
            redirect('security/credentials/' . $id . '/edit');
        }

        $user = currentUser();
        if (!canAdmin() && !$this->permission->can($user['id'], $user['role'], $id, 'edit')) {
            flash('error', 'Permission denied.');
            redirect('security/credentials/' . $id);
        }

        $data = [
            'service_name'                => trim($_POST['service_name'] ?? ''),
            'credential_type'             => in_array($_POST['credential_type'] ?? '', ['login','card','identity','link']) ? $_POST['credential_type'] : 'login',
            'website'                     => trim($_POST['website'] ?? ''),
            'login_url'                   => trim($_POST['login_url'] ?? ''),
            'username'                    => trim($_POST['username'] ?? ''),
            'email'                       => trim($_POST['email'] ?? ''),
            'password_change_instructions'=> trim($_POST['password_change_instructions'] ?? ''),
            'owner_user_id'               => !empty($_POST['owner_user_id']) ? (int)$_POST['owner_user_id'] : null,
            'store_id'                    => !empty($_POST['store_id']) ? (int)$_POST['store_id'] : null,
            'department'                  => trim($_POST['department'] ?? ''),
            'status'                      => $_POST['status'] ?? 'active',
            'notes'                       => trim($_POST['notes'] ?? ''),
        ];

        if (!empty($_POST['rotation_frequency_days'])) {
            $data['rotation_frequency_days'] = (int)$_POST['rotation_frequency_days'];
        }

        // Only update password if provided
        if (!empty($_POST['password'])) {
            $data['password'] = $_POST['password'];
        }

        try {
            $userId = (int)$_SESSION['user_id'];
            $this->model->update($id, $data, $userId);

            $action = !empty($data['password'])
                ? CredentialAuditService::ACTION_PASSWORD_CHANGED
                : CredentialAuditService::ACTION_UPDATED;

            $this->audit->log($userId, $action, $id, [
                'updated_fields' => array_keys($data),
                'password_changed' => !empty($data['password']),
            ], $this->ip(), $this->ua());

            flash('success', 'Credential updated successfully.');
            redirect('security/credentials/' . $id);
        } catch (Exception $ex) {
            error_log('[CredentialController::update] ' . $ex->getMessage());
            flash('error', 'Failed to update: ' . $ex->getMessage());
            redirect('security/credentials/' . $id . '/edit');
        }
    }

    /**
     * POST /security/credentials/:id/delete
     */
    public function delete(int $id): void {
        if (!isLoggedIn()) redirect('login');
        if (!verify_csrf($_POST['csrf'] ?? '')) {
            flash('error', 'Security token invalid.');
            redirect('security/credentials/' . $id);
        }

        $user = currentUser();
        if (!canAdmin() && !$this->permission->can($user['id'], $user['role'], $id, 'delete')) {
            flash('error', 'Permission denied.');
            redirect('security/credentials/' . $id);
        }

        $cred = $this->model->findById($id, $user['id'], $user['role']);
        if (!$cred) {
            flash('error', 'Credential not found.');
            redirect('security/credentials');
        }

        $userId = (int)$_SESSION['user_id'];
        $this->model->delete($id, $userId);
        $this->audit->log($userId, CredentialAuditService::ACTION_DELETED, $id, [
            'service_name' => $cred['service_name'],
        ], $this->ip(), $this->ua());

        flash('success', '"' . e($cred['service_name']) . '" has been deleted.');
        redirect('security/credentials');
    }

    /**
     * POST /security/credentials/:id/view-password (AJAX/JSON)
     */
    public function viewPassword(int $id): void {
        if (!isLoggedIn()) {
            json_response(['success' => false, 'error' => 'Unauthorized'], 401);
        }

        $user = currentUser();

        if (!canAdmin() && !$this->permission->can($user['id'], $user['role'], $id, 'view_password')) {
            $this->audit->log($user['id'], CredentialAuditService::ACTION_PASSWORD_VIEWED, $id, [
                'success' => false, 'reason' => 'permission_denied',
            ], $this->ip(), $this->ua(), false);
            json_response(['success' => false, 'error' => 'Permission denied'], 403);
        }

        $password = $this->model->getDecryptedPassword($id, $user['id'], $user['role']);

        if ($password === null) {
            json_response(['success' => false, 'error' => 'Password not available or decryption failed'], 404);
        }

        $this->audit->log($user['id'], CredentialAuditService::ACTION_PASSWORD_VIEWED, $id, [
            'action' => 'viewed',
        ], $this->ip(), $this->ua());

        json_response([
            'success'  => true,
            'password' => $password,
            'warning'  => 'This action has been logged. Password will auto-hide in 30 seconds.',
        ]);
    }

    /**
     * POST /security/credentials/:id/copy-password (AJAX/JSON — logs copy event)
     */
    public function copyPassword(int $id): void {
        if (!isLoggedIn()) {
            json_response(['success' => false, 'error' => 'Unauthorized'], 401);
        }
        $user = currentUser();
        if (!canAdmin() && !$this->permission->can($user['id'], $user['role'], $id, 'view_password')) {
            json_response(['success' => false, 'error' => 'Permission denied'], 403);
        }
        $this->audit->log($user['id'], CredentialAuditService::ACTION_PASSWORD_COPIED, $id, [
            'action' => 'copied',
        ], $this->ip(), $this->ua());
        json_response(['success' => true]);
    }

    /**
     * POST /security/credentials/:id/grant-access
     */
    public function grantAccess(int $id): void {
        if (!isLoggedIn()) redirect('login');
        $this->requireAdmin();
        if (!verify_csrf($_POST['csrf'] ?? '')) {
            flash('error', 'Security token invalid.');
            redirect('security/credentials/' . $id);
        }

        $targetUserId = (int)($_POST['user_id'] ?? 0);
        if (!$targetUserId) {
            flash('error', 'Please select a user.');
            redirect('security/credentials/' . $id);
        }

        $permissions = [
            'can_view_metadata'  => !empty($_POST['can_view_metadata']),
            'can_view_password'  => !empty($_POST['can_view_password']),
            'can_edit'           => !empty($_POST['can_edit']),
            'can_rotate_password'=> !empty($_POST['can_rotate_password']),
            'can_grant_access'   => !empty($_POST['can_grant_access']),
            'can_delete'         => !empty($_POST['can_delete']),
        ];

        $grantedBy = (int)$_SESSION['user_id'];
        $this->permission->grant($id, $targetUserId, $grantedBy, $permissions, $this->ip(), $this->ua());

        flash('success', 'Access granted successfully.');
        redirect('security/credentials/' . $id);
    }

    /**
     * POST /security/credentials/:id/revoke-access
     */
    public function revokeAccess(int $id): void {
        if (!isLoggedIn()) redirect('login');
        $this->requireAdmin();
        if (!verify_csrf($_POST['csrf'] ?? '')) {
            flash('error', 'Security token invalid.');
            redirect('security/credentials/' . $id);
        }

        $targetUserId = (int)($_POST['user_id'] ?? 0);
        if (!$targetUserId) {
            flash('error', 'User not specified.');
            redirect('security/credentials/' . $id);
        }

        $revokedBy = (int)$_SESSION['user_id'];
        $this->permission->revoke($id, $targetUserId, $revokedBy, $this->ip(), $this->ua());

        flash('success', 'Access revoked successfully.');
        redirect('security/credentials/' . $id);
    }

    /**
     * POST /security/credentials/:id/create-rotation-task
     */
    public function createRotationTask(int $id): void {
        if (!isLoggedIn()) redirect('login');
        if (!verify_csrf($_POST['csrf'] ?? '')) {
            flash('error', 'Security token invalid.');
            redirect('security/credentials/' . $id);
        }

        $user = currentUser();
        $cred = $this->requireCanViewCredential($id);

        try {
            $db     = $this->db;
            $userId = (int)$_SESSION['user_id'];

            // Create linked task in tasks system
            $taskTitle = 'Change password: ' . $cred['service_name'];
            $dueAt     = $cred['next_rotation_due_at'] ?? date('Y-m-d', strtotime('+7 days'));

            $checklist = json_encode([
                ['text' => 'Verify current access works', 'done' => false],
                ['text' => 'Login to ' . ($cred['login_url'] ?: $cred['website'] ?: $cred['service_name']), 'done' => false],
                ['text' => 'Change password in the service', 'done' => false],
                ['text' => 'Update password in Credential Vault', 'done' => false],
                ['text' => 'Verify login with new password', 'done' => false],
                ['text' => 'Record completion note', 'done' => false],
            ]);

            $taskId = null;
            if ($db->tableExists('tasks')) {
                $taskId = (int)$db->insert(
                    "INSERT INTO tasks (title, description, assignee_id, created_by, due_date, status, checklist_items, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, 'pending', ?, NOW(), NOW())",
                    [
                        $taskTitle,
                        'Password rotation task for credential vault entry: ' . $cred['service_name'],
                        $userId,
                        $userId,
                        substr($dueAt, 0, 10),
                        $checklist,
                    ]
                );
            }

            // Insert rotation task record
            $db->insert(
                "INSERT INTO credential_rotation_tasks (credential_id, task_id, status, due_at, created_at, updated_at)
                 VALUES (?, ?, 'pending', ?, NOW(), NOW())",
                [$id, $taskId ?: null, $dueAt]
            );

            $this->audit->log($userId, CredentialAuditService::ACTION_ROTATION_TASK_CREATED, $id, [
                'task_id'    => $taskId,
                'task_title' => $taskTitle,
                'due_at'     => $dueAt,
            ], $this->ip(), $this->ua());

            flash('success', 'Rotation task created' . ($taskId ? ' (Task #' . $taskId . ')' : '') . '.');
        } catch (Exception $ex) {
            error_log('[CredentialController::createRotationTask] ' . $ex->getMessage());
            flash('error', 'Failed to create rotation task: ' . $ex->getMessage());
        }

        redirect('security/credentials/' . $id);
    }

    /**
     * GET /security/rotation
     */
    public function rotation(): void {
        if (!isLoggedIn()) redirect('login');
        $this->requireAdmin();

        if (!$this->db->tableExists('credentials')) {
            $overdue = $due7 = $due30 = $healthy = [];
            $stats = ['overdue' => 0, 'due_7_days' => 0, 'due_30_days' => 0, 'healthy' => 0, 'no_policy' => 0];
            $currentPage = 'credentials-rotation';
            $pageTitle   = 'Password Rotation Dashboard';
            require __DIR__ . '/../views/credentials/rotation.php';
            return;
        }

        $overdue   = $this->db->fetchAll(
            "SELECT c.*, u.name as owner_name, s.name as store_name,
                    DATEDIFF(NOW(), c.next_rotation_due_at) as days_overdue
             FROM credentials c
             LEFT JOIN users u ON c.owner_user_id = u.id
             LEFT JOIN stores s ON c.store_id = s.id
             WHERE c.status = 'active' AND c.deleted_at IS NULL
               AND c.next_rotation_due_at IS NOT NULL
               AND c.next_rotation_due_at < NOW()
             ORDER BY c.next_rotation_due_at ASC"
        );
        $due7      = $this->db->fetchAll(
            "SELECT c.*, u.name as owner_name, s.name as store_name,
                    DATEDIFF(c.next_rotation_due_at, NOW()) as days_until_due
             FROM credentials c
             LEFT JOIN users u ON c.owner_user_id = u.id
             LEFT JOIN stores s ON c.store_id = s.id
             WHERE c.status = 'active' AND c.deleted_at IS NULL
               AND c.next_rotation_due_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
             ORDER BY c.next_rotation_due_at ASC"
        );
        $due30     = $this->db->fetchAll(
            "SELECT c.*, u.name as owner_name, s.name as store_name,
                    DATEDIFF(c.next_rotation_due_at, NOW()) as days_until_due
             FROM credentials c
             LEFT JOIN users u ON c.owner_user_id = u.id
             LEFT JOIN stores s ON c.store_id = s.id
             WHERE c.status = 'active' AND c.deleted_at IS NULL
               AND c.next_rotation_due_at BETWEEN DATE_ADD(NOW(), INTERVAL 7 DAY) AND DATE_ADD(NOW(), INTERVAL 30 DAY)
             ORDER BY c.next_rotation_due_at ASC"
        );
        $healthy   = $this->db->fetchAll(
            "SELECT c.*, u.name as owner_name, s.name as store_name
             FROM credentials c
             LEFT JOIN users u ON c.owner_user_id = u.id
             LEFT JOIN stores s ON c.store_id = s.id
             WHERE c.status = 'active' AND c.deleted_at IS NULL
               AND c.next_rotation_due_at > DATE_ADD(NOW(), INTERVAL 30 DAY)
             ORDER BY c.next_rotation_due_at ASC"
        );
        $noPolicyCount = (int)$this->db->fetchColumn(
            "SELECT COUNT(*) FROM credentials WHERE status='active' AND deleted_at IS NULL AND next_rotation_due_at IS NULL"
        );

        $stats = [
            'overdue'    => count($overdue),
            'due_7_days' => count($due7),
            'due_30_days'=> count($due30),
            'healthy'    => count($healthy),
            'no_policy'  => $noPolicyCount,
        ];

        $currentPage = 'credentials-rotation';
        $pageTitle   = 'Password Rotation Dashboard';
        require __DIR__ . '/../views/credentials/rotation.php';
    }

    /**
     * GET /security/audit-logs
     */
    public function auditLogs(): void {
        if (!isLoggedIn()) redirect('login');
        $this->requireAdmin();

        if (!$this->db->tableExists('credential_audit_logs')) {
            $logs = []; $auditStats = []; $actionTypes = [];
            $currentPage = 'credentials-audit';
            $pageTitle   = 'Credential Audit Logs';
            require __DIR__ . '/../views/credentials/audit.php';
            return;
        }

        $limit  = max(1, min(500, (int)($_GET['limit'] ?? 100)));
        $offset = max(0, (int)($_GET['offset'] ?? 0));
        $action = trim($_GET['action'] ?? '');

        if ($action) {
            $logs = $this->db->fetchAll(
                "SELECT cal.*, u.name as actor_name, c.service_name as credential_name
                 FROM credential_audit_logs cal
                 LEFT JOIN users u ON cal.actor_user_id = u.id
                 LEFT JOIN credentials c ON cal.credential_id = c.id
                 WHERE cal.action = ?
                 ORDER BY cal.created_at DESC LIMIT ? OFFSET ?",
                [$action, $limit, $offset]
            );
        } else {
            $logs = $this->audit->getAll($limit, $offset);
        }

        $auditStats  = $this->audit->getStats(30);
        $actionTypes = $this->db->fetchAll(
            "SELECT action, COUNT(*) as cnt FROM credential_audit_logs GROUP BY action ORDER BY cnt DESC"
        );

        $currentPage = 'credentials-audit';
        $pageTitle   = 'Credential Audit Logs';
        require __DIR__ . '/../views/credentials/audit.php';
    }
}
