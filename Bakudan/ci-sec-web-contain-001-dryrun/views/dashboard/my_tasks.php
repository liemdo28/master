<?php
$isRelatedView = !empty($isRelatedView);
$pageTitle   = $isRelatedView ? 'Related Tasks' : (!empty($viewingUser) ? e($viewingUser['name']) . ' — My Tasks' : 'My Tasks');
$currentPage = $isRelatedView ? 'related-tasks' : 'my-tasks';
ob_start();

$displayUser = $viewingUser ?? currentUser();
$firstName   = explode(' ', $displayUser['name'] ?? 'You')[0];
$today       = app_today();
$avatarColors = ['#7C3AED','#2563EB','#059669','#D97706','#DC2626','#0891B2'];
$avatarColor  = $avatarColors[crc32($displayUser['name'] ?? '') % count($avatarColors)];

$priColors = ['urgent'=>'#EF4444','high'=>'#F59E0B','medium'=>'#3B82F6','low'=>'#94A3B8'];
$priLabels = ['urgent'=>'Urgent','high'=>'High','medium'=>'Medium','low'=>'Low'];
$heroSummaryParts = [];
if (!empty($kpi['overdue'])) {
    $heroSummaryParts[] = (int)$kpi['overdue'] . ' overdue';
}
if (!empty($kpi['today'])) {
    $heroSummaryParts[] = (int)$kpi['today'] . ' due today';
}
$heroSummary = !empty($heroSummaryParts)
    ? 'You have ' . implode(', ', $heroSummaryParts) . '.'
    : (int)$kpi['total_open'] . ' open tasks · ' . (int)$kpi['completed'] . ' completed · ' . date('l, F j');
$kpi = array_merge([
    'overdue' => 0, 'today' => 0, 'this_week' => 0, 'in_progress' => 0,
    'completed' => 0, 'unscheduled' => 0, 'total_open' => 0, 'total_all' => 0,
    'completion_rate' => 0,
], $kpi ?? []);
$monthNav = $monthNav ?? [
    'label' => date('F Y'),
    'prev_url' => APP_URL . '/my-tasks?month=' . date('n', strtotime('-1 month')) . '&year=' . date('Y', strtotime('-1 month')),
    'next_url' => APP_URL . '/my-tasks?month=' . date('n', strtotime('+1 month')) . '&year=' . date('Y', strtotime('+1 month')),
    'today_url' => APP_URL . '/my-tasks',
];
$monthlyControl = $monthlyControl ?? ['summary' => ['total'=>0,'done'=>0,'open'=>0,'overdue'=>0,'completion_rate'=>0], 'types' => []];
?>
<style>
/* ═══════════════════════════════════════════════════════
   STAFF HOME — "My Work" design
   ═══════════════════════════════════════════════════════ */
.sw-wrap { max-width: 1200px; margin: 0 auto; padding: 0 0 48px; }

/* Hero */
.sw-hero {
    display: flex; align-items: center; gap: 16px;
    padding: 20px 0 24px;
    border-bottom: 1px solid var(--border, rgba(255,255,255,.08));
    margin-bottom: 24px;
}
.sw-hero-avatar {
    width: 48px; height: 48px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.sw-hero-info h1 { font-size: 22px; font-weight: 800; margin: 0; }
.sw-hero-info p  { font-size: 13px; color: var(--text-muted,#94A3B8); margin: 4px 0 0; }
.sw-hero-right { margin-left: auto; display: flex; gap: 8px; align-items: center; }

/* KPI strip */
.sw-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 24px;
}
@media(max-width:800px) { .sw-kpi-grid { grid-template-columns: repeat(2,1fr); } }
@media(max-width:480px) { .sw-kpi-grid { grid-template-columns: repeat(2,1fr); } }

.sw-kpi {
    background: var(--surface, #1E293B);
    border: 1px solid var(--border, rgba(255,255,255,.08));
    border-radius: 14px;
    padding: 16px;
    text-decoration: none;
    color: inherit;
    display: flex; flex-direction: column; justify-content: space-between;
    min-height: 110px;
    cursor: pointer;
    transition: .15s;
    border-left: 3px solid transparent;
}
.sw-kpi:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,0,0,.25); }
.sw-kpi-overdue  { border-left-color: #EF4444; }
.sw-kpi-today    { border-left-color: #F59E0B; }
.sw-kpi-week     { border-left-color: #8B5CF6; }
.sw-kpi-done     { border-left-color: #22C55E; }
.sw-kpi-label  { font-size: 11px; font-weight: 700; color: var(--text-muted,#94A3B8); text-transform: uppercase; letter-spacing: .07em; }
.sw-kpi-number { font-size: 36px; font-weight: 800; line-height: 1; margin: 8px 0 4px; }
.sw-kpi-sub    { font-size: 11px; color: var(--text-muted,#94A3B8); }
.sw-kpi-overdue .sw-kpi-number { color: #EF4444; }
.sw-kpi-today   .sw-kpi-number { color: #F59E0B; }
.sw-kpi-week    .sw-kpi-number { color: #8B5CF6; }
.sw-kpi-done    .sw-kpi-number { color: #22C55E; }

/* Main layout: task list + sidebar */
.sw-body {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 20px;
    align-items: start;
}
@media(max-width:900px) { .sw-body { grid-template-columns: 1fr; } }

/* Task group */
.sw-group { margin-bottom: 8px; }
.sw-group-header {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 0 8px;
    cursor: pointer;
    user-select: none;
    border-bottom: 1px solid var(--border, rgba(255,255,255,.06));
    margin-bottom: 4px;
}
.sw-group-header:hover { opacity: .85; }
.sw-group-label {
    font-size: 13px; font-weight: 700;
    flex: 1;
}
.sw-group-count {
    font-size: 11px; font-weight: 700; padding: 2px 8px;
    border-radius: 999px; background: rgba(255,255,255,.08); color: var(--text-muted,#94A3B8);
}
.sw-group-toggle { font-size: 11px; color: var(--text-muted,#94A3B8); flex-shrink: 0; }

.sw-task-list { display: flex; flex-direction: column; gap: 0; }
.sw-task-row {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px;
    background: var(--surface, #1E293B);
    border: 1px solid var(--border, rgba(255,255,255,.06));
    border-radius: 10px;
    margin-bottom: 4px;
    text-decoration: none;
    color: inherit;
    transition: .15s;
    position: relative;
    overflow: hidden;
}
.sw-task-row:hover { border-color: rgba(255,255,255,.15); background: rgba(255,255,255,.04); }
.sw-task-row.tr-overdue   { border-left: 3px solid #EF4444; }
.sw-task-row.tr-today     { border-left: 3px solid #F59E0B; }
.sw-task-row.tr-inprog    { border-left: 3px solid #3B82F6; }
.sw-task-row.tr-week      { border-left: 3px solid #8B5CF6; }
.sw-task-row.tr-completed { opacity: .45; }

.sw-task-check {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,.2);
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; cursor: pointer; transition: .15s;
}
.sw-task-check:hover { border-color: #22C55E; background: rgba(34,197,94,.15); }
.tr-completed .sw-task-check { background: rgba(34,197,94,.2); border-color: #22C55E; color: #22C55E; }

.sw-task-info { flex: 1; min-width: 0; }
.sw-task-title {
    font-size: 14px; font-weight: 600;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tr-completed .sw-task-title { text-decoration: line-through; }
.sw-task-meta  { font-size: 11px; color: var(--text-muted,#94A3B8); margin-top: 2px; display: flex; gap: 6px; flex-wrap: wrap; }
.sw-task-meta span { display: flex; align-items: center; gap: 3px; }

.sw-task-right { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }
.sw-pri {
    font-size: 10px; font-weight: 700; padding: 2px 7px;
    border-radius: 999px; text-transform: uppercase; letter-spacing: .05em;
}
.sw-due {
    font-size: 11px; font-weight: 700; white-space: nowrap;
}
.due-overdue { color: #EF4444; }
.due-today   { color: #F59E0B; }
.due-soon    { color: #8B5CF6; }
.due-future  { color: var(--text-muted,#94A3B8); }

/* Sidebar */
.sw-sidebar { display: flex; flex-direction: column; gap: 16px; }

.sw-side-card {
    background: var(--surface, #1E293B);
    border: 1px solid var(--border, rgba(255,255,255,.08));
    border-radius: 14px;
    padding: 18px;
}
.sw-side-title {
    font-size: 12px; font-weight: 700; color: var(--text-muted,#94A3B8);
    text-transform: uppercase; letter-spacing: .07em; margin-bottom: 12px;
}

/* Help panel */
.sw-help-item {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border, rgba(255,255,255,.05));
    font-size: 13px;
}
.sw-help-item:last-child { border-bottom: none; padding-bottom: 0; }
.sw-help-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
.sw-help-label { font-weight: 700; color: var(--text,#F1F5F9); }
.sw-help-desc  { color: var(--text-muted,#94A3B8); font-size: 12px; margin-top: 2px; }

/* Quick actions */
.sw-qa-btn {
    display: flex; align-items: center; gap: 8px;
    padding: 9px 12px; border-radius: 8px;
    background: rgba(255,255,255,.05);
    border: 1px solid var(--border, rgba(255,255,255,.08));
    color: var(--text,#F1F5F9); font-size: 13px; font-weight: 600;
    text-decoration: none; transition: .15s; width: 100%; margin-bottom: 6px;
    cursor: pointer;
}
.sw-qa-btn:hover { background: rgba(255,255,255,.09); }
.sw-qa-btn:last-child { margin-bottom: 0; }

/* Buttons */
.sw-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
    text-decoration: none; border: none; cursor: pointer; transition: .15s;
}
.sw-btn-primary { background: #2563EB; color: #fff; }
.sw-btn-ghost   { background: rgba(255,255,255,.06); color: var(--text,#F1F5F9); border: 1px solid var(--border,rgba(255,255,255,.1)); }

/* ── Focus Card — #1 Action ── */
.sw-focus-card {
    background: linear-gradient(135deg, rgba(239,68,68,.1) 0%, rgba(239,68,68,.03) 100%);
    border: 1px solid rgba(239,68,68,.28);
    border-left: 4px solid #EF4444;
    border-radius: 16px;
    padding: 20px 24px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 20px;
    animation: slideUp .3s ease;
}
.sw-focus-card.focus-today {
    background: linear-gradient(135deg, rgba(245,158,11,.08) 0%, rgba(245,158,11,.02) 100%);
    border-color: rgba(245,158,11,.28);
    border-left-color: #F59E0B;
}
.sw-focus-emoji { font-size: 32px; flex-shrink: 0; line-height: 1; }
.sw-focus-body  { flex: 1; min-width: 0; }
.sw-focus-label {
    font-size: 10px; font-weight: 800; letter-spacing: .1em;
    text-transform: uppercase; color: #EF4444; margin-bottom: 5px;
}
.sw-focus-card.focus-today .sw-focus-label { color: #F59E0B; }
.sw-focus-title { font-size: 18px; font-weight: 800; line-height: 1.25; margin-bottom: 6px; color: var(--text,#F1F5F9); }
.sw-focus-meta  { font-size: 12px; color: var(--text-muted,#94A3B8); }
.sw-focus-actions { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }
@media(max-width:600px) { .sw-focus-card { flex-wrap: wrap; } .sw-focus-actions { width: 100%; } }
/* Tab navigation */
.sw-tabs { display:flex; gap:4px; margin-bottom:16px; border-bottom:1px solid var(--border,rgba(255,255,255,.08)); padding-bottom:0; overflow-x:auto; flex-wrap:nowrap; }
.sw-tab { background:none; border:none; color:var(--text-muted,#94A3B8); font-size:13px; font-weight:600; padding:8px 14px; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; white-space:nowrap; transition:.15s; }
.sw-tab:hover { color:var(--text,#F1F5F9); }
.sw-tab.active { color:var(--accent,#6366f1); border-bottom-color:var(--accent,#6366f1); }
.sw-month-panel {
    background: var(--surface, #1E293B);
    border: 1px solid var(--border, rgba(255,255,255,.08));
    border-radius: 14px;
    padding: 14px;
    margin-bottom: 16px;
}
.sw-month-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px; flex-wrap:wrap; }
.sw-month-title { font-size:14px; font-weight:800; color:var(--text,#F1F5F9); }
.sw-month-nav { display:flex; gap:6px; align-items:center; }
.sw-month-chip {
    display:inline-flex; align-items:center; gap:5px;
    border:1px solid var(--border,rgba(255,255,255,.1));
    background:rgba(255,255,255,.04);
    color:var(--text,#F1F5F9);
    text-decoration:none;
    border-radius:8px;
    padding:6px 10px;
    font-size:12px;
    font-weight:700;
}
.sw-month-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:12px; }
.sw-month-stat { border:1px solid rgba(255,255,255,.07); background:rgba(15,23,42,.55); border-radius:10px; padding:9px 10px; }
.sw-month-stat strong { display:block; font-size:20px; line-height:1; color:var(--text,#F1F5F9); }
.sw-month-stat span { display:block; margin-top:4px; font-size:10px; color:var(--text-muted,#94A3B8); text-transform:uppercase; letter-spacing:.06em; }
.sw-type-table { display:flex; flex-direction:column; gap:6px; }
.sw-type-row {
    display:grid;
    grid-template-columns:minmax(160px,1.2fr) 90px 90px minmax(180px,1fr) 96px;
    gap:10px; align-items:center;
    border:1px solid rgba(255,255,255,.07);
    background:rgba(255,255,255,.03);
    border-radius:10px;
    padding:10px 12px;
}
.sw-type-name { font-size:13px; font-weight:800; color:var(--text,#F1F5F9); }
.sw-type-sub { font-size:11px; color:var(--text-muted,#94A3B8); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sw-type-metric { font-size:12px; color:var(--text-muted,#94A3B8); }
.sw-type-metric strong { color:var(--text,#F1F5F9); font-size:14px; }
.sw-type-status { font-size:12px; font-weight:800; text-align:right; }
.sw-type-status.done { color:#22C55E; }
.sw-type-status.open { color:#8B5CF6; }
.sw-type-status.overdue { color:#EF4444; }
@media(max-width:760px) {
    .sw-month-stats { grid-template-columns:repeat(2,1fr); }
    .sw-type-row { grid-template-columns:1fr; gap:5px; }
    .sw-type-status { text-align:left; }
}

/* ── Penalty styles ── */
.sw-penalty-banner {
    background: linear-gradient(135deg, rgba(239,68,68,.1) 0%, rgba(239,68,68,.04) 100%);
    border: 1px solid rgba(239,68,68,.3); border-left: 4px solid #EF4444;
    border-radius: 14px; padding: 16px 20px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; margin-bottom: 20px; flex-wrap: wrap;
}
.sw-penalty-banner-left { display: flex; align-items: center; gap: 12px; }
.sw-penalty-icon { font-size: 24px; flex-shrink: 0; }
.sw-penalty-label { font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #EF4444; margin-bottom: 3px; }
.sw-penalty-amount { font-size: 24px; font-weight: 800; color: #EF4444; line-height: 1; }
.sw-penalty-sub { font-size: 11px; color: var(--text-muted,#94A3B8); margin-top: 2px; }
.sw-penalty-chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700;
    background: rgba(239,68,68,.15); color: #EF4444; white-space: nowrap;
}
</style>

<div class="sw-wrap">

    <!-- ── Hero ── -->
    <div class="sw-hero">
        <div class="sw-hero-avatar" style="background:<?= $avatarColor ?>">
            <?= strtoupper(mb_substr($displayUser['name'] ?? 'U', 0, 1)) ?>
        </div>
        <div class="sw-hero-info">
            <h1>
                <?php if ($viewingUser): ?>
                <?= e($displayUser['name']) ?>'s Work
                <?php else: ?>
                Good <?= date('H') < 12 ? 'morning' : (date('H') < 17 ? 'afternoon' : 'evening') ?>, <?= e($firstName) ?>
                <?php endif; ?>
            </h1>
            <p>
                <?php if (!empty($heroSummaryParts)): ?>
                <span style="color:#EF4444;font-weight:600"><?= tf_icon('zap') ?> <?= e($heroSummary) ?></span>
                <?php else: ?>
                <?= e($heroSummary) ?>
                <?php endif; ?>
            </p>
        </div>
        <div class="sw-hero-right">
            <?php if (isAdmin() && !$viewingUser): ?>
            <a href="<?= APP_URL ?>/overview/member/<?= (int)($_SESSION['user_id']) ?>" class="sw-btn sw-btn-ghost"><?= tf_icon('trending-up') ?> Full Portfolio</a>
            <?php endif; ?>
            <?php if (isAdmin()): ?>
            <a href="<?= APP_URL ?>/overview" class="sw-btn sw-btn-ghost"><?= tf_icon('building') ?> Team View</a>
            <?php endif; ?>
        </div>
    </div>

    <!-- ── Focus Card: #1 Action Right Now ── -->
    <?php
    $focusTask = null; $focusType = 'overdue';
    if (!empty($orderedGroups['overdue']['tasks']))      { $focusTask = $orderedGroups['overdue']['tasks'][0]; $focusType = 'overdue'; }
    elseif (!empty($orderedGroups['today']['tasks']))    { $focusTask = $orderedGroups['today']['tasks'][0];   $focusType = 'today'; }
    if ($focusTask):
        $daysLate = ($focusType === 'overdue' && !empty($focusTask['due_date']))
            ? max(0, (int)((strtotime(app_today()) - strtotime(substr($focusTask['due_date'],0,10))) / 86400))
            : 0;
    ?>
    <div class="sw-focus-card<?= $focusType === 'today' ? ' focus-today' : '' ?>" id="focus-card">
        <div class="sw-focus-emoji"><?= $focusType === 'overdue' ? tf_icon('alert-circle', 32) : tf_icon('target', 32) ?></div>
        <div class="sw-focus-body">
            <div class="sw-focus-label">
                <?php if ($focusType === 'overdue'): ?>
                    <?= $daysLate > 0 ? $daysLate . ' day' . ($daysLate > 1 ? 's' : '') . ' overdue — act now' : 'Overdue — act now' ?>
                <?php else: ?>
                    Due today — your focus right now
                <?php endif; ?>
            </div>
            <div class="sw-focus-title"><?= e($focusTask['title']) ?></div>
            <div class="sw-focus-meta">
                <?php if (!empty($focusTask['store_name'])): ?><?= tf_icon('building') ?> <?= e($focusTask['store_name']) ?><?php endif; ?>
                <?php if (!empty($focusTask['project_name'])): ?> · <?= tf_icon('folder') ?> <?= e($focusTask['project_name']) ?><?php endif; ?>
                <?php if (!empty($focusTask['priority']) && $focusTask['priority'] !== 'medium'): ?>
                 · <strong style="color:<?= $priColors[$focusTask['priority']] ?? '#94A3B8' ?>"><?= $priLabels[$focusTask['priority']] ?? '' ?></strong>
                <?php endif; ?>
            </div>
        </div>
        <div class="sw-focus-actions">
            <button data-focus-complete-task="<?= (int)$focusTask['id'] ?>"
                    class="sw-btn sw-btn-primary" id="focus-complete-btn"
                    style="font-size:13px;padding:10px 18px;min-height:40px">
                <?= tf_icon('check') ?> Mark Done
            </button>
            <a href="<?= APP_URL ?>/tasks/<?= (int)$focusTask['id'] ?>" class="sw-btn sw-btn-ghost" data-detail-drawer>→ Details</a>
        </div>
    </div>
    <?php endif; ?>

    <!-- ── Penalty Banner (only shown to penalized members / admin viewing penalized member) ── -->
    <?php if (!empty($penaltyData)): ?>
    <?php
    $pTotal   = (float)($penaltyData['total_amount'] ?? 0);
    $pCount   = (int)($penaltyData['late_count'] ?? 0);
    $pPerTask = (float)($penaltyData['config']['amount_per_late_task'] ?? 0);
    $pFmt     = function(float $v): string { return number_format($v, 0, ',', '.') . 'đ'; };
    ?>
    <div class="sw-penalty-banner">
        <div class="sw-penalty-banner-left">
            <div class="sw-penalty-icon"><?= tf_icon('alert-octagon', 24) ?></div>
            <div>
                <div class="sw-penalty-label">Tiền phạt deadline</div>
                <div class="sw-penalty-amount">-<?= $pFmt($pTotal) ?></div>
                <div class="sw-penalty-sub">
                    <?= $pCount ?> task trễ &times; <?= $pFmt($pPerTask) ?>/task
                    <?php if (isAdmin() && !empty($viewingUser)): ?>
                    &nbsp;·&nbsp; <strong><?= e($viewingUser['name']) ?></strong>
                    <?php endif; ?>
                </div>
            </div>
        </div>
        <?php if (isAdmin()): ?>
        <a href="<?= APP_URL ?>/admin/penalty" class="sw-btn sw-btn-ghost" style="font-size:12px">
            <?= tf_icon('settings') ?> Quản lý phạt
        </a>
        <?php endif; ?>
    </div>
    <?php endif; ?>

    <!-- ── KPI Cards ── -->
    <div class="sw-kpi-grid">
        <a href="#bucket-overdue" class="sw-kpi sw-kpi-overdue">
            <span class="sw-kpi-label"><?= tf_icon('alert-circle') ?> Overdue</span>
            <span class="sw-kpi-number"><?= $kpi['overdue'] ?></span>
            <span class="sw-kpi-sub"><?= $kpi['overdue'] > 0 ? 'Needs immediate action' : 'All clear!' ?></span>
        </a>
        <a href="#bucket-today" class="sw-kpi sw-kpi-today">
            <span class="sw-kpi-label"><?= tf_icon('alert-triangle') ?> Due Today</span>
            <span class="sw-kpi-number"><?= $kpi['today'] ?></span>
            <span class="sw-kpi-sub"><?= $kpi['today'] > 0 ? 'Focus on these first' : 'Nothing due today' ?></span>
        </a>
        <a href="#bucket-this_week" class="sw-kpi sw-kpi-week">
            <span class="sw-kpi-label"><?= tf_icon('calendar') ?> This Week</span>
            <span class="sw-kpi-number"><?= $kpi['this_week'] ?></span>
            <span class="sw-kpi-sub">Due in next 7 days</span>
        </a>
        <div class="sw-kpi sw-kpi-done">
            <span class="sw-kpi-label"><?= tf_icon('check-circle') ?> Completed</span>
            <span class="sw-kpi-number"><?= $kpi['completed'] ?></span>
            <span class="sw-kpi-sub"><?= $kpi['total_open'] + $kpi['completed'] > 0 ? round($kpi['completed'] / ($kpi['total_open'] + $kpi['completed']) * 100) : 0 ?>% completion rate</span>
        </div>
    </div>

    <!-- ── Monthly Task Control ── -->
    <div class="sw-month-panel">
        <div class="sw-month-head">
            <div>
                <div class="sw-month-title"><?= tf_icon('calendar-days') ?> Task by Month — <?= e($monthNav['label'] ?? date('F Y')) ?></div>
                <div style="font-size:12px;color:var(--text-muted,#94A3B8);margin-top:3px">Review Yelp / Google, DoorDash, finance checks by store and due month.</div>
            </div>
            <div class="sw-month-nav">
                <a class="sw-month-chip" href="<?= e($monthNav['prev_url']) ?>">‹ Prev</a>
                <a class="sw-month-chip" href="<?= e($monthNav['today_url']) ?>">This Month</a>
                <a class="sw-month-chip" href="<?= e($monthNav['next_url']) ?>">Next ›</a>
            </div>
        </div>
        <?php $mSummary = $monthlyControl['summary'] ?? ['total'=>0,'done'=>0,'open'=>0,'overdue'=>0,'completion_rate'=>0]; ?>
        <div class="sw-month-stats">
            <div class="sw-month-stat"><strong><?= (int)$mSummary['total'] ?></strong><span>Total This Month</span></div>
            <div class="sw-month-stat"><strong><?= (int)$mSummary['done'] ?></strong><span>Done</span></div>
            <div class="sw-month-stat"><strong><?= (int)$mSummary['open'] ?></strong><span>Open</span></div>
            <div class="sw-month-stat"><strong><?= (int)$mSummary['completion_rate'] ?>%</strong><span>Month Complete</span></div>
        </div>
        <?php if (empty($monthlyControl['types'])): ?>
            <div style="padding:12px;color:var(--text-muted,#94A3B8);font-size:13px">No tracked recurring task types due in this month.</div>
        <?php else: ?>
            <div class="sw-type-table">
                <?php foreach ($monthlyControl['types'] as $type): ?>
                <?php
                    $statusClass = $type['overdue'] > 0 ? 'overdue' : ($type['open'] > 0 ? 'open' : 'done');
                    $statusText = $type['overdue'] > 0
                        ? $type['overdue'] . ' overdue'
                        : ($type['open'] > 0 ? ('Next ' . date('M j', strtotime($type['next_due']))) : 'All done');
                ?>
                <div class="sw-type-row">
                    <div>
                        <div class="sw-type-name"><?= e($type['label']) ?></div>
                        <div class="sw-type-sub"><?= e(implode(', ', array_slice($type['stores'], 0, 6))) ?><?= count($type['stores']) > 6 ? ' +' . (count($type['stores']) - 6) : '' ?></div>
                    </div>
                    <div class="sw-type-metric"><strong><?= (int)$type['store_count'] ?></strong><br>stores</div>
                    <div class="sw-type-metric"><strong><?= (int)$type['done'] ?>/<?= (int)$type['total'] ?></strong><br>done</div>
                    <div class="sw-type-metric"><strong><?= (int)$type['completion_rate'] ?>%</strong><br>complete</div>
                    <div class="sw-type-status <?= $statusClass ?>"><?= e($statusText) ?></div>
                </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>

    <!-- ── Tab Navigation ── -->
    <div class="sw-tabs" id="swTabs">
        <button class="sw-tab active" data-tab="all" onclick="swSwitchTab(this,'all')">All (<?= (int)($kpi['total_all'] ?? 0) ?>)</button>
        <button class="sw-tab" data-tab="today" onclick="swSwitchTab(this,'today')">Today (<?= (int)$kpi['today'] ?>)</button>
        <button class="sw-tab" data-tab="upcoming" onclick="swSwitchTab(this,'upcoming')">Upcoming (<?= (int)($kpi['this_week'] + ($kpi['unscheduled'] ?? 0)) ?>)</button>
        <button class="sw-tab" data-tab="overdue" onclick="swSwitchTab(this,'overdue')">🔴 Overdue (<?= (int)$kpi['overdue'] ?>)</button>
        <button class="sw-tab" data-tab="completed" onclick="swSwitchTab(this,'completed')">✓ Completed (<?= (int)$kpi['completed'] ?> · <?= (int)($kpi['completion_rate'] ?? 0) ?>%)</button>
        <button class="sw-tab" data-tab="private" onclick="swSwitchTab(this,'private')">🔒 Private</button>
        <button class="sw-tab" data-tab="public" onclick="swSwitchTab(this,'public')">🌐 Public</button>
    </div>

    <!-- ── Body: Task List + Sidebar ── -->
    <div class="sw-body">

        <!-- Task Groups -->
        <div>
            <?php if (empty($orderedGroups)): ?>
            <div style="text-align:center;padding:48px 0;color:var(--text-muted)">
                <div style="margin-bottom:12px"><?= tf_icon('check-circle-2', 48) ?></div>
                <div style="font-size:18px;font-weight:700;margin-bottom:6px">All caught up!</div>
                <div style="font-size:14px">No tasks assigned to you right now.</div>
            </div>
            <?php endif; ?>

            <?php foreach ($orderedGroups as $bucketKey => $group): ?>
            <?php
                $meta     = $group['meta'];
                $tasks    = $group['tasks'];
                $isCompleted = $bucketKey === 'completed';
                $collapsed   = $isCompleted; // completed is collapsed by default
            ?>
            <div class="sw-group" id="bucket-<?= e($bucketKey) ?>">
                <div class="sw-group-header" onclick="swToggle(this)">
                    <span class="sw-group-label" style="color:<?= e($meta['color']) ?>"><?= e($meta['label']) ?></span>
                    <span class="sw-group-count"><?= count($tasks) ?></span>
                    <span class="sw-group-toggle"><?= $collapsed ? '▶' : '▼' ?></span>
                </div>
                <div class="sw-task-list" <?= $collapsed ? 'style="display:none"' : '' ?>>
                    <?php foreach ($tasks as $t): ?>
                    <?php
                        $d = !empty($t['due_date']) ? substr($t['due_date'],0,10) : null;
                        $isOverdue   = $d && $d < $today && empty($t['is_completed']);
                        $isDueToday  = $d && $d === $today;
                        $pri         = $t['priority'] ?? 'medium';
                        $rowClass    = '';
                        if (!empty($t['is_completed']))         $rowClass = 'tr-completed';
                        elseif ($isOverdue)                     $rowClass = 'tr-overdue';
                        elseif ($isDueToday)                    $rowClass = 'tr-today';
                        elseif (($t['status']??'') === 'in_progress') $rowClass = 'tr-inprog';
                        elseif ($d && $d <= date('Y-m-d', strtotime(app_today() . ' +7 days'))) $rowClass = 'tr-week';

                        $taskIp = IconPresenter::forTask($t);

                        if ($d) {
                            $dTs = strtotime($d);
                            $now = strtotime($today);
                            $diff = (int)(($dTs - $now) / 86400);
                            if ($isOverdue)       { $dueStr = abs($diff) . 'd overdue'; $dueClass = 'due-overdue'; }
                            elseif ($isDueToday)  { $dueStr = 'Today'; $dueClass = 'due-today'; }
                            elseif ($diff <= 7)   { $dueStr = 'In ' . $diff . 'd'; $dueClass = 'due-soon'; }
                            else                  { $dueStr = date('M j', $dTs); $dueClass = 'due-future'; }
                        } else { $dueStr = '—'; $dueClass = 'due-future'; }
                    ?>
                    <a href="<?= APP_URL ?>/tasks/<?= (int)$t['id'] ?>" class="sw-task-row sw-task-item <?= $rowClass ?>" data-detail-drawer data-visibility="<?= e($t['visibility'] ?? 'private') ?>">
                        <div class="sw-task-check"><?= !empty($t['is_completed']) ? tf_icon('check') : '' ?></div>
                        <span title="<?= e($taskIp['label']) ?>"
                              style="font-size:16px;flex-shrink:0;line-height:1;opacity:<?= !empty($t['is_completed']) ? '.4' : '1' ?>"><?= $taskIp['icon'] ?></span>
                        <div class="sw-task-info">
                            <div class="sw-task-title" style="<?= ($isOverdue && empty($t['is_completed'])) ? 'color:#FCA5A5' : ($isDueToday && empty($t['is_completed']) ? 'color:#FCD34D' : '') ?>"><?= e($t['title']) ?></div>
                            <div class="sw-task-meta">
                                <?php if (!empty($t['project_name'])): ?>
                                <span style="color:<?= e($t['project_color'] ?? '#94A3B8') ?>">●</span>
                                <span><?= e($t['project_name']) ?></span>
                                <?php endif; ?>
                                <?php if (!empty($t['store_name'])): ?>
                                <span>·</span><span><?= tf_icon('building') ?> <?= e($t['store_name']) ?></span>
                                <?php endif; ?>
                                <?php if (($t['repeat_type']??'none') !== 'none'): ?>
                                <span>·</span><span><?= tf_icon('refresh-cw') ?> Recurring</span>
                                <?php endif; ?>
                            </div>
                        </div>
                        <div class="sw-task-right">
                            <?php if ($pri !== 'medium'): ?>
                            <span class="sw-pri" style="background:<?= $priColors[$pri] ?? '#64748B' ?>22;color:<?= $priColors[$pri] ?? '#94A3B8' ?>">
                                <?= $priLabels[$pri] ?? ucfirst($pri) ?>
                            </span>
                            <?php endif; ?>
                            <?php if (!empty($penaltyData) && $isOverdue): ?>
                            <span class="sw-penalty-chip">-<?= number_format((float)($penaltyData['config']['amount_per_late_task'] ?? 0), 0, ',', '.') ?>đ</span>
                            <?php endif; ?>
                            <span class="sw-due <?= $dueClass ?>"><?= $dueStr ?></span>
                        </div>
                    </a>
                    <?php endforeach; ?>
                    <?php if ($isCompleted && count($group['tasks']) >= 20): ?>
                    <div style="text-align:center;padding:10px;font-size:12px;color:var(--text-muted)">
                        Showing last 20 completed. <a href="<?= APP_URL ?>/overview/member/<?= (int)($_SESSION['user_id']) ?>" style="color:#3B82F6">View full history →</a>
                    </div>
                    <?php endif; ?>
                </div>
            </div>
            <?php endforeach; ?>
        </div>

        <!-- Sidebar -->
        <div class="sw-sidebar">

            <!-- Quick Actions -->
            <div class="sw-side-card">
                <div class="sw-side-title">Quick Actions</div>
                <a href="<?= APP_URL ?>/projects" class="sw-qa-btn"><?= tf_icon('clipboard-list') ?> Browse All Projects</a>
                <a href="<?= APP_URL ?>/bills" class="sw-qa-btn"><?= tf_icon('credit-card') ?> Payment Schedule</a>
                <a href="<?= APP_URL ?>/overview/member/<?= (int)($_SESSION['user_id']) ?>" class="sw-qa-btn"><?= tf_icon('trending-up') ?> My Portfolio</a>
                <?php if (isAdmin() || isManager()): ?>
                <a href="<?= APP_URL ?>/ceo" class="sw-qa-btn"><?= tf_icon('building') ?> CEO Dashboard</a>
                <a href="<?= APP_URL ?>/team" class="sw-qa-btn"><?= tf_icon('users') ?> Team View</a>
                <?php endif; ?>
            </div>

            <!-- Status summary -->
            <?php if ($kpi['in_progress'] > 0 || $kpi['unscheduled'] > 0): ?>
            <div class="sw-side-card">
                <div class="sw-side-title">Also</div>
                <?php if ($kpi['in_progress']): ?>
                <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border,rgba(255,255,255,.06));font-size:13px">
                    <span><?= tf_icon('activity') ?> In Progress</span><strong><?= $kpi['in_progress'] ?></strong>
                </div>
                <?php endif; ?>
                <?php if ($kpi['unscheduled']): ?>
                <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:13px">
                    <span>— No Due Date</span><strong><?= $kpi['unscheduled'] ?></strong>
                </div>
                <?php endif; ?>
            </div>
            <?php endif; ?>

            <!-- Penalty Summary (only for penalized members / admin viewing them) -->
            <?php if (!empty($penaltyData)): ?>
            <div class="sw-side-card" style="border-left: 3px solid #EF4444;">
                <div class="sw-side-title" style="color:#EF4444"><?= tf_icon('alert-octagon') ?> Tiền phạt của bạn</div>
                <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border,rgba(255,255,255,.06));font-size:13px">
                    <span><?= tf_icon('clock') ?> Task trễ</span>
                    <strong><?= (int)($penaltyData['late_count'] ?? 0) ?> task</strong>
                </div>
                <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border,rgba(255,255,255,.06));font-size:13px">
                    <span><?= tf_icon('tag') ?> Mức phạt/task</span>
                    <strong><?= number_format((float)($penaltyData['config']['amount_per_late_task'] ?? 0), 0, ',', '.') ?>đ</strong>
                </div>
                <div style="display:flex;justify-content:space-between;padding:10px 0 4px;font-size:14px">
                    <span style="font-weight:700">Tổng phạt</span>
                    <strong style="color:#EF4444;font-size:16px">-<?= number_format((float)($penaltyData['total_amount'] ?? 0), 0, ',', '.') ?>đ</strong>
                </div>
                <?php if (isAdmin()): ?>
                <a href="<?= APP_URL ?>/admin/penalty" style="display:block;margin-top:10px;font-size:12px;color:#3B82F6;text-decoration:none">
                    <?= tf_icon('settings') ?> Quản lý cấu hình phạt →
                </a>
                <?php endif; ?>
            </div>
            <?php endif; ?>

            <!-- How this system works -->
            <div class="sw-side-card">
                <div class="sw-side-title"><?= tf_icon('info') ?> How This System Works</div>
                <div class="sw-help-item">
                    <span class="sw-help-icon"><?= tf_icon('credit-card') ?></span>
                    <div>
                        <div class="sw-help-label">Bills</div>
                        <div class="sw-help-desc">Recurring payments to vendors — rent, utilities, tax. Managed in the Bills section.</div>
                    </div>
                </div>
                <div class="sw-help-item">
                    <span class="sw-help-icon"><?= tf_icon('check-circle') ?></span>
                    <div>
                        <div class="sw-help-label">Tasks</div>
                        <div class="sw-help-desc">Work items assigned to you. Complete them here or inside the project view.</div>
                    </div>
                </div>
                <div class="sw-help-item">
                    <span class="sw-help-icon"><?= tf_icon('building') ?></span>
                    <div>
                        <div class="sw-help-label">Businesses</div>
                        <div class="sw-help-desc">Each store or brand (Heo, Raw Stockton, etc.) groups its own tasks and bills.</div>
                    </div>
                </div>
                <div class="sw-help-item">
                    <span class="sw-help-icon"><?= tf_icon('store') ?></span>
                    <div>
                        <div class="sw-help-label">Vendors</div>
                        <div class="sw-help-desc">Companies you pay — PG&E, CDTFA, landlord. Bills are linked to vendors.</div>
                    </div>
                </div>
                <div class="sw-help-item">
                    <span class="sw-help-icon"><?= tf_icon('refresh-cw') ?></span>
                    <div>
                        <div class="sw-help-label">Recurring</div>
                        <div class="sw-help-desc">Monthly/weekly tasks and bills auto-generate on schedule. Don't create duplicates.</div>
                    </div>
                </div>
            </div>

        </div><!-- /.sw-sidebar -->
    </div><!-- /.sw-body -->
</div><!-- /.sw-wrap -->

<script>
// ── Tab switching ───────────────────────────────────────────────────────────
function swSwitchTab(btn, tab) {
    document.querySelectorAll('.sw-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    var groups = document.querySelectorAll('.sw-group');
    groups.forEach(function(g) {
        var key = g.id.replace('bucket-', '');
        if (tab === 'all') {
            g.style.display = '';
        } else if (tab === 'private' || tab === 'public') {
            // filter tasks within each group by visibility
            var tasks = g.querySelectorAll('.sw-task-item[data-visibility]');
            var visible = 0;
            tasks.forEach(function(t) {
                var show = t.dataset.visibility === tab;
                t.style.display = show ? '' : 'none';
                if (show) visible++;
            });
            g.style.display = visible > 0 ? '' : 'none';
        } else if (tab === 'upcoming') {
            g.style.display = (key === 'this_week' || key === 'upcoming' || key === 'unscheduled') ? '' : 'none';
        } else {
            g.style.display = (key === tab) ? '' : 'none';
        }
    });
    // Always expand group when switching to it
    if (tab !== 'all') {
        var target = document.getElementById('bucket-' + tab);
        if (target) {
            var body = target.querySelector('.sw-task-list');
            var arrow = target.querySelector('.sw-group-toggle');
            if (body) body.style.display = '';
            if (arrow) arrow.textContent = '▼';
        }
    }
}

function swToggle(header) {
    var body = header.nextElementSibling;
    var arrow = header.querySelector('.sw-group-toggle');
    if (!body) return;
    var hidden = body.style.display === 'none';
    body.style.display = hidden ? '' : 'none';
    if (arrow) arrow.textContent = hidden ? '▼' : '▶';
}

// ── Focus Card — full action loop (no page reload) ──────────────────────────
var MT_CSRF_TOKEN = window.CSRF_TOKEN || (document.querySelector('meta[name="csrf-token"]') || {}).content || '<?= csrf_token() ?>';
var MT_APP_BASE   = window.APP_URL || '<?= APP_URL ?>';

// Map urgency → color
var urgencyColors = { overdue:'#EF4444', today:'#F59E0B', week:'#8B5CF6', upcoming:'#94A3B8' };
var priLabels     = { urgent:'Urgent', high:'High', medium:'Medium', low:'Low' };

function showMtToast(html, isError) {
    var t = document.getElementById('mt-toast-container');
    if (!t) {
        t = document.createElement('div');
        t.id = 'mt-toast-container';
        t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center';
        document.body.appendChild(t);
    }
    var el = document.createElement('div');
    el.style.cssText = 'background:' + (isError ? '#dc2626' : '#16a34a') + ';color:#fff;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.3);max-width:420px;text-align:center';
    el.innerHTML = html;
    t.appendChild(el);
    setTimeout(function(){ el.style.transition='opacity .3s'; el.style.opacity='0'; }, 5000);
    setTimeout(function(){ el.remove(); }, 5400);
}

function focusComplete(taskId) {
    var btn  = document.getElementById('focus-complete-btn');
    var card = document.getElementById('focus-card');
    if (!btn || !card) return;

    btn.textContent = '⏳ Saving…';
    btn.disabled = true;

    // Step 1: Mark current task done
    fetch(MT_APP_BASE + '/api/tasks/' + taskId + '/complete', {
        method: 'POST',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json',
            'X-CSRF-Token': MT_CSRF_TOKEN
        },
        body: JSON.stringify({status: 'done'})
    })
    .then(function(r){
        return r.json()
            .catch(function(){ return {ok:false, error:'Invalid server response'}; })
            .then(function(d){ d.__status = r.status; return d; });
    })
    .then(function(d) {
        if (d.__status === 409 && d.error === 'needs_review') {
            btn.textContent = '✓ Mark Done'; btn.disabled = false;
            showMtToast('Task này có reviewer — <a href="' + MT_APP_BASE + '/tasks/' + taskId + '" style="color:#fff;font-weight:700;text-decoration:underline">mở task</a> để submit review trước.', true);
            return;
        }
        if (!d.ok) {
            btn.textContent = '✓ Mark Done';
            btn.disabled = false;
            showMtToast(escHtml(d.message || d.error || 'Mark Done failed. Please refresh and try again.'), true);
            return;
        }

        // Step 2: Animate out
        card.style.transition = 'opacity .25s, transform .25s';
        card.style.opacity    = '0';
        card.style.transform  = 'translateY(-8px)';

        // Step 3: Fetch next task
        setTimeout(function() {
            fetch(MT_APP_BASE + '/api/my-tasks/next-focus', {
                headers: {'X-Requested-With': 'XMLHttpRequest'}
            })
            .then(function(r){ return r.json(); })
            .then(function(nr) {

                // Step 4a: Update KPI counters instantly
                if (nr.kpi) {
                    var elOverdue = document.querySelector('.sw-kpi-overdue .sw-kpi-number');
                    var elToday   = document.querySelector('.sw-kpi-today .sw-kpi-number');
                    if (elOverdue) elOverdue.textContent = nr.kpi.overdue;
                    if (elToday)   elToday.textContent   = nr.kpi.today;
                }

                // Step 4b: No more tasks — show done state
                if (!nr.task) {
                    card.innerHTML = [
                        '<div class="sw-focus-emoji">🎉</div>',
                        '<div class="sw-focus-body">',
                        '  <div class="sw-focus-label" style="color:#22C55E">All caught up!</div>',
                        '  <div class="sw-focus-title">' + (nr.message || 'No urgent tasks remaining') + '</div>',
                        '  <div class="sw-focus-meta">Keep it up — check back later for new assignments.</div>',
                        '</div>'
                    ].join('');
                    card.className = 'sw-focus-card';
                    card.style.borderColor   = 'rgba(34,197,94,.28)';
                    card.style.borderLeftColor = '#22C55E';
                    card.style.background    = 'linear-gradient(135deg,rgba(34,197,94,.08) 0%,rgba(34,197,94,.02) 100%)';
                } else {
                    // Step 4c: Render next task in-place
                    var t = nr.task;
                    var color = urgencyColors[t.urgency] || '#94A3B8';
                    var lateStr = t.days_late > 0
                        ? t.days_late + ' day' + (t.days_late > 1 ? 's' : '') + ' overdue — act now'
                        : (t.urgency === 'today' ? 'Due today — your focus right now' : 'Due this week');
                    var metaParts = [];
                    if (t.store_name)   metaParts.push('🏪 ' + escHtml(t.store_name));
                    if (t.project_name) metaParts.push('📁 ' + escHtml(t.project_name));
                    if (t.priority && t.priority !== 'medium') metaParts.push(priLabels[t.priority] || t.priority);

                    card.innerHTML = [
                        '<div class="sw-focus-emoji">' + (t.urgency === 'overdue' ? '🚨' : '📌') + '</div>',
                        '<div class="sw-focus-body">',
                        '  <div class="sw-focus-label" style="color:' + color + '">' + escHtml(lateStr) + '</div>',
                        '  <div class="sw-focus-title">' + escHtml(t.title) + '</div>',
                        '  <div class="sw-focus-meta">' + metaParts.join(' · ') + '</div>',
                        '</div>',
                        '<div class="sw-focus-actions">',
                        '  <button data-focus-complete-task="' + t.id + '" id="focus-complete-btn"',
                        '    class="sw-btn sw-btn-primary" style="font-size:13px;padding:10px 18px;min-height:40px">',
                        '    ✓ Mark Done</button>',
                        '  <a href="' + escHtml(t.detail_url) + '" class="sw-btn sw-btn-ghost" data-detail-drawer>→ Details</a>',
                        '</div>',
                    ].join('');

                    // Restyle card border for new urgency
                    card.style.borderColor     = 'rgba(' + hexToRgb(color) + ',.28)';
                    card.style.borderLeftColor = color;
                    card.style.background      = 'linear-gradient(135deg,rgba(' + hexToRgb(color) + ',.08) 0%,rgba(' + hexToRgb(color) + ',.02) 100%)';
                    card.className = 'sw-focus-card' + (t.urgency === 'today' ? ' focus-today' : '');
                }

                // Step 5: Animate in
                card.style.transform = 'translateY(8px)';
                card.style.opacity   = '0';
                requestAnimationFrame(function(){
                    card.style.transition = 'opacity .3s, transform .3s';
                    card.style.opacity    = '1';
                    card.style.transform  = 'translateY(0)';
                });
            })
            .catch(function() {
                // Network error — soft fallback
                card.innerHTML = '<div style="padding:8px 0;color:#22C55E;font-weight:700">✅ Done! Refresh to see next task.</div>';
                card.style.opacity = '1';
            });
        }, 280);
    })
    .catch(function() {
        btn.textContent = '✓ Mark Done'; btn.disabled = false;
        showMtToast('Mark Done failed. Please check connection and try again.', true);
    });
}

window.focusComplete = focusComplete;
document.addEventListener('click', function(e) {
    var btn = e.target.closest && e.target.closest('[data-focus-complete-task]');
    if (!btn) return;
    e.preventDefault();
    focusComplete(parseInt(btn.getAttribute('data-focus-complete-task'), 10));
});

function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function hexToRgb(hex) {
    var r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? parseInt(r[1],16)+','+parseInt(r[2],16)+','+parseInt(r[3],16) : '148,163,184';
}
</script>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
