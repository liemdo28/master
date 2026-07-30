<?php
/**
 * ObligationService — Task generator for obligation registry.
 *
 * CEO Compliance & Payment Operations — Phase 2
 *
 * Responsibilities:
 *  - For each active obligation whose next_due_date <= today, generate a
 *    recurring Task and a corresponding obligation_payments row.
 *  - Idempotent: never duplicates a payment for the same (obligation, due_date).
 *  - Rolls the obligation's next_due_date forward.
 */
class ObligationService
{
    private $db;
    private $obligation;
    private $task;

    /** Required evidence pack written into each generated task. */
    public const REQUIRED_EVIDENCE = [
        'Invoice',
        'Receipt',
        'Payment Confirmation',
        'Bank Proof',
    ];

    public function __construct()
    {
        $this->db         = Database::getInstance();
        $this->obligation = new Obligation();
        $this->task       = new Task();
    }

    /**
     * Generate all due obligation occurrences. Returns the count of new
     * payment + task rows created. Safe to run repeatedly (idempotent).
     */
    public function generateDueOccurrences(?string $asOfDate = null): int
    {
        $asOf = $asOfDate ?? app_today();
        $created = 0;

        $rows = $this->db->fetchAll(
            "SELECT * FROM obligations
             WHERE active = 1 AND next_due_date IS NOT NULL AND next_due_date <= ?",
            [$asOf]
        );

        foreach ($rows as $obl) {
            if ($this->generateForObligation($obl, $asOf)) {
                $created++;
            }
        }

        ProductionLogger::info('OBLIGATIONS', 'Bulk generation complete', [
            'as_of'    => $asOf,
            'created'  => $created,
            'scanned'  => count($rows),
        ]);

        return $created;
    }

    /**
     * Generate one occurrence for a specific obligation. Returns true if a
     * new payment + task was created. Returns false if already exists or
     * obligation inactive.
     */
    public function generateForObligation(array $obligation, ?string $asOfDate = null): bool
    {
        if (empty($obligation['active'])) {
            return false;
        }
        $asOf = $asOfDate ?? app_today();
        $dueDate = $obligation['next_due_date'] ?? null;
        if (!$dueDate || $dueDate > $asOf) {
            return false;
        }

        // Idempotency — don't duplicate (obligation, due_date)
        $existing = $this->obligation->findPaymentByObligationAndDue((int)$obligation['id'], $dueDate);
        if ($existing) {
            // Just roll forward and move on
            $this->rollObligationForward($obligation);
            return false;
        }

        // Create payment row first (status=pending)
        [$periodStart, $periodEnd] = $this->obligation->computePeriod($obligation['frequency'], $dueDate);
        $paymentId = $this->obligation->createPayment([
            'obligation_id' => $obligation['id'],
            'task_id'       => null,
            'due_date'      => $dueDate,
            'amount'        => $obligation['amount'] ?? null,
            'status'        => Obligation::STATUS_PENDING,
            'reviewer_id'   => $obligation['reviewer_id'] ?? null,
            'approver_id'   => $obligation['approver_id'] ?? null,
            'period_start'  => $periodStart,
            'period_end'    => $periodEnd,
        ]);

        // Build task title (e.g. "Monthly Rent - Raw Stockton")
        $taskTitle = $this->buildTaskTitle($obligation, $dueDate);

        // Build task description with payment context
        $taskDesc = $this->buildTaskDescription($obligation, $dueDate, $paymentId);

        // Build review instructions
        $reviewInstructions = $this->buildReviewInstructions($obligation);

        // Approver instructions
        $approverInstructions = $this->buildApproverInstructions($obligation);

        // Create the recurring task
        $taskId = $this->createPaymentTask(
            $obligation,
            $taskTitle,
            $taskDesc,
            $reviewInstructions,
            $approverInstructions,
            $dueDate
        );

        if ($taskId) {
            $this->obligation->linkTask($paymentId, $taskId);
        }

        // Roll the obligation's next_due_date forward
        $this->rollObligationForward($obligation);

        ProductionLogger::info('OBLIGATIONS', 'Generated occurrence', [
            'obligation_id' => $obligation['id'],
            'payment_id'    => $paymentId,
            'task_id'       => $taskId,
            'due_date'      => $dueDate,
        ]);

        return (bool)$taskId;
    }

    /**
     * Create the Task row with the rich approval workflow spec.
     */
    private function createPaymentTask(
        array $obligation,
        string $title,
        string $description,
        string $reviewInstructions,
        string $approverInstructions,
        string $dueDate
    ): ?int {
        // Determine project/section; fall back to first admin-owned project
        $projectId = !empty($obligation['project_id'])
            ? (int)$obligation['project_id']
            : $this->findOrCreateDefaultProject((int)($obligation['store_id'] ?? 0), $obligation['store_name'] ?? 'Compliance');

        $section = new Section();
        $sectionId = !empty($obligation['section_id'])
            ? (int)$obligation['section_id']
            : $section->normalizeSectionId(null, $projectId);

        // Reviewer/approver — obligation can specify; otherwise fall back to admin
        $adminId = $this->getAdminUserId();
        $reviewerId = !empty($obligation['reviewer_id']) ? (int)$obligation['reviewer_id'] : $adminId;
        $approverId = !empty($obligation['approver_id']) ? (int)$obligation['approver_id'] : $adminId;

        // Assignee defaults to reviewer
        $assigneeId = $reviewerId;

        // Frequency maps to task repeat_type
        $repeatType = $this->mapFrequencyToRepeatType($obligation['frequency']);

        $payload = [
            'project_id'   => $projectId,
            'section_id'   => $sectionId,
            'title'        => $title,
            'description'  => $description,
            'assignee_id'  => $assigneeId,
            'priority'     => $obligation['priority'] ?? 'high',
            'status'       => 'todo',
            'due_date'     => $dueDate,
            'start_date'   => null,
            'visibility'   => 'public',
            'created_by'   => $adminId,
            'repeat_type'  => $repeatType,
            // Approval workflow
            'reviewer_id'  => $reviewerId,
            'approver_id'  => $approverId,
        ];

        // Optional rich review workspace columns (guarded by columnExists)
        $db = Database::getInstance();
        if ($db->columnExists('tasks', 'review_instructions')) {
            $payload['review_instructions'] = $reviewInstructions;
        }
        if ($db->columnExists('tasks', 'required_evidence')) {
            $payload['required_evidence'] = json_encode(self::REQUIRED_EVIDENCE, JSON_UNESCAPED_UNICODE);
        }
        if ($db->columnExists('tasks', 'required_files')) {
            $payload['required_files'] = json_encode(self::REQUIRED_EVIDENCE, JSON_UNESCAPED_UNICODE);
        }
        if ($db->columnExists('tasks', 'approver_instructions')) {
            $payload['approver_instructions'] = $approverInstructions;
        }
        if ($db->columnExists('tasks', 'approval_required')) {
            $payload['approval_required'] = 1;
        }

        try {
            return (int)$this->task->create($payload);
        } catch (Throwable $e) {
            ProductionLogger::error('OBLIGATIONS', 'Failed to create task', [
                'obligation_id' => $obligation['id'] ?? null,
                'error'         => $e->getMessage(),
            ]);
            return null;
        }
    }

    private function buildTaskTitle(array $obl, string $dueDate): string
    {
        $freqLabel = [
            Obligation::FREQ_WEEKLY      => 'Weekly',
            Obligation::FREQ_MONTHLY     => 'Monthly',
            Obligation::FREQ_QUARTERLY   => 'Quarterly',
            Obligation::FREQ_SEMI_ANNUAL => 'Semi-Annual',
            Obligation::FREQ_ANNUAL      => 'Annual',
        ];
        $freq = $freqLabel[$obl['frequency']] ?? ucfirst($obl['frequency']);

        $base = trim($obl['name'] ?? '');
        if ($base === '') {
            $base = trim(($obl['vendor'] ?? 'Obligation') . ' ' . ($obl['store_name'] ?? ''));
        }

        // Add period hint
        $due = new DateTimeImmutable($dueDate);
        switch ($obl['frequency']) {
            case Obligation::FREQ_QUARTERLY:
                $q = (int)ceil((int)$due->format('n') / 3);
                $base .= " (Q{$q} {$due->format('Y')})";
                break;
            case Obligation::FREQ_ANNUAL:
                $base .= " (" . $due->format('Y') . ")";
                break;
            case Obligation::FREQ_SEMI_ANNUAL:
                $half = (int)$due->format('n') <= 6 ? 'H1' : 'H2';
                $base .= " ({$half} {$due->format('Y')})";
                break;
            case Obligation::FREQ_MONTHLY:
                $base .= " (" . $due->format('M Y') . ")";
                break;
        }

        return "{$freq} " . $base;
    }

    private function buildTaskDescription(array $obl, string $dueDate, int $paymentId): string
    {
        $lines = [];
        $lines[] = "**Obligation:** " . ($obl['name'] ?? '');
        if (!empty($obl['vendor']))        $lines[] = "**Vendor:** {$obl['vendor']}";
        if (!empty($obl['store_name']))    $lines[] = "**Store:** {$obl['store_name']}";
        $lines[] = "**Frequency:** " . ucfirst($obl['frequency']);
        $lines[] = "**Due date:** {$dueDate}";
        if (isset($obl['amount']) && $obl['amount'] !== null) {
            $lines[] = "**Expected amount:** \$" . number_format((float)$obl['amount'], 2);
        }
        $lines[] = "**Payment reference:** #{$paymentId}";

        if (!empty($obl['account_info'])) {
            $lines[] = "";
            $lines[] = "**Account / login info:**";
            $lines[] = trim($obl['account_info']);
        }
        if (!empty($obl['compliance_note'])) {
            $lines[] = "";
            $lines[] = "**Compliance notes:**";
            $lines[] = trim($obl['compliance_note']);
        }

        $lines[] = "";
        $lines[] = "**Required evidence:**";
        foreach (self::REQUIRED_EVIDENCE as $ev) {
            $lines[] = "- {$ev}";
        }

        return implode("\n", $lines);
    }

    private function buildReviewInstructions(array $obl): string
    {
        $lines = [];
        $lines[] = "**Reviewer must verify:**";
        $lines[] = "1. Invoice uploaded";
        $lines[] = "2. Receipt uploaded";
        $lines[] = "3. Amount matches expected obligation amount";
        $lines[] = "4. Due date matches the obligation schedule";
        $lines[] = "5. Task completed correctly (payment reference recorded)";
        if (!empty($obl['compliance_note'])) {
            $lines[] = "";
            $lines[] = "**Compliance-specific checks:** " . trim($obl['compliance_note']);
        }
        return implode("\n", $lines);
    }

    private function buildApproverInstructions(array $obl): string
    {
        $lines = [];
        $lines[] = "**Approver must confirm:**";
        $lines[] = "- Reviewer approval on file";
        $lines[] = "- All required evidence attached (Invoice, Receipt, Payment Confirmation, Bank Proof)";
        $lines[] = "- Approval history reviewed";
        $lines[] = "- Approve / Reject / Request Changes";
        return implode("\n", $lines);
    }

    private function mapFrequencyToRepeatType(string $frequency): string
    {
        return match ($frequency) {
            Obligation::FREQ_WEEKLY    => 'weekly',
            Obligation::FREQ_MONTHLY   => 'monthly',
            Obligation::FREQ_QUARTERLY => 'monthly',   // Generated quarterly via cron, not task repeat
            Obligation::FREQ_SEMI_ANNUAL => 'yearly',
            Obligation::FREQ_ANNUAL    => 'yearly',
            default                    => 'none',
        };
    }

    /**
     * Roll an obligation's next_due_date forward by one period.
     */
    private function rollObligationForward(array $obligation): void
    {
        $current = $obligation['next_due_date'] ?? app_today();
        $next = $this->obligation->computeNextDueDate(
            $obligation['frequency'],
            !empty($obligation['due_day']) ? (int)$obligation['due_day'] : null,
            !empty($obligation['due_month']) ? (int)$obligation['due_month'] : null,
            $current
        );
        $this->obligation->markGenerated((int)$obligation['id'], $next);
    }

    /**
     * Find an existing default "Compliance" project for the store, or
     * create one. Returns the project ID.
     */
    private function findOrCreateDefaultProject(int $storeId, string $storeLabel): int
    {
        $storeLabel = $storeLabel ?: 'Compliance';
        $projectName = "Compliance - {$storeLabel}";

        $row = $this->db->fetch(
            "SELECT id FROM projects WHERE name = ? LIMIT 1",
            [$projectName]
        );
        if ($row) {
            return (int)$row['id'];
        }

        $adminId = $this->getAdminUserId();
        $projectId = (int)$this->db->insert(
            "INSERT INTO projects (name, description, color, owner_id, status, created_at)
             VALUES (?, ?, ?, ?, 'active', NOW())",
            [
                $projectName,
                "Auto-generated compliance & payment obligations for {$storeLabel}.",
                '#7C3AED',
                $adminId,
            ]
        );

        // Add owner as member
        $this->db->insert(
            "INSERT IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, 'owner')",
            [$projectId, $adminId]
        );

        // Default sections
        $existingSections = $this->db->fetchAll("SELECT name FROM sections WHERE project_id = ?", [$projectId]);
        $have = array_column($existingSections, 'name');
        $defaults = ['To Do', 'In Progress', 'Done'];
        $i = count($have);
        foreach ($defaults as $name) {
            if (!in_array($name, $have, true)) {
                $this->db->insert(
                    "INSERT INTO sections (project_id, name, position) VALUES (?, ?, ?)",
                    [$projectId, $name, $i++]
                );
            }
        }

        return $projectId;
    }

    private function getAdminUserId(): int
    {
        $row = $this->db->fetch("SELECT id FROM users WHERE role = 'admin' AND is_active = 1 ORDER BY id LIMIT 1");
        return $row ? (int)$row['id'] : 1;
    }

    /**
     * Sync obligations for a one-off period (used by admin tools).
     */
    public function backfillForObligation(int $obligationId, int $months = 3): int
    {
        $obl = $this->obligation->findById($obligationId);
        if (!$obl) {
            return 0;
        }
        $created = 0;
        $cursor = app_today();
        for ($i = 0; $i < $months; $i++) {
            $occurrence = $this->obligation->computeNextDueDate(
                $obl['frequency'],
                !empty($obl['due_day']) ? (int)$obl['due_day'] : null,
                !empty($obl['due_month']) ? (int)$obl['due_month'] : null,
                $cursor
            );
            if ($occurrence === $cursor) {
                break;
            }
            $tmp = $obl;
            $tmp['next_due_date'] = $occurrence;
            if ($this->generateForObligation($tmp, $occurrence)) {
                $created++;
            }
            $cursor = $occurrence;
        }
        return $created;
    }
}
