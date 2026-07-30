<?php
// $unified passed from controller (top 20 sorted by risk_score)
$ddTitle     = 'Unified Risk';
$ddCount     = count($unified);
$ddRiskLevel = $ddCount > 10 ? 'critical' : ($ddCount > 3 ? 'high' : 'medium');

$riskColors = [
    'critical' => '#dc2626',
    'high'     => '#f59e0b',
    'medium'   => '#3b82f6',
    'low'      => '#22c55e',
];

$pageTitle = 'Unified Risk';
ob_start();
if (empty($unified)):
?>
<div class="dd-table-wrap"><div class="dd-empty">No risk items found. Operations are healthy!</div></div>
<?php else: ?>
<div class="dd-table-wrap">
    <table class="dd-table">
        <thead>
            <tr>
                <th>Type</th>
                <th>Record</th>
                <th>Store</th>
                <th>Owner</th>
                <th>Risk Level</th>
                <th>Risk Reason</th>
                <th>Action</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($unified as $item):
            $rlColor = $riskColors[strtolower($item['risk_level'] ?? '')] ?? '#64748b';
            $typeIcon = $item['type'] === 'Bill' ? '💳' : ($item['type'] === 'Task' ? '📋' : '⚠️');
        ?>
        <tr>
            <td>
                <span style="font-size:11px;display:flex;align-items:center;gap:4px;white-space:nowrap">
                    <?= $typeIcon ?> <?= e($item['type']) ?>
                </span>
            </td>
            <td style="font-weight:600;color:#f1f5f9;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="<?= e($item['record']) ?>">
                <?= e($item['record']) ?>
            </td>
            <td><?= e($item['store']) ?></td>
            <td><?= e($item['owner']) ?></td>
            <td>
                <span class="dd-risk-pill" style="background:<?= $rlColor ?>18;color:<?= $rlColor ?>">
                    <?= strtoupper($item['risk_level']) ?>
                </span>
            </td>
            <td style="font-size:12px;color:#94a3b8"><?= e($item['risk_reason']) ?></td>
            <td>
                <a href="<?= APP_URL . e($item['url']) ?>" class="dd-action-link">View</a>
            </td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php endif; ?>
<?php $ddContent = ob_get_clean(); ?>

<?php require __DIR__ . '/layout.php'; ?>
