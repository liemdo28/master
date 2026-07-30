<?php
/**
 * Inbox — Task notification inbox powered by TaskNotification model
 * Shows: task_assigned, review_requested, mention, approval, etc.
 */
$pageTitle = 'Inbox';
$currentPage = 'inbox';

$typeConfig = [
    'task_assigned'                => ['icon' => 'target',       'color' => '#60a5fa', 'bg' => 'rgba(96,165,250,.12)'],
    'task_submitted'               => ['icon' => 'upload',       'color' => '#60a5fa', 'bg' => 'rgba(96,165,250,.12)'],
    'task_completed'               => ['icon' => 'check-circle', 'color' => '#4ade80', 'bg' => 'rgba(74,222,128,.12)'],
    'task_completed_final'         => ['icon' => 'check-circle', 'color' => '#4ade80', 'bg' => 'rgba(74,222,128,.12)'],
    'review_requested'             => ['icon' => 'eye',          'color' => '#fbbf24', 'bg' => 'rgba(251,191,36,.12)'],
    'review_approved'              => ['icon' => 'thumbs-up',    'color' => '#4ade80', 'bg' => 'rgba(74,222,128,.12)'],
    'review_rejected'              => ['icon' => 'x-circle',     'color' => '#f87171', 'bg' => 'rgba(248,113,113,.12)'],
    'approval_requested'           => ['icon' => 'check-square', 'color' => '#a78bfa', 'bg' => 'rgba(167,139,250,.12)'],
    'approval_approved'            => ['icon' => 'award',        'color' => '#4ade80', 'bg' => 'rgba(74,222,128,.12)'],
    'approval_rejected'            => ['icon' => 'x-circle',     'color' => '#f87171', 'bg' => 'rgba(248,113,113,.12)'],
    'mentioned_in_comment'         => ['icon' => 'at-sign',      'color' => '#34d399', 'bg' => 'rgba(52,211,153,.12)'],
    'mentioned_in_reviewer_note'   => ['icon' => 'at-sign',      'color' => '#34d399', 'bg' => 'rgba(52,211,153,.12)'],
    'mentioned_in_approval_note'   => ['icon' => 'at-sign',      'color' => '#34d399', 'bg' => 'rgba(52,211,153,.12)'],
    'request_changes'              => ['icon' => 'refresh-cw',   'color' => '#fbbf24', 'bg' => 'rgba(251,191,36,.12)'],
    'task_overdue'                 => ['icon' => 'alert-triangle','color' => '#f87171','bg' => 'rgba(248,113,113,.12)'],
];

$filterTabs = [
    'all'      => ['label' => 'All',      'key' => 'total'],
    'unread'   => ['label' => 'Unread',   'key' => 'unread'],
    'mentions' => ['label' => '@Mentions', 'key' => 'mentions_unread'],
    'review'   => ['label' => 'Review',    'key' => 'review_unread'],
    'approval' => ['label' => 'Approval',  'key' => 'approval_unread'],
];

ob_start();
?>

<style>
.inbox-filters{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}
.filter-tab{padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid var(--border,#30363d);background:transparent;color:var(--text-secondary,#8b949e);transition:all .15s;text-decoration:none}
.filter-tab:hover{border-color:#3b82f6;color:#3b82f6}
.filter-tab.active{background:#3b82f6;color:#fff;border-color:#3b82f6}
.inbox-item{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border,#21262d);transition:background .1s;text-decoration:none;cursor:pointer}
.inbox-item:hover{background:rgba(255,255,255,.03)}
.inbox-item:last-child{border-bottom:none}
.inbox-item.unread{background:rgba(59,130,246,.05);border-left:3px solid #3b82f6}
.inbox-item.unread .inbox-title{font-weight:700;color:#e4e4e7}
.inbox-icon{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.inbox-body{flex:1;min-width:0}
.inbox-title{font-size:13px;font-weight:600;color:#c9d1d9;line-height:1.4}
.inbox-msg{font-size:12px;color:#6e7681;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.inbox-meta{display:flex;align-items:center;gap:6px;margin-top:4px}
.inbox-from{font-size:11px;color:#6e7681}
.inbox-task-badge{font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,.06);color:#6e7681}
.inbox-time{font-size:11px;color:#484f58;white-space:nowrap;flex-shrink:0;margin-top:2px}
.inbox-category-badge{font-size:10px;padding:2px 7px;border-radius:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.cat-mention{background:rgba(52,211,153,.15);color:#34d399}
.cat-review{background:rgba(251,191,36,.15);color:#fbbf24}
.cat-approval{background:rgba(167,139,250,.15);color:#a78bfa}
.cat-task{background:rgba(96,165,250,.15);color:#60a5fa}
</style>

<div class="flex-between mb-4">
    <div>
        <h2 style="margin:0;font-size:1.25rem;font-weight:700;color:#f0f6fc">Inbox</h2>
        <span class="text-muted text-sm"><?= (int)($counts['unread'] ?? 0) ?> unread of <?= (int)($counts['total'] ?? 0) ?> total</span>
    </div>
    <?php if (!empty($notifications) && ($counts['unread'] ?? 0) > 0): ?>
    <form method="POST" action="<?= APP_URL ?>/inbox/mark-all-read">
        <button type="submit" class="btn btn-secondary btn-sm">Mark all read</button>
    </form>
    <?php endif; ?>
</div>

<!-- Filter tabs -->
<div class="inbox-filters">
    <?php foreach ($filterTabs as $f => $cfg): ?>
    <?php $active = $filter === $f; $cnt = $counts[$cfg['key']] ?? 0; ?>
    <a href="?filter=<?= $f ?>" class="filter-tab <?= $active ? 'active' : '' ?>">
        <?= e($cfg['label']) ?>
        <?php if ($cnt > 0): ?>
        <span style="margin-left:5px;font-size:10px;opacity:.8">(<?= $cnt ?>)</span>
        <?php endif; ?>
    </a>
    <?php endforeach; ?>
</div>

<div class="card">
    <?php if (empty($notifications)): ?>
        <div class="empty-state">
            <div class="icon"><?= tf_icon('inbox', 40) ?></div>
            <h3>No notifications</h3>
            <p>You're all caught up!</p>
        </div>
    <?php else: ?>
        <?php foreach ($notifications as $n):
            $cfg   = $typeConfig[$n['notification_type']] ?? ['icon' => 'info', 'color' => '#71717a', 'bg' => 'rgba(113,113,122,.1)'];
            $link  = !empty($n['task_id']) ? APP_URL . '/tasks/' . $n['task_id'] : ($n['action_url'] ?? '#');
            $catBadge = $n['inbox_category'] ?? 'task';
            $rowId = (($n['_source'] ?? 'task') === 'legacy' ? 'n' : 't') . (int)$n['id'];
        ?>
        <a href="<?= e($link) ?>" class="inbox-item <?= !$n['is_read'] ? 'unread' : '' ?>"
           onclick="markRead('<?= e($rowId) ?>')">
            <div class="inbox-icon" style="background:<?= $cfg['bg'] ?>">
                <?= tf_icon($cfg['icon'], 16) ?>
            </div>
            <div class="inbox-body">
                <div class="inbox-title"><?= e($n['title']) ?></div>
                <?php if (!empty($n['message'])): ?>
                <div class="inbox-msg"><?= e(mb_substr($n['message'], 0, 120)) ?></div>
                <?php endif; ?>
                <div class="inbox-meta">
                    <?php if (!empty($n['from_name'])): ?>
                    <span class="inbox-from">From: <?= e($n['from_name']) ?></span>
                    <?php endif; ?>
                    <?php if (!empty($n['task_title'])): ?>
                    <span class="inbox-task-badge"><?= e(mb_substr($n['task_title'], 0, 40)) ?></span>
                    <?php endif; ?>
                    <span class="inbox-category-badge cat-<?= e($catBadge) ?>"><?= e($catBadge) ?></span>
                </div>
            </div>
            <div class="inbox-time"><?= timeAgo($n['created_at']) ?></div>
        </a>
        <?php endforeach; ?>
    <?php endif; ?>
</div>

<?php if ($totalPages > 1): ?>
<div style="display:flex;justify-content:center;align-items:center;gap:12px;padding:20px 0">
    <?php if ($page > 1): ?>
    <a href="?filter=<?= e($filter) ?>&page=<?= $page - 1 ?>" class="btn btn-secondary btn-sm">← Prev</a>
    <?php endif; ?>
    <span style="font-size:13px;color:#6e7681"><?= $page ?> / <?= $totalPages ?></span>
    <?php if ($page < $totalPages): ?>
    <a href="?filter=<?= e($filter) ?>&page=<?= $page + 1 ?>" class="btn btn-secondary btn-sm">Next →</a>
    <?php endif; ?>
</div>
<?php endif; ?>

<script>
if (<?= (int)($counts['unread'] ?? 0) ?> === 0) {
    document.querySelectorAll('[data-sb-key="inbox"]').forEach(function(el) {
        el.textContent = '';
        el.style.display = 'none';
    });
}
function markRead(id) {
    fetch('<?= APP_URL ?>/api/inbox/' + id + '/read', {method: 'POST', credentials: 'same-origin'}).catch(function() {});
}
</script>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
