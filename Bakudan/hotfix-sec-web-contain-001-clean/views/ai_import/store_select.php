<?php
$pageTitle = e(t('ai_import.page_title'));
$currentPage = $currentPage ?? 'projects';
$defaultColor = '#DC2626';
ob_start();
?>

<div class="grid grid-2 ai-store-select-grid">
    <div class="card">
        <div class="card-header">
            <div>
                <h3 style="margin:0 0 6px 0"><?= e($selectionTitle) ?></h3>
                <div class="text-muted text-sm"><?= e($selectionDesc) ?></div>
            </div>
            <span class="text-muted text-sm"><?= count($stores) ?> <?= e(t('bills.stores')) ?></span>
        </div>
        <div class="card-body">
            <?php if (empty($stores)): ?>
                <div class="empty-state" style="padding:28px 10px">
                    <div class="icon">🏪</div>
                    <h3><?= e(t('store.empty')) ?></h3>
                    <p><?= e(t('ai_import.no_store_desc')) ?></p>
                </div>
            <?php else: ?>
                <div class="store-list ai-store-list">
                    <?php foreach ($stores as $store): ?>
                        <a href="<?= e($selectBase . $store['id']) ?>" class="store-card store-card-clickable ai-store-card" style="text-decoration:none;color:inherit">
                            <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">
                                <span class="store-dot" style="background:<?= e($store['color'] ?: $defaultColor) ?>"></span>
                                <div class="store-main" style="min-width:0">
                                    <div class="store-name"><?= e($store['name']) ?></div>
                                    <?php if (!empty($store['address'])): ?>
                                        <div class="text-muted text-sm"><?= e($store['address']) ?></div>
                                    <?php endif; ?>
                                </div>
                            </div>
                            <div class="store-arrow">→</div>
                        </a>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>
    </div>

    <div class="card">
        <div class="card-header">
            <h3><?= e(t('ai_import.create_store_title')) ?></h3>
        </div>
        <div class="card-body">
            <form method="POST" action="<?= e($createAction) ?>">
                <div class="form-group">
                    <label><?= e(t('store.name_label')) ?></label>
                    <input class="form-control" name="name" required placeholder="<?= e(t('store.name_placeholder')) ?>">
                </div>
                <div class="form-group">
                    <label><?= e(t('store.address_label')) ?></label>
                    <input class="form-control" name="address" placeholder="...">
                </div>
                <div class="form-group">
                    <label><?= e(t('store.color_label')) ?></label>
                    <div class="ai-color-picker-row">
                        <input type="color" name="color" value="<?= e($defaultColor) ?>" class="ai-color-picker">
                        <span class="text-muted text-sm"><?= e(t('ai_import.color_picker_hint')) ?></span>
                    </div>
                </div>
                <button class="btn btn-primary" type="submit"><?= e(t('ai_import.create_store_action')) ?></button>
            </form>
        </div>
    </div>
</div>

<style>
.ai-store-select-grid{align-items:start}
.ai-store-list{display:flex;flex-direction:column;gap:10px;max-height:420px;overflow:auto;padding-right:4px}
.ai-store-card{padding:14px 16px;border-radius:14px}
.ai-store-card .store-name{font-size:14px}
.ai-store-card .text-sm{font-size:12px}
.ai-color-picker-row{display:flex;align-items:center;gap:12px}
.ai-color-picker{
    width:56px;
    height:42px;
    border:none;
    padding:0;
    background:transparent;
    cursor:pointer;
}
.ai-color-picker::-webkit-color-swatch-wrapper{padding:0}
.ai-color-picker::-webkit-color-swatch{
    border:none;
    border-radius:12px;
    box-shadow:inset 0 0 0 1px var(--border);
}
@media(max-width:900px){
    .ai-store-list{max-height:none}
}
</style>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
