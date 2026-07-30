<?php
/**
 * Audit Nguyen Nguyen's old tasks and create matching recurring work from
 * 2026-07-13 forward. Idempotent: it skips any matching task already present.
 */

chdir(dirname(__DIR__));
require_once __DIR__ . '/../config/database.php';

$db = Database::getInstance();
$pdo = $db->getConnection();

$startDate = new DateTimeImmutable('2026-07-13');
$cutoffDate = '2026-07-31';

function normalize_key($value) {
    $value = strtolower(trim((string)$value));
    $value = preg_replace('/\s+/', ' ', $value);
    return $value;
}

function column_list(Database $db, string $table): array {
    $rows = $db->fetchAll(
        "SELECT COLUMN_NAME AS column_name
         FROM information_schema.columns
         WHERE table_schema = ?
           AND table_name = ?
         ORDER BY ordinal_position",
        [DB_NAME, $table]
    );
    return array_values(array_filter(array_map(static function ($row) {
        return $row['column_name'] ?? $row['COLUMN_NAME'] ?? null;
    }, $rows)));
}

function first_present(array $row, array $keys, $fallback = null) {
    foreach ($keys as $key) {
        if (array_key_exists($key, $row) && $row[$key] !== null && $row[$key] !== '') {
            return $row[$key];
        }
    }
    return $fallback;
}

function infer_store_id(Database $db, string $title, ?int $current): ?int {
    if ($current) {
        return $current;
    }

    $titleLower = strtolower($title);
    $patterns = [
        'b1' => ["%the rim%", "%(b1)%", "b1%"],
        'b2' => ["%stone oak%", "%(b2)%", "b2%"],
        'b3' => ["%bandera%", "%(b3)%", "b3%"],
        'raw stockton' => ["%raw stockton%", "stockton%"],
        'modesto' => ["%modesto%"],
        'ift' => ["ift%"],
        'copper' => ["%copper%"],
        'heo' => ["%heo%"],
        'raw venture' => ["%raw venture%"],
    ];

    $needle = null;
    foreach (array_keys($patterns) as $label) {
        if (str_contains($titleLower, $label)) {
            $needle = $label;
            break;
        }
    }
    if ($needle === null) {
        return null;
    }

    $where = implode(' OR ', array_fill(0, count($patterns[$needle]), 'LOWER(name) LIKE ?'));
    $row = $db->fetch(
        "SELECT id FROM stores WHERE {$where} ORDER BY id LIMIT 1",
        $patterns[$needle]
    );
    return $row ? (int)$row['id'] : null;
}

function infer_categories(string $title, array $existing, ?string $taskCategory, ?int $storeId, array $bakudanStoreIds): array {
    $categories = array_values(array_filter(array_map(
        static fn($cat) => strtolower(trim((string)$cat)),
        $existing
    )));
    if ($taskCategory !== null && trim($taskCategory) !== '') {
        $categories[] = strtolower(trim($taskCategory));
    }

    $t = strtolower($title);
    if (str_contains($t, 'tax') || str_contains($t, 'cdtfa') || str_contains($t, 'de9') || str_contains($t, '941') || str_contains($t, 'ift')) {
        $categories[] = 'tax';
    }
    if (str_contains($t, 'rent') || str_contains($t, 'lease')) {
        $categories[] = 'rent';
    }
    if (str_contains($t, 'att') || str_contains($t, 'at&t') || str_contains($t, 'phone')) {
        $categories[] = 'phone';
    }
    if (str_contains($t, 'amtrust') || str_contains($t, 'insurance')) {
        $categories[] = 'insurance';
    }
    if (str_contains($t, 'trash') || str_contains($t, ' wm ') || str_ends_with($t, ' wm')) {
        $categories[] = 'trash';
    }
    if (str_contains($t, 'pge') || str_contains($t, 'pg&e') || str_contains($t, 'electric') || str_contains($t, 'electronic') || str_contains($t, 'cps')) {
        $categories[] = 'electronic';
    }
    if (str_contains($t, 'water') || (str_contains($t, 'cps') && $storeId && in_array($storeId, $bakudanStoreIds, true))) {
        $categories[] = 'water';
    }
    if (str_contains($t, 'review google') || str_contains($t, 'review yelp') || str_contains($t, 'doordash')) {
        $categories[] = 'review';
    }

    $categories = array_values(array_unique(array_filter($categories)));
    return $categories ?: ['general'];
}

function classify_repeat(array $rows): ?array {
    usort($rows, static fn($a, $b) => strcmp((string)($a['due_date'] ?? ''), (string)($b['due_date'] ?? '')));
    $template = end($rows);
    $title = strtolower((string)$template['title']);
    $repeatType = strtolower((string)($template['repeat_type'] ?? 'none'));
    $config = [];
    if (!empty($template['repeat_config'])) {
        $decoded = json_decode((string)$template['repeat_config'], true);
        if (is_array($decoded)) {
            $config = $decoded;
        }
    }

    if ($repeatType !== '' && $repeatType !== 'none') {
        $interval = max(1, (int)($config['interval'] ?? 1));
        if ($repeatType === 'monthly' && $interval === 3) {
            return ['label' => 'Quarterly', 'type' => 'quarterly', 'interval' => 3, 'template' => $template, 'config' => $config];
        }
        if ($repeatType === 'yearly') {
            return ['label' => 'Annually', 'type' => 'annually', 'interval' => $interval, 'template' => $template, 'config' => $config];
        }
        return ['label' => ucfirst($repeatType), 'type' => $repeatType, 'interval' => $interval, 'template' => $template, 'config' => $config];
    }

    if (str_contains($title, 'daily')) {
        return ['label' => 'Daily', 'type' => 'daily', 'interval' => 1, 'template' => $template, 'config' => []];
    }
    if (str_contains($title, 'weekly')) {
        return ['label' => 'Weekly', 'type' => 'weekly', 'interval' => 1, 'template' => $template, 'config' => []];
    }
    if (str_contains($title, 'quarter') || str_contains($title, 'quater')) {
        return ['label' => 'Quarterly', 'type' => 'quarterly', 'interval' => 3, 'template' => $template, 'config' => []];
    }
    if (str_contains($title, 'annual') || str_contains($title, 'yearly')) {
        return ['label' => 'Annually', 'type' => 'annually', 'interval' => 1, 'template' => $template, 'config' => []];
    }
    if (str_contains($title, 'monthly')) {
        return ['label' => 'Monthly', 'type' => 'monthly', 'interval' => 1, 'template' => $template, 'config' => []];
    }

    $dates = array_values(array_filter(array_map(static fn($row) => $row['due_date'] ?? null, $rows)));
    if (count($dates) < 2) {
        return null;
    }

    $deltas = [];
    for ($i = 1; $i < count($dates); $i++) {
        $a = new DateTimeImmutable($dates[$i - 1]);
        $b = new DateTimeImmutable($dates[$i]);
        $deltas[] = (int)$a->diff($b)->format('%a');
    }
    $avg = array_sum($deltas) / max(1, count($deltas));

    if ($avg <= 2) {
        return ['label' => 'Daily', 'type' => 'daily', 'interval' => 1, 'template' => $template, 'config' => []];
    }
    if ($avg >= 5 && $avg <= 9) {
        return ['label' => 'Weekly', 'type' => 'weekly', 'interval' => 1, 'template' => $template, 'config' => []];
    }
    if ($avg >= 25 && $avg <= 35) {
        return ['label' => 'Monthly', 'type' => 'monthly', 'interval' => 1, 'template' => $template, 'config' => []];
    }
    if ($avg >= 80 && $avg <= 100) {
        return ['label' => 'Quarterly', 'type' => 'quarterly', 'interval' => 3, 'template' => $template, 'config' => []];
    }
    if ($avg >= 330 && $avg <= 400) {
        return ['label' => 'Annually', 'type' => 'annually', 'interval' => 1, 'template' => $template, 'config' => []];
    }

    return null;
}

function next_due_date(array $pattern, DateTimeImmutable $start): string {
    $template = $pattern['template'];
    $config = $pattern['config'];
    $sourceDue = !empty($template['due_date'])
        ? new DateTimeImmutable($template['due_date'])
        : $start;

    if ($pattern['type'] === 'daily') {
        return $start->format('Y-m-d');
    }

    if ($pattern['type'] === 'weekly') {
        $days = array_values(array_filter(array_map('intval', $config['days'] ?? [])));
        $targetDow = $days[0] ?? (int)$sourceDue->format('N');
        $candidate = $start;
        while ((int)$candidate->format('N') !== $targetDow) {
            $candidate = $candidate->modify('+1 day');
        }
        return $candidate->format('Y-m-d');
    }

    if ($pattern['type'] === 'monthly' || $pattern['type'] === 'quarterly') {
        $interval = $pattern['type'] === 'quarterly' ? 3 : max(1, (int)$pattern['interval']);
        $day = (int)($config['day_of_month'] ?? $sourceDue->format('j'));
        $candidate = $sourceDue;
        while ($candidate < $start) {
            $candidate = $candidate->modify("+{$interval} months");
        }
        $lastDay = (int)$candidate->format('t');
        return $candidate->setDate((int)$candidate->format('Y'), (int)$candidate->format('m'), min($day, $lastDay))->format('Y-m-d');
    }

    if ($pattern['type'] === 'annually') {
        $candidate = $sourceDue;
        while ($candidate < $start) {
            $candidate = $candidate->modify('+1 year');
        }
        return $candidate->format('Y-m-d');
    }

    return $start->format('Y-m-d');
}

function repeat_payload(array $pattern, string $dueDate): array {
    $due = new DateTimeImmutable($dueDate);
    if ($pattern['type'] === 'quarterly') {
        return ['monthly', json_encode(['interval' => 3, 'by' => 'day_of_month', 'day_of_month' => (int)$due->format('j')])];
    }
    if ($pattern['type'] === 'monthly') {
        return ['monthly', json_encode(['interval' => max(1, (int)$pattern['interval']), 'by' => 'day_of_month', 'day_of_month' => (int)$due->format('j')])];
    }
    if ($pattern['type'] === 'weekly') {
        return ['weekly', json_encode(['interval' => max(1, (int)$pattern['interval']), 'days' => [(int)$due->format('N')]])];
    }
    if ($pattern['type'] === 'daily') {
        return ['daily', json_encode(['interval' => max(1, (int)$pattern['interval'])])];
    }
    if ($pattern['type'] === 'annually') {
        return ['yearly', json_encode(['interval' => max(1, (int)$pattern['interval']), 'month' => (int)$due->format('n'), 'day' => (int)$due->format('j')])];
    }
    return ['none', null];
}

$pdo->exec(
    "CREATE TABLE IF NOT EXISTS task_category_links (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        category VARCHAR(50) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_task_category_links_task_category (task_id, category),
        KEY idx_task_category_links_category (category),
        KEY idx_task_category_links_task (task_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
);

$user = $db->fetch(
    "SELECT id, name, email, role
     FROM users
     WHERE LOWER(name) IN ('nguyen nguyen', 'nguyễn nguyễn')
        OR LOWER(name) LIKE '%nguyen%nguyen%'
        OR LOWER(email) LIKE '%nguyen%'
     ORDER BY CASE WHEN LOWER(name) IN ('nguyen nguyen', 'nguyễn nguyễn') THEN 0 ELSE 1 END, id
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
    echo json_encode(['ok' => false, 'error' => 'Nguyen Nguyen user not found', 'candidates' => $candidates], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
    exit(1);
}

$admin = $db->fetch(
    "SELECT id FROM users
     WHERE role IN ('admin','ceo') OR LOWER(name) = 'admin'
     ORDER BY CASE WHEN role = 'admin' THEN 0 WHEN LOWER(name) = 'admin' THEN 1 ELSE 2 END, id
     LIMIT 1"
);
$createdBy = $admin ? (int)$admin['id'] : (int)$user['id'];

$finance = $db->fetch("SELECT id FROM projects WHERE LOWER(name) = 'finance' ORDER BY id LIMIT 1");
$financeProjectId = $finance ? (int)$finance['id'] : null;

$bakudanStoreIds = array_map(
    static fn($row) => (int)$row['id'],
    $db->fetchAll("SELECT id FROM stores WHERE LOWER(name) LIKE '%bakudan%' OR LOWER(name) LIKE 'b1%' OR LOWER(name) LIKE 'b2%' OR LOWER(name) LIKE 'b3%'")
);

$rows = $db->fetchAll(
    "SELECT t.*,
            s.name AS store_name,
            p.name AS project_name
     FROM tasks t
     LEFT JOIN stores s ON s.id = t.direct_store_id
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.assignee_id = ?
       AND (t.due_date IS NULL OR t.due_date <= ?)
     ORDER BY COALESCE(t.due_date, '1900-01-01') ASC, t.id ASC",
    [(int)$user['id'], $cutoffDate]
);

$groups = [];
foreach ($rows as $row) {
    $storeId = infer_store_id($db, (string)$row['title'], isset($row['direct_store_id']) ? (int)$row['direct_store_id'] : null);
    $linkedRows = $db->fetchAll(
        "SELECT category FROM task_category_links WHERE task_id = ? ORDER BY category",
        [(int)$row['id']]
    );
    $existingCategories = array_map(static fn($catRow) => $catRow['category'], $linkedRows);
    $categories = infer_categories((string)$row['title'], $existingCategories, $row['task_category'] ?? null, $storeId, $bakudanStoreIds);
    $row['_store_id'] = $storeId;
    $row['_categories'] = $categories;
    $key = normalize_key($row['title']) . '|' . (string)($storeId ?? 0) . '|' . implode(',', $categories);
    $groups[$key][] = $row;
}

$taskColumns = column_list($db, 'tasks');
$insertable = array_flip($taskColumns);
$summary = [
    'ok' => true,
    'user' => ['id' => (int)$user['id'], 'name' => $user['name'], 'email' => $user['email'] ?? null],
    'audited_tasks' => count($rows),
    'patterns' => ['Daily' => 0, 'Weekly' => 0, 'Monthly' => 0, 'Quarterly' => 0, 'Annually' => 0],
    'created' => 0,
    'skipped_existing' => 0,
    'ignored_non_recurring' => 0,
    'created_tasks' => [],
];

foreach ($groups as $groupRows) {
    $pattern = classify_repeat($groupRows);
    if (!$pattern) {
        $summary['ignored_non_recurring'] += count($groupRows);
        continue;
    }

    $label = $pattern['label'];
    if (isset($summary['patterns'][$label])) {
        $summary['patterns'][$label]++;
    }

    $template = $pattern['template'];
    $title = (string)$template['title'];
    $storeId = $template['_store_id'];
    $categories = $template['_categories'];
    $primaryCategory = $categories[0] ?? ($template['task_category'] ?? 'general');
    $dueDate = next_due_date($pattern, $startDate);
    [$repeatType, $repeatConfig] = repeat_payload($pattern, $dueDate);
    $projectId = $financeProjectId ?: (!empty($template['project_id']) ? (int)$template['project_id'] : null);

    $exists = $db->fetch(
        "SELECT id
         FROM tasks
         WHERE assignee_id = ?
           AND LOWER(title) = LOWER(?)
           AND due_date = ?
           AND COALESCE(direct_store_id, 0) = ?
         LIMIT 1",
        [(int)$user['id'], $title, $dueDate, (int)($storeId ?? 0)]
    );
    if ($exists) {
        $summary['skipped_existing']++;
        continue;
    }

    $values = [
        'title' => $title,
        'description' => first_present($template, ['description'], ''),
        'notes' => first_present($template, ['notes'], null),
        'project_id' => $projectId,
        'section_id' => first_present($template, ['section_id'], null),
        'assignee_id' => (int)$user['id'],
        'priority' => first_present($template, ['priority'], 'medium'),
        'status' => 'todo',
        'is_completed' => 0,
        'visibility' => first_present($template, ['visibility'], 'private'),
        'private_by_user_id' => (int)$user['id'],
        'due_date' => $dueDate,
        'start_date' => null,
        'position' => first_present($template, ['position'], 0),
        'created_by' => $createdBy,
        'accepted_at' => null,
        'parent_task_id' => null,
        'reschedule_count' => 0,
        'repeat_type' => $repeatType,
        'repeat_config' => $repeatConfig,
        'repeat_from_mode' => first_present($template, ['repeat_from_mode'], 'due_date'),
        'repeat_end_type' => first_present($template, ['repeat_end_type'], 'never'),
        'repeat_end_date' => first_present($template, ['repeat_end_date'], null),
        'repeat_end_count' => first_present($template, ['repeat_end_count'], null),
        'estimated_time' => first_present($template, ['estimated_time'], null),
        'recurring_root_id' => first_present($template, ['recurring_root_id'], null),
        'occurrence_index' => 0,
        'direct_store_id' => $storeId,
        'task_category' => $primaryCategory,
        'created_at' => date('Y-m-d H:i:s'),
        'updated_at' => date('Y-m-d H:i:s'),
    ];

    $columns = [];
    $params = [];
    foreach ($values as $column => $value) {
        if (isset($insertable[$column])) {
            $columns[] = $column;
            $params[] = $value;
        }
    }

    $placeholders = implode(', ', array_fill(0, count($columns), '?'));
    $sql = 'INSERT INTO tasks (`' . implode('`, `', $columns) . '`) VALUES (' . $placeholders . ')';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $taskId = (int)$pdo->lastInsertId();

    foreach ($categories as $category) {
        $db->execute(
            "INSERT IGNORE INTO task_category_links (task_id, category, created_at) VALUES (?, ?, NOW())",
            [$taskId, $category]
        );
    }

    $summary['created']++;
    $summary['created_tasks'][] = [
        'id' => $taskId,
        'title' => $title,
        'due_date' => $dueDate,
        'repeat' => $label,
        'store_id' => $storeId,
        'categories' => $categories,
    ];
}

echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
