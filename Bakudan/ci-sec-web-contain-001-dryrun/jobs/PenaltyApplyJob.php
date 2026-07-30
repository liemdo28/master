<?php
/**
 * PenaltyApplyJob — scan overdue tasks and apply one-time penalties.
 *
 * Runs as part of the hourly cron pipeline, after OverdueSyncJob.
 * Idempotent: re-running has no effect on tasks that already have a penalty.
 *
 * CLI usage (standalone):
 *   php jobs/PenaltyApplyJob.php
 */
class PenaltyApplyJob {
    private PenaltyService $penaltyService;

    public function __construct() {
        $this->penaltyService = new PenaltyService();
    }

    /**
     * @return array{job:string, penalties_applied:int, total_amount:float, ran_at:string}
     */
    public function run(): array {
        $result = $this->penaltyService->applyOverduePenalties();

        return [
            'job'               => 'penalty_apply',
            'penalties_applied' => (int)$result['count'],
            'total_amount'      => (float)$result['total_amount'],
            'ran_at'            => date('Y-m-d H:i:s'),
        ];
    }
}

// ── CLI runner ────────────────────────────────────────────────────────────────
if (PHP_SAPI === 'cli' && basename(__FILE__) === basename($argv[0] ?? '')) {
    $dir = dirname(__DIR__);
    require_once $dir . '/config/database.php';
    require_once $dir . '/config/time.php';
    require_once $dir . '/service/PenaltyService.php';

    if (!defined('APP_TIMEZONE')) define('APP_TIMEZONE', 'Asia/Ho_Chi_Minh');
    date_default_timezone_set(APP_TIMEZONE);

    if (!function_exists('app_today')) {
        function app_today(): string { return date('Y-m-d'); }
    }

    $result = (new PenaltyApplyJob())->run();
    echo json_encode($result, JSON_PRETTY_PRINT) . PHP_EOL;
}
