<?php
class EmailLog {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    private function ensureSchema(): void {
        if ($this->db->tableExists('email_logs')) return;
        try {
            $sql = file_get_contents(__DIR__ . '/../database/migrations/email_logs.sql');
            // Strip SQL comment lines (-- ...) before splitting to avoid semicolons inside comments
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
            error_log('[EmailLog::ensureSchema] ' . $e->getMessage());
        }
    }

    /**
     * Insert a new log row and return the new ID.
     */
    public function create(array $data): int {
        return (int)$this->db->insert('email_logs', $data);
    }

    /**
     * Has an email of $type been sent to $userId today with status='sent'?
     */
    public function hasSentToday(int $userId, string $type): bool {
        $today = function_exists('app_today') ? app_today() : date('Y-m-d');
        $row = $this->db->fetch(
            "SELECT id FROM email_logs
             WHERE user_id = ? AND type = ? AND status = 'sent'
               AND DATE(created_at) = ?
             LIMIT 1",
            [$userId, $type, $today]
        );
        return !empty($row);
    }

    /**
     * Has an email with this exact event_key already been sent (status='sent')?
     */
    public function hasSentForEvent(string $eventKey): bool {
        $row = $this->db->fetch(
            "SELECT id FROM email_logs
             WHERE event_key = ? AND status = 'sent'
             LIMIT 1",
            [$eventKey]
        );
        return !empty($row);
    }

    /**
     * Log an email attempt (sent or failed).
     */
    public function logAttempt(
        int     $userId,
        string  $email,
        string  $type,
        string  $subject,
        string  $status,
        ?string $eventKey,
        ?string $error,
        array   $payload
    ): void {
        $this->create([
            'user_id'       => $userId ?: null,
            'email'         => $email,
            'type'          => $type,
            'event_key'     => $eventKey ?: null,
            'subject'       => $subject,
            'payload'       => !empty($payload) ? json_encode($payload, JSON_UNESCAPED_UNICODE) : null,
            'status'        => $status,
            'error_message' => $error ?: null,
        ]);
    }
}
