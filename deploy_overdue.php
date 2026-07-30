<?php
/**
 * Quick deploy: adds overdue cleanup route to index.php
 * Run: https://dashboard.bakudanramen.com/deploy.php?key=deploy-p3-2026
 * After this, access: https://dashboard.bakudanramen.com/?route=cleanup
 */
if (($_GET['key'] ?? '') !== 'deploy-p3-2026') { http_response_code(403); die('Forbidden'); }
header('Content-Type: text/plain; charset=utf-8');

$root = __DIR__;
$indexPath = $root . '/index.php';
$content = file_get_contents($indexPath);

// Check if route already exists
if (strpos($content, 'route=cleanup') !== false) {
    echo "Route already exists.\n";
} else {
    // Add the cleanup route before "default:"
    $routeBlock = "
    case \$route === 'cleanup' && \$method === 'GET':
        require_once __DIR__ . '/controllers/DashboardController.php';
        \$ctrl = new DashboardController();
        \$ctrl->cleanupOverdue();
        break;
";
    // Find "default:" and insert before it
    $pos = strpos($content, "default:");
    if ($pos !== false) {
        $content = substr($content, 0, $pos) . $routeBlock . "\n    " . substr($content, $pos);
        file_put_contents($indexPath, $content);
        echo "Route 'cleanup' added to index.php.\n";
    } else {
        echo "Could not find 'default:' in index.php\n";
    }
}

// Also add the method to DashboardController if not exists
$ctrlPath = $root . '/controllers/DashboardController.php';
$ctrlContent = file_get_contents($ctrlPath);

if (strpos($ctrlContent, 'public function cleanupOverdue') !== false) {
    echo "cleanupOverdue method already exists.\n";
} else {
    // Add method at end of class (before closing brace)
    $method = '
    public function cleanupOverdue() {
        if (!isAdmin()) { http_response_code(403); echo "Admin only"; return; }
        $db = Database::getInstance();
        $cutoff = date("Y-m-d", strtotime("-7 days"));
        $today = app_today();

        $tasks = $db->fetchAll(
            "SELECT t.id, t.title, t.due_date, DATEDIFF(CURDATE(), t.due_date) as overdue_days
             FROM tasks t
             WHERE t.is_completed = 0 AND t.due_date IS NOT NULL AND t.due_date < ?
             ORDER BY overdue_days DESC LIMIT 500",
            [$cutoff]
        );
        $count = count($tasks);
        if ($count > 0) {
            $ids = array_column($tasks, "id");
            $placeholders = implode(",", array_fill(0, count($ids), "?"));
            $db->query("DELETE FROM tasks WHERE id IN ($placeholders)", $ids);
        }
        $remaining = $db->fetchColumn("SELECT COUNT(*) FROM tasks WHERE is_completed = 0 AND due_date IS NOT NULL AND due_date < ?", [$today]) ?? 0;
        echo "Deleted: $count tasks\nRemaining overdue: $remaining\n";
        echo "Done at " . date("Y-m-d H:i:s") . "\n";
    }
';
    // Insert before last closing brace
    $lastBrace = strrpos($ctrlContent, "}");
    if ($lastBrace !== false) {
        $ctrlContent = substr($ctrlContent, 0, $lastBrace) . $method . "\n}";
        file_put_contents($ctrlPath, $ctrlContent);
        echo "cleanupOverdue method added to DashboardController.php\n";
    } else {
        echo "Could not find closing brace in DashboardController.php\n";
    }
}
echo "\nNow access: https://dashboard.bakudanramen.com/?route=cleanup\n";
?>
