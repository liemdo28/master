<?php
require_once __DIR__ . '/../config/database.php';

$db = Database::getInstance();
$user = $db->fetch(
    "SELECT id, name, email, role
     FROM users
     WHERE LOWER(name) IN ('nguyen nguyen', 'nguyễn nguyễn')
        OR LOWER(name) LIKE '%nguyen%nguyen%'
     ORDER BY id
     LIMIT 1"
);

if (!$user) {
    $candidates = $db->fetchAll(
        "SELECT id, name, email, role
         FROM users
         WHERE LOWER(name) LIKE '%nguyen%'
            OR LOWER(name) LIKE '%nguyễn%'
            OR LOWER(email) LIKE '%nguyen%'
         ORDER BY id
         LIMIT 50"
    );
    echo json_encode([
        'error' => 'Nguyen Nguyen user not found',
        'candidates' => array_map(static function ($row) {
            return [
                'id' => (int)$row['id'],
                'name' => $row['name'],
                'email' => $row['email'],
                'role' => $row['role'],
            ];
        }, $candidates),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit(0);
}

$rows = $db->fetchAll(
    "SELECT t.id, t.title, t.due_date, t.repeat_type, t.repeat_config, t.status,
            t.is_completed, t.task_category, t.direct_store_id,
            s.name AS store_name, p.name AS project_name,
            GROUP_CONCAT(tcl.category ORDER BY tcl.category SEPARATOR ',') AS categories
     FROM tasks t
     LEFT JOIN stores s ON s.id = t.direct_store_id
     LEFT JOIN projects p ON p.id = t.project_id
     LEFT JOIN task_category_links tcl ON tcl.task_id = t.id
     WHERE t.assignee_id = ?
       AND (t.due_date IS NULL OR t.due_date < '2026-08-01')
     GROUP BY t.id
     ORDER BY COALESCE(t.due_date, '1900-01-01') ASC, t.title ASC",
    [(int)$user['id']]
);

$summary = [
    'user' => [
        'id' => (int)$user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'role' => $user['role'],
    ],
    'total' => count($rows),
    'by_repeat_type' => [],
    'tasks' => [],
];

foreach ($rows as $row) {
    $repeat = $row['repeat_type'] ?: 'none';
    $summary['by_repeat_type'][$repeat] = ($summary['by_repeat_type'][$repeat] ?? 0) + 1;
    $summary['tasks'][] = [
        'id' => (int)$row['id'],
        'title' => $row['title'],
        'due_date' => $row['due_date'],
        'repeat_type' => $repeat,
        'repeat_config' => $row['repeat_config'],
        'status' => $row['status'],
        'is_completed' => (int)$row['is_completed'],
        'project' => $row['project_name'],
        'store_id' => $row['direct_store_id'] !== null ? (int)$row['direct_store_id'] : null,
        'store' => $row['store_name'],
        'task_category' => $row['task_category'],
        'categories' => $row['categories'] ? explode(',', $row['categories']) : [],
    ];
}

echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
