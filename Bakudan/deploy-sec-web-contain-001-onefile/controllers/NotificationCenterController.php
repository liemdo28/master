<?php
/**
 * Phase 11.5 — Module 3: Notification Center
 * /notifications — Full notification management page
 */

class NotificationCenterController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * GET /notifications
     */
    public function index(): void
    {
        if (!isLoggedIn()) { redirect('/login'); }

        $userId = $_SESSION['user_id'];
        $filter = $_GET['filter'] ?? 'all'; // all, unread, priority
        $page = max(1, (int)($_GET['page'] ?? 1));
        $perPage = 30;
        $offset = ($page - 1) * $perPage;

        $where = "WHERE n.user_id = ?";
        $params = [$userId];

        if ($filter === 'unread') {
            $where .= " AND n.is_read = 0";
        } elseif ($filter === 'priority') {
            $where .= " AND n.type IN ('task_overdue','incident_assigned','release_approval','audit_failed')";
        }

        $notifications = $this->db->fetchAll(
            "SELECT n.*, u.name as sender_name
             FROM notifications n
             LEFT JOIN users u ON n.sender_id = u.id
             $where
             ORDER BY n.created_at DESC
             LIMIT ? OFFSET ?",
            array_merge($params, [$perPage, $offset])
        );

        $counts = $this->db->fetch(
            "SELECT
                COUNT(*) as total,
                SUM(is_read = 0) as unread,
                SUM(type IN ('task_overdue','incident_assigned','release_approval','audit_failed') AND is_read = 0) as priority
             FROM notifications WHERE user_id = ?",
            [$userId]
        );

        $totalPages = ceil(($counts['total'] ?? 0) / $perPage);

        UsageTracker::log('notification_center_view', ['filter' => $filter]);

        $pageTitle = 'Notifications';
        $currentPage = 'notifications';

        ob_start();
        include __DIR__ . '/../views/notifications/index.php';
        $content = ob_get_clean();
        include __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * POST /notifications/mark-read
     */
    public function markRead(): void
    {
        $userId = $_SESSION['user_id'];
        $id = $_POST['id'] ?? null;

        if ($id) {
            $this->db->execute(
                "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
                [$id, $userId]
            );
        } else {
            // Mark all as read
            $this->db->execute(
                "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
                [$userId]
            );
        }

        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) {
            header('Content-Type: application/json');
            echo json_encode(['success' => true]);
            return;
        }

        redirect('/notifications');
    }

    /**
     * POST /notifications/snooze
     */
    public function snooze(): void
    {
        $userId = $_SESSION['user_id'];
        $id = $_POST['id'] ?? null;
        $until = $_POST['snooze_until'] ?? date('Y-m-d H:i:s', strtotime('+1 hour'));

        if ($id) {
            $this->db->execute(
                "UPDATE notifications SET snoozed_until = ?, is_read = 1 WHERE id = ? AND user_id = ?",
                [$until, $id, $userId]
            );
        }

        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) {
            header('Content-Type: application/json');
            echo json_encode(['success' => true]);
            return;
        }

        redirect('/notifications');
    }
}
