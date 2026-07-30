<?php
$_SERVER['HTTP_HOST'] = 'preview.dashboard.bakudanramen.com';
chdir(dirname(__DIR__));
(function() {
    $f = __DIR__ . '/../.env.preview';
    if (!file_exists($f)) $f = __DIR__ . '/../.env';
    if (!file_exists($f)) return;
    foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (preg_match('/^\s*(DB_[A-Z_]+)\s*=\s*(.+)$/', $line, $m)) {
            putenv("{$m[1]}={$m[2]}"); $_ENV[$m[1]] = $m[2];
        }
    }
})();
require_once 'config/database.php';
$pdo = Database::getInstance()->getConnection();

$groups = $pdo->query("
    SELECT dg.id, dg.entity_type, dg.duplicate_hash, dg.status, dg.detected_at,
        GROUP_CONCAT(dgi.entity_id ORDER BY dgi.is_canonical DESC SEPARATOR ',') AS entity_ids,
        GROUP_CONCAT(dgi.is_canonical ORDER BY dgi.is_canonical DESC SEPARATOR ',') AS canonicals
    FROM duplicate_groups dg
    JOIN duplicate_group_items dgi ON dgi.group_id = dg.id
    GROUP BY dg.id ORDER BY dg.entity_type, dg.id
")->fetchAll(PDO::FETCH_ASSOC);

foreach ($groups as $g) {
    $ids = explode(',', $g['entity_ids']);
    $in = implode(',', array_map('intval', $ids));
    if ($g['entity_type'] === 'bill') {
        $rows = $pdo->query("SELECT id, title, amount, due_date, vendor, category, status, store_id FROM bills WHERE id IN ($in)")->fetchAll(PDO::FETCH_ASSOC);
    } else {
        $rows = $pdo->query("SELECT t.id, t.title, t.due_date, t.status, u.name as assignee FROM tasks t LEFT JOIN users u ON u.id=t.assignee_id WHERE t.id IN ($in)")->fetchAll(PDO::FETCH_ASSOC);
    }
    $g['records'] = $rows;
    $g['canonical_id'] = $ids[0];
    echo json_encode($g) . "\n";
}
