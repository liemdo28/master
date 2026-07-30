<?php
/**
 * API v1 - Sync & SSE (Server-Sent Events)
 * GET /api/v1/sync/stream   → SSE long-poll stream (for web dashboard real-time)
 * GET /api/v1/sync/poll     → JSON poll (for mobile, lightweight)
 * POST /api/v1/sync/register → Register client for events
 */
require_once __DIR__ . '/ApiController.php';

class SyncApiController extends ApiController {

    // ── Helpers: ensure sync_events table ───────────────────────
    private function ensureTable() {
        if (!$this->db->tableExists('sync_events')) {
            try {
                $this->db->execute("CREATE TABLE IF NOT EXISTS sync_events (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    event VARCHAR(50) NOT NULL,
                    payload JSON NOT NULL,
                    user_id INT DEFAULT NULL,
                    channel VARCHAR(50) DEFAULT 'global',
                    expires_at TIMESTAMP NULL DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_channel_created (channel, created_at),
                    INDEX idx_expires (expires_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            } catch (Exception $e) {}
        }
    }

    // ── GET /api/v1/sync/poll ────────────────────────────────────
    /**
     * Lightweight poll — gọi mỗi 5-10s từ mobile app
     * Trả về events mới kể từ last_sync_id
     */
    public function poll() {
        $this->requireAuth();
        $userId = $this->userId;

        $lastId = $this->safeInt($_GET['last_id'] ?? 0);
        $since  = $_GET['since'] ?? null; // ISO timestamp

        $this->ensureTable();

        $where = "WHERE (channel = 'global' OR channel = ?) AND id > ?";
        $params = [$userId, $lastId];

        if ($since) {
            $where .= " AND created_at > FROM_UNIXTIME(?)";
            $params[] = $since;
        }

        $events = $this->db->fetchAll(
            "SELECT * FROM sync_events {$where} ORDER BY id ASC LIMIT 50",
            $params
        );

        $maxId = 0;
        foreach ($events as $e) {
            if ((int)$e['id'] > $maxId) $maxId = (int)$e['id'];
        }

        api_response([
            'events' => array_map([$this, 'formatEvent'], $events),
            'last_id' => $maxId,
            'server_time' => time(),
        ]);
    }

    // ── GET /api/v1/sync/stream ──────────────────────────────────
    /**
     * SSE stream — web dashboard subscribe để nhận real-time events
     * Header: text/event-stream
     */
    public function stream() {
        // SECURITY FIX: Only accept user_id from session, never from GET param.
        // The old "?user_id=N" param was an auth bypass allowing anyone to subscribe to any user's events.
        if (empty($_SESSION['user_id'])) {
            http_response_code(401);
            echo "data: {\"error\":\"Unauthorized\"}\n\n";
            flush();
            return;
        }
        $userId = (int)$_SESSION['user_id'];

        $this->ensureTable();

        ProductionLogger::info('SSE', 'SSE stream connected', [
            'user_id' => $userId,
            'remote_addr' => $_SERVER['REMOTE_ADDR'] ?? null,
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
        ]);

        // Disable output buffering
        while (ob_get_level()) ob_end_clean();

        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no');
        ini_set('output_buffering', '0');

        $lastId = 0;
        $startTime = time();

        // Keep-alive ping every 30s
        while (true) {
            // Timeout sau 60s để tránh zombie connections
            if ((time() - $startTime) > 55) break;

            $events = $this->db->fetchAll(
                "SELECT * FROM sync_events
                 WHERE (channel = 'global' OR channel = ?) AND id > ? AND (expires_at IS NULL OR expires_at > NOW())
                 ORDER BY id ASC LIMIT 10",
                [$userId, $lastId]
            );

            foreach ($events as $e) {
                $lastId = (int)$e['id'];
                echo "id: " . $e['id'] . "\n";
                echo "event: " . htmlspecialchars($e['event']) . "\n";
                echo "data: " . $e['payload'] . "\n\n";
                flush();
            }

            if (empty($events)) {
                // Send keep-alive comment
                echo ": ping " . time() . "\n\n";
                flush();
            }

            sleep(2); // Poll every 2s
        }

        ProductionLogger::info('SSE', 'SSE stream disconnected', [
            'user_id' => $userId,
            'last_event_id' => $lastId,
            'duration_seconds' => time() - $startTime,
        ]);
    }

    // ── POST /api/v1/sync/broadcast ──────────────────────────────
    /**
     * Broadcast event to sync table (được gọi nội bộ bởi API controllers)
     */
    public function broadcast($event, $data, $channel = 'global', $userId = null) {
        $this->ensureTable();
        try {
            $this->db->insert(
                "INSERT INTO sync_events (event, payload, user_id, channel, created_at)
                 VALUES (?, ?, ?, ?, NOW())",
                [$event, json_encode($data, JSON_UNESCAPED_UNICODE), $userId, $channel]
            );
        } catch (Exception $e) {}
    }

    // ── GET /api/v1/sync/status ───────────────────────────────────
    /**
     * Kiểm tra sync server còn sống không
     */
    public function status() {
        $this->ensureTable();
        $r = $this->db->fetch("SELECT COUNT(*) as c FROM sync_events");
        api_response([
            'status' => 'ok',
            'server_time' => time(),
            'total_events' => (int)$r['c'],
        ]);
    }

    private function formatEvent($e) {
        $payload = json_decode($e['payload'] ?? '{}', true);
        return [
            'id'        => (int)$e['id'],
            'event'     => $e['event'],
            'payload'   => $payload,
            'channel'   => $e['channel'],
            'created_at' => $e['created_at'] ? date('c', strtotime($e['created_at'])) : null,
            'created_ts'=> $e['created_at'] ? strtotime($e['created_at']) : 0,
        ];
    }
}
