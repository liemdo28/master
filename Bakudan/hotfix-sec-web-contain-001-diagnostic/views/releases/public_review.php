<?php
// Public review page — accessed via shareable token link
// No layout required — standalone page
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Release Review: <?= e($release['name']) ?></title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:system-ui,-apple-system,sans-serif;background:#09090b;color:#f4f4f5;min-height:100vh;padding:40px 20px}
        .pr-container{max-width:800px;margin:0 auto}
        .pr-header{text-align:center;margin-bottom:32px}
        .pr-header h1{font-size:24px;margin-bottom:8px}
        .pr-header .pr-version{font-family:monospace;color:#a78bfa;background:#2d2250;padding:4px 12px;border-radius:4px;font-size:14px;display:inline-block}
        .pr-badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;margin-top:12px}
        .pr-badge--draft{background:#2d2250;color:#a78bfa}
        .pr-badge--ready_for_review{background:#422006;color:#fbbf24}
        .pr-badge--qa_running{background:#1e3a5f;color:#60a5fa}
        .pr-badge--qa_passed{background:#064e3b;color:#34d399}
        .pr-badge--approved{background:#064e3b;color:#10b981}
        .pr-badge--scheduled{background:#1e3a5f;color:#93c5fd}
        .pr-badge--published{background:#052e16;color:#4ade80}
        .pr-badge--changes_requested{background:#451a03;color:#fb923c}
        .pr-card{background:#18181b;border:1px solid #27272a;border-radius:10px;padding:24px;margin-bottom:20px}
        .pr-card h3{font-size:14px;color:#a1a1aa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:14px}
        .pr-meta{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .pr-meta dt{font-size:12px;color:#71717a}
        .pr-meta dd{font-size:14px;color:#f4f4f5;margin:0 0 12px}
        .pr-notes{white-space:pre-wrap;font-size:14px;color:#d4d4d8;line-height:1.6}
        .pr-scores{display:flex;gap:24px;justify-content:center}
        .pr-score{text-align:center}
        .pr-score__num{font-size:32px;font-weight:700}
        .pr-score__label{font-size:12px;color:#71717a;margin-top:4px}
        .pr-wt{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .pr-wt-item{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#09090b;border-radius:6px;font-size:13px}
        .pr-wt-status{padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase}
        .pr-wt-status--pass{background:#052e16;color:#4ade80}
        .pr-wt-status--fail{background:#450a0a;color:#fca5a5}
        .pr-wt-status--pending{background:#27272a;color:#71717a}
        .pr-review{padding:12px;background:#09090b;border-radius:8px;margin-bottom:10px;border-left:3px solid #27272a}
        .pr-review--approval{border-left-color:#10b981}
        .pr-review--changes_requested{border-left-color:#f59e0b}
        .pr-review__header{display:flex;justify-content:space-between;font-size:12px;color:#71717a;margin-bottom:6px}
        .pr-review__body{font-size:14px;color:#d4d4d8}
        .pr-preview-btn{display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff;border-radius:8px;text-decoration:none;font-weight:500;margin-top:12px}
        .pr-preview-btn:hover{background:#2563eb}
        .pr-footer{text-align:center;margin-top:40px;color:#71717a;font-size:12px}
        .pr-mode-badge{display:inline-block;padding:6px 14px;border-radius:6px;font-size:12px;margin-bottom:20px}
        .pr-mode-badge--view{background:#1e3a5f;color:#93c5fd}
        .pr-mode-badge--review{background:#064e3b;color:#34d399}
    </style>
</head>
<body>
<div class="pr-container">
    <div class="pr-header">
        <div class="pr-mode-badge pr-mode-badge--<?= $isViewOnly ? 'view' : 'review' ?>">
            <?= $isViewOnly ? '👁 View Only Mode' : '✍ Review Mode' ?>
        </div>
        <h1><?= e($release['name']) ?></h1>
        <span class="pr-version"><?= e($release['version']) ?></span>
        <div><span class="pr-badge pr-badge--<?= $release['status'] ?>"><?= ucwords(str_replace('_',' ',$release['status'])) ?></span></div>
    </div>

    <!-- Release Info -->
    <div class="pr-card">
        <h3>Release Details</h3>
        <dl class="pr-meta">
            <dt>Branch</dt><dd><?= e($release['branch'] ?? '—') ?></dd>
            <dt>Build Date</dt><dd><?= $release['build_date'] ? date('M j, Y H:i', strtotime($release['build_date'])) : '—' ?></dd>
            <dt>Commit</dt><dd style="font-family:monospace"><?= e($release['commit_hash'] ? substr($release['commit_hash'],0,8) : '—') ?></dd>
            <dt>Status</dt><dd><?= ucwords(str_replace('_',' ',$release['status'])) ?></dd>
        </dl>
        <?php if ($release['preview_url']): ?>
        <a href="<?= e($release['preview_url']) ?>" target="_blank" class="pr-preview-btn">🔗 Open Preview</a>
        <?php endif; ?>
    </div>

    <!-- Release Notes -->
    <?php if ($release['release_notes']): ?>
    <div class="pr-card">
        <h3>Release Notes</h3>
        <div class="pr-notes"><?= e($release['release_notes']) ?></div>
    </div>
    <?php endif; ?>

    <!-- Scores -->
    <div class="pr-card">
        <h3>Quality Scores</h3>
        <div class="pr-scores">
            <div class="pr-score">
                <div class="pr-score__num" style="color:<?= ($release['qa_score'] ?? 0) >= 80 ? '#4ade80' : '#fca5a5' ?>"><?= $release['qa_score'] !== null ? number_format($release['qa_score'],1).'%' : '—' ?></div>
                <div class="pr-score__label">QA Score</div>
            </div>
            <div class="pr-score">
                <div class="pr-score__num" style="color:<?= ($release['confidence_score'] ?? 0) >= 70 ? '#4ade80' : '#fca5a5' ?>"><?= $release['confidence_score'] !== null ? number_format($release['confidence_score'],1).'%' : '—' ?></div>
                <div class="pr-score__label">Confidence</div>
            </div>
        </div>
    </div>

    <!-- Walkthroughs -->
    <div class="pr-card">
        <h3>Walkthrough Status</h3>
        <div class="pr-wt">
            <?php foreach (['ceo'=>'CEO','manager'=>'Manager','member'=>'Member','admin'=>'Admin'] as $role=>$label): ?>
            <div class="pr-wt-item">
                <span><?= $label ?></span>
                <span class="pr-wt-status pr-wt-status--<?= $release['walkthrough_'.$role] ?>"><?= strtoupper($release['walkthrough_'.$role]) ?></span>
            </div>
            <?php endforeach; ?>
        </div>
    </div>

    <!-- Reviews -->
    <?php if (!empty($reviews)): ?>
    <div class="pr-card">
        <h3>Reviews</h3>
        <?php foreach ($reviews as $rev): ?>
        <div class="pr-review pr-review--<?= $rev['type'] ?>">
            <div class="pr-review__header">
                <span><strong style="color:#f4f4f5"><?= e($rev['user_name'] ?? 'Unknown') ?></strong> · <?= ucwords(str_replace('_',' ',$rev['type'])) ?></span>
                <span><?= date('M j, g:i A', strtotime($rev['created_at'])) ?></span>
            </div>
            <?php if ($rev['body']): ?>
            <div class="pr-review__body"><?= nl2br(e($rev['body'])) ?></div>
            <?php endif; ?>
        </div>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>

    <div class="pr-footer">
        <p>TaskFlow Release Management · <?= date('Y') ?></p>
    </div>
</div>
</body>
</html>
