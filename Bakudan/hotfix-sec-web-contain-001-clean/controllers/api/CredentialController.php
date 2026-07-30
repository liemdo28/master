<?php
/**
 * CredentialController - API for Credential Management
 */
require_once __DIR__ . '/../../models/Credential.php';
require_once __DIR__ . '/../../service/EncryptionService.php';
require_once __DIR__ . '/../../service/CredentialAuditService.php';
require_once __DIR__ . '/../../service/CredentialPermissionService.php';

class CredentialController {
    private $credential;
    private $audit;
    private $permission;
    private $db;
    
    public function __construct() {
        $this->credential = new Credential();
        $this->audit = new CredentialAuditService();
        $this->permission = new CredentialPermissionService();
        $this->db = Database::getInstance();
    }
    
    /**
     * Get current user from session
     */
    private function getCurrentUser(): ?array {
        if (!function_exists('currentUser') || !isLoggedIn()) return null;
        return currentUser();
    }
    
    /**
     * Get client IP
     */
    private function getClientIp(): string {
        return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }
    
    /**
     * Get user agent
     */
    private function getUserAgent(): string {
        return $_SERVER['HTTP_USER_AGENT'] ?? '';
    }
    
    /**
     * JSON response helper
     */
    private function json(array $data, int $statusCode = 200): void {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
    
    /**
     * Require authentication
     */
    private function requireAuth(): array {
        $user = $this->getCurrentUser();
        if (!$user) {
            $this->json(['success' => false, 'error' => 'Unauthorized'], 401);
        }
        return $user;
    }
    
    /**
     * Require CEO/Admin role
     */
    private function requireAdmin(): array {
        $user = $this->requireAuth();
        if (!in_array($user['role'], ['ceo', 'admin'])) {
            $this->json(['success' => false, 'error' => 'Forbidden'], 403);
        }
        return $user;
    }
    
    /**
     * GET /api/credentials
     * List credentials (metadata only)
     */
    public function index(): void {
        $user = $this->requireAuth();
        
        $credentials = $this->credential->getAccessibleCredentials($user['id'], $user['role']);
        
        $this->json([
            'success' => true,
            'data' => $credentials,
            'count' => count($credentials)
        ]);
    }
    
    /**
     * GET /api/credentials/:id
     * Get single credential (metadata only)
     */
    public function show(int $id): void {
        $user = $this->requireAuth();
        
        $credential = $this->credential->findById($id, $user['id'], $user['role']);
        
        if (!$credential) {
            $this->json(['success' => false, 'error' => 'Credential not found or access denied'], 404);
        }
        
        // Include permissions if admin
        if (in_array($user['role'], ['ceo', 'admin'])) {
            $credential['permissions'] = $this->permission->getForCredential($id);
        }
        
        $this->json([
            'success' => true,
            'data' => $credential
        ]);
    }
    
    /**
     * POST /api/credentials
     * Create credential (CEO/Admin only)
     */
    public function store(): void {
        $user = $this->requireAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['service_name'])) {
            $this->json(['success' => false, 'error' => 'Service name is required'], 400);
        }
        
        try {
            $id = $this->credential->create($data, $user['id']);
            
            // Grant full access to creator
            $this->permission->grant($id, $user['id'], $user['id'], [
                'can_view_metadata' => true,
                'can_view_password' => true,
                'can_edit' => true,
                'can_rotate_password' => true,
                'can_grant_access' => true,
                'can_delete' => true
            ], $this->getClientIp(), $this->getUserAgent());
            
            // Audit log
            $this->audit->log($user['id'], CredentialAuditService::ACTION_CREATED, $id, [
                'service_name' => $data['service_name'],
                'has_password' => !empty($data['password'])
            ], $this->getClientIp(), $this->getUserAgent());
            
            $this->json([
                'success' => true,
                'data' => ['id' => $id],
                'message' => 'Credential created successfully'
            ], 201);
            
        } catch (Exception $e) {
            $this->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }
    
    /**
     * PATCH /api/credentials/:id
     * Update credential
     */
    public function update(int $id): void {
        $user = $this->requireAuth();
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Check permission
        if (!in_array($user['role'], ['ceo', 'admin'])) {
            if (!$this->permission->can($user['id'], $user['role'], $id, 'edit')) {
                $this->json(['success' => false, 'error' => 'Permission denied'], 403);
            }
        }
        
        $wasPasswordChanged = !empty($data['password']);
        
        try {
            $this->credential->update($id, $data, $user['id']);
            
            // Audit log
            $auditAction = $wasPasswordChanged 
                ? CredentialAuditService::ACTION_PASSWORD_CHANGED 
                : CredentialAuditService::ACTION_UPDATED;
            
            $this->audit->log($user['id'], $auditAction, $id, [
                'updated_fields' => array_keys($data),
                'password_changed' => $wasPasswordChanged
            ], $this->getClientIp(), $this->getUserAgent());
            
            $this->json([
                'success' => true,
                'message' => 'Credential updated successfully'
            ]);
            
        } catch (Exception $e) {
            $this->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }
    
    /**
     * DELETE /api/credentials/:id
     * Delete credential (soft delete)
     */
    public function destroy(int $id): void {
        $user = $this->requireAuth();
        
        // Check permission
        if (!in_array($user['role'], ['ceo', 'admin'])) {
            if (!$this->permission->can($user['id'], $user['role'], $id, 'delete')) {
                $this->json(['success' => false, 'error' => 'Permission denied'], 403);
            }
        }
        
        $this->credential->delete($id, $user['id']);
        
        $this->audit->log($user['id'], CredentialAuditService::ACTION_DELETED, $id, [
            'deleted_by' => $user['name'] ?? $user['id']
        ], $this->getClientIp(), $this->getUserAgent());
        
        $this->json([
            'success' => true,
            'message' => 'Credential deleted successfully'
        ]);
    }
    
    /**
     * POST /api/credentials/:id/view-password
     * View decrypted password (requires permission, logged)
     */
    public function viewPassword(int $id): void {
        $user = $this->requireAuth();
        
        // Check permission
        if (!in_array($user['role'], ['ceo', 'admin'])) {
            if (!$this->permission->can($user['id'], $user['role'], $id, 'view_password')) {
                $this->audit->log($user['id'], CredentialAuditService::ACTION_PASSWORD_VIEWED, $id, [
                    'success' => false,
                    'reason' => 'permission_denied'
                ], $this->getClientIp(), $this->getUserAgent(), false);
                
                $this->json(['success' => false, 'error' => 'Permission denied'], 403);
            }
        }
        
        $password = $this->credential->getDecryptedPassword($id, $user['id'], $user['role']);
        
        if ($password === null) {
            $this->json(['success' => false, 'error' => 'Password not available'], 404);
        }
        
        // Audit log (success)
        $this->audit->log($user['id'], CredentialAuditService::ACTION_PASSWORD_VIEWED, $id, [
            'action' => 'viewed'
        ], $this->getClientIp(), $this->getUserAgent());
        
        $this->json([
            'success' => true,
            'data' => [
                'password' => $password,
                'warning' => 'This action has been logged. Auto-hide in 30 seconds.'
            ]
        ]);
    }
    
    /**
     * POST /api/credentials/:id/grant-access
     * Grant permission to user
     */
    public function grantAccess(int $id): void {
        $user = $this->requireAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['user_id'])) {
            $this->json(['success' => false, 'error' => 'user_id is required'], 400);
        }
        
        $this->permission->grant(
            $id,
            $data['user_id'],
            $user['id'],
            $data['permissions'] ?? [],
            $this->getClientIp(),
            $this->getUserAgent()
        );
        
        $this->json([
            'success' => true,
            'message' => 'Access granted successfully'
        ]);
    }
    
    /**
     * POST /api/credentials/:id/revoke-access
     * Revoke user's permission
     */
    public function revokeAccess(int $id): void {
        $user = $this->requireAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['user_id'])) {
            $this->json(['success' => false, 'error' => 'user_id is required'], 400);
        }
        
        $this->permission->revoke(
            $id,
            $data['user_id'],
            $user['id'],
            $this->getClientIp(),
            $this->getUserAgent()
        );
        
        $this->json([
            'success' => true,
            'message' => 'Access revoked successfully'
        ]);
    }
    
    /**
     * GET /api/credentials/rotation/stats
     * Get rotation statistics
     */
    public function rotationStats(): void {
        $user = $this->requireAuth();
        
        $this->json([
            'success' => true,
            'data' => $this->credential->getRotationStats()
        ]);
    }
    
    /**
     * GET /api/credentials/rotation/due
     * Get credentials due for rotation
     */
    public function rotationDue(): void {
        $user = $this->requireAuth();
        
        $days = isset($_GET['days']) ? (int)$_GET['days'] : 30;
        
        $this->json([
            'success' => true,
            'data' => $this->credential->getRotationDue($days)
        ]);
    }
    
    /**
     * POST /api/credentials/:id/rotate
     * Mark rotation as complete (update password in vault)
     */
    public function completeRotation(int $id): void {
        $user = $this->requireAuth();
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Check permission
        if (!in_array($user['role'], ['ceo', 'admin'])) {
            if (!$this->permission->can($user['id'], $user['role'], $id, 'rotate_password')) {
                $this->json(['success' => false, 'error' => 'Permission denied'], 403);
            }
        }
        
        if (empty($data['password'])) {
            $this->json(['success' => false, 'error' => 'New password is required'], 400);
        }
        
        try {
            $this->credential->update($id, [
                'password' => $data['password'],
                'rotation_frequency_days' => $data['rotation_frequency_days'] ?? null
            ], $user['id']);
            
            $this->audit->log($user['id'], CredentialAuditService::ACTION_ROTATION_COMPLETED, $id, [
                'new_password_set' => true
            ], $this->getClientIp(), $this->getUserAgent());
            
            $this->json([
                'success' => true,
                'message' => 'Password rotation completed'
            ]);
            
        } catch (Exception $e) {
            $this->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }
    
    /**
     * GET /api/credentials/audit
     * Get audit logs (admin only)
     */
    public function audit(): void {
        $user = $this->requireAdmin();
        
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        
        $logs = $this->audit->getAll($limit, $offset);
        $stats = $this->audit->getStats();
        
        $this->json([
            'success' => true,
            'data' => $logs,
            'stats' => $stats
        ]);
    }
    
    /**
     * GET /api/credentials/:id/audit
     * Get audit logs for credential
     */
    public function credentialAudit(int $id): void {
        $user = $this->requireAuth();
        
        $logs = $this->audit->getForCredential($id);
        
        $this->json([
            'success' => true,
            'data' => $logs
        ]);
    }
}
