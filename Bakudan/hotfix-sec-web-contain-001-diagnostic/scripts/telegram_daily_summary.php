<?php
/**
 * F1 — Telegram Daily Summary
 *
 * Sends each linked user their task summary at their configured time.
 * Designed to run every hour via cron. On each run it checks which
 * users have their summary_time within the current hour (VN time).
 *
 * cPanel cron entry (runs hourly at :05):
 *   5 * * * * php /home/.../dashboard.bakudanramen.com/scripts/telegram_daily_summary.php
 *
 * CLI usage:
 *   php scripts/telegram_daily_summary.php            # process current hour
 *   php scripts/telegram_daily_summary.php --force    # send to ALL linked users now
 *   php scripts/telegram_daily_summary.php --dry-run  # log without sending
 */

// ── Bootstrap ─────────────────────────────────────────────────
$root = dirname(__DIR__);
require_once $root . '/config/database.php';
require_once $root . '/config/ai.php';
require_once $root . '/config/telegram.php';
require_once $root . '/config/time.php';
require_once $root . '/models/User.php';
require_once $root . '/models/Task.php';
require_once $root . '/models/Project.php';
require_once $root . '/models/Penalty.php';
require_once $root . '/models/TelegramBot.php';

if (!defined('APP_TIMEZONE')) define('APP_TIMEZONE', 'Asia/Ho_Chi_Minh');
date_default_timezone_set(APP_TIMEZONE);

$force  = in_array('--force',   $argv ?? []);
$dryRun = in_array('--dry-run', $argv ?? []);

$db      = Database::getInstance();
$bot     = new TelegramBot();
$today   = (new DateTime('now', new DateTimeZone(APP_TIMEZONE)))->format('Y-m-d');
$curHour = (new DateTime('now', new DateTimeZone(APP_TIMEZONE)))->format('H');

// ── Find users to notify ──────────────────────────────────────
// Get all users with: active telegram link + daily_summary_enabled
$query = "
    SELECT tl.user_id, tl.telegram_chat_id, u.name,
           COALESCE(tp.daily_summary_enabled, 1) AS summary_enabled,
           COALESCE(tp.daily_summary_time, '08:00:00') AS summary_time
    FROM telegram_link tl
    JOIN users u ON u.id = tl.user_id
    LEFT JOIN telegram_preferences tp ON tp.user_id = tl.user_id
    WHERE tl.is_active = 1 AND u.is_active = 1
";

if (!$force) {
    // Only users whose summary_time hour matches current hour
    $query .= " AND HOUR(COALESCE(tp.daily_summary_time, '08:00:00')) = ?";
    $users = $db->fetchAll($query, [(int)$curHour]);
} else {
    $users = $db->fetchAll($query);
}

$sent   = 0;
$errors = 0;

foreach ($users as $row) {
    if (!(bool)(int)$row['summary_enabled'] && !$force) continue;

    $userId = (int)$row['user_id'];
    $chatId = (int)$row['telegram_chat_id'];
    $name   = $row['name'];

    try {
        $text = buildSummary($userId, $name, $today, $db);

        if (!$dryRun) {
            $bot->sendMessage($chatId, $text);
            $bot->log([
                'user_id'      => $userId,
                'chat_id'      => $chatId,
                'direction'    => 'out',
                'message_type' => 'summary',
                'content'      => $text,
            ]);
        }

        echo "[" . date('H:i:s') . "] Sent to {$name} (uid:{$userId})" . ($dryRun ? ' [DRY RUN]' : '') . "\n";
        $sent++;
    } catch (\Throwable $e) {
        echo "[" . date('H:i:s') . "] ERROR for uid:{$userId} — " . $e->getMessage() . "\n";
        $errors++;
    }
}

echo sprintf(
    "[%s] Daily summary done: sent=%d, errors=%d, date=%s\n",
    date('H:i:s'), $sent, $errors, $today
);

// ── Summary builder ───────────────────────────────────────────

function buildSummary(int $userId, string $name, string $today, Database $db): string {
    $firstName = explode(' ', $name)[0];
    $dayOfWeek = (new DateTime($today))->format('l');
    $dayVn     = [
        'Monday'=>'Thứ Hai','Tuesday'=>'Thứ Ba','Wednesday'=>'Thứ Tư',
        'Thursday'=>'Thứ Năm','Friday'=>'Thứ Sáu','Saturday'=>'Thứ Bảy','Sunday'=>'Chủ Nhật',
    ][$dayOfWeek] ?? $dayOfWeek;

    // Tasks due today
    $todayTasks = $db->fetchAll(
        "SELECT t.title, t.priority, p.name AS project_name
         FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
         WHERE t.assignee_id = ? AND t.is_completed = 0 AND t.due_date = ?
         ORDER BY FIELD(t.priority,'urgent','high','medium','low')
         LIMIT 10",
        [$userId, $today]
    );

    // Overdue tasks
    $overdueTasks = $db->fetchAll(
        "SELECT t.title, t.due_date, t.priority
         FROM tasks t
         WHERE t.assignee_id = ? AND t.is_completed = 0 AND t.due_date < ?
         ORDER BY t.due_date ASC LIMIT 5",
        [$userId, $today]
    );

    $priIcon = ['urgent'=>'🔴','high'=>'🟠','medium'=>'🟡','low'=>'⚪'];

    $lines = ["☀️ <b>Chào {$firstName}! {$dayVn} của bạn:</b>\n"];

    if (!empty($overdueTasks)) {
        $lines[] = "⚠️ <b>Còn trễ (" . count($overdueTasks) . " task):</b>";
        foreach ($overdueTasks as $t) {
            $days  = (int)((strtotime($today) - strtotime($t['due_date'])) / 86400);
            $dayStr = $days === 1 ? '1 ngày' : "{$days} ngày";
            $lines[] = "  🔴 {$t['title']} (trễ {$dayStr})";
        }
        $lines[] = '';
    }

    if (!empty($todayTasks)) {
        $lines[] = "📋 <b>Due hôm nay (" . count($todayTasks) . " task):</b>";
        foreach ($todayTasks as $t) {
            $icon    = $priIcon[$t['priority']] ?? '⚪';
            $project = $t['project_name'] ? " <i>[{$t['project_name']}]</i>" : '';
            $lines[] = "  {$icon} {$t['title']}{$project}";
        }
    } else {
        $lines[] = "✅ <b>Không có task due hôm nay.</b> Tuyệt vời!";
    }

    // Penalty summary if applicable
    if (class_exists('Penalty')) {
        $penalty = new Penalty();
        if ($penalty->isUserPenalized($userId)) {
            $calc  = $penalty->calcUserPenalty($userId);
            if ($calc['late_count'] > 0) {
                $total = number_format((float)$calc['total_amount'], 0, ',', '.');
                $lines[] = "\n💸 Tiền phạt tích luỹ: <b>-{$total}đ</b> ({$calc['late_count']} task trễ)";
            }
        }
    }

    $lines[] = "\n<a href=\"" . rtrim(APP_URL, '/') . "/my-tasks\">→ Mở dashboard</a>";

    return implode("\n", $lines);
}
