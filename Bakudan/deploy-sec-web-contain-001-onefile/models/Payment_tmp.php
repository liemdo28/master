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
                created_by INT           NULL DEFAULT NULL,
                created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );
    }

    /** All payment records for a bill */
    public function getForBill($billId) {
        return $this->db->fetchAll(
            "SELECT p.*, u.name AS created_by_name
             FROM payments p
             LEFT JOIN users u ON u.id = p.created_by
             WHERE p.bill_id = ?
             ORDER BY p.paid_at DESC",
            [$billId]
        );
    }

    /** Most recent payment for a bill */
    public function lastForBill($billId) {
        return $this->db->fetch(
            "SELECT p.*, u.name AS created_by_name
             FROM payments p
             LEFT JOIN users u ON u.id = p.created_by
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

        return $this->db->insert(
            "INSERT INTO payments (bill_id, amount, paid_at, method, reference, note, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                $data['bill_id'],
                $data['amount'] ?? 0.00,
                $paidAt,
                $data['method'] ?? 'bank_transfer',
                $data['reference'] ?? null,
                $data['note'] ?? null,
                $data['created_by'] ?? ($_SESSION['user_id'] ?? null),
            ]
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
}
