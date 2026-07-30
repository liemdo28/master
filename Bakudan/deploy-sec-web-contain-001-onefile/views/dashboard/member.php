<?php
/**
 * Member Portfolio Detail — /overview/member/{id}
 * Shows a single team member's full task workload, store breakdown, and activity.
 */
$pageTitle    = e($member['name']) . ' — Portfolio';
$currentPage  = 'overview';

$priColors = ['urgent' => '#dc2626', 'high' => '#f59e0b', 'medium' => '#3b82f6', 'low' => '#71717a'];
$priLabels = ['urgent' => 'Urgent', 'high' => 'High', 'medium' => 'Medium', 'low' => 'Low'];
$today     = app_today();

$workloadBg = [
    'overloaded' => ['bg' => 'rgba(220,38,38,.12)', 'border' => '#dc2626', 'color' => '#f87171', 'label' => '🔴 Overloaded'],
    'busy'       => ['bg' => 'rgba(245,158,11,.1)',  'border' => '#d97706', 'color' => '#fbbf24', 'label' => '🟡 Busy'],
    'stable'     => ['bg' => 'rgba(34,197,94,.08)',  'border' => '#16a34a', 'color' => '#4ade80', 'label' => '🟢 Stable'],
];
$ws = $workloadBg[$workloadStatus] ?? $workloadBg['stable'];

ob_start();
?>

<!-- ── Hero ──────────────────────────────────────────────────────────── -->
<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:16px">
        <div style="width:60px;height:60px;border-radius:99px;background:var(--bg-secondary);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:var(--text-muted);flex-shrink:0">
            <?= mb_strtoupper(mb_substr($member['name'], 0, 1)) ?>
        </div>
        <div>
            <h2 style="margin:0;font-size:22px;font-weight:800"><?= e($member['name']) ?></h2>
            <div style="color:var(--text-muted);font-size:13px;margin-top:3px">
                <?= e(ucfirst($member['role'] ?? 'member')) ?>
                <?php if (!empty($member['email'])): ?> · <?= e($member['email']) ?><?php endif; ?>
            </div>
            <div style="margin-top:6px">
                <span style="background:<?= $ws['bg'] ?>;border:1px solid <?= $ws['border'] ?>;color:<?= $ws['color'] ?>;font-size:12px;padding:3px 10px;border-radius:99px;font-weight:600">
                    <?= $ws['label'] ?>
                </span>
                <?php if ($stats['overdue'] > 0): ?>
                <span style="background:rgba(220,38,38,.1);color:#f87171;font-size:11px;padding:2px 8px;border-radius:99px;margin-left:6px">
                    <?= $stats['overdue'] ?> overdue
                </span>
                <?php endif; ?>
            </div>
        </div>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
        <a href="<?= APP_URL ?>/my-tasks?user=<?= (int)$member['id'] ?>" class="btn btn-ghost btn-sm">All Tasks →</a>
        <a href="<?= APP_URL ?>/overview" class="btn btn-ghost btn-sm">← Overview</a>
    </div>
</div>

<!-- ── KPI Row ────────────────────────────────────────────────────────── -->
<div class="ov-kpi-row" style="margin-bottom:20px">
    <div class="ov-kpi kpi-pink" style="cursor:default">
        <div class="ov-kpi-icon-wrap kpi-icon-pink" style="font-size:18px">📋</div>
        <div class="ov-kpi-value"><?= $stats['total'] ?></div>
        <div class="ov-kpi-label">Total Tasks</div>
    </div>
    <div class="ov-kpi kpi-pink" style="<?= $stats['overdue'] > 0 ? 'border-color:rgba(220,38,38,.3)' : '' ?>;cursor:default">
        <div class="ov-kpi-icon-wrap" style="background:rgba(220,38,38,.12);font-size:18px">🔴</div>
        <div class="ov-kpi-value" style="color:<?= $stats['overdue'] > 0 ? '#f87171' : 'var(--text)' ?>"><?= $stats['overdue'] ?></div>
        <div class="ov-kpi-label">Overdue</div>
    </div>
    <div class="ov-kpi kpi-cyan" style="cursor:default">
        <div class="ov-kpi-icon-wrap kpi-icon-cyan" style="font-size:18px">⚡</div>
        <div class="ov-kpi-value"><?= $stats['in_progress'] ?></div>
        <div class="ov-kpi-label">In Progress</div>
    </div>
    <div class="ov-kpi kpi-lime" style="cursor:default">
        <div class="ov-kpi-icon-wrap kpi-icon-lime" style="font-size:18px">📊</div>
        <div class="ov-kpi-value"><?= $stats['completion_rate'] ?>%</div>
        <div class="ov-kpi-label">Completion Rate</div>
    </div>
    <div class="ov-kpi kpi-purple" style="cursor:default">
        <div class="ov-kpi-icon-wrap kpi-icon-purple" style="font-size:18px">📅</div>
        <div class="ov-kpi-value"><?= $stats['due_week'] ?></div>
        <div class="ov-kpi-label">Due This Week</div>
    </div>
</div>

<!-- ── Tab Row ───────────────────────────────────────────────────────── -->
<div class="view-tabs" style="margin-bottom:16px">
    <button class="view-tab active" onclick="memberTab('tasks', this)">📋 Tasks (<?= $stats['total'] - $stats['completed'] ?> active)</button>
    <button class="view-tab" onclick="memberTab('stores', this)">🏪 By Store</button>
    <?php if (!empty($recurringTasks)): ?>
    <button class="view-tab" onclick="memberTab('recurring', this)">🔄 Recurring (<?= count($recurringTasks) ?>)</button>
    <?php endif; ?>
    <button class="view-tab" onclick="memberTab('activity', this)">⏱ Recent Activity</button>
</div>

<!-- ── TASKS TAB ─────────────────────────────────────────────────────── -->
<div id="mtab-tasks">
<?php if (empty($taskGroups)): ?>
<div class="empty-state">
    <div class="icon">✅</div>
    <h3>No tasks assigned</h3>
    <p class="text-muted">This member has no tasks yet.</p>
</div>
<?php else: ?>
<div class="tf-list-wrap density-comfortable">
    <?php foreach ($taskGroups as $groupName => $groupTasks):
        $_isCompleted = strpos($groupName, 'Completed') !== false;
        $_isOverdue   = strpos($groupName, 'Overdue')   !== false;
        $_isToday     = strpos($groupName, 'Due Today') !== false;
    ?>
    <div class="tf-list-group <?= $_isOverdue ? 'tf-group-urgent' : '' ?> <?= $_isCompleted ? 'tf-group-completed' : '' ?>">
        <div class="tf-list-group-head <?= $_isOverdue ? 'tf-group-head-urgent' : '' ?> <?= $_isCompleted ? 'tf-group-head-completed' : '' ?>"
             <?= $_isCompleted ? 'onclick="toggleListGroup(this)" style="cursor:pointer"' : '' ?>>
            <?php if ($_isCompleted): ?><span class="tf-group-caret">▶</span><?php endif; ?>
            <span><?= e($groupName) ?></span>
            <span class="ov-section-badge"><?= count($groupTasks) ?></span>
            <?php if ($_isCompleted): ?><span class="text-muted" style="font-size:11px;margin-left:4px">— click to expand</span><?php endif; ?>
            <?php if ($_isOverdue): ?><span style="font-size:11px;color:#fca5a5;margin-left:8px">⚠ Act immediately</span><?php endif; ?>
        </div>
        <div class="tf-group-body" <?= $_isCompleted ? 'style="display:none"' : '' ?>>
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
        <table class="list-table tf-list-table" style="min-width:480px">
            <thead><tr>
                <th style="width:30px"></th>
                <th>Task</th>
                <th class="col-hide-mobile">Project / Store</th>
                <th>Due</th>
                <th class="col-hide-mobile">Priority</th>
                <th>Status</th>
                <th class="col-hide-mobile">Repeat</th>
            </tr></thead>
            <tbody>
            <?php foreach ($groupTasks as $task):
                $isOv     = !empty($task['due_date']) && $task['due_date'] < $today && empty($task['is_completed']);
                $isToday  = !empty($task['due_date']) && $task['due_date'] === $today && empty($task['is_completed']);
                $isDone   = !empty($task['is_completed']);
                $dueColor = $isOv ? '#f87171' : ($isToday ? '#fde68a' : 'var(--text-muted)');
                $rs       = app_task_repeat_summary($task);
            ?>
            <tr class="list-task-row <?= $isOv ? 'row-overdue' : '' ?> <?= $isDone ? 'row-completed' : '' ?>" data-task-row-id="<?= (int)$task['id'] ?>">
                <td>
                    <div class="task-check <?= $isDone ? 'completed' : '' ?>" onclick="toggleTaskMember(<?= $task['id'] ?>)">
                        <?= $isDone ? '✓' : '' ?>
                    </div>
                </td>
                <td>
                    <a href="<?= APP_URL ?>/tasks/<?= $task['id'] ?>"
                       style="font-weight:600;color:<?= $isDone ? 'var(--text-muted)' : 'var(--text)' ?>;text-decoration:<?= $isDone ? 'line-through' : 'none' ?>">
                        <?= e($task['title']) ?>
                    </a>
                </td>
                <td class="text-sm col-hide-mobile">
                    <?php if (!empty($task['project_name'])): ?>
                    <div>
                        <span style="width:8px;height:8px;border-radius:99px;background:<?= e($task['project_color'] ?? '#888') ?>;display:inline-block;margin-right:4px"></span>
                        <?= e($task['project_name']) ?>
                    </div>
                    <?php endif; ?>
                    <?php if (!empty($task['store_name'])): ?>
                    <div style="color:var(--text-muted);font-size:11px;margin-top:2px">
                        <?= e($task['store_name']) ?>
                    </div>
                    <?php endif; ?>
                </td>
                <td class="text-sm" style="color:<?= $dueColor ?>;font-weight:<?= $isOv ? '700' : '400' ?>;white-space:nowrap">
                    <?php if ($task['due_date']): ?>
                    <?= date('d/m/Y', strtotime($task['due_date'])) ?>
                    <?= $isOv ? ' 🔴' : ($isToday ? ' 🟡' : '') ?>
                    <?php else: ?>—<?php endif; ?>
                </td>
                <td class="col-hide-mobile"><span class="tag priority-<?= $task['priority'] ?>"><?= e($priLabels[$task['priority']] ?? ucfirst($task['priority'])) ?></span></td>
                <td>
                    <span class="badge badge-<?= $isDone ? 'active' : ($task['status'] === 'in_progress' ? 'inprog' : 'member') ?>">
                        <?= e(ucfirst(str_replace('_', ' ', $task['status'] ?? 'todo'))) ?>
                    </span>
                </td>
                <td class="text-sm col-hide-mobile" style="color:var(--text-muted)"><?= e($rs ?: '—') ?></td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        </div><!-- /overflow-x:auto -->
        </div>
    </div>
    <?php endforeach; ?>
</div>
<?php endif; ?>
</div><!-- #mtab-tasks -->

<!-- ── BY STORE TAB ──────────────────────────────────────────────────── -->
<div id="mtab-stores" style="display:none">
<?php if (empty($storeBreakdown)): ?>
<div class="empty-state" style="padding:40px 0"><div class="icon">🏪</div><h3>No store data</h3></div>
<?php else: ?>
<div class="ov-projects-grid">
    <?php foreach ($storeBreakdown as $st):
        $pct = $st['total'] > 0 ? round($st['done'] / $st['total'] * 100) : 0;
        $sc  = $st['color'] ?: '#888';
    ?>
    <div class="ov-project-card" style="cursor:default">
        <div class="ov-project-top">
            <div>
                <span class="ov-project-name">
                    <span class="ov-project-dot" style="background:<?= e($sc) ?>"></span>
                    <?= e($st['name']) ?>
                </span>
                <?php if ($st['overdue'] > 0): ?>
                <span class="ov-status ov-status-danger" style="display:inline-block;margin-top:5px">
                    <?= $st['overdue'] ?> overdue
                </span>
                <?php endif; ?>
            </div>
            <div class="ov-donut" style="--donut-color:<?= e($sc) ?>;--donut-pct:<?= $pct ?>">
                <div class="ov-donut-ring"></div>
                <div class="ov-donut-hole"><?= $pct ?>%</div>
            </div>
        </div>
        <div class="ov-project-stats">
            <div class="ov-project-stat"><span class="ov-project-stat-val"><?= $st['total'] ?></span><span class="ov-project-stat-label">Total</span></div>
            <div class="ov-project-stat"><span class="ov-project-stat-val" style="color:var(--green)"><?= $st['done'] ?></span><span class="ov-project-stat-label">Done</span></div>
            <div class="ov-project-stat"><span class="ov-project-stat-val" style="color:var(--blue)"><?= $st['in_progress'] ?></span><span class="ov-project-stat-label">Active</span></div>
            <?php if ($st['overdue'] > 0): ?>
            <div class="ov-project-stat"><span class="ov-project-stat-val" style="color:var(--neon-pink)"><?= $st['overdue'] ?></span><span class="ov-project-stat-label">Overdue</span></div>
            <?php endif; ?>
        </div>
        <!-- Completion bar -->
        <div style="margin-top:10px;height:4px;background:var(--bg-tertiary);border-radius:99px;overflow:hidden">
            <div style="height:100%;width:<?= $pct ?>%;background:<?= e($sc) ?>;border-radius:99px;transition:width .4s"></div>
        </div>
        <?php if ($st['id'] > 0): ?>
        <a href="<?= APP_URL ?>/overview/store/<?= $st['id'] ?>" style="font-size:11px;color:var(--text-muted);margin-top:8px;display:block">
            View store →
        </a>
        <?php endif; ?>
    </div>
    <?php endforeach; ?>
</div>
<?php endif; ?>
</div><!-- #mtab-stores -->

<!-- ── RECURRING TAB ─────────────────────────────────────────────────── -->
<div id="mtab-recurring" style="display:none">
<?php if (empty($recurringTasks)): ?>
<div class="empty-state" style="padding:40px 0"><div class="icon">🔄</div><h3>No recurring tasks</h3></div>
<?php else: ?>
<div class="ov-card">
    <div class="card-header"><h3>🔄 Active Recurring Tasks</h3><span class="ov-section-badge"><?= count($recurringTasks) ?></span></div>
    <div class="card-body" style="padding:0">
        <?php foreach ($recurringTasks as $t):
            $rs  = app_task_repeat_summary($t);
            $isOv = !empty($t['due_date']) && $t['due_date'] < $today;
            $sc  = $t['store_color'] ?? '#888';
        ?>
        <div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border)">
            <span style="font-size:20px">🔄</span>
            <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:13px;<?= $isOv ? 'color:#f87171' : '' ?>"><?= e($t['title']) ?></div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
                    <?= e($rs) ?>
                    <?php if (!empty($t['store_name'])): ?>
                     · <span style="color:<?= e($sc) ?>"><?= e($t['store_name']) ?></span>
                    <?php endif; ?>
                </div>
            </div>
            <?php if ($t['due_date']): ?>
            <span style="font-size:12px;color:<?= $isOv ? '#f87171' : 'var(--text-muted)' ?>;white-space:nowrap">
                <?= date('d/m', strtotime($t['due_date'])) ?>
                <?= $isOv ? '🔴' : '' ?>
            </span>
            <?php endif; ?>
            <a href="<?= APP_URL ?>/tasks/<?= $t['id'] ?>" class="btn btn-ghost btn-sm" style="flex-shrink:0">View</a>
        </div>
        <?php endforeach; ?>
    </div>
</div>
<?php endif; ?>
</div><!-- #mtab-recurring -->

<!-- ── RECENT ACTIVITY TAB ───────────────────────────────────────────── -->
<div id="mtab-activity" style="display:none">
<?php if (empty($recentCompleted)): ?>
<div class="empty-state" style="padding:40px 0">
    <div class="icon">⏱</div>
    <h3>No recent activity</h3>
    <p class="text-muted">No tasks completed in the last 14 days.</p>
</div>
<?php else: ?>
<div class="ov-card">
    <div class="card-header">
        <h3>✅ Completed Last 14 Days</h3>
        <span class="ov-section-badge"><?= count($recentCompleted) ?></span>
    </div>
    <div class="card-body" style="padding:0">
        <?php foreach ($recentCompleted as $t):
            $sc = $t['store_color'] ?? '#888';
        ?>
        <div style="display:flex;align-items:center;gap:12px;padding:9px 16px;border-bottom:1px solid var(--border)">
            <span style="color:#4ade80;font-size:16px;flex-shrink:0">✓</span>
            <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:500;text-decoration:line-through;color:var(--text-muted)"><?= e($t['title']) ?></div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
                    <?= e($t['project_name'] ?? '') ?>
                    <?php if (!empty($t['store_name'])): ?>
                     · <span style="color:<?= e($sc) ?>"><?= e($t['store_name']) ?></span>
                    <?php endif; ?>
                </div>
            </div>
            <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;flex-shrink:0">
                <?= date('d/m', strtotime($t['updated_at'])) ?>
            </span>
        </div>
        <?php endforeach; ?>
    </div>
</div>
<?php endif; ?>
</div><!-- #mtab-activity -->

<script>
var APP_URL = '<?= APP_URL ?>';
var CSRF    = window.CSRF_TOKEN || '';

function memberTab(name, btn) {
    ['tasks','stores','recurring','activity'].forEach(function(t) {
        var el = document.getElementById('mtab-' + t);
        if (el) el.style.display = t === name ? '' : 'none';
    });
    document.querySelectorAll('.view-tab').forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
}

function toggleListGroup(headerEl) {
    var group  = headerEl.closest('.tf-list-group');
    var body   = group.querySelector('.tf-group-body');
    var caret  = headerEl.querySelector('.tf-group-caret');
    var isOpen = body.style.display !== 'none';
    body.style.display  = isOpen ? 'none' : '';
    if (caret) caret.style.transform = isOpen ? '' : 'rotate(90deg)';
    var hint = headerEl.querySelector('.text-muted');
    if (hint) hint.textContent = isOpen ? '— click to expand' : '— click to collapse';
}

function toggleTaskMember(id) {
    var row  = document.querySelector('[data-task-row-id="' + id + '"]');
    var form = new URLSearchParams();
    form.append('csrf_token', CSRF);
    fetch(APP_URL + '/api/tasks/' + id + '/complete', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': CSRF },
        body: form.toString()
    }).then(function(r){ return r.json().then(function(j){ j.__status = r.status; return j; }); }).then(function(j) {
        if (j.__status === 409 && j.error === 'needs_review') {
            showMemberToast('🔍 Task has a reviewer — open task to submit for review first.');
            return;
        }
        if (j.ok) {
            if (row) { row.classList.add('row-completed'); row.style.opacity = '.38'; }
            showMemberToast('Task completed' + (j.result && j.result.next_task_id ? ' — next occurrence created' : ''));
        }
    });
}

function showMemberToast(msg) {
    var wrap = document.getElementById('m-toast');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'm-toast';
        wrap.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:1100';
        document.body.appendChild(wrap);
    }
    var el = document.createElement('div');
    el.style.cssText = 'background:rgba(15,23,42,.96);color:#f1f5f9;border:1px solid rgba(255,255,255,.1);border-left:3px solid #22c55e;padding:10px 16px;border-radius:8px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.35);margin-top:6px';
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function(){ el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2400);
    setTimeout(function(){ el.remove(); }, 2800);
}
</script>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
