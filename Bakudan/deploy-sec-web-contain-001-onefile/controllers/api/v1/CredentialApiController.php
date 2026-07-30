<?php
/**
 * API v1 - Credential Management Endpoints
 *
 * Security-first credential vault APIs.
 * - Metadata and password access separated by permission
 * - Passwords never returned in list/detail endpoints
 * - Password view is one-time and audited
 * - All responses JSON only
 */
require_once __DIR__ . '/ApiController.php';
require_once __DIR__ . '/../../../models/Credential.php';
require_once __DIR__ . '/../../../service/EncryptionService.php';
require_once __DIR__ . '/../../../service/CredentialAuditService.php';
require_once __DIR__ . '/../../../service/CredentialPermissionService.php';

class CredentialApiController extends ApiController {
    private $credentialModel;
    private $permissionService;
    private $auditService;

    public function __construct() {
        parent::__construct();
        $this->credentialModel = new Credential();
        $this->permissionService = new CredentialPermissionService();
        $this->auditService = new CredentialAuditService();
    }

    private function requireCredentialAdmin() {
        $this->requireAuth();
        if (!in_array($this->user['role'] ?? '', ['ceo', 'admin'], true)) {
            api_error('Admin or CEO access required', 403);
        }
    }

    private function requireCredentialPermission(int $credentialId, string $permission) {
        $this->requireAuth();

        if (in_array($this->user['role'] ?? '', ['ceo', 'admin'], true)) {
            return true;
        }

        if (!$this->permissionService->can($this->userId, (string)($this->user['role'] ?? ''), $credentialId, $permission)) {
            api_error('Permission denied', 403);
        }

        return true;
    }

    private function sanitizeCredential(array $credential): array {
        unset($credential['encrypted_password'], $credential['encryption_iv'], $credential['encryption_tag']);
        return $credential;
    }

    private function buildRotationStatus(array $credential): string {
        if (empty($credential['rotation_frequency_days']) || empty($credential['next_rotation_due_at'])) {
            return 'no_rotation_policy';
        }

        $dueTs = strtotime((string)$credential['next_rotation_due_at']);
        if (!$dueTs) {
            return 'unknown';
        }

        $now = time();
        if ($dueTs < $now) {
            return 'overdue';
        }
        if ($dueTs <= strtotime('+7 days', $now)) {
            return 'due_soon';
        }
        return 'healthy';
    }

    public function index() {
        $this->requireAuth();

        $items = $this->credentialModel->getAccessibleCredentials($this->userId, (string)($this->user['role'] ?? 'member'));
        $items = array_map(function ($credential) {
            $credential = $this->sanitizeCredential($credential);
            $credential['rotation_status'] = $this->buildRotationStatus($credential);
            return $credential;
        }, $items);

        api_response([
            'credentials' => $items,
            'count' => count($items),
        ], 'OK', 200);
    }

    public function show($id) {
        $this->requireAuth();

        $credential = $this->credentialModel->findById((int)$id, $this->userId, (string)($this->user['role'] ?? 'member'));
        if (!$credential) {
            api_error('Credential not found', 404);
        }

        $credential = $this->sanitizeCredential($credential);
        $credential['rotation_status'] = $this->buildRotationStatus($credential);

        if (in_array($this->user['role'] ?? '', ['ceo', 'admin'], true)) {
            $credential['permissions'] = $this->permissionService->getForCredential((int)$id);
        }

        api_response(['credential' => $credential], 'OK', 200);
    }

    public function store() {
        $this->requireCredentialAdmin();
        $body = $this->getJsonInput();

        $this->validateRequired($body, ['service_name']);

        try {
            $credentialId = $this->credentialModel->create($body, $this->userId);

            $this->permissionService->grant((int)$credentialId, $this->userId, $this->userId, [
                'can_view_metadata' => true,
                'can_view_password' => true,
                'can_edit' => true,
                'can_rotate_password' => true,
                'can_grant_access' => true,
                'can_delete' => true,
            ], $_SERVER['REMOTE_ADDR'] ?? null, $_SERVER['HTTP_USER_AGENT'] ?? null);

            $this->auditService->log(
                $this->userId,
                CredentialAuditService::ACTION_CREATED,
                (int)$credentialId,
                [
                    'service_name' => $body['service_name'] ?? null,
                    'owner_user_id' => $body['owner_user_id'] ?? null,
                    'rotation_frequency_days' => $body['rotation_frequency_days'] ?? null,
                    'has_password' => !empty($body['password']),
                ],
                $_SERVER['REMOTE_ADDR'] ?? null,
                $_SERVER['HTTP_USER_AGENT'] ?? null,
                true
            );

            api_response([
                'credential_id' => (int)$credentialId,
            ], 'Credential created', 201);
        } catch (Exception $e) {
            api_error('Failed to create credential', 500, ['exception' => [$e->getMessage()]]);
        }
    }

    public function update($id) {
        $credentialId = (int)$id;
        $this->requireCredentialPermission($credentialId, 'edit');
        $body = $this->getJsonInput();

        try {
            $updated = $this->credentialModel->update($credentialId, $body, $this->userId);
            if (!$updated) {
                api_error('No changes applied', 422);
            }

            $action = !empty($body['password'])
                ? CredentialAuditService::ACTION_PASSWORD_CHANGED
                : CredentialAuditService::ACTION_UPDATED;

            $this->auditService->log(
                $this->userId,
                $action,
                $credentialId,
                [
                    'updated_fields' => array_keys($body),
                    'password_changed' => !empty($body['password']),
                ],
                $_SERVER['REMOTE_ADDR'] ?? null,
                $_SERVER['HTTP_USER_AGENT'] ?? null,
                true
            );

            api_response(['updated' => true], 'Credential updated', 200);
        } catch (Exception $e) {
            api_error('Failed to update credential', 500, ['exception' => [$e->getMessage()]]);
        }
    }

    public function destroy($id) {
        $credentialId = (int)$id;
        $this->requireCredentialPermission($credentialId, 'delete');

        $deleted = $this->credentialModel->delete($credentialId, $this->userId);
        if (!$deleted) {
            api_error('Credential not found or already deleted', 404);
        }

        $this->auditService->log(
            $this->userId,
            CredentialAuditService::ACTION_DELETED,
            $credentialId,
            ['soft_delete' => true],
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null,
            true
        );

        api_response(['deleted' => true], 'Credential deleted', 200);
    }

    public function viewPassword($id) {
        $credentialId = (int)$id;
        $this->requireCredentialPermission($credentialId, 'view_password');

        $body = $this->getJsonInput();
        if (empty($body['confirmed'])) {
            api_error('Password view confirmation required', 422, ['confirmed' => ['Confirmation is required']]);
        }

        $password = $this->credentialModel->getDecryptedPassword($credentialId, $this->userId, (string)($this->user['role'] ?? 'member'));
        if ($password === null) {
            $this->auditService->log(
                $this->userId,
                CredentialAuditService::ACTION_PASSWORD_VIEWED,
                $credentialId,
                ['reason' => 'password_unavailable'],
                $_SERVER['REMOTE_ADDR'] ?? null,
                $_SERVER['HTTP_USER_AGENT'] ?? null,
                false
            );
            api_error('Password not available', 404);
        }

        $this->auditService->log(
            $this->userId,
            CredentialAuditService::ACTION_PASSWORD_VIEWED,
            $credentialId,
            [
                'one_time' => true,
                'auto_hide_seconds' => 30,
            ],
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null,
            true
        );

        api_response([
            'password' => $password,
            'auto_hide_seconds' => 30,
            'warning' => 'This action was logged.',
        ], 'Password revealed', 200);
    }

    public function grantAccess($id) {
        $credentialId = (int)$id;
        $this->requireAuth();

        $isPrivileged = in_array($this->user['role'] ?? '', ['ceo', 'admin'], true);
        $canGrant = $isPrivileged || $this->permissionService->can($this->userId, (string)($this->user['role'] ?? ''), $credentialId, 'grant_access');
        if (!$canGrant) {
            api_error('Permission denied', 403);
        }

        $body = $this->getJsonInput();
        $this->validateRequired($body, ['user_id']);

        $permissionId = $this->permissionService->grant(
            $credentialId,
            (int)$body['user_id'],
            $this->userId,
            $body['permissions'] ?? [],
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null
        );

        api_response(['permission_id' => (int)$permissionId], 'Access granted', 200);
    }

    public function revokeAccess($id) {
        $credentialId = (int)$id;
        $this->requireAuth();

        $isPrivileged = in_array($this->user['role'] ?? '', ['ceo', 'admin'], true);
        $canGrant = $isPrivileged || $this->permissionService->can($this->userId, (string)($this->user['role'] ?? ''), $credentialId, 'grant_access');
        if (!$canGrant) {
            api_error('Permission denied', 403);
        }

        $body = $this->getJsonInput();
        $this->validateRequired($body, ['user_id']);

        $ok = $this->permissionService->revoke(
            $credentialId,
            (int)$body['user_id'],
            $this->userId,
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null
        );

        if (!$ok) {
            api_error('Permission not found', 404);
        }

        api_response(['revoked' => true], 'Access revoked', 200);
    }

    public function rotationStats() {
        $this->requireAuth();
        api_response($this->credentialModel->getRotationStats(), 'OK', 200);
    }

    public function rotationDue() {
        $this->requireAuth();
        $days = max(1, $this->safeInt($_GET['days'] ?? 30, 30));
        $items = $this->credentialModel->getRotationDue($days);
        $items = array_map(function ($credential) {
            $credential = $this->sanitizeCredential($credential);
            $credential['rotation_status'] = $this->buildRotationStatus($credential);
            return $credential;
        }, $items);

        api_response([
            'days' => $days,
            'credentials' => $items,
        ], 'OK', 200);
    }

    public function createRotationTask($id) {
        $credentialId = (int)$id;
        $this->requireCredentialPermission($credentialId, 'rotate_password');

        $credential = $this->credentialModel->findById($credentialId, $this->userId, (string)($this->user['role'] ?? 'member'));
        if (!$credential) {
            api_error('Credential not found', 404);
        }

        $taskTitle = 'Change ' . ($credential['service_name'] ?? 'credential') . ' password';
        $dueAt = $credential['next_rotation_due_at'] ?? date('Y-m-d H:i:s', strtotime('+7 days'));

        $this->db->execute(
            "INSERT INTO credential_rotation_tasks (credential_id, task_id, status, due_at, created_at, updated_at)
             VALUES (?, NULL, 'pending', ?, NOW(), NOW())",
            [$credentialId, $dueAt]
        );
        $rotationTaskId = (int)$this->db->lastInsertId();

        $this->auditService->log(
            $this->userId,
            CredentialAuditService::ACTION_ROTATION_TASK_CREATED,
            $credentialId,
            [
                'rotation_task_id' => $rotationTaskId,
                'title' => $taskTitle,
                'due_at' => $dueAt,
                'checklist' => [
                    'Verify current access',
                    'Login to website',
                    'Change password',
                    'Update credential vault',
                    'Verify login with new password',
                    'Record completion note',
                    'Close task',
                ],
            ],
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null,
            true
        );

        api_response([
            'rotation_task_id' => $rotationTaskId,
            'title' => $taskTitle,
            'due_at' => $dueAt,
            'checklist' => [
                'Verify current access',
                'Login to website',
                'Change password',
                'Update credential vault',
                'Verify login with new password',
                'Record completion note',
                'Close task',
            ],
        ], 'Rotation task created', 201);
    }

    public function completeRotation($id) {
        $credentialId = (int)$id;
        $this->requireCredentialPermission($credentialId, 'rotate_password');
        $body = $this->getJsonInput();

        if (empty($body['vault_updated'])) {
            api_error('Vault update confirmation required before completing rotation', 422, [
                'vault_updated' => ['Set vault_updated=true or request admin override'],
            ]);
        }

        if (empty($body['password'])) {
            api_error('New password is required', 422, ['password' => ['Password is required']]);
        }

        try {
            $updateData = [
                'password' => (string)$body['password'],
            ];
            if (!empty($body['rotation_frequency_days'])) {
                $updateData['rotation_frequency_days'] = (int)$body['rotation_frequency_days'];
            }

            $this->credentialModel->update($credentialId, $updateData, $this->userId);

            $this->db->execute(
                "UPDATE credential_rotation_tasks
                 SET status = 'completed', completed_at = NOW(), password_was_updated = 1, updated_at = NOW()
                 WHERE credential_id = ? AND status IN ('pending', 'in_progress')",
                [$credentialId]
            );

            $this->auditService->log(
                $this->userId,
                CredentialAuditService::ACTION_ROTATION_COMPLETED,
                $credentialId,
                [
                    'vault_updated' => true,
                    'rotation_frequency_days' => $body['rotation_frequency_days'] ?? null,
                ],
                $_SERVER['REMOTE_ADDR'] ?? null,
                $_SERVER['HTTP_USER_AGENT'] ?? null,
                true
            );

            api_response(['completed' => true], 'Rotation completed', 200);
        } catch (Exception $e) {
            api_error('Failed to complete rotation', 500, ['exception' => [$e->getMessage()]]);
        }
    }

    public function audit() {
        $this->requireCredentialAdmin();

        $limit = min(500, max(1, $this->safeInt($_GET['limit'] ?? 100, 100)));
        $offset = max(0, $this->safeInt($_GET['offset'] ?? 0, 0));

        api_response([
            'logs' => $this->auditService->getAll($limit, $offset),
            'stats' => $this->auditService->getStats(),
        ], 'OK', 200);
    }

    public function credentialAudit($id) {
        $credentialId = (int)$id;
        $this->requireAuth();

        $credential = $this->credentialModel->findById($credentialId, $this->userId, (string)($this->user['role'] ?? 'member'));
        if (!$credential && !in_array($this->user['role'] ?? '', ['ceo', 'admin'], true)) {
            api_error('Credential not found', 404);
        }

        api_response([
            'logs' => $this->auditService->getForCredential($credentialId),
        ], 'OK', 200);
    }
}
