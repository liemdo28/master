<?php
/**
 * API v1 - Authentication Endpoints
 * POST /api/v1/auth/*
 */
require_once __DIR__ . '/ApiController.php';

class AuthApiController extends ApiController {

    // ── POST /api/v1/auth/login ─────────────────────────────────
    public function login() {
        // Rate limit check
        $rateLimit = ApiToken::checkRateLimit('login', 5, 15);
        if (!$rateLimit['allowed']) {
            api_error($rateLimit['message'], 429, ['retry_after' => $rateLimit['retry_after']]);
        }

        $body = $this->getJsonInput();
        $email    = strtolower(trim($body['email'] ?? ''));
        $password = $body['password'] ?? '';
        $platform = $_SERVER['HTTP_X_PLATFORM'] ?? $body['platform'] ?? 'android';
        $deviceId = $body['device_id'] ?? ($_SERVER['HTTP_X_DEVICE_ID'] ?? null);
        $deviceName = $body['device_name'] ?? ($_SERVER['HTTP_X_DEVICE_NAME'] ?? null);

        if (!$email || !$password) {
            api_error('Email and password are required', 400, ['email' => ['required'], 'password' => ['required']]);
        }

        $this->validateEmail($email);

        $userModel = new User();
        $user = $userModel->verify($email, $password);

        if (!$user) {
            ApiToken::recordFailedAttempt('login');
            api_error('Invalid email or password', 401, ['email' => ['Invalid credentials']]);
        }

        if (!isset($user['is_active']) || (int)$user['is_active'] !== 1) {
            api_error('Account is disabled', 403);
        }

        // Login success — clear rate limit
        ApiToken::clearRateLimit('login');

        // Tạo token
        $tokens = ApiToken::create($user['id'], $platform, $deviceId, $deviceName);

        // Register/update device
        if (in_array($platform, ['android', 'ios']) && $deviceId) {
            $this->registerDevice($user['id'], $platform, $deviceId, $deviceName, $body['app_version'] ?? null, $body['os_version'] ?? null);
        }

        // Audit log
        $this->auditLog('login', 'user', $user['id'], ['platform' => $platform, 'device_id' => $deviceId]);

        api_response([
            'user' => $this->userProfile($user),
            'tokens' => $tokens,
        ], 'Login successful', 200);
    }

    // ── POST /api/v1/auth/register ───────────────────────────────
    public function register() {
        $body = $this->getJsonInput();

        $name     = trim($body['name'] ?? '');
        $email    = strtolower(trim($body['email'] ?? ''));
        $password = $body['password'] ?? '';
        $platform = $body['platform'] ?? 'android';
        $deviceId = $body['device_id'] ?? null;
        $deviceName = $body['device_name'] ?? null;

        // Validate
        $errors = [];
        if (!$name)     $errors['name'] = ['Name is required'];
        if (!$email)    $errors['email'] = ['Email is required'];
        if (!$password) $errors['password'] = ['Password is required'];
        if ($password && strlen($password) < 6) $errors['password'] = ['Password must be at least 6 characters'];
        if ($email) {
            $this->validateEmail($email);
            $existing = (new User())->findByEmail($email);
            if ($existing) $errors['email'] = ['Email already registered'];
        }
        if (!empty($errors)) api_error('Validation failed', 422, $errors);

        // Create user
        $userModel = new User();
        $userId = $userModel->create([
            'name'     => $name,
            'email'    => $email,
            'password' => $password,
            'role'     => 'member',
        ]);

        // Auto-create default project
        $proj = new Project();
        $proj->create([
            'name'        => 'My First Project',
            'description' => 'Welcome to TaskFlow!',
            'color'       => '#dc2626',
            'owner_id'    => $userId,
        ]);

        // Tạo token
        $tokens = ApiToken::create($userId, $platform, $deviceId, $deviceName);

        $user = (new User())->findById($userId);

        // Register device
        if (in_array($platform, ['android', 'ios']) && $deviceId) {
            $this->registerDevice($userId, $platform, $deviceId, $deviceName, $body['app_version'] ?? null, $body['os_version'] ?? null);
        }

        $this->auditLog('register', 'user', $userId, ['platform' => $platform]);

        api_response([
            'user' => $this->userProfile($user),
            'tokens' => $tokens,
        ], 'Registration successful', 201);
    }

    // ── POST /api/v1/auth/logout ─────────────────────────────────
    public function logout() {
        $this->requireAuth();
        $token = $this->getBearerToken();

        // Revoke current token
        ApiToken::revoke($token);

        // Remove push token if device provided
        $body = $this->getJsonInput();
        if (!empty($body['device_id'])) {
            $this->db->update(
                "UPDATE devices SET push_token = NULL, is_active = 0 WHERE user_id = ? AND device_id = ?",
                [$this->userId, $body['device_id']]
            );
        }

        $this->auditLog('logout', 'user', $this->userId);
        api_response([], 'Logged out successfully');
    }

    // ── POST /api/v1/auth/refresh ─────────────────────────────────
    public function refresh() {
        $body = $this->getJsonInput();
        $refreshToken = $body['refresh_token'] ?? null;

        if (!$refreshToken) {
            api_error('refresh_token is required', 400);
        }

        $tokens = ApiToken::refresh($refreshToken);

        if (!$tokens) {
            api_error('Invalid or expired refresh token', 401);
        }

        api_response([
            'tokens' => $tokens,
        ], 'Token refreshed', 200);
    }

    // ── GET /api/v1/auth/me ──────────────────────────────────────
    public function me() {
        $this->requireAuth();

        $user = (new User())->findById($this->userId);
        $activeSessions = ApiToken::getActiveSessions($this->userId);

        api_response([
            'user' => $this->userProfile($user),
            'sessions' => $activeSessions,
        ], 'OK');
    }

    // ── POST /api/v1/auth/forgot-password ────────────────────────
    public function forgotPassword() {
        $body = $this->getJsonInput();
        $email = strtolower(trim($body['email'] ?? ''));

        if (!$email) api_error('Email is required', 400);

        $user = (new User())->findByEmail($email);

        // Luôn trả success để tránh email enumeration
        if (!$user) {
            api_response([], 'If that email exists, a reset link has been sent');
        }

        // Tạo reset token
        $token = bin2hex(random_bytes(32));
        $this->db->delete("DELETE FROM password_resets WHERE email = ?", [$email]);
        $this->db->insert(
            "INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))",
            [$email, password_hash($token, PASSWORD_BCRYPT)]
        );

        // Gửi email
        $resetUrl = rtrim(APP_URL, '/') . '/reset-password?token=' . $token . '&email=' . urlencode($email);
        $subject = APP_NAME . ' - Password Reset';
        $userName = htmlspecialchars($user['name']);
        $body = <<<HTML
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;max-width:520px;margin:40px auto;padding:20px">
<div style="background:#dc2626;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0;text-align:center">
  <h1 style="margin:0;font-size:22px">TaskFlow</h1>
</div>
<div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:32px">
  <p>Xin chào <strong>{$userName}</strong>,</p>
  <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản TaskFlow của bạn.</p>
  <div style="text-align:center;margin:28px 0">
    <a href="{$resetUrl}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">
      Đặt lại mật khẩu
    </a>
  </div>
  <p style="font-size:13px;color:#6b7280">Link này có hiệu lực trong 1 giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
</div>
</body></html>
HTML;

        $headers = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n";
        $headers .= "From: " . APP_NAME . " <noreply@" . parse_url(APP_URL, PHP_URL_HOST) . ">\r\n";
        @mail($email, $subject, $body, $headers);

        $this->auditLog('forgot_password', 'user', $user['id'] ?? null);

        api_response([], 'If that email exists, a reset link has been sent');
    }

    // ── POST /api/v1/auth/reset-password ─────────────────────────
    public function resetPassword() {
        $body = $this->getJsonInput();
        $email = strtolower(trim($body['email'] ?? ''));
        $token = $body['token'] ?? '';
        $newPassword = $body['new_password'] ?? '';

        if (!$email || !$token || !$newPassword) {
            api_error('email, token, and new_password are required', 400);
        }

        if (strlen($newPassword) < 6) {
            api_error('Password must be at least 6 characters', 422, ['new_password' => ['Too short']]);
        }

        $reset = $this->db->fetch(
            "SELECT * FROM password_resets WHERE email = ? AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
            [$email]
        );

        if (!$reset || !password_verify($token, $reset['token'])) {
            api_error('Invalid or expired reset token', 400);
        }

        // Update password
        $user = (new User())->findByEmail($email);
        if ($user) {
            (new User())->update($user['id'], ['password' => $newPassword]);
            ApiToken::revokeAll($user['id']); // Revoke all sessions
            $this->auditLog('reset_password', 'user', $user['id']);
        }

        $this->db->delete("DELETE FROM password_resets WHERE email = ?", [$email]);

        api_response([], 'Password reset successful');
    }

    // ── POST /api/v1/auth/logout-all ─────────────────────────────
    public function logoutAll() {
        $this->requireAuth();
        ApiToken::revokeAll($this->userId);
        $this->db->update("UPDATE devices SET is_active = 0 WHERE user_id = ?", [$this->userId]);
        $this->auditLog('logout_all', 'user', $this->userId);
        api_response([], 'All sessions revoked');
    }

    // ── Helper ───────────────────────────────────────────────────
    private function registerDevice($userId, $platform, $deviceId, $deviceName, $appVersion, $osVersion) {
        try {
            $this->db->query(
                "INSERT INTO devices (user_id, platform, device_id, device_name, app_version, os_version, last_active_at)
                 VALUES (?, ?, ?, ?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE
                   device_name = COALESCE(VALUES(device_name), device_name),
                   app_version = COALESCE(VALUES(app_version), app_version),
                   os_version = COALESCE(VALUES(os_version), os_version),
                   is_active = 1,
                   last_active_at = NOW()",
                [$userId, $platform, $deviceId, $deviceName, $appVersion, $osVersion]
            );
        } catch (Exception $e) {}
    }
}
