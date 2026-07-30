<?php
/**
 * /manager/penalties — Manager team penalty view (read + manage for own team)
 */
$summaries = $allSummaries ?? [];
?>
<div style="max-width:900px;margin:0 auto;padding:24px 16px">
    <div style="margin-bottom:20px">
        <h1 style="font-size:20px;font-weight:700;color:#f1f5f9">Team Penalties</h1>
        <p style="font-size:13px;color:#64748b">Penalty overview for members under your stores.</p>
    </div>

    <?php if (empty($summaries)): ?>
    <div style="background:#0f2027;border:1px solid #1f2937;border-radius:12px;padding:32px;text-align:center">
        <div style="font-size:15px;color:#4ade80">No penalties in your team.</div>
    </div>
    <?php else: ?>
    <div style="background:#1e1e2e;border:1px solid #2d2d3d;border-radius:12px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
                <tr style="background:#161622">
                    <th style="padding:12px 16px;text-align:left;color:#64748b;font-weight:500">Member</th>
                    <th style="padding:12px 16px;text-align:center;color:#64748b;font-weight:500">Late Tasks</th>
                    <th style="padding:12px 16px;text-align:right;color:#64748b;font-weight:500">Total Amount</th>
                    <th style="padding:12px 16px;text-align:center;color:#64748b;font-weight:500">Status</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($summaries as $s): ?>
                <tr style="border-top:1px solid #1f2937">
                    <td style="padding:12px 16px;color:#e2e8f0;font-weight:600"><?= e($s['user_name'] ?? '—') ?></td>
                    <td style="padding:12px 16px;text-align:center;color:#fb923c"><?= (int)($s['late_count'] ?? 0) ?></td>
                    <td style="padding:12px 16px;text-align:right;color:#fca5a5;font-weight:700"><?= number_format((float)($s['total_amount'] ?? 0), 0, '.', ',') ?> VND</td>
                    <td style="padding:12px 16px;text-align:center">
                        <?php if (!empty($s['is_active'])): ?>
                        <span style="background:rgba(239,68,68,.15);color:#f87171;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600">ACTIVE</span>
                        <?php else: ?>
                        <span style="background:rgba(100,116,139,.15);color:#64748b;padding:3px 10px;border-radius:999px;font-size:11px">OFF</span>
                        <?php endif; ?>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php endif; ?>
</div>
