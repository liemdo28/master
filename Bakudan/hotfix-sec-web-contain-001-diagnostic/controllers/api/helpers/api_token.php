<?php
/**
 * API v1 - Token Management
 * Dùng cho mobile app authentication (thay thế session)
 */
require_once __DIR__ . '/../../../models/User.php';

class ApiToken {
    const ACCESS_TOKEN_TTL  = 3600;   // 1 giờ
    const REFRESH_TOKEN_TTL = 2592000; // 30 ngày

    /**
     * Tạo cặp access + refresh token cho user
     */
    public static function create($userId, $platform = 'web', $deviceId = null, $deviceName = null) {
        $db = Database::getInstance();

        $accessToken  = bin2hex(random_bytes(32));
        $refreshToken = bin2hex(random_bytes(32));

        // Revoke old tokens của user trên cùng device (logout old session)
        if ($deviceId) {
            $db->update(
                "UPDATE api_tokens SET revoked_at = NOW() WHERE user_id = ? AND device_id = ? AND revoked_at IS NULL",
                [$userId, $deviceId]
            );
        }

        $db->insert(
            "INSERT INTO api_tokens (user_id, device_id, device_name, platform, access_token, refresh_token,
             access_token_expires_at, refresh_token_expires_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW() + INTERVAL ? SECOND, NOW() + INTERVAL ? SECOND)",
            [$userId, $deviceId, $deviceName, $platform, $accessToken, $refreshToken,
             self::ACCESS_TOKEN_TTL, self::REFRESH_TOKEN_TTL]
        );

        return [
            'access_token'  => $accessToken,
            'refresh_token' => $refreshToken,
            'token_type'    => 'Bearer',
            'expires_in'    => self::ACCESS_TOKEN_TTL,
            'expires_at'   => time() + self::ACCESS_TOKEN_TTL,
        ];
    }

    /**
     * Validate access token, trả về token row hoặc null
     * Dùng MySQL NOW() để so sánh thay vì strtotime() PHP
     * vì PHP timezone có thể khác MySQL timezone
     */
    public static function validate($token, $strict = true) {
        $db = Database::getInstance();

        if ($strict) {
            // Kiểm tra expiry ngay trong SQL (tránh timezone mismatch)
            $row = $db->fetch(
                "SELECT * FROM api_tokens
                 WHERE access_token = ?
                   AND revoked_at IS NULL
                   AND access_token_expires_at > NOW()",
                [$token]
            );
        } else {
            // Non-strict: lấy token kể cả expired (dùng cho refresh flow)
            $row = $db->fetch(
                "SELECT * FROM api_tokens
                 WHERE access_token = ?
                   AND revoked_at IS NULL",
                [$token]
            );
        }

        return $row ?: null;
    }

    /**
     * Refresh access token bằng refresh token
     */
    public static function refresh($refreshToken) {
        $db = Database::getInstance();

        $row = $db->fetch(
            "SELECT * FROM api_tokens WHERE refresh_token = ? AND revoked_at IS NULL",
            [$refreshToken]
        );

        if (!$row) {
            return null;
        }

        $refreshExpiresAt = strtotime($row['refresh_token_expires_at']);
        if ($refreshExpiresAt < time()) {
            return null; // Refresh token cũng hết hạn
        }

        // Rotate: revoke old, create new
        $db->update(
            "UPDATE api_tokens SET revoked_at = NOW() WHERE id = ?",
            [$row['id']]
        );

        return self::create(
            $row['user_id'],
            $row['platform'],
            $row['device_id'],
            $row['device_name']
        );
    }

    /**
     * Revoke all tokens của user
     */
    public static function revokeAll($userId) {
        $db = Database::getInstance();
        return $db->update(
            "UPDATE api_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL",
            [$userId]
        );
    }

    /**
     * Revoke token hiện tại (logout)
     */
    public static function revoke($token) {
        $db = Database::getInstance();
        return $db->update(
            "UPDATE api_tokens SET revoked_at = NOW() WHERE access_token = ? OR refresh_token = ?",
            [$token, $token]
        );
    }

    /**
     * Revoke all tokens của user trên 1 device cụ thể
     */
    public static function revokeDevice($userId, $deviceId) {
        $db = Database::getInstance();
        return $db->update(
            "UPDATE api_tokens SET revoked_at = NOW() WHERE user_id = ? AND device_id = ? AND revoked_at IS NULL",
            [$userId, $deviceId]
        );
    }

    /**
     * Update last_used timestamp
     */
    public static function touch($token) {
        $db = Database::getInstance();
        try {
            $db->update(
                "UPDATE api_tokens SET last_used_at = NOW() WHERE access_token = ?",
                [$token]
            );
        } catch (Exception $e) {}
    }

    /**
     * Kiểm tra rate limit cho action (login)
     */
    public static function checkRateLimit($action = 'login', $maxAttempts = 5, $windowMinutes = 15) {
        $db = Database::getInstance();
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

        $row = $db->fetch(
            "SELECT attempts, locked_until FROM rate_limits WHERE ip_address = ? AND action = ? ORDER BY updated_at DESC LIMIT 1",
            [$ip, $action]
        );

        if ($row && $row['locked_until']) {
            $lockedUntil = strtotime($row['locked_until']);
            if ($lockedUntil > time()) {
                $secondsLeft = $lockedUntil - time();
                return [
                    'allowed' => false,
                    'retry_after' => $secondsLeft,
                    'message' => "Too many attempts. Try again in {$secondsLeft} seconds.",
                ];
            }
        }

        if ($row && (int)$row['attempts'] >= $maxAttempts) {
            $db->update(
                "UPDATE rate_limits SET locked_until = NOW() + INTERVAL ? MINUTE WHERE ip_address = ? AND action = ?",
                [$windowMinutes, $ip, $action]
            );
            return [
                'allowed' => false,
                'retry_after' => $windowMinutes * 60,
                'message' => "Too many attempts. Locked for {$windowMinutes} minutes.",
            ];
        }

        return ['allowed' => true];
    }

    /**
     * Ghi attempt khi login fail
     */
    public static function recordFailedAttempt($action = 'login') {
        $db = Database::getInstance();
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

        $existing = $db->fetch(
            "SELECT id, attempts FROM rate_limits WHERE ip_address = ? AND action = ? AND locked_until IS NULL ORDER BY updated_at DESC LIMIT 1",
            [$ip, $action]
        );

        if ($existing) {
            $db->update(
                "UPDATE rate_limits SET attempts = attempts + 1, updated_at = NOW() WHERE id = ?",
                [$existing['id']]
            );
        } else {
            $db->insert(
                "INSERT INTO rate_limits (ip_address, action, attempts) VALUES (?, ?, 1)",
                [$ip, $action]
            );
        }
    }

    /**
     * Xóa rate limit record khi login success
     */
    public static function clearRateLimit($action = 'login') {
        $db = Database::getInstance();
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $db->delete(
            "DELETE FROM rate_limits WHERE ip_address = ? AND action = ?",
            [$ip, $action]
        );
    }

    /**
     * Lấy danh sách active sessions của user
     */
    public static function getActiveSessions($userId) {
        $db = Database::getInstance();
        $sessions = $db->fetchAll(
            "SELECT id, device_id, device_name, platform, last_used_at, created_at
             FROM api_tokens
             WHERE user_id = ? AND revoked_at IS NULL AND refresh_token_expires_at > NOW()
             ORDER BY last_used_at DESC",
            [$userId]
        );

        return array_map(function($s) {
            $s['last_used_at'] = $s['last_used_at'] ? date('c', strtotime($s['last_used_at'])) : null;
            $s['created_at']   = date('c', strtotime($s['created_at']));
            $s['is_current']  = ($s['last_used_at'] !== null);
            return $s;
        }, $sessions);
    }
}
