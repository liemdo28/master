<?php
$pageTitle = 'Tasks by Store';
$currentPage = 'admin-task-audit';
ob_start();

$today = app_today();
$categories = ['payroll','tax','sale_receipt','bill','payment','store_operation','admin','other'];
$statusFilters = ['overdue','today','this_week','completed','open'];
$filterStore = isset($_GET['store']) ? (int)$_GET['store'] : null;
$filterCategory = $_GET['category'] ?? null;
$filterStatus = $_GET['filter'] ?? null;
?>

<style>
.bs-filter-bar{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:18px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}
.bs-filter-bar select{background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:7px 11px;font-size:13px}
.bs-filter-bar label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);display:block;margin-bottom:4px}
.bs-store-card{border:1px solid var(--border);border-radius:14px;margin-bottom:16px;background:var(--bg-secondary);overflow:hidden}
.bs-store-header{padding:14px 18px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;transition:background .12s}
.bs-store-header:hover{background:rgba(99,102,241,.06)}
.bs-store-name{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px}
.bs-store-dot{width:12px;height:12px;border-radius:4px;flex-shrink:0}
.bs-store-stats{display:flex;gap:8px;flex-wrap:wrap;font-size:12px}
.bs-stat-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04)}
.bs-stat-chip b{font-weight:700}
.bs-stat-open{color:#60a5fa}
.bs-stat-overdue{color:#f87171;background:rgba(248,113,113,.08);border-color:rgba(248,113,113,.2)}
.bs-stat-submitted{color:#fbbf24;background:rgba(251,191,36,.08);border-color:rgba(251,191,36,.2)}
.bs-stat-accepted{color:#a78bfa;background:rgba(167,139,250,.08);border-color:rgba(167,139,250,.2)}
.bs-stat-completed{color:#34d399;background:rgba(52,211,153,.08);border-color:rgba(52,211,153,.2)}
.bs-store-body{display:none;border-top:1px solid var(--border);padding:0}
.bs-store-body.open{display:block}
.bs-task-table{width:100%;border-collapse:collapse;font-size:13px}
.bs-task-table th{text-align:left;padding:10px 14px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);border-bottom:1px solid var(--border);background:var(--bg-primary)}
.bs-task-table td{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle}
.bs-task-table tr:last-child td{border-bottom:0}
.bs-task-table tr:hover{background:rgba(99,102,241,.04)}
.bs-task-title-link{color:var(--text);text-decoration:none;font-weight:600}
.bs-task-title-link:hover{color:var(--accent)}
