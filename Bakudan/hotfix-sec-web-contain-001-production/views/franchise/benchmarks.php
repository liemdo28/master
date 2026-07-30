<?php
$pageTitle = 'Store Benchmarks';
$currentPage = 'admin-benchmarks';
ob_start();
?>
<style>
.bm-section{margin-bottom:28px}
.bm-section h3{font-size:14px;color:#a1a1aa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
.bm-table{width:100%;border-collapse:collapse;background:#18181b;border:1px solid #27272a;border-radius:10px;overflow:hidden}
.bm-table th{text-align:left;padding:10px 14px;font-size:12px;color:#71717a;background:#09090b}
.bm-table td{padding:10px 14px;border-top:1px solid #1f1f23;font-size:14px;color:#d4d4d8}
.bm-table tr:hover td{background:#1c1c20}
.bm-rank{width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
.bm-rank--gold{background:#422006;color:#fbbf24}
.bm-rank--silver{background:#27272a;color:#d4d4d8}
.bm-rank--bronze{background:#451a03;color:#fb923c}
.bm-score{font-weight:600}
.bm-score--high{color:#4ade80}
.bm-score--mid{color:#fbbf24}
.bm-score--low{color:#f87171}
.bm-empty{text-align:center;padding:40px;color:#71717a}
</style>

<?php if (empty($benchmarks['top']) && empty($benchmarks['bottom'])): ?>
<div class="bm-empty">
    <h3 style="color:#a1a1aa">No benchmark data yet</h3>
    <p>KPI snapshots will be calculated daily. Run the KPI cron job to generate initial data.</p>
</div>
<?php else: ?>

<?php if ($benchmarks['date'] ?? null): ?>
<p style="font-size:12px;color:#71717a;margin-bottom:20px">Data as of <?= date('M j, Y', strtotime($benchmarks['date'])) ?></p>
<?php endif; ?>

<div class="bm-section">
    <h3>🏆 Top Performing Stores</h3>
    <table class="bm-table">
        <thead><tr><th>#</th><th>Store</th><th>Health Score</th><th>Task Completion</th><th>Audit</th></tr></thead>
        <tbody>
        <?php foreach ($benchmarks['top'] as $i => $s): ?>
        <tr>
            <td><span class="bm-rank <?= $i===0?'bm-rank--gold':($i===1?'bm-rank--silver':($i===2?'bm-rank--bronze':'')) ?>"><?= $i+1 ?></span></td>
            <td style="color:#f4f4f5;font-weight:500"><?= e($s['store_name']) ?></td>
            <td><span class="bm-score bm-score--high"><?= number_format((float)$s['store_health_score'],1) ?>%</span></td>
            <td><?= $s['task_completion_pct'] !== null ? number_format((float)$s['task_completion_pct'],1).'%' : '—' ?></td>
            <td><?= $s['audit_score'] !== null ? number_format((float)$s['audit_score'],1).'%' : '—' ?></td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>

<div class="bm-section">
    <h3>⚠ Lowest Performing Stores</h3>
    <table class="bm-table">
        <thead><tr><th>#</th><th>Store</th><th>Health Score</th><th>Completion</th><th>Overdue %</th></tr></thead>
        <tbody>
        <?php foreach ($benchmarks['bottom'] as $i => $s): ?>
        <tr>
            <td style="color:#71717a"><?= $i+1 ?></td>
            <td style="color:#f4f4f5"><?= e($s['store_name']) ?></td>
            <td><span class="bm-score bm-score--low"><?= number_format((float)$s['store_health_score'],1) ?>%</span></td>
            <td><?= $s['task_completion_pct'] !== null ? number_format((float)$s['task_completion_pct'],1).'%' : '—' ?></td>
            <td style="color:#fca5a5"><?= $s['overdue_pct'] !== null ? number_format((float)$s['overdue_pct'],1).'%' : '—' ?></td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>

<?php if (!empty($benchmarks['most_improved'])): ?>
<div class="bm-section">
    <h3>📈 Most Improved (7 days)</h3>
    <table class="bm-table">
        <thead><tr><th>Store</th><th>Previous</th><th>Current</th><th>Change</th></tr></thead>
        <tbody>
        <?php foreach ($benchmarks['most_improved'] as $s): ?>
        <tr>
            <td style="color:#f4f4f5"><?= e($s['store_name']) ?></td>
            <td><?= number_format((float)$s['prev_score'],1) ?>%</td>
            <td><?= number_format((float)$s['current_score'],1) ?>%</td>
            <td style="color:#4ade80">+<?= number_format((float)$s['improvement'],1) ?></td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php endif; ?>

<?php endif; ?>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
