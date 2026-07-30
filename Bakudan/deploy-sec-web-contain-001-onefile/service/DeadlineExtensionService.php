<?php
class DeadlineExtensionService {
    private DeadlineExtension $model;
    private MonthlyExtensionUsage $usageModel;
    private DeadlineExtensionAuditLog $auditModel;
    private DeadlineExtensionPermissionService $permService;

    public function __construct() {
        $this->model       = new DeadlineExtension();
        $this->usageModel  = new MonthlyExtensionUsage();
        $this->auditModel  = new DeadlineExtensionAuditLog();
        $this->permService = new DeadlineExtensionPermissionService();
    }

    /**
     * Request a deadline extension.
     * Returns ['ok'=>true, 'extension_id'=>int, 'auto_approved'=>bool] or throws RuntimeException.
     */
    public function request(int $taskId, int $userId, string $requestedDue, string $reason, bool $isPriv): array {
        $db   = Database::getInstance();
        $task = $db->fetch("SELECT * FROM tasks WHERE id=?", [$taskId]);
        if (!$task) throw new \RuntimeException('Task not found.');

        if (!$this->permService->canRequest($task, $userId, $isPriv)) {
            throw new \RuntimeException('You do not have permission to extend this task.');
        }

        $originalDue = $task['due_date'] ?? '';
        if (!$originalDue) throw new \RuntimeException('Task has no due date.');

        $today = function_exists('app_today') ? app_today() : date('Y-m-d');
        if ($requestedDue <= $originalDue) {
            throw new \RuntimeException('New due date must be after the current due date.');
        }
        if ($requestedDue < $today) {
            throw new \RuntimeException('New due date cannot be in the past.');
        }

        $days = (int)((strtotime($requestedDue) - strtotime($originalDue)) / 86400);
        if ($days > 14) throw new \RuntimeException('Extension cannot exceed 14 days.');
        if ($days < 1)  throw new \RuntimeException('Extension must be at least 1 day.');

        // Block if already pending
        if ($this->model->hasPendingForTask($taskId)) {
            throw new \RuntimeException('There is already a pending extension request for this task.');
        }

        // Determine auto-approve logic
        $autoApprove = false;
        $status      = 'pending';

        if (!$isPriv) {
            $isSelfApprovable = $this->permService->isSelfApprovable($task, $requestedDue, $userId, $isPriv);
            $remaining        = $this->usageModel->getRemainingQuota($userId);

            if ($isSelfApprovable && $remaining > 0) {
                $autoApprove = true;
                $status      = 'auto_approved';
            }
        }

        $extId = $this->model->create([
            'task_id'            => $taskId,
            'requested_by'       => $userId,
            'original_due_date'  => $originalDue,
            'requested_due_date' => $requestedDue,
            'extension_days'     => $days,
            'reason'             => $reason,
            'status'             => $status,
            'auto_approved'      => $autoApprove ? 1 : 0,
        ]);

        $this->auditModel->log([
            'extension_id' => $extId,
            'task_id'      => $taskId,
            'actor_id'     => $userId,
            'action'       => $autoApprove ? 'auto_approved' : 'created',
            'old_status'   => null,
            'new_status'   => $status,
            'note'         => $reason,
        ]);

        if ($autoApprove) {
            // Apply extension immediately
            $this->applyExtension($extId, $taskId, $requestedDue, $userId);
            $this->usageModel->increment($userId);
        }

        return ['ok' => true, 'extension_id' => $extId, 'auto_approved' => $autoApprove, 'status' => $status];
    }

    /**
     * Admin/manager approves a pending extension.
     */
    public function approve(int $extensionId, int $reviewerId, string $note = ''): array {
        $ext = $this->model->findById($extensionId);
        if (!$ext) throw new \RuntimeException('Extension not found.');
        if ($ext['status'] !== 'pending') throw new \RuntimeException('Extension is not pending.');

        $this->model->updateStatus($extensionId, 'approved', $reviewerId, $note);

        $this->auditModel->log([
            'extension_id' => $extensionId,
            'task_id'      => $ext['task_id'],
            'actor_id'     => $reviewerId,
            'action'       => 'approved',
            'old_status'   => 'pending',
            'new_status'   => 'approved',
            'note'         => $note,
        ]);

        // Apply the extension to the task
        $this->applyExtension($extensionId, (int)$ext['task_id'], $ext['requested_due_date'], $reviewerId);

        // Consume quota for requester
        $this->usageModel->increment((int)$ext['requested_by']);

        return ['ok' => true, 'extension_id' => $extensionId];
    }

    /**
     * Admin/manager rejects a pending extension.
     */
    public function reject(int $extensionId, int $reviewerId, string $note = ''): array {
        $ext = $this->model->findById($extensionId);
        if (!$ext) throw new \RuntimeException('Extension not found.');
        if ($ext['status'] !== 'pending') throw new \RuntimeException('Extension is not pending.');

        $this->model->updateStatus($extensionId, 'rejected', $reviewerId, $note);

        $this->auditModel->log([
            'extension_id' => $extensionId,
            'task_id'      => $ext['task_id'],
            'actor_id'     => $reviewerId,
            'action'       => 'rejected',
            'old_status'   => 'pending',
            'new_status'   => 'rejected',
            'note'         => $note,
        ]);

        return ['ok' => true, 'extension_id' => $extensionId];
    }

    /**
     * Apply extension: update task due_date.
     */
    private function applyExtension(int $extensionId, int $taskId, string $newDue, int $actorId): void {
        $db = Database::getInstance();
        $db->execute("UPDATE tasks SET due_date=? WHERE id=?", [$newDue, $taskId]);
    }

    public function getExtensionsForTask(int $taskId): array {
        return $this->model->getByTask($taskId);
    }

    public function getQuotaStatus(int $userId): array {
        $ym        = date('Y-m');
        $usage     = $this->usageModel->getOrCreate($userId, $ym);
        $used      = (int)$usage['used_count'];
        $quota     = (int)$usage['quota'];
        $remaining = max(0, $quota - $used);
        return ['used' => $used, 'quota' => $quota, 'remaining' => $remaining, 'year_month' => $ym];
    }
}
