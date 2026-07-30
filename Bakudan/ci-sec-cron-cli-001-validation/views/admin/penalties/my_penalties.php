<?php
/**
 * /my-penalties — Member's own penalty view
 */
?>
<div style="max-width:700px;margin:0 auto;padding:24px 16px">
    <div style="margin-bottom:20px">
        <h1 style="font-size:20px;font-weight:700;color:#f1f5f9">My Penalties</h1>
        <p style="font-size:13px;color:#64748b">Late task penalties accrued for your account.</p>
    </div>

    <?php if (!$penalized || empty($detail)): ?>
    <div style="background:#0f2027;border:1px solid #1f2937;border-radius:12px;padding:32px;text-align:center">
        <div style="font-size:32px;margin-bottom:12px">✅</div>
        <div style="font-size:15px;font-weight:600;color:#4ade80">No penalties on record</div>
        <div style="font-size:13px;color:#64748b;margin-top:6px">Keep completing tasks on time!</div>
    </div>
    <?php else: ?>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
        <div style="background:#1e1e2e;border:1px solid #2d2d3d;border-radius:10px;padding:16px">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;margin-bottom:4px">Total Penalties</div>
            <div style="font-size:22px;font-weight:700;color:#fca5a5"><?= number_format((float)$detail['total_amount'], 0, '.', ',') ?> VND</div>
        </div>
        <div style="background:#1e1e2e;border:1px solid #2d2d3d;border-radius:10px;padding:16px">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;margin-bottom:4px">Late Tasks</div>
            <div style="font-size:22px;font-weight:700;color:#fb923c"><?= (int)($detail['late_count'] ?? 0) ?></div>
        </div>
        <div style="background:#1e1e2e;border:1px solid #2d2d3d;border-radius:10px;padding:16px">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;margin-bottom:4px">Per Late Task</div>
            <div style="font-size:22px;font-weight:700;color:#f1f5f9"><?= number_format((float)($detail['config']['amount_per_late_task'] ?? 0), 0, '.', ',') ?> VND</div>
        </div>
    </div>

    <?php if (!empty($detail['log'])): ?>
    <div style="background:#1e1e2e;border:1px solid #2d2d3d;border-radius:12px;overflow:hidden">
        <div style="padding:14px 16px;border-bottom:1px solid #2d2d3d;font-size:13px;font-weight:600;color:#94a3b8">Penalty Log</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
                <tr style="background:#161622">
                    <th style="padding:10px 16px;text-align:left;color:#64748b;font-weight:500">Task</th>
                    <th style="padding:10px 16px;text-align:center;color:#64748b;font-weight:500">Late Days</th>
                    <th style="padding:10px 16px;text-align:right;color:#64748b;font-weight:500">Amount</th>
                    <th style="padding:10px 16px;text-align:right;color:#64748b;font-weight:500">Date</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($detail['log'] as $row): ?>
                <tr style="border-top:1px solid #1f2937">
                    <td style="padding:10px 16px;color:#e2e8f0"><?= e($row['task_title'] ?? "Task #{$row['task_id']}") ?></td>
                    <td style="padding:10px 16px;text-align:center;color:#fb923c"><?= (int)$row['late_days'] ?></td>
                    <td style="padding:10px 16px;text-align:right;color:#fca5a5;font-weight:600"><?= number_format((float)$row['amount'], 0, '.', ',') ?></td>
                    <td style="padding:10px 16px;text-align:right;color:#64748b"><?= date('M j, Y', strtotime($row['calculated_at'])) ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php endif; ?>
    <?php endif; ?>
</div>
