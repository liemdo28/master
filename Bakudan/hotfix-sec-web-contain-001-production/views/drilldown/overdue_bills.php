<?php
// $bills, $totalAmount passed from controller
$ddTitle     = 'Overdue Bills';
$ddCount     = count($bills);
$ddRiskLevel = $ddCount > 5 ? 'critical' : ($ddCount > 1 ? 'high' : 'low');

$pageTitle = 'Overdue Bills';
ob_start();
?>
<div class="dd-summary-bar">
    <div class="dd-summary-card">
        <div class="dd-summary-num" style="color:#dc2626"><?= number_format($ddCount) ?></div>
        <div class="dd-summary-lbl">Overdue Bills</div>
    </div>
    <div class="dd-summary-card">
        <div class="dd-summary-num" style="color:#f59e0b">$<?= number_format($totalAmount, 0) ?></div>
        <div class="dd-summary-lbl">Total At Risk</div>
    </div>
</div>
<?php $ddSummaryHtml = ob_get_clean(); ?>

<?php
$pageTitle = 'Overdue Bills';
ob_start();
if (empty($bills)):
?>
<div class="dd-table-wrap"><div class="dd-empty">No overdue bills found. All caught up!</div></div>
<?php else: ?>
<div class="dd-table-wrap">
    <table class="dd-table">
        <thead>
            <tr>
                <th>Bill Name</th>
                <th>Vendor</th>
                <th>Store</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>Overdue Days</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($bills as $bill):
            $days = (int)($bill['overdue_days'] ?? 0);
            $amtColor = $days > 30 ? '#dc2626' : ($days > 14 ? '#f59e0b' : '#94a3b8');
        ?>
        <tr>
            <td style="font-weight:600;color:#f1f5f9"><?= e($bill['name'] ?? $bill['title'] ?? '—') ?></td>
            <td><?= e($bill['vendor_name'] ?? '—') ?></td>
            <td><?= e($bill['store_name'] ?? '—') ?></td>
            <td style="font-weight:700;color:<?= $amtColor ?>">$<?= number_format((float)($bill['amount'] ?? 0), 2) ?></td>
            <td style="white-space:nowrap"><?= e($bill['due_date'] ? date('d M Y', strtotime($bill['due_date'])) : '—') ?></td>
            <td>
                <span class="dd-risk-pill" style="background:<?= $amtColor ?>18;color:<?= $amtColor ?>">
                    <?= $days ?>d
                </span>
            </td>
            <td><?= e($bill['owner_name'] ?? '—') ?></td>
            <td>
                <span class="dd-risk-pill" style="background:rgba(220,38,38,.12);color:#f87171">
                    <?= strtoupper($bill['status'] ?? 'overdue') ?>
                </span>
            </td>
            <td>
                <a href="<?= APP_URL ?>/bills/<?= (int)$bill['id'] ?>" class="dd-action-link">View Bill</a>
            </td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php endif; ?>
<?php $ddContent = ob_get_clean(); ?>

<?php require __DIR__ . '/layout.php'; ?>
