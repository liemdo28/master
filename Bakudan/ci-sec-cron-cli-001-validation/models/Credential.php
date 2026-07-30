<?php
/**
 * Credential Model - Secure Credential Management
 * 
 * Handles CRUD operations for credentials with encryption
 * Permission checking before any password access
 * Never returns passwords in list queries
 */
class Credential {
    private $db;
    
    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }
    
    private function ensureSchema(): void {
        if (defined('SKIP_SCHEMA_CHECKS') && SKIP_SCHEMA_CHECKS) return;

        if ($this->db->tableExists('credentials') && !$this->db->columnExists('credentials', 'credential_type')) {
            try {
                $this->db->execute(
                    "ALTER TABLE credentials ADD COLUMN credential_type ENUM('login','card','identity','link') NOT NULL DEFAULT 'login' AFTER service_name"
                );
                $this->db->invalidateSchemaCache('credentials');
            } catch (\Throwable $e) {
                error_log('[Credential::ensureSchema] add credential_type: ' . $e->getMessage());
            }
        }

        if (!$this->db->tableExists('credentials')) {
            $migFile = __DIR__ . '/../database/migrations/014_create_credentials_tables.sql';
            if (file_exists($migFile)) {
                try {
                    $sql = file_get_contents($migFile);
                    // Split on semicolons and run each statement
                    foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
                        if ($stmt && !str_starts_with($stmt, '--')) {
                            $this->db->getConnection()->exec($stmt);
                        }
                    }
                } catch (\Throwable $e) {
                    error_log('[Credential::ensureSchema] ' . $e->getMessage());
                }
            }
        }
    }
    
    /**
     * Get credentials user can see (metadata only - no passwords)
     * Combines owned + permission-granted credentials
     */
    public function getAccessibleCredentials(int $userId, string $userRole): array {
        // CEO/Admin sees all
        if (in_array($userRole, ['ceo', 'admin'])) {
            return $this->db->fetchAll(
                "SELECT c.*, u.name as owner_name, s.name as store_name,
                        NULL as encrypted_password, NULL as encryption_iv, NULL as encryption_tag
                 FROM credentials c
                 LEFT JOIN users u ON c.owner_user_id = u.id
                 LEFT JOIN stores s ON c.store_id = s.id
                 WHERE c.status != 'deleted' AND c.deleted_at IS NULL
                 ORDER BY c.service_name"
            );
        }
        
        // Others see only credentials they have permission for
        return $this->db->fetchAll(
            "SELECT c.*, u.name as owner_name, s.name as store_name,
                    NULL as encrypted_password, NULL as encryption_iv, NULL as encryption_tag
             FROM credentials c
             INNER JOIN credential_permissions cp ON c.id = cp.credential_id
             LEFT JOIN users u ON c.owner_user_id = u.id
             LEFT JOIN stores s ON c.store_id = s.id
             WHERE cp.user_id = ?
               AND c.status != 'deleted'
               AND c.deleted_at IS NULL
               AND cp.revoked_at IS NULL
               AND (cp.can_view_metadata = 1 OR cp.can_view_password = 1 OR cp.can_edit = 1)
             ORDER BY c.service_name",
            [$userId]
        );
    }
    
    /**
     * Get single credential (metadata only - no password)
     */
    public function findById(int $id, int $userId, string $userRole): ?array {
        $sql = "SELECT c.*, u.name as owner_name, s.name as store_name,
                       NULL as encrypted_password, NULL as encryption_iv, NULL as encryption_tag
                FROM credentials c
                LEFT JOIN users u ON c.owner_user_id = u.id
                LEFT JOIN stores s ON c.store_id = s.id
                WHERE c.id = ? AND c.status != 'deleted' AND c.deleted_at IS NULL";
        
        $params = [$id];
        
        // Non-admin must have permission
        if (!in_array($userRole, ['ceo', 'admin'])) {
            $sql .= " AND EXISTS (
                SELECT 1 FROM credential_permissions cp
                WHERE cp.credential_id = c.id
                  AND cp.user_id = ?
                  AND cp.revoked_at IS NULL
                  AND (cp.can_view_metadata = 1 OR cp.can_view_password = 1 OR cp.can_edit = 1)
            )";
            $params[] = $userId;
        }
        
        return $this->db->fetch($sql, $params);
    }
    
    /**
     * Get decrypted password (requires permission)
     */
    public function getDecryptedPassword(int $id, int $userId, string $userRole): ?string {
        $cred = $this->findById($id, $userId, $userRole);

        if (!$cred) {
            return null;
        }
        
        // Admin/CEO can always view
        if (!in_array($userRole, ['ceo', 'admin'])) {
            // Check permission
            $perm = $this->db->fetch(
                "SELECT * FROM credential_permissions
                 WHERE credential_id = ? AND user_id = ? AND revoked_at IS NULL
                 AND can_view_password = 1",
                [$id, $userId]
            );
            
            if (!$perm) {
                return null;
            }
        }

        $secret = $this->db->fetch(
            "SELECT encrypted_password, encryption_iv, encryption_tag
             FROM credentials
             WHERE id = ? AND status != 'deleted' AND deleted_at IS NULL",
            [$id]
        );

        if (!$secret || empty($secret['encrypted_password'])) {
            return null;
        }
        
        try {
            return EncryptionService::decrypt(
                $secret['encrypted_password'],
                $secret['encryption_iv'],
                $secret['encryption_tag']
            );
        } catch (Exception $e) {
            error_log("Password decryption failed for credential {$id}: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Create new credential
     */
    public function create(array $data, int $createdBy): int {
        $this->validateData($data);
        
        // Encrypt password if provided
        $encrypted = null;
        $iv = null;
        $tag = null;
        
        if (!empty($data['password'])) {
            $encryptedData = EncryptionService::encrypt($data['password']);
            $encrypted = $encryptedData['encrypted'];
            $iv = $encryptedData['iv'];
            $tag = $encryptedData['tag'];
        }
        
        // Calculate next rotation
        $lastChanged = !empty($data['last_changed_at']) 
            ? new DateTime($data['last_changed_at']) 
            : new DateTime();
        
        $nextRotation = null;
        if (!empty($data['rotation_frequency_days'])) {
            $nextRotation = EncryptionService::calculateNextRotation(
                (int)$data['rotation_frequency_days'],
                $lastChanged
            )->format('Y-m-d H:i:s');
        }
        
        $credType = in_array($data['credential_type'] ?? '', ['login','card','identity','link'])
            ? $data['credential_type'] : 'login';

        $sql = "INSERT INTO credentials (
            service_name, credential_type, website, login_url, username, email,
            encrypted_password, encryption_iv, encryption_tag,
            password_change_instructions, rotation_frequency_days,
            last_changed_at, next_rotation_due_at,
            owner_user_id, store_id, department,
            status, notes, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        return (int)$this->db->insert($sql, [
            $data['service_name'] ?? null,
            $credType,
            $data['website'] ?? null,
            $data['login_url'] ?? null,
            $data['username'] ?? null,
            $data['email'] ?? null,
            $encrypted,
            $iv,
            $tag,
            $data['password_change_instructions'] ?? null,
            $data['rotation_frequency_days'] ?? null,
            !empty($data['last_changed_at']) ? $data['last_changed_at'] : date('Y-m-d H:i:s'),
            $nextRotation,
            $data['owner_user_id'] ?? null,
            $data['store_id'] ?? null,
            $data['department'] ?? null,
            $data['status'] ?? 'active',
            $data['notes'] ?? null,
            $createdBy,
            $createdBy
        ]);
    }
    
    /**
     * Update credential
     */
    public function update(int $id, array $data, int $updatedBy): bool {
        $this->validateData($data, true);
        
        $updates = [];
        $params = [];
        
        $fields = ['service_name', 'credential_type', 'website', 'login_url', 'username', 'email',
                    'password_change_instructions', 'rotation_frequency_days',
                    'owner_user_id', 'store_id', 'department', 'status', 'notes'];
        
        foreach ($fields as $field) {
            if (array_key_exists($field, $data)) {
                $updates[] = "{$field} = ?";
                $params[] = $data[$field];
            }
        }
        
        // Handle password change
        if (!empty($data['password'])) {
            $encryptedData = EncryptionService::encrypt($data['password']);
            $updates[] = "encrypted_password = ?";
            $params[] = $encryptedData['encrypted'];
            $updates[] = "encryption_iv = ?";
            $params[] = $encryptedData['iv'];
            $updates[] = "encryption_tag = ?";
            $params[] = $encryptedData['tag'];
            $updates[] = "last_changed_at = NOW()";
            
            // Recalculate next rotation
            if (!empty($data['rotation_frequency_days'])) {
                $updates[] = "next_rotation_due_at = DATE_ADD(NOW(), INTERVAL ? DAY)";
                $params[] = (int)$data['rotation_frequency_days'];
            }
        }
        
        if (empty($updates)) {
            return false;
        }
        
        $updates[] = "updated_by = ?";
        $params[] = $updatedBy;
        $updates[] = "updated_at = NOW()";
        $params[] = $id;
        
        $sql = "UPDATE credentials SET " . implode(', ', $updates) . " WHERE id = ?";
        return $this->db->execute($sql, $params) > 0;
    }
    
    /**
     * Soft delete credential
     */
    public function delete(int $id, int $deletedBy): bool {
        $sql = "UPDATE credentials
                SET status = 'deleted', deleted_at = NOW(), updated_by = ?, updated_at = NOW()
                WHERE id = ?";
        return $this->db->execute($sql, [$deletedBy, $id]) > 0;
    }
    
    /**
     * Get credentials due for rotation
     */
    public function getRotationDue(int $withinDays = 7): array {
        return $this->db->fetchAll(
            "SELECT c.*, u.name as owner_name,
                    DATEDIFF(c.next_rotation_due_at, NOW()) as days_until_due
             FROM credentials c
             LEFT JOIN users u ON c.owner_user_id = u.id
             WHERE c.status = 'active'
               AND c.deleted_at IS NULL
               AND c.next_rotation_due_at IS NOT NULL
               AND c.next_rotation_due_at <= DATE_ADD(NOW(), INTERVAL ? DAY)
             ORDER BY c.next_rotation_due_at ASC",
            [$withinDays]
        );
    }
    
    /**
     * Get rotation statistics
     */
    public function getRotationStats(): array {
        return [
            'overdue' => $this->db->fetchColumn(
                "SELECT COUNT(*) FROM credentials WHERE status = 'active' AND next_rotation_due_at < NOW()"
            ),
            'due_7_days' => $this->db->fetchColumn(
                "SELECT COUNT(*) FROM credentials WHERE status = 'active' AND next_rotation_due_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)"
            ),
            'due_30_days' => $this->db->fetchColumn(
                "SELECT COUNT(*) FROM credentials WHERE status = 'active' AND next_rotation_due_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)"
            ),
            'healthy' => $this->db->fetchColumn(
                "SELECT COUNT(*) FROM credentials WHERE status = 'active' AND next_rotation_due_at > DATE_ADD(NOW(), INTERVAL 30 DAY)"
            ),
            'no_rotation' => $this->db->fetchColumn(
                "SELECT COUNT(*) FROM credentials WHERE status = 'active' AND next_rotation_due_at IS NULL"
            )
        ];
    }
    
    private function validateData(array $data, bool $isUpdate = false): void {
        if (!$isUpdate && empty($data['service_name'])) {
            throw new InvalidArgumentException('Service name is required');
        }
        
        if (!empty($data['rotation_frequency_days'])) {
            $validFrequencies = [30, 60, 90, 180, 365];
            if (!in_array((int)$data['rotation_frequency_days'], $validFrequencies)) {
                throw new InvalidArgumentException('Invalid rotation frequency');
            }
        }
        
        if (!empty($data['status'])) {
            $validStatuses = ['active', 'inactive', 'compromised'];
            if (!in_array($data['status'], $validStatuses)) {
                throw new InvalidArgumentException('Invalid status');
            }
        }
    }
}
