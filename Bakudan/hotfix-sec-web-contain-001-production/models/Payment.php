<?php
/**
 * Payment model — records actual payment events for bills.
 * A bill can have multiple payment records (partial payments, corrections).
 */
class Payment {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    private function ensureSchema() {
        $this->db->execute(
            "CREATE TABLE IF NOT EXISTS payments (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                bill_id    INT NOT NULL,
                amount     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                paid_at    DATETIME      NOT NULL,
                method     ENUM('bank_transfer','cash','check','card','zelle','auto','ach','wire','other')
                           NOT NULL DEFAULT 'bank_transfer',
                reference  VARCHAR(200)  NULL DEFAULT NULL,
                note       TEXT          NULL,
                reviewer_id INT         NULL DEFAULT NULL,
                reviewer_due_date DATE  NULL DEFAULT NULL,
                review_instructions TEXT NULL,
                review_status VARCHAR(30) NOT NULL DEFAULT 'not_required',
                reviewed_at DATETIME    NULL DEFAULT NULL,
                reviewed_by INT         NULL DEFAULT NULL,
                verifier_user_id INT     NULL DEFAULT NULL,
                created_by INT           NULL DEFAULT NULL,
                created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        if ($this->db->tableExists('payments')) {
            foreach ([
                'verifier_user_id' => "ALTER TABLE payments ADD COLUMN verifier_user_id INT NULL DEFAULT NULL",
                'verified_at' => "ALTER TABLE payments ADD COLUMN verified_at DATETIME NULL DEFAULT NULL",
                'reviewer_id' => "ALTER TABLE payments ADD COLUMN reviewer_id INT NULL DEFAULT NULL",
                'reviewer_due_date' => "ALTER TABLE payments ADD COLUMN reviewer_due_date DATE NULL DEFAULT NULL",
                'review_instructions' => "ALTER TABLE payments ADD COLUMN review_instructions TEXT NULL",
                'review_status' => "ALTER TABLE payments ADD COLUMN review_status VARCHAR(30) NOT NULL DEFAULT 'not_required'",
                'reviewed_at' => "ALTER TABLE payments ADD COLUMN reviewed_at DATETIME NULL DEFAULT NULL",
                'reviewed_by' => "ALTER TABLE payments ADD COLUMN reviewed_by INT NULL DEFAULT NULL",
            ] as $column => $sql) {
                if (!$this->db->columnExists('payments', $column)) {
                    try {
                        $this->db->execute($sql);
                        $this->db->invalidateSchemaCache('payments');
                    } catch (Exception $e) {}
                }
            }
        }
    }

    /** All payment records for a bill */
    public function getForBill($billId) {
        $verifierSelect = $this->db->columnExists('payments', 'verifier_user_id') ? ', vu.name AS verifier_name' : ", NULL AS verifier_name";
        $reviewerSelect = $this->db->columnExists('payments', 'reviewer_id') ? ', ru.name AS reviewer_name' : ", NULL AS reviewer_name";
        $verifierJoin = $this->db->columnExists('payments', 'verifier_user_id') ? 'LEFT JOIN users vu ON vu.id = p.verifier_user_id' : '';
        $reviewerJoin = $this->db->columnExists('payments', 'reviewer_id') ? 'LEFT JOIN users ru ON ru.id = p.reviewer_id' : '';
        return $this->db->fetchAll(
            "SELECT p.*, u.name AS created_by_name{$verifierSelect}{$reviewerSelect}
             FROM payments p
             LEFT JOIN users u ON u.id = p.created_by
             {$verifierJoin}
             {$reviewerJoin}
             WHERE p.bill_id = ?
             ORDER BY p.paid_at DESC",
            [$billId]
        );
    }

    /** Most recent payment for a bill */
    public function lastForBill($billId) {
        $verifierSelect = $this->db->columnExists('payments', 'verifier_user_id') ? ', vu.name AS verifier_name' : ", NULL AS verifier_name";
        $verifierJoin = $this->db->columnExists('payments', 'verifier_user_id') ? 'LEFT JOIN users vu ON vu.id = p.verifier_user_id' : '';
        return $this->db->fetch(
            "SELECT p.*, u.name AS created_by_name{$verifierSelect}
             FROM payments p
             LEFT JOIN users u ON u.id = p.created_by
             {$verifierJoin}
             WHERE p.bill_id = ?
             ORDER BY p.paid_at DESC LIMIT 1",
            [$billId]
        );
    }

    public function find($id) {
        return $this->db->fetch("SELECT * FROM payments WHERE id = ?", [$id]);
    }

    public function create($data) {
        $paidAt = !empty($data['paid_at'])
            ? date('Y-m-d H:i:s', strtotime($data['paid_at']))
            : date('Y-m-d H:i:s');

        $fields = ['bill_id', 'amount', 'paid_at', 'method', 'reference', 'note', 'created_by'];
        $placeholders = ['?', '?', '?', '?', '?', '?', '?'];
        $params = [
            $data['bill_id'],
            $data['amount'] ?? 0.00,
            $paidAt,
            $data['method'] ?? 'bank_transfer',
            $data['reference'] ?? null,
            $data['note'] ?? null,
            $data['created_by'] ?? ($_SESSION['user_id'] ?? null),
        ];

        if ($this->db->columnExists('payments', 'verifier_user_id')) {
            $fields[] = 'verifier_user_id';
            $placeholders[] = '?';
            $params[] = !empty($data['verifier_user_id']) ? (int)$data['verifier_user_id'] : null;
        }
        foreach (['reviewer_id', 'reviewer_due_date', 'review_instructions', 'review_status'] as $optionalField) {
            if ($this->db->columnExists('payments', $optionalField)) {
                $fields[] = $optionalField;
                $placeholders[] = '?';
                if ($optionalField === 'review_status' && !array_key_exists('review_status', $data)) {
                    $params[] = !empty($data['reviewer_id']) ? 'pending_review' : 'not_required';
                } else {
                    $params[] = $data[$optionalField] ?? null;
                }
            }
        }

        return $this->db->insert(
            "INSERT INTO payments (" . implode(', ', $fields) . ")
             VALUES (" . implode(', ', $placeholders) . ")",
            $params
        );
    }

    public function delete($id) {
        return $this->db->execute("DELETE FROM payments WHERE id = ?", [$id]);
    }

    /** Total paid amount for a bill */
    public function totalForBill($billId) {
        $row = $this->db->fetch(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE bill_id = ?",
            [$billId]
        );
        return $row ? (float)$row['total'] : 0.0;
    }

    /** Monthly payment stats across all businesses */
    public function monthlySummary($month, $year) {
        return $this->db->fetch(
            "SELECT
                COUNT(*)           AS total_payments,
                COALESCE(SUM(p.amount), 0) AS total_amount,
                COUNT(DISTINCT p.bill_id)  AS bills_paid
             FROM payments p
             WHERE MONTH(p.paid_at) = ? AND YEAR(p.paid_at) = ?",
            [$month, $year]
        );
    }

    /** Payment totals grouped by method for a month */
    public function byMethod($month, $year) {
        return $this->db->fetchAll(
            "SELECT method, COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS total
             FROM payments
             WHERE MONTH(paid_at) = ? AND YEAR(paid_at) = ?
             GROUP BY method
             ORDER BY total DESC",
            [$month, $year]
        );
    }

    /** Recent payment history (cross-business), for activity feed */
    public function recent($limit = 20) {
        if (!$this->db->tableExists('bills') || !$this->db->tableExists('stores')) {
            return [];
        }
        return $this->db->fetchAll(
            "SELECT p.*, b.title AS bill_title, s.name AS store_name, s.color AS store_color,
                    u.name AS paid_by_name
             FROM payments p
             JOIN bills b  ON b.id  = p.bill_id
             JOIN stores s ON s.id  = b.store_id
             LEFT JOIN users u ON u.id = p.created_by
             ORDER BY p.paid_at DESC
             LIMIT ?",
            [$limit]
        );
    }

    // ══════════════════════════════════════════════════════════════
    // V9: PAYMENT → BILL LINK + STORE + FILTERING
    // ══════════════════════════════════════════════════════════════

    /**
     * Get payments with full bill + store context.
     */
    public function getWithContext(
        ?int $storeId = null,
        ?int $billId = null,
        ?string $method = null,
        ?string $startDate = null,
        ?string $endDate = null,
        int $limit = 200
    ): array {
        $conditions = [];
        $params = [];

        if ($storeId) {
            $conditions[] = "b.store_id = ?";
            $params[] = $storeId;
        }
        if ($billId) {
            $conditions[] = "p.bill_id = ?";
            $params[] = $billId;
        }
        if ($method) {
            $conditions[] = "p.method = ?";
            $params[] = $method;
        }
        if ($startDate) {
            $conditions[] = "p.paid_at >= ?";
            $params[] = $startDate . ' 00:00:00';
        }
        if ($endDate) {
            $conditions[] = "p.paid_at <= ?";
            $params[] = $endDate . ' 23:59:59';
        }

        $where = $conditions ? "WHERE " . implode(' AND ', $conditions) : "WHERE 1=1";
        $params[] = $limit;

        return $this->db->fetchAll(
            "SELECT p.*,
                    b.title AS bill_title, b.amount AS bill_amount,
                    b.finance_category, b.workflow_status AS bill_status,
                    s.name AS store_name, s.color AS store_color,
                    u.name AS created_by_name,
                    vu.name AS verifier_name
             FROM payments p
             JOIN bills b ON b.id = p.bill_id
             JOIN stores s ON s.id = COALESCE(p.store_id, b.store_id)
             LEFT JOIN users u ON u.id = p.created_by
             LEFT JOIN users vu ON vu.id = p.verifier_user_id
             {$where}
             ORDER BY p.paid_at DESC
             LIMIT ?",
            $params
        );
    }

    /**
     * Record a payment and update bill workflow_status to 'paid' if fully paid.
     */
    public function createAndSettle($data): int {
        $billId = (int)($data['bill_id'] ?? 0);
        $amount = (float)($data['amount'] ?? 0);
        $paidAt = !empty($data['paid_at'])
            ? date('Y-m-d H:i:s', strtotime($data['paid_at']))
            : date('Y-m-d H:i:s');

        // Insert payment
        $paymentId = $this->create($data);
        if (!$paymentId) return 0;

        // Update payment's store_id from bill if not set
        if ($this->db->columnExists('payments', 'store_id')) {
            $bill = (new Bill())->find($billId);
            if ($bill && !empty($bill['store_id'])) {
                $this->db->update("UPDATE payments SET store_id = ? WHERE id = ?", [$bill['store_id'], $paymentId]);
            }
        }

        // Check if bill is fully paid → auto-update workflow_status
        $totalPaid = $this->totalForBill($billId);
        $bill = (new Bill())->find($billId);
        if ($bill && (float)$bill['amount'] > 0 && $totalPaid >= (float)$bill['amount']) {
            (new Bill())->markPaid($billId);
            if ($this->db->columnExists('bills', 'workflow_status')) {
                $this->db->update("UPDATE bills SET workflow_status = 'paid', updated_at = NOW() WHERE id = ?", [$billId]);
            }
        }

        return $paymentId;
    }

    /**
     * Monthly payment summary by store.
     */
    public function monthlyByStore(int $year, int $month): array {
        return $this->db->fetchAll(
            "SELECT
                s.id AS store_id, s.name AS store_name, s.color AS store_color,
                COUNT(p.id) AS payment_count,
                COALESCE(SUM(p.amount), 0) AS total_paid,
                COUNT(DISTINCT p.bill_id) AS bills_paid
             FROM payments p
             JOIN bills b ON b.id = p.bill_id
             JOIN stores s ON s.id = COALESCE(p.store_id, b.store_id)
             WHERE YEAR(p.paid_at) = ? AND MONTH(p.paid_at) = ?
             GROUP BY s.id, s.name, s.color
             ORDER BY total_paid DESC",
            [$year, $month]
        );
    }

    /**
     * Get payment methods summary.
     */
    public function methodsSummary(?int $storeId = null): array {
        $storeClause = $storeId ? "AND b.store_id = ?" : "";
        $params = $storeId ? [$storeId] : [];
        return $this->db->fetchAll(
            "SELECT p.method,
                    COUNT(p.id) AS payment_count,
                    COALESCE(SUM(p.amount), 0) AS total_amount,
                    AVG(p.amount) AS avg_amount
             FROM payments p
             JOIN bills b ON b.id = p.bill_id
             WHERE 1=1 {$storeClause}
             GROUP BY p.method
             ORDER BY total_amount DESC",
            $params
        );
    }
}
