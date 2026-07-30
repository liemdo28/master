<?php
/**
 * SmtpMailer — Raw socket-based SMTP client.
 *
 * Supports:
 *   - STARTTLS (port 587, encryption='tls')
 *   - SSL/TLS   (port 465, encryption='ssl')
 *   - Plain      (port 25,  encryption='')
 *   - AUTH LOGIN
 *
 * No external dependencies — pure PHP stream sockets.
 */
class SmtpMailer {
    private string $host;
    private int    $port;
    private string $encryption; // 'tls', 'ssl', or ''
    private string $username;
    private string $password;
    private int    $timeout;
    private bool   $debug;

    /** @var resource|null */
    private $socket = null;
    private array $cmdLog = [];

    public function __construct(
        string $host,
        int    $port       = 587,
        string $encryption = 'tls',
        string $username   = '',
        string $password   = '',
        int    $timeout    = 30,
        bool   $debug      = false
    ) {
        $this->host       = $host;
        $this->port       = $port;
        $this->encryption = strtolower(trim($encryption));
        $this->username   = $username;
        $this->password   = $password;
        $this->timeout    = $timeout;
        $this->debug      = $debug;
    }

    /**
     * Send an HTML email via SMTP.
     *
     * @throws \RuntimeException on connection or protocol failure
     */
    public function send(
        string $fromAddress,
        string $fromName,
        string $to,
        string $toName,
        string $subject,
        string $html
    ): bool {
        try {
            $this->connect();
            $this->ehlo();

            if ($this->encryption === 'tls') {
                $this->startTls();
                $this->ehlo(); // Re-EHLO after STARTTLS to refresh capabilities
            }

            if ($this->username !== '' && $this->password !== '') {
                $this->authenticate();
            }

            $this->sendMail($fromAddress, $fromName, $to, $toName, $subject, $html);
            $this->quit();
            return true;
        } finally {
            $this->close();
        }
    }

    // ── Connection ─────────────────────────────────────────────────────────────

    private function connect(): void {
        $addr = ($this->encryption === 'ssl')
            ? 'ssl://' . $this->host . ':' . $this->port
            : $this->host . ':' . $this->port;

        $context = stream_context_create([
            'ssl' => [
                'verify_peer'       => true,
                'verify_peer_name'  => true,
                'allow_self_signed' => false,
            ],
        ]);

        $errno  = 0;
        $errstr = '';
        $socket = @stream_socket_client(
            $addr, $errno, $errstr, $this->timeout,
            STREAM_CLIENT_CONNECT, $context
        );

        if (!$socket) {
            throw new \RuntimeException(
                "SmtpMailer: cannot connect to {$this->host}:{$this->port} — {$errstr} (errno {$errno})"
            );
        }

        stream_set_timeout($socket, $this->timeout);
        $this->socket = $socket;

        // Read server greeting (220)
        $this->expect(220);
    }

    private function close(): void {
        if ($this->socket !== null && is_resource($this->socket)) {
            fclose($this->socket);
        }
        $this->socket = null;
    }

    // ── SMTP Commands ──────────────────────────────────────────────────────────

    private function ehlo(): void {
        $localHost = gethostname() ?: 'localhost';
        $this->cmd("EHLO {$localHost}");
        $this->readMultiline(250);
    }

    private function startTls(): void {
        $this->cmd('STARTTLS');
        $this->expect(220);

        // Upgrade the stream to TLS
        $ok = stream_socket_enable_crypto(
            $this->socket,
            true,
            STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT
            | STREAM_CRYPTO_METHOD_TLSv1_1_CLIENT
            | STREAM_CRYPTO_METHOD_TLS_CLIENT
        );

        if (!$ok) {
            throw new \RuntimeException('SmtpMailer: STARTTLS crypto handshake failed.');
        }
    }

    private function authenticate(): void {
        $this->cmd('AUTH LOGIN');
        $this->expect(334);

        $this->cmd(base64_encode($this->username));
        $this->expect(334);

        $this->cmd(base64_encode($this->password));
        $this->expect(235);
    }

    private function sendMail(
        string $fromAddress, string $fromName,
        string $to,          string $toName,
        string $subject,     string $html
    ): void {
        $this->cmd("MAIL FROM:<{$fromAddress}>");
        $this->expect(250);

        $this->cmd("RCPT TO:<{$to}>");
        $this->expect(250, 251); // 251 = user not local but will forward

        $this->cmd('DATA');
        $this->expect(354);

        $message = $this->buildMessage($fromAddress, $fromName, $to, $toName, $subject, $html);

        // RFC 2821: dot-stuffing — lines that start with '.' get an extra '.'
        $lines   = explode("\r\n", $message);
        $stuffed = implode("\r\n", array_map(
            fn(string $line) => ($line !== '' && $line[0] === '.') ? '.' . $line : $line,
            $lines
        ));

        // End of DATA
        $this->write($stuffed . "\r\n.\r\n");
        $this->expect(250);
    }

    private function quit(): void {
        try {
            $this->cmd('QUIT');
            $this->expect(221);
        } catch (\Throwable $e) {
            // Ignore quit errors — connection was closing anyway
        }
    }

    // ── Message building ───────────────────────────────────────────────────────

    private function buildMessage(
        string $fromAddress, string $fromName,
        string $to,          string $toName,
        string $subject,     string $html
    ): string {
        $encodedFrom    = $this->encodeHeader($fromName) . ' <' . $fromAddress . '>';
        $encodedTo      = $this->encodeHeader($toName)   . ' <' . $to   . '>';
        $encodedSubject = $this->encodeHeader($subject);
        $date           = date('r');
        $msgId          = '<' . md5(uniqid($to . $subject, true)) . '@' . $this->host . '>';
        $body           = quoted_printable_encode($html);

        $headers = [
            "Date: {$date}",
            "Message-ID: {$msgId}",
            "From: {$encodedFrom}",
            "To: {$encodedTo}",
            "Subject: {$encodedSubject}",
            "MIME-Version: 1.0",
            "Content-Type: text/html; charset=UTF-8",
            "Content-Transfer-Encoding: quoted-printable",
            "X-Mailer: TaskFlow/SmtpMailer",
        ];

        return implode("\r\n", $headers) . "\r\n\r\n" . $body;
    }

    // ── Low-level I/O ──────────────────────────────────────────────────────────

    private function cmd(string $command): void {
        if ($this->debug) {
            $safe = preg_match('/^AUTH|^[a-zA-Z0-9+\/=]{20,}$/', $command) ? '[REDACTED]' : $command;
            $this->cmdLog[] = '> ' . $safe;
        }
        $this->write($command . "\r\n");
    }

    private function write(string $data): void {
        if (!$this->socket || !is_resource($this->socket)) {
            throw new \RuntimeException('SmtpMailer: not connected.');
        }
        fwrite($this->socket, $data);
    }

    /**
     * Read a single-line response and return it.
     */
    private function readLine(): string {
        $line = '';
        while (!feof($this->socket)) {
            $char = fread($this->socket, 1);
            if ($char === false) break;
            $line .= $char;
            if (str_ends_with($line, "\n")) break;
        }
        if ($this->debug) $this->cmdLog[] = '< ' . rtrim($line);
        return $line;
    }

    /**
     * Read a (possibly multi-line) response where continuation lines use "NNN-".
     * Returns the full buffer.
     */
    private function readMultiline(int $expectedCode): string {
        $buf = '';
        while (true) {
            $line = $this->readLine();
            $buf .= $line;
            // If 4th character is a space (not '-'), it's the final response line
            if (!isset($line[3]) || $line[3] === ' ') break;
        }
        $code = (int)substr($buf, 0, 3);
        if ($code !== $expectedCode) {
            throw new \RuntimeException(
                "SmtpMailer: expected {$expectedCode}, got {$code}: " . trim($buf)
            );
        }
        return $buf;
    }

    /**
     * Read response and verify it matches one of the expected codes.
     */
    private function expect(int ...$expected): string {
        $line = $this->readLine();
        $code = (int)substr($line, 0, 3);
        if (!in_array($code, $expected, true)) {
            throw new \RuntimeException(
                'SmtpMailer: expected ' . implode('/', $expected) . ", got {$code}: " . trim($line)
            );
        }
        return $line;
    }

    private function encodeHeader(string $value): string {
        if (preg_match('/[^\x20-\x7E]/', $value)) {
            return '=?UTF-8?B?' . base64_encode($value) . '?=';
        }
        return $value;
    }

    /** Return command log (useful for debugging). */
    public function getLog(): array {
        return $this->cmdLog;
    }
}
