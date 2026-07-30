<?php
/**
 * /ceo/penalties — CEO read-only penalty summary
 */
$summaries = $summaries ?? [];
?>
<div style="max-width:900px;margin:0 auto;padding:24px 16px">
    <div style="margin-bottom:20px">
        <h1 style="font-size:20px;font-weight:700;color:#f1f5f9">Penalty Overview</h1>
        <p style="font-size:13px;color:#64748b">Company-wide late task penalty summary. Read-only.</p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px">
        <div style="background:#1e1e2e;border:1px solid #2d2d3d;border-radius:10px;padding:18px">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;margin-bottom:4px">Total Penalized Members</div>
            <div style="font-size:28px;font-weight:700;color:#f87171"><?= $penalized ?></div>
        </div>
        <div style="background:#1e1e2e;border:1px solid #2d2d3d;border-radius:10px;padding:18px">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;margin-bottom:4px">Total Accrued</div>
            <div style="font-size:28px;font-weight:700;color:#fca5a5"><?= number_format((float)$total, 0, '.', ',') ?> VND</div>
        </div>
    </div>

    <?php if (empty($summaries)): ?>
    <div style="background:#0f2027;border:1px solid #1f2937;border-radius:12px;padding:32px;text-align:center">
        <div style="font-size:15px;color:#4ade80">No active penalties.</div>
    </div>
    <?php else: ?>
    <div style="background:#1e1e2e;border:1px solid #2d2d3d;border-radius:12px;overflow:hidden">
        <div style="padding:12px 16px;border-bottom:1px solid #2d2d3d;font-size:12px;color:#64748b">Sorted by total amount descending</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
                <tr style="background:#161622">
                    <th style="padding:12px 16px;text-align:left;color:#64748b;font-weight:500">Member</th>
                    <th style="padding:12px 16px;text-align:center;color:#64748b;font-weight:500">Late Tasks</th>
                    <th style="padding:12px 16px;text-align:right;color:#64748b;font-weight:500">Total (VND)</th>
                </tr>
            </thead>
            <tbody>
                <?php usort($summaries, fn($a,$b) => $b['total_amount'] <=> $a['total_amount']); ?>
                <?php foreach ($summaries as $s): ?>
                <tr style="border-top:1px solid #1f2937">
                    <td style="padding:12px 16px;color:#e2e8f0;font-weight:600"><?= e($s['user_name'] ?? '—') ?></td>
                    <td style="padding:12px 16px;text-align:center;color:#fb923c"><?= (int)($s['late_count'] ?? 0) ?></td>
                    <td style="padding:12px 16px;text-align:right;color:#fca5a5;font-weight:700"><?= number_format((float)($s['total_amount'] ?? 0), 0, '.', ',') ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php endif; ?>
</div>
