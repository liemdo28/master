<?php
$pageTitle = e(t('ai_import.page_title'));
$currentPage = 'projects';
ob_start();
$taskCount = count($preview['tasks'] ?? []);
$configDebug = $configDebug ?? openai_config_debug();
?>

<div class="card mb-4">
    <div class="card-header">
        <h3><?= e(t('ai_import.hero_title')) ?></h3>
    </div>
    <div class="card-body ai-import-hero">
        <div>
            <div class="text-muted text-sm mb-2"><?= e(t('ai_import.project_step_desc', ['project' => $project['name'] ?? ''])) ?></div>
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

<div class="alert alert-success">
    <?= e(t('ai_import.project_step_hint')) ?>
</div>

<div class="card mb-4">
    <div class="card-body">
        <?php if (!$isConfigured): ?>
        <div class="alert alert-error">
            <strong>OpenAI API key is missing.</strong><br>
            Thêm key vào file <code>config/ai.local.php</code> tại dòng <code>api_key</code>, rồi tải lại trang.<br>
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
        <form method="POST" action="<?= APP_URL ?>/projects/<?= $project['id'] ?>/ai-import/analyze" enctype="multipart/form-data">
            <div class="form-group">
                <label><?= e(t('ai_import.file_label')) ?></label>
                <input type="file" name="document" class="form-control" accept=".pdf,image/*" required>
                <div class="text-muted text-sm mt-2"><?= e(t('ai_import.file_help')) ?></div>
            </div>
            <div class="flex gap-2 mt-4">
                <button type="submit" class="btn btn-primary" <?= !$isConfigured ? 'disabled title="Add API key first"' : '' ?>><?= e(t('ai_import.scan_btn')) ?></button>
                <a href="<?= APP_URL ?>/projects/<?= $project['id'] ?>" class="btn btn-secondary"><?= e(t('common.cancel')) ?></a>
            </div>
        </form>
    </div>
</div>

<?php if (!empty($preview)): ?>
<div class="card mb-4">
    <div class="card-header ai-import-header">
        <div>
            <h3><?= e(t('ai_import.preview_title')) ?></h3>
            <div class="text-muted text-sm">
                <?= e($preview['file']['original_name'] ?? '') ?>
                <?php if (!empty($preview['analyzed_at'])): ?>
                    • <?= e($preview['analyzed_at']) ?>
                <?php endif; ?>
            </div>
        </div>
        <div class="flex gap-2">
            <form method="POST" action="<?= APP_URL ?>/projects/<?= $project['id'] ?>/ai-import/discard">
                <button type="submit" class="btn btn-outline btn-sm"><?= e(t('ai_import.discard_btn')) ?></button>
            </form>
        </div>
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

        <?php if ($taskCount === 0): ?>
            <div class="empty-state">
                <div class="icon">AI</div>
                <h3><?= e(t('ai_import.no_tasks')) ?></h3>
                <p><?= e(t('ai_import.no_tasks_desc')) ?></p>
            </div>
        <?php else: ?>
            <div class="alert alert-success"><?= e(t('ai_import.edit_tip')) ?></div>
            <form method="POST" action="<?= APP_URL ?>/projects/<?= $project['id'] ?>/ai-import/create">
            <div class="ai-import-grid">
                <?php foreach ($preview['tasks'] as $index => $task): ?>
                <div class="ai-import-card">
                    <div class="ai-import-card-top">
                        <label class="ai-import-check">
                            <input type="checkbox" name="tasks[<?= $index ?>][include]" value="1" checked>
                            <span><?= e(t('ai_import.include_label')) ?></span>
                        </label>
                        <span class="tag priority-<?= e($task['priority']) ?>"><?= e($task['priority']) ?></span>
                    </div>

                    <div class="form-group">
                        <label><?= e(t('task.title_label')) ?></label>
                        <input type="text" name="tasks[<?= $index ?>][title]" class="form-control" value="<?= e($task['title']) ?>">
                    </div>

                    <div class="form-group">
                        <label><?= e(t('task.description_label')) ?></label>
                        <textarea name="tasks[<?= $index ?>][description]" class="form-control" rows="4"><?= e($task['description']) ?></textarea>
                    </div>

                    <div class="grid grid-2">
                        <div class="form-group">
                            <label><?= e(t('task.section')) ?></label>
                            <select name="tasks[<?= $index ?>][section_id]" class="form-control">
                                <option value=""><?= e(t('ai_import.no_section')) ?></option>
                                <?php foreach ($sections as $section): ?>
                                <option value="<?= $section['id'] ?>" <?= (int) ($task['section_id'] ?? 0) === (int) $section['id'] ? 'selected' : '' ?>><?= e($section['name']) ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="form-group">
                            <label><?= e(t('task.assignee_label')) ?></label>
                            <select name="tasks[<?= $index ?>][assignee_id]" class="form-control">
                                <option value=""><?= e(t('task.unassigned')) ?></option>
                                <?php foreach ($members as $member): ?>
                                <option value="<?= $member['id'] ?>" <?= (int) ($task['assignee_id'] ?? 0) === (int) $member['id'] ? 'selected' : '' ?>><?= e($member['name']) ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-2">
                        <div class="form-group">
                            <label><?= e(t('task.priority_label')) ?></label>
                            <select name="tasks[<?= $index ?>][priority]" class="form-control">
                                <?php foreach (['low'=>t('task.priority_low'),'medium'=>t('task.priority_medium'),'high'=>t('task.priority_high'),'urgent'=>t('task.priority_urgent')] as $priorityKey => $priorityLabel): ?>
                                <option value="<?= $priorityKey ?>" <?= $task['priority'] === $priorityKey ? 'selected' : '' ?>><?= e($priorityLabel) ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="form-group">
                            <label><?= e(t('task.status_label')) ?></label>
                            <select name="tasks[<?= $index ?>][status]" class="form-control">
                                <?php foreach (['todo'=>t('task.status_todo'),'in_progress'=>t('task.status_in_progress'),'review'=>t('task.status_review'),'done'=>t('task.status_done')] as $statusKey => $statusLabel): ?>
                                <option value="<?= $statusKey ?>" <?= $task['status'] === $statusKey ? 'selected' : '' ?>><?= e($statusLabel) ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-2">
                        <div class="form-group">
                            <label><?= e(t('task.start_date')) ?></label>
                            <input type="date" name="tasks[<?= $index ?>][start_date]" class="form-control" value="<?= e($task['start_date'] ?? '') ?>">
                        </div>
                        <div class="form-group">
                            <label><?= e(t('task.deadline')) ?></label>
                            <input type="date" name="tasks[<?= $index ?>][due_date]" class="form-control" value="<?= e($task['due_date'] ?? '') ?>">
                        </div>
                    </div>

                    <div class="ai-import-meta">
                        <?php if ($task['confidence'] !== null): ?>
                        <span><?= e(t('ai_import.confidence')) ?>: <?= e((string) round($task['confidence'] * 100)) ?>%</span>
                        <?php endif; ?>
                    </div>

                    <div class="form-group">
                        <label><?= e(t('ai_import.source_excerpt_label')) ?></label>
                        <textarea name="tasks[<?= $index ?>][source_excerpt]" class="form-control" rows="3"><?= e($task['source_excerpt']) ?></textarea>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
            <div class="flex gap-2 mt-4">
                <button type="submit" class="btn btn-primary"><?= e(t('ai_import.create_btn', ['count' => $taskCount])) ?></button>
                <a href="<?= APP_URL ?>/projects/<?= $project['id'] ?>" class="btn btn-secondary"><?= e(t('common.cancel')) ?></a>
            </div>
            </form>
        <?php endif; ?>
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
.ai-import-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.ai-import-card{border:1px solid var(--border);border-radius:14px;padding:16px;background:var(--bg-secondary)}
.ai-import-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.ai-import-check{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--text);cursor:pointer}
.ai-import-check input{width:16px;height:16px}
.ai-import-title{font-size:15px;font-weight:700;color:var(--text);margin-bottom:4px}
.ai-import-desc{font-size:13px;line-height:1.6;color:var(--text-secondary);margin:0 0 14px}
.ai-import-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--text-muted);margin-bottom:12px}
.ai-import-excerpt{font-size:12px;line-height:1.6;color:var(--text-secondary);padding-top:12px;border-top:1px dashed var(--border)}
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
    .ai-import-grid{grid-template-columns:1fr}
}
</style>

<?php $content = ob_get_clean(); require __DIR__ . '/../layouts/main.php'; ?>
