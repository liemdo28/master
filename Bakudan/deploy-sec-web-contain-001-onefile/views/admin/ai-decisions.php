<?php $pageTitle = 'AI Decisions';  ?>
<div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
    <h1 style="font-size: 28px; margin-bottom: 24px;">🤖 AI Decision Support</h1>
    <a href="/admin/command-center" class="btn">← Back</a>
    
    <div style="margin-top: 24px;">
        <h2 style="font-size: 20px; margin-bottom: 16px;">Executive Decision Summary</h2>
        
        <?php if (empty($summary['urgent_decisions'])): ?>
        <div class="card" style="text-align: center; padding: 40px; color: #6b7280;">
            <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
            <p>No urgent decisions required. System is healthy.</p>
        </div>
        <?php else: ?>
        <?php foreach ($summary['urgent_decisions'] as $d): ?>
        <div class="decision-card">
            <span class="badge"><?= $d['type'] ?></span>
            <p><?= htmlspecialchars($d['message']) ?></p>
            <?php if (!empty($d['store'])): ?>
            <div style="font-size: 12px; color: #6b7280;">Store: <?= htmlspecialchars($d['store']) ?></div>
            <?php endif; ?>
        </div>
        <?php endforeach; ?>
        <?php endif; ?>
    </div>
</div>
<style>
.card { background: white; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb; }
.decision-card { background: white; border-radius: 8px; padding: 16px; border: 1px solid #e5e7eb; margin-bottom: 12px; border-left: 4px solid #f59e0b; }
.badge { background: #fef3c7; color: #d97706; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
.btn { background: #f3f4f6; color: #374151; padding: 8px 16px; border-radius: 6px; text-decoration: none; }
</style>
