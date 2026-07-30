<?php
/** add_tasks_cols.php — Add 20 missing columns after assignment_notified_at */
if (($_GET['token'] ?? '') !== 'SCHEMA_CHECK_2026') { http_response_code(403); die('Forbidden'); }
header('Content-Type: application/json');
require_once __DIR__ . '/config/database.php';
$pdo = Database::getInstance()->getConnection();

function addC($p, $t, $c, $sql) {
    $ex = $p->query("SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='$t' AND column_name='$c'")->fetch();
    if ($ex) return ['col'=>"$t.$c",'s'=>'EXISTS'];
    try { $p->exec($sql); return ['col'=>"$t.$c",'s'=>'ADDED']; }
    catch(Exception $e) { $m=$e->getMessage(); return ['col'=>"$t.$c",'s'=>stripos($m,'already')!==false?'EXISTS':'ERR','e'=>substr($m,0,200)]; }
}

$after = 'assignment_notified_at';
$r=['ts'=>date('c'),'after'=>$after,'added'=>[]];
$r['added'][]=addC($pdo,'tasks','submitted_by',"ALTER TABLE tasks ADD COLUMN submitted_by INT UNSIGNED NULL DEFAULT NULL AFTER $after");
$r['added'][]=addC($pdo,'tasks','checked_by',"ALTER TABLE tasks ADD COLUMN checked_by INT UNSIGNED NULL DEFAULT NULL AFTER submitted_by");
$r['added'][]=addC($pdo,'tasks','rejected_at',"ALTER TABLE tasks ADD COLUMN rejected_at DATETIME NULL DEFAULT NULL AFTER checked_by");
$r['added'][]=addC($pdo,'tasks','rejected_by',"ALTER TABLE tasks ADD COLUMN rejected_by INT UNSIGNED NULL DEFAULT NULL AFTER rejected_at");
$r['added'][]=addC($pdo,'tasks','rejection_reason',"ALTER TABLE tasks ADD COLUMN rejection_reason TEXT NULL DEFAULT NULL AFTER rejected_by");
$r['added'][]=addC($pdo,'tasks','accepted_workflow_by',"ALTER TABLE tasks ADD COLUMN accepted_workflow_by INT UNSIGNED NULL DEFAULT NULL AFTER rejection_reason");
$r['added'][]=addC($pdo,'tasks','reviewer_result',"ALTER TABLE tasks ADD COLUMN reviewer_result ENUM('pending','approved','rejected','needs_info') NULL DEFAULT NULL AFTER accepted_workflow_by");
$r['added'][]=addC($pdo,'tasks','reviewer_result_at',"ALTER TABLE tasks ADD COLUMN reviewer_result_at DATETIME NULL DEFAULT NULL AFTER reviewer_result");
$r['added'][]=addC($pdo,'tasks','approver_result',"ALTER TABLE tasks ADD COLUMN approver_result ENUM('pending','approved','rejected') NULL DEFAULT NULL AFTER reviewer_result_at");
$r['added'][]=addC($pdo,'tasks','approver_result_at',"ALTER TABLE tasks ADD COLUMN approver_result_at DATETIME NULL DEFAULT NULL AFTER approver_result");
$r['added'][]=addC($pdo,'tasks','reviewer_due_date',"ALTER TABLE tasks ADD COLUMN reviewer_due_date DATE NULL DEFAULT NULL AFTER approver_result_at");
$r['added'][]=addC($pdo,'tasks','reviewer_assigned_at',"ALTER TABLE tasks ADD COLUMN reviewer_assigned_at DATETIME NULL DEFAULT NULL AFTER reviewer_due_date");
$r['added'][]=addC($pdo,'tasks','reviewed_at',"ALTER TABLE tasks ADD COLUMN reviewed_at DATETIME NULL DEFAULT NULL AFTER reviewer_assigned_at");
$r['added'][]=addC($pdo,'tasks','review_instructions',"ALTER TABLE tasks ADD COLUMN review_instructions TEXT NULL DEFAULT NULL AFTER reviewed_at");
$r['added'][]=addC($pdo,'tasks','review_checklist',"ALTER TABLE tasks ADD COLUMN review_checklist JSON NULL DEFAULT NULL AFTER review_instructions");
$r['added'][]=addC($pdo,'tasks','required_evidence',"ALTER TABLE tasks ADD COLUMN required_evidence TEXT NULL DEFAULT NULL AFTER review_checklist");
$r['added'][]=addC($pdo,'tasks','required_files',"ALTER TABLE tasks ADD COLUMN required_files JSON NULL DEFAULT NULL AFTER required_evidence");
$r['added'][]=addC($pdo,'tasks','task_category',"ALTER TABLE tasks ADD COLUMN task_category VARCHAR(100) NULL DEFAULT NULL AFTER required_files");
$r['added'][]=addC($pdo,'tasks','bill_id',"ALTER TABLE tasks ADD COLUMN bill_id INT NULL DEFAULT NULL AFTER task_category");
$r['added'][]=addC($pdo,'tasks','direct_store_id',"ALTER TABLE tasks ADD COLUMN direct_store_id INT UNSIGNED NULL DEFAULT NULL AFTER bill_id");
echo json_encode($r, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
