<?php
/**
 * Shared task row partial for admin detail pages.
 * Requires: $rowTasks (array), $today (string Y-m-d)
 * Optional: $showAssignee (bool), $emptyMsg (string)
 */
$showAssignee = $showAssignee ?? false;
$emptyMsg = $emptyMsg ?? 'No tasks found.';
$priColors = ['urgent'=>'#dc2626','high'=>'#f59e0b','medium'=>'#3b82f6','low'=>'#71717a'];
$priLabels = ['urgent'=>'Urgent','high'=>'High','medium'=>'Medium','low'=>'Low'];
$repeatMap = ['daily'=>'Daily','weekly'=>'Weekly','monthly'=>'Monthly','yearly'=>'Yearly','weekly_multi'=>'Custom Week','custom_interval'=>'Custom'];
?>
<?php if (empty($rowTasks)): ?>
    <div class="ad-empty"><?= e($emptyMsg) ?></div>
<?php else: ?>
<div class="ad-task-list">
    <?php foreach ($rowTasks as $t):
        $isOverdue = !empty($t['due_date']) && $t['due_date'] < $today && empty($t['is_completed']);
        $isToday   = !empty($t['due_date']) && $t['due_date'] === $today && empty($t['is_completed']);
        $classes = 'ad-task';
        if (!empty($t['is_completed'])) $classes .= ' ad-task-done';
        elseif ($isOverdue) $classes .= ' ad-task-overdue';
        elseif ($isToday)   $classes .= ' ad-task-today';
        $pc = $priColors[$t['priority'] ?? 'medium'] ?? '#71717a';
    ?>
    <a class="<?= $classes ?>" href="<?= APP_URL ?>/tasks/<?= (int)$t['id'] ?>" onclick="if(window.TaskDrawer){event.preventDefault();window.TaskDrawer.focusTask(<?= (int)$t['id'] ?>)}" style="border-left-color:<?= e($pc) ?>">
        <div class="ad-task-main">
            <div class="ad-task-title">
                <?php if (!empty($t['is_completed'])): ?>✓ <?php elseif ($isOverdue): ?>🔥 <?php endif; ?>
                <?= e($t['title']) ?>
            </div>
            <div class="ad-task-meta">
                <?php if (!empty($t['project_name'])): ?>
                    <span class="ad-chip" style="border-left:3px solid <?= e($t['project_color'] ?? '#6366f1') ?>">📁 <?= e($t['project_name']) ?></span>
                <?php endif; ?>
                <?php if (!empty($t['store_name'])): ?>
                    <span class="ad-chip">🏪 <?= e($t['store_name']) ?></span>
                <?php endif; ?>
                <?php if ($showAssignee && !empty($t['assignee_name'])): ?>
                    <span class="ad-chip">👤 <?= e($t['assignee_name']) ?></span>
                <?php endif; ?>
                <span class="ad-chip ad-chip-pri-<?= e($t['priority'] ?? 'medium') ?>"><?= e($priLabels[$t['priority'] ?? 'medium']) ?></span>
                <span class="ad-chip">● <?= e(str_replace('_', ' ', $t['status'] ?? 'todo')) ?></span>
                <?php if (!empty($t['repeat_type']) && $t['repeat_type'] !== 'none'): ?>
                    <span class="ad-chip ad-chip-rec">↻ <?= e($repeatMap[$t['repeat_type']] ?? $t['repeat_type']) ?></span>
                <?php endif; ?>
                <?php if ($isOverdue): ?><span class="ad-chip ad-chip-overdue">! <?= e(t('task.overdue_label')) ?></span><?php endif; ?>
                <?php if ($isToday): ?><span class="ad-chip ad-chip-today">● <?= e(t('task.today_label')) ?></span><?php endif; ?>
            </div>
        </div>
        <div class="ad-task-side">
            <?php if (!empty($t['due_date'])): ?>
                <div class="ad-due <?= $isOverdue ? 'ad-due-overdue' : ($isToday ? 'ad-due-today' : '') ?>">
                    📅 <?= e(date('d/m/Y', strtotime($t['due_date']))) ?>
                </div>
            <?php else: ?>
                <div class="ad-due" style="opacity:.5">No due</div>
            <?php endif; ?>
        </div>
    </a>
    <?php endforeach; ?>
</div>
<?php endif; ?>
