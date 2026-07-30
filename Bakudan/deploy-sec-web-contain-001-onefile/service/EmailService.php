<?php
/**
 * EmailService — thin facade for sending a single email.
 *
 * Internally delegates to SmtpMailer (SMTP) or PHP mail() depending on MAIL_DRIVER.
 * Handles retries (up to 3) and logs every attempt via EmailLog.
 *
 * NOTE: For bulk/async sending use EmailQueueService instead of calling this directly.
 */
class EmailService {
    private EmailLog $log;

    public function __construct() {
        $this->log = new EmailLog();
    }

    /**
     * Send an HTML email immediately.
     *
     * @param string $to        Recipient email address
     * @param string $toName    Recipient display name
     * @param string $subject   Email subject
     * @param string $html      HTML body
     * @param string $type      Log type: 'task_assigned'|'due_today'|'overdue'
     * @param int    $userId    Associated user ID (0 if unknown)
     * @param string $eventKey  Idempotency key (empty = skip dedup check)
     * @param array  $payload   Extra metadata to store in log
     * @return bool
     */
    public function send(
        string $to,
        string $toName,
        string $subject,
        string $html,
        string $type,
        int    $userId   = 0,
        string $eventKey = '',
        array  $payload  = []
    ): bool {
        if (!defined('EMAIL_ENABLED') || !EMAIL_ENABLED) {
            return false;
        }

        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            error_log('[EmailService] Invalid email address: ' . $to);
            return false;
        }

        // Dedup: skip if already sent for this event_key
        if ($eventKey !== '' && $this->log->hasSentForEvent($eventKey)) {
            return false;
        }

        $fromAddress = defined('EMAIL_FROM_ADDRESS') ? EMAIL_FROM_ADDRESS : '';
        $fromName    = defined('EMAIL_FROM_NAME')    ? EMAIL_FROM_NAME    : 'TaskFlow';

        $maxRetries = 3;
        $lastError  = '';

        for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
            try {
                $ok = $this->sendViaMail($fromAddress, $fromName, $to, $toName, $subject, $html);
                if ($ok) {
                    $this->log->logAttempt($userId, $to, $type, $subject, 'sent', $eventKey ?: null, null, $payload);
                    return true;
                }
                $lastError = 'Driver returned false';
            } catch (\Throwable $e) {
                $lastError = $e->getMessage();
                error_log('[EmailService] Attempt ' . $attempt . ' failed: ' . $lastError);
            }

            if ($attempt < $maxRetries) {
                sleep(1);
            }
        }

        $this->log->logAttempt($userId, $to, $type, $subject, 'failed', $eventKey ?: null, $lastError, $payload);
        error_log('[EmailService] Failed to send to ' . $to . ' after ' . $maxRetries . ' attempts: ' . $lastError);
        return false;
    }

    // ── Driver dispatch ────────────────────────────────────────────────────────

    /**
     * Send using the configured driver (smtp or mail).
     *
     * @throws \RuntimeException on SMTP failure
     */
    private function sendViaMail(
        string $fromAddress, string $fromName,
        string $to,          string $toName,
        string $subject,     string $html
    ): bool {
        $driver = defined('MAIL_DRIVER') ? MAIL_DRIVER : 'smtp';

        if ($driver === 'smtp') {
            $mailer = new SmtpMailer(
                host:       defined('MAIL_HOST')       ? MAIL_HOST       : 'localhost',
                port:       defined('MAIL_PORT')       ? (int)MAIL_PORT  : 587,
                encryption: defined('MAIL_ENCRYPTION') ? MAIL_ENCRYPTION : 'tls',
                username:   defined('MAIL_USERNAME')   ? MAIL_USERNAME   : '',
                password:   defined('MAIL_PASSWORD')   ? MAIL_PASSWORD   : '',
                timeout:    30
            );
            return $mailer->send($fromAddress, $fromName, $to, $toName, $subject, $html);
        }

        // Fallback: PHP mail()
        return $this->sendPhpMail($fromAddress, $fromName, $to, $toName, $subject, $html);
    }

    private function sendPhpMail(
        string $fromAddress, string $fromName,
        string $to,          string $toName,
        string $subject,     string $html
    ): bool {
        $encodedTo      = $this->encodeHeader($toName)   . ' <' . $to . '>';
        $encodedFrom    = $this->encodeHeader($fromName)  . ' <' . $fromAddress . '>';
        $encodedSubject = $this->encodeHeader($subject);

        $headers  = 'From: '       . $encodedFrom . "\r\n";
        $headers .= 'Reply-To: '   . $encodedFrom . "\r\n";
        $headers .= 'To: '         . $encodedTo   . "\r\n";
        $headers .= 'MIME-Version: 1.0'                    . "\r\n";
        $headers .= 'Content-Type: text/html; charset=UTF-8' . "\r\n";
        $headers .= 'Content-Transfer-Encoding: quoted-printable' . "\r\n";
        $headers .= 'X-Mailer: TaskFlow/PHP'               . "\r\n";

        $body = quoted_printable_encode($html);

        return (bool)@mail($to, $encodedSubject, $body, $headers);
    }

    private function encodeHeader(string $value): string {
        if (preg_match('/[^\x20-\x7E]/', $value)) {
            return '=?UTF-8?B?' . base64_encode($value) . '?=';
        }
        return $value;
    }
}
