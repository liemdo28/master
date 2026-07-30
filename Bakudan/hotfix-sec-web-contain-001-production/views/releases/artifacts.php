<?php
/**
 * Phase 11.5 — Module 9: Release Artifacts View
 */
$artifactTypes = [
    'video' => ['label' => 'Walkthrough Video', 'icon' => '🎬', 'color' => '#a78bfa'],
    'qa_report' => ['label' => 'QA Report', 'icon' => '📊', 'color' => '#60a5fa'],
    'screenshot' => ['label' => 'Screenshot', 'icon' => '📸', 'color' => '#34d399'],
    'release_notes' => ['label' => 'Release Notes', 'icon' => '📝', 'color' => '#fbbf24'],
    'rollback_plan' => ['label' => 'Rollback Plan', 'icon' => '🔄', 'color' => '#f87171'],
];

$groupedArtifacts = [];
foreach ($artifacts as $a) {
    $groupedArtifacts[$a['type']][] = $a;
}
?>

<div class="artifacts-page">
    <!-- Back link -->
    <div style="margin-bottom:20px">
        <a href="<?= APP_URL ?>/admin/releases/<?= $release['id'] ?>" style="font-size:13px;color:var(--blue);text-decoration:none">← Back to Release</a>
    </div>

    <!-- Upload Form -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:32px">
        <h3 style="font-size:15px;font-weight:600;margin:0 0 16px">Add Artifact</h3>
        <form method="POST" action="<?= APP_URL ?>/admin/releases/<?= $release['id'] ?>/artifacts" enctype="multipart/form-data">
            <input type="hidden" name="csrf_token" value="<?= csrf_token() ?>">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
                <div>
                    <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Title *</label>
                    <input type="text" name="title" class="form-control" required placeholder="e.g. CEO Walkthrough Recording">
                </div>
                <div>
                    <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Type</label>
                    <select name="type" class="form-control">
                        <?php foreach ($artifactTypes as $key => $at): ?>
                        <option value="<?= $key ?>"><?= $at['icon'] ?> <?= $at['label'] ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
                <div>
                    <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">File (optional)</label>
                    <input type="file" name="file" class="form-control" accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.mp4,.webm,.mov,.md,.txt,.doc,.docx">
                </div>
                <div>
                    <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">URL (optional)</label>
                    <input type="url" name="url" class="form-control" placeholder="https://...">
                </div>
            </div>
            <div style="margin-bottom:12px">
                <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Description</label>
                <textarea name="description" class="form-control" rows="2" placeholder="Brief description..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Upload Artifact</button>
        </form>
    </div>

    <!-- Artifacts List -->
    <?php if (!empty($artifacts)): ?>
    <?php foreach ($artifactTypes as $typeKey => $typeConfig): ?>
        <?php if (!empty($groupedArtifacts[$typeKey])): ?>
        <div style="margin-bottom:24px">
            <h4 style="font-size:14px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px">
                <span><?= $typeConfig['icon'] ?></span>
                <span><?= $typeConfig['label'] ?></span>
                <span style="font-size:11px;color:var(--text-muted);font-weight:400">(<?= count($groupedArtifacts[$typeKey]) ?>)</span>
            </h4>
            <div style="display:flex;flex-direction:column;gap:8px">
                <?php foreach ($groupedArtifacts[$typeKey] as $artifact): ?>
                <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;border-left:3px solid <?= $typeConfig['color'] ?>">
                    <div style="flex:1">
                        <div style="font-weight:500;font-size:14px"><?= e($artifact['title']) ?></div>
                        <?php if ($artifact['description']): ?>
                        <div style="font-size:12px;color:var(--text-muted);margin-top:2px"><?= e($artifact['description']) ?></div>
                        <?php endif; ?>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
                            Uploaded by <?= e($artifact['uploader_name'] ?? 'Unknown') ?> · <?= date('M j, g:i A', strtotime($artifact['created_at'])) ?>
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center">
                        <?php if ($artifact['url']): ?>
                        <a href="<?= e($artifact['url']) ?>" target="_blank" class="btn btn-sm btn-secondary">Open Link</a>
                        <?php endif; ?>
                        <?php if ($artifact['file_path']): ?>
                        <a href="<?= APP_URL . e($artifact['file_path']) ?>" target="_blank" class="btn btn-sm btn-secondary">Download</a>
                        <?php endif; ?>
                        <form method="POST" action="<?= APP_URL ?>/admin/releases/artifacts/<?= $artifact['id'] ?>/delete" style="margin:0">
                            <input type="hidden" name="csrf_token" value="<?= csrf_token() ?>">
                            <button type="submit" class="btn btn-sm btn-ghost" style="color:#f87171" onclick="return confirm('Remove this artifact?')">✕</button>
                        </form>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
        <?php endif; ?>
    <?php endforeach; ?>

    <?php else: ?>
    <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <div style="font-size:48px;margin-bottom:16px">📦</div>
        <div style="font-size:16px;font-weight:500;margin-bottom:8px">No artifacts yet</div>
        <div style="font-size:13px">Upload walkthrough videos, QA reports, screenshots, and rollback plans above.</div>
    </div>
    <?php endif; ?>
</div>
