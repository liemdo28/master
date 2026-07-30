<?php
if (($_GET['token'] ?? '') !== 'SCHEMA_CHECK_2026') { http_response_code(403); die('Forbidden'); }
header('Content-Type: application/json');
require_once __DIR__ . '/config/database.php';
$db = Database::getInstance()->getConnection();
$cols = $db->query("SELECT column_name, ordinal_position FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='tasks' ORDER BY ordinal_position")->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($cols, JSON_PRETTY_PRINT);
