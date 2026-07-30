<?php
// Temporary migration download — delete after use
$files = [
    '1' => ['path' => __DIR__ . '/database/migrations/2026_04_12_task_schema_columns.sql', 'name' => '1_task_schema_columns.sql'],
    '2' => ['path' => __DIR__ . '/database/migrations/2026_04_12_role_rename.sql',         'name' => '2_role_rename.sql'],
    '3' => ['path' => __DIR__ . '/database/migrations/2026_05_09_penalty_system.sql',       'name' => '3_penalty_system.sql'],
    '4' => ['path' => __DIR__ . '/database/migrations/2026_06_02_task_approval_workflow.sql', 'name' => '4_task_approval_workflow.sql'],
    '5' => ['path' => __DIR__ . '/database/migrations/2026_06_02_reviewer_workspace.sql',   'name' => '5_reviewer_workspace.sql'],
    '6' => ['path' => __DIR__ . '/database/migrations/2026_06_02_reviewer_workspace_v2.sql','name' => '6_reviewer_workspace_v2.sql'],
];

$f = $_GET['f'] ?? '';
if (isset($files[$f])) {
    $file = $files[$f];
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . $file['name'] . '"');
    readfile($file['path']);
    exit;
}
?>
<html><body style="font-family:sans-serif;padding:20px;background:#111;color:#eee">
<h2>Download SQL Migrations</h2>
<p>Chạy theo thứ tự trên phpMyAdmin:</p>
<ol>
<li><a href="?f=1" style="color:#60a5fa">1_task_schema_columns.sql</a></li>
<li><a href="?f=2" style="color:#60a5fa">2_role_rename.sql</a></li>
<li><a href="?f=3" style="color:#60a5fa">3_penalty_system.sql</a></li>
<li><a href="?f=4" style="color:#60a5fa">4_task_approval_workflow.sql</a></li>
<li><a href="?f=5" style="color:#60a5fa">5_reviewer_workspace.sql</a></li>
<li><a href="?f=6" style="color:#60a5fa">6_reviewer_workspace_v2.sql</a></li>
</ol>
<p style="color:#f87171;font-size:12px">⚠️ Xóa file này sau khi dùng xong</p>
</body></html>
