<?php
/**
 * Phase 11.5 — Module 3: Notification Center View
 */
$typeLabels = [
    'task_assigned' => 'Task Assigned',
    'task_overdue' => 'Task Overdue',
    'task_due_soon' => 'Due Soon',
    'task_updated' => 'Task Updated',
    'task_commented' => 'Comment',
    'mention' => 'Mention',
    'incident_assigned' => 'Incident',
    'release_approval' => 'Release',
    'audit_failed' => 'Audit Failed',
];

$typeColors = [
    'task_overdue' => '#f87171',
    'incident_assigned' => '#f87171',
    'audit_failed' => '#f87171',
    'release_approval' => '#60a5fa',
    'task_assigned' => '#4ade80',
    'task_due_soon' => '#fbbf24',
    'mention' => '#a78bfa',
];
?>

<div class="notifications-page">
    <!-- Header with actions -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
        <div style="display:flex;gap:8px">
            <a href="<?= APP_URL ?>/notifications?filter=all" class="btn btn-sm <?= $filter === 'all' ? 'btn-primary' : 'btn-secondary' ?>" style="border-radius:20px">
                All <?php if (($counts['total'] ?? 0) > 0): ?><span style="margin-left:4px;opacity:.7">(<?= (int)$counts['total'] ?>)</span><?php endif; ?>
            </a>
            <a href="<?= APP_URL ?>/notifications?filter=unread" class="btn btn-sm <?= $filter === 'unread' ? 'btn-primary' : 'btn-secondary' ?>" style="border-radius:20px">
                Unread <?php if (($counts['unread'] ?? 0) > 0): ?><span style="margin-left:4px;opacity:.7">(<?= (int)$counts['unread'] ?>)</span><?php endif; ?>
            </a>
            <a href="<?= APP_URL ?>/notifications?filter=priority" class="btn btn-sm <?= $filter === 'priority' ? 'btn-primary' : 'btn-secondary' ?>" style="border-radius:20px">
                🔴 Priority <?php if (($counts['priority'] ?? 0) > 0): ?><span style="margin-left:4px;opacity:.7">(<?= (int)$counts['priority'] ?>)</span><?php endif; ?>
            </a>
        </div>
        <form method="POST" action="<?= APP_URL ?>/notifications/mark-read" style="margin:0">
            <input type="hidden" name="csrf_token" value="<?= csrf_token() ?>">
            <button type="submit" class="btn btn-sm btn-secondary">Mark all as read</button>
        </form>
    </div>

    <!-- Notification List -->
    <?php if (!empty($notifications)): ?>
    <div class="notification-list" style="display:flex;flex-direction:column;gap:4px">
        <?php foreach ($notifications as $notif):
            $isUnread = !$notif['is_read'];
            $typeColor = $typeColors[$notif['type'] ?? ''] ?? '#71717a';
            $typeLabel = $typeLabels[$notif['type'] ?? ''] ?? ucwords(str_replace('_', ' ', $notif['type'] ?? 'notification'));
        ?>
        <div class="notif-item" style="display:flex;align-items:start;gap:12px;padding:12px 16px;background:<?= $isUnread ? 'var(--blue-bg)' : 'var(--card-bg)' ?>;border:1px solid var(--border);border-radius:8px;<?= $isUnread ? 'border-left:3px solid var(--blue)' : '' ?>">
            <!-- Status dot -->
            <div style="width:8px;height:8px;border-radius:50%;background:<?= $isUnread ? $typeColor : 'transparent' ?>;margin-top:6px;flex-shrink:0"></div>

            <!-- Content -->
            <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                    <span style="font-size:11px;padding:1px 6px;border-radius:3px;background:<?= $typeColor ?>20;color:<?= $typeColor ?>;font-weight:500"><?= e($typeLabel) ?></span>
                    <span style="font-size:11px;color:var(--text-muted)"><?= date('M j, g:i A', strtotime($notif['created_at'])) ?></span>
                </div>
                <div style="font-size:14px;<?= $isUnread ? 'font-weight:500' : '' ?>"><?= e($notif['message'] ?? $notif['data'] ?? 'Notification') ?></div>
                <?php if (!empty($notif['sender_name'])): ?>
                <div style="font-size:12px;color:var(--text-muted);margin-top:2px">from <?= e($notif['sender_name']) ?></div>
                <?php endif; ?>
            </div>

            <!-- Actions -->
            <div style="display:flex;gap:4px;flex-shrink:0">
                <?php if ($isUnread): ?>
                <form method="POST" action="<?= APP_URL ?>/notifications/mark-read" style="margin:0">
                    <input type="hidden" name="csrf_token" value="<?= csrf_token() ?>">
                    <input type="hidden" name="id" value="<?= $notif['id'] ?>">
                    <button type="submit" class="btn btn-sm btn-ghost" title="Mark read" style="padding:4px 8px">✓</button>
                </form>
                <?php endif; ?>
                <form method="POST" action="<?= APP_URL ?>/notifications/snooze" style="margin:0">
                    <input type="hidden" name="csrf_token" value="<?= csrf_token() ?>">
                    <input type="hidden" name="id" value="<?= $notif['id'] ?>">
                    <input type="hidden" name="snooze_until" value="<?= date('Y-m-d H:i:s', strtotime('+1 hour')) ?>">
                    <button type="submit" class="btn btn-sm btn-ghost" title="Snooze 1h" style="padding:4px 8px">⏰</button>
                </form>
            </div>
        </div>
        <?php endforeach; ?>
    </div>

    <!-- Pagination -->
    <?php if ($totalPages > 1): ?>
    <div style="display:flex;justify-content:center;gap:8px;margin-top:24px">
        <?php if ($page > 1): ?>
        <a href="<?= APP_URL ?>/notifications?page=<?= $page - 1 ?>&filter=<?= $filter ?>" class="btn btn-sm btn-secondary">← Previous</a>
        <?php endif; ?>
        <span style="padding:6px 12px;font-size:13px;color:var(--text-muted)">Page <?= $page ?> of <?= $totalPages ?></span>
        <?php if ($page < $totalPages): ?>
        <a href="<?= APP_URL ?>/notifications?page=<?= $page + 1 ?>&filter=<?= $filter ?>" class="btn btn-sm btn-secondary">Next →</a>
        <?php endif; ?>
    </div>
    <?php endif; ?>

    <?php else: ?>
    <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <div style="font-size:48px;margin-bottom:16px">🔔</div>
        <div style="font-size:16px;font-weight:500;margin-bottom:8px">All caught up!</div>
        <div style="font-size:13px">No notifications to show.</div>
    </div>
    <?php endif; ?>
</div>
