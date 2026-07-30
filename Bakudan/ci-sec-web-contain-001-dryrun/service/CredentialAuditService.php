<?php
/**
 * CredentialAuditService - Audit Logging for Credential Actions
 * 
 * Logs all sensitive actions for compliance and security
 */
class CredentialAuditService {
    private $db;
    
    // Action types
    const ACTION_CREATED = 'credential_created';
    const ACTION_UPDATED = 'credential_updated';
    const ACTION_PASSWORD_VIEWED = 'password_viewed';
    const ACTION_PASSWORD_COPIED = 'password_copied';
    const ACTION_PASSWORD_CHANGED = 'password_changed';
    const ACTION_ACCESS_GRANTED = 'access_granted';
    const ACTION_ACCESS_REVOKED = 'access_revoked';
    const ACTION_ACCESS_UPDATED = 'access_updated';
    const ACTION_DELETED = 'credential_deleted';
    const ACTION_ROTATION_TASK_CREATED = 'rotation_task_created';
    const ACTION_ROTATION_COMPLETED = 'rotation_completed';
    const ACTION_ROTATION_CANCELLED = 'rotation_task_cancelled';
    
    public function __construct() {
        $this->db = Database::getInstance();
    }
    
    /**
     * Log an audit event
     */
    public function log(
        int $actorUserId,
        string $action,
        ?int $credentialId = null,
        array $details = [],
        ?string $ipAddress = null,
        ?string $userAgent = null,
        bool $success = true
    ): int {
        $sql = "INSERT INTO credential_audit_logs 
                (credential_id, actor_user_id, action, details_json, ip_address, user_agent, success)
                VALUES (?, ?, ?, ?, ?, ?, ?)";
        
        return (int)$this->db->insert($sql, [
            $credentialId,
            $actorUserId,
            $action,
            json_encode($details),
            $ipAddress,
            substr($userAgent ?? '', 0, 512),
            $success ? 1 : 0
        ]);
    }
    
    /**
     * Get audit logs for a credential
     */
    public function getForCredential(int $credentialId, int $limit = 100): array {
        return $this->db->fetchAll(
            "SELECT cal.*, u.name as actor_name, u.email as actor_email
             FROM credential_audit_logs cal
             LEFT JOIN users u ON cal.actor_user_id = u.id
             WHERE cal.credential_id = ?
             ORDER BY cal.created_at DESC
             LIMIT ?",
            [$credentialId, $limit]
        );
    }
    
    /**
     * Get audit logs for a user (what they've done)
     */
    public function getForUser(int $userId, int $limit = 100): array {
        return $this->db->fetchAll(
            "SELECT cal.*, u.name as actor_name
             FROM credential_audit_logs cal
             LEFT JOIN users u ON cal.actor_user_id = u.id
             WHERE cal.actor_user_id = ?
             ORDER BY cal.created_at DESC
             LIMIT ?",
            [$userId, $limit]
        );
    }
    
    /**
     * Get all audit logs (admin only)
     */
    public function getAll(int $limit = 500, int $offset = 0): array {
        return $this->db->fetchAll(
            "SELECT cal.*, u.name as actor_name, c.service_name as credential_name
             FROM credential_audit_logs cal
             LEFT JOIN users u ON cal.actor_user_id = u.id
             LEFT JOIN credentials c ON cal.credential_id = c.id
             ORDER BY cal.created_at DESC
             LIMIT ? OFFSET ?",
            [$limit, $offset]
        );
    }
    
    /**
     * Get audit logs by action type
     */
    public function getByAction(string $action, int $limit = 100): array {
        return $this->db->fetchAll(
            "SELECT cal.*, u.name as actor_name, c.service_name as credential_name
             FROM credential_audit_logs cal
             LEFT JOIN users u ON cal.actor_user_id = u.id
             LEFT JOIN credentials c ON cal.credential_id = c.id
             WHERE cal.action = ?
             ORDER BY cal.created_at DESC
             LIMIT ?",
            [$action, $limit]
        );
    }
    
    /**
     * Get password viewing events (security sensitive)
     */
    public function getPasswordViews(int $limit = 100): array {
        return $this->db->fetchAll(
            "SELECT cal.*, u.name as actor_name, c.service_name as credential_name
             FROM credential_audit_logs cal
             LEFT JOIN users u ON cal.actor_user_id = u.id
             LEFT JOIN credentials c ON cal.credential_id = c.id
             WHERE cal.action IN ('password_viewed', 'password_copied')
             ORDER BY cal.created_at DESC
             LIMIT ?",
            [$limit]
        );
    }
    
    /**
     * Get audit statistics
     */
    public function getStats(int $days = 30): array {
        $startDate = date('Y-m-d H:i:s', strtotime("-{$days} days"));
        
        return [
            'total_events' => $this->db->fetchColumn(
                "SELECT COUNT(*) FROM credential_audit_logs WHERE created_at >= ?",
                [$startDate]
            ),
            'password_views' => $this->db->fetchColumn(
                "SELECT COUNT(*) FROM credential_audit_logs WHERE action = 'password_viewed' AND created_at >= ?",
                [$startDate]
            ),
            'password_copies' => $this->db->fetchColumn(
                "SELECT COUNT(*) FROM credential_audit_logs WHERE action = 'password_copied' AND created_at >= ?",
                [$startDate]
            ),
            'credentials_created' => $this->db->fetchColumn(
                "SELECT COUNT(*) FROM credential_audit_logs WHERE action = 'credential_created' AND created_at >= ?",
                [$startDate]
            ),
            'access_grants' => $this->db->fetchColumn(
                "SELECT COUNT(*) FROM credential_audit_logs WHERE action = 'access_granted' AND created_at >= ?",
                [$startDate]
            ),
            'failed_actions' => $this->db->fetchColumn(
                "SELECT COUNT(*) FROM credential_audit_logs WHERE success = 0 AND created_at >= ?",
                [$startDate]
            )
        ];
    }
}
