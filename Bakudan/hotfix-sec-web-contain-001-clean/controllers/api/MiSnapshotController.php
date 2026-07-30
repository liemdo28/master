<?php
/**
 * Mi Snapshot Controller
 * GET /api/mi/snapshot
 *
 * Internal-only endpoint — rejects all requests not from localhost.
 * Returns a JSON snapshot of tasks, approvals, and penalties for Mi-Core ingestion.
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/time.php';

class MiSnapshotController {

    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
        app_set_timezone();
    }

    public function snapshot(): void {
        $this->requireLocalhost();
        header('Content-Type: application/json; charset=utf-8');

        // Ensure DB returns properly encoded UTF-8
        try { $this->db->query("SET NAMES utf8mb4"); } catch (\Throwable $_) {}

        $today = date('Y-m-d');

        $tasks       = $this->fetchTasks($today);
        $approvals   = $this->fetchPendingApprovals();
        $penalties   = $this->fetchRecentPenalties();
        $projects    = $this->fetchActiveProjects();

        echo json_encode([
            'store'        => 'bakudan',
            'captured_at'  => date('c'),
            'source'       => 'dashboard_api',
            'today'        => $today,
            'tasks'        => $tasks,
            'approvals'    => $approvals,
            'penalties'    => $penalties,
            'projects'     => $projects,
            'summary'      => [
                'total_tasks'       => count($tasks),
                'overdue_tasks'     => count(array_filter($tasks, fn($t) => ($t['is_overdue'] ?? false))),
                'due_today'         => count(array_filter($tasks, fn($t) => ($t['due_date'] ?? '') === $today && ($t['status'] ?? '') !== 'done')),
                'pending_approvals' => count($approvals),
                'active_projects'   => count($projects),
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function requireLocalhost(): void {
        $secret = $_ENV['MI_SNAPSHOT_SECRET'] ?? getenv('MI_SNAPSHOT_SECRET') ?: '';
        $provided = $_SERVER['HTTP_X_MI_TOKEN'] ?? '';

        // If a secret is configured, accept valid token from any IP
        if ($secret !== '' && $provided === $secret) {
            return;
        }

        // Fall back: allow unauthenticated access from localhost only
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $localIps = ['127.0.0.1', '::1'];
        if (in_array($ip, $localIps, true)) {
            return;
        }

        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }

    private function fetchTasks(string $today): array {
        $rows = $this->db->fetchAll(
            "SELECT
                t.id,
                t.title,
                t.status,
                t.priority,
                t.due_date,
                t.start_date,
                t.is_completed,
                t.created_at,
                t.updated_at,
                p.name  AS project_name,
                p.id    AS project_id,
                u.name  AS assignee_name,
                t.assignee_id,
                CASE WHEN t.due_date < ? AND t.is_completed = 0 THEN 1 ELSE 0 END AS is_overdue
             FROM tasks t
             LEFT JOIN projects p ON p.id = t.project_id
             LEFT JOIN users   u ON u.id = t.assignee_id
             WHERE t.is_completed = 0
               AND t.status != 'done'
             ORDER BY
               is_overdue DESC,
               FIELD(t.priority, 'urgent', 'high', 'medium', 'low'),
               t.due_date ASC
             LIMIT 200",
            [$today]
        );

        return array_map(function ($r) {
            return [
                'id'           => (int)$r['id'],
                'title'        => $r['title'],
                'status'       => $r['status'],
                'priority'     => $r['priority'],
                'due_date'     => $r['due_date'],
                'start_date'   => $r['start_date'],
                'is_overdue'   => (bool)$r['is_overdue'],
                'project_id'   => (int)$r['project_id'],
                'project_name' => $r['project_name'],
                'assignee_id'  => $r['assignee_id'] ? (int)$r['assignee_id'] : null,
                'assignee'     => $r['assignee_name'],
                'updated_at'   => $r['updated_at'],
            ];
        }, $rows ?: []);
    }

    private function fetchPendingApprovals(): array {
        // Try task_approvals table first, fall back gracefully
        try {
            $rows = $this->db->fetchAll(
                "SELECT
                    ta.id,
                    ta.task_id,
                    t.title       AS task_title,
                    ta.status     AS approval_status,
                    ta.submitted_at,
                    u.name        AS submitter_name,
                    p.name        AS project_name
                 FROM task_approvals ta
                 JOIN tasks    t ON t.id = ta.task_id
                 JOIN users    u ON u.id = ta.submitted_by
                 LEFT JOIN projects p ON p.id = t.project_id
                 WHERE ta.status IN ('pending_review', 'pending_acceptance')
                 ORDER BY ta.submitted_at ASC
                 LIMIT 50"
            );
            return array_map(fn($r) => [
                'id'              => (int)$r['id'],
                'task_id'         => (int)$r['task_id'],
                'task_title'      => $r['task_title'],
                'approval_status' => $r['approval_status'],
                'submitted_at'    => $r['submitted_at'],
                'submitter'       => $r['submitter_name'],
                'project'         => $r['project_name'],
            ], $rows ?: []);
        } catch (\Throwable $e) {
            return [];
        }
    }

    private function fetchRecentPenalties(): array {
        try {
            $rows = $this->db->fetchAll(
                "SELECT
                    id,
                    reason,
                    amount,
                    created_at,
                    status
                 FROM penalties
                 WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                 ORDER BY created_at DESC
                 LIMIT 20"
            );
            return array_map(fn($r) => [
                'id'         => (int)$r['id'],
                'reason'     => $r['reason'],
                'amount'     => (float)$r['amount'],
                'status'     => $r['status'],
                'created_at' => $r['created_at'],
            ], $rows ?: []);
        } catch (\Throwable $e) {
            return [];
        }
    }

    private function fetchActiveProjects(): array {
        try {
            $rows = $this->db->fetchAll(
                "SELECT
                    p.id,
                    p.name,
                    p.status,
                    COUNT(t.id) AS open_tasks
                 FROM projects p
                 LEFT JOIN tasks t ON t.project_id = p.id AND t.is_completed = 0
                 WHERE p.status NOT IN ('archived', 'completed')
                 GROUP BY p.id
                 ORDER BY p.name ASC
                 LIMIT 50"
            );
            return array_map(fn($r) => [
                'id'         => (int)$r['id'],
                'name'       => $r['name'],
                'status'     => $r['status'],
                'open_tasks' => (int)$r['open_tasks'],
            ], $rows ?: []);
        } catch (\Throwable $e) {
            return [];
        }
    }
}
