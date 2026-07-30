<?php
/**
 * TelegramInboundService — processes incoming Telegram webhook updates.
 *
 * Uses TelegramIntentClassifier (AI + rule-based fallback) for NLP.
 *
 * Intents handled:
 *   start                → welcome / connect guide
 *   connect              → /connect CODE → link account
 *   help                 → command reference
 *   greeting             → friendly hello
 *   connect_help         → explain how to connect
 *   today_cmd/tasks      → today's task list
 *   overdue_cmd/tasks    → overdue task list
 *   query_task           → "when is X due?"
 *   create_task          → parse + create + confirm + save context
 *   update_task_assignee → reassign last/explicit task to named user
 *   unknown              → contextual fallback
 */
class TelegramInboundService {
    private TelegramBotService           $bot;
    private TelegramUserLinkService      $linkService;
    private TelegramIntentClassifier     $classifier;
    private TelegramTaskQueryService     $queryService;
    private TelegramConversationService  $convService;
    private TelegramInboundLog           $inboundLog;

    // Set per-request so handlers don't need these threaded through every call
    private string $chatId   = '';
    private ?array $dashUser = null;
    private bool   $isPriv   = false;

    public function __construct() {
        $this->bot          = new TelegramBotService();
        $this->linkService  = new TelegramUserLinkService();
        $this->classifier   = new TelegramIntentClassifier();
        $this->queryService = new TelegramTaskQueryService();
        $this->convService  = new TelegramConversationService();
        $this->inboundLog   = new TelegramInboundLog();
    }

    // ── Entry point ───────────────────────────────────────────────────────────

    public function process(array $update): void {
        $message = $update['message'] ?? $update['edited_message'] ?? null;
        if (!$message || !isset($message['text'])) return;

        $chatId = (string)($message['chat']['id'] ?? '');
        $tgUid  = (string)($message['from']['id'] ?? '');
        $text   = trim($message['text']);

        if (!$chatId || $text === '') return;

        // Store per-request state
        $this->chatId = $chatId;

        // Log inbound
        $logId = $this->inboundLog->create([
            'telegram_chat_id' => $chatId,
            'telegram_user_id' => $tgUid,
            'raw_message'      => $text,
        ]);

        // Resolve connected dashboard user
        $tu             = (new TelegramUser())->findByChatId($chatId);
        $this->dashUser = $tu ? ['id' => (int)$tu['user_id'], 'name' => $tu['user_name'] ?? ''] : null;
        $this->isPriv   = $this->dashUser ? $this->userIsPriv($this->dashUser['id']) : false;

        // Classify intent
        $classifierCtx = $this->buildClassifierContext();
        $parsed        = $this->classifier->classify($text, $classifierCtx);
        $intent        = $parsed['intent'];

        try {
            $reply = $this->dispatch($intent, $parsed, $update);
            $this->bot->sendMessage($chatId, $reply, [
                'event_type' => 'inbound_reply',
                'user_id'    => $this->dashUser['id'] ?? null,
            ]);
            $this->inboundLog->markProcessed($logId, $intent, $parsed);
        } catch (\Throwable $e) {
            $this->inboundLog->markFailed($logId, $e->getMessage());
            $this->bot->sendMessage($chatId, "Sorry, something went wrong. Please try again.", []);
        }
    }

    // ── Dispatcher ────────────────────────────────────────────────────────────

    private function dispatch(string $intent, array $parsed, array $update): string {
        // Auth-free intents
        switch ($intent) {
            case 'start':        return $this->handleStart($update);
            case 'connect':      return $this->handleConnect($parsed['code'] ?? '', $update);
            case 'help':         return $this->handleHelp();
            case 'greeting':     return $this->handleGreeting($update);
            case 'connect_help': return $this->handleConnectHelp();
        }

        // Remaining intents require a connected account
        if (!$this->dashUser) {
            return $this->notConnectedMessage();
        }

        switch ($intent) {
            case 'today_cmd':
            case 'today_tasks':         return $this->handleToday();
            case 'overdue_cmd':
            case 'overdue_tasks':       return $this->handleOverdue();
            case 'query_task':          return $this->handleQuery($parsed);
            case 'create_task':         return $this->handleCreate($parsed);
            case 'update_task_assignee':return $this->handleReassign($parsed);
            default:                    return $this->handleUnknown($parsed);
        }
    }

    // ── Intent handlers ───────────────────────────────────────────────────────

    private function handleStart(array $update): string {
        $firstName = $update['message']['from']['first_name'] ?? '';

        if ($this->dashUser) {
            $name = $this->dashUser['name'] ?: $firstName;
            return "👋 Welcome back, <b>" . htmlspecialchars($name) . "</b>!\n\n"
                 . $this->commandListText();
        }

        $greet = $firstName ? "👋 Hey <b>" . htmlspecialchars($firstName) . "</b>!" : "👋 Welcome!";
        return "{$greet}\n\nI'm <b>TaskFlow Bot</b> — your task manager on Telegram.\n\n"
             . $this->connectInstructions();
    }

    private function handleConnect(string $code, array $update): string {
        if (!$code) {
            return "Please send your connect code like:\n<code>/connect ABC12345</code>";
        }
        $result = $this->linkService->confirmConnect($code, $update);
        return $result['message'];
    }

    private function handleHelp(): string {
        return "<b>TaskFlow Bot — Help</b>\n\n" . $this->commandListText();
    }

    private function handleGreeting(array $update): string {
        $firstName = $update['message']['from']['first_name'] ?? '';

        if ($this->dashUser) {
            $first = $this->dashUser['name']
                ? explode(' ', trim($this->dashUser['name']))[0]
                : $firstName;
            return "👋 Hey <b>" . htmlspecialchars($first) . "</b>! What can I help you with?\n\n"
                 . "• /today — tasks due today\n"
                 . "• /overdue — overdue tasks\n"
                 . "• Type a task to create one, e.g.:\n"
                 . "  <code>Pay tax for Raw on April 30</code>";
        }

        $greet = $firstName ? "👋 Hey <b>" . htmlspecialchars($firstName) . "</b>!" : "👋 Hey!";
        return "{$greet}\n\nI'm TaskFlow Bot. Connect your account to get started:\n\n"
             . $this->connectInstructions();
    }

    private function handleConnectHelp(): string {
        if ($this->dashUser) {
            return "✅ Your Telegram is already connected to <b>"
                 . htmlspecialchars($this->dashUser['name']) . "</b>'s account!\n\n"
                 . "Manage it at: Dashboard → Settings → Telegram\n\n"
                 . $this->commandListText();
        }
        return "Here's how to connect your TaskFlow account:\n\n"
             . $this->connectInstructions();
    }

    private function handleToday(): string {
        $today  = function_exists('app_today') ? app_today() : date('Y-m-d');
        $db     = Database::getInstance();
        $userId = (int)$this->dashUser['id'];

        $tasks = $db->fetchAll(
            "SELECT t.id, t.title, t.due_date, t.priority, p.name AS project_name,
                    GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') AS store_names
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN task_stores ts ON t.id = ts.task_id
             LEFT JOIN stores s ON ts.store_id = s.id
             WHERE t.assignee_id = ? AND t.due_date = ? AND t.is_completed = 0
             GROUP BY t.id
             ORDER BY FIELD(t.priority,'urgent','high','medium','low'), t.title ASC",
            [$userId, $today]
        );

        if (empty($tasks)) return "You have no tasks due today. 🎉";

        $count = count($tasks);
        $msg   = "<b>📋 Tasks due today ({$count}):</b>\n";
        foreach ($tasks as $i => $t) {
            $n   = $i + 1;
            $pri = $this->priorityEmoji($t['priority']);
            $msg .= "\n{$pri} <b>{$n}. " . htmlspecialchars($t['title']) . "</b>\n";
            if (!empty($t['project_name'])) $msg .= "   📁 " . htmlspecialchars($t['project_name']) . "\n";
            if (!empty($t['store_names']))  $msg .= "   🏪 " . htmlspecialchars($t['store_names'])  . "\n";
        }
        return $msg;
    }

    private function handleOverdue(): string {
        $today  = function_exists('app_today') ? app_today() : date('Y-m-d');
        $db     = Database::getInstance();
        $userId = (int)$this->dashUser['id'];

        $tasks = $db->fetchAll(
            "SELECT t.id, t.title, t.due_date, t.priority,
                    DATEDIFF(?, t.due_date) AS days_overdue,
                    p.name AS project_name,
                    GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') AS store_names
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN task_stores ts ON t.id = ts.task_id
             LEFT JOIN stores s ON ts.store_id = s.id
             WHERE t.assignee_id = ? AND t.due_date < ? AND t.is_completed = 0
             GROUP BY t.id ORDER BY t.due_date ASC LIMIT 10",
            [$today, $userId, $today]
        );

        if (empty($tasks)) return "You have no overdue tasks. ✅";

        $count = count($tasks);
        $msg   = "⚠️ <b>Overdue tasks ({$count}):</b>\n";
        foreach ($tasks as $i => $t) {
            $n    = $i + 1;
            $days = max(1, (int)$t['days_overdue']);
            $msg .= "\n🔴 <b>{$n}. " . htmlspecialchars($t['title']) . "</b>\n";
            $msg .= "   " . $days . " day" . ($days > 1 ? 's' : '') . " overdue\n";
            if (!empty($t['project_name'])) $msg .= "   📁 " . htmlspecialchars($t['project_name']) . "\n";
            if (!empty($t['store_names']))  $msg .= "   🏪 " . htmlspecialchars($t['store_names'])  . "\n";
        }
        return $msg;
    }

    private function handleQuery(array $parsed): string {
        $task = $this->queryService->findBestMatch(
            (int)$this->dashUser['id'], $this->isPriv, $parsed
        );
        return $this->queryService->formatQueryResponse($task, $parsed['raw']);
    }

    private function handleCreate(array $parsed): string {
        // Missing fields
        if (!empty($parsed['missing'])) {
            if (in_array('due_date', $parsed['missing'])) {
                return "I can create that task, but I need the due date.\n"
                     . "Please reply with the due date, e.g.:\n"
                     . "<code>April 30</code> or <code>tomorrow</code> or <code>next Friday</code>";
            }
            if (in_array('title', $parsed['missing'])) {
                return "I couldn't understand the task title. Please rephrase like:\n"
                     . "\xE2\x80\x9CPay tax for Raw on April 23\xE2\x80\x9D";
            }
        }

        $title        = $parsed['title'];
        $dueDate      = $parsed['due_date'];
        $storeHint    = $parsed['store_hint']    ?? null;
        $projHint     = $parsed['project_hint']  ?? 'General';
        $assigneeHint = $parsed['assignee_hint'] ?? null;
        $userId       = (int)$this->dashUser['id'];
        $db           = Database::getInstance();

        // Resolve assignee
        $assigneeId   = $userId;
        $assigneeName = 'You';
        if ($assigneeHint) {
            $resolution = $this->convService->resolveUserByName($assigneeHint);
            if ($resolution['status'] === 'found') {
                $assigneeId   = (int)$resolution['user']['id'];
                $assigneeName = $resolution['user']['name'];
            } elseif ($resolution['status'] === 'multiple') {
                $names = implode(', ', array_column($resolution['matches'], 'name'));
                $assigneeName = "You (multiple matches for \xE2\x80\x9C{$assigneeHint}\xE2\x80\x9D: {$names})";
            } else {
                $assigneeName = "You (couldn't find \xE2\x80\x9C{$assigneeHint}\xE2\x80\x9D)";
            }
        }

        // Resolve project
        $proj = $db->fetch(
            "SELECT id FROM projects WHERE name LIKE ? AND status != 'archived' ORDER BY id ASC LIMIT 1",
            ['%' . $projHint . '%']
        );
        if (!$proj) {
            $proj = $db->fetch(
                "SELECT p.id FROM projects p JOIN project_members pm ON p.id = pm.project_id
                 WHERE pm.user_id = ? AND p.status = 'active' ORDER BY p.id ASC LIMIT 1",
                [$userId]
            );
        }
        $projectId = $proj ? (int)$proj['id'] : null;

        // Resolve store
        $storeId = null;
        if ($storeHint) {
            $store = $db->fetch("SELECT id FROM stores WHERE name LIKE ? AND is_active = 1 LIMIT 1", ['%' . $storeHint . '%']);
            if (!$store) {
                $first = explode(' ', $storeHint)[0];
                $store = $db->fetch("SELECT id FROM stores WHERE name LIKE ? AND is_active = 1 LIMIT 1", ['%' . $first . '%']);
            }
            $storeId = $store ? (int)$store['id'] : null;
        }

        // Create task
        try {
            $taskId = (new Task())->create([
                'project_id'  => $projectId,
                'title'       => $title,
                'description' => $parsed['raw'],
                'assignee_id' => $assigneeId,
                'priority'    => 'medium',
                'status'      => 'todo',
                'due_date'    => $dueDate,
                'created_by'  => $userId,
                'accepted_at' => date('Y-m-d H:i:s'),
            ]);

            if ($taskId && $storeId) {
                try { (new TaskStoreService())->sync($taskId, [$storeId], $userId); } catch (\Throwable $e) {}
            }

            // Save context so follow-up "Assign to X" knows which task
            if ($taskId) {
                $this->convService->saveTaskContext($this->chatId, (int)$taskId, $title);
            }

            $confirmDue   = $dueDate   ? (new DateTime($dueDate))->format('M j, Y') : 'no deadline';
            $confirmStore = ($storeId && $storeHint) ? $storeHint : 'none';

            return "✅ <b>Task created!</b>\n\n"
                 . "📝 <b>" . htmlspecialchars($title) . "</b>\n"
                 . "📅 Due: <b>{$confirmDue}</b>\n"
                 . "👤 Assigned to: <b>" . htmlspecialchars($assigneeName) . "</b>\n"
                 . "📁 Project: {$projHint}\n"
                 . "🏪 Store: {$confirmStore}\n\n"
                 . "<i>Tip: reply \"Assign to [name]\" to reassign this task.</i>";
        } catch (\Throwable $e) {
            return "Sorry, I couldn't create the task: " . htmlspecialchars($e->getMessage());
        }
    }

    // ── Reassign handler ───────────────────────────────────────────────────────

    private function handleReassign(array $parsed): string {
        $taskRef      = $parsed['task_ref']        ?? 'last';
        $titleHint    = $parsed['task_title_hint'] ?? null;
        $assigneeName = trim($parsed['assignee_name'] ?? '');
        $userId       = (int)$this->dashUser['id'];

        // ── 1. Resolve target task ─────────────────────────────────────────────
        $task = null;

        if ($taskRef === 'explicit' && $titleHint) {
            $task = $this->convService->findTaskByTitleHint($titleHint, $userId, $this->isPriv);
            if (!$task) {
                return "❌ I couldn't find a task matching:\n"
                     . "<i>" . htmlspecialchars($titleHint) . "</i>\n\n"
                     . "Make sure the task exists and you have access to it.";
            }
        } else {
            // Follow-up: use conversation context
            $ctx = $this->convService->getTaskContext($this->chatId);
            if (!$ctx) {
                return "I'm not sure which task you want to update.\n\n"
                     . "Please specify the task explicitly:\n"
                     . "<code>Assign task \"Pay tax for Raw\" to Nguyen</code>";
            }
            $task = $this->convService->getTaskById($ctx['task_id']);
            if (!$task) {
                return "The task I had in context no longer exists. Please specify:\n"
                     . "<code>Assign task \"Task title\" to [name]</code>";
            }
        }

        // ── 2. Resolve assignee ────────────────────────────────────────────────
        if ($assigneeName === '') {
            return "Please specify who to assign to. Example:\n"
                 . "<code>Assign to Nguyen</code>";
        }

        $resolution = $this->convService->resolveUserByName($assigneeName);

        if ($resolution['status'] === 'not_found') {
            return "❌ I couldn't find a user named <b>"
                 . htmlspecialchars($assigneeName) . "</b>.\n\n"
                 . "Please use the full name as it appears in the dashboard.";
        }

        if ($resolution['status'] === 'multiple') {
            $names = array_map(fn($u) => "• " . htmlspecialchars($u['name']), $resolution['matches']);
            return "I found multiple users matching <b>" . htmlspecialchars($assigneeName) . "</b>:\n\n"
                 . implode("\n", $names) . "\n\n"
                 . "Please use the full name, e.g.:\n"
                 . "<code>Assign to " . htmlspecialchars($resolution['matches'][0]['name']) . "</code>";
        }

        $newAssignee = $resolution['user'];

        // ── 3. Check permission ────────────────────────────────────────────────
        if (!$this->convService->canReassign($task, $userId, $this->isPriv)) {
            return "⛔ You don't have permission to reassign this task.\n\n"
                 . "Only the task creator, current assignee, or a manager/admin can do this.";
        }

        // ── 4. Guard: completed tasks ──────────────────────────────────────────
        if ((int)$task['is_completed'] || $task['status'] === 'done') {
            return "⚠️ Task <b>" . htmlspecialchars($task['title']) . "</b> is already completed.\n"
                 . "Completed tasks cannot be reassigned.";
        }

        // ── 5. Update ─────────────────────────────────────────────────────────
        $result = $this->convService->reassignTask(
            (int)$task['id'],
            (int)$newAssignee['id'],
            $userId,
            $this->isPriv
        );

        if (!$result['ok']) {
            return match($result['error'] ?? '') {
                'permission'     => "⛔ You don't have permission to reassign this task.",
                'task_completed' => "⚠️ This task is already completed and cannot be reassigned.",
                'task_not_found' => "❌ Task not found.",
                default          => "❌ Could not reassign task: " . htmlspecialchars($result['error'] ?? 'unknown error'),
            };
        }

        // Update context to the same task (so further follow-ups still work)
        $this->convService->saveTaskContext($this->chatId, (int)$task['id'], $task['title']);

        return "✅ <b>Task updated!</b>\n\n"
             . "📝 <b>" . htmlspecialchars($task['title']) . "</b>\n"
             . "👤 Assigned to: <b>" . htmlspecialchars($newAssignee['name']) . "</b>";
    }

    // ── Fallback ───────────────────────────────────────────────────────────────

    private function handleUnknown(array $parsed): string {
        if (!empty($parsed['clarification'])) {
            return "🤔 " . htmlspecialchars($parsed['clarification'])
                 . "\n\nOr try /help to see all commands.";
        }

        return "I'm not sure what you mean. Try:\n\n"
             . "📋 <b>View tasks:</b> /today · /overdue\n"
             . "➕ <b>Create task:</b>\n"
             . "   <code>Pay tax for Raw on April 30</code>\n"
             . "🔄 <b>Reassign task:</b>\n"
             . "   <code>Assign to Nguyen</code> (after creating a task)\n"
             . "   <code>Assign task \"Pay tax\" to Nguyen</code>\n"
             . "🔍 <b>Find task:</b>\n"
             . "   <code>When is the tax payment due?</code>\n"
             . "❓ /help — full command list";
    }

    // ── Shared text blocks ────────────────────────────────────────────────────

    private function connectInstructions(): string {
        return "1️⃣ Open <b>TaskFlow</b> dashboard\n"
             . "2️⃣ Sidebar → <b>Telegram</b>\n"
             . "3️⃣ Click <b>Generate Connect Code</b>\n"
             . "4️⃣ Send the code here:\n"
             . "   <code>/connect YOUR_CODE</code>";
    }

    private function notConnectedMessage(): string {
        return "🔗 Your Telegram isn't connected to TaskFlow yet.\n\n"
             . $this->connectInstructions();
    }

    private function commandListText(): string {
        return "<b>📋 Commands:</b>\n"
             . "/today — tasks due today\n"
             . "/overdue — overdue tasks\n"
             . "/help — this menu\n\n"
             . "<b>➕ Create task:</b>\n"
             . "<code>Pay tax for Raw on April 30</code>\n"
             . "<code>Submit report tomorrow</code>\n\n"
             . "<b>🔄 Reassign task (after creating):</b>\n"
             . "<code>Assign to Nguyen</code>\n"
             . "<code>Assign task \"Pay tax\" to Liem</code>\n\n"
             . "<b>👤 Assign when creating:</b>\n"
             . "<code>Pay tax on April 30 assign to Hoang</code>\n\n"
             . "<b>🔍 Ask about deadlines:</b>\n"
             . "<code>When is the tax payment due?</code>\n\n"
             . "<b>🔗 Connect account:</b>\n"
             . "<code>/connect CODE</code>";
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function buildClassifierContext(): array {
        try {
            $db     = Database::getInstance();
            $stores = $db->fetchAll("SELECT name FROM stores WHERE is_active = 1 ORDER BY name");
            $users  = $db->fetchAll("SELECT name FROM users  WHERE is_active = 1 ORDER BY name");
            return [
                'today'  => function_exists('app_today') ? app_today() : date('Y-m-d'),
                'stores' => $stores,
                'users'  => $users,
            ];
        } catch (\Throwable $e) {
            return ['today' => date('Y-m-d'), 'stores' => [], 'users' => []];
        }
    }

    private function userIsPriv(int $userId): bool {
        try {
            $db  = Database::getInstance();
            $row = $db->fetch("SELECT role FROM users WHERE id = ?", [$userId]);
            return in_array($row['role'] ?? '', ['admin', 'manager'], true);
        } catch (\Throwable $e) {
            return false;
        }
    }

    private function priorityEmoji(string $priority): string {
        return match($priority) {
            'urgent' => '🔴',
            'high'   => '🟠',
            'medium' => '🟡',
            default  => '⚪',
        };
    }
}
