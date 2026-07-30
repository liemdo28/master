<?php
/**
 * run_missing_migrations.php — Executes all missing migrations on production DB.
 * Token: MIGRATE_2026
 * Run: curl https://dashboard.bakudanramen.com/run_missing_migrations.php?token=MIGRATE_2026
 */
if (($_GET['token'] ?? '') !== 'MIGRATE_2026') { http_response_code(403); die('Forbidden'); }
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once __DIR__ . '/config/database.php';
$pdo = Database::getInstance()->getConnection();

function addCol($p, $t, $c, $sql) {
    $ex = $p->query("SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='$t' AND column_name='$c'")->fetch();
    if ($ex) return ['col'=>"$t.$c",'s'=>'EXISTS'];
    try { $p->exec($sql); return ['col'=>"$t.$c",'s'=>'ADDED']; }
    catch(Exception $e) { $m=$e->getMessage(); return ['col'=>"$t.$c",'s'=>stripos($m,'already')!==false?'EXISTS':'ERR','e'=>substr($m,0,150)]; }
}
function mkTbl($p, $n, $sql) {
    $ex = $p->query("SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='$n'")->fetch();
    if ($ex) return ['t'=>$n,'s'=>'EXISTS'];
    try { $p->exec($sql); return ['t'=>$n,'s'=>'CREATED']; }
    catch(Exception $e) { $m=$e->getMessage(); return ['t'=>$n,'s'=>stripos($m,'already')!==false?'EXISTS':'ERR','e'=>substr($m,0,150)]; }
}

$r=['ts'=>date('c'),'log'=>[]];

// penalties, penalty_config, penalty_log
$r['log'][]=mkTbl($pdo,'penalty_config',"CREATE TABLE penalty_config(id INT AUTO_INCREMENT PRIMARY KEY,penalty_amount DECIMAL(12,2) NOT NULL DEFAULT 500000,currency VARCHAR(10) NOT NULL DEFAULT 'VND',updated_by INT NULL,updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$r['log'][]=mkTbl($pdo,'penalty_log',"CREATE TABLE penalty_log(id INT AUTO_INCREMENT PRIMARY KEY,task_id INT NOT NULL,user_id INT NULL,penalty_amount DECIMAL(12,2) NOT NULL,currency VARCHAR(10) NOT NULL DEFAULT 'VND',reason VARCHAR(255) NOT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uniq_task_penalty(task_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$r['log'][]=mkTbl($pdo,'penalties',"CREATE TABLE penalties(id INT AUTO_INCREMENT PRIMARY KEY,task_id INT NOT NULL,user_id INT NULL,amount DECIMAL(12,2) NOT NULL DEFAULT 0,currency VARCHAR(10) NOT NULL DEFAULT 'VND',reason VARCHAR(255) NOT NULL,applied_at DATETIME NULL DEFAULT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,INDEX idx_penalties_task(task_id),INDEX idx_penalties_user(user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// obligations, obligation_payments, obligation_tasks
$r['log'][]=mkTbl($pdo,'obligations',"CREATE TABLE obligations(id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(255) NOT NULL,type ENUM('rent','utility','salary','vendor','tax','other') NOT NULL DEFAULT 'other',amount DECIMAL(12,2) NOT NULL DEFAULT 0,currency VARCHAR(10) NOT NULL DEFAULT 'VND',due_day INT NOT NULL DEFAULT 15,store_id INT NULL DEFAULT NULL,vendor_id INT NULL DEFAULT NULL,is_active TINYINT(1) NOT NULL DEFAULT 1,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_obligations_store(store_id),INDEX idx_obligations_vendor(vendor_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$r['log'][]=mkTbl($pdo,'obligation_payments',"CREATE TABLE obligation_payments(id INT AUTO_INCREMENT PRIMARY KEY,obligation_id INT NOT NULL,amount DECIMAL(12,2) NOT NULL,currency VARCHAR(10) NOT NULL DEFAULT 'VND',paid_at DATE NULL DEFAULT NULL,status ENUM('pending','paid','partial','late') NOT NULL DEFAULT 'pending',notes TEXT NULL DEFAULT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,INDEX idx_op_oblig(obligation_id),INDEX idx_op_status(status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$r['log'][]=mkTbl($pdo,'obligation_tasks',"CREATE TABLE obligation_tasks(obligation_id INT NOT NULL,task_id INT NOT NULL,PRIMARY KEY(obligation_id,task_id),INDEX idx_ot_task(task_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// employees, shifts, workflows
$r['log'][]=mkTbl($pdo,'employees',"CREATE TABLE employees(id INT AUTO_INCREMENT PRIMARY KEY,store_id INT NOT NULL,user_id INT NULL DEFAULT NULL,employee_id VARCHAR(50) NOT NULL,full_name VARCHAR(255) NOT NULL,role VARCHAR(100) NOT NULL DEFAULT 'staff',phone VARCHAR(30) DEFAULT NULL,email VARCHAR(255) DEFAULT NULL,is_active TINYINT(1) NOT NULL DEFAULT 1,hire_date DATE DEFAULT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY uk_employee_id(employee_id),INDEX idx_employees_store(store_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$r['log'][]=mkTbl($pdo,'shifts',"CREATE TABLE shifts(id INT AUTO_INCREMENT PRIMARY KEY,employee_id INT NOT NULL,store_id INT NOT NULL,shift_date DATE NOT NULL,start_time TIME NOT NULL,end_time TIME NOT NULL,role VARCHAR(100) NOT NULL DEFAULT 'staff',status ENUM('scheduled','confirmed','completed','absent') NOT NULL DEFAULT 'scheduled',notes TEXT NULL DEFAULT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,INDEX idx_shifts_employee(employee_id),INDEX idx_shifts_store(store_id),INDEX idx_shifts_date(shift_date)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$r['log'][]=mkTbl($pdo,'workflows',"CREATE TABLE workflows(id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(255) NOT NULL,trigger_type VARCHAR(50) NOT NULL,actions JSON NOT NULL,is_active TINYINT(1) NOT NULL DEFAULT 1,created_by INT NULL DEFAULT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_workflows_trigger(trigger_type)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// duplicate flags
$r['log'][]=mkTbl($pdo,'duplicate_task_flags',"CREATE TABLE duplicate_task_flags(id INT AUTO_INCREMENT PRIMARY KEY,canonical_task_id INT NOT NULL,duplicate_task_id INT NOT NULL,flagged_by INT NULL DEFAULT NULL,flagged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,status ENUM('pending','resolved','ignored') NOT NULL DEFAULT 'pending',resolved_by INT NULL DEFAULT NULL,resolved_at DATETIME NULL DEFAULT NULL,INDEX idx_dtf_canonical(canonical_task_id),INDEX idx_dtf_status(status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$r['log'][]=mkTbl($pdo,'duplicate_bill_flags',"CREATE TABLE duplicate_bill_flags(id INT AUTO_INCREMENT PRIMARY KEY,canonical_bill_id INT NOT NULL,duplicate_bill_id INT NOT NULL,flagged_by INT NULL DEFAULT NULL,flagged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,status ENUM('pending','resolved','ignored') NOT NULL DEFAULT 'pending',resolved_by INT NULL DEFAULT NULL,resolved_at DATETIME NULL DEFAULT NULL,INDEX idx_dbf_canonical(canonical_bill_id),INDEX idx_dbf_status(status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// remember_tokens
$r['log'][]=mkTbl($pdo,'remember_tokens',"CREATE TABLE remember_tokens(id INT AUTO_INCREMENT PRIMARY KEY,user_id INT NOT NULL,token VARCHAR(255) NOT NULL,expires_at DATETIME NOT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,INDEX idx_rt_user(user_id),INDEX idx_rt_token(token(64))) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// release governance tables
$r['log'][]=mkTbl($pdo,'release_drafts',"CREATE TABLE release_drafts(id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,release_id INT UNSIGNED NOT NULL,draft_key VARCHAR(100) NOT NULL,preview_url VARCHAR(500) DEFAULT NULL,qa_status ENUM('pending','running','passed','failed') NOT NULL DEFAULT 'pending',source_branch VARCHAR(255) DEFAULT NULL,source_commit VARCHAR(64) DEFAULT NULL,created_by INT UNSIGNED DEFAULT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY uk_release_drafts_release(release_id),UNIQUE KEY uk_release_drafts_key(draft_key),KEY idx_release_drafts_qa(qa_status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
$r['log'][]=mkTbl($pdo,'release_versions',"CREATE TABLE release_versions(id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,release_id INT UNSIGNED NOT NULL,version_label VARCHAR(100) NOT NULL,commit_hash VARCHAR(64) DEFAULT NULL,artifact_path VARCHAR(500) DEFAULT NULL,source_snapshot_path VARCHAR(500) DEFAULT NULL,db_snapshot_path VARCHAR(500) DEFAULT NULL,is_live TINYINT(1) NOT NULL DEFAULT 0,published_at DATETIME DEFAULT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,KEY idx_release_versions_release(release_id),KEY idx_release_versions_live(is_live,published_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
$r['log'][]=mkTbl($pdo,'release_approvals',"CREATE TABLE release_approvals(id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,release_id INT UNSIGNED NOT NULL,approver_id INT UNSIGNED DEFAULT NULL,approval_role VARCHAR(50) NOT NULL DEFAULT 'admin',status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',note TEXT DEFAULT NULL,approved_at DATETIME DEFAULT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,KEY idx_release_approvals_release(release_id,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
$r['log'][]=mkTbl($pdo,'release_schedule',"CREATE TABLE release_schedule(id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,release_id INT UNSIGNED NOT NULL,scheduled_for DATETIME NOT NULL,timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',scheduled_by INT UNSIGNED DEFAULT NULL,status ENUM('scheduled','running','published','cancelled','failed') NOT NULL DEFAULT 'scheduled',publish_started_at DATETIME DEFAULT NULL,publish_finished_at DATETIME DEFAULT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,KEY idx_release_schedule_release(release_id,status),KEY idx_release_schedule_due(status,scheduled_for)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

// penalty_assessments
$r['log'][]=mkTbl($pdo,'penalty_assessments',"CREATE TABLE penalty_assessments(id INT AUTO_INCREMENT PRIMARY KEY,task_id INT NOT NULL,assessed_by INT NOT NULL,penalty_amount DECIMAL(12,2) NOT NULL DEFAULT 0,currency VARCHAR(10) NOT NULL DEFAULT 'VND',overdue_days INT NOT NULL DEFAULT 0,reason VARCHAR(255) NOT NULL,status ENUM('assessed','waived','appealed','paid') NOT NULL DEFAULT 'assessed',assessed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,INDEX idx_pa_task(task_id),INDEX idx_pa_status(status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// MISSING COLUMNS on tasks
$r['log'][]=addCol($pdo,'tasks','submitted_by',"ALTER TABLE tasks ADD COLUMN submitted_by INT UNSIGNED NULL DEFAULT NULL AFTER approver_result_at");
$r['log'][]=addCol($pdo,'tasks','checked_by',"ALTER TABLE tasks ADD COLUMN checked_by INT UNSIGNED NULL DEFAULT NULL AFTER submitted_by");
$r['log'][]=addCol($pdo,'tasks','rejected_at',"ALTER TABLE tasks ADD COLUMN rejected_at DATETIME NULL DEFAULT NULL AFTER checked_by");
$r['log'][]=addCol($pdo,'tasks','rejected_by',"ALTER TABLE tasks ADD COLUMN rejected_by INT UNSIGNED NULL DEFAULT NULL AFTER rejected_at");
$r['log'][]=addCol($pdo,'tasks','rejection_reason',"ALTER TABLE tasks ADD COLUMN rejection_reason TEXT NULL DEFAULT NULL AFTER rejected_by");
$r['log'][]=addCol($pdo,'tasks','accepted_workflow_by',"ALTER TABLE tasks ADD COLUMN accepted_workflow_by INT UNSIGNED NULL DEFAULT NULL AFTER rejection_reason");
$r['log'][]=addCol($pdo,'tasks','reviewer_result',"ALTER TABLE tasks ADD COLUMN reviewer_result ENUM('pending','approved','rejected','needs_info') NULL DEFAULT NULL AFTER accepted_workflow_by");
$r['log'][]=addCol($pdo,'tasks','reviewer_result_at',"ALTER TABLE tasks ADD COLUMN reviewer_result_at DATETIME NULL DEFAULT NULL AFTER reviewer_result");
$r['log'][]=addCol($pdo,'tasks','approver_result',"ALTER TABLE tasks ADD COLUMN approver_result ENUM('pending','approved','rejected') NULL DEFAULT NULL AFTER reviewer_result_at");
$r['log'][]=addCol($pdo,'tasks','approver_result_at',"ALTER TABLE tasks ADD COLUMN approver_result_at DATETIME NULL DEFAULT NULL AFTER approver_result");
$r['log'][]=addCol($pdo,'tasks','reviewer_due_date',"ALTER TABLE tasks ADD COLUMN reviewer_due_date DATE NULL DEFAULT NULL AFTER approver_result_at");
$r['log'][]=addCol($pdo,'tasks','reviewer_assigned_at',"ALTER TABLE tasks ADD COLUMN reviewer_assigned_at DATETIME NULL DEFAULT NULL AFTER reviewer_due_date");
$r['log'][]=addCol($pdo,'tasks','reviewed_at',"ALTER TABLE tasks ADD COLUMN reviewed_at DATETIME NULL DEFAULT NULL AFTER reviewer_assigned_at");
$r['log'][]=addCol($pdo,'tasks','review_instructions',"ALTER TABLE tasks ADD COLUMN review_instructions TEXT NULL DEFAULT NULL AFTER reviewed_at");
$r['log'][]=addCol($pdo,'tasks','review_checklist',"ALTER TABLE tasks ADD COLUMN review_checklist JSON NULL DEFAULT NULL AFTER review_instructions");
$r['log'][]=addCol($pdo,'tasks','required_evidence',"ALTER TABLE tasks ADD COLUMN required_evidence TEXT NULL DEFAULT NULL AFTER review_checklist");
$r['log'][]=addCol($pdo,'tasks','required_files',"ALTER TABLE tasks ADD COLUMN required_files JSON NULL DEFAULT NULL AFTER required_evidence");
$r['log'][]=addCol($pdo,'tasks','task_category',"ALTER TABLE tasks ADD COLUMN task_category VARCHAR(100) NULL DEFAULT NULL AFTER required_files");
$r['log'][]=addCol($pdo,'tasks','bill_id',"ALTER TABLE tasks ADD COLUMN bill_id INT NULL DEFAULT NULL AFTER task_category");
$r['log'][]=addCol($pdo,'tasks','direct_store_id',"ALTER TABLE tasks ADD COLUMN direct_store_id INT UNSIGNED NULL DEFAULT NULL AFTER bill_id");

// Verify: count new tables
$newTables = ['release_drafts','release_versions','release_approvals','release_schedule','penalties','penalty_assessments','remember_tokens','obligations','obligation_payments','obligation_tasks','duplicate_task_flags','duplicate_bill_flags','employees','shifts','workflows'];
$created = 0; foreach ($newTables as $t) { $c=$pdo->query("SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='$t'")->fetchColumn(); if($c) $created++; }
$totalTables = $pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()")->fetchColumn();
$r['summary']=['new_tables_created'=>$created,'total_tables'=>$totalTables];
echo json_encode($r, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
