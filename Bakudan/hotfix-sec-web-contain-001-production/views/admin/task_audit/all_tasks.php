<?php
$pageTitle = 'All Tasks';
$currentPage = 'admin-task-audit';
ob_start();

$today = date('Y-m-d');
$priColors = ['urgent'=>'#dc2626','high'=>'#f59e0b','medium'=>'#3b82f6','low'=>'#71717a'];
$priLabels = ['urgent'=>'Urgent','high'=>'High','medium'=>'Medium','low'=>'Low'];
$statusLabels = ['todo'=>'To Do','in_progress'=>'In Progress','done'=>'Done','blocked'=>'Blocked'];
?>
<style>
.ta-filter-bar { background:var(--bg-secondary); border:1px solid var(--border); border-radius:14px; padding:16px; margin-bottom:18px; }
.ta-filter-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:10px; }
.ta-filter-group label { font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--text-muted); display:block; margin-bottom:4px; }
.ta-filter-group select,
.ta-filter-group input { width:100%; background:var(--bg-primary); border:1px solid var(--border); border-radius:8px; color:var(--text); padding:8px 10px; font-size:13px; }
.ta-filter-actions { display:flex; gap:8px; align-items:flex-end; margin-top:12px; }
.ta-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:18px; }
.ta-stat { border:1px solid var(--border); border-radius:12px; padding:16px; background:var(--bg-secondary); text-align:center; }
.ta-stat-label { font-size:11px; text-transform:uppercase; color:var(--text-muted); letter-spacing:.06em; margin-bottom:4px; }
.ta-stat-val { font-size:26px; font-weight:700; }
.ta-stat-total .ta-stat-val { color:var(--text); }
.ta-stat-open .ta-stat-val { color:#3b82f6; }
.ta-stat-overdue .ta-stat-val { color:#ef4444; }
.ta-stat-completed .ta-stat-val { color:#22c55e; }
.ta-table-wrap { border:1px solid var(--border); border-radius:14px; overflow:hidden; background:var(--bg-secondary); }
.ta-table { width:100%; border-collapse:collapse; font-size:13px; }
.ta-table thead th { padding:12px 14px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); border-bottom:1px solid var(--border); background:var(--bg-tertiary); }
.ta-table tbody tr { border-bottom:1px solid var(--border); transition:background .12s; }
.ta-table tbody tr:last-child { border-bottom:none; }
.ta-table tbody tr:hover { background:rgba(99,102,241,.04); }
.ta-table tbody td { padding:10px 14px; vertical-align:middle; }
.ta-task-title { font-weight:600; color:var(--text); text-decoration:none; }
.ta-task-title:hover { color:#6366f1; }
.ta-badge { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; }
.ta-badge-todo { background:rgba(113,113,122,.15); color:#d4d4d8; }
.ta-badge-in_progress { background:rgba(59,130,246,.15); color:#93c5fd; }
.ta-badge-done { background:rgba(34,197,94,.15); color:#86efac; }
.ta-badge-blocked { background:rgba(239,68,68,.15); color:#fca5a5; }
.ta-pri-urgent { background:#dc2626; color:#fff; }
.ta-pri-high { background:#f59e0b; color:#111; }
.ta-pri-medium { background:rgba(59,130,246,.2); color:#bfdbfe; }
.ta-pri-low { background:rgba(113,113,122,.15); color:#d4d4d8; }
.ta-overdue { color:#fca5a5; font-weight:600; }
.ta-today { color:#fcd34d; font-weight:600; }
.ta-empty { padding:48px 20px; text-align:center; color:var(--text-muted); }
.ta-empty .icon { font-size:40px; margin-bottom:12px; }
@media (max-width:768px) {
    .ta-filter-grid { grid-template-columns:1fr 1fr; }
    .ta-stats { grid-template-columns:repeat(2,1fr); }
    .ta-table-wrap { overflow-x:auto; }
}
</style>TEST APPEND
