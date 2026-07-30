<?php
$pageTitle = t('nav.projects');
$currentPage = 'projects';
ob_start();
?>

<?php if (empty($projects)): ?>
    <div class="empty-state"><div class="icon"><?= tf_icon('folder-open', 40) ?></div><h3><?= e(t('project.no_projects')) ?></h3><p><?= e(t('project.create_first')) ?></p><a href="<?= APP_URL ?>/projects/create" class="btn btn-primary mt-3"><?= e(t('dashboard.create_project')) ?></a></div>
<?php else: ?>
    <div class="grid grid-3">
        <?php foreach ($projects as $proj):
            $pct = $proj['task_count'] > 0 ? round($proj['completed_count'] / $proj['task_count'] * 100) : 0;
        ?>
        <a href="<?= APP_URL ?>/projects/<?= $proj['id'] ?>" class="project-card">
            <div class="card-accent" style="background:<?= e($proj['color']) ?>"></div>
            <div class="card-content">
                <h3><?= e($proj['name']) ?></h3>
                <p><?= e(mb_substr($proj['description'] ?? t('project.no_description'), 0, 80)) ?></p>
                <div class="progress-bar"><div class="progress-fill" style="width:<?= $pct ?>%;background:<?= e($proj['color']) ?>"></div></div>
                <div class="card-footer"><span><?= $pct . e(t('dashboard.complete_percent')) ?></span><span><?= $proj['task_count'] ?> <?= e(t('common.tasks_count')) ?></span></div>
            </div>
        </a>
        <?php endforeach; ?>
    </div>
<?php endif; ?>

<?php
$content = ob_get_clean();
$headerActions = '<a href="' . APP_URL . '/projects/create" class="btn btn-primary btn-sm">' . e(t('dashboard.create_project')) . '</a>';
require __DIR__ . '/../layouts/main.php';
