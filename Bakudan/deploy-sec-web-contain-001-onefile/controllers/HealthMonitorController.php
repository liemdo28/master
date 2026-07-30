<?php
/**
 * Phase 11.5 — Module 10: Health Monitor
 * /health — System health dashboard
 */

class HealthMonitorController
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * GET /health
     */
    public function index(): void
    {
        if (!canAdmin()) {
            redirect('/dashboard');
            return;
        }

        $checks = $this->runHealthChecks();
        UsageTracker::log('health_monitor_view');

        $pageTitle = 'System Health';
        $currentPage = 'health';

        ob_start();
        include __DIR__ . '/../views/health/index.php';
        $content = ob_get_clean();
        include __DIR__ . '/../views/layouts/main.php';
    }

    /**
     * GET /api/health/status — JSON health status
     */
    public function apiStatus(): void
    {
        if (!canAdmin()) {
            http_response_code(403);
            echo json_encode(['error' => 'Forbidden']);
            return;
        }

        header('Content-Type: application/json');
        $checks = $this->runHealthChecks();
        $overall = 'healthy';
        foreach ($checks as $check) {
            if ($check['status'] === 'critical') { $overall = 'critical'; break; }
            if ($check['status'] === 'warning') { $overall = 'warning'; }
        }
        echo json_encode(['overall' => $overall, 'checks' => $checks, 'timestamp' => date('c')]);
    }

    private function runHealthChecks(): array
    {
        $checks = [];

        // 1. Database connectivity
        $checks[] = $this->checkDatabase();

        // 2. Scheduler / Cron
        $checks[] = $this->checkScheduler();

        // 3. Notification system
        $checks[] = $this->checkNotifications();

        // 4. Release system
        $checks[] = $this->checkReleases();

        // 5. Email queue
        $checks[] = $this->checkEmailQueue();

        // 6. Disk / Logs
        $checks[] = $this->checkDiskSpace();

        // 7. Error rate
        $checks[] = $this->checkErrorRate();

        return $checks;
    }

    private function checkDatabase(): array
    {
        try {
            $start = microtime(true);
            $this->db->fetch("SELECT 1 as ok");
            $latency = round((microtime(true) - $start) * 1000, 1);

            $status = 'healthy';
            if ($latency > 500) $status = 'warning';
            if ($latency > 2000) $status = 'critical';

            return [
                'name' => 'Database',
                'status' => $status,
                'message' => "Connected ({$latency}ms)",
                'latency_ms' => $latency,
            ];
        } catch (\Throwable $e) {
            return ['name' => 'Database', 'status' => 'critical', 'message' => 'Connection failed: ' . $e->getMessage()];
        }
    }

    private function checkScheduler(): array
    {
        // Check if cron has run recently (look for recent task completions or notifications)
        try {
            $recent = $this->db->fetch(
                "SELECT MAX(created_at) as last_run FROM notifications WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)"
            );
            if ($recent && $recent['last_run']) {
                $hoursAgo = (time() - strtotime($recent['last_run'])) / 3600;
                if ($hoursAgo < 2) return ['name' => 'Scheduler', 'status' => 'healthy', 'message' => 'Active (last: ' . date('H:i', strtotime($recent['last_run'])) . ')'];
                if ($hoursAgo < 6) return ['name' => 'Scheduler', 'status' => 'warning', 'message' => 'Delayed (' . round($hoursAgo, 1) . 'h ago)'];
            }
            return ['name' => 'Scheduler', 'status' => 'warning', 'message' => 'No recent activity in 24h'];
        } catch (\Throwable $e) {
            return ['name' => 'Scheduler', 'status' => 'warning', 'message' => 'Unable to verify'];
        }
    }

    private function checkNotifications(): array
    {
        try {
            $pending = $this->db->fetch("SELECT COUNT(*) as cnt FROM notifications WHERE is_read = 0 AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)");
            $stale = (int)($pending['cnt'] ?? 0);
            if ($stale > 100) return ['name' => 'Notifications', 'status' => 'warning', 'message' => "$stale stale unread notifications"];
            return ['name' => 'Notifications', 'status' => 'healthy', 'message' => 'System operational'];
        } catch (\Throwable $e) {
            return ['name' => 'Notifications', 'status' => 'warning', 'message' => 'Unable to verify'];
        }
    }

    private function checkReleases(): array
    {
        try {
            $live = $this->db->fetch("SELECT version, published_at FROM releases WHERE status = 'published' ORDER BY published_at DESC LIMIT 1");
            if ($live) {
                return ['name' => 'Release System', 'status' => 'healthy', 'message' => 'Live: ' . ($live['version'] ?? 'unknown')];
            }
            return ['name' => 'Release System', 'status' => 'healthy', 'message' => 'No published releases'];
        } catch (\Throwable $e) {
            return ['name' => 'Release System', 'status' => 'warning', 'message' => 'Table not available'];
        }
    }

    private function checkEmailQueue(): array
    {
        try {
            $pending = $this->db->fetch("SELECT COUNT(*) as cnt FROM email_queue WHERE status = 'pending' AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)");
            $stuck = (int)($pending['cnt'] ?? 0);
            if ($stuck > 50) return ['name' => 'Email Queue', 'status' => 'critical', 'message' => "$stuck emails stuck in queue"];
            if ($stuck > 10) return ['name' => 'Email Queue', 'status' => 'warning', 'message' => "$stuck emails pending > 1h"];
            return ['name' => 'Email Queue', 'status' => 'healthy', 'message' => 'Queue clear'];
        } catch (\Throwable $e) {
            return ['name' => 'Email Queue', 'status' => 'healthy', 'message' => 'No queue table (OK)'];
        }
    }

    private function checkDiskSpace(): array
    {
        $logDir = __DIR__ . '/../logs';
        if (is_dir($logDir)) {
            $size = 0;
            $files = glob($logDir . '/**/*.log') ?: glob($logDir . '/*.log') ?: [];
            foreach ($files as $f) { $size += filesize($f); }
            $sizeMb = round($size / 1024 / 1024, 1);
            if ($sizeMb > 500) return ['name' => 'Disk (Logs)', 'status' => 'warning', 'message' => "Logs: {$sizeMb}MB"];
            return ['name' => 'Disk (Logs)', 'status' => 'healthy', 'message' => "Logs: {$sizeMb}MB"];
        }
        return ['name' => 'Disk (Logs)', 'status' => 'healthy', 'message' => 'Log directory OK'];
    }

    private function checkErrorRate(): array
    {
        $errorLog = __DIR__ . '/../logs/errors/' . date('Y-m-d') . '.log';
        if (file_exists($errorLog)) {
            $lines = count(file($errorLog));
            if ($lines > 100) return ['name' => 'Error Rate', 'status' => 'critical', 'message' => "$lines errors today"];
            if ($lines > 20) return ['name' => 'Error Rate', 'status' => 'warning', 'message' => "$lines errors today"];
            return ['name' => 'Error Rate', 'status' => 'healthy', 'message' => "$lines errors today"];
        }
        return ['name' => 'Error Rate', 'status' => 'healthy', 'message' => 'No errors today'];
    }
}
