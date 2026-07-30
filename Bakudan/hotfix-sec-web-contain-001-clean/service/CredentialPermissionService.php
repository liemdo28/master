<?php
/**
 * CredentialPermissionService - Permission Management
 * 
 * Handles access control for credentials
 */
class CredentialPermissionService {
    private $db;
    
    public function __construct() {
        $this->db = Database::getInstance();
    }
    
    /**
     * Check if user can perform action on credential
     */
    public function can(int $userId, string $role, int $credentialId, string $permission): bool {
        // CEO/Admin can do everything
        if (in_array($role, ['ceo', 'admin'])) {
            return true;
        }
        
        $permissionMap = [
            'view_metadata' => 'can_view_metadata',
            'view_password' => 'can_view_password',
            'edit' => 'can_edit',
            'rotate_password' => 'can_rotate_password',
            'grant_access' => 'can_grant_access',
            'delete' => 'can_delete'
        ];
        
        $dbField = $permissionMap[$permission] ?? $permission;
        
        $result = $this->db->fetch(
            "SELECT {$dbField} FROM credential_permissions
             WHERE credential_id = ? AND user_id = ? AND revoked_at IS NULL",
            [$credentialId, $userId]
        );
        
        return $result && $result[$dbField];
    }
    
    /**
     * Grant permission to user
     */
    public function grant(
        int $credentialId,
        int $userId,
        int $grantedBy,
        array $permissions = [],
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): int {
        // Build permission values
        $perm = [
            'can_view_metadata' => !empty($permissions['can_view_metadata']),
            'can_view_password' => !empty($permissions['can_view_password']),
            'can_edit' => !empty($permissions['can_edit']),
            'can_rotate_password' => !empty($permissions['can_rotate_password']),
            'can_grant_access' => !empty($permissions['can_grant_access']),
            'can_delete' => !empty($permissions['can_delete'])
        ];
        
        // Upsert permission
        $existing = $this->db->fetch(
            "SELECT id FROM credential_permissions WHERE credential_id = ? AND user_id = ?",
            [$credentialId, $userId]
        );
        
        if ($existing) {
            // Update existing (revoke previous, create new)
            $this->db->execute(
                "UPDATE credential_permissions SET revoked_at = NOW() WHERE credential_id = ? AND user_id = ?",
                [$credentialId, $userId]
            );
        }
        
        $permissionId = (int)$this->db->insert(
            "INSERT INTO credential_permissions (
                credential_id, user_id, can_view_metadata, can_view_password,
                can_edit, can_rotate_password, can_grant_access, can_delete,
                granted_by, granted_at, revoked_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NULL)",
            [
                $credentialId, $userId,
                $perm['can_view_metadata'] ? 1 : 0,
                $perm['can_view_password'] ? 1 : 0,
                $perm['can_edit'] ? 1 : 0,
                $perm['can_rotate_password'] ? 1 : 0,
                $perm['can_grant_access'] ? 1 : 0,
                $perm['can_delete'] ? 1 : 0,
                $grantedBy
            ]
        );
        
        // Log audit
        $audit = new CredentialAuditService();
        $audit->log(
            $grantedBy,
            CredentialAuditService::ACTION_ACCESS_GRANTED,
            $credentialId,
            [
                'granted_to_user_id' => $userId,
                'permissions' => $perm
            ],
            $ipAddress,
            $userAgent
        );
        
        return $permissionId;
    }
    
    /**
     * Revoke user's permission
     */
    public function revoke(
        int $credentialId,
        int $userId,
        int $revokedBy,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): bool {
        $rows = $this->db->execute(
            "UPDATE credential_permissions SET revoked_at = NOW()
             WHERE credential_id = ? AND user_id = ? AND revoked_at IS NULL",
            [$credentialId, $userId]
        );

        if ($rows > 0) {
            // Log audit
            $audit = new CredentialAuditService();
            $audit->log(
                $revokedBy,
                CredentialAuditService::ACTION_ACCESS_REVOKED,
                $credentialId,
                ['revoked_from_user_id' => $userId],
                $ipAddress,
                $userAgent
            );
            return true;
        }
        
        return false;
    }
    
    /**
     * Get permissions for a credential
     */
    public function getForCredential(int $credentialId): array {
        return $this->db->fetchAll(
            "SELECT cp.*, u.name as user_name, u.email as user_email, u.role as user_role,
                    gb.name as granted_by_name
             FROM credential_permissions cp
             LEFT JOIN users u ON cp.user_id = u.id
             LEFT JOIN users gb ON cp.granted_by = gb.id
             WHERE cp.credential_id = ?
             ORDER BY cp.granted_at DESC",
            [$credentialId]
        );
    }
    
    /**
     * Get user's permissions for a credential
     */
    public function getUserPermission(int $userId, int $credentialId): ?array {
        return $this->db->fetch(
            "SELECT * FROM credential_permissions
             WHERE user_id = ? AND credential_id = ? AND revoked_at IS NULL",
            [$userId, $credentialId]
        );
    }
    
    /**
     * Get all users with access to credential
     */
    public function getUsersWithAccess(int $credentialId): array {
        return $this->db->fetchAll(
            "SELECT cp.*, u.id as user_id, u.name, u.email, u.role
             FROM credential_permissions cp
             INNER JOIN users u ON cp.user_id = u.id
             WHERE cp.credential_id = ? AND cp.revoked_at IS NULL",
            [$credentialId]
        );
    }
}
