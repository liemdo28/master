<?php
/**
 * Obligation — Master obligation registry model
 * Handles CRUD for obligations, payments, and dashboard widget queries.
 *
 * CEO Compliance & Payment Operations — Phase 1
 */
class Obligation
{
    private $db;

    public const FREQ_WEEKLY      = 'weekly';
    public const FREQ_MONTHLY     = 'monthly';
    public const FREQ_QUARTERLY   = 'quarterly';
    public const FREQ_SEMI_ANNUAL = 'semi_annual';
    public const FREQ_ANNUAL      = 'annual';

    public const STATUS_PENDING  = 'pending';
    public const STATUS_REVIEW   = 'review';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_PAID     = 'paid';
    public const STATUS_SKIPPED  = 'skipped';

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    // ════════════════════════════════════════════════════════════
    // CATEGORIES
    // ════════════════════════════════════════════════════════════

    public function getCategories(bool $activeOnly = true): array
    {
        $sql = "SELECT * FROM obligation_categories" . ($activeOnly ? " WHERE is_active = 1" : "") . " ORDER BY sort_order, name";
        return $this->db->fetchAll($sql) ?: [];
    }

    public function findCategoryById(int $id): ?array
    {
        return $this->db->fetch("SELECT * FROM obligation_categories WHERE id = ?", [$id]) ?: null;
    }

    public function findCategoryByName(string $name): ?array
    {
        return $this->db->fetch("SELECT * FROM obligation_categories WHERE LOWER(name) = LOWER(?)", [$name]) ?: null;
    }

    public function createCategory(string $name, ?string $description = null, int $sortOrder = 0): int
    {
        return (int)$this->db->insert(
            "INSERT INTO obligation_categories (name, description, sort_order) VALUES (?, ?, ?)",
            [$name, $description, $sortOrder]
        );
    }

    public function upsertCategory(string $name, ?string $description = null, int $sortOrder = 0): int
    {
        $existing = $this->findCategoryByName($name);
        if ($existing) {
            return (int)$existing['id'];
        }
        return $this->createCategory($name, $description, $sortOrder);
    }

    // ════════════════════════════════════════════════════════════
    // OBLIGATIONS — master registry
    // ════════════════════════════════════════════════════════════

    public function findById(int $id): ?array
    {
        $row = $this->db->fetch(
            "SELECT o.*,
                    c.name AS category_name,
                    s.name AS store_label,
                    r.name AS reviewer_name,
                    a.name AS approver_name,
                    p.name AS project_name
             FROM obligations o
             LEFT JOIN obligation_categories c ON o.category_id = c.id
             LEFT JOIN stores s ON o.store_id = s.id
             LEFT JOIN users r ON o.reviewer_id = r.id
             LEFT JOIN users a ON o.approver_id = a.id
             LEFT JOIN projects p ON o.project_id = p.id
             WHERE o.id = ?",
            [$id]
        );
        return $row ?: null;
    }

    public function findAll(array $filters = []): array
    {
        $where = ['1=1'];
        $params = [];

        if (!empty($filters['active'])) {
            $where[] = 'o.active = 1';
        }
        if (!empty($filters['category_id'])) {
            $where[] = 'o.category_id = ?';
            $params[] = (int)$filters['category_id'];
        }
        if (!empty($filters['store_id'])) {
            $where[] = 'o.store_id = ?';
            $params[] = (int)$filters['store_id'];
        }
        if (!empty($filters['frequency'])) {
            $where[] = 'o.frequency = ?';
            $params[] = $filters['frequency'];
        }

        $sql = "SELECT o.*,
                       c.name AS category_name,
                       s.name AS store_label,
                       r.name AS reviewer_name,
                       a.name AS approver_name
                FROM obligations o
                LEFT JOIN obligation_categories c ON o.category_id = c.id
                LEFT JOIN stores s ON o.store_id = s.id
                LEFT JOIN users r ON o.reviewer_id = r.id
                LEFT JOIN users a ON o.approver_id = a.id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY c.sort_order, o.name";

        return $this->db->fetchAll($sql, $params) ?: [];
    }

    public function findActive(): array
    {
        return $this->findAll(['active' => true]);
    }

    public function create(array $data): int
    {
        $nextDue = $data['next_due_date'] ?? $this->computeNextDueDate(
            $data['frequency'] ?? self::FREQ_MONTHLY,
            !empty($data['due_day']) ? (int)$data['due_day'] : null,
            !empty($data['due_month']) ? (int)$data['due_month'] : null,
            app_today()
        );

        return (int)$this->db->insert(
            "INSERT INTO obligations
                (category_id, name, vendor, store_id, store_name, frequency, due_day, due_month,
                 grace_days, amount, account_info, compliance_note,
                 reviewer_id, approver_id, project_id, section_id, priority,
                 active, next_due_date, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
            [
                !empty($data['category_id']) ? (int)$data['category_id'] : null,
                $data['name'],
                $data['vendor'] ?? null,
                !empty($data['store_id']) ? (int)$data['store_id'] : null,
                $data['store_name'] ?? null,
                $data['frequency'] ?? self::FREQ_MONTHLY,
                !empty($data['due_day']) ? (int)$data['due_day'] : null,
                !empty($data['due_month']) ? (int)$data['due_month'] : null,
                (int)($data['grace_days'] ?? 3),
                isset($data['amount']) && $data['amount'] !== '' ? (float)$data['amount'] : null,
                $data['account_info'] ?? null,
                $data['compliance_note'] ?? null,
                !empty($data['reviewer_id']) ? (int)$data['reviewer_id'] : null,
                !empty($data['approver_id']) ? (int)$data['approver_id'] : null,
                !empty($data['project_id']) ? (int)$data['project_id'] : null,
                !empty($data['section_id']) ? (int)$data['section_id'] : null,
                $data['priority'] ?? 'high',
                !empty($data['active']) ? 1 : 0,
                $nextDue,
            ]
        );
    }

    public function update(int $id, array $data): bool
    {
        $allowed = [
            'category_id','name','vendor','store_id','store_name','frequency',
            'due_day','due_month','grace_days','amount','account_info','compliance_note',
            'reviewer_id','approver_id','project_id','section_id','priority','active'
        ];
        $sets = [];
        $params = [];
        foreach ($allowed as $field) {
            if (array_key_exists($field, $data)) {
                $sets[] = "$field = ?";
                $val = $data[$field];
                if ($field === 'amount' && $val === '') $val = null;
                if (in_array($field, ['reviewer_id','approver_id','store_id','project_id','section_id','category_id','due_day','due_month']) && $val === '') $val = null;
                $params[] = $val;
            }
        }
        if (empty($sets)) {
            return false;
        }
        $params[] = $id;
        return $this->db->update("UPDATE obligations SET " . implode(', ', $sets) . " WHERE id = ?", $params) > 0;
    }

    public function setActive(int $id, bool $active): bool
    {
        return $this->db->update("UPDATE obligations SET active = ? WHERE id = ?", [$active ? 1 : 0, $id]) > 0;
    }

    public function delete(int $id): bool
    {
        return $this->db->delete("DELETE FROM obligations WHERE id = ?", [$id]) > 0;
    }

    public function markGenerated(int $id, string $nextDueDate): void
    {
        $this->db->update(
            "UPDATE obligations SET last_generated = NOW(), next_due_date = ? WHERE id = ?",
            [$nextDueDate, $id]
        );
    }

    // ════════════════════════════════════════════════════════════
    // PAYMENTS — payment history per obligation
    // ════════════════════════════════════════════════════════════

    public function findPayment(int $id): ?array
    {
        $row = $this->db->fetch(
            "SELECT op.*,
                    o.name AS obligation_name, o.vendor, o.store_name, o.frequency,
                    c.name AS category_name,
                    r.name AS reviewer_name, a.name AS approver_name,
                    s.name AS store_db_name
             FROM obligation_payments op
             JOIN obligations o ON op.obligation_id = o.id
             LEFT JOIN obligation_categories c ON o.category_id = c.id
             LEFT JOIN users r ON op.reviewer_id = r.id
             LEFT JOIN users a ON op.approver_id = a.id
             LEFT JOIN stores s ON o.store_id = s.id
             WHERE op.id = ?",
            [$id]
        );
        return $row ?: null;
    }

    public function findPaymentByTask(int $taskId): ?array
    {
        $row = $this->db->fetch(
            "SELECT * FROM obligation_payments WHERE task_id = ? ORDER BY id DESC LIMIT 1",
            [$taskId]
        );
        return $row ?: null;
    }

    public function findPaymentByObligationAndDue(int $obligationId, string $dueDate): ?array
    {
        return $this->db->fetch(
            "SELECT * FROM obligation_payments WHERE obligation_id = ? AND due_date = ? LIMIT 1",
            [$obligationId, $dueDate]
        ) ?: null;
    }

    public function findPayments(array $filters = []): array
    {
        $where = ['1=1'];
        $params = [];

        if (!empty($filters['obligation_id'])) {
            $where[] = 'op.obligation_id = ?';
            $params[] = (int)$filters['obligation_id'];
        }
        if (!empty($filters['status'])) {
            if (is_array($filters['status'])) {
                $placeholders = implode(',', array_fill(0, count($filters['status']), '?'));
                $where[] = "op.status IN ($placeholders)";
                foreach ($filters['status'] as $s) $params[] = $s;
            } else {
                $where[] = 'op.status = ?';
                $params[] = $filters['status'];
            }
        }
        if (!empty($filters['reviewer_id'])) {
            $where[] = 'op.reviewer_id = ?';
            $params[] = (int)$filters['reviewer_id'];
        }
        if (!empty($filters['approver_id'])) {
            $where[] = 'op.approver_id = ?';
            $params[] = (int)$filters['approver_id'];
        }
        if (!empty($filters['store_id'])) {
            $where[] = 'o.store_id = ?';
            $params[] = (int)$filters['store_id'];
        }
        if (!empty($filters['from_date'])) {
            $where[] = 'op.due_date >= ?';
            $params[] = $filters['from_date'];
        }
        if (!empty($filters['to_date'])) {
            $where[] = 'op.due_date <= ?';
            $params[] = $filters['to_date'];
        }
        if (!empty($filters['overdue_only'])) {
            $where[] = "op.due_date < ? AND op.status NOT IN ('paid','skipped','approved')";
            $params[] = app_today();
        }
        if (!empty($filters['upcoming_days'])) {
            $today = app_today();
            $end = date('Y-m-d', strtotime($today . ' +' . (int)$filters['upcoming_days'] . ' days'));
            $where[] = "op.due_date BETWEEN ? AND ? AND op.status NOT IN ('paid','skipped')";
            $params[] = $today;
            $params[] = $end;
        }
        if (!empty($filters['needs_evidence'])) {
            $where[] = "op.evidence_invoice = 0 AND op.status NOT IN ('paid','skipped')";
        }

        $limit = !empty($filters['limit']) ? (int)$filters['limit'] : 100;

        $sql = "SELECT op.*,
                       o.name AS obligation_name, o.vendor, o.store_name, o.frequency,
                       c.name AS category_name,
                       r.name AS reviewer_name, a.name AS approver_name,
                       s.name AS store_db_name,
                       t.title AS task_title, t.is_completed AS task_completed
                FROM obligation_payments op
                JOIN obligations o ON op.obligation_id = o.id
                LEFT JOIN obligation_categories c ON o.category_id = c.id
                LEFT JOIN users r ON op.reviewer_id = r.id
                LEFT JOIN users a ON op.approver_id = a.id
                LEFT JOIN stores s ON o.store_id = s.id
                LEFT JOIN tasks t ON op.task_id = t.id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY op.due_date ASC
                LIMIT $limit";

        return $this->db->fetchAll($sql, $params) ?: [];
    }

    public function createPayment(array $data): int
    {
        return (int)$this->db->insert(
            "INSERT INTO obligation_payments
                (obligation_id, task_id, due_date, amount, status,
                 reviewer_id, approver_id, period_start, period_end, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
            [
                (int)$data['obligation_id'],
                !empty($data['task_id']) ? (int)$data['task_id'] : null,
                $data['due_date'],
                isset($data['amount']) && $data['amount'] !== '' ? (float)$data['amount'] : null,
                $data['status'] ?? self::STATUS_PENDING,
                !empty($data['reviewer_id']) ? (int)$data['reviewer_id'] : null,
                !empty($data['approver_id']) ? (int)$data['approver_id'] : null,
                $data['period_start'] ?? null,
                $data['period_end'] ?? null,
            ]
        );
    }

    public function updatePayment(int $id, array $data): bool
    {
        $allowed = [
            'task_id','amount','status',
            'evidence_invoice','evidence_receipt','evidence_bank_proof','evidence_payment_confirm','evidence_other',
            'reviewer_id','reviewer_result','reviewer_notes','reviewer_result_at',
            'approver_id','approver_result','approver_notes','approver_result_at',
            'paid_amount','paid_date','payment_reference','period_start','period_end'
        ];
        $sets = [];
        $params = [];
        foreach ($allowed as $field) {
            if (array_key_exists($field, $data)) {
                $sets[] = "$field = ?";
                $val = $data[$field];
                if (in_array($field, ['task_id','reviewer_id','approver_id','amount','paid_amount']) && $val === '') {
                    $val = null;
                }
                if (in_array($field, ['evidence_invoice','evidence_receipt','evidence_bank_proof','evidence_payment_confirm','evidence_other'])) {
                    $val = $val ? 1 : 0;
                }
                $params[] = $val;
            }
        }
        if (empty($sets)) {
            return false;
        }
        $params[] = $id;
        return $this->db->update("UPDATE obligation_payments SET " . implode(', ', $sets) . " WHERE id = ?", $params) > 0;
    }

    public function recordReviewerResult(int $id, string $result, ?string $notes, int $userId): bool
    {
        $allowed = ['approved','rejected','changes_requested'];
        if (!in_array($result, $allowed, true)) {
            return false;
        }
        $newStatus = $result === 'approved' ? self::STATUS_REVIEW : self::STATUS_REJECTED;
        return $this->db->update(
            "UPDATE obligation_payments
             SET reviewer_result = ?, reviewer_notes = ?, reviewer_result_at = NOW(), status = ?
             WHERE id = ?",
            [$result, $notes, $newStatus, $id]
        ) > 0;
    }

    public function recordApproverResult(int $id, string $result, ?string $notes, int $userId): bool
    {
        $allowed = ['approved','rejected','changes_requested'];
        if (!in_array($result, $allowed, true)) {
            return false;
        }
        $newStatus = $result === 'approved' ? self::STATUS_APPROVED : self::STATUS_REJECTED;
        return $this->db->update(
            "UPDATE obligation_payments
             SET approver_result = ?, approver_notes = ?, approver_result_at = NOW(), status = ?
             WHERE id = ?",
            [$result, $notes, $newStatus, $id]
        ) > 0;
    }

    public function markPaid(int $id, ?float $amount = null, ?string $paidDate = null, ?string $reference = null): bool
    {
        return $this->db->update(
            "UPDATE obligation_payments
             SET status = 'paid', paid_amount = ?, paid_date = ?, payment_reference = ?, updated_at = NOW()
             WHERE id = ?",
            [
                $amount,
                $paidDate ?? app_today(),
                $reference,
                $id,
            ]
        ) > 0;
    }

    public function linkTask(int $paymentId, int $taskId): bool
    {
        return $this->db->update(
            "UPDATE obligation_payments SET task_id = ? WHERE id = ?",
            [$taskId, $paymentId]
        ) > 0;
    }

    // ════════════════════════════════════════════════════════════
    // DASHBOARD WIDGET QUERIES (Phase 3)
    // ════════════════════════════════════════════════════════════

    /**
     * Widget 1: Upcoming Due (next 30 days)
     */
    public function widgetUpcoming(int $days = 30, int $limit = 20): array
    {
        $today = app_today();
        $end = date('Y-m-d', strtotime($today . ' +' . $days . ' days'));
        return $this->findPayments([
            'from_date'      => $today,
            'to_date'        => $end,
            'status'         => ['pending', 'review', 'approved', 'rejected'],
            'limit'          => $limit,
        ]);
    }

    /**
     * Widget 2: Overdue Payments
     */
    public function widgetOverdue(int $limit = 20): array
    {
        return $this->findPayments([
            'overdue_only'   => true,
            'limit'          => $limit,
        ]);
    }

    /**
     * Widget 3: Upcoming Tax Filings (next 60 days)
     * Tax filings = obligations in Tax/Insurance/License categories
     */
    public function widgetUpcomingTaxFilings(int $days = 60, int $limit = 20): array
    {
        $today = app_today();
        $end = date('Y-m-d', strtotime($today . ' +' . $days . ' days'));
        $where = ['1=1'];
        $params = [];

        $where[] = 'op.due_date BETWEEN ? AND ?';
        $params[] = $today;
        $params[] = $end;
        $where[] = "op.status NOT IN ('paid','skipped')";
        $where[] = "(c.name IN ('Tax','Insurance','License','Compliance'))";
        $where[] = "(o.frequency IN ('quarterly','semi_annual','annual'))";

        $sql = "SELECT op.*,
                       o.name AS obligation_name, o.vendor, o.store_name, o.frequency,
                       c.name AS category_name,
                       r.name AS reviewer_name, a.name AS approver_name
                FROM obligation_payments op
                JOIN obligations o ON op.obligation_id = o.id
                LEFT JOIN obligation_categories c ON o.category_id = c.id
                LEFT JOIN users r ON op.reviewer_id = r.id
                LEFT JOIN users a ON op.approver_id = a.id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY op.due_date ASC
                LIMIT $limit";
        return $this->db->fetchAll($sql, $params) ?: [];
    }

    /**
     * Widget 4: Upcoming Renewals (Insurance, License)
     */
    public function widgetUpcomingRenewals(int $days = 60, int $limit = 20): array
    {
        $today = app_today();
        $end = date('Y-m-d', strtotime($today . ' +' . $days . ' days'));
        $where = ['1=1'];
        $params = [];

        $where[] = 'op.due_date BETWEEN ? AND ?';
        $params[] = $today;
        $params[] = $end;
        $where[] = "op.status NOT IN ('paid','skipped')";
        $where[] = "(c.name IN ('Insurance','License','Compliance'))";
        $where[] = "o.frequency IN ('annual','semi_annual')";

        $sql = "SELECT op.*,
                       o.name AS obligation_name, o.vendor, o.store_name, o.frequency,
                       c.name AS category_name,
                       r.name AS reviewer_name, a.name AS approver_name
                FROM obligation_payments op
                JOIN obligations o ON op.obligation_id = o.id
                LEFT JOIN obligation_categories c ON o.category_id = c.id
                LEFT JOIN users r ON op.reviewer_id = r.id
                LEFT JOIN users a ON op.approver_id = a.id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY op.due_date ASC
                LIMIT $limit";
        return $this->db->fetchAll($sql, $params) ?: [];
    }

    /**
     * Widget 5: Missing Evidence
     */
    public function widgetMissingEvidence(int $limit = 20): array
    {
        return $this->findPayments([
            'needs_evidence' => true,
            'limit'          => $limit,
        ]);
    }

    /**
     * Widget 6: Awaiting Approval
     */
    public function widgetAwaitingApproval(int $limit = 20): array
    {
        return $this->findPayments([
            'status'         => ['review', 'pending'],
            'limit'          => $limit,
        ]);
    }

    /**
     * Get all KPI counts for a dashboard in a single grouped query.
     */
    public function getDashboardKpis(): array
    {
        $today = app_today();
        $end30 = date('Y-m-d', strtotime($today . ' +30 days'));
        $end60 = date('Y-m-d', strtotime($today . ' +60 days'));

        $sql = "SELECT
                  SUM(CASE WHEN op.due_date < ? AND op.status NOT IN ('paid','skipped','approved') THEN 1 ELSE 0 END) AS overdue,
                  SUM(CASE WHEN op.due_date BETWEEN ? AND ? AND op.status NOT IN ('paid','skipped') THEN 1 ELSE 0 END) AS due_30,
                  SUM(CASE WHEN op.due_date BETWEEN ? AND ? AND op.status NOT IN ('paid','skipped') THEN 1 ELSE 0 END) AS due_60,
                  SUM(CASE WHEN op.status IN ('review','pending') THEN 1 ELSE 0 END) AS awaiting_approval,
                  SUM(CASE WHEN op.evidence_invoice = 0 AND op.status NOT IN ('paid','skipped') THEN 1 ELSE 0 END) AS missing_evidence,
                  SUM(CASE WHEN c.name IN ('Tax','Insurance','License','Compliance') AND op.due_date BETWEEN ? AND ? AND op.status NOT IN ('paid','skipped') THEN 1 ELSE 0 END) AS tax_filings,
                  SUM(CASE WHEN c.name IN ('Insurance','License') AND op.due_date BETWEEN ? AND ? AND op.status NOT IN ('paid','skipped') THEN 1 ELSE 0 END) AS renewals,
                  SUM(CASE WHEN op.status = 'paid' AND op.paid_date = ? THEN 1 ELSE 0 END) AS paid_today,
                  COALESCE(SUM(CASE WHEN op.status = 'paid' AND op.paid_date = ? THEN op.paid_amount ELSE 0 END), 0) AS paid_today_amount
                FROM obligation_payments op
                JOIN obligations o ON op.obligation_id = o.id
                LEFT JOIN obligation_categories c ON o.category_id = c.id";

        $row = $this->db->fetch($sql, [$today, $today, $end30, $today, $end60, $today, $end60, $today, $end60, $today, $today]) ?: [];
        return [
            'overdue'           => (int)($row['overdue'] ?? 0),
            'due_30'            => (int)($row['due_30'] ?? 0),
            'due_60'            => (int)($row['due_60'] ?? 0),
            'awaiting_approval' => (int)($row['awaiting_approval'] ?? 0),
            'missing_evidence'  => (int)($row['missing_evidence'] ?? 0),
            'tax_filings'       => (int)($row['tax_filings'] ?? 0),
            'renewals'          => (int)($row['renewals'] ?? 0),
            'paid_today'        => (int)($row['paid_today'] ?? 0),
            'paid_today_amount' => (float)($row['paid_today_amount'] ?? 0),
        ];
    }

    // ════════════════════════════════════════════════════════════
    // DUE DATE CALCULATION (used by cron + service)
    // ════════════════════════════════════════════════════════════

    /**
     * Compute the next due date for an obligation.
     *
     * @param string $frequency  weekly|monthly|quarterly|semi_annual|annual
     * @param int|null $dueDay   1-31 for monthly, 1-7 for weekly
     * @param int|null $dueMonth 1-12 for semi_annual/annual
     * @param string $fromDate   ISO date (Y-m-d), usually today
     */
    public function computeNextDueDate(string $frequency, ?int $dueDay, ?int $dueMonth, string $fromDate): string
    {
        $today = new DateTimeImmutable($fromDate);
        switch ($frequency) {
            case self::FREQ_WEEKLY:
                $targetWeekday = $dueDay !== null ? max(1, min(7, $dueDay)) : (int)$today->format('N');
                $currentWeekday = (int)$today->format('N');
                $delta = $targetWeekday >= $currentWeekday
                    ? ($targetWeekday - $currentWeekday)
                    : (7 - $currentWeekday + $targetWeekday);
                if ($delta === 0) $delta = 7;
                return $today->modify('+' . $delta . ' days')->format('Y-m-d');

            case self::FREQ_MONTHLY:
                $targetDay = $dueDay !== null ? max(1, min(31, $dueDay)) : 1;
                $year  = (int)$today->format('Y');
                $month = (int)$today->format('n');
                // If today is past the due day this month, advance to next month
                if ((int)$today->format('j') >= $targetDay) {
                    $month++;
                    if ($month > 12) { $month = 1; $year++; }
                }
                $lastDay = (int)cal_days_in_month(CAL_GREGORIAN, $month, $year);
                $day = min($targetDay, $lastDay);
                return sprintf('%04d-%02d-%02d', $year, $month, $day);

            case self::FREQ_QUARTERLY:
                $targetDay = $dueDay !== null ? max(1, min(31, $dueDay)) : 1;
                $year  = (int)$today->format('Y');
                $month = (int)$today->format('n');
                // Find next quarter end month
                $nextQ = (int)ceil($month / 3) * 3 + 1;
                if ($nextQ > 12) { $nextQ = 1; $year++; }
                $lastDay = (int)cal_days_in_month(CAL_GREGORIAN, $nextQ, $year);
                $day = min($targetDay, $lastDay);
                return sprintf('%04d-%02d-%02d', $year, $nextQ, $day);

            case self::FREQ_SEMI_ANNUAL:
                $targetDay = $dueDay !== null ? max(1, min(31, $dueDay)) : 1;
                $targetMonth = $dueMonth !== null ? max(1, min(12, $dueMonth)) : 7;
                $year = (int)$today->format('Y');
                $currentMonth = (int)$today->format('n');
                $currentYear = $year;
                $candidates = [
                    [$currentYear, $targetMonth],
                    [$currentYear + 1, $targetMonth],
                ];
                foreach ($candidates as [$y, $m]) {
                    $candidate = new DateTimeImmutable(sprintf('%04d-%02d-%02d', $y, $m, min($targetDay, (int)cal_days_in_month(CAL_GREGORIAN, $m, $y))));
                    if ($candidate > $today) {
                        return $candidate->format('Y-m-d');
                    }
                }
                return $candidates[1][0] . '-' . str_pad((string)$targetMonth, 2, '0', STR_PAD_LEFT) . '-' . str_pad((string)min($targetDay, 28), 2, '0', STR_PAD_LEFT);

            case self::FREQ_ANNUAL:
                $targetDay = $dueDay !== null ? max(1, min(31, $dueDay)) : 1;
                $targetMonth = $dueMonth !== null ? max(1, min(12, $dueMonth)) : 1;
                $year = (int)$today->format('Y');
                $candidate = new DateTimeImmutable(sprintf('%04d-%02d-%02d', $year, $targetMonth, min($targetDay, (int)cal_days_in_month(CAL_GREGORIAN, $targetMonth, $year))));
                if ($candidate > $today) {
                    return $candidate->format('Y-m-d');
                }
                $candidate = $candidate->modify('+1 year');
                return $candidate->format('Y-m-d');

            default:
                return $fromDate;
        }
    }

    /**
     * Compute the period (start/end) for a given frequency + due date.
     */
    public function computePeriod(string $frequency, string $dueDate): array
    {
        $due = new DateTimeImmutable($dueDate);
        switch ($frequency) {
            case self::FREQ_WEEKLY:
                $start = $due->modify('-6 days');
                return [$start->format('Y-m-d'), $due->format('Y-m-d')];

            case self::FREQ_MONTHLY:
                $start = $due->modify('first day of this month');
                $end   = $due->modify('last day of this month');
                return [$start->format('Y-m-d'), $end->format('Y-m-d')];

            case self::FREQ_QUARTERLY:
                $q = (int)ceil((int)$due->format('n') / 3);
                $startMonth = ($q - 1) * 3 + 1;
                $endMonth   = $q * 3;
                $start = new DateTimeImmutable(sprintf('%04d-%02d-01', (int)$due->format('Y'), $startMonth));
                $end   = new DateTimeImmutable(sprintf('%04d-%02d-%02d', (int)$due->format('Y'), $endMonth, (int)cal_days_in_month(CAL_GREGORIAN, $endMonth, (int)$due->format('Y'))));
                return [$start->format('Y-m-d'), $end->format('Y-m-d')];

            case self::FREQ_SEMI_ANNUAL:
                $month = (int)$due->format('n');
                $year  = (int)$due->format('Y');
                $startMonth = $month <= 6 ? 1 : 7;
                $endMonth   = $month <= 6 ? 6 : 12;
                $start = new DateTimeImmutable(sprintf('%04d-%02d-01', $year, $startMonth));
                $end   = new DateTimeImmutable(sprintf('%04d-%02d-%02d', $year, $endMonth, (int)cal_days_in_month(CAL_GREGORIAN, $endMonth, $year)));
                return [$start->format('Y-m-d'), $end->format('Y-m-d')];

            case self::FREQ_ANNUAL:
                $year  = (int)$due->format('Y');
                $start = new DateTimeImmutable(sprintf('%04d-01-01', $year));
                $end   = new DateTimeImmutable(sprintf('%04d-12-31', $year));
                return [$start->format('Y-m-d'), $end->format('Y-m-d')];

            default:
                return [$dueDate, $dueDate];
        }
    }
}
