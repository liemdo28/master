<?php
/**
 * TelegramNotificationService — outbound reminders.
 *
 * Handles:
 *  A. Due-today reminders (run at 8 AM daily)
 *  B. Overdue reminders (run daily)
 *  C. One-off notifications (extension approved/rejected, etc.)
 */
class TelegramNotificationService {
    private TelegramBotService $bot;
    private TelegramUser $userModel;

    public function __construct() {
        $this->bot       = new TelegramBotService();
        $this->userModel = new TelegramUser();
    }

    // ── A. Due-today reminders ────────────────────────────────────────────────

    /**
     * Send due-today reminders to all connected users.
     * Returns count of messages sent.
     */
    public function sendDueTodayReminders(): int {
        $today       = function_exists('app_today') ? app_today() : date('Y-m-d');
        $activeUsers = $this->userModel->getAllActive();
        $db          = Database::getInstance();
        $sent        = 0;

        foreach ($activeUsers as $tu) {
            $userId = (int)$tu['user_id'];
            $chatId = $tu['telegram_chat_id'];

            $tasks = $db->fetchAll(
                "SELECT t.id, t.title, t.due_date, p.name AS project_name,
                        GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') AS store_names
                 FROM tasks t
                 LEFT JOIN projects p ON t.project_id = p.id
                 LEFT JOIN task_stores ts ON t.id = ts.task_id
                 LEFT JOIN stores s ON ts.store_id = s.id
                 WHERE t.assignee_id = ?
                   AND t.due_date = ?
                   AND t.is_completed = 0
                   AND t.status != 'done'
                 GROUP BY t.id
                 ORDER BY t.priority DESC, t.title ASC",
                [$userId, $today]
            );

            if (empty($tasks)) continue; // Do not send empty messages

            $msg = $this->buildDueTodayMessage($tasks, $tu['first_name'] ?? $tu['user_name'] ?? 'there');

            if ($this->bot->sendMessage($chatId, $msg, [
                'event_type' => 'due_today_reminder',
                'user_id'    => $userId,
            ])) {
                $sent++;
            }
        }

        return $sent;
    }

    // ── B. Overdue reminders ──────────────────────────────────────────────────

    /**
     * Send overdue reminders to all connected users.
     * Returns count of messages sent.
     */
    public function sendOverdueReminders(): int {
        $today       = function_exists('app_today') ? app_today() : date('Y-m-d');
        $activeUsers = $this->userModel->getAllActive();
        $db          = Database::getInstance();
        $sent        = 0;

        foreach ($activeUsers as $tu) {
            $userId = (int)$tu['user_id'];
            $chatId = $tu['telegram_chat_id'];

            $tasks = $db->fetchAll(
                "SELECT t.id, t.title, t.due_date, p.name AS project_name,
                        DATEDIFF(?, t.due_date) AS days_overdue,
                        GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') AS store_names
                 FROM tasks t
                 LEFT JOIN projects p ON t.project_id = p.id
                 LEFT JOIN task_stores ts ON t.id = ts.task_id
                 LEFT JOIN stores s ON ts.store_id = s.id
                 WHERE t.assignee_id = ?
                   AND t.due_date < ?
                   AND t.is_completed = 0
                   AND t.status != 'done'
                 GROUP BY t.id
                 ORDER BY t.due_date ASC",
                [$today, $userId, $today]
            );

            if (empty($tasks)) continue;

            $msg = $this->buildOverdueMessage($tasks, $tu['first_name'] ?? $tu['user_name'] ?? 'there');

            if ($this->bot->sendMessage($chatId, $msg, [
                'event_type' => 'overdue_reminder',
                'user_id'    => $userId,
            ])) {
                $sent++;
            }
        }

        return $sent;
    }

    // ── C. One-off notifications ──────────────────────────────────────────────

    /**
     * Notify user when a deadline extension is approved.
     */
    public function notifyExtensionApproved(int $userId, array $extension): void {
        $tu = $this->userModel->findByUserId($userId);
        if (!$tu) return;

        $msg = "✅ <b>Deadline Extension Approved</b>\n\n"
             . "Task: <b>" . htmlspecialchars($extension['task_title'] ?? '') . "</b>\n"
             . "New due date: <b>" . htmlspecialchars($extension['requested_due_date'] ?? '') . "</b>\n";

        if (!empty($extension['review_note'])) {
            $msg .= "Note: " . htmlspecialchars($extension['review_note']) . "\n";
        }

        $this->bot->sendMessage($tu['telegram_chat_id'], $msg, [
            'event_type'  => 'extension_approved',
            'user_id'     => $userId,
            'entity_type' => 'deadline_extension',
            'entity_id'   => $extension['id'] ?? null,
        ]);
    }

    /**
     * Notify user when a deadline extension is rejected.
     */
    public function notifyExtensionRejected(int $userId, array $extension): void {
        $tu = $this->userModel->findByUserId($userId);
        if (!$tu) return;

        $msg = "❌ <b>Deadline Extension Rejected</b>\n\n"
             . "Task: <b>" . htmlspecialchars($extension['task_title'] ?? '') . "</b>\n";

        if (!empty($extension['review_note'])) {
            $msg .= "Reason: " . htmlspecialchars($extension['review_note']) . "\n";
        }
        $msg .= "\nOriginal deadline remains: <b>" . htmlspecialchars($extension['original_due_date'] ?? '') . "</b>";

        $this->bot->sendMessage($tu['telegram_chat_id'], $msg, [
            'event_type'  => 'extension_rejected',
            'user_id'     => $userId,
            'entity_type' => 'deadline_extension',
            'entity_id'   => $extension['id'] ?? null,
        ]);
    }

    // ── Message builders ──────────────────────────────────────────────────────

    private function buildDueTodayMessage(array $tasks, string $name): string {
        $count = count($tasks);
        $noun  = $count === 1 ? 'task' : 'tasks';
        $msg   = "Good morning, <b>{$name}</b>! You have <b>{$count} {$noun}</b> due today:\n";

        foreach ($tasks as $i => $t) {
            $n = $i + 1;
            $msg .= "\n<b>{$n}. " . htmlspecialchars($t['title']) . "</b>\n";
            if (!empty($t['project_name'])) $msg .= "   Project: " . htmlspecialchars($t['project_name']) . "\n";
            if (!empty($t['store_names']))  $msg .= "   Store: " . htmlspecialchars($t['store_names']) . "\n";
            $msg .= "   Due: " . $this->formatDate($t['due_date']) . "\n";
        }

        return $msg;
    }

    private function buildOverdueMessage(array $tasks, string $name): string {
        $count = count($tasks);
        $noun  = $count === 1 ? 'task' : 'tasks';
        $msg   = "⚠️ <b>{$name}</b>, you have <b>{$count} overdue {$noun}</b>:\n";

        foreach ($tasks as $i => $t) {
            $n    = $i + 1;
            $days = max(1, (int)$t['days_overdue']);
            $msg .= "\n<b>{$n}. " . htmlspecialchars($t['title']) . "</b>\n";
            $msg .= "   Overdue by {$days} day" . ($days > 1 ? 's' : '') . "\n";
            if (!empty($t['project_name'])) $msg .= "   Project: " . htmlspecialchars($t['project_name']) . "\n";
            if (!empty($t['store_names']))  $msg .= "   Store: " . htmlspecialchars($t['store_names']) . "\n";
        }

        return $msg;
    }

    private function formatDate(string $date): string {
        try {
            $d = new DateTime($date);
            return $d->format('M j, Y');
        } catch (\Exception $e) {
            return $date;
        }
    }
}
