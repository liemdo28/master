<?php
$pageTitle = e(t('ai_import.page_title'));
$currentPage = $currentPage ?? 'projects';
ob_start();
?>

<div class="card mb-4">
    <div class="card-body">
        <h3 style="margin:0 0 8px 0"><?= e(t('ai_import.mode_title')) ?></h3>
        <p class="text-muted text-sm" style="margin:0"><?= e(t('ai_import.mode_desc')) ?></p>
    </div>
</div>

<div class="grid grid-2">
    <a href="<?= APP_URL ?>/ai-import/store" class="project-card">
        <div class="card-accent" style="background:#DC2626"></div>
        <div class="card-content">
            <h3><?= e(t('ai_import.store_mode_title')) ?></h3>
            <p><?= e(t('ai_import.store_mode_desc')) ?></p>
            <div class="card-footer">
                <span><?= e(t('nav.stores')) ?></span>
                <span><?= e(t('ai_import.open_mode')) ?></span>
            </div>
        </div>
    </a>

    <a href="<?= APP_URL ?>/ai-import/bills" class="project-card">
        <div class="card-accent" style="background:#0ea5e9"></div>
        <div class="card-content">
            <h3><?= e(t('ai_import.bill_mode_title')) ?></h3>
            <p><?= e(t('ai_import.bill_mode_desc')) ?></p>
            <div class="card-footer">
                <span><?= e(t('nav.bills')) ?></span>
                <span><?= e(t('ai_import.open_mode')) ?></span>
            </div>
        </div>
    </a>
</div>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
