<?php
$pageTitle = 'Store Overview';
$currentPage = 'store-overview';
ob_start();
?>

<div style="margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
    <h1 style="font-size:22px;font-weight:800;margin:0;display:flex;align-items:center;gap:10px">
        <?= tf_icon('building-2', 24) ?> Store Overview
    </h1>
    <a href="<?= APP_URL ?>/overview" style="font-size:13px;color:var(--text-muted);text-decoration:none">← Back to Overview</a>
</div>

<!-- KPI Row -->
<div class="ov-kpi-row" style="margin-bottom:28px">
    <div class="ov-kpi kpi-cyan" style="cursor:default">
        <div class="ov-kpi-icon-wrap kpi-icon-cyan"><?= tf_icon('building-2', 24) ?></div>
        <div class="ov-kpi-value"><?= count($storeStats) ?></div>
        <div class="ov-kpi-label">Total Stores</div>
    </div>
    <div class="ov-kpi kpi-lime" style="cursor:default">
        <div class="ov-kpi-icon-wrap kpi-icon-lime"><?= tf_icon('trending-up', 24) ?></div>
        <div class="ov-kpi-value"><?= array_sum(array_column($storeStats, 'completed')) ?></div>
        <div class="ov-kpi-label">Total Completed</div>
    </div>
    <div class="ov-kpi kpi-pink" style="cursor:default">
        <div class="ov-kpi-icon-wrap kpi-icon-pink"><?= tf_icon('alert-triangle', 24) ?></div>
        <div class="ov-kpi-value"><?= array_sum(array_column($storeStats, 'overdue')) ?></div>
        <div class="ov-kpi-label">Total Overdue</div>
    </div>
    <div class="ov-kpi kpi-purple" style="cursor:default">
        <div class="ov-kpi-icon-wrap kpi-icon-purple"><?= tf_icon('calendar', 24) ?></div>
        <div class="ov-kpi-value"><?= array_sum(array_column($storeStats, 'due_today')) ?></div>
        <div class="ov-kpi-label">Due Today</div>
    </div>
</div>

<!-- Store Cards -->
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px">
<?php foreach ($storeStats as $ss):
    $store = $ss['store'];
    $color = $store['color'] ?? '#3b82f6';
    $risk = $ss['overdue'] > 5 ? 'red' : ($ss['overdue'] > 0 ? 'yellow' : 'green');
    $riskLabel = $risk === 'red' ? 'Behind' : ($risk === 'yellow' ? 'At risk' : 'On track');
    $riskClass = $risk === 'red' ? 'ov-status-danger' : ($risk === 'yellow' ? 'ov-status-warn' : 'ov-status-ok');
?>
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:20px;position:relative;overflow:hidden;display:flex;flex-direction:column;gap:14px;transition:box-shadow .2s" onmouseover="this.style.boxShadow='0 4px 20px rgba(0,0,0,.3)'" onmouseout="this.style.boxShadow='none'">
    <div style="position:absolute;top:0;left:0;right:0;height:3px;background:<?= e($color) ?>"></div>

    <!-- Header -->
    <div style="display:flex;align-items:center;gap:12px">
        <div style="width:40px;height:40px;border-radius:10px;background:<?= e($color) ?>22;border:2px solid <?= e($color) ?>;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <?= tf_icon('building-2', 20) ?>
        </div>
        <div style="flex:1;min-width:0">
            <a href="<?= APP_URL ?>/overview/store/<?= (int)$store['id'] ?>" style="font-size:16px;font-weight:700;color:var(--text-primary);text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block"><?= e($store['name']) ?></a>
        </div>
        <span class="ov-status <?= $riskClass ?>" style="font-size:11px;padding:3px 8px;border-radius:9999px;font-weight:600"><?= $riskLabel ?></span>
    </div>

    <!-- Progress bar -->
    <div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
            <span style="font-size:12px;color:var(--text-muted)">Progress</span>
            <span style="font-size:13px;font-weight:700"><?= $ss['progress'] ?>%</span>
        </div>
        <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:<?= $ss['progress'] ?>%;background:<?= $risk === 'red' ? '#EF4444' : ($risk === 'yellow' ? '#F59E0B' : '#22C55E') ?>;border-radius:3px;transition:width .3s"></div>
        </div>
    </div>

    <!-- Stats grid -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        <div style="text-align:center;padding:8px;background:var(--bg);border-radius:8px">
            <div style="font-size:18px;font-weight:800;color:var(--text-primary)"><?= $ss['total_tasks'] ?></div>
            <div style="font-size:11px;color:var(--text-muted)">Total</div>
        </div>
        <div style="text-align:center;padding:8px;background:var(--bg);border-radius:8px">
            <div style="font-size:18px;font-weight:800;color:var(--text-primary)"><?= $ss['outstanding'] ?></div>
            <div style="font-size:11px;color:var(--text-muted)">Open</div>
        </div>
        <div style="text-align:center;padding:8px;background:var(--bg);border-radius:8px">
            <div style="font-size:18px;font-weight:800;color:<?= $ss['overdue'] > 0 ? '#EF4444' : 'var(--text-primary)' ?>"><?= $ss['overdue'] ?></div>
            <div style="font-size:11px;color:var(--text-muted)">Overdue</div>
        </div>
    </div>

    <!-- Secondary stats -->
    <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--text-muted)">
        <span style="display:flex;align-items:center;gap:4px">
            <?= tf_icon('clock', 12) ?> Due today: <strong style="color:var(--text-primary)"><?= $ss['due_today'] ?></strong>
        </span>
        <span style="display:flex;align-items:center;gap:4px">
            <?= tf_icon('calendar', 12) ?> This week: <strong style="color:var(--text-primary)"><?= $ss['due_soon'] ?></strong>
        </span>
        <span style="display:flex;align-items:center;gap:4px">
            <?= tf_icon('wallet', 12) ?> Bills: <strong style="color:var(--text-primary)"><?= $ss['total_bills'] ?></strong>
            <?php if ($ss['overdue_bills'] > 0): ?>
                <span style="color:#EF4444">(<?= $ss['overdue_bills'] ?> overdue)</span>
            <?php endif; ?>
        </span>
    </div>

    <!-- CTA -->
    <a href="<?= APP_URL ?>/overview/store/<?= (int)$store['id'] ?>" style="display:block;text-align:center;padding:8px;border-radius:8px;background:<?= e($color) ?>15;border:1px solid <?= e($color) ?>30;color:<?= e($color) ?>;font-size:13px;font-weight:600;text-decoration:none;transition:background .2s;margin-top:auto" onmouseover="this.style.background='<?= e($color) ?>30'" onmouseout="this.style.background='<?= e($color) ?>15'">
        View Details →
    </a>
</div>
<?php endforeach; ?>
</div>

<?php if (empty($storeStats)): ?>
<div class="ov-card">
    <div class="ov-card-body" style="text-align:center;padding:40px;color:var(--text-muted)">
        No stores found. Add a store to get started.
    </div>
</div>
<?php endif; ?>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
