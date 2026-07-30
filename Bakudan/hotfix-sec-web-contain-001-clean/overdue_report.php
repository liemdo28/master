<?php
/**
 * Overdue > 7 Days Report
 * Run on server: php overdue_report.php
 * Or access via: dashboard.bakudanramen.com/overdue_report.php
 */
require_once __DIR__ . '/bootstrap.php';

$db = Database::getInstance();
$cutoff = date('Y-m-d', strtotime('-7 days'));

$tasks = $db->fetchAll(
    "SELECT t.id, t.title, t.due_date,
            DATEDIFF(CURDATE(), t.due_date) as overdue_days,
            u.name as assignee_name,
            p.name as project_name,
            t.priority,
            t.status
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     LEFT JOIN projects p ON t.project_id = p.id
     WHERE t.is_completed = 0
       AND t.due_date IS NOT NULL
       AND t.due_date < ?
     ORDER BY overdue_days DESC
     LIMIT 100",
    [$cutoff]
);

$total = count($tasks);
$summary = ['critical' => 0, 'high' => 0, 'medium' => 0, 'low' => 0, 'urgent' => 0];
foreach ($tasks as $t) {
    $p = $t['priority'] ?? 'low';
    if (isset($summary[$p])) $summary[$p]++;
    else $summary['low']++;
}

echo "=================================================================\n";
echo "  OVERDUE TASKS OVER 7 DAYS — " . date('Y-m-d H:i:s') . "\n";
echo "=================================================================\n";
echo "Total overdue > 7 days: $total\n";
echo "  Critical: {$summary['critical']}\n";
echo "  Urgent:   {$summary['urgent']}\n";
echo "  High:     {$summary['high']}\n";
echo "  Medium:   {$summary['medium']}\n";
echo "  Low:      {$summary['low']}\n";
echo "-----------------------------------------------------------------\n";

if ($total === 0) {
    echo "No tasks overdue more than 7 days.\n";
    exit;
}

foreach ($tasks as $t) {
    $days = (int)$t['overdue_days'];
    $due = $t['due_date'];
    $assignee = $t['assignee_name'] ?: '-';
    $project = $t['project_name'] ?: '-';
    $pri = strtoupper($t['priority'] ?: 'low');
    $status = $t['status'] ?: '-';
    $title = $t['title'];
    printf("[%3dd] #%-6d %-50s | %s | %s | %s | %s\n",
        $days, $t['id'], substr($title, 0, 50), $due, $assignee, $project, $pri);
}

echo "-----------------------------------------------------------------\n";
echo "Done.\n";
