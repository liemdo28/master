<?php

if (!defined('APP_DEFAULT_TIMEZONE')) {
    // Workspace default — fall back when user has no per-user timezone stored.
    define('APP_DEFAULT_TIMEZONE', 'Asia/Ho_Chi_Minh');
}

function app_valid_timezone($timezone) {
    if (!is_string($timezone) || trim($timezone) === '') {
        return false;
    }

    return in_array($timezone, DateTimeZone::listIdentifiers(), true);
}

function app_timezone_name($preferred = null) {
    if (app_valid_timezone($preferred)) {
        return $preferred;
    }

    return APP_DEFAULT_TIMEZONE;
}

function app_timezone($preferred = null) {
    return new DateTimeZone(app_timezone_name($preferred));
}

function app_set_timezone($preferred = null) {
    date_default_timezone_set(app_timezone_name($preferred));
}

function app_now($preferred = null) {
    return new DateTimeImmutable('now', app_timezone($preferred));
}

function app_today($preferred = null) {
    return app_now($preferred)->format('Y-m-d');
}

function app_month_start($year, $month, $preferred = null) {
    $safeYear = max(2000, min(2100, (int) $year));
    $safeMonth = max(1, min(12, (int) $month));

    return new DateTimeImmutable(
        sprintf('%04d-%02d-01 00:00:00', $safeYear, $safeMonth),
        app_timezone($preferred)
    );
}

function app_month_end($year, $month, $preferred = null) {
    return app_month_start($year, $month, $preferred)->modify('last day of this month');
}

function app_task_due_bucket($task, $today = null) {
    $today = $today ?: app_today();
    $dueDate = $task['due_date'] ?? null;
    $isCompleted = !empty($task['is_completed']) || (($task['status'] ?? '') === 'done');
    $status = $task['status'] ?? 'todo';

    if ($isCompleted) {
        return 'completed';
    }

    if ($dueDate && $dueDate < $today) {
        return 'overdue';
    }

    if ($status === 'in_progress' || $status === 'review') {
        return 'in_progress';
    }

    if ($dueDate === $today) {
        return 'today';
    }

    if ($dueDate) {
        return 'upcoming';
    }

    return 'no_date';
}

function app_task_urgency_rank($task, $today = null) {
    $bucket = app_task_due_bucket($task, $today);
    $map = [
        'overdue' => 0,
        'in_progress' => 1,
        'today' => 2,
        'upcoming' => 3,
        'no_date' => 4,
        'completed' => 5,
    ];

    return $map[$bucket] ?? 4;
}

function app_priority_rank($priority) {
    $map = [
        'urgent' => 0,
        'high' => 1,
        'medium' => 2,
        'low' => 3,
    ];

    return $map[strtolower((string) $priority)] ?? 4;
}

function app_task_repeat_summary($task) {
    $repeatType = strtolower((string) ($task['repeat_type'] ?? 'none'));
    if ($repeatType === 'none' || $repeatType === '') {
        return null;
    }

    $config = $task['repeat_config'] ?? null;
    if (is_string($config)) {
        $decoded = json_decode($config, true);
        $config = is_array($decoded) ? $decoded : [];
    }
    if (!is_array($config)) {
        $config = [];
    }

    $interval = max(1, (int) ($config['interval'] ?? 1));
    if ($repeatType === 'daily') {
        return $interval === 1 ? 'Daily' : "Every {$interval} days";
    }

    if ($repeatType === 'weekly') {
        $days = array_values(array_filter(array_map('intval', $config['days'] ?? [])));
        $dayNames = [
            1 => 'Mon',
            2 => 'Tue',
            3 => 'Wed',
            4 => 'Thu',
            5 => 'Fri',
            6 => 'Sat',
            7 => 'Sun',
        ];
        $labels = array_values(array_filter(array_map(function ($day) use ($dayNames) {
            return $dayNames[$day] ?? null;
        }, $days)));

        if (!empty($labels)) {
            $prefix = $interval === 1 ? 'Weekly' : "Every {$interval} weeks";
            return $prefix . ' · ' . implode(', ', $labels);
        }

        return $interval === 1 ? 'Weekly' : "Every {$interval} weeks";
    }

    if ($repeatType === 'monthly') {
        $dayOfMonth = (int) ($config['day_of_month'] ?? 0);
        if ($dayOfMonth > 0) {
            return $interval === 1
                ? "Monthly · day {$dayOfMonth}"
                : "Every {$interval} months · day {$dayOfMonth}";
        }

        return $interval === 1 ? 'Monthly' : "Every {$interval} months";
    }

    if ($repeatType === 'yearly') {
        return $interval === 1 ? 'Yearly' : "Every {$interval} years";
    }

    return ucfirst($repeatType);
}
