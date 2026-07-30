<?php
$pageTitle = 'Executive Scorecard';
$currentPage = 'ceo-scorecard';
ob_start();
?>
<style>
.sc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:28px}
.sc-card{background:#18181b;border:1px solid #27272a;border-radius:10px;padding:20px;text-align:center}
.sc-card__val{font-size:32px;font-weight:700;margin-bottom:4px}
.sc-card__label{font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.5px}
.sc-card--green .sc-card__val{color:#4ade80}
.sc-card--yellow .sc-card__val{color:#fbbf24}
.sc-card--red .sc-card__val{color:#f87171}
.sc-card--blue .sc-card__val{color:#60a5fa}
.sc-section{margin-bottom:28px}
.sc-section h3{font-size:15px;color:#a1a1aa;margin-bottom:14px;text-transform:uppercase;letter-spacing:.5px}
.sc-table{width:100%;border-collapse:collapse}
.sc-table th{text-align:left;padding:8px 12px;font-size:12px;color:#71717a;border-bottom:1px solid #27272a}
.sc-table td{padding:10px 12px;border-bottom:1px solid #1f1f23;font-size:14px;color:#d4d4d8}
.sc-table tr:hover td{background:#1c1c20}
.sc-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
.sc-badge--good{background:#052e16;color:#4ade80}
.sc-badge--warn{background:#422006;color:#fbbf24}
.sc-badge--bad{background:#450a0a;color:#fca5a5}
.sc-goal{background:#09090b;border-radius:8px;padding:14px;margin-bottom:10px}
.sc-goal__title{font-size:14px;color:#f4f4f5;margin-bottom:6px}
.sc-goal__bar{height:6px;background:#27272a;border-radius:3px;overflow:hidden}
.sc-goal__fill{height:100%;background:#3b82f6;border-radius:3px;transition:width .3s}
.sc-goal__meta{display:flex;justify-content:space-between;font-size:12px;color:#71717a;margin-top:4px}
.sc-stats{display:flex;gap:20px;margin-bottom:20px;flex-wrap:wrap}
.sc-stats__item{font-size:13px;color:#a1a1aa}
.sc-stats__item strong{color:#f4f4f5}
</style>

<!-- Company Stats -->
<div class="sc-stats">
    <div class="sc-stats__item"><strong><?= $stats['stores'] ?></strong> Stores</div>
    <div class="sc-stats__item"><strong><?= $stats['regions'] ?></strong> Regions</div>
    <div class="sc-stats__item"><strong><?= $stats['districts'] ?></strong> Districts</div>
    <div class="sc-stats__item"><strong><?= $stats['employees'] ?></strong> Employees</div>
</div>

<!-- Scorecard KPIs -->
<div class="sc-grid">
    <div class="sc-card <?= $scorecard['store_health'] >= 80 ? 'sc-card--green' : ($scorecard['store_health'] >= 60 ? 'sc-card--yellow' : 'sc-card--red') ?>">
        <div class="sc-card__val"><?= $scorecard['store_health'] ?>%</div>
        <div class="sc-card__label">Store Health</div>
    </div>
    <div class="sc-card <?= $scorecard['task_completion'] >= 80 ? 'sc-card--green' : 'sc-card--yellow' ?>">
        <div class="sc-card__val"><?= $scorecard['task_completion'] ?>%</div>
        <div class="sc-card__label">Task Completion</div>
    </div>
    <div class="sc-card <?= $scorecard['audit_score'] >= 90 ? 'sc-card--green' : 'sc-card--yellow' ?>">
        <div class="sc-card__val"><?= $scorecard['audit_score'] ?: '—' ?>%</div>
        <div class="sc-card__label">Audit Score</div>
    </div>
    <div class="sc-card <?= $scorecard['payroll_accuracy'] >= 99 ? 'sc-card--green' : 'sc-card--yellow' ?>">
        <div class="sc-card__val"><?= $scorecard['payroll_accuracy'] ?: '—' ?>%</div>
        <div class="sc-card__label">Payroll Accuracy</div>
    </div>
    <div class="sc-card <?= $scorecard['total_incidents'] <= 3 ? 'sc-card--green' : 'sc-card--red' ?>">
        <div class="sc-card__val"><?= $scorecard['total_incidents'] ?></div>
        <div class="sc-card__label">Open Incidents</div>
    </div>
    <div class="sc-card <?= $scorecard['critical_risks'] === 0 ? 'sc-card--green' : 'sc-card--red' ?>">
        <div class="sc-card__val"><?= count($scorecard['high_risk_stores']) ?></div>
        <div class="sc-card__label">High Risk Stores</div>
    </div>
</div>

<!-- High Risk Stores -->
<?php if (!empty($scorecard['high_risk_stores'])): ?>
<div class="sc-section">
    <h3>⚠ Stores Needing Attention</h3>
    <table class="sc-table">
        <thead><tr><th>Store</th><th>Health Score</th><th>Status</th></tr></thead>
        <tbody>
        <?php foreach ($scorecard['high_risk_stores'] as $s): ?>
        <tr>
            <td><?= e($s['store_name']) ?></td>
            <td><?= number_format((float)$s['store_health_score'], 1) ?>%</td>
            <td><span class="sc-badge sc-badge--bad">At Risk</span></td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php endif; ?>

<!-- Top Performing Stores -->
<?php if (!empty($benchmarks['top'])): ?>
<div class="sc-section">
    <h3>🏆 Top Performing Stores</h3>
    <table class="sc-table">
        <thead><tr><th>Store</th><th>Health</th><th>Completion</th><th>Audit</th></tr></thead>
        <tbody>
        <?php foreach (array_slice($benchmarks['top'], 0, 5) as $s): ?>
        <tr>
            <td><?= e($s['store_name']) ?></td>
            <td><span class="sc-badge sc-badge--good"><?= number_format((float)$s['store_health_score'], 1) ?>%</span></td>
            <td><?= $s['task_completion_pct'] !== null ? number_format((float)$s['task_completion_pct'], 1).'%' : '—' ?></td>
            <td><?= $s['audit_score'] !== null ? number_format((float)$s['audit_score'], 1).'%' : '—' ?></td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php endif; ?>

<!-- Active Goals -->
<?php if (!empty($goals)): ?>
<div class="sc-section">
    <h3>🎯 Active Goals</h3>
    <?php foreach (array_slice($goals, 0, 5) as $g): ?>
    <div class="sc-goal">
        <div class="sc-goal__title"><?= e($g['title']) ?></div>
        <div class="sc-goal__bar"><div class="sc-goal__fill" style="width:<?= min(100, (float)$g['progress_pct']) ?>%"></div></div>
        <div class="sc-goal__meta">
            <span><?= number_format((float)$g['progress_pct'], 0) ?>%</span>
            <span><?= $g['quarter'] ?? '' ?> · <?= e($g['owner_name'] ?? '') ?></span>
        </div>
    </div>
    <?php endforeach; ?>
</div>
<?php endif; ?>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
