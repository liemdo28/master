<?php
/**
 * Phase 11.6 — Adoption Analytics: Usage Event Tracker
 * 
 * Lightweight service to log feature usage events.
 * No external dependencies. Stores in local DB.
 * Fails silently — never breaks the user experience.
 */

class UsageTracker
{
    private static ?UsageTracker $instance = null;

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Log a usage event
     * 
     * @param string $event Event name (e.g. 'search', 'workspace_view', 'fab_create_task')
     * @param array|null $metadata Optional context data
     */
    public function track(string $event, ?array $metadata = null): void
    {
        try {
            $userId = $_SESSION['user_id'] ?? 0;
            if (!$userId) return;

            $db = Database::getInstance();
            $page = $_SERVER['REQUEST_URI'] ?? '';

            $db->execute(
                "INSERT INTO usage_events (user_id, event, page, metadata, created_at) VALUES (?, ?, ?, ?, NOW())",
                [$userId, $event, $page, $metadata ? json_encode($metadata) : null]
            );
        } catch (\Throwable $e) {
            // Fail silently — never break user experience for analytics
        }
    }

    /**
     * Shorthand static method
     */
    public static function log(string $event, ?array $metadata = null): void
    {
        self::getInstance()->track($event, $metadata);
    }

    /**
     * Get usage summary for a date range
     */
    public static function getSummary(string $from, string $to): array
    {
        try {
            $db = Database::getInstance();

            $events = $db->fetchAll(
                "SELECT event, COUNT(*) as count, COUNT(DISTINCT user_id) as unique_users
                 FROM usage_events
                 WHERE created_at BETWEEN ? AND ?
                 GROUP BY event
                 ORDER BY count DESC",
                [$from . ' 00:00:00', $to . ' 23:59:59']
            );

            $dailyTrend = $db->fetchAll(
                "SELECT DATE(created_at) as date, COUNT(*) as count
                 FROM usage_events
                 WHERE created_at BETWEEN ? AND ?
                 GROUP BY DATE(created_at)
                 ORDER BY date ASC",
                [$from . ' 00:00:00', $to . ' 23:59:59']
            );

            $topUsers = $db->fetchAll(
                "SELECT ue.user_id, u.name, u.role, COUNT(*) as event_count
                 FROM usage_events ue
                 LEFT JOIN users u ON ue.user_id = u.id
                 WHERE ue.created_at BETWEEN ? AND ?
                 GROUP BY ue.user_id, u.name, u.role
                 ORDER BY event_count DESC
                 LIMIT 10",
                [$from . ' 00:00:00', $to . ' 23:59:59']
            );

            $totalEvents = $db->fetch(
                "SELECT COUNT(*) as total, COUNT(DISTINCT user_id) as unique_users
                 FROM usage_events
                 WHERE created_at BETWEEN ? AND ?",
                [$from . ' 00:00:00', $to . ' 23:59:59']
            );

            return [
                'period' => ['from' => $from, 'to' => $to],
                'total_events' => (int)($totalEvents['total'] ?? 0),
                'unique_users' => (int)($totalEvents['unique_users'] ?? 0),
                'events' => $events,
                'daily_trend' => $dailyTrend,
                'top_users' => $topUsers,
            ];
        } catch (\Throwable $e) {
            return ['error' => 'Unable to fetch analytics', 'period' => ['from' => $from, 'to' => $to]];
        }
    }
}
