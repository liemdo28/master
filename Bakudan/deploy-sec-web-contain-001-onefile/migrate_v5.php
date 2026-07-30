<?php
/**
 * V5 One-time DB Migration — autonomy_log table
 * Run once: https://dashboard.bakudanramen.com/migrate_v5.php
 * This file deletes itself after successful migration.
 */

// Basic auth guard — must match before any DB work
$secret = $_GET['key'] ?? '';
if ($secret !== 'v5migrate2026') {
    http_response_code(403);
    die('<h2>403 — Invalid key.</h2>Add ?key=v5migrate2026 to the URL.');
}

require_once __DIR__ . '/config/database.php';

$sql = "
CREATE TABLE IF NOT EXISTS autonomy_log (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    plan_id         VARCHAR(64)    NULL DEFAULT NULL,
    decision_id     VARCHAR(64)    NULL DEFAULT NULL,
    execution_mode  VARCHAR(20)    NOT NULL DEFAULT 'blocked',
    executed_by     VARCHAR(20)    NOT NULL DEFAULT 'system',
    approved_by     INT            NULL DEFAULT NULL,
    confidence_score DECIMAL(5,2)  NULL DEFAULT NULL,
    impact_score    DECIMAL(5,2)   NULL DEFAULT NULL,
    result_status   VARCHAR(20)    NOT NULL DEFAULT 'pending_approval',
    result_summary  TEXT           NULL DEFAULT NULL,
    expires_at      DATETIME       NULL DEFAULT NULL,
    created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    executed_at     DATETIME       NULL DEFAULT NULL,
    INDEX idx_plan_id     (plan_id),
    INDEX idx_decision_id (decision_id),
    INDEX idx_mode        (execution_mode),
    INDEX idx_status      (result_status),
    INDEX idx_created     (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
";

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $pdo->exec($sql);

    // Verify
    $check = $pdo->query("SHOW TABLES LIKE 'autonomy_log'")->fetchColumn();

    // Self-delete after success
    @unlink(__FILE__);

    echo '<!DOCTYPE html><html><head>
    <style>body{font-family:monospace;background:#0f172a;color:#e2e8f0;padding:40px;max-width:600px}
    .ok{color:#22c55e;font-size:22px;font-weight:bold}
    .info{color:#94a3b8;font-size:13px;margin-top:12px;line-height:1.8}
    .box{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:20px;margin-top:20px}
    </style></head><body>';
    echo '<div class="ok">✓ Migration complete</div>';
    echo '<div class="box">';
    echo '<div class="info">Table: <b style="color:#60a5fa">autonomy_log</b> — ' . ($check ? 'EXISTS ✓' : 'NOT FOUND ✗') . '</div>';
    echo '<div class="info">This file has been deleted automatically.</div>';
    echo '<div class="info">Next: <a href="https://dashboard.bakudanramen.com/overview" style="color:#22c55e">Open Dashboard →</a></div>';
    echo '</div></body></html>';

} catch (Exception $e) {
    http_response_code(500);
    echo '<h2 style="color:red">Migration failed</h2><pre>' . htmlspecialchars($e->getMessage()) . '</pre>';
}
