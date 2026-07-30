<?php
/**
 * Business model — canonical entity layer above stores.
 * Hierarchy: holding → brand → store
 */
class Business {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    private function ensureSchema() {
        // Create businesses table if missing (idempotent)
        $this->db->execute(
            "CREATE TABLE IF NOT EXISTS businesses (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                name       VARCHAR(200) NOT NULL,
                short_name VARCHAR(50)  NULL,
                type       ENUM('holding','brand','store','other') NOT NULL DEFAULT 'store',
                parent_id  INT NULL DEFAULT NULL,
                color      VARCHAR(7)   NOT NULL DEFAULT '#6B7280',
                sort_order INT NOT NULL DEFAULT 0,
                is_active  TINYINT(1)   NOT NULL DEFAULT 1,
                created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        // Ensure stores has business_id
        if ($this->db->tableExists('stores') && !$this->db->columnExists('stores', 'business_id')) {
            $this->db->execute("ALTER TABLE stores ADD COLUMN business_id INT NULL DEFAULT NULL");
        }

        // Ensure bills has business_id
        if ($this->db->tableExists('bills') && !$this->db->columnExists('bills', 'business_id')) {
            $this->db->execute("ALTER TABLE bills ADD COLUMN business_id INT NULL DEFAULT NULL");
        }
    }

    /** All businesses (flat list), ordered by sort_order then name */
    public function getAll($activeOnly = false) {
        $where = $activeOnly ? 'WHERE is_active = 1' : '';
        return $this->db->fetchAll(
            "SELECT * FROM businesses $where ORDER BY sort_order ASC, name ASC"
        );
    }

    /** All active top-level holdings */
    public function getHoldings() {
        return $this->db->fetchAll(
            "SELECT * FROM businesses WHERE parent_id IS NULL AND is_active = 1 ORDER BY sort_order, name"
        );
    }

    /** Children of a given business */
    public function getChildren($parentId) {
        return $this->db->fetchAll(
            "SELECT * FROM businesses WHERE parent_id = ? AND is_active = 1 ORDER BY sort_order, name",
            [$parentId]
        );
    }

    /** Full tree: each holding contains ->children array */
    public function getTree() {
        $all = $this->getAll(true);
        $indexed = [];
        foreach ($all as $b) {
            $b['children'] = [];
            $indexed[$b['id']] = $b;
        }
        $roots = [];
        foreach ($indexed as $id => $b) {
            if ($b['parent_id'] && isset($indexed[$b['parent_id']])) {
                $indexed[$b['parent_id']]['children'][] = &$indexed[$id];
            } else {
                $roots[] = &$indexed[$id];
            }
        }
        return $roots;
    }

    public function find($id) {
        return $this->db->fetch("SELECT * FROM businesses WHERE id = ?", [$id]);
    }

    public function create($data) {
        return $this->db->insert(
            "INSERT INTO businesses (name, short_name, type, parent_id, color, sort_order, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 1)",
            [
                $data['name'],
                $data['short_name'] ?? null,
                $data['type'] ?? 'store',
                $data['parent_id'] ?? null,
                $data['color'] ?? '#6B7280',
                $data['sort_order'] ?? 0,
            ]
        );
    }

    public function update($id, $data) {
        return $this->db->execute(
            "UPDATE businesses SET name=?, short_name=?, type=?, parent_id=?, color=?, sort_order=?, updated_at=NOW() WHERE id=?",
            [
                $data['name'],
                $data['short_name'] ?? null,
                $data['type'] ?? 'store',
                $data['parent_id'] ?? null,
                $data['color'] ?? '#6B7280',
                $data['sort_order'] ?? 0,
                $id,
            ]
        );
    }

    public function toggleActive($id) {
        return $this->db->execute(
            "UPDATE businesses SET is_active = NOT is_active, updated_at=NOW() WHERE id=?", [$id]
        );
    }

    /**
     * CEO Dashboard: financial health per business.
     * Returns per-business bill stats for a given month/year.
     */
    public function getCeoFinancialSummary($month, $year) {
        if (!$this->db->tableExists('bills') || !$this->db->tableExists('stores')) {
            return [];
        }

        $hasBusinessId = $this->db->columnExists('bills', 'business_id');

        if ($hasBusinessId) {
            // Direct join via bills.business_id
            $rows = $this->db->fetchAll(
                "SELECT
                    biz.id         AS business_id,
                    biz.name       AS business_name,
                    biz.short_name,
                    biz.color,
                    biz.type,
                    COUNT(b.id)                                           AS total_bills,
                    SUM(b.status = 'paid')                                AS paid_count,
                    SUM(b.status = 'pending')                             AS pending_count,
                    SUM(b.status = 'overdue')                             AS overdue_count,
                    COALESCE(SUM(b.amount),0)                             AS total_amount,
                    COALESCE(SUM(CASE WHEN b.status='paid'    THEN b.amount ELSE 0 END),0) AS paid_amount,
                    COALESCE(SUM(CASE WHEN b.status='overdue' THEN b.amount ELSE 0 END),0) AS overdue_amount,
                    COALESCE(SUM(CASE WHEN b.status IN ('pending','overdue') THEN b.amount ELSE 0 END),0) AS unpaid_amount
                 FROM businesses biz
                 LEFT JOIN bills b ON b.business_id = biz.id
                     AND MONTH(b.due_date) = ? AND YEAR(b.due_date) = ?
                 WHERE biz.is_active = 1
                 GROUP BY biz.id, biz.name, biz.short_name, biz.color, biz.type
                 ORDER BY biz.sort_order, biz.name",
                [$month, $year]
            );
        } else {
            // Fallback: join via stores.business_id
            $rows = $this->db->fetchAll(
                "SELECT
                    biz.id         AS business_id,
                    biz.name       AS business_name,
                    biz.short_name,
                    biz.color,
                    biz.type,
                    COUNT(b.id)                                           AS total_bills,
                    SUM(b.status = 'paid')                                AS paid_count,
                    SUM(b.status = 'pending')                             AS pending_count,
                    SUM(b.status = 'overdue')                             AS overdue_count,
                    COALESCE(SUM(b.amount),0)                             AS total_amount,
                    COALESCE(SUM(CASE WHEN b.status='paid'    THEN b.amount ELSE 0 END),0) AS paid_amount,
                    COALESCE(SUM(CASE WHEN b.status='overdue' THEN b.amount ELSE 0 END),0) AS overdue_amount,
                    COALESCE(SUM(CASE WHEN b.status IN ('pending','overdue') THEN b.amount ELSE 0 END),0) AS unpaid_amount
                 FROM businesses biz
                 LEFT JOIN stores s  ON s.business_id = biz.id AND s.is_active = 1
                 LEFT JOIN bills b   ON b.store_id = s.id
                     AND MONTH(b.due_date) = ? AND YEAR(b.due_date) = ?
                 WHERE biz.is_active = 1
                 GROUP BY biz.id, biz.name, biz.short_name, biz.color, biz.type
                 ORDER BY biz.sort_order, biz.name",
                [$month, $year]
            );
        }

        // Add health status to each
        foreach ($rows as &$row) {
            $row['health'] = $this->computeHealth($row);
        }
        unset($row);

        return $rows;
    }

    /**
     * Determine business health label based on bill stats.
     * Returns: 'critical' | 'at_risk' | 'on_track' | 'none'
     */
    private function computeHealth($row) {
        if ($row['total_bills'] == 0) {
            return 'none';
        }
        if ($row['overdue_count'] > 0) {
            return 'critical';
        }
        $unpaidRatio = $row['total_bills'] > 0
            ? ($row['pending_count'] / $row['total_bills'])
            : 0;
        if ($unpaidRatio > 0.5) {
            return 'at_risk';
        }
        return 'on_track';
    }

    /**
     * Stores belonging to this business (with active bill count).
     */
    public function getStores($businessId) {
        if (!$this->db->tableExists('stores')) {
            return [];
        }
        return $this->db->fetchAll(
            "SELECT s.*,
                    (SELECT COUNT(*) FROM bills b WHERE b.store_id=s.id AND b.status IN ('pending','overdue')) AS open_bills
             FROM stores s
             WHERE s.business_id = ? AND s.is_active = 1
             ORDER BY s.name",
            [$businessId]
        );
    }
}
