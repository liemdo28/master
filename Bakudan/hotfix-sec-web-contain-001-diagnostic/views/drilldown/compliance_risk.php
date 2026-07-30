<?php
// $items passed from controller
$ddTitle     = t('dashboard.kpi.compliance_risk');
$ddCount     = count($items);
$ddRiskLevel = $ddCount > 3 ? 'critical' : ($ddCount > 0 ? 'high' : 'low');

$pageTitle = t('dashboard.kpi.compliance_risk');
ob_start();
if (empty($items)):
?>
<div class="dd-table-wrap"><div class="dd-empty"><?= e(t('overview.no_risks')) ?></div></div>
<?php else: ?>
<div class="dd-table-wrap">
    <table class="dd-table">
        <thead>
            <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Store</th>
                <th>Owner</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Overdue Days</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($items as $item):
            $days = (int)($item['overdue_days'] ?? 0);
            $isOverdue = $days > 0;
            $color = $isOverdue ? '#dc2626' : '#f59e0b';
        ?>
        <tr>
            <td style="font-weight:600;color:#f1f5f9"><?= e($item['title'] ?? $item['name'] ?? '—') ?></td>
            <td>
                <span class="dd-risk-pill" style="background:rgba(100,116,139,.12);color:#94a3b8">
                    <?= strtoupper($item['category'] ?? '—') ?>
                </span>
            </td>
            <td><?= e($item['store_name'] ?? '—') ?></td>
            <td><?= e($item['owner_name'] ?? '—') ?></td>
            <td style="white-space:nowrap"><?= e($item['due_date'] ? date('d M Y', strtotime($item['due_date'])) : '—') ?></td>
            <td>
                <span class="dd-risk-pill" style="background:<?= $color ?>18;color:<?= $color ?>">
                    <?= strtoupper($item['status'] ?? '—') ?>
                </span>
            </td>
            <td>
                <?php if ($isOverdue): ?>
                <span class="dd-risk-pill" style="background:rgba(220,38,38,.12);color:#f87171"><?= $days ?>d</span>
                <?php else: ?>
                <span style="color:#64748b">—</span>
                <?php endif; ?>
            </td>
            <td>
                <a href="<?= APP_URL ?>/obligations/<?= (int)($item['id'] ?? 0) ?>" class="dd-action-link">View Obligation</a>
            </td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php endif; ?>
<?php $ddContent = ob_get_clean(); ?>

<?php require __DIR__ . '/layout.php'; ?>
