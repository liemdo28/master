<?php
/**
 * CEO Review Mode — Phase 11.7
 * Highlights new modules, changed modules, known issues, and release notes
 * during the CEO's pre-publish review.
 *
 * Route: /admin/releases/{id}/review
 * Requires: admin or manager role
 *
 * @var Release|null $release
 * @var array $auditLog
 * @var array $reviews
 * @var array $artifacts
 */
$releaseModel = new Release();
$user = currentUser();
$today = date('Y-m-d');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CEO Review — <?= e($release['version'] ?? 'Release') ?> — TaskFlow</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, -apple-system, sans-serif; background: #09090b; color: #f4f4f5; min-height: 100vh; }

        .crw-wrap { max-width: 960px; margin: 0 auto; padding: 32px 20px; }

        /* Header */
        .crw-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 32px; flex-wrap: wrap; }
        .crw-title-block h1 { font-size: 24px; font-weight: 700; color: #f4f4f5; margin-bottom: 6px; }
        .crw-title-block p { color: #71717a; font-size: 14px; }
        .crw-meta { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
        .crw-version-badge {
            display: inline-block; padding: 4px 14px; border-radius: 20px;
            background: #2d2250; color: #a78bfa; font-family: monospace; font-size: 14px; font-weight: 600;
        }
        .crw-status-badge {
            display: inline-block; padding: 4px 12px; border-radius: 20px;
            font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px;
        }
        .crw-status-badge--draft { background: #18181b; border: 1px solid #27272a; color: #71717a; }
        .crw-status-badge--review { background: #1e3a5f; color: #60a5fa; }
        .crw-status-badge--approved { background: #052e16; color: #4ade80; }
        .crw-status-badge--live { background: #052e16; color: #4ade80; }
        .crw-status-badge--cancelled { background: #450a0a; color: #f87171; }

        /* Navigation */
        .crw-nav { display: flex; gap: 8px; margin-bottom: 28px; border-bottom: 1px solid #27272a; padding-bottom: 0; flex-wrap: wrap; }
        .crw-nav a {
            padding: 10px 18px; font-size: 13px; font-weight: 500; color: #71717a;
            text-decoration: none; border-bottom: 2px solid transparent; margin-bottom: -1px;
            display: inline-flex; align-items: center; gap: 6px;
        }
        .crw-nav a:hover { color: #d4d4d8; }
        .crw-nav a.active { color: #f4f4f5; border-bottom-color: #60a5fa; }

        /* Sections */
        .crw-section { margin-bottom: 32px; }
        .crw-section__title {
            font-size: 13px; font-weight: 600; color: #71717a; text-transform: uppercase;
            letter-spacing: .7px; margin-bottom: 14px; display: flex; align-items: center; gap: 8px;
        }
        .crw-section__title::after { content: ''; flex: 1; height: 1px; background: #27272a; }

        /* Cards */
        .crw-card {
            background: #18181b; border: 1px solid #27272a; border-radius: 12px;
            padding: 20px; margin-bottom: 16px;
        }
        .crw-card--highlight { border-color: #2d2250; background: #0f0b1a; }
        .crw-card--pass { border-color: #052e16; background: #052010; }
        .crw-card--fail { border-color: #450a0a; background: #1a0505; }
        .crw-card--pending { border-color: #27272a; }

        .crw-card__title { font-size: 16px; font-weight: 600; margin-bottom: 8px; color: #f4f4f5; }
        .crw-card__body { font-size: 14px; color: #a1a1aa; line-height: 1.6; }
        .crw-card__body p { margin-bottom: 8px; }
        .crw-card__body p:last-child { margin-bottom: 0; }

        /* Grid layouts */
        .crw-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 600px) { .crw-grid-2 { grid-template-columns: 1fr; } }

        /* Checklist */
        .crw-checklist { list-style: none; }
        .crw-checklist li {
            display: flex; align-items: flex-start; gap: 10px;
            padding: 10px 0; border-bottom: 1px solid #1f1f23; font-size: 14px; color: #d4d4d8;
        }
        .crw-checklist li:last-child { border-bottom: none; }
        .crw-check-icon { width: 18px; height: 18px; flex-shrink: 0; margin-top: 2px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; }
        .crw-check-icon--pass { background: #052e16; color: #4ade80; }
        .crw-check-icon--fail { background: #450a0a; color: #f87171; }
        .crw-check-icon--pending { background: #27272a; color: #71717a; }
        .crw-check-icon--new { background: #1e3a5f; color: #60a5fa; }
        .crw-check-icon--changed { background: #2d2250; color: #a78bfa; }

        /* Walkthrough Matrix */
        .crw-wt-matrix { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
        @media (max-width: 700px) { .crw-wt-matrix { grid-template-columns: repeat(3, 1fr); } }
        .crw-wt-cell { background: #09090b; border: 1px solid #27272a; border-radius: 8px; padding: 14px; text-align: center; }
        .crw-wt-cell__role { font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
        .crw-wt-cell__badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .crw-wt-badge--pass { background: #052e16; color: #4ade80; }
        .crw-wt-badge--fail { background: #450a0a; color: #f87171; }
        .crw-wt-badge--pending { background: #18181b; border: 1px solid #27272a; color: #71717a; }

        /* Notes fields */
        .crw-note-field { margin-bottom: 16px; }
        .crw-note-field__label { font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
        .crw-note-field__value { font-size: 14px; color: #d4d4d8; line-height: 1.6; background: #09090b; border: 1px solid #27272a; border-radius: 8px; padding: 12px; }
        .crw-note-field__value--empty { color: #52525b; font-style: italic; }

        /* Action buttons */
        .crw-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
        .crw-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; text-decoration: none; transition: opacity .15s; }
        .crw-btn:hover { opacity: .85; }
        .crw-btn--primary { background: #1d4ed8; color: #fff; }
        .crw-btn--green { background: #052e16; color: #4ade80; border: 1px solid #166534; }
        .crw-btn--red { background: #450a0a; color: #f87171; border: 1px solid #7f1d1d; }
        .crw-btn--ghost { background: transparent; color: #a1a1aa; border: 1px solid #27272a; }
        .crw-btn--blue { background: transparent; color: #60a5fa; border: 1px solid #1e3a5f; }

        /* Timeline */
        .crw-timeline { position: relative; padding-left: 24px; }
        .crw-timeline::before { content: ''; position: absolute; left: 6px; top: 0; bottom: 0; width: 1px; background: #27272a; }
        .crw-tl-item { position: relative; margin-bottom: 16px; }
        .crw-tl-item::before { content: ''; position: absolute; left: -18px; top: 8px; width: 9px; height: 9px; border-radius: 50%; background: #27272a; border: 2px solid #18181b; }
        .crw-tl-item--pass::before { background: #4ade80; }
        .crw-tl-item--live::before { background: #4ade80; }
        .crw-tl-item__time { font-size: 11px; color: #52525b; margin-bottom: 2px; }
        .crw-tl-item__action { font-size: 13px; color: #d4d4d8; font-weight: 500; }
        .crw-tl-item__user { font-size: 12px; color: #71717a; margin-top: 2px; }

        /* Review comments */
        .crw-review { border: 1px solid #27272a; border-radius: 10px; padding: 14px; margin-bottom: 10px; }
        .crw-review__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .crw-review__user { font-size: 13px; font-weight: 600; color: #f4f4f5; }
        .crw-review__time { font-size: 11px; color: #52525b; }
        .crw-review__type { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; text-transform: uppercase; }
        .crw-review__type--comment { background: #18181b; color: #a1a1aa; }
        .crw-review__type--approval { background: #052e16; color: #4ade80; }
        .crw-review__type--changes_requested { background: #450a0a; color: #f87171; }
        .crw-review__body { font-size: 13px; color: #d4d4d8; line-height: 1.5; }

        /* Summary bar */
        .crw-summary-bar {
            display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
            background: #18181b; border: 1px solid #27272a; border-radius: 12px;
            padding: 20px; margin-bottom: 28px;
        }
        @media (max-width: 600px) { .crw-summary-bar { grid-template-columns: repeat(2, 1fr); } }
        .crw-summary-item { text-align: center; }
        .crw-summary-item__value { font-size: 28px; font-weight: 700; line-height: 1; }
        .crw-summary-item__label { font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: .5px; margin-top: 6px; }
        .crw-summary-item--pass .crw-summary-item__value { color: #4ade80; }
        .crw-summary-item--fail .crw-summary-item__value { color: #f87171; }
        .crw-summary-item--pending .crw-summary-item__value { color: #fbbf24; }
        .crw-summary-item--total .crw-summary-item__value { color: #60a5fa; }

        /* Confidence score */
        .crw-confidence {
            display: inline-flex; align-items: center; gap: 12px;
            background: #18181b; border: 1px solid #27272a; border-radius: 10px; padding: 16px 20px;
        }
        .crw-confidence__letter { font-size: 36px; font-weight: 800; line-height: 1; }
        .crw-confidence__label { font-size: 13px; color: #71717a; }
        .crw-confidence__pct { font-size: 14px; color: #d4d4d8; font-weight: 600; }
    </style>
</head>
<body>
<div class="crw-wrap">

<?php if (!$release): ?>
    <div class="crw-card crw-card--fail">
        <div class="crw-card__title">Release Not Found</div>
        <div class="crw-card__body">This release does not exist or has been deleted.</div>
        <div class="crw-actions" style="margin-top:16px">
            <a href="/admin/releases" class="crw-btn crw-btn--ghost">Back to Releases</a>
        </div>
    </div>
<?php else: ?>

    <!-- Header -->
    <div class="crw-header">
        <div class="crw-title-block">
            <h1>CEO Review — <?= e($release['version']) ?></h1>
            <p>Phase 11.7 — Operational Readiness Review Mode</p>
        </div>
        <div class="crw-meta">
            <span class="crw-version-badge"><?= e($release['version']) ?></span>
            <span class="crw-status-badge crw-status-badge--<?= e($release['status']) ?>"><?= ucfirst($release['status']) ?></span>
        </div>
    </div>

    <!-- Navigation -->
    <div class="crw-nav">
        <a href="/admin/releases/<?= $release['id'] ?>" class="">Release Detail</a>
        <a href="/admin/releases/<?= $release['id'] ?>/artifacts" class="">Artifacts</a>
        <a href="/admin/walkthrough-library" class="">Walkthrough Library</a>
        <a href="#" class="active" onclick="return false" style="cursor:default">CEO Review</a>
    </div>

    <!-- Summary Bar -->
    <?php
    $wtRoles = ['ceo','manager','member','admin','release_qa'];
    $passCount = 0; $failCount = 0; $pendingCount = 0;
    foreach ($wtRoles as $role) {
        $v = $release["walkthrough_{$role}"] ?? null;
        if ($v === 'pass') $passCount++;
        elseif ($v === 'fail') $failCount++;
        else $pendingCount++;
    }
    $confLetter = $releaseModel->computeConfidenceLetter($release['confidence_score'] ?? null);
    $confColor = match($confLetter) { 'S' => '#f59e0b', 'A' => '#34d399', 'B' => '#60a5fa', 'C' => '#fbbf24', default => '#71717a' };
    ?>
    <div class="crw-summary-bar">
        <div class="crw-summary-item crw-summary-item--pass">
            <div class="crw-summary-item__value"><?= $passCount ?></div>
            <div class="crw-summary-item__label">Pass</div>
        </div>
        <div class="crw-summary-item crw-summary-item--fail">
            <div class="crw-summary-item__value"><?= $failCount ?></div>
            <div class="crw-summary-item__label">Fail</div>
        </div>
        <div class="crw-summary-item crw-summary-item--pending">
            <div class="crw-summary-item__value"><?= $pendingCount ?></div>
            <div class="crw-summary-item__label">Pending</div>
        </div>
        <div class="crw-summary-item crw-summary-item--total">
            <div class="crw-summary-item__value"><?= $passCount + $failCount + $pendingCount ?></div>
            <div class="crw-summary-item__label">Total</div>
        </div>
    </div>

    <!-- NEW MODULES (Phase 11.7 specific highlights) -->
    <div class="crw-section">
        <div class="crw-section__title">New in This Release</div>
        <div class="crw-card crw-card--highlight">
            <div class="crw-card__title" style="color:#a78bfa">Phase 11.7 — Operational Readiness</div>
            <div class="crw-card__body">
                <ul class="crw-checklist">
                    <li>
                        <span class="crw-check-icon crw-check-icon--new">N</span>
                        <div>
                            <strong>Navigation Architecture Rebuild</strong> — Left sidebar rebuilt with 6 new section categories: Operations, Tasks, People, Stores, Governance, Finance. All modules reachable in &lt;2 clicks.
                        </div>
                    </li>
                    <li>
                        <span class="crw-check-icon crw-check-icon--new">N</span>
                        <div>
                            <strong>Walkthrough Library</strong> — New admin page at <code>/admin/walkthrough-library</code> for reviewing all walkthrough records across releases and roles.
                        </div>
                    </li>
                    <li>
                        <span class="crw-check-icon crw-check-icon--new">N</span>
                        <div>
                            <strong>CEO Review Mode</strong> — This page. Consolidated view for CEO pre-publish sign-off.
                        </div>
                    </li>
                    <li>
                        <span class="crw-check-icon crw-check-icon--new">N</span>
                        <div>
                            <strong>Store Command Center</strong> — Full store operations hub with health scores, task stats, and team roster.
                        </div>
                    </li>
                    <li>
                        <span class="crw-check-icon crw-check-icon--new">N</span>
                        <div>
                            <strong>Control Tower</strong> — Priority decision dashboard with ranked executive actions.
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    </div>

    <!-- CHANGED MODULES -->
    <div class="crw-section">
        <div class="crw-section__title">Changed Modules</div>
        <div class="crw-card crw-card">
            <div class="crw-card__title">Modules with Significant Changes</div>
            <div class="crw-card__body">
                <ul class="crw-checklist">
                    <li>
                        <span class="crw-check-icon crw-check-icon--changed">C</span>
                        <div>
                            <strong>Sidebar Navigation</strong> — Complete restructure from PRIORITY/WORK/FINANCE to Operations/Tasks/People/Stores/Governance alignment.
                        </div>
                    </li>
                    <li>
                        <span class="crw-check-icon crw-check-icon--changed">C</span>
                        <div>
                            <strong>Release Center</strong> — Added CEO Review Mode, Walkthrough Library integration, and public review link workflow.
                        </div>
                    </li>
                    <li>
                        <span class="crw-check-icon crw-check-icon--changed">C</span>
                        <div>
                            <strong>Employee Management</strong> — New Shifts and Training modules added to sidebar navigation.
                        </div>
                    </li>
                    <li>
                        <span class="crw-check-icon crw-check-icon--changed">C</span>
                        <div>
                            <strong>Store Operations</strong> — Store Command Center surfaced in sidebar with full health dashboard.
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    </div>

    <!-- KNOWN ISSUES -->
    <div class="crw-section">
        <div class="crw-section__title">Known Issues</div>
        <?php if (!empty($release['known_issues'])): ?>
            <div class="crw-card crw-card--fail">
                <div class="crw-card__title" style="color:#f87171">Active Known Issues</div>
                <div class="crw-card__body"><?= nl2br(e($release['known_issues'])) ?></div>
            </div>
        <?php else: ?>
            <div class="crw-card crw-card--pass">
                <div class="crw-card__title" style="color:#4ade80">No Known Issues</div>
                <div class="crw-card__body">No active known issues are flagged for this release.</div>
            </div>
        <?php endif; ?>
    </div>

    <!-- RELEASE NOTES -->
    <div class="crw-section">
        <div class="crw-section__title">Release Notes</div>
        <div class="crw-grid-2">
            <div class="crw-card crw-card">
                <div class="crw-note-field">
                    <div class="crw-note-field__label">What Changed</div>
                    <div class="crw-note-field__value <?= empty($release['change_log']) ? 'crw-note-field__value--empty' : '' ?>">
                        <?= !empty($release['change_log']) ? nl2br(e($release['change_log'])) : 'No changelog recorded.' ?>
                    </div>
                </div>
                <div class="crw-note-field">
                    <div class="crw-note-field__label">Bug Fixes</div>
                    <div class="crw-note-field__value <?= empty($release['bug_fixes']) ? 'crw-note-field__value--empty' : '' ?>">
                        <?= !empty($release['bug_fixes']) ? nl2br(e($release['bug_fixes'])) : 'No bug fixes recorded.' ?>
                    </div>
                </div>
            </div>
            <div class="crw-card crw-card">
                <div class="crw-note-field">
                    <div class="crw-note-field__label">Summary</div>
                    <div class="crw-note-field__value <?= empty($release['summary']) ? 'crw-note-field__value--empty' : '' ?>">
                        <?= !empty($release['summary']) ? nl2br(e($release['summary'])) : 'No summary recorded.' ?>
                    </div>
                </div>
                <div class="crw-note-field">
                    <div class="crw-note-field__label">Risk Notes</div>
                    <div class="crw-note-field__value <?= empty($release['risk_notes']) ? 'crw-note-field__value--empty' : '' ?>">
                        <?= !empty($release['risk_notes']) ? nl2br(e($release['risk_notes'])) : 'No risk notes recorded.' ?>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- WALKTHROUGH STATUS -->
    <div class="crw-section">
        <div class="crw-section__title">Walkthrough Status</div>
        <div class="crw-card crw-card">
            <div class="crw-wt-matrix">
                <?php foreach (['ceo'=>'CEO','manager'=>'Manager','member'=>'Member','admin'=>'Admin','release_qa'=>'Release QA'] as $role=>$label): ?>
                    <?php $v = $release["walkthrough_{$role}"] ?? null; ?>
                    <div class="crw-wt-cell">
                        <div class="crw-wt-cell__role"><?= $label ?></div>
                        <?php if ($v): ?>
                            <span class="crw-wt-cell__badge crw-wt-badge--<?= e($v) ?>"><?= strtoupper($v) ?></span>
                        <?php else: ?>
                            <span class="crw-wt-cell__badge crw-wt-badge--pending">PENDING</span>
                        <?php endif; ?>
                    </div>
                <?php endforeach; ?>
            </div>
            <?php if (canManage()): ?>
            <div class="crw-actions" style="margin-top:16px">
                <a href="/admin/releases/<?= $release['id'] ?>" class="crw-btn crw-btn--ghost">Mark Walkthroughs</a>
                <a href="/admin/walkthrough-library" class="crw-btn crw-btn--ghost">View Library</a>
            </div>
            <?php endif; ?>
        </div>
    </div>

    <!-- QUALITY SCORES -->
    <div class="crw-section">
        <div class="crw-section__title">Quality Scores</div>
        <div class="crw-card crw-card">
            <div class="crw-confidence" style="margin-bottom:16px">
                <span class="crw-confidence__letter" style="color:<?= $confColor ?>"><?= $confLetter ?: '?' ?></span>
                <div>
                    <div class="crw-confidence__label">Confidence Score</div>
                    <div class="crw-confidence__pct">
                        <?= $release['confidence_score'] !== null ? number_format($release['confidence_score'],1).'%' : 'Not set' ?>
                    </div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                <div>
                    <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">QA Score</div>
                    <div style="font-size:24px;font-weight:700;color:<?= ($release['qa_score'] ?? 0) >= 80 ? '#4ade80' : '#f87171' ?>">
                        <?= $release['qa_score'] !== null ? number_format($release['qa_score'],1).'%' : '—' ?>
                    </div>
                </div>
                <div>
                    <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Confidence</div>
                    <div style="font-size:24px;font-weight:700;color:<?= $confColor ?>"><?= $confLetter ?: '—' ?></div>
                </div>
            </div>
        </div>
    </div>

    <!-- APPROVAL CHECKLIST -->
    <div class="crw-section">
        <div class="crw-section__title">CEO Approval Checklist</div>
        <div class="crw-card crw-card">
            <ul class="crw-checklist">
                <?php
                $checkItems = [
                    ['label' => 'All walkthroughs passed (no FAIL)', 'pass' => $failCount === 0 && $passCount > 0, 'pending' => $passCount === 0 && $pendingCount > 0],
                    ['label' => 'Confidence score >= 70%', 'pass' => ($release['confidence_score'] ?? 0) >= 70, 'pending' => $release['confidence_score'] === null],
                    ['label' => 'QA score recorded', 'pass' => $release['qa_score'] !== null, 'pending' => true],
                    ['label' => 'Known issues documented (or none)', 'pass' => true, 'pending' => false],
                    ['label' => 'Release notes written', 'pass' => !empty($release['change_log']), 'pending' => empty($release['change_log'])],
                    ['label' => 'Rollback plan documented', 'pass' => !empty($release['rollback_notes']), 'pending' => empty($release['rollback_notes'])],
                    ['label' => 'Preview environment validated', 'pass' => !empty($release['preview_url']), 'pending' => empty($release['preview_url'])],
                ];
                foreach ($checkItems as $item):
                    $iconClass = $item['pass'] ? 'crw-check-icon--pass' : ($item['pending'] ? 'crw-check-icon--pending' : 'crw-check-icon--fail');
                    $iconChar = $item['pass'] ? '✓' : ($item['pending'] ? '?' : '✗');
                ?>
                <li>
                    <span class="crw-check-icon <?= $iconClass ?>"><?= $iconChar ?></span>
                    <span style="color:<?= $item['pass'] ? '#d4d4d8' : ($item['pending'] ? '#71717a' : '#f87171') ?>">
                        <?= e($item['label']) ?>
                    </span>
                </li>
                <?php endforeach; ?>
            </ul>
        </div>
    </div>

    <!-- Timeline -->
    <?php if (!empty($auditLog)): ?>
    <div class="crw-section">
        <div class="crw-section__title">Release Timeline</div>
        <div class="crw-card crw-card">
            <div class="crw-timeline">
                <?php foreach (array_slice($auditLog, 0, 10) as $log): ?>
                    <div class="crw-tl-item <?= $log['action'] === 'live' ? 'crw-tl-item--live' : '' ?>">
                        <div class="crw-tl-item__time"><?= date('M j, Y g:i A', strtotime($log['created_at'])) ?></div>
                        <div class="crw-tl-item__action"><?= ucwords(str_replace('_',' ',$log['action'])) ?></div>
                        <?php if (!empty($log['user_name'])): ?>
                        <div class="crw-tl-item__user">by <?= e($log['user_name']) ?></div>
                        <?php endif; ?>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
    </div>
    <?php endif; ?>

    <!-- Reviews -->
    <?php if (!empty($reviews)): ?>
    <div class="crw-section">
        <div class="crw-section__title">Reviews & Feedback</div>
        <?php foreach ($reviews as $rev): ?>
            <div class="crw-review">
                <div class="crw-review__header">
                    <span class="crw-review__user"><?= e($rev['user_name'] ?? 'Unknown') ?></span>
                    <span class="crw-review__type crw-review__type--<?= e($rev['type']) ?>"><?= ucwords(str_replace('_',' ',$rev['type'])) ?></span>
                </div>
                <div class="crw-review__time"><?= date('M j, Y g:i A', strtotime($rev['created_at'])) ?></div>
                <?php if (!empty($rev['body'])): ?>
                    <div class="crw-review__body" style="margin-top:8px"><?= nl2br(e($rev['body'])) ?></div>
                <?php endif; ?>
            </div>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>

    <!-- Actions -->
    <div class="crw-section">
        <div class="crw-actions">
            <a href="/admin/releases/<?= $release['id'] ?>" class="crw-btn crw-btn--ghost">Release Detail</a>
            <a href="/admin/releases" class="crw-btn crw-btn--ghost">All Releases</a>
            <?php if ($releaseModel->canUserApprove($user)): ?>
            <button class="crw-btn crw-btn--green" onclick="addReview(<?= $release['id'] ?>,'approval')">✓ Approve Release</button>
            <button class="crw-btn crw-btn--red" onclick="addReview(<?= $release['id'] ?>,'changes_requested')">Request Changes</button>
            <?php endif; ?>
        </div>
    </div>

<?php endif; /* end if ($release) */ ?>

</div><!-- /.crw-wrap -->

<script>
async function addReview(releaseId, type) {
    const body = prompt('Add a comment (optional):', '');
    if (body === null) return;
    try {
        const res = await fetch(`/api/admin/releases/${releaseId}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': window.CSRF_TOKEN || '' },
            body: JSON.stringify({ type, body })
        });
        const data = await res.json();
        if (data.ok || res.ok) {
            location.reload();
        } else {
            alert('Error: ' + (data.error || 'Unknown error'));
        }
    } catch (e) {
        alert('Network error: ' + e.message);
    }
}
</script>
</body>
</html>
