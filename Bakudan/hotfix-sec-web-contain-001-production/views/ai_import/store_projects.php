<?php
$pageTitle = e(t('ai_import.page_title'));
$currentPage = $currentPage ?? 'projects';
ob_start();
?>

<div class="grid grid-2 mb-4">
    <div class="card">
        <div class="card-body">
            <div class="flex-center gap-2" style="justify-content:flex-start;margin-bottom:10px">
                <span class="store-dot" style="background:<?= e($store['color'] ?: '#DC2626') ?>"></span>
                <h3 style="margin:0"><?= e($store['name']) ?></h3>
            </div>
            <p class="text-muted text-sm" style="margin:0"><?= e(t('ai_import.choose_project_desc')) ?></p>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <h3><?= e(t('ai_import.create_project_title')) ?></h3>
        </div>
        <div class="card-body">
            <form method="POST" action="<?= APP_URL ?>/ai-import/store/<?= $store['id'] ?>/project/create">
                <div class="form-group">
                    <label><?= e(t('project.name_label')) ?></label>
                    <input class="form-control" name="name" required placeholder="<?= e(t('project.name_placeholder')) ?>">
                </div>
                <div class="form-group">
                    <label><?= e(t('project.description')) ?></label>
                    <textarea class="form-control" name="description" rows="3" placeholder="<?= e(t('project.description_placeholder')) ?>"></textarea>
                </div>
                <div class="form-group">
                    <label><?= e(t('project.color')) ?></label>
                    <input class="form-control" name="color" value="<?= e($store['color'] ?: '#DC2626') ?>">
                </div>
                <button class="btn btn-primary" type="submit"><?= e(t('ai_import.create_project_action')) ?></button>
            </form>
        </div>
    </div>
</div>

<?php if (empty($projects)): ?>
    <div class="empty-state">
        <div class="icon">📁</div>
        <h3><?= e(t('project.no_projects')) ?></h3>
        <p><?= e(t('ai_import.no_project_for_store')) ?></p>
    </div>
<?php else: ?>
    <div class="card">
        <div class="card-header">
            <h3><?= e(t('ai_import.project_list_title')) ?></h3>
            <span class="text-muted text-sm"><?= count($projects) ?> <?= e(t('nav.projects')) ?></span>
        </div>
        <div class="card-body">
            <div class="grid grid-3">
                <?php foreach ($projects as $project):
                    $pct = $project['task_count'] > 0 ? round($project['completed_count'] / $project['task_count'] * 100) : 0;
                ?>
                    <a href="<?= APP_URL ?>/projects/<?= $project['id'] ?>/ai-import" class="project-card">
                        <div class="card-accent" style="background:<?= e($project['color'] ?: ($store['color'] ?: '#DC2626')) ?>"></div>
                        <div class="card-content">
                            <h3><?= e($project['name']) ?></h3>
                            <p><?= e(mb_substr($project['description'] ?? t('project.no_description'), 0, 100)) ?></p>
                            <div class="progress-bar"><div class="progress-fill" style="width:<?= $pct ?>%;background:<?= e($project['color'] ?: ($store['color'] ?: '#DC2626')) ?>"></div></div>
                            <div class="card-footer">
                                <span><?= $pct . e(t('dashboard.complete_percent')) ?></span>
                                <span><?= e(t('ai_import.open_project')) ?></span>
                            </div>
                        </div>
                    </a>
                <?php endforeach; ?>
            </div>
        </div>
    </div>
<?php endif; ?>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
