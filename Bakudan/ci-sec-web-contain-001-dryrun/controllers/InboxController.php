<?php
/**
 * InboxController — Task notification inbox (TaskNotification-powered)
 * GET  /inbox
 * POST /inbox/mark-read
 * POST /inbox/mark-all-read
 * API  /api/inbox
 */
class InboxController {
    private TaskNotification $model;

    public function __construct() {
        $this->model = new TaskNotification();
    }

    public function index(): void {
        if (!isLoggedIn()) { redirect('/login'); }

        $uid    = (int)$_SESSION['user_id'];
        $filter = $_GET['filter'] ?? 'all';
        $page   = max(1, (int)($_GET['page'] ?? 1));
        $perPage = 30;
        $offset  = ($page - 1) * $perPage;

        $notifications = $this->mergedInbox($uid, $filter, $perPage, $offset);
        $counts        = $this->mergedCounts($uid);
        $totalPages    = ceil(($counts['total'] ?? 0) / $perPage);

        $pageTitle   = 'Inbox';
        $currentPage = 'inbox';

        // Filter tabs config — used by views/inbox/index.php
        $filterTabs = [
            'all'        => ['label' => 'All',         'icon' => '📬'],
            'unread'     => ['label' => 'Unread',      'icon' => '🔵'],
            'approval'   => ['label' => 'Approvals',   'icon' => '✅'],
            'review'     => ['label' => 'Reviews',     'icon' => '👁'],
            'task'       => ['label' => 'Tasks',       'icon' => '📋'],
            'mention'    => ['label' => 'Mentions',    'icon' => '@'],
        ];

        // Notification type display config
        $typeConfig = [
            'task_assigned'       => ['icon' => '📋', 'color' => '#60a5fa', 'label' => 'Task Assigned'],
            'task_approval'       => ['icon' => '✅', 'color' => '#4ade80', 'label' => 'Approval'],
            'review_requested'    => ['icon' => '👁', 'color' => '#fbbf24', 'label' => 'Review Requested'],
            'review_approved'     => ['icon' => '✅', 'color' => '#4ade80', 'label' => 'Review Approved'],
            'review_rejected'     => ['icon' => '❌', 'color' => '#f87171', 'label' => 'Review Rejected'],
            'acceptance_approved' => ['icon' => '🎉', 'color' => '#4ade80', 'label' => 'Task Accepted'],
            'acceptance_rejected' => ['icon' => '❌', 'color' => '#f87171', 'label' => 'Acceptance Rejected'],
            'task_mention'        => ['icon' => '@',  'color' => '#a78bfa', 'label' => 'Mention'],
            'task_comment'        => ['icon' => '💬', 'color' => '#60a5fa', 'label' => 'Comment'],
            'task_completed'      => ['icon' => '✓',  'color' => '#4ade80', 'label' => 'Task Done'],
            'deadline_reminder'   => ['icon' => '⏰', 'color' => '#fbbf24', 'label' => 'Deadline'],
        ];

        // Category badge helper — closure safe for use in view
        $catBadge = function(string $type) use ($typeConfig): string {
            $cfg = $typeConfig[$type] ?? ['icon' => '●', 'color' => '#71717a', 'label' => ucfirst($type)];
            return '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:' . $cfg['color'] . '18;color:' . $cfg['color'] . '">' . htmlspecialchars($cfg['icon']) . ' ' . htmlspecialchars($cfg['label']) . '</span>';
        };

        // The view handles ob_start/ob_get_clean/require main.php itself
        include __DIR__ . '/../views/inbox/index.php';
    }

    // POST /inbox/mark-read
    public function markRead(): void {
        if (!isLoggedIn()) { redirect('/login'); }
        $uid    = (int)$_SESSION['user_id'];
        $id     = $_POST['id'] ?? null;
        $source = $_POST['source'] ?? 'task';

        if ($id) {
            if ($source === 'legacy') {
                (new Notification())->markRead((int)$id, $uid);
            } else {
                $this->model->markRead((int)$id, $uid);
            }
        }

        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) {
            json_response(['success' => true]);
        }
        redirect('/inbox');
    }

    // POST /inbox/mark-all-read
    public function markAllRead(): void {
        if (!isLoggedIn()) { redirect('/login'); }
        $uid = (int)$_SESSION['user_id'];
        (new Notification())->markAllRead($uid);
        $this->model->markAllRead($uid);

        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH'])) {
            json_response(['success' => true]);
        }
        redirect('/inbox');
    }

    // GET /api/inbox — JSON API for the sidebar badge
    public function apiList(): void {
        if (!isLoggedIn()) { json_response(['error' => 'Unauthorized'], 401); }
        $uid = (int)$_SESSION['user_id'];
        $filter = $_GET['filter'] ?? 'all';
        $notifications = $this->mergedInbox($uid, $filter, 20, 0);
        $counts = $this->mergedCounts($uid);
        json_response(['notifications' => $notifications, 'counts' => $counts]);
    }

    // ── Merge legacy `notifications` + newer `task_notifications` ──────────
    // The two tables were never reconciled: most of the app (bills, penalties,
    // overdue crons, comments, admin audits, etc.) only writes to the legacy
    // `notifications` table, while this Inbox page historically only read
    // `task_notifications`. Merging here keeps the sidebar badge and this
    // page in agreement without touching every writer call-site.

    private function mergedCounts(int $uid): array {
        $legacy = (new Notification())->getCounts($uid);
        $task   = $this->model->getCounts($uid);
        return [
            'total'           => $legacy['total'] + $task['total'],
            'unread'          => $legacy['unread'] + $task['unread'],
            'mentions_unread' => $legacy['mentions_unread'] + $task['mentions_unread'],
            'review_unread'   => $task['review_unread'],
            'approval_unread' => $task['approval_unread'],
        ];
    }

    private function mergedInbox(int $uid, string $filter, int $limit, int $offset): array {
        $fetchCap = min(500, $offset + $limit);

        $legacyRows = array_map(function ($r) {
            return [
                'id'              => $r['id'],
                '_source'         => 'legacy',
                'notification_type' => $r['type'],
                'title'           => $r['title'],
                'message'         => $r['message'],
                'is_read'         => $r['is_read'],
                'created_at'      => $r['created_at'],
                'task_id'         => $r['task_id'],
                'action_url'      => null,
                'from_name'       => $r['from_user_name'] ?? null,
                'task_title'      => null,
                'inbox_category'  => $r['type'] === 'mention' ? 'mention' : 'task',
            ];
        }, (new Notification())->getByUserFiltered($uid, $filter, $fetchCap));

        $taskRows = array_map(function ($r) {
            $r['_source'] = 'task';
            return $r;
        }, $this->model->getInbox($uid, $fetchCap, 0, $filter));

        $merged = array_merge($legacyRows, $taskRows);
        usort($merged, fn($a, $b) => strcmp((string)$b['created_at'], (string)$a['created_at']));

        return array_slice($merged, $offset, $limit);
    }
}
