<?php
/**
 * Phase 8 — Predictive Incident Engine View
 */
$pageTitle = 'Predictions';
?>

<div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
    <h1 style="font-size: 28px; margin-bottom: 24px;">🔮 Predictive Incident Engine</h1>
    
    <div style="display: flex; gap: 12px; margin-bottom: 24px;">
        <a href="/admin/command-center" class="btn">← Back to Command Center</a>
        <button onclick="runPrediction()" class="btn-primary">Run Prediction Scan</button>
    </div>

    <div class="card">
        <h2>Active Predictions (<?= count($predictions) ?>)</h2>
        <?php if (empty($predictions)): ?>
        <p style="color: #6b7280;">No active predictions. System is operating normally.</p>
        <?php else: ?>
        <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #e5e7eb; background: #f9fafb;">
                <th style="padding: 12px; text-align: left;">Type</th>
                <th style="padding: 12px; text-align: left;">Probability</th>
                <th style="padding: 12px; text-align: left;">Severity</th>
                <th style="padding: 12px; text-align: left;">Horizon</th>
                <th style="padding: 12px; text-align: left;">Description</th>
                <th style="padding: 12px;">Actions</th>
            </tr>
            <?php foreach ($predictions as $p): ?>
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px;"><?= str_replace('_', ' ', $p['prediction_type']) ?></td>
                <td style="padding: 12px; font-weight: 700;"><?= round($p['probability']) ?>%</td>
                <td style="padding: 12px;"><span style="background: <?= $p['severity'] === 'critical' ? '#fee2e2' : ($p['severity'] === 'high' ? '#fef3c7' : '#dbeafe') ?>; padding: 2px 8px; border-radius: 4px;"><?= ucfirst($p['severity']) ?></span></td>
                <td style="padding: 12px;"><?= $p['horizon_hours'] ?>h</td>
                <td style="padding: 12px; max-width: 300px;"><?= htmlspecialchars($p['description']) ?></td>
                <td style="padding: 12px;">
                    <button class="btn-small" onclick="acknowledge(<?= $p['id'] ?>)">Ack</button>
                    <button class="btn-small btn-success" onclick="prevented(<?= $p['id'] ?>)">Prevented</button>
                </td>
            </tr>
            <?php endforeach; ?>
        </table>
        <?php endif; ?>
    </div>
</div>

<style>
.card { background: white; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb; margin-bottom: 16px; }
.btn { background: #f3f4f6; color: #374151; padding: 8px 16px; border-radius: 6px; text-decoration: none; }
.btn-primary { background: #3b82f6; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; }
.btn-small { background: #f3f4f6; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; }
.btn-success { background: #10b981; color: white; }
</style>

<script>
function runPrediction() {
    fetch('/admin/command-center/predictions/run', { method: 'POST' })
        .then(r => r.json())
        .then(() => location.reload());
}
function acknowledge(id) { fetch('/admin/command-center/predictions/' + id + '/acknowledge', { method: 'POST' }).then(() => location.reload()); }
function prevented(id) { fetch('/admin/command-center/predictions/' + id + '/prevent', { method: 'POST' }).then(() => location.reload()); }
</script>

