<?php
$pageTitle = e(t('ai_import.bill_mode_title'));
$currentPage = $currentPage ?? 'bills';
ob_start();
$bill = $preview['bill'] ?? [];
$configDebug = $configDebug ?? openai_config_debug();
?>

<div class="card mb-4">
    <div class="card-body ai-import-hero">
        <div>
            <div class="flex-center gap-2" style="justify-content:flex-start;margin-bottom:8px">
                <span class="store-dot" style="background:<?= e($store['color'] ?: '#0ea5e9') ?>"></span>
                <h3 style="margin:0"><?= e($store['name']) ?></h3>
            </div>
            <div class="text-muted text-sm mb-2"><?= e(t('ai_import.bill_mode_desc')) ?></div>
            <div class="ai-import-pills">
                <span class="tag">PDF</span>
                <span class="tag">JPG</span>
                <span class="tag">PNG</span>
                <span class="tag">WEBP</span>
            </div>
        </div>
        <div class="ai-import-config <?= $isConfigured ? 'ok' : 'warn' ?>">
            <?= $isConfigured ? e(t('ai_import.configured')) : e(t('ai_import.not_configured')) ?>
        </div>
    </div>
</div>

<div class="card mb-4">
    <div class="card-body">
        <?php if (!$isConfigured): ?>
            <div class="alert alert-error">
                <strong>OpenAI API key is missing.</strong><br>
                Add your key to <code>config/ai.local.php</code> at the <code>api_key</code> line, then reload the page.<br>
                <span class="text-sm"><?= e(t('ai_import.missing_key_help')) ?></span>
                <div class="ai-debug-box">
                    <div><strong>Debug</strong></div>
                    <div>Path: <code><?= e($configDebug['config_path'] ?? '') ?></code></div>
                    <?php if (!empty($configDebug['active_source_path'])): ?>
                        <div>Active source: <code><?= e($configDebug['active_source_path']) ?></code></div>
                    <?php endif; ?>
                    <?php if (!empty($configDebug['external_paths'])): ?>
                        <div>Fallback paths:</div>
                        <?php foreach (($configDebug['external_paths'] ?? []) as $externalPath): ?>
                            <div><code><?= e($externalPath) ?></code></div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                    <div>Exists: <strong><?= !empty($configDebug['config_exists']) ? 'yes' : 'no' ?></strong></div>
                    <div>Readable: <strong><?= !empty($configDebug['config_readable']) ? 'yes' : 'no' ?></strong></div>
                    <div>Local key detected: <strong><?= !empty($configDebug['local_key_detected']) ? 'yes' : 'no' ?></strong></div>
                    <div>Effective key detected: <strong><?= !empty($configDebug['effective_key_detected']) ? 'yes' : 'no' ?></strong></div>
                    <div>Key length: <strong><?= e((string) ($configDebug['effective_key_length'] ?? 0)) ?></strong></div>
                    <div>Model: <strong><?= e((string) ($configDebug['effective_model'] ?? '')) ?></strong></div>
                </div>
            </div>
        <?php endif; ?>

        <form method="POST" action="<?= APP_URL ?>/ai-import/bills/<?= $store['id'] ?>/analyze" enctype="multipart/form-data">
            <div class="form-group">
                <label><?= e(t('ai_import.file_label')) ?></label>
                <input type="file" name="document" class="form-control" accept=".pdf,image/*" required>
                <div class="text-muted text-sm mt-2"><?= e(t('ai_import.file_help')) ?></div>
            </div>
            <div class="flex gap-2 mt-4">
                <button type="submit" class="btn btn-primary" <?= !$isConfigured ? 'disabled title="Add API key first"' : '' ?>><?= e(t('ai_import.scan_btn')) ?></button>
                <a href="<?= APP_URL ?>/bills/store/<?= $store['id'] ?>" class="btn btn-secondary"><?= e(t('common.cancel')) ?></a>
            </div>
        </form>
    </div>
</div>

<?php if (!empty($preview)): ?>
    <div class="card">
        <div class="card-header ai-import-header">
            <div>
                <h3><?= e(t('ai_import.bill_preview_title')) ?></h3>
                <div class="text-muted text-sm">
                    <?= e($preview['file']['original_name'] ?? '') ?>
                    <?php if (!empty($preview['analyzed_at'])): ?>
                        • <?= e($preview['analyzed_at']) ?>
                    <?php endif; ?>
                </div>
            </div>
            <form method="POST" action="<?= APP_URL ?>/ai-import/bills/<?= $store['id'] ?>/discard">
                <button type="submit" class="btn btn-outline btn-sm"><?= e(t('ai_import.discard_btn')) ?></button>
            </form>
        </div>
        <div class="card-body">
            <?php if (!empty($preview['summary'])): ?>
                <div class="ai-import-summary"><?= nl2br(e($preview['summary'])) ?></div>
            <?php endif; ?>

            <?php if (!empty($preview['warnings'])): ?>
                <div class="alert alert-error">
                    <strong><?= e(t('ai_import.warnings')) ?></strong>
                    <ul class="ai-import-warning-list">
                        <?php foreach ($preview['warnings'] as $warning): ?>
                            <li><?= e($warning) ?></li>
                        <?php endforeach; ?>
                    </ul>
                </div>
            <?php endif; ?>

            <form method="POST" action="<?= APP_URL ?>/ai-import/bills/<?= $store['id'] ?>/save">
                <div class="alert alert-success"><?= e(t('ai_import.bill_edit_tip')) ?></div>

                <div class="grid grid-2">
                    <div class="form-group">
                        <label><?= e(t('bills.bill_name')) ?></label>
                        <input type="text" name="bill[title]" class="form-control" required value="<?= e($bill['title'] ?? '') ?>">
                    </div>
                    <div class="form-group">
                        <label><?= e(t('bills.vendor')) ?></label>
                        <input type="text" name="bill[vendor_name]" class="form-control" value="<?= e($bill['vendor_name'] ?? '') ?>">
                    </div>
                </div>

                <div class="grid grid-3">
                    <div class="form-group">
                        <label><?= e(t('bills.amount')) ?></label>
                        <input type="number" step="0.01" name="bill[amount]" class="form-control" value="<?= e($bill['amount'] ?? '') ?>">
                    </div>
                    <div class="form-group">
                        <label><?= e(t('bills.due_date')) ?></label>
                        <input type="date" name="bill[due_date]" class="form-control" required value="<?= e($bill['due_date'] ?? '') ?>">
                    </div>
                    <div class="form-group">
                        <label><?= e(t('bills.status')) ?></label>
                        <select name="bill[status]" class="form-control">
                            <?php foreach ([
                                'pending' => t('bills.status_pending'),
                                'paid' => t('bills.status_paid'),
                                'overdue' => t('bills.status_overdue'),
                            ] as $statusKey => $statusLabel): ?>
                                <option value="<?= e($statusKey) ?>" <?= ($bill['status'] ?? 'pending') === $statusKey ? 'selected' : '' ?>><?= e($statusLabel) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                </div>

                <div class="grid grid-2">
                    <div class="form-group">
                        <label><?= e(t('common.color')) ?></label>
                        <input type="text" name="bill[color]" class="form-control" value="<?= e($bill['color'] ?? ($store['color'] ?? '')) ?>" placeholder="#DC2626">
                    </div>
                    <div class="form-group">
                        <label><?= e(t('ai_import.confidence')) ?></label>
                        <input type="text" class="form-control" value="<?= isset($bill['confidence']) && $bill['confidence'] !== null ? e((string) round($bill['confidence'] * 100)) . '%' : '-' ?>" disabled>
                    </div>
                </div>

                <div class="form-group">
                    <label><?= e(t('bills.note')) ?></label>
                    <textarea name="bill[note]" class="form-control" rows="4"><?= e($bill['note'] ?? '') ?></textarea>
                </div>

                <div class="form-group">
                    <label><?= e(t('ai_import.source_excerpt_label')) ?></label>
                    <textarea name="bill[source_excerpt]" class="form-control" rows="3"><?= e($bill['source_excerpt'] ?? '') ?></textarea>
                </div>

                <div class="flex gap-2 mt-4">
                    <button type="submit" class="btn btn-primary"><?= e(t('ai_import.bill_save_btn')) ?></button>
                    <a href="<?= APP_URL ?>/bills/store/<?= $store['id'] ?>" class="btn btn-secondary"><?= e(t('common.cancel')) ?></a>
                </div>
            </form>
        </div>
    </div>
<?php endif; ?>

<style>
.ai-import-hero{display:flex;align-items:center;justify-content:space-between;gap:16px}
.ai-import-pills{display:flex;gap:8px;flex-wrap:wrap}
.ai-import-config{padding:10px 14px;border-radius:999px;font-size:12px;font-weight:700;border:1px solid var(--border)}
.ai-import-config.ok{background:rgba(34,197,94,.12);color:var(--green);border-color:rgba(34,197,94,.25)}
.ai-import-config.warn{background:rgba(245,158,11,.12);color:#f59e0b;border-color:rgba(245,158,11,.25)}
.ai-import-header{display:flex;align-items:center;justify-content:space-between;gap:12px}
.ai-import-summary{padding:14px 16px;border:1px solid var(--border);border-radius:12px;background:var(--bg-secondary);margin-bottom:16px;line-height:1.6}
.ai-import-warning-list{margin:8px 0 0 18px}
.ai-debug-box{
    margin-top:12px;
    padding-top:12px;
    border-top:1px dashed rgba(255,255,255,.12);
    font-size:12px;
    line-height:1.7;
    color:#fca5a5;
}
.ai-debug-box code{
    color:#fde68a;
    word-break:break-all;
}
@media(max-width:900px){
    .ai-import-hero,.ai-import-header{flex-direction:column;align-items:flex-start}
}
</style>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
