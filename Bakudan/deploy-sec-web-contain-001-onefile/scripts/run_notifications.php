<?php
/**
 * TKT-301 · Reusable notification / email pipeline runner
 *
 * Usage:
 *   php scripts/run_notifications.php
 *   php scripts/run_notifications.php --emails=50
 *   php scripts/run_notifications.php --skip-weekly --skip-asana
 *   php scripts/run_notifications.php --json
 *   php scripts/run_notifications.php --help
 *
 * Callable from PHP:
 *   require __DIR__ . '/scripts/run_notifications.php';
 *   $summary = taskflow_run_notification_pipeline([
 *       'emails'       => 30,
 *       'skip_due_soon'=> false,
 *       'skip_overdue' => false,
 *       'skip_bills'   => false,
 *       'skip_weekly'  => false,
 *       'skip_asana'   => false,
 *       'force_asana'  => false,
 *       'skip_recurring' => false,
 *   ]);
 *
 * Exit codes (CLI): 0 = ok, 1 = fatal bootstrap error.
 */

/**
 * Bootstrap app dependencies (idempotent — safe to re-include).
 */
function taskflow_bootstrap_app(): void {
    static $booted = false;
    if ($booted) return;
    $booted = true;

    $root = dirname(__DIR__);
    require_once $root . '/config/database.php';
    require_once $root . '/config/ai.php';
    require_once $root . '/config/i18n.php';
    require_once $root . '/config/icons.php';
    require_once $root . '/models/User.php';
    require_once $root . '/models/Project.php';
    require_once $root . '/models/Task.php';
    require_once $root . '/models/Comment.php';
    require_once $root . '/models/Notification.php';
    require_once $root . '/models/Store.php';
    require_once $root . '/models/Bill.php';
    require_once $root . '/models/Vendor.php';
    require_once $root . '/controllers/AsanaController.php';
    require_once $root . '/service/DateService.php';
    require_once $root . '/service/RecurringTaskService.php';
    require_once $root . '/service/TaskCompletionService.php';

    // Telegram reminder dependencies
    require_once $root . '/config/telegram.php';
    require_once $root . '/models/TelegramUser.php';
    require_once $root . '/models/TelegramNotificationLog.php';
    require_once $root . '/service/TelegramBotService.php';
    require_once $root . '/service/TelegramNotificationService.php';

    // Phase 3 — intelligence layer
    require_once $root . '/service/RiskSnapshotBuilder.php';
    require_once $root . '/service/DecisionFeedBuilder.php';
    require_once $root . '/service/ActivityFeedBuilder.php';
    require_once $root . '/service/ApprovalQueueBuilder.php';
    require_once $root . '/service/MobilePushQueueBuilder.php';
    require_once $root . '/service/PenaltyService.php';
    require_once $root . '/jobs/PenaltyApplyJob.php';

    if (!defined('APP_TIMEZONE')) define('APP_TIMEZONE', 'Asia/Ho_Chi_Minh');
    date_default_timezone_set(APP_TIMEZONE);

    if (!function_exists('app_today')) {
        function app_today(): string { return date('Y-m-d'); }
    }
}

/**
 * Count total notifications (helper for before/after stats).
 */
function taskflow_count_notifications(): int {
    try {
        $db = Database::getInstance();
        if (!$db->tableExists('notifications')) return 0;
        $r = $db->fetch("SELECT COUNT(*) AS c FROM notifications");
        return (int)($r['c'] ?? 0);
    } catch (Exception $e) { return 0; }
}

/**
 * Count queued emails waiting to be sent.
 */
function taskflow_count_email_queue(): int {
    try {
        $db = Database::getInstance();
        if (!$db->tableExists('email_queue')) return 0;
        $r = $db->fetch("SELECT COUNT(*) AS c FROM email_queue WHERE status IN ('pending','queued') OR status IS NULL");
        return (int)($r['c'] ?? 0);
    } catch (Exception $e) { return 0; }
}

/**
 * MAIN: run the full notification + email pipeline.
 * Returns a structured summary array.
 */
function taskflow_run_notification_pipeline(array $options = []): array {
    taskflow_bootstrap_app();

    $opts = array_merge([
        'emails'              => 30,
        'skip_due_soon'       => false,
        'skip_overdue'        => false,
        'skip_bills'          => false,
        'skip_weekly'         => false,
        'skip_asana'          => false,
        'force_asana'         => false,
        'skip_recurring'      => false,
        'skip_telegram'       => false,  // skip all Telegram reminders
        'force_telegram'      => false,  // send due-today at any hour (for testing)
    ], $options);

    $summary = [
        'started_at'  => date('c'),
        'finished_at' => null,
        'timezone'    => date_default_timezone_get(),
        'steps'       => [],
        'notification_count_before' => taskflow_count_notifications(),
        'notification_count_after'  => null,
        'notifications_created'     => 0,
        'email_queue_before'        => taskflow_count_email_queue(),
        'email_queue_after'         => null,
        'bills_reminded'            => 0,
        'recurring_generated'       => 0,
        'asana_synced'              => false,
        'telegram_due_today_sent'   => 0,
        'telegram_overdue_sent'     => 0,
        // Phase 3
        'risk_score'                => null,
        'decisions_generated'       => 0,
        'approvals_queued'          => 0,
        'push_items_queued'         => 0,
        'session_cleanup'           => 0,
        'activity_logged'           => 0,
        'stale_feed_cleared'        => 0,
        // Penalty system
        'penalties_applied'         => 0,
        'penalties_total_amount'    => 0.0,
    ];

    $step = function (string $name, callable $fn) use (&$summary) {
        $t0 = microtime(true);
        $status = 'ok'; $msg = null;
        try { $fn(); }
        catch (Throwable $e) { $status = 'error'; $msg = $e->getMessage(); }
        $summary['steps'][] = [
            'name'        => $name,
            'status'      => $status,
            'duration_ms' => (int) round((microtime(true) - $t0) * 1000),
            'error'       => $msg,
        ];
    };

    $notif = new Notification();

    if (!$opts['skip_due_soon']) {
        $step('due_soon', function () use ($notif) { $notif->checkDueSoon(); });
    }
    if (!$opts['skip_overdue']) {
        $step('overdue', function () use ($notif) { $notif->checkOverdue(); });
    }

    // Penalty: apply once per overdue task (runs right after overdue sync)
    if (!($opts['skip_penalty'] ?? false)) {
        $step('penalty_apply', function () use (&$summary) {
            $job    = new PenaltyApplyJob();
            $result = $job->run();
            $summary['penalties_applied']      = (int)$result['penalties_applied'];
            $summary['penalties_total_amount'] = (float)$result['total_amount'];
        });
    }

    if (!$opts['skip_bills']) {
        $step('bills', function () use ($notif, &$summary) {
            $billModel = new Bill();
            $billModel->updateOverdueStatuses();
            $dueBills = $billModel->dueInDays(3);
            if (!empty($dueBills)) {
                $db = Database::getInstance();
                $admins = $db->fetchAll("SELECT id FROM users WHERE role IN ('admin','ceo') AND is_active = 1");
                if (empty($admins)) {
                    $admins = $db->fetchAll("SELECT id FROM users WHERE role = 'admin' AND is_active = 1");
                }
                foreach ($dueBills as $b) {
                    foreach ($admins as $a) {
                        $notif->create([
                            'user_id' => $a['id'],
                            'type'    => 'bill',
                            'title'   => t('notif.bill_due_soon'),
                            'message' => $b['store_name'] . ' • ' . $b['title'] . ' • Due: ' . $b['due_date']
                                         . ' • ' . rtrim(APP_URL, '/') . '/bills/store/' . $b['store_id'],
                        ]);
                    }
                    $billModel->setReminded($b['id']);
                    $summary['bills_reminded']++;
                }
            }
        });
    }

    if (!$opts['skip_asana']) {
        $step('asana', function () use ($opts, &$summary) {
            $currentUtcHour = (int) gmdate('G');
            if ($opts['force_asana'] || in_array($currentUtcHour, [6, 18], true)) {
                AsanaController::cronSync();
                $summary['asana_synced'] = true;
            }
        });
    }

    if (!$opts['skip_weekly']) {
        $step('weekly_report', function () use ($notif) { $notif->sendWeeklyReports(); });
    }

    // ── Telegram reminders ───────────────────────────────────────────────────
    if (!$opts['skip_telegram'] && defined('TELEGRAM_BOT_TOKEN') && TELEGRAM_BOT_TOKEN !== '') {
        $currentHour = (int) date('G'); // 0-23 in APP_TIMEZONE
        $reminderHour = defined('TELEGRAM_REMINDER_HOUR') ? (int) TELEGRAM_REMINDER_HOUR : 8;

        // Due-today reminder: only at the configured hour (default 8 AM)
        $isDueTodayHour = $opts['force_telegram'] || ($currentHour === $reminderHour);
        $step('telegram_due_today', function () use ($isDueTodayHour, &$summary) {
            if (!$isDueTodayHour) {
                // Not the right hour — skip silently
                $summary['telegram_due_today_sent'] = -1; // -1 = skipped
                return;
            }
            $tgSvc = new TelegramNotificationService();
            $summary['telegram_due_today_sent'] = $tgSvc->sendDueTodayReminders();
        });

        // Overdue reminder: once per day (run at same hour as due-today to avoid duplicate runs)
        $step('telegram_overdue', function () use ($isDueTodayHour, &$summary) {
            if (!$isDueTodayHour) {
                $summary['telegram_overdue_sent'] = -1; // skipped
                return;
            }
            $tgSvc = new TelegramNotificationService();
            $summary['telegram_overdue_sent'] = $tgSvc->sendOverdueReminders();
        });
    }

    // ── Session / token cleanup ──────────────────────────────────────────────
    $step('session_cleanup', function () use (&$summary) {
        $db = Database::getInstance();
        if ($db->tableExists('api_tokens')) {
            // Delete revoked tokens older than 90 days AND fully expired refresh tokens
            $deleted = $db->execute(
                "DELETE FROM api_tokens
                 WHERE (revoked_at IS NOT NULL AND revoked_at < DATE_SUB(NOW(), INTERVAL 90 DAY))
                    OR (refresh_token_expires_at IS NOT NULL AND refresh_token_expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY))"
            );
            $summary['session_cleanup'] = (int)$deleted;
        }
    });

    // ── Phase 3 — Intelligence refresh ──────────────────────────────────────
    if (!($opts['skip_intelligence'] ?? false)) {
        $activityFeed = new ActivityFeedBuilder();

        $step('risk_snapshot', function () use (&$summary) {
            $builder = new RiskSnapshotBuilder();
            $snap    = $builder->build();
            $summary['risk_score'] = $snap['unified_risk_score'];
        });

        $step('decision_feed', function () use (&$summary) {
            $db = Database::getInstance();
            // Count active decisions being replaced (stale feed cleared)
            if ($db->tableExists('decision_feed')) {
                $r = $db->fetch("SELECT COUNT(*) AS c FROM decision_feed WHERE is_active = 1");
                $summary['stale_feed_cleared'] = (int)($r['c'] ?? 0);
            }
            $builder = new DecisionFeedBuilder();
            $summary['decisions_generated'] = $builder->build();
        });

        $step('approval_queue', function () use (&$summary) {
            $builder = new ApprovalQueueBuilder();
            $summary['approvals_queued'] = $builder->build();
        });

        $step('push_queue', function () use (&$summary) {
            $builder = new MobilePushQueueBuilder();
            $summary['push_items_queued'] = $builder->build();
        });

        // Log the intelligence refresh to activity feed
        $step('activity_log', function () use ($activityFeed, &$summary) {
            $logged = 0;
            // Log Telegram reminders
            $tgToday   = $summary['telegram_due_today_sent'] ?? 0;
            $tgOverdue = $summary['telegram_overdue_sent']   ?? 0;
            if ($tgToday > 0 || $tgOverdue > 0) {
                $activityFeed->logTelegramReminders(
                    $tgToday   === -1 ? 0 : (int)$tgToday,
                    $tgOverdue === -1 ? 0 : (int)$tgOverdue
                );
                $logged++;
            }
            // Log intelligence refresh
            if ($summary['risk_score'] !== null) {
                $activityFeed->logIntelligenceRefresh(
                    (float)$summary['risk_score'],
                    (int)$summary['decisions_generated']
                );
                $logged++;
            }
            // Log full cron run
            $activityFeed->logCronRun($summary);
            $logged++;
            $summary['activity_logged'] = $logged;
        });
    }

    $step('email_queue', function () use ($opts) {
        Notification::processEmailQueue((int) $opts['emails']);
    });

    if (!$opts['skip_recurring']) {
        $step('recurring_backfill', function () use (&$summary) {
            $db = Database::getInstance();
            if ($db->columnExists('tasks', 'repeat_type') && $db->columnExists('tasks', 'last_occurrence_generated_at')) {
                $today = DateService::today();
                $rows = $db->fetchAll(
                    "SELECT id FROM tasks
                      WHERE repeat_type IS NOT NULL AND repeat_type <> 'none'
                        AND is_completed = 1
                        AND last_occurrence_generated_at IS NULL
                        AND due_date <= ?
                      LIMIT 500",
                    [$today]
                );
                $svc = new RecurringTaskService();
                foreach ($rows as $r) {
                    if ($svc->generateNextOccurrence((int) $r['id'])) {
                        $summary['recurring_generated']++;
                    }
                }
            }
        });
    }

    $summary['notification_count_after'] = taskflow_count_notifications();
    $summary['notifications_created']    = max(0, $summary['notification_count_after'] - $summary['notification_count_before']);
    $summary['email_queue_after']        = taskflow_count_email_queue();
    $summary['finished_at']              = date('c');

    return $summary;
}

/* ─────────────────────────────────────────────────────────────────
   CLI entrypoint — only runs when invoked directly
   ───────────────────────────────────────────────────────────────── */
if (PHP_SAPI === 'cli' && isset($argv[0]) && realpath($argv[0]) === __FILE__) {

    $helpText = <<<HELP
TaskFlow notification / email pipeline runner

Usage:
  php scripts/run_notifications.php [options]

Options:
  --emails=N         Max emails to drain from the queue (default: 30)
  --skip-due-soon    Skip the "due soon" notification pass
  --skip-overdue     Skip the overdue notification pass
  --skip-bills       Skip bill reminder notifications
  --skip-weekly      Skip weekly summary email dispatch
  --skip-asana       Skip Asana periodic sync
  --force-asana      Run Asana sync regardless of the every-2-hours gate
  --skip-recurring   Skip recurring-task backfill
  --skip-telegram    Skip Telegram due-today and overdue reminders
  --force-telegram   Force Telegram due-today reminder regardless of current hour
  --json             Emit the full summary as JSON on stdout
  --help             Show this help text and exit

Exit codes: 0 on success, 1 on fatal error.

HELP;

    $opts = [
        'emails'         => 30,
        'skip_due_soon'  => false,
        'skip_overdue'   => false,
        'skip_bills'     => false,
        'skip_weekly'    => false,
        'skip_asana'     => false,
        'force_asana'    => false,
        'skip_recurring'  => false,
        'skip_telegram'   => false,
        'force_telegram'  => false,
    ];
    $emitJson = false;

    foreach (array_slice($argv, 1) as $arg) {
        if ($arg === '--help' || $arg === '-h') { echo $helpText; exit(0); }
        if (preg_match('/^--emails=(\d+)$/', $arg, $m)) { $opts['emails'] = (int) $m[1]; continue; }
        switch ($arg) {
            case '--skip-due-soon':  $opts['skip_due_soon']  = true; break;
            case '--skip-overdue':   $opts['skip_overdue']   = true; break;
            case '--skip-bills':     $opts['skip_bills']     = true; break;
            case '--skip-weekly':    $opts['skip_weekly']    = true; break;
            case '--skip-asana':     $opts['skip_asana']     = true; break;
            case '--force-asana':    $opts['force_asana']    = true; break;
            case '--skip-recurring': $opts['skip_recurring'] = true; break;
            case '--skip-telegram':  $opts['skip_telegram']  = true; break;
            case '--force-telegram': $opts['force_telegram'] = true; break;
            case '--json':           $emitJson = true; break;
            default:
                fwrite(STDERR, "Unknown option: {$arg}\n\n{$helpText}");
                exit(1);
        }
    }

    try {
        $summary = taskflow_run_notification_pipeline($opts);
    } catch (Throwable $e) {
        fwrite(STDERR, "FATAL: " . $e->getMessage() . "\n");
        exit(1);
    }

    if ($emitJson) {
        echo json_encode($summary, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
    } else {
        $steps = array_map(fn($s) => $s['name'] . ':' . $s['status'], $summary['steps']);
        echo sprintf(
            "TaskFlow pipeline done · %s → %s | new_notifs=%d · bills_reminded=%d · recurring=%d · asana=%s · queue=%d→%d | %s\n",
            $summary['started_at'],
            $summary['finished_at'],
            $summary['notifications_created'],
            $summary['bills_reminded'],
            $summary['recurring_generated'],
            $summary['asana_synced'] ? 'yes' : 'no',
            $summary['email_queue_before'],
            $summary['email_queue_after'],
            implode(' · ', $steps)
        );
    }
    exit(0);
}
