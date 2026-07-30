<?php
/**
 * Generic bill drill-down view — used by billsByCategory + billsByStore
 * Variables: $bills, $totalAmount, $pageTitle
 */
?>
<div style="padding:0 0 24px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div>
            <h2 style="color:#f1f5f9;font-size:20px;font-weight:700;margin:0;"><?= e($pageTitle) ?></h2>
            <div style="color:#94a3b8;font-size:14px;margin-top:4px;">
                <?= count($bills) ?> bill(s) &middot; Total: $<?= number_format($totalAmount, 2) ?>
            </div>
        </div>
        <a href="javascript:history.back()" style="color:#60a5fa;font-size:13px;text-decoration:none;">&#8592; Back</a>
    </div>

    <?php if (empty($bills)): ?>
        <div style="background:#1e2a3b;border-radius:12px;padding:40px;text-align:center;color:#94a3b8;">
            No bills found.
        </div>
    <?php else: ?>
        <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;background:#1e2a3b;border-radius:12px;overflow:hidden;min-width:900px;">
                <thead>
                    <tr style="background:#0f172a;">
                        <th style="padding:10px 14px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Bill Name</th>
                        <th style="padding:10px 14px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Category</th>
                        <th style="padding:10px 14px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Store</th>
                        <th style="padding:10px 14px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Vendor</th>
                        <th style="padding:10px 14px;text-align:right;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Amount</th>
                        <th style="padding:10px 14px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Due Date</th>
                        <th style="padding:10px 14px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Overdue</th>
                        <th style="padding:10px 14px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Responsible</th>
                        <th style="padding:10px 14px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Checker</th>
                        <th style="padding:10px 14px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Approver</th>
                        <th style="padding:10px 14px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Verifier</th>
                        <th style="padding:10px 14px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Status</th>
                        <th style="padding:10px 14px;text-align:center;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Docs</th>
                        <th style="padding:10px 14px;text-align:left;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">Action</th>
                    </tr>
                </thead>
                <tbody>
                <?php foreach ($bills as $bill): ?>
                    <?php
                        $isOverdue = !empty($bill['due_date']) && substr($bill['due_date'],0,10) < app_today() && $bill['status'] !== 'paid';
                        $overdueDays = (int)($bill['overdue_days'] ?? 0);
                        $statusColors = [
                            'paid'      => '#4ade80',
                            'pending'   => '#fbbf24',
                            'overdue'   => '#f87171',
                            'cancelled' => '#6b7280',
                        ];
                        $statusColor = $statusColors[$bill['status'] ?? ''] ?? '#94a3b8';
                    ?>
                    <tr style="border-top:1px solid #334155;">
                        <td style="padding:10px 14px;color:#f1f5f9;font-size:13px;font-weight:500;"><?= e($bill['title'] ?? '') ?></td>
                        <td style="padding:10px 14px;color:#94a3b8;font-size:12px;"><?= e($bill['category'] ?? '') ?></td>
                        <td style="padding:10px 14px;color:#94a3b8;font-size:12px;"><?= e($bill['store_name'] ?? '') ?></td>
                        <td style="padding:10px 14px;color:#94a3b8;font-size:12px;"><?= e($bill['vendor_name'] ?? '') ?></td>
                        <td style="padding:10px 14px;color:#f1f5f9;font-size:13px;text-align:right;font-weight:600;">
                            <?= $bill['amount'] ? '$' . number_format((float)$bill['amount'], 2) : '—' ?>
                        </td>
                        <td style="padding:10px 14px;color:<?= $isOverdue ? '#f87171' : '#94a3b8' ?>;font-size:12px;">
                            <?= e(substr($bill['due_date'] ?? '', 0, 10)) ?>
                        </td>
                        <td style="padding:10px 14px;font-size:12px;color:<?= $isOverdue ? '#f87171' : '#6b7280' ?>;">
                            <?= $isOverdue ? $overdueDays . 'd' : '—' ?>
                        </td>
                        <td style="padding:10px 14px;color:#94a3b8;font-size:12px;"><?= e($bill['responsible_name'] ?? '—') ?></td>
                        <td style="padding:10px 14px;color:#94a3b8;font-size:12px;"><?= e($bill['checker_name'] ?? '—') ?></td>
                        <td style="padding:10px 14px;color:#94a3b8;font-size:12px;"><?= e($bill['approver_name'] ?? '—') ?></td>
                        <td style="padding:10px 14px;color:#94a3b8;font-size:12px;"><?= e($bill['verifier_name'] ?? '—') ?></td>
                        <td style="padding:10px 14px;">
                            <span style="color:<?= $statusColor ?>;font-size:12px;font-weight:600;text-transform:capitalize;"><?= e($bill['status'] ?? '') ?></span>
                        </td>
                        <td style="padding:10px 14px;text-align:center;color:#94a3b8;font-size:12px;">
                            <?= (int)($bill['evidence_count'] ?? 0) > 0 ? '<span style="color:#4ade80;">&#128206; ' . (int)$bill['evidence_count'] . '</span>' : '—' ?>
                        </td>
                        <td style="padding:10px 14px;">
                            <div style="display:flex;gap:6px;align-items:center;">
                                <a href="<?= APP_URL ?>/bills/store/<?= (int)($bill['store_id'] ?? 0) ?>"
                                   style="color:#60a5fa;font-size:12px;text-decoration:none;white-space:nowrap;">View</a>
                                <?php if ($bill['status'] !== 'paid' && canManage()): ?>
                                    <form method="POST" action="<?= APP_URL ?>/bills/<?= (int)$bill['id'] ?>/pay" style="margin:0;"
                                          onsubmit="return confirm('Mark this bill as paid?')">
                                        <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                                        <button type="submit" style="background:#1a3a2a;color:#4ade80;border:1px solid #166534;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:11px;">Mark Paid</button>
                                    </form>
                                <?php endif; ?>
                            </div>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php endif; ?>
</div>
