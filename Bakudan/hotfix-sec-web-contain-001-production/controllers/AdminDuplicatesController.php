<?php
/**
 * AdminDuplicatesController — Manage duplicate bills/tasks
 * Routes:
 *   GET  /admin/duplicates
 *   POST /admin/duplicates/{group_id}/archive
 *   POST /admin/duplicates/{group_id}/ignore
 *   POST /admin/duplicates/{group_id}/not-duplicate
 */
class AdminDuplicatesController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
        if (!canManage()) {
            redirect('overview');
        }
    }

    public function index(): void
    {
        $groups = [];
        if ($this->db->tableExists('duplicate_groups') && $this->db->tableExists('duplicate_group_items')) {
            $groups = $this->db->fetchAll(
                "SELECT dg.*, 
                        (SELECT COUNT(*) FROM duplicate_group_items dgi WHERE dgi.group_id = dg.id) AS item_count
                 FROM duplicate_groups dg
                 WHERE dg.status = 'pending'
                 ORDER BY dg.detected_at DESC
                 LIMIT 200"
            );

            foreach ($groups as &$group) {
                $group['items'] = $this->db->fetchAll(
                    "SELECT dgi.*, dgi.entity_id, dgi.is_canonical FROM duplicate_group_items dgi WHERE dgi.group_id = ?",
                    [$group['id']]
                );

                // Hydrate entity data
                foreach ($group['items'] as &$item) {
                    $item['record'] = $this->fetchEntityRecord($group['entity_type'], $item['entity_id']);
                }
                unset($item);
            }
            unset($group);
        }

        $pageTitle   = 'Duplicate Management';
        $currentPage = 'admin';

        ob_start();
        require __DIR__ . '/../views/admin/duplicates/index.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }

    public function archive(int $groupId): void
    {
        if (!$this->db->tableExists('duplicate_groups')) {
            json_response(['error' => 'Table missing'], 500);
            return;
        }

        $group = $this->db->fetch("SELECT * FROM duplicate_groups WHERE id = ?", [$groupId]);
        if (!$group) { json_response(['error' => 'Not found'], 404); return; }

        $notes    = trim($_POST['notes'] ?? '');
        $userId   = (int)$_SESSION['user_id'];
        $dupItems = $this->db->fetchAll(
            "SELECT * FROM duplicate_group_items WHERE group_id = ? AND is_canonical = 0",
            [$groupId]
        );

        foreach ($dupItems as $item) {
            $this->archiveEntity($group['entity_type'], $item['entity_id'], $userId);
        }

        $this->db->execute(
            "UPDATE duplicate_groups SET status = 'resolved', resolved_at = NOW(), resolved_by = ? WHERE id = ?",
            [$userId, $groupId]
        );
        $this->db->execute(
            "INSERT INTO duplicate_resolution_log (group_id, action, performed_by, notes, performed_at) VALUES (?, 'archived', ?, ?, NOW())",
            [$groupId, $userId, $notes]
        );

        json_response(['ok' => true, 'group_id' => $groupId]);
    }

    public function ignore(int $groupId): void
    {
        if (!$this->db->tableExists('duplicate_groups')) { json_response(['error' => 'Table missing'], 500); return; }
        $userId = (int)$_SESSION['user_id'];
        $notes  = trim($_POST['notes'] ?? '');

        $this->db->execute(
            "UPDATE duplicate_groups SET status = 'ignored', resolved_at = NOW(), resolved_by = ? WHERE id = ?",
            [$userId, $groupId]
        );
        $this->db->execute(
            "INSERT INTO duplicate_resolution_log (group_id, action, performed_by, notes, performed_at) VALUES (?, 'ignored', ?, ?, NOW())",
            [$groupId, $userId, $notes]
        );

        json_response(['ok' => true, 'group_id' => $groupId]);
    }

    public function notDuplicate(int $groupId): void
    {
        if (!$this->db->tableExists('duplicate_groups')) { json_response(['error' => 'Table missing'], 500); return; }
        $userId = (int)$_SESSION['user_id'];
        $notes  = trim($_POST['notes'] ?? '');

        $this->db->execute(
            "UPDATE duplicate_groups SET status = 'resolved', resolved_at = NOW(), resolved_by = ? WHERE id = ?",
            [$userId, $groupId]
        );
        $this->db->execute(
            "INSERT INTO duplicate_resolution_log (group_id, action, performed_by, notes, performed_at) VALUES (?, 'marked_not_duplicate', ?, ?, NOW())",
            [$groupId, $userId, $notes]
        );

        json_response(['ok' => true, 'group_id' => $groupId]);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function fetchEntityRecord(string $type, int $id): ?array
    {
        if ($type === 'bill' && $this->db->tableExists('bills')) {
            return $this->db->fetch(
                "SELECT b.id, b.title, b.status, b.due_date, b.amount, b.store_id,
                        s.name AS store_name, COALESCE(v.name, b.vendor) AS vendor_name
                 FROM bills b
                 LEFT JOIN stores s ON s.id = b.store_id
                 LEFT JOIN vendors v ON v.id = b.vendor_id
                 WHERE b.id = ?",
                [$id]
            );
        }
        if ($type === 'task' && $this->db->tableExists('tasks')) {
            return $this->db->fetch(
                "SELECT t.id, t.title, t.status, t.due_date, t.priority,
                        u.name AS assignee_name,
                        s.name AS store_name
                 FROM tasks t
                 LEFT JOIN users u ON u.id = t.assignee_id
                 LEFT JOIN projects p ON p.id = t.project_id
                 LEFT JOIN stores s ON s.id = p.store_id
                 WHERE t.id = ?",
                [$id]
            );
        }
        return null;
    }

    private function archiveEntity(string $type, int $id, int $userId): void
    {
        if ($type === 'bill' && $this->db->tableExists('bills')) {
            if ($this->db->columnExists('bills', 'is_archived')) {
                $this->db->execute(
                    "UPDATE bills SET is_archived = 1, archived_at = NOW(), archived_reason = 'duplicate_resolved' WHERE id = ?",
                    [$id]
                );
            }
            if ($this->db->tableExists('bill_history')) {
                $this->db->execute(
                    "INSERT INTO bill_history (bill_id, user_id, action, note, created_at) VALUES (?, ?, 'archived_duplicate', 'Archived via duplicate manager', NOW())",
                    [$id, $userId]
                );
            }
        }
        if ($type === 'task' && $this->db->columnExists('tasks', 'archived_duplicate')) {
            $this->db->execute(
                "UPDATE tasks SET archived_duplicate = 1, duplicate_reason = 'duplicate_resolved' WHERE id = ?",
                [$id]
            );
        }
    }
}
