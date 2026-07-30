<?php
// $storeRisks, $totalRisk passed from controller
$ddTitle     = t('dashboard.kpi.cash_risk');
$ddCount     = count($storeRisks);
$ddRiskLevel = $totalRisk > 10000 ? 'critical' : ($totalRisk > 2000 ? 'high' : 'low');

$pageTitle = t('dashboard.kpi.cash_risk');
ob_start();
?>
<div class="dd-summary-bar">
    <div class="dd-summary-card">
        <div class="dd-summary-num" style="color:#dc2626">$<?= number_format($totalRisk, 0) ?></div>
        <div class="dd-summary-lbl"><?= e(t('dashboard.kpi.cash_risk')) ?></div>
    </div>
    <div class="dd-summary-card">
        <div class="dd-summary-num"><?= $ddCount ?></div>
        <div class="dd-summary-lbl"><?= e(t('store.list')) ?></div>
    </div>
</div>
<?php $ddSummaryHtml = ob_get_clean(); ?>

<?php
$pageTitle = 'Cash Risk';
ob_start();
if (empty($storeRisks)):
?>
<div class="dd-table-wrap"><div class="dd-empty">No unpaid bills found. Payments are clear!</div></div>
<?php else: ?>
<div class="dd-table-wrap">
    <table class="dd-table">
        <thead>
            <tr>
                <th>Store</th>
                <th>Unpaid Bills</th>
                <th>Total Amount</th>
                <th>Overdue Amount</th>
                <th>Oldest Due Date</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($storeRisks as $row):
            $overdueAmt = (float)($row['overdue_amount'] ?? 0);
            $totalAmt   = (float)($row['total_amount']   ?? 0);
            $amtColor   = $overdueAmt > 5000 ? '#dc2626' : ($overdueAmt > 1000 ? '#f59e0b' : '#94a3b8');
        ?>
        <tr>
            <td style="font-weight:600;color:#f1f5f9"><?= e($row['store_name'] ?? '—') ?></td>
            <td><?= (int)($row['unpaid_count'] ?? 0) ?></td>
            <td style="font-weight:700;color:#f1f5f9">$<?= number_format($totalAmt, 0) ?></td>
            <td style="font-weight:700;color:<?= $amtColor ?>">$<?= number_format($overdueAmt, 0) ?></td>
            <td style="white-space:nowrap"><?= e($row['oldest_due'] ? date('d M Y', strtotime($row['oldest_due'])) : '—') ?></td>
            <td>
                <a href="<?= APP_URL ?>/bills/store/<?= (int)($row['store_id'] ?? 0) ?>" class="dd-action-link">View Bills</a>
            </td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php endif; ?>
<?php $ddContent = ob_get_clean(); ?>

<?php require __DIR__ . '/layout.php'; ?>
