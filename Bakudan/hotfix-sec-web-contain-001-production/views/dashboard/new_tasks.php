<?php
$pageTitle = t('nav.new_tasks');
$currentPage = 'new-tasks';
ob_start();
?>

<div class="new-tasks-page">
    <?php if (empty($newTasks)): ?>
        <div class="card">
            <div class="empty-state" style="padding:48px 20px">
                <div class="icon"><?= tf_icon('check-circle', 48) ?></div>
                <h3><?= e(t('new_tasks.empty')) ?></h3>
                <p><?= e(t('new_tasks.empty_desc')) ?></p>
            </div>
        </div>
    <?php else: ?>
        <div class="flex-between mb-3">
            <p class="text-muted text-sm"><?= count($newTasks) ?> <?= e(t('new_tasks.pending_count')) ?></p>
        </div>

        <div class="new-tasks-list">
            <?php foreach ($newTasks as $task):
                $hasDate = !empty($task['due_date']);
                $color = $task['project_color'] ?? '#3b82f6';
                $priColors = ['urgent'=>'var(--accent)','high'=>'var(--amber)','medium'=>'var(--blue)','low'=>'var(--text-muted)'];
                $priColor = $priColors[$task['priority']] ?? 'var(--text-muted)';
            ?>
            <div class="new-task-card" style="--task-color:<?= e($color) ?>">
                <div class="new-task-accent" style="background:<?= e($color) ?>"></div>
                <div class="new-task-body">
                    <div class="new-task-header">
                        <div>
                            <h4 class="new-task-title"><?= e($task['title']) ?></h4>
                            <div class="new-task-meta">
                                <?php if ($task['project_name']): ?>
                                <span class="new-task-project" style="color:<?= e($color) ?>"><?= tf_icon('folder', 12) ?> <?= e($task['project_name']) ?></span>
                                <?php endif; ?>
                                <?php if ($task['store_name']): ?>
                                <span class="new-task-store"><?= tf_icon('store', 12) ?> <?= e($task['store_name']) ?></span>
                                <?php endif; ?>
                                <span class="new-task-from"><?= tf_icon('user', 12) ?> <?= e($task['creator_name'] ?? '') ?></span>
                            </div>
                        </div>
                        <div class="new-task-priority" style="background:<?= $priColor ?>15;color:<?= $priColor ?>;border:1px solid <?= $priColor ?>33">
                            <?= e(ucfirst($task['priority'])) ?>
                        </div>
                    </div>

                    <?php if ($task['description']): ?>
                    <p class="new-task-desc"><?= e(mb_substr($task['description'], 0, 120)) ?></p>
                    <?php endif; ?>

                    <div class="new-task-actions">
                        <div class="new-task-date-info">
                            <?php if ($hasDate): ?>
                                <span class="new-task-date"><?= tf_icon('calendar', 14) ?> <?= date('d/m/Y', strtotime($task['due_date'])) ?></span>
                            <?php else: ?>
                                <span class="new-task-date new-task-missing"><?= tf_icon('alert-circle', 14) ?> <?= e(t('new_tasks.missing_date')) ?></span>
                            <?php endif; ?>
                        </div>

                        <div class="new-task-btns">
                            <a href="<?= APP_URL ?>/tasks/<?= $task['id'] ?>" class="btn btn-primary btn-sm"><?= tf_icon('arrow-right', 14) ?> <?= e(t('new_tasks.view')) ?></a>
                        </div>
                    </div>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</div>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
