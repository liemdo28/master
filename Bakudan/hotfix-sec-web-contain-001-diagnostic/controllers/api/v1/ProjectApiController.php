<?php
/**
 * API v1 - Projects Endpoints
 * GET|POST /api/v1/projects
 */
require_once __DIR__ . '/ApiController.php';
require_once __DIR__ . '/../../../models/Task.php';

class ProjectApiController extends ApiController {

    // ── GET /api/v1/projects ────────────────────────────────────
    public function index() {
        $this->requireAuth();
        $userId  = $this->userId;
        $role = $this->user['role'] ?? '';
        $isAdmin = in_array($role, ['admin', 'manager', 'ceo'], true);
        $taskModel = new Task();
        $visibleTaskSql = $taskModel->scopeVisibleToUserSql('t', $userId, $role);

        if ($isAdmin) {
            // Admin/CEO: see all non-archived projects
            $projects = $this->db->fetchAll(
                "SELECT p.*,
                        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.is_completed = 0) as active_tasks,
                        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.is_completed = 1) as completed_tasks,
                        u.name as owner_name
                 FROM projects p
                 LEFT JOIN users u ON p.owner_id = u.id
                 WHERE p.status != 'archived'
                 ORDER BY p.created_at DESC"
            );
        } else {
            // Regular user: only projects they own or are members of
            $projects = $this->db->fetchAll(
                "SELECT DISTINCT p.*,
                        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.is_completed = 0 AND {$visibleTaskSql}) as active_tasks,
                        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.is_completed = 1 AND {$visibleTaskSql}) as completed_tasks,
                        u.name as owner_name
                 FROM projects p
                 LEFT JOIN project_members pm ON p.id = pm.project_id
                 LEFT JOIN users u ON p.owner_id = u.id
                 WHERE p.status != 'archived'
                 AND (pm.user_id = ? OR p.owner_id = ?)
                 ORDER BY p.created_at DESC",
                [$userId, $userId]
            );
        }

        api_response([
            'projects' => array_map([$this, 'formatProject'], $projects ?: []),
        ], 'OK');
    }

    // ── GET /api/v1/projects/{id} ───────────────────────────────
    public function show($id) {
        $this->requireAuth();

        $project = $this->db->fetch(
            "SELECT p.*, u.name as owner_name
             FROM projects p
             LEFT JOIN users u ON p.owner_id = u.id
             WHERE p.id = ?",
            [(int)$id]
        );

        if (!$project) api_error('Project not found', 404);

        // Check access
        $hasAccess = $this->db->fetch(
            "SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? UNION SELECT 1 FROM projects WHERE id = ? AND owner_id = ?",
            [$id, $this->userId, $id, $this->userId]
        );

        if (!$hasAccess && ($this->user['role'] ?? '') !== 'admin') {
            api_error('Access denied', 403);
        }

        $sections = $this->db->fetchAll(
            "SELECT * FROM sections WHERE project_id = ? ORDER BY position",
            [(int)$id]
        );

        $members = $this->db->fetchAll(
            "SELECT u.id, u.name, u.email, u.avatar, pm.role
             FROM project_members pm
             JOIN users u ON pm.user_id = u.id
             WHERE pm.project_id = ?",
            [(int)$id]
        );

        api_response([
            'project'  => $this->formatProject($project),
            'sections' => array_map(fn($s) => [
                'id' => (int)$s['id'],
                'name' => $s['name'],
                'position' => (int)$s['position'],
            ], $sections),
            'members' => array_map(fn($m) => [
                'id' => (int)$m['id'],
                'name' => $m['name'],
                'email' => $m['email'],
                'avatar' => $m['avatar'],
                'role' => $m['role'],
            ], $members),
        ], 'OK');
    }

    // ── POST /api/v1/projects ───────────────────────────────────
    public function store() {
        $this->requireAuth();
        $body = $this->getJsonInput();

        $name = trim($body['name'] ?? '');
        if (!$name) api_error('Name is required', 422, ['name' => ['required']]);

        $id = $this->db->insert(
            "INSERT INTO projects (name, description, color, owner_id, status) VALUES (?, ?, ?, ?, ?)",
            [
                $name,
                trim($body['description'] ?? ''),
                $body['color'] ?? '#dc2626',
                $this->userId,
                'active',
            ]
        );

        // Auto-add owner as member
        $this->db->insert(
            "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'owner')",
            [$id, $this->userId]
        );

        // Auto-create default sections
        foreach (['To Do', 'In Progress', 'Done'] as $i => $sectionName) {
            $this->db->insert(
                "INSERT INTO sections (project_id, name, position) VALUES (?, ?, ?)",
                [$id, $sectionName, $i]
            );
        }

        $project = $this->db->fetch("SELECT * FROM projects WHERE id = ?", [$id]);
        $this->auditLog('project_created', 'project', $id);

        api_response(['project' => $this->formatProject($project)], 'Project created', 201);
    }

    // ── PUT /api/v1/projects/{id} ────────────────────────────────
    public function update($id) {
        $this->requireAuth();

        // Check owner or admin
        $project = $this->db->fetch("SELECT * FROM projects WHERE id = ?", [(int)$id]);
        if (!$project) api_error('Project not found', 404);

        if ((int)$project['owner_id'] !== $this->userId && ($this->user['role'] ?? '') !== 'admin') {
            api_error('Access denied', 403);
        }

        $body = $this->getJsonInput();
        $data = [];

        if (isset($body['name']))          $data['name'] = trim($body['name']);
        if (isset($body['description']))    $data['description'] = trim($body['description']);
        if (isset($body['color']))         $data['color'] = $body['color'];
        if (isset($body['status']))        $data['status'] = $body['status'];

        if (empty($data)) api_error('No fields to update', 400);

        $fields = implode(', ', array_map(fn($k) => "{$k} = ?", array_keys($data)));
        $params = array_values($data);
        $params[] = (int)$id;

        $this->db->update("UPDATE projects SET {$fields} WHERE id = ?", $params);
        $this->auditLog('project_updated', 'project', $id, $data);

        $updated = $this->db->fetch("SELECT * FROM projects WHERE id = ?", [(int)$id]);
        api_response(['project' => $this->formatProject($updated)], 'Project updated');
    }

    private function formatProject($p) {
        return [
            'id'              => (int)$p['id'],
            'name'            => $p['name'] ?? '',
            'description'     => $p['description'] ?? '',
            'color'          => $p['color'] ?? '#dc2626',
            'status'         => $p['status'] ?? 'active',
            'owner_id'       => (int)($p['owner_id'] ?? 0),
            'owner_name'     => $p['owner_name'] ?? null,
            'active_tasks'   => (int)($p['active_tasks'] ?? 0),
            'completed_tasks'=> (int)($p['completed_tasks'] ?? 0),
            'created_at'     => $p['created_at'] ?? null,
            'updated_at'     => $p['updated_at'] ?? null,
        ];
    }
}
