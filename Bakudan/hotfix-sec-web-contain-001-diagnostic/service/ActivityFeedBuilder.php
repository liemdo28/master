<?php
/**
 * ActivityFeedBuilder — log what automation did each cron cycle.
 *
 * Provides leadership visibility into autonomous system actions.
 * Keeps last 500 rows; older rows are pruned automatically.
 */
class ActivityFeedBuilder {
    private $db;
    private const MAX_ROWS = 500;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    /**
     * Log a single activity event.
     *
     * @param string $type      e.g. 'auto_action', 'payment_alert', 'reminder_sent', 'cron_ok'
     * @param string $severity  'info' | 'warning' | 'error'
     * @param string $title     Short headline
     * @param string $summary   Optional detail
     * @param array  $payload   Optional structured data
     */
    public function log(
        string $type,
        string $severity,
        string $title,
        string $summary  = '',
        array  $payload  = []
    ): void {
        if (!$this->db->tableExists('system_activity_feed')) return;

        $this->db->insert(
            "INSERT INTO system_activity_feed (type, severity, title, summary, payload_json, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())",
            [
                $type,
                $severity,
                $title,
                $summary ?: null,
                !empty($payload) ? json_encode($payload, JSON_UNESCAPED_UNICODE) : null,
            ]
        );

        // Prune excess rows
        $this->db->execute(
            "DELETE FROM system_activity_feed
             WHERE id NOT IN (
               SELECT id FROM (
                 SELECT id FROM system_activity_feed ORDER BY created_at DESC LIMIT " . self::MAX_ROWS . "
               ) t
             )"
        );
    }

    /**
     * Log a complete cron pipeline run summary.
     */
    public function logCronRun(array $summary): void {
        $failedSteps = array_filter($summary['steps'] ?? [], fn($s) => $s['status'] === 'error');
        $severity    = empty($failedSteps) ? 'info' : 'warning';

        $tgToday   = $summary['telegram_due_today_sent'] ?? null;
        $tgOverdue = $summary['telegram_overdue_sent']   ?? null;

        $detail = sprintf(
            'notifs=%d | bills=%d | recurring=%d | tg_today=%s | tg_overdue=%s | queue=%d->%d',
            $summary['notifications_created']  ?? 0,
            $summary['bills_reminded']          ?? 0,
            $summary['recurring_generated']     ?? 0,
            $tgToday  === null ? 'n/a' : ($tgToday  === -1 ? 'skip' : $tgToday),
            $tgOverdue === null ? 'n/a' : ($tgOverdue === -1 ? 'skip' : $tgOverdue),
            $summary['email_queue_before'] ?? 0,
            $summary['email_queue_after']  ?? 0
        );

        $this->log('cron_run', $severity, 'Cron pipeline completed', $detail, [
            'failed_steps' => array_values($failedSteps),
            'summary'      => $summary,
        ]);
    }

    /**
     * Log that Telegram reminders were dispatched.
     */
    public function logTelegramReminders(int $todayCount, int $overdueCount): void {
        if ($todayCount === 0 && $overdueCount === 0) return;

        $this->log(
            'reminder_sent',
            'info',
            "Telegram reminders dispatched",
            "{$todayCount} due-today · {$overdueCount} overdue",
            ['due_today' => $todayCount, 'overdue' => $overdueCount]
        );
    }

    /**
     * Log that the intelligence feed was refreshed.
     */
    public function logIntelligenceRefresh(float $riskScore, int $decisions): void {
        $this->log(
            'intelligence_refresh',
            'info',
            'Risk snapshot + decision feed refreshed',
            "Unified risk={$riskScore} · {$decisions} decisions generated"
        );
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    /**
     * Get recent activity events.
     *
     * @param int    $limit     Max rows
     * @param string $severity  Filter: 'all' | 'info' | 'warning' | 'error'
     */
    public function recent(int $limit = 20, string $severity = 'all'): array {
        if (!$this->db->tableExists('system_activity_feed')) return [];

        if ($severity === 'all') {
            return $this->db->fetchAll(
                "SELECT * FROM system_activity_feed ORDER BY created_at DESC LIMIT ?",
                [$limit]
            ) ?: [];
        }

        return $this->db->fetchAll(
            "SELECT * FROM system_activity_feed WHERE severity = ? ORDER BY created_at DESC LIMIT ?",
            [$severity, $limit]
        ) ?: [];
    }
}
