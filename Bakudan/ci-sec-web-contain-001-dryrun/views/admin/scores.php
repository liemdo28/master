<?php
/**
 * Phase 8 — Enterprise Score System View
 */
$pageTitle = 'Scores';
?>

<div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
    <h1 style="font-size: 28px; margin-bottom: 24px;">📊 Enterprise Score System</h1>
    <a href="/admin/command-center" class="btn">← Back</a>

    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top: 24px;">
        <?php foreach ($stores as $storeId => $data): 
            $score = $data['score']['score'] ?? 0;
            $color = $score >= 80 ? '#10b981' : ($score >= 60 ? '#3b82f6' : ($score >= 40 ? '#f59e0b' : '#ef4444'));
        ?>
        <div class="score-card">
            <h3><?= htmlspecialchars($data['name']) ?></h3>
            <div style="font-size: 48px; font-weight: 700; color: <?= $color ?>;"><?= round($score) ?></div>
            <div style="font-size: 14px; color: #6b7280;">Score / 100</div>
            <div style="margin-top: 16px;">
                <div style="height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
                    <div style="width: <?= $score ?>%; height: 100%; background: <?= $color ?>;"></div>
                </div>
            </div>
            <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">
                Tasks: <?= round($data['score']['components']['tasks'] ?? 0) ?> |
                Compliance: <?= round($data['score']['components']['compliance'] ?? 0) ?> |
                Payroll: <?= round($data['score']['components']['payroll'] ?? 0) ?>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
</div>

<style>
.score-card { background: white; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb; }
.btn { background: #f3f4f6; color: #374151; padding: 8px 16px; border-radius: 6px; text-decoration: none; }
</style>

