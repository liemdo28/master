<?php
class Vendor {
    private $db;
    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    private function normalizedName($name) {
        return mb_strtolower(trim((string) $name));
    }

    private function ensureSchema() {
        $this->db->execute(
            "CREATE TABLE IF NOT EXISTS vendors (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                payment_url VARCHAR(500) NULL,
                login_info TEXT NULL,
                notes TEXT NULL,
                is_active TINYINT(1) DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        if ($this->db->tableExists('bills') && !$this->db->columnExists('bills', 'vendor_id')) {
            $this->db->execute("ALTER TABLE bills ADD COLUMN vendor_id INT NULL AFTER vendor");
        }

        $this->db->execute(
            "CREATE TABLE IF NOT EXISTS vendor_attachments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                vendor_id INT NOT NULL,
                filename VARCHAR(255) NOT NULL,
                original_name VARCHAR(255) NOT NULL,
                file_size INT DEFAULT 0,
                mime_type VARCHAR(100),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );
    }

    private function hasVendorsTable() {
        return $this->db->tableExists('vendors');
    }

    private function hasAttachmentsTable() {
        return $this->db->tableExists('vendor_attachments');
    }

    public function getAll() {
        if (!$this->hasVendorsTable()) return [];
        return $this->db->fetchAll("SELECT * FROM vendors ORDER BY name");
    }

    public function getAllWithOverview() {
        if (!$this->hasVendorsTable()) return [];
        if (!$this->db->tableExists('bills') || !$this->db->tableExists('stores')) {
            return $this->getAll();
        }

        return $this->db->fetchAll(
            "SELECT
                v.id,
                v.name,
                v.payment_url,
                v.login_info,
                v.notes,
                v.is_active,
                v.created_at,
                v.updated_at,
                COALESCE(GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR '||'), '') AS store_names,
                (
                    SELECT b2.due_date
                    FROM bills b2
                    WHERE b2.vendor_id = v.id
                       OR (b2.vendor_id IS NULL AND LOWER(TRIM(b2.vendor)) = LOWER(TRIM(v.name)))
                    ORDER BY (b2.due_date >= CURDATE()) DESC, b2.due_date ASC
                    LIMIT 1
                ) AS next_due_date,
                (
                    SELECT s2.name
                    FROM bills b3
                    JOIN stores s2 ON s2.id = b3.store_id
                    WHERE b3.vendor_id = v.id
                       OR (b3.vendor_id IS NULL AND LOWER(TRIM(b3.vendor)) = LOWER(TRIM(v.name)))
                    ORDER BY (b3.due_date >= CURDATE()) DESC, b3.due_date ASC
                    LIMIT 1
                ) AS next_store_name
             FROM vendors v
             LEFT JOIN bills b ON b.vendor_id = v.id
                OR (b.vendor_id IS NULL AND LOWER(TRIM(b.vendor)) = LOWER(TRIM(v.name)))
             LEFT JOIN stores s ON s.id = b.store_id
             GROUP BY
                v.id, v.name, v.payment_url, v.login_info, v.notes,
                v.is_active, v.created_at, v.updated_at
             ORDER BY v.name"
        );
    }

    public function getAllActive() {
        if (!$this->hasVendorsTable()) return [];
        return $this->db->fetchAll("SELECT * FROM vendors WHERE is_active = 1 ORDER BY name");
    }

    public function find($id) {
        if (!$this->hasVendorsTable()) return null;
        return $this->db->fetch("SELECT * FROM vendors WHERE id = ?", [$id]);
    }

    public function findByName($name) {
        if (!$this->hasVendorsTable()) return null;
        $normalized = $this->normalizedName($name);
        if ($normalized === '') return null;

        return $this->db->fetch(
            "SELECT * FROM vendors WHERE LOWER(TRIM(name)) = ? LIMIT 1",
            [$normalized]
        );
    }

    public function create($data) {
        if (!$this->hasVendorsTable()) return null;
        return $this->db->insert(
            "INSERT INTO vendors (name, payment_url, login_info, notes, is_active, created_at) VALUES (?, ?, ?, ?, 1, NOW())",
            [$data['name'], $data['payment_url'] ?? null, $data['login_info'] ?? null, $data['notes'] ?? null]
        );
    }

    public function createOrGet($data) {
        $existing = $this->findByName($data['name'] ?? '');
        if ($existing) {
            $this->update($existing['id'], [
                'name' => $data['name'] ?? $existing['name'],
                'payment_url' => $this->pickMergedValue($data['payment_url'] ?? null, $existing['payment_url'] ?? null),
                'login_info' => $this->pickMergedValue($data['login_info'] ?? null, $existing['login_info'] ?? null),
                'notes' => $this->pickMergedValue($data['notes'] ?? null, $existing['notes'] ?? null),
            ]);
            return (int) $existing['id'];
        }
        return $this->create($data);
    }

    private function pickMergedValue($incoming, $fallback) {
        $incoming = is_string($incoming) ? trim($incoming) : $incoming;
        if ($incoming === null || $incoming === '') return $fallback;
        return $incoming;
    }

    public function update($id, $data) {
        if (!$this->hasVendorsTable()) return 0;
        return $this->db->execute(
            "UPDATE vendors SET name = ?, payment_url = ?, login_info = ?, notes = ?, updated_at = NOW() WHERE id = ?",
            [$data['name'], $data['payment_url'] ?? null, $data['login_info'] ?? null, $data['notes'] ?? null, $id]
        );
    }

    public function delete($id) {
        if (!$this->hasVendorsTable()) return 0;
        return $this->db->execute("DELETE FROM vendors WHERE id = ?", [$id]);
    }

    public function toggleActive($id) {
        if (!$this->hasVendorsTable()) return 0;
        return $this->db->execute("UPDATE vendors SET is_active = NOT is_active, updated_at = NOW() WHERE id = ?", [$id]);
    }

    // Attachments
    public function getAttachments($vendorId) {
        if (!$this->hasAttachmentsTable()) return [];
        return $this->db->fetchAll("SELECT * FROM vendor_attachments WHERE vendor_id = ? ORDER BY created_at DESC", [$vendorId]);
    }

    public function addAttachment($data) {
        if (!$this->hasAttachmentsTable()) return null;
        return $this->db->insert(
            "INSERT INTO vendor_attachments (vendor_id, filename, original_name, file_size, mime_type, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
            [$data['vendor_id'], $data['filename'], $data['original_name'], $data['file_size'], $data['mime_type']]
        );
    }

    public function findAttachment($id) {
        if (!$this->hasAttachmentsTable()) return null;
        return $this->db->fetch("SELECT * FROM vendor_attachments WHERE id = ?", [$id]);
    }

    public function deleteAttachment($id) {
        if (!$this->hasAttachmentsTable()) return null;
        $att = $this->findAttachment($id);
        if ($att) {
            $filepath = UPLOAD_DIR . $att['filename'];
            if (file_exists($filepath)) unlink($filepath);
            $this->db->execute("DELETE FROM vendor_attachments WHERE id = ?", [$id]);
        }
        return $att;
    }

    // Quick create from bill form - returns new vendor ID
    public function quickCreate($name) {
        return $this->createOrGet([
            'name' => $name,
            'payment_url' => null,
            'login_info' => null,
            'notes' => null,
        ]);
    }

    public function syncBillsForVendor($vendorId, $vendorName, $matchName = null) {
        if (!$this->hasVendorsTable()) return 0;
        if (!$this->db->tableExists('bills')) return 0;
        if (!$this->db->columnExists('bills', 'vendor_id')) return 0;

        $normalized = $this->normalizedName($matchName ?? $vendorName);
        if ($normalized === '') return 0;

        return $this->db->execute(
            "UPDATE bills
             SET vendor = ?, vendor_id = ?
             WHERE vendor_id = ?
             OR (vendor_id IS NULL AND LOWER(TRIM(vendor)) = ?)",
            [$vendorName, $vendorId, $vendorId, $normalized]
        );
    }

    public function syncFromBills() {
        if (!$this->db->tableExists('bills')) return;

        $rows = $this->db->fetchAll(
            "SELECT DISTINCT TRIM(vendor) AS vendor_name
             FROM bills
             WHERE vendor IS NOT NULL AND TRIM(vendor) <> ''"
        );

        foreach ($rows as $row) {
            $name = trim($row['vendor_name'] ?? '');
            if ($name === '') continue;

            $vendorId = $this->createOrGet([
                'name' => $name,
                'payment_url' => null,
                'login_info' => null,
                'notes' => null,
            ]);

            if ($vendorId) {
                $this->syncBillsForVendor($vendorId, $name);
            }
        }
    }
}
