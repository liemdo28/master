<?php
/**
 * Phase 11.5 — Module 2: Universal Activity Feed
 * /activity — Chronological timeline of all operational events
 */

class ActivityFeedController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * GET /activity
     */
    public function index(): void
    {
        if (!isLoggedIn()) { redirect('/login'); }

        $page = max(1, (int)($_GET['page'] ?? 1));
        $perPage = 50;
        $filter = $_GET['filter'] ?? 'all';
        $offset = ($page - 1) * $perPage;

        $activities = $this->getActivities($filter, $perPage, $offset);
        $totalCount = $this->getActivityCount($filter);
        $totalPages = ceil($totalCount / $perPage);

        UsageTracker::log('activity_feed_view', ['filter' => $filter]);

        $pageTitle = 'Activity Feed';
        $currentPage = 'activity';

        ob_start();
        include __DIR__ . '/../views/activity/index.php';
        $content = ob_get_clean();
        include __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /api/activity?page=1&filter=all — JSON for infinite scroll
     */
    public function apiActivity(): void
    {
        header('Content-Type: application/json');
        $page = max(1, (int)($_GET['page'] ?? 1));
        $perPage = 30;
        $filter = $_GET['filter'] ?? 'all';
        $offset = ($page - 1) * $perPage;

        $activities = $this->getActivities($filter, $perPage, $offset);
        echo json_encode(['activities' => $activities, 'page' => $page, 'hasMore' => count($activities) === $perPage]);
    }

    private function getActivities(string $filter, int $limit, int $offset): array
    {
        $activities = [];
        $isAdmin = canAdmin() || canManage();
        $userId = $_SESSION['user_id'] ?? 0;

        // Task completions
        if ($filter === 'all' || $filter === 'tasks') {
            $tasks = $this->db->fetchAll(
                "SELECT t.id, t.title, t.completed_at as event_time, u.name as actor_name, 'task_completed' as event_type
                 FROM tasks t
                 LEFT JOIN users u ON t.assignee_id = u.id
                 WHERE t.is_completed = 1 AND t.completed_at IS NOT NULL
                 " . (!$isAdmin ? "AND (t.assignee_id = ? OR t.creator_id = ?)" : "") . "
                 ORDER BY t.completed_at DESC LIMIT ? OFFSET ?",
                $isAdmin ? [$limit, $offset] : [$userId, $userId, $limit, $offset]
            );
            $activities = array_merge($activities, $tasks);
        }

        // Releases
        if (($filter === 'all' || $filter === 'releases') && $isAdmin) {
            try {
                $releases = $this->db->fetchAll(
                    "SELECT id, name as title, updated_at as event_time, status,
                            CASE status
                                WHEN 'published' THEN 'release_published'
                                WHEN 'approved' THEN 'release_approved'
                                ELSE 'release_updated'
                            END as event_type,
                            '' as actor_name
                     FROM releases
                     ORDER BY updated_at DESC LIMIT ? OFFSET ?",
                    [$limit, $offset]
                );
                $activities = array_merge($activities, $releases);
            } catch (\Throwable $e) { /* table may not exist */ }
        }

        // Incidents
        if (($filter === 'all' || $filter === 'incidents') && $isAdmin) {
            try {
                $incidents = $this->db->fetchAll(
                    "SELECT i.id, i.title, i.created_at as event_time, u.name as actor_name, 'incident_opened' as event_type
                     FROM incidents i
                     LEFT JOIN users u ON i.reported_by = u.id
                     ORDER BY i.created_at DESC LIMIT ? OFFSET ?",
                    [$limit, $offset]
                );
                $activities = array_merge($activities, $incidents);
            } catch (\Throwable $e) { /* table may not exist */ }
        }

        // Store checklists
        if (($filter === 'all' || $filter === 'checklists') && $isAdmin) {
            try {
                $checklists = $this->db->fetchAll(
                    "SELECT sc.id, CONCAT(s.name, ' - ', sc.type, ' checklist') as title,
                            sc.created_at as event_time, u.name as actor_name, 'checklist_completed' as event_type
                     FROM store_checklists sc
                     LEFT JOIN stores s ON sc.store_id = s.id
                     LEFT JOIN users u ON sc.opened_by = u.id OR sc.closed_by = u.id
                     ORDER BY sc.created_at DESC LIMIT ? OFFSET ?",
                    [$limit, $offset]
                );
                $activities = array_merge($activities, $checklists);
            } catch (\Throwable $e) { /* table may not exist */ }
        }

        // Bills/Payments
        if (($filter === 'all' || $filter === 'payments') && $isAdmin) {
            $bills = $this->db->fetchAll(
                "SELECT id, vendor as title, updated_at as event_time, '' as actor_name,
                        CASE status WHEN 'paid' THEN 'payment_completed' ELSE 'bill_created' END as event_type
                 FROM bills
                 WHERE status = 'paid'
                 ORDER BY updated_at DESC LIMIT ? OFFSET ?",
                [$limit, $offset]
            );
            $activities = array_merge($activities, $bills);
        }

        // Sort all by event_time descending
        usort($activities, function ($a, $b) {
            return strtotime($b['event_time'] ?? '2000-01-01') - strtotime($a['event_time'] ?? '2000-01-01');
        });

        return array_slice($activities, 0, $limit);
    }

    private function getActivityCount(string $filter): int
    {
        // Approximate count for pagination
        $count = 0;
        $isAdmin = canAdmin() || canManage();
        $userId = $_SESSION['user_id'] ?? 0;

        if ($filter === 'all' || $filter === 'tasks') {
            $row = $this->db->fetch(
                "SELECT COUNT(*) as cnt FROM tasks WHERE is_completed = 1"
                . (!$isAdmin ? " AND (assignee_id = ? OR creator_id = ?)" : ""),
                $isAdmin ? [] : [$userId, $userId]
            );
            $count += (int)($row['cnt'] ?? 0);
        }

        return max($count, 1);
    }
}
