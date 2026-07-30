<?php
/**
 * Phase 11.5 — Module 10: Health Monitor View
 */
$statusColors = [
    'healthy' => ['color' => '#34d399', 'bg' => '#34d39915', 'icon' => '✓'],
    'warning' => ['color' => '#fbbf24', 'bg' => '#fbbf2415', 'icon' => '⚠'],
    'critical' => ['color' => '#f87171', 'bg' => '#f8717115', 'icon' => '✕'],
];

$overallStatus = 'healthy';
foreach ($checks as $check) {
    if ($check['status'] === 'critical') { $overallStatus = 'critical'; break; }
    if ($check['status'] === 'warning') { $overallStatus = 'warning'; }
}
$overallConfig = $statusColors[$overallStatus];
?>

<div class="health-page">
    <!-- Overall Status -->
    <div style="text-align:center;padding:32px;margin-bottom:32px;background:<?= $overallConfig['bg'] ?>;border:1px solid <?= $overallConfig['color'] ?>40;border-radius:16px">
        <div style="font-size:48px;margin-bottom:8px"><?= $overallStatus === 'healthy' ? '💚' : ($overallStatus === 'warning' ? '🟡' : '🔴') ?></div>
        <div style="font-size:24px;font-weight:700;color:<?= $overallConfig['color'] ?>;text-transform:uppercase"><?= $overallStatus ?></div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px">Last checked: <?= date('M j, g:i:s A') ?></div>
    </div>

    <!-- Health Checks Grid -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">
        <?php foreach ($checks as $check):
            $config = $statusColors[$check['status']] ?? $statusColors['healthy'];
        ?>
        <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:20px;border-left:4px solid <?= $config['color'] ?>">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <h4 style="font-size:15px;font-weight:600;margin:0"><?= e($check['name']) ?></h4>
                <span style="font-size:12px;padding:2px 10px;border-radius:12px;background:<?= $config['bg'] ?>;color:<?= $config['color'] ?>;font-weight:600;text-transform:uppercase">
                    <?= $config['icon'] ?> <?= e($check['status']) ?>
                </span>
            </div>
            <div style="font-size:13px;color:var(--text-muted)"><?= e($check['message']) ?></div>
        </div>
        <?php endforeach; ?>
    </div>

    <!-- Auto-refresh -->
    <div style="text-align:center;margin-top:32px;font-size:12px;color:var(--text-muted)">
        <button onclick="location.reload()" class="btn btn-sm btn-secondary">↻ Refresh</button>
        <span style="margin-left:12px">Auto-refreshes every 60s</span>
    </div>
</div>

<script>
setTimeout(function(){ location.reload(); }, 60000);
</script>
