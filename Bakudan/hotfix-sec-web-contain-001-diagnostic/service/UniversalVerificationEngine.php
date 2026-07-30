<?php
/**
 * UniversalVerificationEngine
 *
 * Generic verification workflow engine for tasks, bills, payments, payroll,
 * forms, audits, and checklists. The engine is intentionally object-agnostic:
 * every runtime record is addressed as (object_type, object_id).
 */
class UniversalVerificationEngine
{
    public const OBJECT_TYPES = ['task', 'bill', 'payment', 'payroll', 'form', 'audit', 'checklist'];
    public const STATUSES = [
        'open',
        'in_progress',
        'submitted',
        'pending_verification',
        'verification_in_progress',
        'verification_rejected',
        'verified',
        'completed',
        'escalated',
        'cancelled',
        'overdue',
    ];

    private $db;

    public function __construct($db = null)
    {
        $this->db = $db ?: Database::getInstance();
    }

    public static function normalizeObjectType(string $objectType): string
    {
        $type = strtolower(trim($objectType));
        if ($type === 'tasks') $type = 'task';
        if ($type === 'bills') $type = 'bill';
        if ($type === 'payments') $type = 'payment';
        if (!in_array($type, self::OBJECT_TYPES, true)) {
            throw new InvalidArgumentException("Unsupported verification object type: {$objectType}");
        }
        return $type;
    }

    public static function validateWorkflowRecord(array $record): array
    {
        $missing = [];
        if (empty($record['owner_id']) && empty($record['owner'])) $missing[] = 'owner';
        if (empty($record['due_date'])) $missing[] = 'due_date';
        if (empty($record['priority'])) $missing[] = 'priority';

        return [
            'valid' => count($missing) === 0,
            'missing' => $missing,
        ];
    }

    public static function canCompleteFromState(bool $verificationRequired, array $steps): array
    {
        if (!$verificationRequired) {
            return ['allowed' => true, 'reason' => 'verification_not_required'];
        }

        if (count($steps) === 0) {
            return ['allowed' => false, 'reason' => 'verification_required_but_chain_missing'];
        }

        foreach ($steps as $step) {
            if (($step['status'] ?? 'pending') !== 'approved') {
                return [
                    'allowed' => false,
                    'reason' => 'verification_step_incomplete',
                    'step_order' => (int)($step['step_order'] ?? 0),
                ];
            }
        }

        return ['allowed' => true, 'reason' => 'all_verification_steps_approved'];
    }

    public static function reminderStages(DateTimeImmutable $dueAt, DateTimeImmutable $now): array
    {
        $stages = [];
        $seconds = $dueAt->getTimestamp() - $now->getTimestamp();

        if ($seconds <= 24 * 3600 && $seconds > 3 * 3600) $stages[] = '24h_before_due';
        if ($seconds <= 3 * 3600 && $seconds > 0) $stages[] = '3h_before_due';
        if ($seconds <= 0) $stages[] = 'at_due_time';

        $overdueSeconds = $now->getTimestamp() - $dueAt->getTimestamp();
        if ($overdueSeconds >= 24 * 3600) $stages[] = '24h_overdue';
        if ($overdueSeconds >= 3 * 24 * 3600) $stages[] = '3_days_overdue';
        if ($overdueSeconds >= 7 * 24 * 3600) $stages[] = '7_days_overdue';

        return array_values(array_unique($stages));
    }

    public static function escalationStage(DateTimeImmutable $dueAt, DateTimeImmutable $now): ?array
    {
        $days = (int)floor(max(0, $now->getTimestamp() - $dueAt->getTimestamp()) / 86400);
        if ($days >= 14) return ['stage' => 'ceo_risk_dashboard', 'notify' => ['ceo'], 'suggest_penalty' => true];
        if ($days >= 7) return ['stage' => 'admin_notification', 'notify' => ['admin'], 'suggest_penalty' => true];
        if ($days >= 3) return ['stage' => 'manager_notification', 'notify' => ['manager'], 'suggest_penalty' => false];
        if ($days >= 1) return ['stage' => 'owner_backup_notification', 'notify' => ['owner', 'backup_owner'], 'suggest_penalty' => false];
        return null;
    }

    public static function suggestedPenaltyCategory(string $objectType, string $missType): string
    {
        $type = self::normalizeObjectType($objectType);
        if ($type === 'payment') return 'Financial Confirmation Missed';
        if ($type === 'bill') return 'Financial Confirmation Missed';
        if ($type === 'payroll') return 'Approval Missed';
        if ($missType === 'verification') return 'Verification Missed';
        return 'Task overdue';
    }

    public function canCompleteRecord(string $objectType, int $objectId): array
    {
        $type = self::normalizeObjectType($objectType);
        $verification = $this->getActiveVerification($type, $objectId);
        if (!$verification) {
            return ['allowed' => true, 'reason' => 'no_verification_required'];
        }

        $steps = $this->getVerificationSteps((int)$verification['id']);
        return self::canCompleteFromState(true, $steps);
    }

    public function getActiveVerification(string $objectType, int $objectId): ?array
    {
        if (!$this->db->tableExists('record_verifications')) return null;
        $type = self::normalizeObjectType($objectType);
        $row = $this->db->fetch(
            "SELECT * FROM record_verifications
             WHERE object_type = ? AND object_id = ? AND status NOT IN ('verified','completed','cancelled')
             ORDER BY id DESC LIMIT 1",
            [$type, $objectId]
        );
        return $row ?: null;
    }

    public function getVerificationSteps(int $recordVerificationId): array
    {
        if (!$this->db->tableExists('verification_steps')) return [];
        return $this->db->fetchAll(
            "SELECT * FROM verification_steps WHERE record_verification_id = ? ORDER BY step_order ASC",
            [$recordVerificationId]
        ) ?: [];
    }

    public function submitForVerification(
        string $objectType,
        int $objectId,
        int $ownerId,
        ?int $storeId,
        string $priority,
        string $dueDate,
        int $createdBy,
        array $steps,
        ?string $templateName = null
    ): int {
        $type = self::normalizeObjectType($objectType);
        $recordCheck = self::validateWorkflowRecord([
            'owner_id' => $ownerId,
            'due_date' => $dueDate,
            'priority' => $priority,
        ]);
        if (!$recordCheck['valid']) {
            throw new InvalidArgumentException('Cannot create verification record; missing: ' . implode(', ', $recordCheck['missing']));
        }
        if (count($steps) < 1 || count($steps) > 5) {
            throw new InvalidArgumentException('Verification chain must contain 1 to 5 steps.');
        }

        $verificationId = (int)$this->db->insert(
            "INSERT INTO record_verifications
                (object_type, object_id, template_name, owner_id, store_id, priority, due_at, status, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_verification', ?, NOW())",
            [$type, $objectId, $templateName, $ownerId, $storeId, $priority, $dueDate, $createdBy]
        );

        foreach ($steps as $index => $step) {
            $this->db->insert(
                "INSERT INTO verification_steps
                    (record_verification_id, step_order, assigned_user_id, assigned_role, due_at, required_comment, required_evidence, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())",
                [
                    $verificationId,
                    $index + 1,
                    $step['assigned_user_id'] ?? null,
                    $step['assigned_role'] ?? null,
                    $step['due_at'] ?? $dueDate,
                    !empty($step['required_comment']) ? 1 : 0,
                    !empty($step['required_evidence']) ? 1 : 0,
                ]
            );
        }

        $this->logHistory($verificationId, null, $createdBy, 'submitted', 'Verification chain created');
        return $verificationId;
    }

    public function approveStep(int $stepId, int $actorId, ?string $comment = null, ?string $evidenceUrl = null): bool
    {
        $step = $this->db->fetch("SELECT * FROM verification_steps WHERE id = ?", [$stepId]);
        if (!$step || ($step['status'] ?? '') === 'approved') return false;
        if (!empty($step['required_comment']) && trim((string)$comment) === '') {
            throw new InvalidArgumentException('This verification step requires a comment.');
        }
        if (!empty($step['required_evidence']) && trim((string)$evidenceUrl) === '') {
            throw new InvalidArgumentException('This verification step requires evidence.');
        }

        $this->db->update(
            "UPDATE verification_steps
             SET status = 'approved', completed_by = ?, completed_at = NOW(), comment = ?, evidence_url = ?
             WHERE id = ? AND status <> 'approved'",
            [$actorId, $comment, $evidenceUrl, $stepId]
        );
        $this->logHistory((int)$step['record_verification_id'], $stepId, $actorId, 'step_approved', $comment);

        $steps = $this->getVerificationSteps((int)$step['record_verification_id']);
        $decision = self::canCompleteFromState(true, $steps);
        $newStatus = $decision['allowed'] ? 'verified' : 'verification_in_progress';
        $this->db->update("UPDATE record_verifications SET status = ?, updated_at = NOW() WHERE id = ?", [$newStatus, (int)$step['record_verification_id']]);
        return true;
    }

    public function rejectStep(int $stepId, int $actorId, string $reason): bool
    {
        $step = $this->db->fetch("SELECT * FROM verification_steps WHERE id = ?", [$stepId]);
        if (!$step) return false;
        $this->db->update(
            "UPDATE verification_steps SET status = 'rejected', completed_by = ?, completed_at = NOW(), comment = ? WHERE id = ?",
            [$actorId, $reason, $stepId]
        );
        $this->db->update("UPDATE record_verifications SET status = 'verification_rejected', updated_at = NOW() WHERE id = ?", [(int)$step['record_verification_id']]);
        $this->logHistory((int)$step['record_verification_id'], $stepId, $actorId, 'step_rejected', $reason);
        return true;
    }

    public function buildDashboardMetrics(?string $role = null): array
    {
        if (!$this->db->tableExists('record_verifications')) {
            return [
                'pending_verifications' => 0,
                'overdue_verifications' => 0,
                'suggested_penalties' => 0,
                'verification_bottlenecks' => [],
            ];
        }

        $pending = $this->db->fetch("SELECT COUNT(*) AS c FROM record_verifications WHERE status IN ('pending_verification','verification_in_progress')");
        $overdue = $this->db->fetch("SELECT COUNT(*) AS c FROM verification_steps WHERE status = 'pending' AND due_at < NOW()");
        $penalties = $this->db->fetch("SELECT COUNT(*) AS c FROM verification_escalations WHERE suggested_penalty = 1 AND penalty_approved_at IS NULL");
        $bottlenecks = $this->db->fetchAll(
            "SELECT assigned_role, COUNT(*) AS pending_count
             FROM verification_steps
             WHERE status = 'pending'
             GROUP BY assigned_role
             ORDER BY pending_count DESC
             LIMIT 10"
        ) ?: [];

        return [
            'pending_verifications' => (int)($pending['c'] ?? 0),
            'overdue_verifications' => (int)($overdue['c'] ?? 0),
            'suggested_penalties' => (int)($penalties['c'] ?? 0),
            'verification_bottlenecks' => $bottlenecks,
            'role' => $role,
        ];
    }

    private function logHistory(int $verificationId, ?int $stepId, int $actorId, string $action, ?string $comment): void
    {
        if (!$this->db->tableExists('verification_history')) return;
        $this->db->insert(
            "INSERT INTO verification_history (record_verification_id, verification_step_id, actor_id, action, comment, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())",
            [$verificationId, $stepId, $actorId, $action, $comment]
        );
    }
}
