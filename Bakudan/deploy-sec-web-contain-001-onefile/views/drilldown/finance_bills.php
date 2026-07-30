<?php
// $bills, $totalAmount, $risk passed from controller
$riskLabel = ucfirst($risk ?? 'all');
$ddTitle     = "{$riskLabel} Risk Bills";
$ddCount     = count($bills);
$ddRiskLevel = $risk ?? 'info';

$riskColors = [
    'critical' => '#dc2626',
    'high'     => '#f59e0b',
    'medium'   => '#3b82f6',
    'low'      => '#22c55e',
    'all'      => '#64748b',
];
$riskColor = $riskColors[$risk ?? 'all'] ?? '#64748b';

$pageTitle = 'Finance Bills';
ob_start();
?>
<div class="dd-summary-bar">
    <div class="dd-summary-card">
        <div class="dd-summary-num" style="color:<?= $riskColor ?>"><?= $ddCount ?></div>
        <div class="dd-summary-lbl"><?= $riskLabel ?> Risk Bills</div>
    </div>
    <div class="dd-summary-card">
        <div class="dd-summary-num" style="color:<?= $riskColor ?>">$<?= number_format((float)$totalAmount, 0) ?></div>
        <div class="dd-summary-lbl">Total Exposure</div>
    </div>
</div>
<?php $ddSummaryHtml = ob_get_clean(); ?>

<?php
$pageTitle = 'Finance Bills';
ob_start();
if (empty($bills)):
?>
<div class="dd-table-wrap"><div class="dd-empty">No <?= e($riskLabel) ?> risk bills found.</div></div>
<?php else: ?>
<div class="dd-table-wrap">
    <table class="dd-table">
        <thead>
            <tr>
                <th>Bill</th>
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
            $isOverdue = $days > 0;
            $daysColor = $isOverdue ? ($days > 30 ? '#dc2626' : '#f59e0b') : '#22c55e';
        ?>
        <tr>
            <td style="font-weight:600;color:#f1f5f9"><?= e($bill['name'] ?? $bill['title'] ?? '—') ?></td>
            <td><?= e($bill['vendor_name'] ?? '—') ?></td>
            <td><?= e($bill['store_name'] ?? '—') ?></td>
            <td style="font-weight:700;color:<?= $riskColor ?>">$<?= number_format((float)($bill['amount'] ?? 0), 2) ?></td>
            <td style="white-space:nowrap"><?= e($bill['due_date'] ? date('d M Y', strtotime($bill['due_date'])) : '—') ?></td>
            <td>
                <?php if ($isOverdue): ?>
                <span class="dd-risk-pill" style="background:<?= $daysColor ?>18;color:<?= $daysColor ?>"><?= $days ?>d</span>
                <?php elseif (abs($days) <= 30): ?>
                <span class="dd-risk-pill" style="background:rgba(34,197,94,.12);color:#22c55e">Due in <?= abs($days) ?>d</span>
                <?php else: ?>
                <span style="color:#64748b">—</span>
                <?php endif; ?>
            </td>
            <td><?= e($bill['owner_name'] ?? '—') ?></td>
            <td>
                <span class="dd-risk-pill" style="background:rgba(100,116,139,.12);color:#94a3b8">
                    <?= strtoupper($bill['status'] ?? '—') ?>
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
