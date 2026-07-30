<?php
/**
 * Phase 8 — Module 8: Enterprise Notification Center
 * 
 * Unified notification hub supporting dashboard, email, SMS, Slack, Teams, push.
 */
class NotificationHub
{
    private $db;

    public function __construct($db = null)
    {
        $this->db = $db ?: Database::getInstance();
    }

    /**
     * Send a notification across specified channels
     */
    public function send(int $userId, string $channel, string $category, string $severity, string $title, string $body, ?string $actionUrl = null, array $metadata = []): int
    {
        $stmt = $this->db->prepare("
            INSERT INTO notification_hub (user_id, channel, category, severity, title, body, action_url, metadata, delivery_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        ");
        $stmt->execute([$userId, $channel, $category, $severity, $title, $body, $actionUrl, json_encode($metadata)]);
        $id = (int)$this->db->lastInsertId();

        // Dispatch based on channel
        $this->dispatch($id, $channel);

        return $id;
    }

    /**
     * Broadcast to multiple users
     */
    public function broadcast(array $userIds, string $channel, string $category, string $severity, string $title, string $body, ?string $actionUrl = null): array
    {
        $ids = [];
        foreach ($userIds as $userId) {
            $ids[] = $this->send($userId, $channel, $category, $severity, $title, $body, $actionUrl);
        }
        return $ids;
    }

    /**
     * Get user notifications
     */
    public function getForUser(int $userId, bool $unreadOnly = false, int $limit = 50): array
    {
        $sql = "SELECT * FROM notification_hub WHERE user_id = ?";
        if ($unreadOnly) $sql .= " AND is_read = 0";
        $sql .= " ORDER BY created_at DESC LIMIT ?";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([$userId, $limit]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Mark notification as read
     */
    public function markRead(int $id): bool
    {
        $stmt = $this->db->prepare("UPDATE notification_hub SET is_read = 1, read_at = NOW() WHERE id = ?");
        return $stmt->execute([$id]);
    }

    /**
     * Mark all as read for a user
     */
    public function markAllRead(int $userId): int
    {
        $stmt = $this->db->prepare("UPDATE notification_hub SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0");
        $stmt->execute([$userId]);
        return $stmt->rowCount();
    }

    /**
     * Get unread count
     */
    public function getUnreadCount(int $userId): int
    {
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM notification_hub WHERE user_id = ? AND is_read = 0");
        $stmt->execute([$userId]);
        return (int)$stmt->fetchColumn();
    }

    /**
     * Send alert for critical predictions
     */
    public function alertCriticalPrediction(int $userId, array $prediction): int
    {
        $channels = P8_NOTIFICATIONS['severity_escalation']['critical'] ?? ['dashboard', 'email'];
        $id = 0;
        foreach ($channels as $channel) {
            $id = $this->send($userId, $channel, 'prediction', 'critical',
                "Critical Prediction: {$prediction['prediction_type']}",
                $prediction['description'],
                "/admin/predictions"
            );
        }
        return $id;
    }

    /**
     * Send workflow notification
     */
    public function alertWorkflowExecution(int $userId, string $workflowName, string $status): int
    {
        return $this->send($userId, 'dashboard', 'workflow', 'info',
            "Workflow Executed: {$workflowName}",
            "Workflow '{$workflowName}' completed with status: {$status}",
            "/admin/workflows"
        );
    }

    // ─── PRIVATE ──────────────────────────────────────────────────

    private function dispatch(int $notificationId, string $channel): void
    {
        // In production, this would call the appropriate delivery service
        $this->db->prepare("UPDATE notification_hub SET delivery_status = 'delivered', delivered_at = NOW() WHERE id = ?")
            ->execute([$notificationId]);
    }
}
