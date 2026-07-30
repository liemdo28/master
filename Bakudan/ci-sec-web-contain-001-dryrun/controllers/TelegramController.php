<?php
/**
 * TelegramController — Webhook handler and all four bot flows
 *
 * Routes:
 *   POST /webhook/telegram          ← Telegram sends all updates here
 *   POST /telegram/link/init        ← Web UI: generate deep-link token
 *   POST /telegram/link/unlink      ← Web UI: disconnect account
 *   POST /telegram/preferences      ← Web UI: save notification prefs
 *   GET  /telegram/setup-webhook    ← Admin: register webhook URL with Telegram
 */
class TelegramController {
    private TelegramBot  $bot;

    public function __construct() {
        $this->bot = new TelegramBot();
    }

    // ═══════════════════════════════════════════════════════════════
    // WEBHOOK ENTRY POINT
    // ═══════════════════════════════════════════════════════════════

    public function handleWebhook(): void {
        // Validate secret header
        $secret = defined('TELEGRAM_WEBHOOK_SECRET') ? TELEGRAM_WEBHOOK_SECRET : '';
        if ($secret !== '') {
            $incoming = $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '';
            if (!hash_equals($secret, $incoming)) {
                http_response_code(403);
                exit;
            }
        }

        $raw    = file_get_contents('php://input');
        $update = json_decode($raw, true);
        if (!is_array($update)) { http_response_code(200); exit; }

        // Telegram expects a fast 200 OK — respond immediately
        http_response_code(200);
        header('Content-Type: application/json');
        echo '{"ok":true}';
        // Flush output before doing any work (shared hosting / no fastcgi)
        if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();

        try {
            if (isset($update['message'])) {
                $this->handleMessage($update['message']);
            } elseif (isset($update['callback_query'])) {
                $this->handleCallbackQuery($update['callback_query']);
            }
        } catch (\Throwable $e) {
            error_log('TelegramController webhook error: ' . $e->getMessage());
        }

        exit;
    }

    // ═══════════════════════════════════════════════════════════════
    // INBOUND MESSAGE HANDLER
    // ═══════════════════════════════════════════════════════════════

    private function handleMessage(array $msg): void {
        $chatId    = (int)($msg['chat']['id'] ?? 0);
        $text      = trim($msg['text'] ?? '');
        $tgUser    = $msg['from'] ?? [];
        $firstName = $tgUser['first_name'] ?? '';
        $username  = $tgUser['username'] ?? '';

        if ($chatId === 0 || $text === '') return;

        // ── /start {token} — account linking ─────────────────────
        if (str_starts_with($text, '/start')) {
            $parts = explode(' ', $text, 2);
            $token = trim($parts[1] ?? '');
            if ($token !== '') {
                $this->handleAccountLink($chatId, $token, $username, $firstName);
            } else {
                $this->bot->sendMessage($chatId, $this->helpText());
            }
            return;
        }

        // ── Resolve linked user ───────────────────────────────────
        $user = $this->bot->getUserByChatId($chatId);
        if (!$user) {
            $botUsername = defined('TELEGRAM_BOT_USERNAME') ? TELEGRAM_BOT_USERNAME : 'taskflow_bot';
            $this->bot->sendMessage($chatId,
                "👋 Xin chào! Bot này dành riêng cho team TaskFlow.\n\n" .
                "Để kết nối tài khoản, vui lòng vào <b>Settings → Telegram</b> trên dashboard và bấm <b>Kết nối Telegram</b>."
            );
            return;
        }
        $userId  = (int)$user['id'];
        $isAdmin = in_array($user['role'], ['admin', 'manager']);

        // ── Rate limit check ──────────────────────────────────────
        if (!$this->bot->checkRateLimit($userId)) {
            $this->bot->sendMessage($chatId, '⚠️ Bạn đã gửi quá nhiều tin nhắn. Vui lòng thử lại sau.');
            return;
        }

        // Log inbound
        $this->bot->log([
            'user_id'      => $userId,
            'chat_id'      => $chatId,
            'direction'    => 'in',
            'message_type' => 'other',
            'content'      => $text,
        ]);

        // ── Built-in commands ─────────────────────────────────────
        if ($text === '/help')   { $this->bot->sendMessage($chatId, $this->helpText()); return; }
        if ($text === '/status') { $this->sendUserStatus($chatId, $userId, $isAdmin);   return; }
        if ($text === '/tasks')  { $this->sendTodayTasks($chatId, $userId);              return; }

        // ── AI rate limit ─────────────────────────────────────────
        if (!$this->bot->checkRateLimit($userId, 'ai')) {
            $this->bot->sendMessage($chatId,
                '⚠️ Bạn đã dùng hết lượt AI hôm nay. Hạn mức sẽ reset vào lúc nửa đêm.'
            );
            return;
        }

        // ── Route to AI (F2 or F4) ────────────────────────────────
        $this->routeToAi($chatId, $userId, $isAdmin, $text);
    }

    // ═══════════════════════════════════════════════════════════════
    // CALLBACK QUERY (inline button press)
    // ═══════════════════════════════════════════════════════════════

    private function handleCallbackQuery(array $cq): void {
        $callbackId = $cq['id'];
        $chatId     = (int)($cq['message']['chat']['id'] ?? 0);
        $data       = $cq['data'] ?? '';

        $user = $this->bot->getUserByChatId($chatId);
        if (!$user) {
            $this->bot->answerCallback($callbackId, 'Phiên đã hết hạn.', true);
            return;
        }
        $userId = (int)$user['id'];

        if (str_starts_with($data, 'confirm_task:')) {
            $draftKey = substr($data, strlen('confirm_task:'));
            $this->confirmCreateTask($chatId, $userId, $draftKey, $callbackId);
        } elseif (str_starts_with($data, 'cancel_task:')) {
            $draftKey = substr($data, strlen('cancel_task:'));
            $this->bot->consumeDraft($draftKey);
            $this->bot->answerCallback($callbackId, 'Đã huỷ.');
            $this->bot->sendMessage($chatId, '❌ Đã huỷ tạo task.');
        } else {
            $this->bot->answerCallback($callbackId);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ACCOUNT LINKING
    // ═══════════════════════════════════════════════════════════════

    private function handleAccountLink(int $chatId, string $token, string $username, string $firstName): void {
        $appUser = $this->bot->consumeLinkToken($token, $chatId, $username, $firstName);
        if (!$appUser) {
            $this->bot->sendMessage($chatId,
                '❌ Link không hợp lệ hoặc đã hết hạn (15 phút).\n\nVui lòng tạo link mới từ dashboard.'
            );
            return;
        }

        $name = $appUser['name'] ?? 'bạn';
        $this->bot->sendMessage($chatId,
            "✅ <b>Kết nối thành công!</b>\n\n" .
            "Xin chào <b>{$name}</b>! Từ giờ mình sẽ:\n" .
            "• Gửi danh sách task hàng sáng lúc 8:00\n" .
            "• Thông báo khi bạn được assign task\n" .
            "• Trả lời câu hỏi về task qua AI\n\n" .
            "Gõ /help để xem hướng dẫn đầy đủ."
        );
    }

    /**
     * Web UI: generate token and return the deep-link URL (AJAX).
     */
    public function initLink(): void {
        if (!isLoggedIn()) { json_response(['error' => 'Unauthorized'], 401); return; }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { json_response(['error' => 'Invalid CSRF'], 403); return; }

        $userId  = (int)$_SESSION['user_id'];
        $deepLink = $this->bot->generateLinkToken($userId);
        json_response(['ok' => true, 'url' => $deepLink]);
    }

    /**
     * Web UI: unlink Telegram account.
     */
    public function unlink(): void {
        if (!isLoggedIn()) { json_response(['error' => 'Unauthorized'], 401); return; }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { json_response(['error' => 'Invalid CSRF'], 403); return; }

        $this->bot->unlinkUser((int)$_SESSION['user_id']);
        json_response(['ok' => true]);
    }

    /**
     * Web UI: save Telegram notification preferences.
     */
    public function savePreferences(): void {
        if (!isLoggedIn()) { json_response(['error' => 'Unauthorized'], 401); return; }
        if (!verify_csrf($_POST['csrf_token'] ?? '')) { json_response(['error' => 'Invalid CSRF'], 403); return; }

        $userId = (int)$_SESSION['user_id'];
        $this->bot->updatePreferences($userId, [
            'daily_summary_enabled'  => (int)!empty($_POST['daily_summary_enabled']),
            'daily_summary_time'     => $_POST['daily_summary_time'] ?? '08:00',
            'notify_on_assign'       => (int)!empty($_POST['notify_on_assign']),
            'notify_on_mention'      => (int)!empty($_POST['notify_on_mention']),
            'notify_on_task_update'  => (int)!empty($_POST['notify_on_task_update']),
            'notify_on_deadline'     => (int)!empty($_POST['notify_on_deadline']),
        ]);
        json_response(['ok' => true]);
    }

    /**
     * Admin: register webhook URL with Telegram.
     */
    public function setupWebhook(): void {
        if (!isLoggedIn() || !isAdmin()) { json_response(['error' => 'Admin only'], 403); return; }
        $webhookUrl = rtrim(APP_URL, '/') . '/webhook/telegram';
        $secret     = defined('TELEGRAM_WEBHOOK_SECRET') ? TELEGRAM_WEBHOOK_SECRET : '';
        $ok         = $this->bot->setWebhook($webhookUrl, $secret);
        json_response(['ok' => $ok, 'webhook_url' => $webhookUrl]);
    }

    // ═══════════════════════════════════════════════════════════════
    // AI ROUTER — intent detection → F2 or F4
    // ═══════════════════════════════════════════════════════════════

    private function routeToAi(int $chatId, int $userId, bool $isAdmin, string $text): void {
        try {
            $router = new AiRouter();
            $intent = $router->chat(
                [['role' => 'user', 'content' => $text]],
                [
                    'system'     => $this->intentPrompt(),
                    'max_tokens' => 30,
                ]
            );

            $intentStr = strtolower(trim($intent['content']));

            if (str_contains($intentStr, 'create_task')) {
                $this->processTaskCreation($chatId, $userId, $isAdmin, $text, $router);
            } else {
                $this->processQa($chatId, $userId, $isAdmin, $text, $router);
            }
        } catch (\Throwable $e) {
            $this->bot->sendMessage($chatId,
                '🤖 Hệ thống AI đang bận, vui lòng thao tác trên web hoặc thử lại sau ít phút.'
            );
            error_log('TelegramController AI route error: ' . $e->getMessage());
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // F2 — Task creation via AI
    // ═══════════════════════════════════════════════════════════════

    private function processTaskCreation(int $chatId, int $userId, bool $isAdmin, string $text, AiRouter $router): void {
        $db      = Database::getInstance();
        $today   = (new DateTime('now', new DateTimeZone(APP_TIMEZONE)))->format('Y-m-d');
        $members = $db->fetchAll("SELECT id, name FROM users WHERE is_active = 1 ORDER BY name");
        $memberList = implode(', ', array_map(fn($m) => "{$m['name']} (id:{$m['id']})", $members));

        $parseResult = $router->chat(
            [['role' => 'user', 'content' => $text]],
            [
                'system'     => $this->taskParsePrompt($memberList, $today),
                'max_tokens' => 300,
            ]
        );

        $parsed = json_decode(trim($parseResult['content']), true);
        if (!is_array($parsed) || empty($parsed['title'])) {
            $this->bot->sendMessage($chatId,
                "❓ Mình không hiểu rõ task cần tạo. Bạn có thể mô tả lại rõ hơn không?\n\n" .
                "Ví dụ: <i>\"Nhắc Nam gửi báo cáo doanh thu thứ 6 tuần này, high priority\"</i>"
            );
            return;
        }

        // Build confirm card text
        $assigneeName = '';
        if (!empty($parsed['assignee_id'])) {
            $assignee = $db->fetch("SELECT name FROM users WHERE id = ?", [(int)$parsed['assignee_id']]);
            $assigneeName = $assignee['name'] ?? "ID {$parsed['assignee_id']}";
        }

        $lines   = ["📋 <b>Xác nhận tạo task?</b>\n"];
        $lines[] = "📝 <b>Tiêu đề:</b> " . htmlspecialchars($parsed['title']);
        if (!empty($parsed['description'])) $lines[] = "📄 <b>Mô tả:</b> " . htmlspecialchars($parsed['description']);
        if ($assigneeName)                  $lines[] = "👤 <b>Giao cho:</b> {$assigneeName}";
        if (!empty($parsed['due_date']))    $lines[] = "📅 <b>Deadline:</b> {$parsed['due_date']}";
        if (!empty($parsed['priority']))    $lines[] = "🔥 <b>Priority:</b> " . ucfirst($parsed['priority']);

        $confirmText = implode("\n", $lines);

        // Store draft
        $draftKey = bin2hex(random_bytes(8));
        $this->bot->log([
            'user_id'      => $userId,
            'chat_id'      => $chatId,
            'direction'    => 'in',
            'message_type' => 'pending_task',
            'content'      => json_encode(array_merge($parsed, ['created_by' => $userId])),
            'draft_key'    => $draftKey,
            'ai_provider'  => $parseResult['provider'],
            'ai_tokens_used' => $parseResult['tokens'],
        ]);

        $this->bot->sendWithKeyboard($chatId, $confirmText, [[
            ['text' => '✅ Tạo task', 'callback_data' => "confirm_task:{$draftKey}"],
            ['text' => '❌ Huỷ',     'callback_data' => "cancel_task:{$draftKey}"],
        ]]);
    }

    private function confirmCreateTask(int $chatId, int $userId, string $draftKey, string $callbackId): void {
        $draft = $this->bot->getPendingDraft($draftKey, $chatId);
        if (!$draft) {
            $this->bot->answerCallback($callbackId, 'Draft đã hết hạn (30 phút). Vui lòng tạo lại.', true);
            return;
        }

        $task    = $draft['parsed'];
        $db      = Database::getInstance();
        $today   = (new DateTime('now', new DateTimeZone(APP_TIMEZONE)))->format('Y-m-d');

        // Find or create a default project for telegram-created tasks
        $defaultProject = $db->fetch(
            "SELECT id FROM projects WHERE owner_id = ? OR created_by = ? ORDER BY id ASC LIMIT 1",
            [$userId, $userId]
        );
        $projectId = $defaultProject ? (int)$defaultProject['id'] : null;

        $taskId = $db->insert(
            "INSERT INTO tasks (title, description, assignee_id, due_date, priority, status, project_id, created_by, is_completed)
             VALUES (?, ?, ?, ?, ?, 'todo', ?, ?, 0)",
            [
                $task['title'],
                $task['description'] ?? null,
                !empty($task['assignee_id']) ? (int)$task['assignee_id'] : null,
                !empty($task['due_date'])    ? $task['due_date']         : null,
                $task['priority'] ?? 'medium',
                $projectId,
                $task['created_by'] ?? $userId,
            ]
        );

        $this->bot->consumeDraft($draftKey);
        $this->bot->answerCallback($callbackId, 'Task đã được tạo!');

        $taskUrl = rtrim(APP_URL, '/') . "/tasks/{$taskId}";
        $this->bot->sendMessage($chatId,
            "✅ <b>Đã tạo task thành công!</b>\n\n" .
            "📝 {$task['title']}\n\n" .
            "<a href=\"{$taskUrl}\">→ Xem trên dashboard</a>"
        );

        // Log outbound
        $this->bot->log([
            'user_id'      => $userId,
            'chat_id'      => $chatId,
            'direction'    => 'out',
            'message_type' => 'create_task',
            'content'      => "Task #{$taskId} created: {$task['title']}",
        ]);
    }

    // ═══════════════════════════════════════════════════════════════
    // F4 — Q&A with tool calling
    // ═══════════════════════════════════════════════════════════════

    private function processQa(int $chatId, int $userId, bool $isAdmin, string $text, AiRouter $router): void {
        $db   = Database::getInstance();
        $user = $db->fetch("SELECT name FROM users WHERE id = ?", [$userId]);
        $name = $user['name'] ?? 'bạn';

        $messages  = [['role' => 'user', 'content' => $text]];
        $tools     = TelegramAiTools::definitions();
        $maxRounds = 4; // prevent infinite tool loops

        for ($round = 0; $round < $maxRounds; $round++) {
            $result = $router->chat($messages, [
                'system'     => $this->qaSystemPrompt($name, $isAdmin),
                'tools'      => $tools,
                'max_tokens' => 800,
            ]);

            // No tool calls → final answer
            if (empty($result['tool_calls'])) {
                $answer = trim($result['content']);
                if ($answer === '') $answer = 'Mình không tìm thấy thông tin liên quan.';

                $this->bot->sendMessage($chatId, $answer);
                $this->bot->log([
                    'user_id'        => $userId,
                    'chat_id'        => $chatId,
                    'direction'      => 'out',
                    'message_type'   => 'qa',
                    'content'        => $answer,
                    'ai_provider'    => $result['provider'],
                    'ai_tokens_used' => $result['tokens'],
                ]);
                return;
            }

            // Execute tool calls and feed results back
            $toolResults = [];
            foreach ($result['tool_calls'] as $tc) {
                $toolName  = $tc['name'];
                $toolInput = $tc['input'] ?? [];
                $toolResult = TelegramAiTools::execute($toolName, $toolInput, $userId, $isAdmin);
                $toolResults[] = [
                    'type'        => 'tool_result',
                    'tool_use_id' => $tc['id'],
                    'content'     => json_encode($toolResult, JSON_UNESCAPED_UNICODE),
                ];
            }

            // Append assistant message + tool results for next round
            $messages[] = ['role' => 'assistant', 'content' => $result['tool_calls']];
            $messages[] = ['role' => 'user',      'content' => $toolResults];
        }

        // Exceeded max rounds
        $this->bot->sendMessage($chatId, '⚠️ Không thể hoàn thành yêu cầu. Vui lòng thử lại hoặc truy cập dashboard.');
    }

    // ═══════════════════════════════════════════════════════════════
    // BUILT-IN COMMAND HANDLERS
    // ═══════════════════════════════════════════════════════════════

    private function sendUserStatus(int $chatId, int $userId, bool $isAdmin): void {
        $db    = Database::getInstance();
        $today = (new DateTime('now', new DateTimeZone(APP_TIMEZONE)))->format('Y-m-d');

        $stats = $db->fetch(
            "SELECT
                SUM(CASE WHEN is_completed=0 AND due_date < ? THEN 1 ELSE 0 END) AS overdue,
                SUM(CASE WHEN is_completed=0 AND due_date = ? THEN 1 ELSE 0 END) AS today,
                SUM(CASE WHEN is_completed=0 THEN 1 ELSE 0 END) AS open
             FROM tasks WHERE assignee_id = ?",
            [$today, $today, $userId]
        );

        $overdue = (int)($stats['overdue'] ?? 0);
        $todayCnt= (int)($stats['today']   ?? 0);
        $open    = (int)($stats['open']    ?? 0);

        $lines   = ["📊 <b>Tình trạng công việc</b>\n"];
        $lines[] = $overdue > 0 ? "🔴 Trễ deadline: <b>{$overdue} task</b>" : "✅ Không có task trễ";
        $lines[] = "🟡 Due hôm nay: <b>{$todayCnt} task</b>";
        $lines[] = "📋 Tổng đang làm: <b>{$open} task</b>";

        if (class_exists('Penalty') && (new Penalty())->isUserPenalized($userId)) {
            $calc  = (new Penalty())->calcUserPenalty($userId);
            $total = number_format((float)$calc['total_amount'], 0, ',', '.');
            $lines[] = "\n💸 Tiền phạt tích luỹ: <b>-{$total}đ</b>";
        }

        $this->bot->sendMessage($chatId, implode("\n", $lines));
    }

    private function sendTodayTasks(int $chatId, int $userId): void {
        $db    = Database::getInstance();
        $today = (new DateTime('now', new DateTimeZone(APP_TIMEZONE)))->format('Y-m-d');

        $tasks = $db->fetchAll(
            "SELECT t.title, t.priority, p.name AS project_name
             FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
             WHERE t.assignee_id = ? AND t.is_completed = 0 AND t.due_date = ?
             ORDER BY FIELD(t.priority,'urgent','high','medium','low')
             LIMIT 10",
            [$userId, $today]
        );

        if (empty($tasks)) {
            $this->bot->sendMessage($chatId, "✅ Hôm nay không có task nào due. Ngon!");
            return;
        }

        $priIcon = ['urgent'=>'🔴','high'=>'🟠','medium'=>'🟡','low'=>'⚪'];
        $lines   = ["📋 <b>Task due hôm nay (" . count($tasks) . ")</b>\n"];
        foreach ($tasks as $t) {
            $icon    = $priIcon[$t['priority']] ?? '⚪';
            $project = $t['project_name'] ? " [{$t['project_name']}]" : '';
            $lines[] = "{$icon} {$t['title']}{$project}";
        }

        $this->bot->sendMessage($chatId, implode("\n", $lines));
    }

    // ═══════════════════════════════════════════════════════════════
    // PROMPT TEMPLATES
    // ═══════════════════════════════════════════════════════════════

    private function helpText(): string {
        return
            "🤖 <b>TaskFlow Bot</b>\n\n" .
            "<b>Lệnh có sẵn:</b>\n" .
            "/tasks — Danh sách task due hôm nay\n" .
            "/status — Tổng quan công việc & tiền phạt\n" .
            "/help — Hướng dẫn này\n\n" .
            "<b>AI:</b>\n" .
            "• Gõ tự do để tạo task: <i>\"Nhắc Nam in menu thứ 6\"</i>\n" .
            "• Hỏi đáp: <i>\"Tuần này mình còn việc gì gấp?\"</i>\n" .
            "• Cập nhật: <i>\"Task nào đang overdue?\"</i>";
    }

    private function intentPrompt(): string {
        return
            'Classify the user message as exactly one of: create_task or question. ' .
            'create_task = user wants to create/assign/remind about a task. ' .
            'question = user asks about existing tasks, stats, or data. ' .
            'Reply with ONLY the classification word.';
    }

    private function taskParsePrompt(string $memberList, string $today): string {
        return
            "You parse Vietnamese task creation requests into JSON. Today is {$today}.\n" .
            "Team members: {$memberList}\n\n" .
            "Extract and return ONLY valid JSON with keys: title (string, required), " .
            "description (string or null), assignee_id (int or null), " .
            "due_date (YYYY-MM-DD or null), priority (urgent/high/medium/low, default medium).\n" .
            "For relative dates: 'thứ 6 tuần sau' = next Friday from today.\n" .
            "Return ONLY the JSON object, no explanation.";
    }

    private function qaSystemPrompt(string $userName, bool $isAdmin): string {
        $role    = $isAdmin ? 'admin (có thể xem tất cả thành viên)' : 'member (chỉ xem dữ liệu của mình)';
        $today   = (new DateTime('now', new DateTimeZone(APP_TIMEZONE)))->format('Y-m-d l');
        return
            "Bạn là trợ lý AI của hệ thống TaskFlow, đang trả lời {$userName} ({$role}).\n" .
            "Hôm nay là {$today}. Múi giờ Việt Nam (UTC+7).\n\n" .
            "Nguyên tắc:\n" .
            "- Trả lời ngắn gọn, tiếng Việt.\n" .
            "- Dùng tool để lấy dữ liệu thực trước khi trả lời.\n" .
            "- Không bịa số liệu.\n" .
            "- Định dạng danh sách bằng bullet (•), dùng bold (<b>) cho tên task/số quan trọng.\n" .
            "- Nếu không tìm thấy dữ liệu, nói thẳng.";
    }
}
