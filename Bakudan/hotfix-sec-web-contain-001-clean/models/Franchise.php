<?php
/**
 * Franchise Model — Multi-Store Hierarchy & Organization
 * 
 * Supports: Company → Region → District → Store hierarchy
 */
class Franchise
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    private function ensureSchema(): void
    {
        if (defined('SKIP_SCHEMA_CHECKS') && SKIP_SCHEMA_CHECKS) return;
        if (!$this->db->tableExists('regions')) {
            $sql = file_get_contents(__DIR__ . '/../database/migrations/2026_05_29_franchise_platform.sql');
            $statements = array_filter(array_map('trim', explode(';', $sql)));
            foreach ($statements as $stmt) {
                if (!empty($stmt) && !str_starts_with($stmt, '--')) {
                    try { $this->db->execute($stmt); } catch (\Throwable $e) { /* skip duplicates */ }
                }
            }
        }
    }

    // ── Regions ──────────────────────────────────────────────────────────────

    public function getRegions(): array
    {
        return $this->db->fetchAll(
            "SELECT r.*, u.name AS manager_name,
                    (SELECT COUNT(*) FROM districts d WHERE d.region_id = r.id) AS district_count,
                    (SELECT COUNT(*) FROM stores s WHERE s.region_id = r.id AND s.is_active = 1) AS store_count
             FROM regions r
             LEFT JOIN users u ON u.id = r.manager_id
             WHERE r.is_active = 1
             ORDER BY r.name"
        );
    }

    public function getRegion(int $id): ?array
    {
        return $this->db->fetch("SELECT * FROM regions WHERE id = ?", [$id]) ?: null;
    }

    public function createRegion(array $data): int
    {
        return $this->db->insert('regions', [
            'name'       => $data['name'],
            'code'       => $data['code'] ?? null,
            'country'    => $data['country'] ?? 'US',
            'timezone'   => $data['timezone'] ?? 'America/Los_Angeles',
            'manager_id' => $data['manager_id'] ?? null,
        ]);
    }

    public function updateRegion(int $id, array $data): void
    {
        $this->db->update('regions', $data, 'id = ?', [$id]);
    }

    // ── Districts ────────────────────────────────────────────────────────────

    public function getDistricts(?int $regionId = null): array
    {
        $where = $regionId ? 'AND d.region_id = ?' : '';
        $params = $regionId ? [$regionId] : [];
        return $this->db->fetchAll(
            "SELECT d.*, r.name AS region_name, u.name AS manager_name,
                    (SELECT COUNT(*) FROM stores s WHERE s.district_id = d.id AND s.is_active = 1) AS store_count
             FROM districts d
             LEFT JOIN regions r ON r.id = d.region_id
             LEFT JOIN users u ON u.id = d.manager_id
             WHERE d.is_active = 1 {$where}
             ORDER BY r.name, d.name",
            $params
        );
    }

    public function getDistrict(int $id): ?array
    {
        return $this->db->fetch("SELECT * FROM districts WHERE id = ?", [$id]) ?: null;
    }

    public function createDistrict(array $data): int
    {
        return $this->db->insert('districts', [
            'name'       => $data['name'],
            'code'       => $data['code'] ?? null,
            'region_id'  => $data['region_id'] ?? null,
            'manager_id' => $data['manager_id'] ?? null,
        ]);
    }

    public function updateDistrict(int $id, array $data): void
    {
        $this->db->update('districts', $data, 'id = ?', [$id]);
    }

    // ── Hierarchy Tree ───────────────────────────────────────────────────────

    public function getFullHierarchy(): array
    {
        $regions = $this->db->fetchAll(
            "SELECT r.*, u.name AS manager_name FROM regions r LEFT JOIN users u ON u.id = r.manager_id WHERE r.is_active = 1 ORDER BY r.name"
        );
        $districts = $this->db->fetchAll(
            "SELECT d.*, u.name AS manager_name FROM districts d LEFT JOIN users u ON u.id = d.manager_id WHERE d.is_active = 1 ORDER BY d.name"
        );
        $stores = $this->db->fetchAll(
            "SELECT s.*, u.name AS manager_name FROM stores s LEFT JOIN users u ON u.id = s.manager_id WHERE s.is_active = 1 ORDER BY s.name"
        );

        // Build tree
        $tree = [];
        foreach ($regions as &$region) {
            $region['districts'] = [];
            $region['stores'] = []; // stores directly under region (no district)
            foreach ($districts as &$district) {
                if ((int)($district['region_id'] ?? 0) === (int)$region['id']) {
                    $district['stores'] = [];
                    foreach ($stores as $store) {
                        if ((int)($store['district_id'] ?? 0) === (int)$district['id']) {
                            $district['stores'][] = $store;
                        }
                    }
                    $region['districts'][] = $district;
                }
            }
            // Stores directly under region (no district)
            foreach ($stores as $store) {
                if ((int)($store['region_id'] ?? 0) === (int)$region['id'] && empty($store['district_id'])) {
                    $region['stores'][] = $store;
                }
            }
            $tree[] = $region;
        }

        // Unassigned stores (no region)
        $unassigned = [];
        foreach ($stores as $store) {
            if (empty($store['region_id']) && empty($store['district_id'])) {
                $unassigned[] = $store;
            }
        }

        return ['regions' => $tree, 'unassigned' => $unassigned];
    }

    // ── Org Chart ────────────────────────────────────────────────────────────

    public function getOrgChart(): array
    {
        $users = $this->db->fetchAll(
            "SELECT u.id, u.name, u.email, u.role, u.job_title, u.reports_to, u.store_id, u.avatar,
                    s.name AS store_name, r.name AS region_name
             FROM users u
             LEFT JOIN stores s ON s.id = u.store_id
             LEFT JOIN regions r ON r.id = u.region_id
             WHERE u.is_active = 1
             ORDER BY FIELD(u.role, 'ceo','admin','manager','member'), u.name"
        );

        // Build tree from reports_to
        $byId = [];
        foreach ($users as $u) { $byId[$u['id']] = $u; $byId[$u['id']]['children'] = []; }

        $roots = [];
        foreach ($byId as &$u) {
            if ($u['reports_to'] && isset($byId[$u['reports_to']])) {
                $byId[$u['reports_to']]['children'][] = &$u;
            } else {
                $roots[] = &$u;
            }
        }

        return $roots;
    }

    // ── Scoped Access (what stores can a user see?) ──────────────────────────

    public function getVisibleStoreIds(array $user): array
    {
        // CEO/Admin see all
        if (in_array($user['role'], ['ceo', 'admin'])) {
            $rows = $this->db->fetchAll("SELECT id FROM stores WHERE is_active = 1");
            return array_column($rows, 'id');
        }

        $ids = [];

        // Regional manager sees all stores in their region
        if (!empty($user['region_id'])) {
            $rows = $this->db->fetchAll(
                "SELECT id FROM stores WHERE region_id = ? AND is_active = 1",
                [$user['region_id']]
            );
            $ids = array_merge($ids, array_column($rows, 'id'));
        }

        // District manager sees all stores in their district
        if (!empty($user['district_id'])) {
            $rows = $this->db->fetchAll(
                "SELECT id FROM stores WHERE district_id = ? AND is_active = 1",
                [$user['district_id']]
            );
            $ids = array_merge($ids, array_column($rows, 'id'));
        }

        // Store-level user sees their own store
        if (!empty($user['store_id'])) {
            $ids[] = (int)$user['store_id'];
        }

        return array_unique(array_map('intval', $ids));
    }

    // ── Stats ────────────────────────────────────────────────────────────────

    public function getCompanyStats(): array
    {
        $stores = $this->db->tableExists('stores')
            ? (int)($this->db->fetch("SELECT COUNT(*) AS c FROM stores WHERE is_active = 1")['c'] ?? 0)
            : 0;
        $regions = $this->db->tableExists('regions')
            ? (int)($this->db->fetch("SELECT COUNT(*) AS c FROM regions WHERE is_active = 1")['c'] ?? 0)
            : 0;
        $districts = $this->db->tableExists('districts')
            ? (int)($this->db->fetch("SELECT COUNT(*) AS c FROM districts WHERE is_active = 1")['c'] ?? 0)
            : 0;
        $employees = $this->db->tableExists('users')
            ? (int)($this->db->fetch("SELECT COUNT(*) AS c FROM users WHERE is_active = 1")['c'] ?? 0)
            : 0;

        return compact('stores', 'regions', 'districts', 'employees');
    }
}
