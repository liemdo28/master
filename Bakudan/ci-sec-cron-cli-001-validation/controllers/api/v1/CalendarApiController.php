<?php
/**
 * API v1 - Calendar Endpoints
 * GET /api/v1/calendar                                  → month grid
 * GET /api/v1/calendar/day?date=YYYY-MM-DD              → drawer detail (query-style)
 * GET /api/v1/calendar/day/YYYY-MM-DD                   → drawer detail (path-style)
 */
require_once __DIR__ . '/ApiController.php';
require_once __DIR__ . '/../../../models/Task.php';

class CalendarApiController extends ApiController {
    private $taskModel;

    public function __construct() {
        parent::__construct();
        $this->taskModel = new Task();
    }

    // ── GET /api/v1/calendar ─────────────────────────────────────
    public function index() {
        $this->requireAuth();
        $userId = $this->userId;

        $timezone = $_GET['timezone'] ?? ($this->user['timezone'] ?? null);
        app_set_timezone($timezone);

        $year  = $this->safeInt($_GET['year']  ?? (int)app_now($timezone)->format('Y'));
        $month = $this->safeInt($_GET['month'] ?? (int)app_now($timezone)->format('m'));
        $projectId = !empty($_GET['project_id']) ? (int) $_GET['project_id'] : null;

        $month = max(1, min(12, $month));
        $year  = max(2000, min(2100, $year));

        $startDate = app_month_start($year, $month, $timezone)->format('Y-m-d');
        $endDate   = app_month_end($year, $month, $timezone)->format('Y-m-d');
        $today     = app_today($timezone);

        $tasks = $this->taskModel->getCalendarTasksForUser($userId, $startDate, $endDate, $projectId);

        $byDate = [];
        foreach ($tasks as $t) {
            $date = $t['due_date'];
            if (!isset($byDate[$date])) $byDate[$date] = [];
            $byDate[$date][] = $this->formatDayTask($t, false, $today);
        }

        $daysInMonth = (int)(new DateTimeImmutable($startDate))->format('t');
        $monthDays = [];
        for ($d = 1; $d <= $daysInMonth; $d++) {
            $date = sprintf('%04d-%02d-%02d', $year, $month, $d);
            $monthDays[] = [
                'date'        => $date,
                'day'         => $d,
                'tasks_count' => count($byDate[$date] ?? []),
                'tasks'       => $byDate[$date] ?? [],
                'is_today'    => $date === $today,
                'is_overdue'  => $date < $today,
            ];
        }

        api_response([
            'year'   => $year,
            'month'  => $month,
            'today'  => $today,
            'timezone' => app_timezone_name($timezone),
            'days'   => $monthDays,
            'total_tasks_in_month' => count($tasks),
        ], 'OK');
    }

    // ── GET /api/v1/calendar/day ─────────────────────────────────
    //    Sprint 1.3.1 — drawer detail for a single day
    //    Accepts path arg OR ?date= query param.
    public function day($date = null) {
        $this->requireAuth();

        $timezone = $_GET['timezone'] ?? ($this->user['timezone'] ?? null);
        app_set_timezone($timezone);

        $date = trim((string)($date ?? $_GET['date'] ?? ''));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            api_error('date is required in YYYY-MM-DD format', 422);
        }

        $projectId = !empty($_GET['project_id']) ? (int) $_GET['project_id'] : null;
        $tasks = $this->taskModel->getTasksByDateForUser($this->userId, $date, $projectId);

        $today = app_today($timezone);
        $formatted = [];
        foreach ($tasks as $t) $formatted[] = $this->formatDayTask($t, true, $today);

        api_response([
            'date'       => $date,
            'timezone'   => app_timezone_name($timezone),
            'is_today'   => $date === $today,
            'is_overdue' => $date < $today,
            'is_future'  => $date > $today,
            'count'      => count($formatted),
            'tasks'      => $formatted,
        ], 'OK');
    }

    // ── helpers ──────────────────────────────────────────────────

    /**
     * Format a task for calendar grid (brief) or drawer (detailed).
     */
    private function formatDayTask(array $t, bool $detailed = false, ?string $today = null): array {
        $today = $today ?: app_today();
        $isOverdue = !empty($t['due_date']) && $t['due_date'] < $today && empty($t['is_completed']);
        $isToday   = !empty($t['due_date']) && $t['due_date'] === $today;

        $base = [
            'id'             => (int)$t['id'],
            'title'          => $t['title'] ?? '',
            'priority'       => $t['priority'] ?? 'medium',
            'status'         => $t['status'] ?? 'todo',
            'is_completed'   => (int)($t['is_completed'] ?? 0),
            'due_date'       => $t['due_date'] ?? null,
            'project_name'   => $t['project_name'] ?? null,
            'project_color'  => $t['project_color'] ?? null,
            'store_id'       => !empty($t['store_id']) ? (int)$t['store_id'] : null,
            'store_name'     => $t['store_name'] ?? null,
            'store_color'    => $t['store_color'] ?? null,
            'assignee_id'    => !empty($t['assignee_id']) ? (int)$t['assignee_id'] : null,
            'assignee_name'  => $t['assignee_name'] ?? null,
            'assignee_avatar'=> $t['assignee_avatar'] ?? null,
            'repeat_type'    => $t['repeat_type'] ?? 'none',
            'is_recurring'   => !empty($t['repeat_type']) && $t['repeat_type'] !== 'none',
            'badge'          => $isOverdue ? 'overdue' : ($isToday ? 'today' : null),
        ];

        if ($detailed) {
            $base['description']      = $t['description'] ?? '';
            $base['section_name']     = $t['section_name'] ?? null;
            $base['start_date']       = $t['start_date'] ?? null;
            $base['recurrence_label'] = $this->recurrenceLabel($t['repeat_type'] ?? 'none');
        }
        return $base;
    }

    private function recurrenceLabel(string $type): ?string {
        $map = [
            'none' => null,
            'daily' => 'Daily',
            'weekly' => 'Weekly',
            'weekly_multi' => 'Multi-day/week',
            'monthly' => 'Monthly',
            'yearly' => 'Yearly',
            'custom_interval' => 'Custom',
        ];
        return $map[$type] ?? null;
    }
}
