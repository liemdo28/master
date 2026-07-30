<?php
$secret = $_GET['key'] ?? '';
if ($secret !== 'phase14-audit-2026') { http_response_code(403); exit('forbidden'); }
header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__ . '/config/database.php';
$pdo = Database::getInstance()->getConnection();

$r = $pdo->query("SELECT COUNT(*) AS total, SUM(CASE WHEN category IS NULL OR category='' THEN 1 ELSE 0 END) AS uncategorized, SUM(CASE WHEN is_archived=1 THEN 1 ELSE 0 END) AS archived FROM bills");
$stats = $r->fetch();
echo "Active bills: " . ($stats['total'] - $stats['archived']) . "\n";
echo "Archived bills: {$stats['archived']}\n";
echo "Uncategorized (all): {$stats['uncategorized']}\n";

$r = $pdo->query("SELECT COUNT(*) AS cnt FROM bills WHERE (category IS NULL OR category='') AND (is_archived=0 OR is_archived IS NULL)");
$uncatActive = $r->fetch()['cnt'];
echo "Uncategorized ACTIVE: $uncatActive\n";
echo "VERDICT: " . ($uncatActive == 0 ? "PASS" : "FAIL") . "\n";
