<?php
/**
 * MobilePushQueueBuilder — build deduped, role-targeted mobile push queue.
 *
 * Rules:
 *  - Only push high-value events (see ALLOWED_TYPES)
 *  - Dedupe within dedupe_window_minutes — same push_key not sent twice
 *  - Respect send window (07:30–20:00 for normal, anytime for critical)
 *  - Push queue is read by mobile push dispatcher (FCM/APNS)
 */
class MobilePushQueueBuilder {
    private $db;

    // Send window for non-critical pushes (APP_TIMEZONE hours)
    private const SEND_WINDOW_START = 7;   // 07:30
    private const SEND_WINDOW_END   = 20;  // 20:00

    // Only queue these event types
    private const ALLOWED_TYPES = [
        'approval_required',
        'bill_critical',
        'compliance_due',
        'overload_detected',
        'cron_failure',
        'filing_due_24h',
    ];

    public function __construct() {
        $this->db = Database::getInstance();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Build push queue from active decision feed + approval queue.
     * Returns count of new items queued.
     */
    public function build(): int {
        if (!$this->db->tableExists('mobile_push_queue') ||
            !$this->db->tableExists('decision_feed')) {
            return 0;
        }

        $queued = 0;
        $queued += $this->queueFromDecisionFeed();
        $queued += $this->queueFromApprovals();

        return $queued;
    }

    /**
     * Mark queued items as sent (called by push dispatcher after delivery).
     */
    public function markSent(int $id): void {
        $this->db->execute(
            "UPDATE mobile_push_queue SET status='sent', sent_at=NOW() WHERE id=?",
            [$id]
        );
    }

    /**
     * Get pending push items ready to send.
     * Respects send window unless item priority is 'critical'.
     */
    public function getPending(int $limit = 50): array {
        if (!$this->db->tableExists('mobile_push_queue')) return [];

        $currentHour = (int) date('G');
        $inWindow    = $currentHour >= self::SEND_WINDOW_START &&
                       $currentHour <  self::SEND_WINDOW_END;

        if ($inWindow) {
            // Send all pending (normal + critical)
            $rows = $this->db->fetchAll(
                "SELECT * FROM mobile_push_queue
                 WHERE status = 'pending'
                 ORDER BY FIELD(priority,'critical','high','normal'), created_at ASC
                 LIMIT ?",
                [$limit]
            );
        } else {
            // Outside window: only critical
            $rows = $this->db->fetchAll(
                "SELECT * FROM mobile_push_queue
                 WHERE status = 'pending' AND priority = 'critical'
                 ORDER BY created_at ASC
                 LIMIT ?",
                [$limit]
            );
        }

        return $rows ?: [];
    }

    // ── Queue builders ────────────────────────────────────────────────────────

    private function queueFromDecisionFeed(): int {
        $decisions = $this->db->fetchAll(
            "SELECT * FROM decision_feed
             WHERE is_active = 1
               AND impact_score >= 70
             ORDER BY impact_score DESC
             LIMIT 10"
        ) ?: [];

        $count = 0;
        foreach ($decisions as $d) {
            $type = $this->mapDecisionToPushType($d);
            if (!$type) continue;

            $priority = $d['impact_score'] >= 90 ? 'critical' :
                       ($d['impact_score'] >= 70 ? 'high' : 'normal');

            $pushKey     = $type . '_' . $d['cta_target_id'];
            $dedupeMin   = $priority === 'critical' ? 360 : 720; // 6h / 12h
            $roles       = json_decode($d['role_scope_json'] ?? '[]', true) ?: [];

            if ($this->isDuplicate($pushKey, $dedupeMin)) continue;

            $this->db->insert(
                "INSERT INTO mobile_push_queue
                   (push_key, role_scope_json, title, body, action_type, action_target_id,
                    priority, status, dedupe_window_minutes, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW())",
                [
                    $pushKey,
                    json_encode($roles),
                    $d['title'],
                    $this->buildBody($d),
                    $d['cta_type'],
                    $d['cta_target_id'],
                    $priority,
                    $dedupeMin,
                ]
            );
            $count++;
        }

        return $count;
    }

    private function queueFromApprovals(): int {
        if (!$this->db->tableExists('approval_queue')) return 0;

        $approvals = $this->db->fetchAll(
            "SELECT * FROM approval_queue
             WHERE status = 'pending'
               AND (expires_at IS NULL OR expires_at > NOW())
               AND impact_score >= 60
             ORDER BY impact_score DESC
             LIMIT 5"
        ) ?: [];

        $count = 0;
        foreach ($approvals as $a) {
            $pushKey   = 'approval_' . $a['approval_id'];
            $dedupeMin = 480; // 8h
            $roles     = json_decode($a['role_scope_json'] ?? '[]', true) ?: [];

            if ($this->isDuplicate($pushKey, $dedupeMin)) continue;

            $this->db->insert(
                "INSERT INTO mobile_push_queue
                   (push_key, role_scope_json, title, body, action_type, action_target_id,
                    priority, status, dedupe_window_minutes, created_at)
                 VALUES (?, ?, ?, ?, 'open_approval', ?, 'high', 'pending', ?, NOW())",
                [
                    $pushKey,
                    json_encode($roles),
                    '✅ Approval needed: ' . $a['title'],
                    $a['summary'] ?? 'Tap to review and approve',
                    $a['approval_id'],
                    $dedupeMin,
                ]
            );
            $count++;
        }

        return $count;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function isDuplicate(string $pushKey, int $dedupeMinutes): bool {
        $row = $this->db->fetch(
            "SELECT id FROM mobile_push_queue
             WHERE push_key = ?
               AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
               AND status IN ('pending','sent')
             LIMIT 1",
            [$pushKey, $dedupeMinutes]
        );
        return !empty($row);
    }

    private function mapDecisionToPushType(array $d): ?string {
        if ($d['type'] === 'compliance') return 'compliance_due';
        if ($d['type'] === 'finance')    return 'bill_critical';
        if ($d['type'] === 'operations') return 'overload_detected';
        return null;
    }

    private function buildBody(array $d): string {
        $parts = [];
        if ($d['deadline_label']) $parts[] = $d['deadline_label'];
        if ($d['ignored_effect']) $parts[] = $d['ignored_effect'];
        if ($d['business_name'])  $parts[] = $d['business_name'];
        return implode(' · ', $parts) ?: 'Tap to review';
    }
}
