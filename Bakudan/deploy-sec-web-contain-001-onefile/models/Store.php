<?php
class Store {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    private function ensureSchema() {
        // Add business_id if missing
        if ($this->db->tableExists('stores') && !$this->db->columnExists('stores', 'business_id')) {
            try {
                $this->db->execute("ALTER TABLE stores ADD COLUMN business_id INT NULL DEFAULT NULL");
            } catch (Exception $e) {}
        }
        // Add type if missing
        if ($this->db->tableExists('stores') && !$this->db->columnExists('stores', 'type')) {
            try {
                $this->db->execute("ALTER TABLE stores ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'store'");
            } catch (Exception $e) {}
        }
    }

    private function hasBusinessId() {
        return $this->db->columnExists('stores', 'business_id');
    }

    /** All active stores, optionally with business info */
    public function allActive($withBusiness = false) {
        if ($withBusiness && $this->hasBusinessId() && $this->db->tableExists('businesses')) {
            return $this->db->fetchAll(
                "SELECT s.*, b.name AS business_name, b.color AS business_color, b.short_name AS business_short
                 FROM stores s
                 LEFT JOIN businesses b ON b.id = s.business_id
                 WHERE s.is_active = 1
                 ORDER BY b.sort_order ASC, s.name ASC"
            );
        }
        return $this->db->fetchAll("SELECT * FROM stores WHERE is_active = 1 ORDER BY name");
    }

    /** Stores grouped by business */
    public function allGroupedByBusiness() {
        if (!$this->hasBusinessId() || !$this->db->tableExists('businesses')) {
            $stores = $this->allActive();
            return [['business_name' => 'All', 'stores' => $stores]];
        }

        $rows = $this->db->fetchAll(
            "SELECT s.*, b.name AS business_name, b.color AS business_color,
                    b.short_name AS business_short, b.sort_order AS biz_sort
             FROM stores s
             LEFT JOIN businesses b ON b.id = s.business_id
             WHERE s.is_active = 1
             ORDER BY COALESCE(b.sort_order, 999), b.name, s.name"
        );

        $groups = [];
        foreach ($rows as $row) {
            $key = $row['business_name'] ?? 'Other';
            if (!isset($groups[$key])) {
                $groups[$key] = [
                    'business_name'  => $key,
                    'business_color' => $row['business_color'] ?? '#6B7280',
                    'stores'         => [],
                ];
            }
            $groups[$key]['stores'][] = $row;
        }
        return array_values($groups);
    }

    public function find($id) {
        if ($this->hasBusinessId() && $this->db->tableExists('businesses')) {
            return $this->db->fetch(
                "SELECT s.*, b.name AS business_name, b.color AS business_color, b.short_name AS business_short
                 FROM stores s
                 LEFT JOIN businesses b ON b.id = s.business_id
                 WHERE s.id = ?",
                [$id]
            );
        }
        return $this->db->fetch("SELECT * FROM stores WHERE id = ?", [$id]);
    }

    public function create($data) {
        if ($this->hasBusinessId()) {
            return $this->db->insert(
                "INSERT INTO stores (name, address, color, business_id, is_active, created_at) VALUES (?, ?, ?, ?, 1, NOW())",
                [$data['name'], $data['address'] ?? null, $data['color'] ?? null, $data['business_id'] ?? null]
            );
        }
        return $this->db->insert(
            "INSERT INTO stores (name, address, color, is_active, created_at) VALUES (?, ?, ?, 1, NOW())",
            [$data['name'], $data['address'] ?? null, $data['color'] ?? null]
        );
    }

    public function update($id, $data) {
        if ($this->hasBusinessId()) {
            return $this->db->execute(
                "UPDATE stores SET name = ?, address = ?, color = ?, business_id = ? WHERE id = ?",
                [$data['name'], $data['address'] ?? null, $data['color'] ?? null, $data['business_id'] ?? null, $id]
            );
        }
        return $this->db->execute(
            "UPDATE stores SET name = ?, address = ?, color = ? WHERE id = ?",
            [$data['name'], $data['address'] ?? null, $data['color'] ?? null, $id]
        );
    }

    public function delete($id) {
        // Soft delete — bills/tasks reference this store
        return $this->db->execute("UPDATE stores SET is_active = 0 WHERE id = ?", [$id]);
    }

    /** Assign store to a business */
    public function assignBusiness($storeId, $businessId) {
        if (!$this->hasBusinessId()) return 0;
        return $this->db->execute(
            "UPDATE stores SET business_id = ? WHERE id = ?",
            [$businessId, $storeId]
        );
    }

    /** Get all stores for a specific business */
    public function getByBusiness($businessId) {
        return $this->db->fetchAll(
            "SELECT * FROM stores WHERE business_id = ? AND is_active = 1 ORDER BY name",
            [$businessId]
        );
    }
}
