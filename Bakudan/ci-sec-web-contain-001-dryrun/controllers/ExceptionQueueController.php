<?php
/**
 * Exception Queue — items requiring human attention
 * Shows: overdue tasks/bills, failed verifications, missing evidence, low-confidence
 */
class ExceptionQueueController
{
    public function index(): void
    {
        if (!canManage()) { redirect('overview'); return; }
        $db = Database::getInstance();

        $today = date('Y-m-d');

        // ── 1. Overdue bills (not archived, not paid) ─────────────────────────
        $overdueBills = [];
        if ($db->tableExists('bills')) {
            $overdueBills = $db->fetchAll(
                "SELECT b.id, b.title, b.amount, b.due_date, b.status,
                        COALESCE(s.name, '—') AS store_name,
                        DATEDIFF(NOW(), b.due_date) AS days_overdue,
                        'bill' AS item_type,
                        'overdue' AS exception_reason
                 FROM bills b
                 LEFT JOIN stores s ON s.id = b.store_id
                 WHERE b.due_date < ? AND b.status NOT IN ('paid','cancelled')
                   AND COALESCE(b.is_archived,0) = 0
                 ORDER BY b.due_date ASC",
                [$today]
            );
        }

        // ── 2. Tasks with failed verification ────────────────────────────────
        $failedVerification = [];
        $hasTaskStoreId = $db->tableExists('tasks') && $db->columnExists('tasks','store_id');
        if ($db->tableExists('tasks') && $db->columnExists('tasks','verification_status')) {
            $storeJoin = $hasTaskStoreId ? "LEFT JOIN stores s ON s.id = t.store_id" : "";
            $storeSel  = $hasTaskStoreId ? "COALESCE(s.name, '—') AS store_name," : "'—' AS store_name,";
            $failedVerification = $db->fetchAll(
                "SELECT t.id, t.title, t.due_date, t.status, t.verification_status,
                        {$storeSel}
                        COALESCE(u.name, '—') AS assignee_name,
                        'task' AS item_type,
                        'verification_failed' AS exception_reason
                 FROM tasks t
                 {$storeJoin}
                 LEFT JOIN users u ON u.id = t.assignee_id
                 WHERE t.verification_status IN ('failed','exception')
                   AND t.status NOT IN ('cancelled','archived')
                 ORDER BY t.due_date ASC
                 LIMIT 100"
            );
        }

        // ── 3. Overdue tasks (not completed) ─────────────────────────────────
        $overdueTasks = $db->fetchAll(
            "SELECT t.id, t.title, t.due_date, t.status,
                    COALESCE(u.name,'—') AS assignee_name,
                    DATEDIFF(NOW(), t.due_date) AS days_overdue,
                    'task' AS item_type,
                    'overdue' AS exception_reason
             FROM tasks t
             LEFT JOIN users u ON u.id = t.assignee_id
             WHERE t.is_completed = 0
               AND t.due_date < ?
               AND t.status NOT IN ('done','completed','cancelled','archived')
             ORDER BY t.due_date ASC
             LIMIT 100",
            [$today]
        );

        // ── 4. Tasks submitted but unverified (verification_pending > 3 days) ─
        $pendingVerification = [];
        if ($db->columnExists('tasks','verification_status')) {
            $pendingVerification = $db->fetchAll(
                "SELECT t.id, t.title, t.due_date, t.status, t.verification_status,
                        COALESCE(u.name,'—') AS assignee_name,
                        DATEDIFF(NOW(), t.due_date) AS days_pending,
                        'task' AS item_type,
                        'verification_pending' AS exception_reason
                 FROM tasks t
                 LEFT JOIN users u ON u.id = t.assignee_id
                 WHERE t.status IN ('review','done','submitted')
                   AND (t.verification_status IS NULL OR t.verification_status IN ('not_checked','pending'))
                   AND t.due_date < DATE_SUB(NOW(), INTERVAL 3 DAY)
                 ORDER BY t.due_date ASC
                 LIMIT 100"
            );
        }

        // ── 5. Verification results with low confidence ───────────────────────
        $lowConfidence = [];
        if ($db->tableExists('verification_results')) {
            $lowConfidence = $db->fetchAll(
                "SELECT vr.id, vr.task_id, vr.verification_status, vr.confidence_score,
                        vr.notes, vr.created_at,
                        t.title, t.due_date,
                        COALESCE(u.name,'—') AS assignee_name
                 FROM verification_results vr
                 JOIN tasks t ON t.id = vr.task_id
                 LEFT JOIN users u ON u.id = t.assignee_id
                 WHERE vr.confidence_score IS NOT NULL AND vr.confidence_score < 0.7
                   AND vr.verification_status != 'verified'
                 ORDER BY vr.confidence_score ASC
                 LIMIT 50"
            );
        }

        $totalExceptions = count($overdueBills) + count($failedVerification)
                         + count($overdueTasks) + count($pendingVerification)
                         + count($lowConfidence);

        $pageTitle   = 'Exception Queue';
        $currentPage = 'exception-queue';

        ob_start();
        require __DIR__ . '/../views/dashboard/exception_queue.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }
}
