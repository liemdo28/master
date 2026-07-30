<?php
/**
 * API v1 - Users Endpoints
 * GET|PUT /api/v1/users
 */
require_once __DIR__ . '/ApiController.php';

class UserApiController extends ApiController {

    // ── GET /api/v1/users ────────────────────────────────────────
    public function index() {
        $this->requireAuth();

        $users = (new User())->getActive();
        api_response([
            'users' => array_map(fn($u) => [
                'id'     => (int)$u['id'],
                'name'   => $u['name'],
                'email'  => $u['email'],
                'avatar' => $u['avatar'],
                'role'   => $u['role'],
            ], $users),
        ], 'OK');
    }

    // ── GET /api/v1/users/{id} ───────────────────────────────────
    public function show($id) {
        $this->requireAuth();
        $user = (new User())->findById($id);

        if (!$user) api_error('User not found', 404);

        api_response([
            'user' => [
                'id'       => (int)$user['id'],
                'name'     => $user['name'],
                'email'    => $user['email'],
                'avatar'   => $user['avatar'],
                'role'     => $user['role'],
                'created_at' => $user['created_at'],
            ],
        ], 'OK');
    }

    // ── PUT /api/v1/users/profile ────────────────────────────────
    public function updateProfile() {
        $this->requireAuth();
        $body = $this->getJsonInput();

        $data = [];

        if (!empty($body['name'])) {
            $data['name'] = trim($body['name']);
        }

        if (!empty($body['email'])) {
            $email = strtolower(trim($body['email']));
            $this->validateEmail($email);
            $existing = (new User())->findByEmail($email);
            if ($existing && (int)$existing['id'] !== $this->userId) {
                api_error('Email already in use', 422, ['email' => ['Already taken']]);
            }
            $data['email'] = $email;
        }

        if (!empty($body['preferred_language'])) {
            $lang = trim($body['preferred_language']);
            if (!in_array($lang, ['vi', 'en'])) {
                api_error('Language must be vi or en', 422);
            }
            $data['preferred_language'] = $lang;
        }

        if (!empty($body['avatar'])) {
            $data['avatar'] = trim($body['avatar']);
        }

        if (!empty($body['notification_settings'])) {
            $data['notification_settings'] = json_encode($body['notification_settings']);
        }

        if (empty($data)) {
            api_error('No fields to update', 400);
        }

        (new User())->update($this->userId, $data);
        $updated = (new User())->findById($this->userId);

        $this->auditLog('profile_updated', 'user', $this->userId);

        api_response([
            'user' => $this->userProfile($updated),
        ], 'Profile updated');
    }

    // ── PUT /api/v1/users/password ───────────────────────────────
    public function updatePassword() {
        $this->requireAuth();
        $body = $this->getJsonInput();

        $currentPassword = $body['current_password'] ?? '';
        $newPassword     = $body['new_password'] ?? '';
        $confirmPassword = $body['confirm_password'] ?? '';

        if (!$currentPassword || !$newPassword) {
            api_error('current_password and new_password are required', 400);
        }

        if (strlen($newPassword) < 6) {
            api_error('Password must be at least 6 characters', 422, ['new_password' => ['Too short']]);
        }

        if ($newPassword !== $confirmPassword) {
            api_error('Passwords do not match', 422, ['confirm_password' => ['Mismatch']]);
        }

        $user = (new User())->findById($this->userId);

        if (!password_verify($currentPassword, $user['password'] ?? '')) {
            api_error('Current password is incorrect', 400);
        }

        (new User())->update($this->userId, ['password' => $newPassword]);
        ApiToken::revokeAll($this->userId); // Force re-login

        $this->auditLog('password_changed', 'user', $this->userId);

        api_response([], 'Password updated. Please login again.');
    }

    // ── PUT /api/v1/users/push-token ─────────────────────────────
    public function updatePushToken() {
        $this->requireAuth();
        $body = $this->getJsonInput();

        $pushToken = $body['push_token'] ?? '';
        $platform  = $body['platform']  ?? 'android';
        $deviceId  = $body['device_id'] ?? '';

        if (!$pushToken || !$deviceId) {
            api_error('push_token and device_id are required', 400);
        }

        try {
            $this->db->query(
                "INSERT INTO devices (user_id, platform, device_id, push_token, push_token_updated_at, is_active, last_active_at)
                 VALUES (?, ?, ?, ?, NOW(), 1, NOW())
                 ON DUPLICATE KEY UPDATE
                   push_token = VALUES(push_token),
                   push_token_updated_at = NOW(),
                   is_active = 1,
                   last_active_at = NOW()",
                [$this->userId, $platform, $deviceId, $pushToken]
            );
        } catch (Exception $e) {
            api_error('Failed to update push token', 500);
        }

        api_response([], 'Push token updated');
    }
}
