<?php
/**
 * EmailQueue — persistence layer for the async email queue.
 *
 * Auto-migrates the email_queue table on first use.
 */
class EmailQueue {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    private function ensureSchema(): void {
        if ($this->db->tableExists('email_queue')) return;
        try {
            $sql   = file_get_contents(__DIR__ . '/../database/migrations/email_queue.sql');
            $lines = array_filter(
                explode("\n", $sql),
                fn($l) => !preg_match('/^\s*--/', $l)
            );
            $stmts = array_filter(array_map('trim', explode(';', implode("\n", $lines))));
            foreach ($stmts as $stmt) {
                $this->db->execute($stmt);
            }
            $this->db->invalidateSchemaCache();
        } catch (\Throwable $e) {
            error_log('[EmailQueue::ensureSchema] ' . $e->getMessage());
        }
    }

    /**
     * Insert a new email into the queue.
     * Returns the new row ID.
     */
    public function enqueue(array $data): int {
        return (int)$this->db->insert('email_queue', $data);
    }

    /**
     * Fetch a batch of pending emails (status='pending', attempts < maxAttempts).
     */
    public function getPending(int $limit = 20, int $maxAttempts = 3): array {
        return $this->db->fetchAll(
            "SELECT * FROM email_queue
             WHERE status = 'pending' AND attempts < ?
             ORDER BY created_at ASC
             LIMIT ?",
            [$maxAttempts, $limit]
        );
    }

    /**
     * Mark an item as 'sending' (pessimistic lock) and increment attempt count.
     */
    public function markSending(int $id): void {
        $this->db->execute(
            "UPDATE email_queue SET status = 'sending', attempts = attempts + 1 WHERE id = ?",
            [$id]
        );
    }

    /**
     * Mark an item as successfully sent.
     */
    public function markSent(int $id): void {
        $this->db->execute(
            "UPDATE email_queue SET status = 'sent', last_error = NULL, sent_at = NOW() WHERE id = ?",
            [$id]
        );
    }

    /**
     * Mark an item as failed, storing the error.
     * If attempts has reached maxAttempts it stays 'failed'; otherwise resets to 'pending' for retry.
     */
    public function markFailed(int $id, string $error, int $maxAttempts = 3): void {
        // Re-read current attempts count
        $row = $this->db->fetch("SELECT attempts FROM email_queue WHERE id = ?", [$id]);
        $attempts = (int)($row['attempts'] ?? $maxAttempts);

        $nextStatus = ($attempts >= $maxAttempts) ? 'failed' : 'pending';

        $this->db->execute(
            "UPDATE email_queue SET status = ?, last_error = ? WHERE id = ?",
            [$nextStatus, $error, $id]
        );
    }

    /**
     * Check whether a given event_key is already in the queue (any status except failed).
     * Used to prevent duplicate enqueues.
     */
    public function hasEventKey(string $eventKey): bool {
        if ($eventKey === '') return false;
        $row = $this->db->fetch(
            "SELECT id FROM email_queue WHERE event_key = ? AND status != 'failed' LIMIT 1",
            [$eventKey]
        );
        return !empty($row);
    }

    /**
     * Count pending + sending items.
     */
    public function pendingCount(): int {
        $row = $this->db->fetch(
            "SELECT COUNT(*) AS cnt FROM email_queue WHERE status IN ('pending','sending')"
        );
        return (int)($row['cnt'] ?? 0);
    }

    /**
     * Delete sent items older than $days days (housekeeping).
     */
    public function purgeSent(int $days = 30): int {
        $this->db->execute(
            "DELETE FROM email_queue WHERE status = 'sent' AND sent_at < DATE_SUB(NOW(), INTERVAL ? DAY)",
            [$days]
        );
        return 0; // rowCount not always available
    }
}
