<?php $pageTitle = 'Notifications';  ?>
<div style="max-width: 900px; margin: 0 auto; padding: 20px;">
    <h1 style="font-size: 28px; margin-bottom: 24px;">🔔 Notification Hub</h1>
    <a href="/admin/command-center" class="btn">← Back</a>
    <?php if (empty($notifications)): ?>
    <p style="color: #6b7280; margin-top: 24px;">No notifications.</p>
    <?php else: ?>
    <div style="margin-top: 24px;">
        <?php foreach ($notifications as $n): ?>
        <div style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e7eb; <?= $n['is_read'] ? 'opacity: 0.7;' : '' ?>">
            <div style="font-weight: 600;"><?= htmlspecialchars($n['title']) ?></div>
            <div style="color: #6b7280; font-size: 14px; margin-top: 4px;"><?= htmlspecialchars($n['body']) ?></div>
            <div style="font-size: 12px; color: #9ca3af; margin-top: 8px;"><?= timeAgo($n['created_at']) ?></div>
        </div>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>
</div>
<style>.btn { background: #f3f4f6; color: #374151; padding: 8px 16px; border-radius: 6px; text-decoration: none; }</style>
