<?php
class Project {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    private function ensureSchema() {
        if (defined('SKIP_SCHEMA_CHECKS') && SKIP_SCHEMA_CHECKS) return;
        if (!$this->db->tableExists('projects')) {
            return;
        }

        if ($this->db->tableExists('stores') && !$this->db->columnExists('projects', 'store_id')) {
            try {
                $this->db->execute("ALTER TABLE projects ADD COLUMN store_id INT NULL DEFAULT NULL AFTER color");
                $this->db->invalidateSchemaCache('projects');
            } catch (Exception $e) {
            }
        }
    }

    public function findById($id) {
        return $this->db->fetch(
            "SELECT p.*, u.name as owner_name FROM projects p JOIN users u ON p.owner_id = u.id WHERE p.id = ?",
            [$id]
        );
    }

    public function getByUser($userId, $isAdmin = false, $includeArchived = false) {
        $statusFilter = $includeArchived ? '' : "AND (p.status = 'active' OR p.status IS NULL)";
        if ($isAdmin) {
            return $this->db->fetchAll(
                "SELECT p.*, u.name as owner_name,
                 (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
                 (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND is_completed = 1) as completed_count
                 FROM projects p
                 JOIN users u ON p.owner_id = u.id
                 WHERE 1=1 $statusFilter
                 ORDER BY p.updated_at DESC"
            );
        }
        return $this->db->fetchAll(
            "SELECT p.*, u.name as owner_name,
             (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
             (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND is_completed = 1) as completed_count
             FROM projects p
             JOIN users u ON p.owner_id = u.id
             WHERE p.id IN (
                 SELECT project_id FROM project_members WHERE user_id = ?
                 UNION
                 SELECT id FROM projects WHERE owner_id = ?
             ) $statusFilter
             ORDER BY p.updated_at DESC",
            [$userId, $userId]
        );
    }

    public function getAll() {
        return $this->db->fetchAll(
            "SELECT p.*, u.name as owner_name,
             (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
             (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND is_completed = 1) as completed_count
             FROM projects p JOIN users u ON p.owner_id = u.id ORDER BY p.updated_at DESC"
        );
    }

    public function getByStore($storeId, $userId = null) {
        if (!$this->db->columnExists('projects', 'store_id')) {
            return [];
        }

        $params = [$storeId];
        $where = "WHERE p.store_id = ?";
        if ($userId !== null) {
            $where .= " AND (p.owner_id = ? OR pm.user_id = ?)";
            $params[] = $userId;
            $params[] = $userId;
        }

        return $this->db->fetchAll(
            "SELECT DISTINCT p.*, u.name as owner_name,
             (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
             (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND is_completed = 1) as completed_count
             FROM projects p
             JOIN users u ON p.owner_id = u.id
             LEFT JOIN project_members pm ON p.id = pm.project_id
             $where
             ORDER BY p.updated_at DESC",
            $params
        );
    }

    public function create($data) {
        $fields = ['name', 'description', 'color', 'owner_id', 'status'];
        $placeholders = ['?', '?', '?', '?', '?'];
        $params = [$data['name'], $data['description'] ?? '', $data['color'] ?? '#DC2626', $data['owner_id'], $data['status'] ?? 'active'];

        if ($this->db->columnExists('projects', 'store_id')) {
            $fields[] = 'store_id';
            $placeholders[] = '?';
            $params[] = $data['store_id'] ?? null;
        }

        $id = $this->db->insert(
            "INSERT INTO projects (" . implode(', ', $fields) . ") VALUES (" . implode(', ', $placeholders) . ")",
            $params
        );
        // Add owner as project member
        $this->db->insert(
            "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'owner')",
            [$id, $data['owner_id']]
        );
        // Create default sections
        $sections = ['To Do', 'In Progress', 'Done'];
        foreach ($sections as $i => $name) {
            $this->db->insert(
                "INSERT INTO sections (project_id, name, position) VALUES (?, ?, ?)",
                [$id, $name, $i]
            );
        }
        return $id;
    }

    public function update($id, $data) {
        $fields = [];
        $params = [];
        foreach (['name', 'description', 'color', 'status', 'store_id'] as $field) {
            if ($field === 'store_id' && !$this->db->columnExists('projects', 'store_id')) {
                continue;
            }
            if (isset($data[$field])) {
                $fields[] = "$field = ?";
                $params[] = $data[$field];
            }
        }
        $params[] = $id;
        return $this->db->update("UPDATE projects SET " . implode(', ', $fields) . " WHERE id = ?", $params);
    }

    public function delete($id) {
        return $this->db->delete("DELETE FROM projects WHERE id = ?", [$id]);
    }

    // Members
    public function getMembers($projectId) {
        return $this->db->fetchAll(
            "SELECT u.id, u.name, u.email, u.avatar, pm.role FROM project_members pm
             JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ? ORDER BY u.name",
            [$projectId]
        );
    }

    public function addMember($projectId, $userId, $role = 'editor') {
        return $this->db->insert(
            "INSERT IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)",
            [$projectId, $userId, $role]
        );
    }

    public function removeMember($projectId, $userId) {
        return $this->db->delete(
            "DELETE FROM project_members WHERE project_id = ? AND user_id = ?",
            [$projectId, $userId]
        );
    }

    public function isMember($projectId, $userId) {
        $result = $this->db->fetch(
            "SELECT COUNT(*) as c FROM project_members WHERE project_id = ? AND user_id = ?",
            [$projectId, $userId]
        );
        return $result['c'] > 0;
    }

    // Sections
    public function getSections($projectId) {
        return $this->db->fetchAll(
            "SELECT * FROM sections WHERE project_id = ? ORDER BY position",
            [$projectId]
        );
    }

    public function addSection($projectId, $name) {
        $maxPos = $this->db->fetch("SELECT MAX(position) as mp FROM sections WHERE project_id = ?", [$projectId]);
        return $this->db->insert(
            "INSERT INTO sections (project_id, name, position) VALUES (?, ?, ?)",
            [$projectId, $name, ($maxPos['mp'] ?? -1) + 1]
        );
    }

    public function deleteSection($sectionId) {
        return $this->db->delete("DELETE FROM sections WHERE id = ?", [$sectionId]);
    }

    public function count() {
        $result = $this->db->fetch("SELECT COUNT(*) as total FROM projects WHERE status = 'active'");
        return $result['total'];
    }
}
