<?php
class AuthController {
    private $userModel;
    public function __construct() { $this->userModel = new User(); }

    public function showLogin() {
        if (isLoggedIn()) redirect('dashboard');
        require __DIR__ . '/../views/auth/login.php';
    }

    public function login() {
        if (!verify_csrf($_POST['csrf'] ?? '')) { flash('error', 'Invalid security token.'); redirect('login'); }

        // Rate limiting: 5 failed attempts per IP → 15-minute lockout
        $ip = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown')[0]);
        $key = 'login_attempts_' . md5($ip);
        if (!isset($_SESSION[$key])) $_SESSION[$key] = ['count' => 0, 'last' => 0];
        $attempts = &$_SESSION[$key];
        $lockoutSeconds = 900; // 15 minutes
        if ($attempts['count'] >= 5 && (time() - $attempts['last']) < $lockoutSeconds) {
            $wait = ceil(($lockoutSeconds - (time() - $attempts['last'])) / 60);
            flash('error', "Quá nhiều lần đăng nhập sai. Vui lòng thử lại sau {$wait} phút.");
            redirect('login');
        }
        if ((time() - $attempts['last']) >= $lockoutSeconds) {
            $attempts = ['count' => 0, 'last' => 0];
        }

        $email = strtolower(trim($_POST['email'] ?? ''));
        $password = $_POST['password'] ?? '';
        if ($email === '' || $password === '') { flash('error', t('auth.enter_credentials')); redirect('login'); }
        $user = $this->userModel->verify($email, $password);
        if (!$user) {
            $attempts['count']++;
            $attempts['last'] = time();
            flash('error', t('auth.invalid_credentials'));
            redirect('login');
        }

        // Success – clear rate limit
        unset($_SESSION[$key]);
        session_regenerate_id(true);
        $_SESSION['user_id']   = $user['id'];
        $_SESSION['user_name'] = $user['name'];
        $_SESSION['user_role'] = $user['role'];
        if (!empty($user['store_id'])) $_SESSION['store_id'] = $user['store_id'];
        $storeIds = $this->userModel->getUserStoreIds((int)$user['id']);
        $_SESSION['store_ids'] = $storeIds ?: (!empty($user['store_id']) ? [(int)$user['store_id']] : []);

        // Remember Me — 30-day persistent cookie
        if (!empty($_POST['remember_me'])) {
            $this->setRememberToken((int)$user['id']);
        }

        // Role-based landing page after login
        if (in_array($user['role'], ['ceo', 'admin', 'manager'])) {
            redirect('overview');
        }
        if ($user['role'] === 'accountant') {
            redirect('bills');
        }
        redirect('my-tasks');
    }

    /** Issue a secure remember-me cookie and store its hash in DB */
    public function setRememberToken(int $userId): void {
        $token     = bin2hex(random_bytes(32)); // 64-char hex raw token
        $hash      = hash('sha256', $token);
        $expires   = date('Y-m-d H:i:s', strtotime('+30 days'));
        $isHttps   = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
                  || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';

        $db = Database::getInstance();
        // Guard: remember_tokens table may not exist yet on production
        if ($db->tableExists('remember_tokens')) {
            // Use 'token' column if present (production has VARCHAR(255) token col)
            // Fall back to 'token_hash' for newer schema
            $hasHashCol = $db->columnExists('remember_tokens', 'token_hash');
            $col = $hasHashCol ? 'token_hash' : 'token';
            // Remove old tokens for this user (one active token per user)
            $db->execute("DELETE FROM remember_tokens WHERE user_id = ?", [$userId]);
            $db->execute(
                "INSERT INTO remember_tokens (user_id, {$col}, expires_at) VALUES (?,?,?)",
                [$userId, $hash, $expires]
            );
        }

        setcookie('remember_token', $token, [
            'expires'  => strtotime('+30 days'),
            'path'     => '/',
            'secure'   => $isHttps,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }

    /** Clear remember-me cookie and DB token on logout */
    public function clearRememberToken(): void {
        $token = $_COOKIE['remember_token'] ?? '';
        if ($token !== '') {
            $hash = hash('sha256', $token);
            $db = Database::getInstance();
            if ($db->tableExists('remember_tokens')) {
                // Use 'token' column if present (production has VARCHAR(255) token col)
                // Fall back to 'token_hash' for newer schema
                $col = $db->columnExists('remember_tokens', 'token_hash') ? 'token_hash' : 'token';
                $db->execute(
                    "DELETE FROM remember_tokens WHERE {$col} = ?", [$hash]
                );
            }
        }
        setcookie('remember_token', '', ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Strict']);
    }

    private function registrationAllowed(): bool {
        return ($_ENV['ALLOW_REGISTRATION'] ?? getenv('ALLOW_REGISTRATION') ?: '0') === '1';
    }

    public function showRegister() {
        if (isLoggedIn()) redirect('dashboard');
        if (!$this->registrationAllowed()) {
            http_response_code(403);
            die('Registration is currently closed. Contact your administrator.');
        }
        require __DIR__ . '/../views/auth/register.php';
    }

    public function register() {
        if (!$this->registrationAllowed()) { http_response_code(403); die('Registration closed.'); }
        if (!verify_csrf($_POST['csrf'] ?? '')) { flash('error', 'Invalid security token.'); redirect('register'); }
        $name = trim($_POST['name'] ?? '');
        $email = strtolower(trim($_POST['email'] ?? ''));
        $password = $_POST['password'] ?? '';
        $confirm = $_POST['password_confirm'] ?? '';

        if ($name === '' || $email === '' || $password === '') {
            flash('error', t('auth.fill_required'));
            redirect('register');
        }
        if (strlen($password) < 6) {
            flash('error', t('auth.password_short'));
            redirect('register');
        }
        if ($password !== $confirm) {
            flash('error', t('auth.password_mismatch'));
            redirect('register');
        }
        if ($this->userModel->findByEmail($email)) {
            flash('error', t('auth.email_used'));
            redirect('register');
        }

        $id = $this->userModel->create([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'role' => 'staff'
        ]);

        // Auto-create a default project
        $proj = new Project();
        $proj->create([
            'name' => t('seed.first_project'),
            'description' => t('seed.first_project_desc'),
            'color' => '#dc2626',
            'owner_id' => $id
        ]);

        $_SESSION['user_id'] = $id;
        $_SESSION['user_name'] = $name;
        $_SESSION['user_role'] = 'staff';

        flash('success', t('auth.register_success'));
        redirect('dashboard');
    }

    public function logout() {
        $this->clearRememberToken();
        session_destroy();
        redirect('login');
    }

    private function requireAdminAccess() {
        if (isAdmin()) {
            return true;
        }

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            http_response_code(403);
            echo 'Forbidden';
            exit;
        }

        flash('error', 'Admin access required.');
        redirect('dashboard');
    }

    private function verifyAdminUserCsrf($redirectPath) {
        $token = $_POST['csrf_token'] ?? ($_POST['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''));
        if (is_string($token) && verify_csrf($token)) {
            return true;
        }

        unset($_SESSION['csrf_token']);
        csrf_token();
        flash('error', 'Invalid security token. Please try again.');
        redirect($redirectPath);
    }

    private function adminUserFormData($target = null) {
        $name = trim($_POST['name'] ?? '');
        $email = strtolower(trim($_POST['email'] ?? ''));
        $role = $_POST['role'] ?? ($target['role'] ?? 'member');
        $isActive = isset($_POST['is_active']) ? 1 : 0;

        if (!in_array($role, ['admin', 'ceo', 'manager', 'accountant', 'member'], true)) {
            $role = 'member';
        }

        // Multi-store: read checked store_ids[]
        $rawIds = isset($_POST['store_ids']) ? (array)$_POST['store_ids'] : [];
        $storeIds = array_values(array_filter(array_map('intval', $rawIds)));

        return [
            'name'      => $name,
            'email'     => $email,
            'role'      => $role,
            'store_id'  => !empty($storeIds) ? $storeIds[0] : null,
            'store_ids' => $storeIds,
            'is_active' => $isActive,
        ];
    }

    private function validateAdminUserData($data, $targetId = null) {
        if ($data['name'] === '' || $data['email'] === '') {
            return 'Name and email are required.';
        }

        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            return 'Please enter a valid email address.';
        }

        $existing = $this->userModel->findByEmail($data['email']);
        if ($existing && (int)$existing['id'] !== (int)$targetId) {
            return 'Email already exists.';
        }

        return null;
    }

    private function loadStores() {
        try {
            return (new Store())->allActive();
        } catch (Exception $e) {
            return [];
        }
    }

    public function listUsers() {
        if (!canAdmin()) redirect('dashboard');
        $users = $this->userModel->getAll();
        $stores = $this->loadStores();
        require __DIR__ . '/../views/admin/users.php';
    }

    public function showCreateUser() {
        $this->requireAdminAccess();
        $stores = $this->loadStores();
        $user = null;
        require __DIR__ . '/../views/admin/user_form.php';
    }

    public function createUser() {
        if (!canAdmin()) redirect('dashboard');
        $data = $this->adminUserFormData();
        $password = $_POST['password'] ?? '';
        if ($data['name'] === '' || $data['email'] === '' || $password === '') { flash('error', t('auth.fill_all_short')); redirect('admin/users'); }
        if ($this->userModel->findByEmail($data['email'])) { flash('error', t('auth.email_exists')); redirect('admin/users'); }
        $newId = $this->userModel->create(array_merge($data, ['password' => $password]));
        if ($newId) $this->userModel->syncUserStores((int)$newId, $data['store_ids']);
        flash('success', t('auth.user_create_success'));
        redirect('admin/users');
    }

    public function editUser($id) {
        $this->requireAdminAccess();
        $user = $this->userModel->findById($id);
        if (!$user) {
            flash('error', 'User not found.');
            redirect('admin/users');
        }
        $stores = $this->loadStores();
        $userStoreIds = $this->userModel->getUserStoreIds((int)$id);
        require __DIR__ . '/../views/admin/user_form.php';
    }

    public function updateUser($id) {
        $this->requireAdminAccess();
        $this->verifyAdminUserCsrf('admin/users/' . (int)$id . '/edit');

        $target = $this->userModel->findById($id);
        if (!$target) {
            flash('error', 'User not found.');
            redirect('admin/users');
        }

        $data = $this->adminUserFormData($target);
        $error = $this->validateAdminUserData($data, $id);
        if ($error) {
            flash('error', $error);
            redirect('admin/users/' . (int)$id . '/edit');
        }

        if ((int)$id === (int)$_SESSION['user_id']) {
            $data['role'] = $target['role'];
            $data['is_active'] = 1;
        }

        $password = $_POST['password'] ?? '';
        if ($password !== '') {
            if (strlen($password) < 6) {
                flash('error', 'Password must be at least 6 characters.');
                redirect('admin/users/' . (int)$id . '/edit');
            }
            $data['password'] = $password;
        }

        $this->userModel->update($id, $data);
        $this->userModel->syncUserStores((int)$id, $data['store_ids']);
        flash('success', 'User updated successfully.');
        redirect('admin/users');
    }

    /**
     * Admin user detail page — shows tasks where this user is assignee / creator / watcher.
     */
    public function showUser($id) {
        $this->requireAdminAccess();
        $user = $this->userModel->findById($id);
        if (!$user) { flash('error', 'User not found'); redirect('admin/users'); }

        $db = Database::getInstance();
        $today = DateService::today();

        // Tasks assigned to this user
        $tasksAssigned = $db->fetchAll(
            "SELECT t.*, p.name as project_name, p.color as project_color, p.store_id, st.name as store_name, st.color as store_color
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores st ON p.store_id = st.id
             WHERE t.assignee_id = ?
             ORDER BY t.is_completed ASC, t.due_date IS NULL, t.due_date ASC, t.created_at DESC",
            [$id]
        );

        // Tasks created by this user but assigned to someone else
        $tasksCreated = $db->fetchAll(
            "SELECT t.*, p.name as project_name, p.color as project_color, p.store_id, st.name as store_name, st.color as store_color, u.name as assignee_name
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores st ON p.store_id = st.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE t.created_by = ? AND (t.assignee_id IS NULL OR t.assignee_id <> ?)
             ORDER BY t.is_completed ASC, t.due_date IS NULL, t.due_date ASC, t.created_at DESC
             LIMIT 100",
            [$id, $id]
        );

        // Tasks the user watches (but not assigned to / created)
        $tasksWatched = $db->fetchAll(
            "SELECT t.*, p.name as project_name, p.color as project_color, p.store_id, st.name as store_name, st.color as store_color, u.name as assignee_name
             FROM tasks t
             JOIN task_watchers tw ON t.id = tw.task_id AND tw.user_id = ?
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN stores st ON p.store_id = st.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE (t.assignee_id IS NULL OR t.assignee_id <> ?) AND (t.created_by IS NULL OR t.created_by <> ?)
             ORDER BY t.is_completed ASC, t.due_date IS NULL, t.due_date ASC, t.created_at DESC
             LIMIT 100",
            [$id, $id, $id]
        );

        // Stats — from assigned list
        $stats = [
            'total'      => count($tasksAssigned),
            'completed'  => 0,
            'overdue'    => 0,
            'today'      => 0,
            'upcoming'   => 0,
            'recurring'  => 0,
        ];
        foreach ($tasksAssigned as $t) {
            if ($t['is_completed']) { $stats['completed']++; continue; }
            if (!empty($t['repeat_type']) && $t['repeat_type'] !== 'none') $stats['recurring']++;
            if (!empty($t['due_date'])) {
                if ($t['due_date'] < $today) $stats['overdue']++;
                elseif ($t['due_date'] === $today) $stats['today']++;
                else $stats['upcoming']++;
            }
        }
        $privacyCounts = $db->fetch(
            "SELECT
                SUM(CASE WHEN COALESCE(visibility, 'private') = 'public' THEN 1 ELSE 0 END) AS public_count,
                SUM(CASE WHEN COALESCE(visibility, 'private') = 'private' THEN 1 ELSE 0 END) AS private_count
             FROM tasks
             WHERE assignee_id = ? OR created_by = ?",
            [$id, $id]
        ) ?: ['public_count' => 0, 'private_count' => 0];

        require __DIR__ . '/../views/admin/user_detail.php';
    }

    public function toggleUser($id) {
        if (!canAdmin()) redirect('dashboard');
        if ((int)$id === (int)$_SESSION['user_id']) { flash('error', t('auth.cannot_disable_self')); redirect('admin/users'); }
        $this->userModel->toggleActive($id);
        flash('success', t('auth.user_status_updated'));
        redirect('admin/users');
    }

    public function deactivateUser($id) {
        $this->requireAdminAccess();
        $this->verifyAdminUserCsrf('admin/users');
        if ((int)$id === (int)$_SESSION['user_id']) {
            flash('error', 'You cannot deactivate your own account.');
            redirect('admin/users');
        }
        $this->userModel->deactivate($id);
        flash('success', 'User deactivated. Task history remains available.');
        redirect('admin/users');
    }

    public function deleteUser($id) {
        if (!canAdmin()) redirect('dashboard');
        if ((int)$id === (int)$_SESSION['user_id']) { flash('error', t('auth.cannot_delete_self')); redirect('admin/users'); }
        $this->userModel->delete($id);
        flash('success', t('auth.user_deleted'));
        redirect('admin/users');
    }

    public function resetUserPassword($id) {
        $this->requireAdminAccess();
        $this->verifyAdminUserCsrf('admin/users/' . (int)$id . '/edit');

        $target = $this->userModel->findById($id);
        if (!$target) {
            flash('error', 'User not found.');
            redirect('admin/users');
        }

        $password = trim($_POST['password'] ?? '');
        if (strlen($password) < 6) {
            flash('error', 'New password must be at least 6 characters.');
            redirect('admin/users/' . (int)$id . '/edit');
        }

        $this->userModel->update($id, ['password' => $password, 'password_reset_by' => $_SESSION['user_id'] ?? null]);
        // Revoke all remember tokens for the target user after admin password reset
        $db = Database::getInstance();
        if ($db->tableExists('remember_tokens')) {
            $db->execute("DELETE FROM remember_tokens WHERE user_id = ?", [(int)$id]);
        }
        flash('success', 'Password reset successfully. All remember-me sessions for this user have been revoked.');
        redirect('admin/users/' . (int)$id . '/edit');
    }

    public function settings() {
        $user          = currentUser();
        $notifications = new Notification();
        $unreadCount   = $notifications->getUnreadCount($_SESSION['user_id']);
        $allUsers      = isAdmin() ? $this->userModel->getAll() : [];

        // Telegram link status and preferences for settings page
        $telegramLink  = null;
        $telegramPrefs = [];
        if (class_exists('TelegramBot')) {
            $tgBot         = new TelegramBot();
            $telegramLink  = $tgBot->getLinkByUser((int)$_SESSION['user_id']);
            $telegramPrefs = $tgBot->getPreferences((int)$_SESSION['user_id']);
        }
        require __DIR__ . '/../views/settings/index.php';
    }

    /**
     * POST /api/admin/users/{id}/update — admin edits any user's profile
     */
    public function adminUpdateUser(int $targetId): void {
        if (!isAdmin()) { json_response(['error' => 'Forbidden'], 403); return; }
        if (!verify_csrf($_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
            json_response(['error' => 'Invalid CSRF token'], 403); return;
        }

        $target = $this->userModel->findById($targetId);
        if (!$target) { json_response(['error' => 'User not found'], 404); return; }

        $name  = trim($_POST['name'] ?? '');
        $email = strtolower(trim($_POST['email'] ?? ''));
        $role  = $_POST['role'] ?? $target['role'];
        $newPassword = $_POST['new_password'] ?? '';

        if ($name === '' || $email === '') {
            json_response(['error' => 'Name and email are required'], 422); return;
        }

        // Email uniqueness check (exclude self)
        if ($email !== $target['email']) {
            $existing = $this->userModel->findByEmail($email);
            if ($existing && (int)$existing['id'] !== $targetId) {
                json_response(['error' => 'Email already in use by another account'], 422); return;
            }
        }

        // Role guard: admin cannot demote themselves
        if ($targetId === (int)$_SESSION['user_id'] && $role !== $target['role']) {
            json_response(['error' => 'You cannot change your own role'], 422); return;
        }

        $updateData = ['name' => $name, 'email' => $email, 'role' => $role];

        if ($newPassword !== '') {
            if (strlen($newPassword) < 6) {
                json_response(['error' => 'Password must be at least 6 characters'], 422); return;
            }
            $updateData['password'] = $newPassword;
        }

        $this->userModel->update($targetId, $updateData);

        // Revoke all remember tokens if password was changed
        if ($newPassword !== '') {
            $db = Database::getInstance();
            if ($db->tableExists('remember_tokens')) {
                $db->execute("DELETE FROM remember_tokens WHERE user_id = ?", [$targetId]);
            }
        }

        json_response(['ok' => true, 'message' => 'User updated successfully']);
    }

    public function updateSettings() {
        if (!verify_csrf($_POST['csrf'] ?? '')) { flash('error', 'Invalid security token.'); redirect('settings'); }
        $userId = $_SESSION['user_id'];
        $user = $this->userModel->findById($userId);
        $name = trim($_POST['name'] ?? '');
        $email = strtolower(trim($_POST['email'] ?? ''));
        $currentPassword = $_POST['current_password'] ?? '';
        $newPassword = $_POST['new_password'] ?? '';
        $confirmPassword = $_POST['confirm_password'] ?? '';
        $emailNotifications = isset($_POST['email_notifications']) ? 1 : 0;
        $timezone = trim($_POST['timezone'] ?? '');
        if ($timezone === '') {
            $timezone = null;
        }

        if ($name === '' || $email === '') {
            flash('error', t('auth.fill_required'));
            redirect('settings');
        }

        // Check email uniqueness
        if ($email !== $user['email']) {
            $existing = $this->userModel->findByEmail($email);
            if ($existing) {
                flash('error', t('settings.email_taken'));
                redirect('settings');
            }
        }

        $updateData = [
            'name' => $name,
            'email' => $email,
            'email_notifications' => $emailNotifications,
            'timezone' => $timezone,
        ];

        // Password change
        if ($newPassword !== '') {
            if (!password_verify($currentPassword, $user['password'])) {
                flash('error', t('settings.current_password_wrong'));
                redirect('settings');
            }
            if (strlen($newPassword) < 6) {
                flash('error', t('auth.password_short'));
                redirect('settings');
            }
            if ($newPassword !== $confirmPassword) {
                flash('error', t('auth.password_mismatch'));
                redirect('settings');
            }
            $updateData['password'] = $newPassword;
        }

        $this->userModel->update($userId, $updateData);
        $_SESSION['user_name'] = $name;
        app_set_timezone($timezone);

        // Password changed — revoke all remember tokens for this user (force re-login on other devices)
        if ($newPassword !== '') {
            $db = Database::getInstance();
            if ($db->tableExists('remember_tokens')) {
                $db->execute(
                    "DELETE FROM remember_tokens WHERE user_id = ?", [$userId]
                );
            }
            $this->clearRememberToken();
        }

        flash('success', t('settings.update_success'));
        redirect('settings');
    }
}
