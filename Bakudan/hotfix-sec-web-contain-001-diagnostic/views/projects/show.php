<?php
$pageTitle = e($project['name']);
$currentPage = 'projects';
$extraJs = ['board.js', 'timeline.js', 'saved-views.js', 'bulk-actions.js'];
$densityClass = 'density-' . ($taskControls['density'] ?? 'comfortable');
$recurringCount = count(array_filter($tasks, fn($task) => ($task['repeat_type'] ?? 'none') !== 'none'));
ob_start();
?>

<div class="taskflow-hero">
    <div class="taskflow-hero-left">
        <div class="taskflow-title-row">
            <h2 style="margin:0;font-size:26px"><?= e($project['name']) ?></h2>
            <?php if (!empty($projectStore)): ?>
            <span class="tf-chip" style="--chip-color:<?= e($projectStore['color'] ?? '#3b82f6') ?>"><?= tf_icon('store', 14) ?> <?= e($projectStore['name']) ?></span>
            <?php endif; ?>
            <span class="tf-chip"><?= tf_icon('refresh-cw', 14) ?> <?= $recurringCount ?> recurring</span>
            <span class="tf-chip"><?= tf_icon('check-square', 14) ?> <?= count($tasks) ?> visible tasks</span>
        </div>
        <p class="text-muted" style="margin:8px 0 0">Action-first queue with urgency sorting and assignee grouping.</p>
    </div>
    <div class="taskflow-hero-actions">
        <a href="<?= APP_URL ?>/projects/<?= $project['id'] ?>/edit" class="btn btn-outline btn-sm"><?= tf_icon('settings', 14) ?> <?= e(t('project.settings')) ?></a>
        <button class="btn btn-primary btn-sm" onclick="openNewTaskModal()"><?= tf_icon('plus', 14) ?> <?= e(t('task.add_task')) ?></button>
    </div>
</div>

<div class="flex gap-2 mb-4" style="align-items:center;flex-wrap:wrap">
    <div class="view-tabs">
        <a href="?<?= http_build_query(array_merge($taskControls, ['view' => 'board'])) ?>" class="view-tab <?= $view === 'board' ? 'active' : '' ?>">📋 <?= e(t('project.view_board')) ?></a>
        <a href="?<?= http_build_query(array_merge($taskControls, ['view' => 'list'])) ?>" class="view-tab <?= $view === 'list' ? 'active' : '' ?>">📝 <?= e(t('project.view_list')) ?></a>
        <a href="?<?= http_build_query(array_merge($taskControls, ['view' => 'timeline'])) ?>" class="view-tab <?= $view === 'timeline' ? 'active' : '' ?>">📅 <?= e(t('project.view_timeline')) ?></a>
    </div>
</div>

<?php
// TKT-104 · preset detection — which chip should show as "active"
$_preset = 'all';
$_isMine = ((string)($taskControls['assignee'] ?? 'all')) === (string)$_SESSION['user_id'];
$_dueFilter = $taskControls['due'] ?? 'all';
$_repeatFilter = $taskControls['repeat'] ?? 'all';
$_statusFilter = $taskControls['status'] ?? 'all';
if ($_dueFilter === 'today' && !$_isMine) $_preset = 'today';
elseif ($_dueFilter === 'overdue' && !$_isMine) $_preset = 'overdue';
elseif ($_isMine && $_dueFilter === 'all') $_preset = 'mine';
elseif ($_dueFilter === 'all' && $_statusFilter === 'all' && $_repeatFilter === 'all' && !$_isMine && empty($taskControls['q']) && ($taskControls['priority'] ?? 'all') === 'all') $_preset = 'all';
else $_preset = 'custom';

// TKT-105 · count of non-default advanced filters to show on the toggle button
$_advCount = 0;
foreach (['status' => 'all', 'assignee' => 'all', 'priority' => 'all', 'due' => 'all', 'repeat' => 'all'] as $_k => $_def) {
    if (($taskControls[$_k] ?? $_def) !== $_def) $_advCount++;
}

function _presetHref(array $ctl, string $view, array $overrides): string {
    return '?' . http_build_query(array_merge($ctl, ['view' => $view], $overrides));
}
?>
<!-- TKT-104 · Preset chips (Today / Overdue / Mine / All) — visible on first screen -->
<div class="tf-preset-row">
    <a class="tf-preset <?= $_preset === 'today' ? 'tf-preset-active' : '' ?>" href="<?= e(_presetHref($taskControls, $view, ['due' => 'today', 'assignee' => 'all', 'status' => 'all', 'priority' => 'all', 'repeat' => 'all', 'q' => ''])) ?>">
        <span class="tf-preset-icon"><?= tf_icon('sun', 15) ?></span> Today
    </a>
    <a class="tf-preset tf-preset-danger <?= $_preset === 'overdue' ? 'tf-preset-active' : '' ?>" href="<?= e(_presetHref($taskControls, $view, ['due' => 'overdue', 'assignee' => 'all', 'status' => 'all', 'priority' => 'all', 'repeat' => 'all', 'q' => ''])) ?>">
        <span class="tf-preset-icon"><?= tf_icon('flame', 15) ?></span> Overdue
    </a>
    <a class="tf-preset <?= $_preset === 'mine' ? 'tf-preset-active' : '' ?>" href="<?= e(_presetHref($taskControls, $view, ['assignee' => $_SESSION['user_id'], 'due' => 'all', 'status' => 'all', 'priority' => 'all', 'repeat' => 'all', 'q' => ''])) ?>">
        <span class="tf-preset-icon"><?= tf_icon('user-check', 15) ?></span> Mine
    </a>
    <a class="tf-preset <?= $_preset === 'all' ? 'tf-preset-active' : '' ?>" href="<?= e(_presetHref($taskControls, $view, ['due' => 'all', 'assignee' => 'all', 'status' => 'all', 'priority' => 'all', 'repeat' => 'all', 'q' => ''])) ?>">
        <span class="tf-preset-icon"><?= tf_icon('layout-grid', 15) ?></span> All
    </a>
    <?php if ($_preset === 'custom'): ?>
        <span class="tf-preset tf-preset-custom" title="Custom filter active"><span class="tf-preset-icon"><?= tf_icon('sparkles', 14) ?></span> Custom</span>
    <?php endif; ?>
    <span class="tf-preset-sep"></span>
    <button type="button" class="tf-adv-toggle" data-tf-adv-toggle>
        <span>Advanced Filters</span>
        <?php if ($_advCount > 0): ?><span class="tf-adv-count"><?= $_advCount ?></span><?php endif; ?>
        <span class="tf-adv-caret">▾</span>
    </button>
</div>

<form method="GET" class="tf-filter-bar <?= e($densityClass) ?>" id="tf-filter-bar" <?= $_advCount === 0 ? 'hidden' : '' ?>>
    <input type="hidden" name="view" value="<?= e($view) ?>">
    <div class="tf-filter-grid">
        <input type="search" name="q" value="<?= e($taskControls['q'] ?? '') ?>" class="form-control" placeholder="Search task, assignee, store">
        <select name="status" class="form-control">
            <option value="all" <?= ($taskControls['status'] ?? 'all') === 'all' ? 'selected' : '' ?>>All Statuses</option>
            <option value="actionable" <?= ($taskControls['status'] ?? '') === 'actionable' ? 'selected' : '' ?>>Actionable Only</option>
            <option value="todo" <?= ($taskControls['status'] ?? '') === 'todo' ? 'selected' : '' ?>>To Do</option>
            <option value="in_progress" <?= ($taskControls['status'] ?? '') === 'in_progress' ? 'selected' : '' ?>>In Progress</option>
            <option value="review" <?= ($taskControls['status'] ?? '') === 'review' ? 'selected' : '' ?>>Review</option>
            <option value="done" <?= ($taskControls['status'] ?? '') === 'done' ? 'selected' : '' ?>>Done</option>
        </select>
        <select name="assignee" class="form-control">
            <option value="all">All Assignees</option>
            <?php foreach ($members as $member): ?>
            <option value="<?= $member['id'] ?>" <?= (string) ($taskControls['assignee'] ?? 'all') === (string) $member['id'] ? 'selected' : '' ?>><?= e($member['name']) ?></option>
            <?php endforeach; ?>
        </select>
        <select name="priority" class="form-control">
            <option value="all" <?= ($taskControls['priority'] ?? 'all') === 'all' ? 'selected' : '' ?>>All Priorities</option>
            <option value="urgent" <?= ($taskControls['priority'] ?? '') === 'urgent' ? 'selected' : '' ?>>Urgent</option>
            <option value="high" <?= ($taskControls['priority'] ?? '') === 'high' ? 'selected' : '' ?>>High</option>
            <option value="medium" <?= ($taskControls['priority'] ?? '') === 'medium' ? 'selected' : '' ?>>Medium</option>
            <option value="low" <?= ($taskControls['priority'] ?? '') === 'low' ? 'selected' : '' ?>>Low</option>
        </select>
        <select name="due" class="form-control">
            <option value="all" <?= ($taskControls['due'] ?? 'all') === 'all' ? 'selected' : '' ?>>All Due Buckets</option>
            <option value="overdue" <?= ($taskControls['due'] ?? '') === 'overdue' ? 'selected' : '' ?>>Overdue</option>
            <option value="today" <?= ($taskControls['due'] ?? '') === 'today' ? 'selected' : '' ?>>Due Today</option>
            <option value="next7" <?= ($taskControls['due'] ?? '') === 'next7' ? 'selected' : '' ?>>Next 7 Days</option>
            <option value="no_date" <?= ($taskControls['due'] ?? '') === 'no_date' ? 'selected' : '' ?>>No Due Date</option>
            <option value="completed" <?= ($taskControls['due'] ?? '') === 'completed' ? 'selected' : '' ?>>Completed</option>
        </select>
        <select name="repeat" class="form-control">
            <option value="all" <?= ($taskControls['repeat'] ?? 'all') === 'all' ? 'selected' : '' ?>>All Recurrence</option>
            <option value="recurring" <?= ($taskControls['repeat'] ?? '') === 'recurring' ? 'selected' : '' ?>>Recurring</option>
            <option value="single" <?= ($taskControls['repeat'] ?? '') === 'single' ? 'selected' : '' ?>>One-time</option>
        </select>
        <select name="sort" class="form-control">
            <option value="urgency" <?= ($taskControls['sort'] ?? 'urgency') === 'urgency' ? 'selected' : '' ?>>Sort: Urgency</option>
            <option value="due" <?= ($taskControls['sort'] ?? '') === 'due' ? 'selected' : '' ?>>Sort: Due Date</option>
            <option value="priority" <?= ($taskControls['sort'] ?? '') === 'priority' ? 'selected' : '' ?>>Sort: Priority</option>
            <option value="assignee" <?= ($taskControls['sort'] ?? '') === 'assignee' ? 'selected' : '' ?>>Sort: Assignee</option>
            <option value="title" <?= ($taskControls['sort'] ?? '') === 'title' ? 'selected' : '' ?>>Sort: Title</option>
        </select>
        <select name="group" class="form-control">
            <option value="urgency" <?= ($taskControls['group'] ?? 'urgency') === 'urgency' ? 'selected' : '' ?>>Group: Urgency</option>
            <option value="assignee" <?= ($taskControls['group'] ?? '') === 'assignee' ? 'selected' : '' ?>>Group: Assignee</option>
            <option value="due" <?= ($taskControls['group'] ?? '') === 'due' ? 'selected' : '' ?>>Group: Due Bucket</option>
            <option value="status" <?= ($taskControls['group'] ?? '') === 'status' ? 'selected' : '' ?>>Group: Status</option>
        </select>
        <select name="density" class="form-control">
            <option value="compact" <?= ($taskControls['density'] ?? '') === 'compact' ? 'selected' : '' ?>>Compact</option>
            <option value="comfortable" <?= ($taskControls['density'] ?? 'comfortable') === 'comfortable' ? 'selected' : '' ?>>Comfortable</option>
            <option value="detailed" <?= ($taskControls['density'] ?? '') === 'detailed' ? 'selected' : '' ?>>Detailed</option>
        </select>
    </div>
    <div class="tf-filter-actions">
        <button type="submit" class="btn btn-primary btn-sm"><?= tf_icon('filter', 14) ?> Apply</button>
        <a href="?view=<?= e($view) ?>" class="btn btn-secondary btn-sm">Reset</a>
    </div>
</form>

<?php
// ── Smart Operational Banner ─────────────────────────────────────────────
$_today     = app_today();
$_overdueCt = count(array_filter($tasks, function($t) use ($_today) {
    return empty($t['is_completed']) && !empty($t['due_date']) && $t['due_date'] < $_today;
}));
$_todayCt = count(array_filter($tasks, function($t) use ($_today) {
    return empty($t['is_completed']) && ($t['due_date'] ?? '') === $_today;
}));
$_inProgCt = count(array_filter($tasks, function($t) {
    return empty($t['is_completed']) && ($t['status'] ?? '') === 'in_progress';
}));
$_unassignedCt = count(array_filter($tasks, function($t) {
    return empty($t['is_completed']) && empty($t['assignee_id']);
}));
?>
<?php if ($_overdueCt > 0 || $_todayCt > 0 || $_inProgCt > 0): ?>
<div class="tf-smart-banner">
    <?php if ($_overdueCt > 0): ?>
    <a class="tf-sb-item tf-sb-overdue" href="?<?= e(http_build_query(array_merge($taskControls, ['view' => $view, 'due' => 'overdue', 'status' => 'all']))) ?>">
        <span class="tf-sb-num"><?= $_overdueCt ?></span>
        <span class="tf-sb-lbl">Overdue</span>
        <span class="tf-sb-arrow">→</span>
    </a>
    <?php endif; ?>
    <?php if ($_todayCt > 0): ?>
    <a class="tf-sb-item tf-sb-today" href="?<?= e(http_build_query(array_merge($taskControls, ['view' => $view, 'due' => 'today', 'status' => 'all']))) ?>">
        <span class="tf-sb-num"><?= $_todayCt ?></span>
        <span class="tf-sb-lbl">Due Today</span>
        <span class="tf-sb-arrow">→</span>
    </a>
    <?php endif; ?>
    <?php if ($_inProgCt > 0): ?>
    <div class="tf-sb-item tf-sb-inprog">
        <span class="tf-sb-num"><?= $_inProgCt ?></span>
        <span class="tf-sb-lbl">In Progress</span>
    </div>
    <?php endif; ?>
    <?php if ($_unassignedCt > 0): ?>
    <a class="tf-sb-item tf-sb-warn" href="?<?= e(http_build_query(array_merge($taskControls, ['view' => $view, 'assignee' => 'none']))) ?>">
        <span class="tf-sb-num"><?= $_unassignedCt ?></span>
        <span class="tf-sb-lbl">Unassigned</span>
    </a>
    <?php endif; ?>
    <span class="tf-sb-spacer"></span>
    <?php if ($_overdueCt === 0 && $_todayCt === 0): ?>
    <span class="tf-sb-item tf-sb-ok">✓ All caught up</span>
    <?php endif; ?>
</div>
<?php endif; ?>

<?php if ($view === 'board'):
    $_groupBy = $_GET['group_by'] ?? 'status'; // 'status' | 'person'
    $_pMap = ['low'=>t('task.priority_low'),'medium'=>t('task.priority_medium'),'high'=>t('task.priority_high'),'urgent'=>t('task.priority_urgent')];
    $_defaultSectionId = $sections[0]['id'] ?? null;
?>
<!-- Board group-by toggle -->
<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
    <span style="font-size:12px;color:var(--text-muted)">Group by:</span>
    <a href="?<?= http_build_query(array_merge($taskControls, ['view'=>'board','group_by'=>'status'])) ?>"
       class="btn btn-sm <?= $_groupBy==='status' ? 'btn-primary' : 'btn-ghost' ?>" style="font-size:12px">📊 Status</a>
    <a href="?<?= http_build_query(array_merge($taskControls, ['view'=>'board','group_by'=>'person'])) ?>"
       class="btn btn-sm <?= $_groupBy==='person' ? 'btn-primary' : 'btn-ghost' ?>" style="font-size:12px">👤 Person</a>
</div>

<?php if ($_groupBy === 'status'):
    $_statusCols = [
        'todo'        => ['label'=>'To Do',       'icon'=>'⬜', 'color'=>'#64748b'],
        'in_progress' => ['label'=>'In Progress',  'icon'=>'🔵', 'color'=>'#3b82f6'],
        'review'      => ['label'=>'Review / QA',  'icon'=>'🟡', 'color'=>'#f59e0b'],
        'done'        => ['label'=>'Done',          'icon'=>'🟢', 'color'=>'#22c55e'],
    ];
    $_byStatus = array_fill_keys(array_keys($_statusCols), []);
    foreach ($tasks as $_t) {
        $_s = $_t['status'] ?? 'todo';
        if (!isset($_byStatus[$_s])) $_s = 'todo';
        $_byStatus[$_s][] = $_t;
    }
?>
<div class="board-scroll-wrap">
<div class="board-container <?= e($densityClass) ?>" id="boardContainer">
    <?php foreach ($_statusCols as $_sKey => $_sCol): ?>
    <div class="board-column" data-status="<?= $_sKey ?>">
        <div class="column-header">
            <div class="col-person">
                <span style="font-size:14px"><?= $_sCol['icon'] ?></span>
                <span class="col-person-name" style="color:<?= $_sCol['color'] ?>"><?= $_sCol['label'] ?></span>
            </div>
            <span class="count"><?= count($_byStatus[$_sKey]) ?></span>
        </div>
        <div class="column-tasks" data-status="<?= $_sKey ?>" data-section-id="<?= (int)$_defaultSectionId ?>">
            <?php foreach ($_byStatus[$_sKey] as $task):
                $dueBucket = app_task_due_bucket($task);
                $repeatSummary = app_task_repeat_summary($task);
                $_isCompleted = !empty($task['is_completed']);
                $_cardExtra = '';
                if ($_isCompleted)               $_cardExtra = 'task-card-done';
                elseif ($dueBucket === 'overdue') $_cardExtra = 'task-card-overdue';
                elseif ($dueBucket === 'today')   $_cardExtra = 'task-card-due-today';
            ?>
            <div class="task-card task-card-enhanced <?= $_cardExtra ?>" data-task-id="<?= $task['id'] ?>" draggable="true"
                 onclick="window.TaskDrawer && window.TaskDrawer.focusTask(<?= $task['id'] ?>, { projectId: <?= (int)$project['id'] ?> })">
                <div class="tc-urgency-bar tc-ub-<?= $dueBucket ?>"></div>
                <div class="task-card-top">
                    <div class="task-title <?= $_isCompleted ? 'task-title-done' : '' ?>"><?= e($task['title']) ?></div>
                    <span class="tag priority-<?= $task['priority'] ?>"><?= e($_pMap[$task['priority']] ?? ucfirst($task['priority'])) ?></span>
                </div>
                <div class="task-card-context">
                    <?php if (!empty($task['store_name'])): ?><span class="tf-chip subtle"><?= tf_icon('store', 12) ?> <?= e($task['store_name']) ?></span><?php endif; ?>
                    <?php if ($repeatSummary): ?><span class="tf-chip subtle"><?= tf_icon('refresh-cw', 12) ?> <?= e($repeatSummary) ?></span><?php endif; ?>
                    <span class="tf-chip subtle"><?= tf_icon(($task['visibility']??'private')==='public'?'globe':'lock',12) ?> <?= e(ucfirst($task['visibility']??'private')) ?></span>
                </div>
                <div class="task-meta task-meta-strong">
                    <?php if ($task['due_date']): ?>
                    <span class="due-date tc-due-<?= $dueBucket ?>">
                        <?php
                        $dueTs = strtotime($task['due_date']);
                        $daysOff = (int)(($dueTs - strtotime(app_today())) / 86400);
                        if ($dueBucket === 'overdue')   echo '🔴 ' . abs($daysOff) . 'd late';
                        elseif ($dueBucket === 'today') echo '🟡 Today';
                        elseif ($daysOff === 1)         echo '📅 Tomorrow';
                        else                            echo date('d/m', $dueTs);
                        ?>
                    </span>
                    <?php else: ?>
                    <span class="due-date" style="color:var(--text-muted)">No date</span>
                    <?php endif; ?>
                    <?php if (!empty($task['assignee_name'])): ?>
                    <span class="tc-assignee-avatar" title="<?= e($task['assignee_name']) ?>"><?= mb_strtoupper(mb_substr($task['assignee_name'],0,1)) ?></span>
                    <?php endif; ?>
                </div>
            </div>
            <?php endforeach; ?>
            <?php if (empty($_byStatus[$_sKey])): ?>
            <div class="col-empty-hint">No tasks</div>
            <?php endif; ?>
        </div>
        <div class="add-task-btn" onclick="openNewTaskModal()"><?= e(t('task.add_task')) ?></div>
    </div>
    <?php endforeach; ?>
</div>
</div>

<?php else:
    // ── Person view (original) ────────────────────────────────────────
    $_byPerson = [];
    $_personName = [];
    foreach ($tasks as $_t) {
        $_uid = !empty($_t['assignee_id']) ? (int)$_t['assignee_id'] : 0;
        $_byPerson[$_uid][] = $_t;
        if ($_uid && !isset($_personName[$_uid])) $_personName[$_uid] = $_t['assignee_name'] ?? 'Unknown';
    }
    uksort($_byPerson, fn($a,$b) => $a===0 ? 1 : ($b===0 ? -1 : strcmp($_personName[$a]??'',$_personName[$b]??'')));
    if (!isset($_byPerson[0])) $_byPerson[0] = [];
?>
<div class="board-scroll-wrap">
<div class="board-container <?= e($densityClass) ?>" id="boardContainer">
    <?php foreach ($_byPerson as $_uid => $_colTasks):
        $_label   = $_uid ? ($_personName[$_uid] ?? 'Unknown') : 'Unassigned';
        $_initial = mb_strtoupper(mb_substr($_label, 0, 1));
        $_isNone  = ($_uid === 0);
        $_sid     = $_defaultSectionId;
    ?>
    <div class="board-column" data-assignee="<?= (int)$_uid ?>">
        <div class="column-header">
            <div class="col-person <?= $_isNone ? 'col-person-none' : '' ?>">
                <?php if (!$_isNone): ?>
                <span class="col-person-avatar"><?= e($_initial) ?></span>
                <?php else: ?>
                <span class="col-person-avatar col-person-avatar-none"><?= tf_icon('user', 13) ?></span>
                <?php endif; ?>
                <span class="col-person-name"><?= e($_label) ?></span>
            </div>
            <span class="count"><?= count($_colTasks) ?></span>
        </div>
        <div class="column-tasks" data-section-id="<?= (int)$_sid ?>">
            <?php foreach ($_colTasks as $task):
                $dueBucket    = app_task_due_bucket($task);
                $repeatSummary = app_task_repeat_summary($task);
                $_isCompleted = !empty($task['is_completed']);
                $_cardExtra   = '';
                if ($_isCompleted)               $_cardExtra = 'task-card-done';
                elseif ($dueBucket === 'overdue') $_cardExtra = 'task-card-overdue';
                elseif ($dueBucket === 'today')   $_cardExtra = 'task-card-due-today';
            ?>
            <div class="task-card task-card-enhanced <?= $_cardExtra ?>" data-task-id="<?= $task['id'] ?>" draggable="true"
                 onclick="window.TaskDrawer && window.TaskDrawer.focusTask(<?= $task['id'] ?>, { projectId: <?= (int)$project['id'] ?> })">
                <div class="tc-urgency-bar tc-ub-<?= $dueBucket ?>"></div>
                <div class="task-card-top">
                    <div class="task-title <?= $_isCompleted ? 'task-title-done' : '' ?>"><?= e($task['title']) ?></div>
                    <span class="tag priority-<?= $task['priority'] ?>"><?= e($_pMap[$task['priority']] ?? ucfirst($task['priority'])) ?></span>
                </div>
                <div class="task-card-context">
                    <?php if (!empty($task['store_name'])): ?><span class="tf-chip subtle"><?= tf_icon('store', 12) ?> <?= e($task['store_name']) ?></span><?php endif; ?>
                    <?php if ($repeatSummary): ?><span class="tf-chip subtle"><?= tf_icon('refresh-cw', 12) ?> <?= e($repeatSummary) ?></span><?php endif; ?>
                    <span class="tf-chip subtle"><?= tf_icon(($task['visibility']??'private')==='public'?'globe':'lock',12) ?> <?= e(ucfirst($task['visibility']??'private')) ?></span>
                </div>
                <div class="task-meta task-meta-strong">
                    <?php if ($task['due_date']): ?>
                    <span class="due-date tc-due-<?= $dueBucket ?>">
                        <?php
                        $dueTs = strtotime($task['due_date']);
                        $daysOff = (int)(($dueTs - strtotime(app_today())) / 86400);
                        if ($dueBucket === 'overdue')   echo '🔴 ' . abs($daysOff) . 'd late';
                        elseif ($dueBucket === 'today') echo '🟡 Today';
                        elseif ($daysOff === 1)         echo '📅 Tomorrow';
                        else                            echo date('d/m', $dueTs);
                        ?>
                    </span>
                    <?php else: ?>
                    <span class="due-date" style="color:var(--text-muted)">No date</span>
                    <?php endif; ?>
                    <?php if (!empty($task['assignee_name'])): ?>
                    <span class="tc-assignee-avatar" title="<?= e($task['assignee_name']) ?>"><?= mb_strtoupper(mb_substr($task['assignee_name'],0,1)) ?></span>
                    <?php endif; ?>
                    <?php if ($_isCompleted): ?><span style="color:#86efac;font-size:10px">✓</span><?php endif; ?>
                </div>
            </div>
            <?php endforeach; ?>
            <?php if (empty($_colTasks)): ?>
            <div class="col-empty-hint">No tasks</div>
            <?php endif; ?>
        </div>
        <div class="add-task-btn" onclick="openNewTaskModal()"><?= e(t('task.add_task')) ?></div>
    </div>
    <?php endforeach; ?>
</div>
</div>
<?php endif; // group_by ?>


<?php elseif ($view === 'list'): ?>
<div class="card">
    <div class="card-body" style="padding:0">
        <?php if (empty($tasks)): ?>
        <div class="empty-state">
            <div class="icon">📝</div>
            <h3><?= e(t('task.no_tasks')) ?></h3>
            <p><?= e(t('project.empty_task_desc')) ?></p>
            <button type="button" class="btn btn-primary" onclick="openNewTaskModal()"><?= e(t('project.create_first_task')) ?></button>
            <div class="empty-state-hint"><?= e(t('project.shortcut_hint')) ?></div>
        </div>
        <?php else: ?>
        <div class="tf-list-wrap <?= e($densityClass) ?>">
            <?php
            $_hasOverdue   = isset($listGroups['🔴 Overdue']) && count($listGroups['🔴 Overdue']) > 0;
            $_hasToday     = isset($listGroups['🟡 Due Today']) && count($listGroups['🟡 Due Today']) > 0;
            if (!$_hasOverdue && !$_hasToday && !empty($listGroups)):
            ?>
            <div class="tf-list-empty-hint">
                <span style="color:#22c55e">✓</span> No overdue or due-today tasks.
                <?php if (count($tasks) > 0): ?> <?= count($tasks) ?> tasks upcoming or in progress.<?php endif; ?>
            </div>
            <?php endif; ?>

            <?php foreach ($listGroups as $groupName => $groupTasks):
                $_isCompletedGroup = (strpos($groupName, 'Completed') !== false);
                $_isOverdueGroup   = (strpos($groupName, 'Overdue')   !== false);
                $_isTodayGroup     = (strpos($groupName, 'Due Today') !== false);
                $_groupClass = 'tf-list-group';
                if ($_isCompletedGroup) $_groupClass .= ' tf-group-completed';
                if ($_isOverdueGroup)   $_groupClass .= ' tf-group-urgent';
            ?>
            <div class="<?= $_groupClass ?>">
                <div class="tf-list-group-head <?= $_isCompletedGroup ? 'tf-group-head-completed' : '' ?> <?= $_isOverdueGroup ? 'tf-group-head-urgent' : '' ?>"
                     <?= $_isCompletedGroup ? 'onclick="toggleListGroup(this)" style="cursor:pointer"' : '' ?>>
                    <?php if ($_isCompletedGroup): ?>
                    <span class="tf-group-caret" style="transition:transform .2s;display:inline-block">▶</span>
                    <?php endif; ?>
                    <span><?= e($groupName) ?></span>
                    <span class="ov-section-badge"><?= count($groupTasks) ?></span>
                    <?php if ($_isCompletedGroup): ?><span class="text-muted" style="font-size:11px;margin-left:4px">— click to expand</span><?php endif; ?>
                    <?php if ($_isOverdueGroup): ?><span style="font-size:11px;color:#fca5a5;margin-left:8px">⚠ Act immediately</span><?php endif; ?>
                    <?php if ($_isTodayGroup): ?><span style="font-size:11px;color:#fde68a;margin-left:8px">Due today</span><?php endif; ?>
                </div>
                <div class="tf-group-body" <?= $_isCompletedGroup ? 'style="display:none"' : '' ?>>
                <table class="list-table tf-list-table">
                    <thead>
                        <tr>
                            <th style="width:30px"></th>
                            <th><?= e(t('tasks.task')) ?></th>
                            <th>Store</th>
                            <th><?= e(t('task.assignee_label')) ?></th>
                            <th><?= e(t('tasks.due')) ?></th>
                            <th><?= e(t('tasks.priority')) ?></th>
                            <th>Repeat</th>
                            <th><?= e(t('tasks.status')) ?></th>
                            <th style="width:160px">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($groupTasks as $task):
                            $dueBucket     = app_task_due_bucket($task);
                            $repeatSummary = app_task_repeat_summary($task);
                            $_rowDone      = !empty($task['is_completed']);
                        ?>
                        <tr class="list-task-row <?= $dueBucket === 'overdue' ? 'row-overdue' : '' ?> <?= $_rowDone ? 'row-completed' : '' ?>" data-task-row-id="<?= (int)$task['id'] ?>">
                            <td><div class="task-check <?= $_rowDone ? 'completed' : '' ?>" onclick="toggleTask(<?= $task['id'] ?>)"><?= $_rowDone ? '✓' : '' ?></div></td>
                            <td>
                                <a href="javascript:void(0)" class="task-row-title" onclick="window.TaskDrawer && window.TaskDrawer.focusTask(<?= $task['id'] ?>, { projectId: <?= (int)$project['id'] ?> })"
                                   style="font-weight:600;color:<?= $_rowDone ? 'var(--text-muted)' : 'var(--text)' ?>;<?= $_rowDone ? 'text-decoration:line-through;' : '' ?>"><?= e($task['title']) ?></a>
                                <?php if (!$_rowDone): ?>
                                <div class="text-muted text-sm" style="margin-top:3px"><?= e($task['description'] ? mb_substr($task['description'], 0, 80) : '') ?></div>
                                <?php endif; ?>
                            </td>
                            <td class="text-muted text-sm"><?= e($task['store_name'] ?? ($projectStore['name'] ?? '-')) ?></td>
                            <td>
                                <?php if (!empty($task['assignee_name'])): ?>
                                <div style="display:flex;align-items:center;gap:5px">
                                    <span style="background:var(--bg-tertiary);border-radius:99px;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0"><?= mb_strtoupper(mb_substr($task['assignee_name'],0,1)) ?></span>
                                    <span class="text-sm"><?= e($task['assignee_name']) ?></span>
                                </div>
                                <?php else: ?>
                                <span class="text-muted text-sm" style="font-style:italic">—</span>
                                <?php endif; ?>
                            </td>
                            <td class="text-sm">
                                <?php if ($task['due_date']): ?>
                                <span style="color:<?= $dueBucket === 'overdue' ? '#f87171' : ($dueBucket === 'today' ? '#fde68a' : 'var(--text-muted)') ?>;font-weight:<?= $dueBucket === 'overdue' ? '700' : '400' ?>">
                                    <?= date('d/m/Y', strtotime($task['due_date'])) ?>
                                    <?php if ($dueBucket === 'overdue'): ?>
                                    <span style="font-size:10px">🔴</span>
                                    <?php elseif ($dueBucket === 'today'): ?>
                                    <span style="font-size:10px">🟡</span>
                                    <?php endif; ?>
                                </span>
                                <?php else: ?><span class="text-muted">—</span><?php endif; ?>
                            </td>
                            <td><span class="tag priority-<?= $task['priority'] ?>"><?php $pMap=['low'=>t('task.priority_low'),'medium'=>t('task.priority_medium'),'high'=>t('task.priority_high'),'urgent'=>t('task.priority_urgent')]; echo e($pMap[$task['priority']] ?? ucfirst($task['priority'])); ?></span></td>
                            <td class="text-sm" style="color:var(--text-muted)"><?= e($repeatSummary ?: '—') ?></td>
                            <td>
                                <span class="badge badge-<?= $task['status'] === 'done' || $_rowDone ? 'active' : ($task['status'] === 'in_progress' ? 'inprog' : 'member') ?>">
                                    <?= e(ucfirst(str_replace('_',' ',$task['status'] ?? 'todo'))) ?>
                                </span>
                            </td>
                            <td>
                                <div class="tf-row-actions">
                                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.TaskDrawer && window.TaskDrawer.focusTask(<?= $task['id'] ?>, { projectId: <?= (int)$project['id'] ?> })">View</button>
                                    <button type="button" class="btn <?= empty($task['is_completed']) ? 'btn-primary' : 'btn-outline' ?> btn-sm" data-task-action-btn onclick="toggleTask(<?= $task['id'] ?>)"><?= empty($task['is_completed']) ? '✓ Done' : '↩ Reopen' ?></button>
                                </div>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
                </div><!-- .tf-group-body -->
            </div>
            <?php endforeach; ?>
        </div>
        <?php endif; ?>
    </div>
</div>

<?php elseif ($view === 'timeline'): ?>
<?php
    // TKT-103 · TZ-safe: derive everything from the workspace timezone
    $todayStr = app_today();
    $nowLocal = app_now();
    $calMonth = isset($_GET['month']) ? (int)$_GET['month'] : (int)$nowLocal->format('n');
    $calYear  = isset($_GET['year'])  ? (int)$_GET['year']  : (int)$nowLocal->format('Y');
    if ($calMonth < 1) { $calMonth = 12; $calYear--; }
    if ($calMonth > 12) { $calMonth = 1; $calYear++; }
    $monthStart  = app_month_start($calYear, $calMonth);
    $daysInMonth = (int)$monthStart->format('t');
    $startDow    = (int)$monthStart->format('w'); // 0=Sun

    // Build task map by date
    $tasksByDate = [];
    foreach ($tasks as $task) {
        if (!empty($task['due_date'])) {
            $tasksByDate[$task['due_date']][] = $task;
        }
    }

    $monthNames = explode(',', t('bills.month_names'));
    $prevM = $calMonth - 1; $prevY = $calYear;
    if ($prevM < 1) { $prevM = 12; $prevY--; }
    $nextM = $calMonth + 1; $nextY = $calYear;
    if ($nextM > 12) { $nextM = 1; $nextY++; }

    $priColors = ['urgent'=>'#dc2626','high'=>'#f59e0b','medium'=>'#3b82f6','low'=>'#71717a'];
    $priLabels = ['urgent'=>t('task.priority_urgent'),'high'=>t('task.priority_high'),'medium'=>t('task.priority_medium'),'low'=>t('task.priority_low')];
    $dowNames = [t('calendar.dow_sun'),t('calendar.dow_mon'),t('calendar.dow_tue'),t('calendar.dow_wed'),t('calendar.dow_thu'),t('calendar.dow_fri'),t('calendar.dow_sat')];
?>
<?php
// TKT-108 · preserve active filters when navigating prev/next month
$prevUrlParams = array_merge($taskControls, ['view' => 'timeline', 'month' => $prevM, 'year' => $prevY]);
$nextUrlParams = array_merge($taskControls, ['view' => 'timeline', 'month' => $nextM, 'year' => $nextY]);
$todayUrlParams = array_merge($taskControls, ['view' => 'timeline', 'month' => (int)$nowLocal->format('n'), 'year' => (int)$nowLocal->format('Y')]);
?>
<div class="proj-cal">
    <div class="proj-cal-nav">
        <a href="?<?= e(http_build_query($prevUrlParams)) ?>" class="btn btn-ghost btn-sm">◀</a>
        <h3 style="margin:0;font-size:16px"><?= e($monthNames[$calMonth] ?? ('Tháng ' . $calMonth)) ?> <?= $calYear ?></h3>
        <div class="flex gap-2">
            <input type="month" class="form-control" style="max-width:170px" value="<?= sprintf('%04d-%02d', $calYear, $calMonth) ?>" onchange="jumpProjectTimeline(this.value)">
            <a href="?<?= e(http_build_query($todayUrlParams)) ?>" class="btn btn-outline btn-sm">Today</a>
            <a href="?<?= e(http_build_query($nextUrlParams)) ?>" class="btn btn-ghost btn-sm">▶</a>
        </div>
    </div>
    <div class="proj-cal-grid">
        <?php foreach ($dowNames as $dn): ?>
            <div class="proj-cal-dow"><?= e($dn) ?></div>
        <?php endforeach; ?>

        <?php for ($i = 0; $i < $startDow; $i++): ?>
            <div class="proj-cal-day proj-cal-day-empty"></div>
        <?php endfor; ?>

        <?php for ($day = 1; $day <= $daysInMonth; $day++):
            $dateStr = sprintf('%04d-%02d-%02d', $calYear, $calMonth, $day);
            $isToday = $dateStr === $todayStr;
            $dayTasks = $tasksByDate[$dateStr] ?? [];
        ?>
            <?php
            // Determine cell state for border tint
            $_cellHasOverdue = false; $_cellHasSoon = false;
            foreach ($dayTasks as $_dt) {
                if (empty($_dt['is_completed'])) {
                    if (!empty($_dt['due_date']) && $_dt['due_date'] < $todayStr) $_cellHasOverdue = true;
                    elseif (!empty($_dt['due_date']) && $_dt['due_date'] === $todayStr) $_cellHasSoon = true;
                }
            }
            $_dayClass = 'proj-cal-day';
            if ($isToday)          $_dayClass .= ' proj-cal-today';
            if ($_cellHasOverdue)  $_dayClass .= ' pcday-has-overdue';
            elseif ($_cellHasSoon) $_dayClass .= ' pcday-has-today';
            ?>
            <div class="<?= $_dayClass ?>" onclick="openProjectDayDetail('<?= $dateStr ?>')">
                <div class="proj-cal-day-num-row">
                    <div class="proj-cal-day-num <?= $isToday ? 'today-num' : '' ?>"><?= $day ?></div>
                    <?php if (count($dayTasks) > 0): ?>
                    <span class="pcday-count"><?= count($dayTasks) ?></span>
                    <?php endif; ?>
                </div>
                <?php foreach (array_slice($dayTasks, 0, 3) as $dt):
                    $pc = $priColors[$dt['priority']] ?? '#71717a';
                    $repeatSummary = app_task_repeat_summary($dt);
                    $isTaskOverdue = !empty($dt['due_date']) && $dt['due_date'] < $todayStr && empty($dt['is_completed']);
                    $isTaskToday   = !empty($dt['due_date']) && $dt['due_date'] === $todayStr && empty($dt['is_completed']);
                    $isCritical = $isTaskOverdue && ((strtotime($todayStr) - strtotime($dt['due_date'])) / 86400) > 7;
                    $taskClasses = 'proj-cal-task';
                    if (!empty($dt['is_completed'])) $taskClasses .= ' proj-cal-task-completed';
                    elseif ($isTaskOverdue) { $taskClasses .= ' proj-cal-task-overdue'; if ($isCritical) $taskClasses .= ' proj-cal-task-critical-overdue'; }
                    elseif ($isTaskToday)   $taskClasses .= ' proj-cal-task-today';
                    $_assigneeInitial = !empty($dt['assignee_name']) ? mb_strtoupper(mb_substr($dt['assignee_name'], 0, 1)) : null;
                ?>
                    <div class="<?= $taskClasses ?>" style="border-left:3px solid <?= $pc ?>"
                         onclick="event.stopPropagation(); window.TaskDrawer && window.TaskDrawer.focusTask(<?= $dt['id'] ?>, { projectId: <?= (int)$project['id'] ?> })"
                         title="<?= e($dt['title']) . (!empty($dt['assignee_name']) ? ' · ' . $dt['assignee_name'] : '') ?>">
                        <span class="proj-cal-task-title">
                            <?php if ($dt['is_completed']): ?><span style="opacity:.7">✓</span> <?php endif; ?>
                            <?= e(mb_substr($dt['title'], 0, 18)) ?>
                        </span>
                        <span class="proj-cal-task-right">
                            <?php if ($repeatSummary): ?><span class="proj-cal-task-pill">↻</span><?php endif; ?>
                            <?php if ($_assigneeInitial): ?><span class="pcday-assignee"><?= $_assigneeInitial ?></span><?php endif; ?>
                        </span>
                    </div>
                <?php endforeach; ?>
                <?php if (count($dayTasks) > 3): ?>
                    <div class="proj-cal-more" onclick="event.stopPropagation();openProjectDayDetail('<?= $dateStr ?>')">
                        +<?= count($dayTasks) - 3 ?> more — click to see all
                    </div>
                <?php endif; ?>
            </div>
        <?php endfor; ?>
    </div>
</div>
<style>
.proj-cal-nav{display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:16px}
.proj-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:8px;overflow:hidden}
.proj-cal-dow{background:var(--bg-secondary);padding:8px;text-align:center;font-weight:600;font-size:12px;color:var(--text-muted);text-transform:uppercase}
.proj-cal-day{background:var(--bg-primary);min-height:100px;padding:4px 6px;position:relative}
.proj-cal-day-empty{background:var(--bg-secondary);opacity:.5}
.proj-cal-today{background:rgba(220,38,38,.05)}
.proj-cal-day-num{font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:4px}
.today-num{background:var(--accent);color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px}
.proj-cal-task{font-size:11px;padding:2px 5px;margin-bottom:2px;border-radius:3px;background:var(--bg-secondary);cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;transition:background .15s}
.proj-cal-task:hover{background:var(--bg-tertiary)}
.proj-cal-more{font-size:10px;color:var(--text-muted);padding:1px 5px;cursor:default}
.proj-cal-task-pill{font-size:9px;padding:1px 4px;border:1px solid var(--border);border-radius:999px;color:var(--text-muted)}
.proj-cal-task-title{display:inline-flex;align-items:center;gap:4px;min-width:0}

/* Completed: strikethrough + fade — impossible to mistake for active work */
.proj-cal-task-completed{
    opacity:.5;
    background:linear-gradient(135deg,#14532d,#166534) !important;
    color:#bbf7d0 !important;
}
.proj-cal-task-completed:hover{opacity:.8}
.proj-cal-task-completed .proj-cal-task-title{
    text-decoration:line-through;
    text-decoration-thickness:1.5px;
    text-decoration-color:rgba(187,247,208,.6);
}

/* Overdue: calm red accent — no pulse for enterprise look */
.proj-cal-task-overdue{
    background:linear-gradient(135deg,rgba(127,29,29,.85),rgba(153,27,27,.9)) !important;
    color:#fef2f2 !important;
    box-shadow:inset 3px 0 0 #f87171;
    border-color:rgba(220,38,38,.45);
}
.proj-cal-task-critical-overdue::before{content:'🔥 ';font-size:10px}
.proj-cal-task-overdue:not(.proj-cal-task-critical-overdue)::before{content:'! ';font-weight:700;color:#fca5a5}

/* Today: warm orange glow */
.proj-cal-task-today{
    background:linear-gradient(135deg,#7c2d12,#9a3412) !important;
    color:#fff7ed !important;
    box-shadow:0 0 0 1px rgba(234,88,12,.5), inset 3px 0 0 #fdba74;
}

/* ── Smart Operational Banner ─────────────────────────────── */
.tf-smart-banner{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 14px;border-radius:12px;border:1px solid var(--border);background:var(--bg-secondary);margin-bottom:14px}
.tf-sb-item{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:8px;font-size:12px;text-decoration:none;color:var(--text);border:1px solid transparent;transition:opacity .15s}
.tf-sb-item:hover{opacity:.8}
.tf-sb-num{font-size:16px;font-weight:800;line-height:1}
.tf-sb-lbl{font-weight:500}
.tf-sb-arrow{font-size:14px}
.tf-sb-overdue{background:rgba(220,38,38,.12);border-color:rgba(220,38,38,.25);color:#fca5a5}
.tf-sb-overdue .tf-sb-num{color:#f87171}
.tf-sb-today{background:rgba(234,179,8,.1);border-color:rgba(234,179,8,.25);color:#fde68a}
.tf-sb-today .tf-sb-num{color:#facc15}
.tf-sb-inprog{background:rgba(59,130,246,.1);border-color:rgba(59,130,246,.2);color:#93c5fd}
.tf-sb-inprog .tf-sb-num{color:#60a5fa}
.tf-sb-warn{background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.2);color:#fcd34d}
.tf-sb-ok{color:#86efac;font-size:13px;font-weight:600}
.tf-sb-spacer{flex:1}

/* ── Board card urgency bar ───────────────────────────────── */
.tc-urgency-bar{height:3px;margin:-10px -10px 8px -14px;border-radius:4px 4px 0 0;flex-shrink:0}
.tc-ub-overdue  {background:linear-gradient(90deg,#dc2626,#f87171)}
.tc-ub-today    {background:linear-gradient(90deg,#ea580c,#fb923c)}
.tc-ub-in_progress{background:linear-gradient(90deg,#3b82f6,#60a5fa)}
.tc-ub-upcoming {background:var(--border)}
.tc-ub-no_date  {background:transparent}
.tc-ub-completed{background:linear-gradient(90deg,#16a34a,#4ade80)}

/* Board card due date urgency coloring */
.tc-due-overdue  {color:#f87171;font-weight:700}
.tc-due-today    {color:#fde68a;font-weight:600}
.tc-due-upcoming {color:var(--text-muted)}

/* Board card assignee row */
.tc-assignee-row{display:flex;align-items:center;gap:5px;margin-top:8px;padding-top:7px;border-top:1px solid var(--border)}
.tc-assignee-avatar{width:18px;height:18px;border-radius:99px;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;flex-shrink:0;color:var(--text-muted)}
.tc-assignee-name{font-size:11px;color:var(--text-muted)}

/* Board card done state */
.task-card-done{opacity:.5;border-color:rgba(74,222,128,.2) !important}
.task-card-done .task-title-done{text-decoration:line-through;color:var(--text-muted)}
.task-card-due-today{border-color:rgba(251,191,36,.35) !important;box-shadow:0 0 0 1px rgba(251,191,36,.15)}

/* Status badges */
.badge-inprog{background:#1e40af;color:#93c5fd}
.badge-review{background:#6b21a8;color:#e9d5ff}

/* ── List group improvements ─────────────────────────────── */
.tf-group-urgent .tf-list-group-head{background:rgba(220,38,38,.08);border-left:3px solid #dc2626}
.tf-group-head-urgent{color:#fca5a5}
.tf-group-completed .tf-list-group-head{background:rgba(74,222,128,.04);opacity:.75}
.tf-group-head-completed{color:var(--text-muted)}
.tf-group-caret{display:inline-block;font-size:11px;margin-right:4px;transition:transform .2s}

/* Completed rows — much stronger de-emphasis */
.row-completed{opacity:.38;font-size:11.5px}
.row-completed td{vertical-align:middle !important}
.row-completed:hover{opacity:.6}

/* List empty hint */
.tf-list-empty-hint{padding:10px 16px;font-size:12px;color:#86efac;border-radius:8px;background:rgba(74,222,128,.06);border:1px solid rgba(74,222,128,.15);margin-bottom:12px}

/* ── Calendar day cell improvements ─────────────────────── */
.proj-cal-day-num-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.pcday-count{font-size:9px;background:var(--bg-tertiary);color:var(--text-muted);border-radius:99px;padding:0 5px;line-height:16px}
.pcday-has-overdue{border-top:2px solid rgba(220,38,38,.6) !important}
.pcday-has-today{border-top:2px solid rgba(234,179,8,.5) !important}
.proj-cal-task{display:flex;justify-content:space-between;align-items:center}
.proj-cal-task-right{display:flex;align-items:center;gap:2px;flex-shrink:0}
.pcday-assignee{width:14px;height:14px;border-radius:99px;background:var(--bg-tertiary);display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:var(--text-muted);flex-shrink:0}
.proj-cal-more{font-size:10px;color:var(--accent);cursor:pointer;padding:2px 5px;text-align:left;font-style:italic;opacity:.8}
.proj-cal-more:hover{opacity:1;text-decoration:underline}
</style>
<?php endif; ?>

<!-- Task Detail Modal -->
<div class="modal-overlay" id="taskModal">
    <div class="modal"><div class="modal-header"><h3 id="modalTaskTitle"><?= e(t('tasks.task')) ?></h3><button class="btn-ghost" onclick="closeTaskModal()">✕</button></div><div class="modal-body" id="modalTaskBody"><p><?= e(t('common.loading')) ?></p></div></div>
</div>

<!-- Project day drawer now rendered by shared TaskDrawer component (see extraJs/task-drawer.js) -->

<!-- New Task Modal -->
<div class="modal-overlay" id="newTaskModal">
    <div class="modal">
        <div class="modal-header"><h3><?= e(t('task.create_title')) ?></h3><button class="btn-ghost" onclick="closeNewTaskModal()">✕</button></div>
        <div class="modal-body">
            <form method="POST" action="<?= APP_URL ?>/tasks">
                <input type="hidden" name="project_id" value="<?= $project['id'] ?>">
                <div class="form-group"><label><?= e(t('task.title_required')) ?></label><input type="text" name="title" class="form-control" required placeholder="<?= e(t('task.name_placeholder')) ?>"></div>
                <div class="form-group"><label><?= e(t('task.description_label')) ?></label><textarea name="description" class="form-control" placeholder="<?= e(t('task.detail_placeholder')) ?>"></textarea></div>
                <div class="grid grid-2">
                    <div class="form-group"><label><?= e(t('task.section')) ?></label><select name="section_id" class="form-control"><?php foreach ($sections as $s): ?><option value="<?= $s['id'] ?>"><?= e($s['name']) ?></option><?php endforeach; ?></select></div>
                    <div class="form-group"><label><?= e(t('task.assignee_label')) ?></label><select name="assignee_id" class="form-control"><option value=""><?= e(t('task.select_assignee')) ?></option><?php foreach ($members as $m): ?><option value="<?= $m['id'] ?>"><?= e($m['name']) ?></option><?php endforeach; ?></select></div>
                </div>
                <div class="grid grid-2">
                    <div class="form-group"><label><?= e(t('task.priority_label')) ?></label><select name="priority" class="form-control"><option value="low"><?= e(t('task.priority_low')) ?></option><option value="medium" selected><?= e(t('task.priority_medium')) ?></option><option value="high"><?= e(t('task.priority_high')) ?></option><option value="urgent"><?= e(t('task.priority_urgent')) ?></option></select></div>
                    <div class="form-group"><label>Visibility</label><select name="visibility" class="form-control"><option value="private" selected>Private</option><option value="public">Public</option></select></div>
                </div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label><?= e(t('task.deadline')) ?></label>
                        <div class="tf-date-field">
                            <input type="date" name="due_date" class="form-control" id="newTaskDueDate">
                            <button type="button" class="btn btn-outline btn-sm" onclick="setDateField('newTaskDueDate', 'today')">Today</button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="setDateField('newTaskDueDate', 'clear')">Clear</button>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label><?= e(t('task.start_date')) ?></label>
                    <div class="tf-date-field">
                        <input type="date" name="start_date" class="form-control" id="newTaskStartDate">
                        <button type="button" class="btn btn-outline btn-sm" onclick="setDateField('newTaskStartDate', 'today')">Today</button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="setDateField('newTaskStartDate', 'clear')">Clear</button>
                    </div>
                </div>
                <div class="flex gap-2 mt-4"><button type="submit" class="btn btn-primary"><?= e(t('task.create_btn')) ?></button><button type="button" class="btn btn-secondary" onclick="closeNewTaskModal()"><?= e(t('common.cancel')) ?></button></div>
            </form>
        </div>
    </div>
</div>

<script>
const APP_URL = '<?= APP_URL ?>';
const PROJECT_ID = <?= $project['id'] ?>;
const PROJECT_DAY_TASKS = <?= json_encode($tasksByDate ?? [], JSON_UNESCAPED_UNICODE) ?>;
const TL = {
    title: <?= json_encode(t('task.title_label')) ?>,
    desc: <?= json_encode(t('task.description_label')) ?>,
    priority: <?= json_encode(t('task.priority_label')) ?>,
    status: <?= json_encode(t('task.status_label')) ?>,
    deadline: <?= json_encode(t('task.deadline')) ?>,
    assignee: <?= json_encode(t('task.assignee_label')) ?>,
    select: <?= json_encode(t('task.select_assignee')) ?>,
    save: <?= json_encode(t('common.save')) ?>,
    del: <?= json_encode(t('common.delete')) ?>,
    delConfirm: <?= json_encode(t('common.confirm_delete')) ?>,
    files: <?= json_encode(t('task.files')) ?>,
    comments: <?= json_encode(t('task.comments')) ?>,
    commentPh: <?= json_encode(t('task.comment_placeholder')) ?>,
    commentSend: <?= json_encode(t('task.comment_send')) ?>,
    loading: <?= json_encode(t('common.loading')) ?>,
    loadErr: <?= json_encode(t('task.load_error')) ?>,
    newCol: <?= json_encode(t('task.new_column_name')) ?>,
    error: <?= json_encode(t('task.error')) ?>,
    pLow: <?= json_encode(t('task.priority_low')) ?>,
    pMed: <?= json_encode(t('task.priority_medium')) ?>,
    pHigh: <?= json_encode(t('task.priority_high')) ?>,
    pUrg: <?= json_encode(t('task.priority_urgent')) ?>,
    sTodo: <?= json_encode(t('task.status_todo')) ?>,
    sInProg: <?= json_encode(t('task.status_in_progress')) ?>,
    sReview: <?= json_encode(t('task.status_review')) ?>,
    sDone: <?= json_encode(t('task.status_done')) ?>
};

function openNewTaskModal() { document.getElementById('newTaskModal').classList.add('active'); }
function closeNewTaskModal() { document.getElementById('newTaskModal').classList.remove('active'); }
function setDateField(fieldId, mode) {
    const input = document.getElementById(fieldId);
    if (!input) return;
    if (mode === 'today') {
        // TKT-103 · use workspace TZ today, not UTC-based toISOString()
        input.value = window.APP_TODAY || new Date().toLocaleDateString('en-CA');
        return;
    }
    input.value = '';
}

function openTaskDetail(taskId) {
    const modal = document.getElementById('taskModal');
    const body = document.getElementById('modalTaskBody');
    modal.classList.add('active');
    body.innerHTML = '<p style="color:var(--text-muted)">' + TL.loading + '</p>';
    fetch(APP_URL + '/api/tasks/' + taskId).then(r => r.json()).then(data => {
        const t = data.task, comments = data.comments || [], attachments = data.attachments || [];
        document.getElementById('modalTaskTitle').textContent = t.title;
        const pOpts = [['low',TL.pLow],['medium',TL.pMed],['high',TL.pHigh],['urgent',TL.pUrg]];
        const sOpts = [['todo',TL.sTodo],['in_progress',TL.sInProg],['review',TL.sReview],['done',TL.sDone]];
        body.innerHTML = `
            <form method="POST" action="${APP_URL}/tasks/${t.id}">
                <div class="form-group"><label>${TL.title}</label><input type="text" name="title" class="form-control" value="${esc(t.title)}"></div>
                <div class="form-group"><label>${TL.desc}</label><textarea name="description" class="form-control">${esc(t.description||'')}</textarea></div>
                <div class="grid grid-2">
                    <div class="form-group"><label>${TL.priority}</label><select name="priority" class="form-control">${pOpts.map(([k,v])=>`<option value="${k}" ${t.priority===k?'selected':''}>${v}</option>`).join('')}</select></div>
                    <div class="form-group"><label>${TL.status}</label><select name="status" class="form-control">${sOpts.map(([k,v])=>`<option value="${k}" ${t.status===k?'selected':''}>${v}</option>`).join('')}</select></div>
                </div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label>${TL.deadline}</label>
                        <div class="tf-date-field">
                            <input type="date" id="taskModalDueDate" name="due_date" class="form-control" value="${t.due_date||''}">
                            <button type="button" class="btn btn-outline btn-sm" onclick="setDateField('taskModalDueDate', 'today')">Today</button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="setDateField('taskModalDueDate', 'clear')">Clear</button>
                        </div>
                    </div>
                    <div class="form-group"><label>${TL.assignee}</label><select name="assignee_id" class="form-control"><option value="">${TL.select}</option><?php foreach($members as $m): ?><option value="<?=$m['id']?>" ${t.assignee_id==<?=$m['id']?>?'selected':''}><?=e($m['name'])?></option><?php endforeach;?></select></div>
                </div>
                <div class="form-group"><label>Visibility</label><select name="visibility" class="form-control"><option value="private" ${(t.visibility||'private')==='private'?'selected':''}>Private</option><option value="public" ${(t.visibility||'private')==='public'?'selected':''}>Public</option></select></div>
                <div class="flex gap-2"><button type="submit" class="btn btn-primary btn-sm">${TL.save}</button><a href="${APP_URL}/tasks/${t.id}/delete" class="btn btn-danger btn-sm" onclick="return confirm('${TL.delConfirm}')">${TL.del}</a></div>
            </form>
            <div style="margin-top:18px;border-top:1px solid var(--border);padding-top:14px">
                <h4 style="font-size:13px;margin-bottom:8px">📎 ${TL.files} (${attachments.length})</h4>
                <ul class="attachment-list">${attachments.map(a=>`<li class="attachment-item"><span class="file-icon">📄</span><a href="${APP_URL}/attachments/${a.id}/download">${esc(a.original_name)}</a><span class="file-size">${formatBytes(a.file_size)}</span><a href="${APP_URL}/attachments/${a.id}/delete" class="btn-ghost btn-sm" onclick="return confirm('${TL.delConfirm}')">🗑</a></li>`).join('')}</ul>
                <form id="uploadForm" style="margin-top:8px"><input type="file" id="fileInput" onchange="uploadFile(${t.id})" style="font-size:12px;color:var(--text-muted)"></form>
            </div>
            <div class="comments-section">
                <h4 style="font-size:13px;margin-bottom:10px">💬 ${TL.comments} (${comments.length})</h4>
                <div id="commentsList">${comments.map(c=>`<div class="comment-item"><div class="user-avatar" style="width:28px;height:28px;font-size:10px;flex-shrink:0">${c.user_name.charAt(0).toUpperCase()}</div><div class="comment-body"><div class="flex-between"><span class="comment-author">${esc(c.user_name)}</span><span class="comment-time">${c.created_at}</span></div><div class="comment-text">${esc(c.content)}</div></div></div>`).join('')}</div>
                <form class="comment-form" onsubmit="submitComment(event,${t.id})"><input type="text" placeholder="${TL.commentPh}" id="commentInput" required><button type="submit" class="btn btn-primary btn-sm">${TL.commentSend}</button></form>
            </div>`;
    }).catch(() => { body.innerHTML = '<p class="text-muted">' + TL.loadErr + '</p>'; });
}

function closeTaskModal() { document.getElementById('taskModal').classList.remove('active'); }
// TKT-101 · No-reload complete/reopen. Optimistic UI, toast feedback, recurring-aware.
// List group collapse toggle
function toggleListGroup(headerEl) {
    var group = headerEl.closest('.tf-list-group');
    var body  = group.querySelector('.tf-group-body');
    var caret = headerEl.querySelector('.tf-group-caret');
    var isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : '';
    if (caret) caret.style.transform = isOpen ? '' : 'rotate(90deg)';
    var hint = headerEl.querySelector('.text-muted');
    if (hint) hint.textContent = isOpen ? '— click to expand' : '— click to collapse';
}

function toggleTask(id) {
    const row = document.querySelector('[data-task-row-id="' + id + '"]');
    const csrf = window.CSRF_TOKEN || '';
    // optimistic flip
    if (row) {
        row.classList.toggle('row-completed');
        const completing = row.classList.contains('row-completed');
        row.dataset.pending = '1';
        // swap the action button label if present
        row.querySelectorAll('[data-task-action-btn]').forEach(b => {
            b.textContent = completing ? 'Reopen' : 'Complete';
            b.classList.toggle('btn-primary', !completing);
            b.classList.toggle('btn-outline', completing);
        });
        const check = row.querySelector('.task-check');
        if (check) { check.classList.toggle('completed', completing); check.textContent = completing ? '✓' : ''; }
        const titleA = row.querySelector('.task-row-title');
        if (titleA) titleA.style.textDecoration = completing ? 'line-through' : '';
    }
    const form = new URLSearchParams(); form.append('csrf_token', csrf);
    fetch(APP_URL + '/api/tasks/' + id + '/complete', {
        method: 'POST', credentials: 'same-origin',
        headers: {'Content-Type':'application/x-www-form-urlencoded','X-CSRF-Token':csrf},
        body: form.toString()
    })
    .then(r => r.json())
    .then(j => {
        if (row) delete row.dataset.pending;
        if (j.error) throw new Error(j.error);
        if (j.result && j.result.next_task_id) {
            showToast('✓ Hoàn thành — đã tạo occurrence kế tiếp');
        } else {
            showToast('✓ Đã cập nhật');
        }
    })
    .catch(err => {
        // rollback on error
        if (row) {
            row.classList.toggle('row-completed');
            delete row.dataset.pending;
        }
        showToast(err.message || 'Lỗi khi cập nhật', 'error');
    });
}

function showToast(msg, type) {
    let wrap = document.getElementById('pf-toast-wrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'pf-toast-wrap';
        wrap.style.cssText = 'position:fixed;top:16px;right:16px;z-index:1100;display:flex;flex-direction:column;gap:8px';
        document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.style.cssText = 'background:rgba(15,23,42,.96);color:#f1f5f9;border:1px solid rgba(255,255,255,.1);border-left:3px solid ' + (type === 'error' ? '#ef4444' : '#22c55e') + ';padding:10px 14px;border-radius:8px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.35);max-width:320px';
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; }, 2400);
    setTimeout(() => el.remove(), 2800);
}
function quickAddTask(sid) { const el=document.getElementById('quickAdd-'+sid); el.classList.toggle('active'); if(el.classList.contains('active'))el.querySelector('input').focus(); }
function submitQuickTask(e,pid,sid) { e.preventDefault(); const i=e.target.querySelector('input'); if(!i.value.trim())return; const f=new FormData(); f.append('project_id',pid); f.append('section_id',sid); f.append('title',i.value.trim()); fetch(APP_URL+'/tasks',{method:'POST',body:f}).then(()=>location.reload()); }
function addNewSection(pid) { const n=prompt(TL.newCol); if(!n)return; const f=new FormData(); f.append('name',n); fetch(APP_URL+'/projects/'+pid+'/sections',{method:'POST',body:f}).then(()=>location.reload()); }
function submitComment(e,tid) { e.preventDefault(); const i=document.getElementById('commentInput'); if(!i.value.trim())return; const f=new FormData(); f.append('content',i.value.trim()); fetch(APP_URL+'/tasks/'+tid+'/comments',{method:'POST',body:f}).then(r=>r.json()).then(d=>{if(d.success){i.value='';openTaskDetail(tid)}}); }
function uploadFile(tid) { const fi=document.getElementById('fileInput'); if(!fi.files[0])return; const f=new FormData(); f.append('file',fi.files[0]); fetch(APP_URL+'/tasks/'+tid+'/upload',{method:'POST',body:f}).then(r=>r.json()).then(d=>{if(d.success)openTaskDetail(tid);else alert(d.error||TL.error)}); }
function jumpProjectTimeline(value) {
    if (!value) return;
    const [year, month] = value.split('-');
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'timeline');
    url.searchParams.set('year', year);
    url.searchParams.set('month', Number(month));
    window.location.href = url.toString();
}
function closeProjectDayDetail() { window.TaskDrawer && window.TaskDrawer.close(); }
function openProjectDayDetail(dateKey) {
    const pid = (typeof PROJECT_ID !== 'undefined') ? PROJECT_ID : null;
    window.TaskDrawer && window.TaskDrawer.open(dateKey, pid ? { projectId: pid } : {});
}
document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',function(e){if(e.target===this)this.classList.remove('active')}));

// TKT-105 · advanced-filters toggle (persisted in localStorage)
(function(){
    const btn = document.querySelector('[data-tf-adv-toggle]');
    const bar = document.getElementById('tf-filter-bar');
    if (!btn || !bar) return;
    const KEY = 'tf-adv-open';
    // If ?tf_adv=1 is in URL, start expanded
    const urlWants = new URLSearchParams(location.search).get('tf_adv') === '1';
    const stored = localStorage.getItem(KEY);
    let open = stored === '1' || urlWants || !bar.hasAttribute('hidden');
    const apply = () => {
        if (open) { bar.removeAttribute('hidden'); btn.setAttribute('aria-expanded', 'true'); }
        else { bar.setAttribute('hidden', ''); btn.setAttribute('aria-expanded', 'false'); }
    };
    apply();
    btn.addEventListener('click', () => { open = !open; localStorage.setItem(KEY, open ? '1' : '0'); apply(); });
})();
</script>
<style>
/* Hero — sticky, always shows actions on right regardless of board width */
.taskflow-hero{position:sticky;top:0;z-index:35;display:flex;justify-content:space-between;gap:16px;align-items:center;padding:14px 20px;border:1px solid var(--border);border-radius:14px;background:rgba(15,23,42,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);margin-bottom:14px;flex-wrap:nowrap}
.taskflow-hero-left{flex:1;min-width:0}
.taskflow-hero-actions{display:flex;gap:8px;align-items:center;flex-shrink:0;flex-wrap:nowrap}
@media(max-width:640px){.taskflow-hero{flex-wrap:wrap;position:relative}.taskflow-hero-actions{flex-wrap:wrap}}
.taskflow-title-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.tf-chip,.tf-chip-link{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;border:1px solid var(--border);background:rgba(255,255,255,.04);font-size:12px;color:var(--text-secondary);text-decoration:none}
.tf-chip.subtle{background:transparent;padding:4px 8px}
/* TKT-104/105 · preset chips — AI-system polish */
.tf-preset-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px;padding:10px 0}
.tf-preset{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:999px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text);text-decoration:none;font-size:13px;font-weight:500;transition:background .15s,border-color .15s,transform .08s,box-shadow .15s;cursor:pointer;line-height:1}
.tf-preset:hover{background:rgba(99,102,241,.1);border-color:rgba(99,102,241,.35);transform:translateY(-1px)}
.tf-preset-active{background:linear-gradient(135deg,#6366f1,#8b5cf6);border-color:transparent;color:#fff;font-weight:600;box-shadow:0 4px 12px rgba(99,102,241,.35)}
.tf-preset-active:hover{background:linear-gradient(135deg,#4f46e5,#7c3aed);transform:translateY(-1px);box-shadow:0 6px 16px rgba(99,102,241,.45)}
.tf-preset-icon{display:inline-flex;align-items:center;opacity:.85}
.tf-preset-active .tf-preset-icon{opacity:1}
.tf-preset-danger{color:#fca5a5}
.tf-preset-danger:hover{background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.35)}
.tf-preset-danger.tf-preset-active{background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;box-shadow:0 4px 12px rgba(239,68,68,.35)}
.tf-preset-custom{background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.35);color:#fcd34d;cursor:default}
.tf-preset-sep{flex:1}
.tf-adv-toggle{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-muted);font-size:12px;cursor:pointer;transition:all .12s}
.tf-adv-toggle:hover{background:rgba(255,255,255,.05);color:var(--text)}
.tf-adv-toggle[aria-expanded="true"] .tf-adv-caret{transform:rotate(180deg)}
.tf-adv-caret{transition:transform .2s;display:inline-block}
.tf-adv-count{background:#6366f1;color:#fff;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:600}
.tf-filter-bar{border:1px solid var(--border);border-radius:16px;padding:14px;background:var(--bg-secondary);margin-bottom:18px}
.tf-filter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.tf-filter-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px}
.tf-chip-row{display:flex;gap:8px;flex-wrap:wrap}
.task-card-enhanced{border:1px solid var(--border);border-left:4px solid transparent}
.task-card-overdue{border-color:rgba(255,43,214,.4);box-shadow:0 0 0 1px rgba(255,43,214,.15)}
.task-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}
.task-card-context{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.task-meta-strong{display:flex;align-items:center;justify-content:space-between;gap:8px}
.tf-list-wrap{display:flex;flex-direction:column;gap:16px;padding:16px}
.tf-list-group{border:1px solid var(--border);border-radius:14px;overflow:hidden}
.tf-list-group-head{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:var(--bg-secondary);font-weight:700}
.tf-list-table td,.tf-list-table th{vertical-align:top}
.row-completed{opacity:.62}
.tf-row-actions{display:flex;gap:8px;flex-wrap:wrap}
.tf-day-toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.tf-day-list{display:flex;flex-direction:column;gap:12px}
.tf-day-item{display:flex;justify-content:space-between;gap:12px;padding:14px;border:1px solid var(--border);border-radius:14px;background:var(--bg-secondary)}
.tf-day-item.completed{opacity:.68}
.tf-day-item-title{font-weight:700;margin-bottom:6px}
.tf-day-item-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--text-muted)}
.tf-day-item-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.tf-date-field{display:flex;gap:8px;align-items:center}
.modal-wide{max-width:920px;width:min(92vw,920px)}
.density-compact .task-card,.density-compact .list-task-row td{font-size:12px}
.density-detailed .task-card{padding:14px}
@media (max-width: 768px){
  .taskflow-hero{flex-direction:column}
  .tf-day-item{flex-direction:column}
  .tf-date-field{flex-wrap:wrap}
}
</style>
<?php
$extraCss = array_merge($extraCss ?? [], ['task-drawer.css']);
$extraJs  = array_merge($extraJs ?? [], ['task-drawer.js']);
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
