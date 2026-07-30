<?php
/**
 * Shared drill-down layout wrapper.
 * Variables expected from parent view:
 *   $ddTitle      — metric name
 *   $ddCount      — total record count
 *   $ddRiskLevel  — 'critical'|'high'|'medium'|'low'|'info'
 *   $ddBreadcrumb — optional breadcrumb label
 *   $ddContent    — HTML string of the table
 *   $ddFilters    — optional HTML for filter bar
 *   $ddSummaryHtml— optional HTML for top summary bar
 */
$ddRiskLevel  = $ddRiskLevel ?? 'info';
$ddTitle      = $ddTitle     ?? 'Drill-Down';
$ddCount      = $ddCount     ?? 0;
$ddBreadcrumb = $ddBreadcrumb?? 'Overview';

$riskColors = [
    'critical' => '#dc2626',
    'high'     => '#f59e0b',
    'medium'   => '#3b82f6',
    'low'      => '#22c55e',
    'info'     => '#64748b',
];
$badgeColor = $riskColors[strtolower($ddRiskLevel)] ?? '#64748b';
?>
<style>
.dd-page { max-width: 1400px; margin: 0 auto; padding: 24px 20px; }
.dd-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.dd-header-left { display: flex; flex-direction: column; gap: 6px; }
.dd-breadcrumb { font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 6px; }
.dd-breadcrumb a { color: #3b82f6; text-decoration: none; }
.dd-breadcrumb a:hover { text-decoration: underline; }
.dd-title { font-size: 22px; font-weight: 800; color: #f1f5f9; display: flex; align-items: center; gap: 10px; }
.dd-meta { font-size: 13px; color: #64748b; display: flex; align-items: center; gap: 12px; }
.dd-risk-badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: .06em; }
.dd-count-badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; background: rgba(255,255,255,.08); color: #94a3b8; }
.dd-actions { display: flex; align-items: center; gap: 8px; }
.dd-export-btn { padding: 8px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color: #94a3b8; font-size: 12px; cursor: pointer; text-decoration: none; transition: all .15s; display: flex; align-items: center; gap: 6px; }
.dd-export-btn:hover { background: rgba(255,255,255,.1); color: #f1f5f9; }
.dd-summary-bar { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
.dd-summary-card { background: #1e2a3b; border: 1px solid rgba(255,255,255,.08); border-radius: 8px; padding: 12px 16px; display: flex; flex-direction: column; gap: 2px; min-width: 130px; }
.dd-summary-num { font-size: 20px; font-weight: 800; color: #f1f5f9; }
.dd-summary-lbl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: .06em; }
.dd-filter-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.dd-filter-bar select, .dd-filter-bar input { background: #1e2a3b; border: 1px solid rgba(255,255,255,.1); color: #f1f5f9; border-radius: 6px; padding: 6px 10px; font-size: 12px; }
.dd-table-wrap { background: #1e2a3b; border: 1px solid rgba(255,255,255,.07); border-radius: 10px; overflow: auto; }
.dd-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.dd-table th { padding: 10px 14px; text-align: left; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid rgba(255,255,255,.07); white-space: nowrap; }
.dd-table td { padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,.04); color: #e2e8f0; vertical-align: middle; }
.dd-table tr:last-child td { border-bottom: none; }
.dd-table tr:hover td { background: rgba(255,255,255,.02); }
.dd-action-link { padding: 4px 10px; border-radius: 5px; background: rgba(59,130,246,.15); color: #60a5fa; font-size: 11px; font-weight: 600; text-decoration: none; white-space: nowrap; border: 1px solid rgba(59,130,246,.2); transition: all .15s; }
.dd-action-link:hover { background: rgba(59,130,246,.25); color: #93c5fd; }
.dd-action-link.danger { background: rgba(220,38,38,.12); color: #f87171; border-color: rgba(220,38,38,.2); }
.dd-action-link.danger:hover { background: rgba(220,38,38,.2); }
.dd-risk-pill { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; letter-spacing: .05em; }
.dd-empty { text-align: center; padding: 48px 24px; color: #475569; font-size: 14px; }
.dd-section-title { font-size: 13px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .07em; margin: 20px 0 10px; display: flex; align-items: center; gap: 8px; }
</style>

<div class="dd-page">
    <!-- Header -->
    <div class="dd-header">
        <div class="dd-header-left">
            <div class="dd-breadcrumb">
                <a href="<?= APP_URL ?>/overview"><?= e($ddBreadcrumb) ?></a>
                <span>›</span>
                <span><?= e($ddTitle) ?></span>
            </div>
            <div class="dd-title">
                <?= e($ddTitle) ?>
                <span class="dd-count-badge"><?= number_format($ddCount) ?> records</span>
                <span class="dd-risk-badge" style="background:<?= $badgeColor ?>18;color:<?= $badgeColor ?>">
                    <?= strtoupper($ddRiskLevel) ?>
                </span>
            </div>
            <div class="dd-meta">
                <span>Last updated: <?= date('d M Y H:i') ?></span>
            </div>
        </div>
        <div class="dd-actions">
            <a href="<?= APP_URL ?>/overview" class="dd-export-btn">← Back to Overview</a>
        </div>
    </div>

    <?php if (!empty($ddSummaryHtml)) echo $ddSummaryHtml; ?>
    <?php if (!empty($ddFilters)) echo $ddFilters; ?>
    <?php if (!empty($ddContent)) echo $ddContent; ?>
</div>
