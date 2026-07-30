<?php
$pageTitle   = 'Executive Dashboard';
$currentPage = 'ceo';
ob_start();
?>
<style>
/* ═══════════════════════════════════════════════════════════════
   CEO DASHBOARD — Design System
   Max width: 1440px | Card radius: 16px | Dark neutral surfaces
   ═══════════════════════════════════════════════════════════════ */

:root {
    --ceo-red:    #EF4444;
    --ceo-amber:  #F59E0B;
    --ceo-green:  #22C55E;
    --ceo-blue:   #3B82F6;
    --ceo-gray:   #94A3B8;
    --ceo-risk-c: #DC2626;
    --ceo-risk-w: #F59E0B;
    --ceo-risk-g: #16A34A;
    --ceo-bg:     #0F172A;
    --ceo-surface:#1E293B;
    --ceo-border: rgba(255,255,255,.08);
    --ceo-text:   #F1F5F9;
    --ceo-muted:  #94A3B8;
}

.ceo-wrap {
    max-width: 1440px;
    margin: 0 auto;
    padding: 0 24px 48px;
    color: var(--ceo-text);
}

/* ── Header ── */
.ceo-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px 0 20px;
    border-bottom: 1px solid var(--ceo-border);
    margin-bottom: 28px;
    flex-wrap: wrap;
    gap: 12px;
}
.ceo-header-left h1 {
    font-size: 28px;
    font-weight: 800;
    color: var(--ceo-text);
    margin: 0;
    letter-spacing: -.5px;
}
.ceo-header-left p {
    font-size: 14px;
    color: var(--ceo-muted);
    margin: 4px 0 0;
}
.ceo-header-right {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
}
.ceo-month-badge {
    background: rgba(59,130,246,.15);
    border: 1px solid rgba(59,130,246,.3);
    color: #93C5FD;
    border-radius: 8px;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 600;
}
.ceo-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    border: none;
    cursor: pointer;
    transition: .15s;
}
.ceo-btn-primary { background: #2563EB; color: #fff; }
.ceo-btn-primary:hover { background: #1D4ED8; }
.ceo-btn-ghost { background: rgba(255,255,255,.06); color: var(--ceo-text); border: 1px solid var(--ceo-border); }
.ceo-btn-ghost:hover { background: rgba(255,255,255,.1); }

/* ── Section headings ── */
.ceo-section-title {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--ceo-muted);
    margin: 0 0 14px;
}

/* ── Cards ── */
.ceo-card {
    background: var(--ceo-surface);
    border: 1px solid var(--ceo-border);
    border-radius: 16px;
    padding: 20px;
}
.ceo-card-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--ceo-muted);
    margin: 0 0 16px;
    text-transform: uppercase;
    letter-spacing: .06em;
}

/* ── KPI strip (Row 1) ── */
.ceo-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;
}
@media (max-width: 900px) { .ceo-kpi-grid { grid-template-columns: repeat(2,1fr); } }
@media (max-width: 520px) { .ceo-kpi-grid { grid-template-columns: 1fr; } }

.ceo-kpi {
    background: var(--ceo-surface);
    border: 1px solid var(--ceo-border);
    border-radius: 16px;
    padding: 20px;
    min-height: 140px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    cursor: pointer;
    transition: .2s;
    text-decoration: none;
    color: inherit;
}
.ceo-kpi:hover { border-color: rgba(255,255,255,.18); transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,.3); }
.ceo-kpi-top { display: flex; align-items: center; justify-content: space-between; }
.ceo-kpi-icon { font-size: 22px; }
.ceo-kpi-label { font-size: 12px; font-weight: 700; color: var(--ceo-muted); text-transform: uppercase; letter-spacing: .08em; }
.ceo-kpi-number { font-size: 40px; font-weight: 800; line-height: 1; margin: 12px 0 4px; }
.ceo-kpi-sub { font-size: 12px; color: var(--ceo-muted); font-weight: 500; }
.ceo-kpi-red .ceo-kpi-number { color: var(--ceo-red); }
.ceo-kpi-amber .ceo-kpi-number { color: var(--ceo-amber); }
.ceo-kpi-green .ceo-kpi-number { color: var(--ceo-green); }
.ceo-kpi-blue .ceo-kpi-number { color: var(--ceo-blue); }
.ceo-kpi-red { border-left: 3px solid var(--ceo-red); }
.ceo-kpi-amber { border-left: 3px solid var(--ceo-amber); }
.ceo-kpi-green { border-left: 3px solid var(--ceo-green); }
.ceo-kpi-blue { border-left: 3px solid var(--ceo-blue); }

/* ── Row 2 — AI Focus + Urgent Queue ── */
.ceo-row2 {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 16px;
    margin-bottom: 24px;
}
@media (max-width: 1100px) { .ceo-row2 { grid-template-columns: 1fr; } }

/* Smart insights */
.ceo-insight-list { display: flex; flex-direction: column; gap: 10px; }
.ceo-insight-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 12px;
    border-left: 3px solid transparent;
}
.ceo-insight-item.ci-critical { background: rgba(220,38,38,.08); border-color: #DC2626; }
.ceo-insight-item.ci-warning  { background: rgba(245,158,11,.08); border-color: #F59E0B; }
.ceo-insight-item.ci-ok       { background: rgba(34,197,94,.08);  border-color: #22C55E; }
.ceo-insight-item.ci-info     { background: rgba(59,130,246,.08); border-color: #3B82F6; }
.ceo-insight-dot {
    width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 5px;
}
.ci-critical .ceo-insight-dot { background: #DC2626; }
.ci-warning  .ceo-insight-dot { background: #F59E0B; }
.ci-ok       .ceo-insight-dot { background: #22C55E; }
.ci-info     .ceo-insight-dot { background: #3B82F6; }
.ceo-insight-body { flex: 1; }
.ceo-insight-body p { margin: 0 0 6px; font-size: 14px; color: var(--ceo-text); line-height: 1.5; }
.ceo-insight-body a { font-size: 12px; font-weight: 600; text-decoration: none; padding: 3px 10px; border-radius: 6px; }
.ci-critical .ceo-insight-body a { background: rgba(220,38,38,.15); color: #FCA5A5; }
.ci-warning  .ceo-insight-body a { background: rgba(245,158,11,.15); color: #FCD34D; }
.ci-ok       .ceo-insight-body a { background: rgba(34,197,94,.15);  color: #86EFAC; }
.ci-info     .ceo-insight-body a { background: rgba(59,130,246,.15); color: #93C5FD; }

/* Urgent queue */
.ceo-urgent-list { display: flex; flex-direction: column; gap: 0; }
.ceo-urgent-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 0;
    border-bottom: 1px solid var(--ceo-border);
    text-decoration: none;
    color: inherit;
    transition: .15s;
}
.ceo-urgent-row:last-child { border-bottom: none; }
.ceo-urgent-row:hover { background: rgba(255,255,255,.03); border-radius: 8px; padding-left: 8px; padding-right: 8px; margin: 0 -8px; }
.ceo-urgent-type {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .06em;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    flex-shrink: 0;
}
.cut-bill { background: rgba(99,102,241,.2); color: #A5B4FC; }
.cut-task { background: rgba(16,185,129,.2); color: #6EE7B7; }
.ceo-urgent-info { flex: 1; min-width: 0; }
.ceo-urgent-title { font-size: 13px; font-weight: 600; color: var(--ceo-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ceo-urgent-meta  { font-size: 11px; color: var(--ceo-muted); margin-top: 1px; }
.ceo-urgent-date {
    font-size: 12px;
    font-weight: 700;
    color: var(--ceo-red);
    flex-shrink: 0;
    white-space: nowrap;
}

/* ── Row 3 — Business Health + Team Accountability ── */
.ceo-row3 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 24px;
}
@media (max-width: 900px) { .ceo-row3 { grid-template-columns: 1fr; } }

/* Business health rows */
.ceo-biz-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 0;
    border-bottom: 1px solid var(--ceo-border);
    text-decoration: none;
    color: inherit;
    transition: .15s;
}
.ceo-biz-row:last-child { border-bottom: none; }
.ceo-biz-row:hover { opacity: .85; }
.ceo-biz-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
.ceo-biz-name { font-size: 14px; font-weight: 700; flex: 1; }
.ceo-biz-stats { display: flex; gap: 16px; align-items: center; }
.ceo-biz-stat { text-align: center; }
.ceo-biz-stat .val { font-size: 18px; font-weight: 800; }
.ceo-biz-stat .lbl { font-size: 10px; color: var(--ceo-muted); text-transform: uppercase; letter-spacing: .06em; }
.ceo-biz-bar-wrap { width: 80px; }
.ceo-biz-bar {
    height: 8px;
    border-radius: 999px;
    background: rgba(255,255,255,.1);
    overflow: hidden;
}
.ceo-biz-bar-fill {
    height: 100%;
    border-radius: 999px;
    transition: width .4s ease;
}

/* Risk pills */
.ceo-risk {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 999px;
    white-space: nowrap;
    flex-shrink: 0;
}
.risk-critical { background: rgba(220,38,38,.2);  color: #FCA5A5; }
.risk-at_risk  { background: rgba(245,158,11,.2); color: #FCD34D; }
.risk-on_track { background: rgba(34,197,94,.2);  color: #86EFAC; }
.risk-none     { background: rgba(148,163,184,.15); color: #94A3B8; }
.risk-stable   { background: rgba(34,197,94,.2);  color: #86EFAC; }
.risk-watch    { background: rgba(245,158,11,.2); color: #FCD34D; }
.risk-behind   { background: rgba(239,68,68,.2);  color: #FCA5A5; }

/* Team accountability */
.ceo-team-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ceo-team-table th {
    font-size: 11px;
    font-weight: 700;
    color: var(--ceo-muted);
    text-align: left;
    padding: 0 8px 10px 0;
    border-bottom: 1px solid var(--ceo-border);
    text-transform: uppercase;
    letter-spacing: .06em;
    white-space: nowrap;
}
.ceo-team-table td {
    padding: 11px 8px 11px 0;
    border-bottom: 1px solid var(--ceo-border);
    vertical-align: middle;
}
.ceo-team-table tr:last-child td { border-bottom: none; }
.ceo-member-cell { display: flex; align-items: center; gap: 10px; }
.ceo-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.ceo-member-name { font-weight: 600; color: var(--ceo-text); }
.ceo-num { font-weight: 700; }
.ceo-num-red { color: var(--ceo-red); }
.ceo-num-amber { color: var(--ceo-amber); }
.ceo-action-link {
    font-size: 11px; font-weight: 600; color: var(--ceo-blue);
    text-decoration: none;
}
.ceo-action-link:hover { text-decoration: underline; }

/* ── Row 4 — Category Matrix ── */
.ceo-matrix-wrap { overflow-x: auto; margin-bottom: 24px; }
.ceo-matrix-table { width: 100%; border-collapse: collapse; min-width: 700px; }
.ceo-matrix-table th {
    font-size: 11px; font-weight: 700; color: var(--ceo-muted);
    padding: 10px 12px; text-transform: uppercase; letter-spacing: .06em;
    background: rgba(255,255,255,.03);
    border-bottom: 1px solid var(--ceo-border);
    white-space: nowrap;
}
.ceo-matrix-table th:first-child { border-radius: 8px 0 0 0; }
.ceo-matrix-table th:last-child  { border-radius: 0 8px 0 0; }
.ceo-matrix-table td {
    padding: 14px 12px;
    border-bottom: 1px solid var(--ceo-border);
    vertical-align: middle;
    font-size: 13px;
}
.ceo-matrix-table tr:last-child td { border-bottom: none; }
.ceo-matrix-biz { display: flex; align-items: center; gap: 8px; font-weight: 700; }
.ceo-matrix-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.ceo-matrix-cell { text-align: center; }
.ceo-matrix-num { font-size: 15px; font-weight: 800; }
.ceo-matrix-sub { font-size: 10px; color: var(--ceo-muted); margin-top: 1px; }
.ceo-cell-ok      { color: var(--ceo-green); }
.ceo-cell-warn    { color: var(--ceo-amber); }
.ceo-cell-crit    { color: var(--ceo-red); }
.ceo-cell-empty   { color: rgba(148,163,184,.4); }

/* Progress bar color based on pct */
.bar-green { background: #22C55E; }
.bar-amber { background: #F59E0B; }
.bar-red   { background: #EF4444; }

/* ── Intelligence Command Strip ── */
.ceo-command {
    border-radius: 16px; padding: 18px 22px; margin-bottom: 24px;
    border: 1px solid rgba(239,68,68,.2); background: rgba(239,68,68,.05);
}
.ceo-command.cmd-ok  { border-color: rgba(34,197,94,.2); background: rgba(34,197,94,.04); }
.ceo-command-header  {
    display: flex; align-items: center; gap: 8px;
    font-size: 10px; font-weight: 800; letter-spacing: .12em;
    text-transform: uppercase; color: #FCA5A5; margin-bottom: 14px;
}
.ceo-command.cmd-ok .ceo-command-header { color: #86EFAC; }
.ceo-command-row {
    display: flex; align-items: center; gap: 12px;
    padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,.06);
}
.ceo-command-row:last-child { border-bottom: none; padding-bottom: 0; }
.ceo-cmd-num {
    width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 800;
    background: rgba(239,68,68,.2); color: #FCA5A5;
}
.ceo-cmd-warn .ceo-cmd-num { background: rgba(245,158,11,.2); color: #FCD34D; }
.ceo-cmd-ok   .ceo-cmd-num { background: rgba(34,197,94,.2);  color: #86EFAC; }
.ceo-cmd-info .ceo-cmd-num { background: rgba(59,130,246,.2); color: #93C5FD; }
.ceo-cmd-icon { font-size: 16px; flex-shrink: 0; }
.ceo-cmd-text { flex: 1; font-size: 13px; font-weight: 500; color: var(--ceo-text); min-width: 0; }
.ceo-cmd-text strong { font-weight: 700; }
.ceo-cmd-btn  {
    font-size: 11px; font-weight: 700; color: #60A5FA; white-space: nowrap;
    flex-shrink: 0; padding: 4px 12px; border-radius: 6px; text-decoration: none;
    background: rgba(59,130,246,.12); border: 1px solid rgba(59,130,246,.2); transition: .15s;
}
.ceo-cmd-btn:hover { background: rgba(59,130,246,.22); color: #93C5FD; }
</style>

<div class="ceo-wrap">

    <!-- ── HEADER ── -->
    <div class="ceo-header">
        <div class="ceo-header-left">
            <h1>Executive Dashboard</h1>
            <p><?= !empty($smartBrief) ? e($smartBrief) : 'Business health, bills, risk &amp; accountability — ' . e($monthNames[$month-1]) . ' ' . $year ?></p>
        </div>
        <div class="ceo-header-right">
            <span class="ceo-month-badge"><?= tf_icon('calendar', 13) ?> <?= e($monthNames[$month-1]) . ' ' . $year ?></span>
            <a href="<?= APP_URL ?>/bills" class="ceo-btn ceo-btn-ghost"><?= tf_icon('credit-card', 13) ?> Payment Schedule</a>
            <a href="<?= APP_URL ?>/overview" class="ceo-btn ceo-btn-ghost"><?= tf_icon('users', 13) ?> Team Overview</a>
        </div>
    </div>

    <!-- ── INTELLIGENCE COMMAND STRIP ── -->
    <?php
    // Build up to 3 concrete action items from live data
    $commandItems = [];

    // Bills overdue → highest priority
    $billSugIp = IconPresenter::forSuggestion('finance');
    foreach ($urgentQueue as $uq) {
        if ($uq['type'] !== 'bill') continue;
        $daysLate = !empty($uq['due_date'])
            ? max(0, (int)((strtotime($today) - strtotime(substr($uq['due_date'],0,10))) / 86400))
            : 0;
        $billCatIp = IconPresenter::forBill(['category' => $uq['category'] ?? 'general', 'status' => 'overdue', 'due_date' => $uq['due_date'] ?? null]);
        $amtStr = !empty($uq['amount']) ? ' — $' . number_format((float)$uq['amount'], 0) : '';
        $late   = $daysLate > 0 ? ', ' . $daysLate . ' day' . ($daysLate > 1 ? 's' : '') . ' late' : ', due today';
        $commandItems[] = [
            'level'       => 'critical',
            'icon'        => $billCatIp['icon'] . ' ' . $billCatIp['status_icon'],
            'text'        => '<strong>' . e($uq['title']) . '</strong> · ' . e($uq['business_name'] ?? '') . $late . $amtStr,
            'action_text' => 'Pay Now →',
            'action_url'  => APP_URL . '/bills/' . (int)$uq['id'],
        ];
        if (count($commandItems) >= 2) break;
    }

    // Highest-risk team member
    $topRiskMember = null;
    foreach ($teamRows as $tr) {
        if (($tr['risk'] ?? '') === 'critical' || (int)($tr['overdue'] ?? 0) >= 4) {
            $topRiskMember = $tr; break;
        }
    }
    if ($topRiskMember && count($commandItems) < 3) {
        $ov        = (int)$topRiskMember['overdue'];
        $riskIp    = IconPresenter::forUserRisk($topRiskMember['risk'] ?? 'critical');
        $commandItems[] = [
            'level'       => 'warning',
            'icon'        => $riskIp['icon'],
            'text'        => '<strong>' . e($topRiskMember['name']) . '</strong> has ' . $ov . ' overdue task' . ($ov > 1 ? 's' : '') . ' — highest load on team',
            'action_text' => 'View Team →',
            'action_url'  => APP_URL . '/team',
        ];
    }

    // Fill remaining slots from smart insights
    foreach ($smartInsights as $si) {
        if (count($commandItems) >= 3) break;
        $commandItems[] = [
            'level'       => $si['level'],
            'icon'        => $si['icon'],
            'text'        => e($si['text']),
            'action_text' => !empty($si['action']) ? $si['action'] : 'Review →',
            'action_url'  => !empty($si['url']) ? $si['url'] : APP_URL . '/bills',
        ];
    }

    // If nothing urgent, show healthy state
    if (empty($commandItems)) {
        $commandItems[] = ['level'=>'ok','icon'=>tf_icon('check-circle',16),'text'=>'All bills paid and no overdue tasks — system healthy','action_text'=>'Full Report →','action_url'=>APP_URL.'/overview'];
    }
    $commandItems = array_slice($commandItems, 0, 3);
    $allOk = count(array_filter($commandItems, function($c){ return $c['level'] !== 'ok' && $c['level'] !== 'info'; })) === 0;
    ?>
    <div class="ceo-command<?= $allOk ? ' cmd-ok' : '' ?>">
        <div class="ceo-command-header">
            <?= $allOk ? tf_icon('check-circle', 14) : tf_icon('alert-triangle', 14) ?>
            <?= $allOk ? 'All Systems OK' : 'Action Required Now' ?>
            <span style="margin-left:auto;font-size:10px;color:rgba(255,255,255,.3);font-weight:400;text-transform:none;letter-spacing:0">
                <?= count($commandItems) ?> item<?= count($commandItems) > 1 ? 's' : '' ?> need<?= count($commandItems) === 1 ? 's' : '' ?> your attention
            </span>
        </div>
        <?php foreach ($commandItems as $i => $cmd): ?>
        <div class="ceo-command-row ceo-cmd-<?= e($cmd['level']) ?>">
            <div class="ceo-cmd-num"><?= $i + 1 ?></div>
            <div class="ceo-cmd-icon"><?= $cmd['icon'] ?></div>
            <div class="ceo-cmd-text"><?= $cmd['text'] ?></div>
            <a href="<?= e($cmd['action_url']) ?>" class="ceo-cmd-btn"><?= e($cmd['action_text']) ?></a>
        </div>
        <?php endforeach; ?>
    </div>

    <!-- ── ROW 1: Critical KPI Cards ── -->
    <p class="ceo-section-title">Critical Metrics</p>
    <div class="ceo-kpi-grid">

        <a href="<?= APP_URL ?>/bills" class="ceo-kpi <?= $overdueBillCount > 0 ? 'ceo-kpi-red' : 'ceo-kpi-green' ?>">
            <div>
                <div class="ceo-kpi-top">
                    <span class="ceo-kpi-icon"><?= tf_icon('receipt', 20) ?></span>
                    <span class="ceo-kpi-label">Overdue Bills</span>
                </div>
                <div class="ceo-kpi-number"><?= $overdueBillCount ?></div>
            </div>
            <div class="ceo-kpi-sub">
                <?= $overdueBillCount > 0
                    ? '$' . number_format($overdueBillAmount) . ' unpaid'
                    : 'All bills on time' ?>
            </div>
        </a>

        <a href="<?= APP_URL ?>/bills" class="ceo-kpi <?= $dueWeekCount > 0 ? 'ceo-kpi-amber' : 'ceo-kpi-green' ?>">
            <div>
                <div class="ceo-kpi-top">
                    <span class="ceo-kpi-icon"><?= tf_icon('calendar', 20) ?></span>
                    <span class="ceo-kpi-label">Due This Week</span>
                </div>
                <div class="ceo-kpi-number"><?= $dueWeekCount ?></div>
            </div>
            <div class="ceo-kpi-sub">
                <?= $dueWeekCount > 0
                    ? '$' . number_format($dueWeekAmount) . ' scheduled'
                    : 'Nothing due this week' ?>
            </div>
        </a>

        <a href="#biz-health" class="ceo-kpi <?= $atRiskCount > 0 ? 'ceo-kpi-red' : 'ceo-kpi-green' ?>">
            <div>
                <div class="ceo-kpi-top">
                    <span class="ceo-kpi-icon"><?= tf_icon('building-2', 20) ?></span>
                    <span class="ceo-kpi-label">Businesses At Risk</span>
                </div>
                <div class="ceo-kpi-number"><?= $atRiskCount ?></div>
            </div>
            <div class="ceo-kpi-sub">
                <?= $atRiskCount > 0 ? 'Need immediate attention' : 'All businesses healthy' ?>
            </div>
        </a>

        <a href="<?= APP_URL ?>/overview" class="ceo-kpi <?= $overdueTaskCount > 0 ? 'ceo-kpi-amber' : 'ceo-kpi-green' ?>">
            <div>
                <div class="ceo-kpi-top">
                    <span class="ceo-kpi-icon"><?= tf_icon('activity', 20) ?></span>
                    <span class="ceo-kpi-label">Overdue Tasks</span>
                </div>
                <div class="ceo-kpi-number"><?= $overdueTaskCount ?></div>
            </div>
            <div class="ceo-kpi-sub">
                <?php
                $paidCnt = (int)($paidThisMonth['cnt'] ?? 0);
                echo $paidCnt . ' bill' . ($paidCnt != 1 ? 's' : '') . ' paid this month';
                ?>
            </div>
        </a>

    </div>

    <!-- ── ROW 2: AI Focus + Urgent Queue ── -->
    <div class="ceo-row2">

        <!-- AI Smart Summary -->
        <div class="ceo-card">
            <div class="ceo-card-title">Today's Focus</div>
            <div class="ceo-insight-list">
                <?php foreach ($smartInsights as $si): ?>
                <div class="ceo-insight-item ci-<?= e($si['level']) ?>">
                    <div class="ceo-insight-dot"></div>
                    <div class="ceo-insight-body">
                        <p><?= e($si['icon']) ?> <?= e($si['text']) ?></p>
                        <?php if (!empty($si['action'])): ?>
                        <a href="<?= APP_URL . '/' . e($si['action']) ?>"><?= e($si['action_label']) ?> →</a>
                        <?php endif; ?>
                    </div>
                </div>
                <?php endforeach; ?>
                <?php if (empty($smartInsights)): ?>
                <div class="ceo-insight-item ci-ok">
                    <div class="ceo-insight-dot"></div>
                    <div class="ceo-insight-body"><p><?= tf_icon('check-circle', 14) ?> All clear — no urgent issues today.</p></div>
                </div>
                <?php endif; ?>
            </div>
        </div>

        <!-- Urgent Queue -->
        <div class="ceo-card">
            <div class="ceo-card-title">Urgent Queue</div>
            <?php if (empty($urgentQueue)): ?>
            <p style="color:var(--ceo-muted);font-size:14px;margin:0;">No urgent items right now.</p>
            <?php else: ?>
            <div class="ceo-urgent-list">
                <?php foreach ($urgentQueue as $uq): ?>
                <?php
                    $href = $uq['type'] === 'bill'
                        ? APP_URL . '/bills'
                        : APP_URL . '/projects/' . ($uq['project_id'] ?? '');
                    $dueStr = !empty($uq['due_date']) ? date('M j', strtotime($uq['due_date'])) : '—';
                ?>
                <a href="<?= e($href) ?>" class="ceo-urgent-row">
                    <span class="ceo-urgent-type cut-<?= e($uq['type']) ?>"><?= strtoupper($uq['type']) ?></span>
                    <div class="ceo-urgent-info">
                        <div class="ceo-urgent-title"><?= e($uq['title']) ?></div>
                        <div class="ceo-urgent-meta"><?= e($uq['business_name'] ?? '—') ?>
                            <?php if (!empty($uq['category'])): ?> · <?= e($uq['category']) ?><?php endif; ?>
                            <?php if (!empty($uq['assignee_name'])): ?> · <?= e($uq['assignee_name']) ?><?php endif; ?>
                        </div>
                    </div>
                    <span class="ceo-urgent-date"><?= e($dueStr) ?></span>
                </a>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
        </div>

    </div>

    <!-- ── ROW 3: Business Health + Team Accountability ── -->
    <div class="ceo-row3" id="biz-health">

        <!-- Business Health -->
        <div class="ceo-card">
            <div class="ceo-card-title">Business Health — <?= e($monthNames[$month-1]) ?></div>
            <?php if (empty($businessHealth)): ?>
            <p style="color:var(--ceo-muted);font-size:14px;">No business data. Run <code>schema_v5.sql</code> migration.</p>
            <?php else: ?>
            <?php foreach ($businessHealth as $biz): ?>
            <?php
                $paidPct = $biz['total_bills'] > 0 ? round(($biz['paid_count'] / $biz['total_bills']) * 100) : 0;
                $barColor = $paidPct >= 80 ? 'bar-green' : ($paidPct >= 40 ? 'bar-amber' : 'bar-red');
                $riskLabel = ['critical'=>'Critical','at_risk'=>'At Risk','on_track'=>'On Track','none'=>'No Bills'];
                $riskClass = 'risk-' . ($biz['health'] ?? 'none');
            ?>
            <div class="ceo-biz-row">
                <span class="ceo-biz-dot" style="background:<?= e($biz['color']) ?>"></span>
                <span class="ceo-biz-name"><?= e($biz['business_name']) ?></span>
                <div class="ceo-biz-stats">
                    <div class="ceo-biz-stat">
                        <div class="val <?= $biz['overdue_count'] > 0 ? 'ceo-num-red' : '' ?>"><?= (int)$biz['overdue_count'] ?></div>
                        <div class="lbl">Overdue</div>
                    </div>
                    <div class="ceo-biz-stat">
                        <div class="val <?= $biz['pending_count'] > 0 ? 'ceo-num-amber' : '' ?>"><?= (int)$biz['pending_count'] ?></div>
                        <div class="lbl">Pending</div>
                    </div>
                    <div class="ceo-biz-stat">
                        <div class="val ceo-num-green"><?= (int)$biz['paid_count'] ?></div>
                        <div class="lbl">Paid</div>
                    </div>
                    <div class="ceo-biz-bar-wrap">
                        <div style="font-size:10px;color:var(--ceo-muted);margin-bottom:3px;text-align:right"><?= $paidPct ?>%</div>
                        <div class="ceo-biz-bar">
                            <div class="ceo-biz-bar-fill <?= $barColor ?>" style="width:<?= $paidPct ?>%"></div>
                        </div>
                    </div>
                </div>
                <span class="ceo-risk <?= $riskClass ?>"><?= $riskLabel[$biz['health']] ?? $biz['health'] ?></span>
            </div>
            <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <!-- Team Accountability -->
        <div class="ceo-card">
            <div class="ceo-card-title">Team Accountability</div>
            <?php
            $avatarColors = ['#7C3AED','#2563EB','#059669','#D97706','#DC2626','#0891B2','#C026D3'];
            ?>
            <table class="ceo-team-table">
                <thead>
                    <tr>
                        <th>Employee</th>
                        <th>Open</th>
                        <th>Overdue</th>
                        <th>On-time</th>
                        <th>Risk</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($teamRows as $i => $row): ?>
                    <tr>
                        <td>
                            <div class="ceo-member-cell">
                                <div class="ceo-avatar" style="background:<?= $avatarColors[$i % count($avatarColors)] ?>">
                                    <?= strtoupper(mb_substr($row['name'], 0, 1)) ?>
                                </div>
                                <span class="ceo-member-name"><?= e($row['name']) ?></span>
                            </div>
                        </td>
                        <td class="ceo-num"><?= (int)$row['open'] ?></td>
                        <td class="ceo-num <?= (int)$row['overdue'] > 0 ? 'ceo-num-red' : '' ?>"><?= (int)$row['overdue'] ?></td>
                        <td class="ceo-num <?= (int)$row['on_time_pct'] < 50 ? 'ceo-num-amber' : '' ?>"><?= (int)$row['on_time_pct'] ?>%</td>
                        <td><?= IconPresenter::chip(IconPresenter::forUserRisk($row['risk'] ?? 'stable')) ?></td>
                        <td><a href="<?= APP_URL ?>/team/member/<?= (int)$row['id'] ?>" class="ceo-action-link">View →</a></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>

    </div>

    <!-- ── ROW 4: Financial Category Matrix ── -->
    <div class="ceo-card" style="margin-bottom:24px;">
        <div class="ceo-card-title">Category Matrix — <?= e($monthNames[$month-1]) ?></div>
        <p style="font-size:12px;color:var(--ceo-muted);margin:0 0 16px;">Bills per business per category. Click a cell to view details.</p>
        <div class="ceo-matrix-wrap">
            <table class="ceo-matrix-table">
                <thead>
                    <tr>
                        <th>Business</th>
                        <?php foreach ($billCategories as $cat):
                            $catIp = IconPresenter::forBill(['category' => $cat, 'status' => 'pending', 'due_date' => null]);
                        ?>
                        <th><span style="color:<?= e($catIp['cat_color'] ?? '') ?>"><?= $catIp['icon'] ?></span> <?= ucfirst($cat) ?></th>
                        <?php endforeach; ?>
                        <th>Total Bills</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($categoryMatrix as $bm): ?>
                    <tr>
                        <td>
                            <div class="ceo-matrix-biz">
                                <span class="ceo-matrix-dot" style="background:<?= e($bm['color']) ?>"></span>
                                <?= e($bm['business_name']) ?>
                            </div>
                        </td>
                        <?php
                        $rowTotal = 0;
                        $rowOverdue = 0;
                        foreach ($billCategories as $cat):
                            $c = $bm['cats'][$cat] ?? null;
                            if ($c) { $rowTotal += $c['total']; $rowOverdue += $c['overdue']; }
                        ?>
                        <td class="ceo-matrix-cell">
                            <?php if ($c && $c['total'] > 0): ?>
                            <?php
                            $cls = $c['overdue'] > 0 ? 'ceo-cell-crit'
                                : ($c['paid'] == $c['total'] ? 'ceo-cell-ok' : 'ceo-cell-warn');
                            ?>
                            <a href="<?= APP_URL ?>/bills?category=<?= urlencode($cat) ?>"
                               style="text-decoration:none">
                                <div class="ceo-matrix-num <?= $cls ?>"><?= $c['paid'] ?>/<?= $c['total'] ?></div>
                                <?php if ($c['overdue'] > 0): ?>
                                <div class="ceo-matrix-sub" style="color:#EF4444"><?= tf_icon('alert-triangle',11) ?> <?= $c['overdue'] ?> OD</div>
                                <?php else: ?>
                                <div class="ceo-matrix-sub" style="color:#22C55E"><?= tf_icon('check-circle',11) ?> on time</div>
                                <?php endif; ?>
                            </a>
                            <?php else: ?>
                            <span class="ceo-cell-empty">—</span>
                            <?php endif; ?>
                        </td>
                        <?php endforeach; ?>
                        <td class="ceo-matrix-cell">
                            <div class="ceo-matrix-num <?= $rowOverdue > 0 ? 'ceo-cell-crit' : ($rowTotal > 0 ? 'ceo-cell-ok' : 'ceo-cell-empty') ?>"><?= $rowTotal ?></div>
                            <?php if ($rowOverdue > 0): ?>
                            <div class="ceo-matrix-sub" style="color:#EF4444"><?= tf_icon('alert-triangle',11) ?> <?= $rowOverdue ?> OD</div>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                    <?php if (empty($categoryMatrix)): ?>
                    <tr><td colspan="<?= count($billCategories) + 2 ?>" style="color:var(--ceo-muted);text-align:center;padding:24px;">No bill data for this month. Ensure businesses are mapped in schema_v5.</td></tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>

    <!-- ── Monthly Bill Summary ── -->
    <div class="ceo-card">
        <div class="ceo-card-title">Monthly Summary — <?= e($monthNames[$month-1] . ' ' . $year) ?></div>
        <div style="display:flex;gap:32px;flex-wrap:wrap">
            <?php
            $ms = $monthSummary ?? [];
            $mItems = [
                ['label'=>'Total Bills',    'val'=>(int)($ms['total'] ?? 0),            'color'=>'var(--ceo-blue)'],
                ['label'=>'Paid',           'val'=>(int)($ms['paid'] ?? 0),             'color'=>'var(--ceo-green)'],
                ['label'=>'Pending',        'val'=>(int)($ms['pending'] ?? 0),          'color'=>'var(--ceo-amber)'],
                ['label'=>'Overdue',        'val'=>(int)($ms['overdue'] ?? 0),          'color'=>'var(--ceo-red)'],
                ['label'=>'Amount Paid',    'val'=>'$'.number_format((float)($ms['paid_amount'] ?? 0)),   'color'=>'var(--ceo-green)'],
                ['label'=>'Amount Unpaid',  'val'=>'$'.number_format((float)($ms['unpaid_amount'] ?? 0)), 'color'=>'var(--ceo-red)'],
            ];
            foreach ($mItems as $mi):
            ?>
            <div style="text-align:center;min-width:90px">
                <div style="font-size:24px;font-weight:800;color:<?= $mi['color'] ?>"><?= $mi['val'] ?></div>
                <div style="font-size:11px;color:var(--ceo-muted);text-transform:uppercase;letter-spacing:.06em;margin-top:4px"><?= $mi['label'] ?></div>
            </div>
            <?php endforeach; ?>
        </div>
    </div>

</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
