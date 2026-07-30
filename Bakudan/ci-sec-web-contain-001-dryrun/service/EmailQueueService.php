<?php
/**
 * EmailQueueService — Enqueue emails and process the queue via SmtpMailer.
 *
 * Flow:
 *   event/cron trigger
 *     → EmailNotificationService calls enqueue()
 *     → email_queue row inserted with status='pending'
 *
 *   ProcessEmailQueueJob runs (separate cron)
 *     → calls processQueue()
 *     → for each pending row: SmtpMailer sends → mark sent/failed → log to email_logs
 */
class EmailQueueService {
    private EmailQueue  $queue;
    private EmailLog    $log;
    private $db;

    public function __construct() {
        $this->queue = new EmailQueue();
        $this->log   = new EmailLog();
        $this->db    = Database::getInstance();
    }

    // ── Enqueue ────────────────────────────────────────────────────────────────

    /**
     * Add an email to the queue.
     *
     * Skips if:
     *   - EMAIL_ENABLED is false
     *   - The same event_key is already in queue (not failed)
     *   - The same event_key has already been successfully sent (email_logs check)
     *
     * @return int  Queue row ID, or 0 if skipped
     */
    public function enqueue(
        string $to,
        string $toName,
        string $subject,
        string $html,
        string $type,
        int    $userId   = 0,
        string $eventKey = '',
        array  $payload  = []
    ): int {
        if (!defined('EMAIL_ENABLED') || !EMAIL_ENABLED) {
            return 0;
        }

        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            error_log('[EmailQueueService] Invalid email: ' . $to);
            return 0;
        }

        // Dedup: already in queue?
        if ($eventKey !== '' && $this->queue->hasEventKey($eventKey)) {
            return 0;
        }

        // Dedup: already sent? (checks email_logs)
        if ($eventKey !== '' && $this->log->hasSentForEvent($eventKey)) {
            return 0;
        }

        return $this->queue->enqueue([
            'to_email'   => $to,
            'to_name'    => $toName,
            'subject'    => $subject,
            'body'       => $html,
            'event_type' => $type,
            'user_id'    => $userId ?: null,
            'event_key'  => $eventKey ?: null,
            'payload'    => !empty($payload) ? json_encode($payload, JSON_UNESCAPED_UNICODE) : null,
        ]);
    }

    // ── Process ────────────────────────────────────────────────────────────────

    /**
     * Process pending emails in the queue using SmtpMailer.
     *
     * @param int $batchSize Number of emails to process per run
     * @return array{sent:int, failed:int, skipped:int}
     */
    public function processQueue(int $batchSize = 20): array {
        $pending = $this->queue->getPending($batchSize, 3);
        $sent = $failed = $skipped = 0;

        if (empty($pending)) {
            return ['sent' => 0, 'failed' => 0, 'skipped' => 0];
        }

        $mailer = $this->buildMailer();

        foreach ($pending as $item) {
            $id = (int)$item['id'];

            // Mark as sending (prevents parallel workers picking same item)
            $this->queue->markSending($id);

            try {
                $ok = $mailer->send(
                    defined('EMAIL_FROM_ADDRESS') ? EMAIL_FROM_ADDRESS : '',
                    defined('EMAIL_FROM_NAME')    ? EMAIL_FROM_NAME    : 'TaskFlow',
                    $item['to_email'],
                    $item['to_name'],
                    $item['subject'],
                    $item['body']
                );

                if ($ok) {
                    $this->queue->markSent($id);
                    $this->log->logAttempt(
                        (int)($item['user_id'] ?? 0),
                        $item['to_email'],
                        $item['event_type'],
                        $item['subject'],
                        'sent',
                        $item['event_key'] ?: null,
                        null,
                        $item['payload'] ? (json_decode($item['payload'], true) ?? []) : []
                    );
                    $sent++;
                }
            } catch (\Throwable $e) {
                $errMsg = $e->getMessage();
                $this->queue->markFailed($id, $errMsg, 3);
                $this->log->logAttempt(
                    (int)($item['user_id'] ?? 0),
                    $item['to_email'],
                    $item['event_type'],
                    $item['subject'],
                    'failed',
                    $item['event_key'] ?: null,
                    $errMsg,
                    $item['payload'] ? (json_decode($item['payload'], true) ?? []) : []
                );
                error_log('[EmailQueueService] Failed to send queue item #' . $id . ': ' . $errMsg);
                $failed++;
            }
        }

        return ['sent' => $sent, 'failed' => $failed, 'skipped' => $skipped];
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private function buildMailer(): SmtpMailer {
        $driver = defined('MAIL_DRIVER') ? MAIL_DRIVER : 'smtp';

        if ($driver === 'mail') {
            // Fall back to a no-op wrapper that uses PHP mail()
            // (SmtpMailer handles actual SMTP; for 'mail' driver we delegate to the legacy EmailService)
            return new class extends SmtpMailer {
                public function __construct() {
                    // no-op — skip parent constructor
                }

                public function send(
                    string $fromAddress, string $fromName,
                    string $to, string $toName,
                    string $subject, string $html
                ): bool {
                    $encodedFrom    = '=?UTF-8?B?' . base64_encode($fromName) . '?= <' . $fromAddress . '>';
                    $encodedTo      = '=?UTF-8?B?' . base64_encode($toName)   . '?= <' . $to . '>';
                    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject)  . '?=';
                    $headers  = "From: {$encodedFrom}\r\nReply-To: {$encodedFrom}\r\n";
                    $headers .= "To: {$encodedTo}\r\n";
                    $headers .= "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n";
                    $headers .= "Content-Transfer-Encoding: quoted-printable\r\n";
                    $body = quoted_printable_encode($html);
                    return (bool)@mail($to, $encodedSubject, $body, $headers);
                }
            };
        }

        return new SmtpMailer(
            host:       defined('MAIL_HOST')       ? MAIL_HOST       : 'localhost',
            port:       defined('MAIL_PORT')       ? (int)MAIL_PORT  : 587,
            encryption: defined('MAIL_ENCRYPTION') ? MAIL_ENCRYPTION : 'tls',
            username:   defined('MAIL_USERNAME')   ? MAIL_USERNAME   : '',
            password:   defined('MAIL_PASSWORD')   ? MAIL_PASSWORD   : '',
            timeout:    30,
            debug:      false
        );
    }

    /**
     * Pending count (useful for health-check endpoints).
     */
    public function pendingCount(): int {
        return $this->queue->pendingCount();
    }
}
