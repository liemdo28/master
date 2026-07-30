<?php $pageTitle = 'Recommendations';  ?>

<div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
    <h1 style="font-size: 28px; margin-bottom: 24px;">💡 Operational Recommendations</h1>
    <a href="/admin/command-center" class="btn">← Back</a>

    <?php if (empty($recommendations)): ?>
    <div style="text-align: center; padding: 60px; color: #6b7280;">
        <div style="font-size: 48px; margin-bottom: 16px;">✨</div>
        <p>No pending recommendations.</p>
    </div>
    <?php else: ?>
    <?php foreach ($recommendations as $rec): ?>
    <div class="rec-card" style="margin-top: 16px;">
        <span class="priority <?= $rec['priority'] ?>"><?= ucfirst($rec['priority']) ?></span>
        <h3><?= htmlspecialchars($rec['title']) ?></h3>
        <p><?= htmlspecialchars($rec['description']) ?></p>
        <div style="display: flex; gap: 8px; margin-top: 12px;">
            <button class="btn-success" onclick="accept(<?= $rec['id'] ?>)">Accept</button>
            <button class="btn" onclick="reject(<?= $rec['id'] ?>)">Dismiss</button>
        </div>
    </div>
    <?php endforeach; ?>
    <?php endif; ?>
</div>

<style>
.rec-card { background: white; border-radius: 12px; padding: 20px; border: 1px solid #e5e7eb; }
.priority { display: inline-block; padding: 2px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
.priority.urgent { background: #fee2e2; color: #dc2626; }
.priority.high { background: #fef3c7; color: #d97706; }
.priority.medium { background: #dbeafe; color: #2563eb; }
.btn { background: #f3f4f6; color: #374151; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; }
.btn-success { background: #10b981; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; }
</style>

<script>
function accept(id) { fetch('/admin/command-center/recommendations/' + id + '/accept', { method: 'POST' }).then(() => location.reload()); }
function reject(id) { fetch('/admin/command-center/recommendations/' + id + '/reject', { method: 'POST' }).then(() => location.reload()); }
</script>

