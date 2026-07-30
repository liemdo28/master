<?php
// Main content area for release detail (left column)
$releaseModel = new Release();
$user = currentUser();

// Build structured notes fields
$structuredNotes = [
    'summary' => ['label' => 'Summary', 'value' => $release['summary'] ?? null],
    'release_notes' => ['label' => 'What Changed', 'value' => $release['release_notes'] ?? null],
    'change_log' => ['label' => 'Changelog / New Features', 'value' => $release['change_log'] ?? null],
    'bug_fixes' => ['label' => 'Bug Fixes', 'value' => $release['bug_fixes'] ?? null],
    'known_issues' => ['label' => 'Known Issues', 'value' => $release['known_issues'] ?? null],
    'risk_notes' => ['label' => 'Risk Notes', 'value' => $release['risk_notes'] ?? null],
    'rollback_notes' => ['label' => 'Rollback Plan', 'value' => $release['rollback_notes'] ?? null],
];

$hasStructuredNotes = false;
foreach ($structuredNotes as $n) { if (!empty($n['value'])) { $hasStructuredNotes = true; break; } }
?>

<!-- Release Info -->
<div class="rd-card">
    <h3>Release Details</h3>
    <dl class="rd-meta">
        <dt>Version</dt>
        <dd><span style="font-family:monospace;font-size:13px;color:#a78bfa;background:#2d2250;padding:2px 8px;border-radius:4px"><?= e($release['version']) ?></span></dd>
        <dt>Branch</dt>
        <dd><?= e($release['branch'] ?? '—') ?></dd>
        <dt>Commit</dt>
        <dd style="font-family:monospace;font-size:12px"><?= e($release['commit_hash'] ? substr($release['commit_hash'], 0, 8) : '—') ?></dd>
        <dt>Build Date</dt>
        <dd><?= $release['build_date'] ? date('M j, Y H:i', strtotime($release['build_date'])) : '—' ?></dd>
        <dt>Owner</dt>
        <dd><?= e($release['owner_id'] ? ((new User())->findById($release['owner_id'])['name'] ?? 'Unknown') : '—') ?></dd>
        <dt>Preview URL</dt>
        <dd><?php if ($release['preview_url']): ?><a href="<?= e($release['preview_url']) ?>" target="_blank" style="color:#60a5fa"><?= e($release['preview_url']) ?></a><?php else: ?>—<?php endif; ?></dd>
        <?php if ($release['published_at']): ?>
        <dt>Published At</dt>
        <dd><?= date('M j, Y g:i A', strtotime($release['published_at'])) ?> <?= e($release['scheduled_timezone'] ?? 'UTC') ?></dd>
        <?php endif; ?>
        <?php if ($release['scheduled_at']): ?>
        <dt>Scheduled</dt>
        <dd style="color:#93c5fd"><?= date('M j, Y g:i A', strtotime($release['scheduled_at'])) ?> <?= e($release['scheduled_timezone'] ?? 'UTC') ?></dd>
        <?php endif; ?>
        <?php if (!empty($release['rollback_contact'])): ?>
        <dt>Rollback Contact</dt>
        <dd><?= e($release['rollback_contact']) ?></dd>
        <?php endif; ?>
    </dl>

    <?php if ($release['scheduled_at']): ?>
    <div style="margin-top:12px;padding:10px;background:#1e3a5f;border-radius:6px;font-size:13px;color:#93c5fd">
        &#128197; Scheduled: <?= date('M j, Y \a\t g:i A', strtotime($release['scheduled_at'])) ?> (<?= e($release['scheduled_timezone'] ?? 'UTC') ?>)
    </div>
    <?php endif; ?>
</div>

<!-- Structured Version Notes -->
<?php if ($hasStructuredNotes): ?>
<div class="rd-card">
    <h3>Version Notes</h3>
    <div class="rd-notes-section">
        <?php foreach ($structuredNotes as $key => $note): ?>
        <?php if (!empty($note['value'])): ?>
        <div class="rd-note-item">
            <div class="rd-note-item__label"><?= e($note['label']) ?></div>
            <div class="rd-note-item__body"><?= nl2br(e($note['value'])) ?></div>
        </div>
        <?php endif; ?>
        <?php endforeach; ?>
    </div>
</div>
<?php elseif (!empty($release['release_notes'])): ?>
<!-- Fallback: simple release notes if no structured notes -->
<div class="rd-card">
    <h3>Release Notes</h3>
    <div class="rd-notes"><?= e($release['release_notes']) ?></div>
</div>
<?php endif; ?>

<!-- Walkthroughs -->
<div class="rd-card">
    <h3>Walkthrough Status</h3>
    <div class="rd-wt">
        <?php foreach (['ceo'=>'CEO','manager'=>'Manager','member'=>'Member','admin'=>'Admin'] as $role=>$label): ?>
        <div class="rd-wt-item">
            <span style="color:#d4d4d8"><?= $label ?></span>
            <span class="rd-wt-status rd-wt-status--<?= $release['walkthrough_'.$role] ?>"><?= strtoupper($release['walkthrough_'.$role]) ?></span>
        </div>
        <?php endforeach; ?>
    </div>
    <?php if (canManage()): ?>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <?php foreach (['ceo','manager','member','admin'] as $role): ?>
        <?php if ($release['walkthrough_'.$role] !== 'pass'): ?>
        <button class="rd-btn rd-btn--ghost" onclick="updateWalkthrough(<?= $release['id'] ?>,'<?= $role ?>','pass')">&#10003; <?= ucfirst($role) ?></button>
        <?php endif; ?>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>
</div>

<!-- Scores -->
<div class="rd-card">
    <h3>Quality Scores</h3>
    <div style="display:flex;gap:20px">
        <div style="flex:1;text-align:center">
            <div style="font-size:28px;font-weight:700;color:<?= ($release['qa_score'] ?? 0) >= 80 ? '#4ade80' : '#fca5a5' ?>"><?= $release['qa_score'] !== null ? number_format($release['qa_score'],1).'%' : '—' ?></div>
            <div style="font-size:12px;color:#71717a;margin-top:4px">QA Score</div>
        </div>
        <div style="flex:1;text-align:center">
            <?php
            $confLetter = $releaseModel->computeConfidenceLetter($release['confidence_score']);
            $confColor = match($confLetter) { 'S' => '#f59e0b', 'A' => '#34d399', 'B' => '#60a5fa', 'C' => '#fbbf24', default => '#71717a' };
            ?>
            <div style="font-size:28px;font-weight:700;color:<?= $confColor ?>"><?= $confLetter ?: '—' ?></div>
            <div style="font-size:12px;color:#71717a;margin-top:4px">Confidence <?= $release['confidence_score'] !== null ? number_format($release['confidence_score'],1).'%' : '' ?></div>
        </div>
    </div>
    <?php if (canManage()): ?>
    <div style="margin-top:12px;display:flex;gap:8px">
        <input type="number" id="qaScoreInput" placeholder="QA %" min="0" max="100" step="0.1" value="<?= $release['qa_score'] ?? '' ?>" style="flex:1;background:#09090b;border:1px solid #27272a;color:#f4f4f5;padding:6px 10px;border-radius:6px;font-size:13px">
        <input type="number" id="confScoreInput" placeholder="Confidence %" min="0" max="100" step="0.1" value="<?= $release['confidence_score'] ?? '' ?>" style="flex:1;background:#09090b;border:1px solid #27272a;color:#f4f4f5;padding:6px 10px;border-radius:6px;font-size:13px">
        <button class="rd-btn rd-btn--blue" onclick="updateScores(<?= $release['id'] ?>)">Save</button>
    </div>
    <?php endif; ?>
</div>

<!-- Timeline -->
<div class="rd-card">
    <h3>Release Timeline</h3>
    <?php require __DIR__ . '/_release_timeline.php'; ?>
</div>

<!-- Reviews & Comments -->
<div class="rd-card">
    <h3>Reviews & Feedback</h3>
    <?php if (empty($reviews)): ?>
    <p style="color:#71717a;font-size:14px">No reviews yet.</p>
    <?php else: ?>
    <?php foreach ($reviews as $rev): ?>
    <div class="rd-review rd-review--<?= $rev['type'] ?>">
        <div class="rd-review__header">
            <span><strong style="color:#f4f4f5"><?= e($rev['user_name'] ?? 'Unknown') ?></strong> &middot; <?= ucwords(str_replace('_',' ',$rev['type'])) ?></span>
            <span><?= date('M j, g:i A', strtotime($rev['created_at'])) ?></span>
        </div>
        <?php if ($rev['body']): ?>
        <div class="rd-review__body"><?= nl2br(e($rev['body'])) ?></div>
        <?php endif; ?>
    </div>
    <?php endforeach; ?>
    <?php endif; ?>

    <!-- Add Review Form -->
    <?php if (isLoggedIn()): ?>
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid #27272a">
        <div class="rd-form-row">
            <textarea id="reviewBody" placeholder="Add a comment or review..." style="width:100%;background:#09090b;border:1px solid #27272a;color:#f4f4f5;padding:8px 12px;border-radius:6px;font-size:14px;min-height:60px;resize:vertical;box-sizing:border-box"></textarea>
        </div>
        <div style="display:flex;gap:8px">
            <button class="rd-btn rd-btn--ghost" onclick="addReview(<?= $release['id'] ?>,'comment')">&#128172; Comment</button>
            <?php if ($releaseModel->canUserApprove($user)): ?>
            <button class="rd-btn rd-btn--green" onclick="addReview(<?= $release['id'] ?>,'approval')">&#10003; Approve</button>
            <button class="rd-btn rd-btn--yellow" onclick="addReview(<?= $release['id'] ?>,'changes_requested')">&#9888; Request Changes</button>
            <?php endif; ?>
        </div>
    </div>
    <?php endif; ?>
</div>

<!-- Audit Log -->
<div class="rd-card">
    <h3>Audit Trail</h3>
    <?php if (empty($auditLog)): ?>
    <p style="color:#71717a;font-size:14px">No activity recorded.</p>
    <?php else: ?>
    <?php foreach (array_slice($auditLog, 0, 20) as $log): ?>
    <div class="rd-audit-item">
        <span class="rd-audit-action"><?= ucwords(str_replace('_',' ',$log['action'])) ?></span>
        <span class="rd-audit-user"><?= e($log['user_name'] ?? 'System') ?></span>
        <span class="rd-audit-time"><?= date('M j, g:i A', strtotime($log['created_at'])) ?></span>
    </div>
    <?php endforeach; ?>
    <?php endif; ?>
</div>
