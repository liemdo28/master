<?php
$pageTitle = 'Release Management';
$currentPage = 'admin-releases';
$extraCss = [];
$extraJs = [];

// Get current live version for banner
$releaseModel = new Release();
$liveVersion = $releaseModel->getCurrentLiveVersion();
$liveSummary = $releaseModel->getDashboardSummary();

ob_start();
?>

<style>
.rel-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:12px; margin-bottom:24px }
.rel-stat { background:#18181b; border:1px solid #27272a; border-radius:10px; padding:16px; text-align:center }
.rel-stat__num { font-size:28px; font-weight:700; color:#f4f4f5 }
.rel-stat__label { font-size:12px; color:#71717a; margin-top:4px; text-transform:uppercase; letter-spacing:.5px }
.rel-stat--draft .rel-stat__num { color:#a78bfa }
.rel-stat--review .rel-stat__num { color:#fbbf24 }
.rel-stat--approved .rel-stat__num { color:#34d399 }
.rel-stat--scheduled .rel-stat__num { color:#60a5fa }
.rel-stat--published .rel-stat__num { color:#10b981 }
.rel-stat--rollback .rel-stat__num { color:#f87171 }

.rel-toolbar { display:flex; gap:12px; align-items:center; margin-bottom:20px; flex-wrap:wrap }
.rel-toolbar input, .rel-toolbar select { background:#18181b; border:1px solid #27272a; color:#f4f4f5; padding:8px 12px; border-radius:8px; font-size:14px }
.rel-toolbar input:focus, .rel-toolbar select:focus { outline:none; border-color:#3b82f6 }

.rel-table { width:100%; border-collapse:collapse }
.rel-table th { text-align:left; padding:10px 12px; font-size:12px; color:#71717a; text-transform:uppercase; letter-spacing:.5px; border-bottom:1px solid #27272a }
.rel-table td { padding:12px; border-bottom:1px solid #1f1f23; vertical-align:middle }
.rel-table tr:hover td { background:#1c1c20 }

.rel-badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.3px }
.rel-badge--draft { background:#2d2250; color:#a78bfa }
.rel-badge--ready_for_review { background:#422006; color:#fbbf24 }
.rel-badge--qa_running { background:#1e3a5f; color:#60a5fa }
.rel-badge--qa_passed { background:#064e3b; color:#34d399 }
.rel-badge--approved { background:#064e3b; color:#10b981 }
.rel-badge--scheduled { background:#1e3a5f; color:#93c5fd }
.rel-badge--published { background:#052e16; color:#4ade80 }
.rel-badge--archived { background:#27272a; color:#71717a }
.rel-badge--rolled_back { background:#450a0a; color:#fca5a5 }
.rel-badge--changes_requested { background:#451a03; color:#fb923c }

.rel-freeze-banner { background:#450a0a; border:1px solid #7f1d1d; border-radius:10px; padding:14px 20px; margin-bottom:20px; display:flex; align-items:center; gap:12px }
.rel-freeze-banner__icon { font-size:20px }
.rel-freeze-banner__text { color:#fca5a5; font-size:14px }
.rel-freeze-banner__text strong { color:#f87171 }

.rel-empty { text-align:center; padding:60px 20px; color:#71717a }
.rel-empty h3 { color:#a1a1aa; margin-bottom:8px }

.rel-actions { display:flex; gap:8px }
.btn-rel { padding:6px 14px; border-radius:6px; font-size:13px; font-weight:500; border:none; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; gap:6px; transition:all .15s }
.btn-rel--primary { background:#3b82f6; color:#fff }
.btn-rel--primary:hover { background:#2563eb }
.btn-rel--ghost { background:transparent; color:#a1a1aa; border:1px solid #27272a }
.btn-rel--ghost:hover { background:#27272a; color:#f4f4f5 }

.rel-version { font-family:monospace; font-size:12px; color:#a78bfa; background:#2d2250; padding:2px 8px; border-radius:4px }
.rel-owner { font-size:13px; color:#a1a1aa }
.rel-date { font-size:12px; color:#71717a }

.pagination { display:flex; gap:8px; justify-content:center; margin-top:24px }
.pagination a, .pagination span { padding:6px 12px; border-radius:6px; font-size:13px; text-decoration:none }
.pagination a { background:#27272a; color:#a1a1aa }
.pagination a:hover { background:#3f3f46; color:#f4f4f5 }
.pagination .current { background:#3b82f6; color:#fff }

/* Current Live Version Banner */
.live-version-banner { background:linear-gradient(135deg,#052e16,#064e3b); border:1px solid #065f46; border-radius:10px; padding:16px 20px; margin-bottom:24px; display:flex; align-items:center; gap:16px; flex-wrap:wrap }
.live-version-banner__icon { font-size:28px }
.live-version-banner__info { flex:1;min-width:200px }
.live-version-banner__label { font-size:11px;color:#86efac;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px }
.live-version-banner__version { font-family:monospace;font-size:22px;font-weight:700;color:#4ade80;margin-bottom:2px }
.live-version-banner__meta { font-size:12px;color:#86efac;display:flex;gap:16px;flex-wrap:wrap }
.live-version-banner__actions { display:flex;gap:8px }
.confidence-badge { display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;font-size:13px;font-weight:700;background:#052e16;color:#4ade80 }
.confidence-badge--a { color:#34d399 }
.confidence-badge--b { color:#60a5fa }
.confidence-badge--c { color:#fbbf24 }
.confidence-badge--d { color:#f87171 }
</style>

<!-- Flash messages -->
<?php if ($msg = flash('success')): ?>
<div style="background:#052e16;border:1px solid #065f46;color:#34d399;padding:12px 16px;border-radius:8px;margin-bottom:16px;font-size:14px"><?= e($msg) ?></div>
<?php endif; ?>
<?php if ($msg = flash('error')): ?>
<div style="background:#450a0a;border:1px solid #7f1d1d;color:#fca5a5;padding:12px 16px;border-radius:8px;margin-bottom:16px;font-size:14px"><?= e($msg) ?></div>
<?php endif; ?>

<!-- Current Live Version Banner -->
<?php if ($liveVersion): ?>
<?php
$confLetter = $releaseModel->computeConfidenceLetter($liveVersion['confidence_score']);
?>
<div class="live-version-banner">
    <span class="live-version-banner__icon">&#128640;</span>
    <div class="live-version-banner__info">
        <div class="live-version-banner__label">Current Production Version</div>
        <div class="live-version-banner__version"><?= e($liveVersion['version']) ?></div>
        <div class="live-version-banner__meta">
            <span><?= e($liveVersion['name']) ?></span>
            <span>&middot;</span>
            <span>Updated <?= date('M j, Y g:i A', strtotime($liveVersion['published_at'])) ?></span>
            <span>&middot;</span>
            <span>By <?= e($liveVersion['published_by_name'] ?? 'Admin') ?></span>
            <?php if ($liveVersion['commit_hash']): ?>
            <span>&middot;</span>
            <span style="font-family:monospace;color:#a78bfa"><?= e(substr($liveVersion['commit_hash'],0,8)) ?></span>
            <?php endif; ?>
        </div>
    </div>
    <?php if ($confLetter): ?>
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <span class="confidence-badge confidence-badge--<?= strtolower($confLetter) ?>"><?= e($confLetter) ?></span>
        <span style="font-size:10px;color:#86efac;text-transform:uppercase">Score</span>
    </div>
    <?php endif; ?>
    <div class="live-version-banner__actions">
        <button class="btn-rel btn-rel--ghost" onclick="openVersionDetailsModal()">Details</button>
        <a href="<?= APP_URL ?>/admin/releases/<?= $liveVersion['id'] ?>" class="btn-rel btn-rel--ghost">View</a>
    </div>
</div>
<?php else: ?>
<div class="live-version-banner" style="background:#1c1c20;border-color:#27272a">
    <span class="live-version-banner__icon">&#128640;</span>
    <div class="live-version-banner__info">
        <div class="live-version-banner__label" style="color:#71717a">No Production Version</div>
        <div class="live-version-banner__version" style="color:#71717a;font-size:16px">No release has been published to production yet</div>
    </div>
</div>
<?php endif; ?>

<!-- Deploy Freeze Banner -->
<?php if (!empty($freezes)): ?>
<div class="rel-freeze-banner">
    <span class="rel-freeze-banner__icon">&#9940;</span>
    <div class="rel-freeze-banner__text">
        <strong>Deploy Freeze Active</strong> — Production deployments are blocked.
        <?= e($freezes[0]['reason']) ?>
    </div>
</div>
<?php endif; ?>

<!-- Stats -->
<div class="rel-stats">
    <div class="rel-stat rel-stat--draft">
        <div class="rel-stat__num"><?= $stats['drafts'] ?></div>
        <div class="rel-stat__label">Drafts</div>
    </div>
    <div class="rel-stat rel-stat--review">
        <div class="rel-stat__num"><?= $stats['awaiting_review'] ?></div>
        <div class="rel-stat__label">Awaiting Review</div>
    </div>
    <div class="rel-stat rel-stat--approved">
        <div class="rel-stat__num"><?= $stats['approved'] ?></div>
        <div class="rel-stat__label">Approved</div>
    </div>
    <div class="rel-stat rel-stat--scheduled">
        <div class="rel-stat__num"><?= $stats['scheduled'] ?></div>
        <div class="rel-stat__label">Scheduled</div>
    </div>
    <div class="rel-stat rel-stat--published">
        <div class="rel-stat__num"><?= $stats['published'] ?></div>
        <div class="rel-stat__label">Published</div>
    </div>
    <div class="rel-stat rel-stat--rollback">
        <div class="rel-stat__num"><?= $stats['rolled_back'] ?></div>
        <div class="rel-stat__label">Rolled Back</div>
    </div>
</div>

<!-- Toolbar -->
<div class="rel-toolbar">
    <form method="GET" action="<?= APP_URL ?>/admin/releases" style="display:flex;gap:12px;flex:1;flex-wrap:wrap">
        <input type="text" name="search" placeholder="Search releases..." value="<?= e($_GET['search'] ?? '') ?>" style="flex:1;min-width:200px">
        <select name="status">
            <option value="">All Statuses</option>
            <?php foreach (\Release::STATES as $s): ?>
            <option value="<?= $s ?>" <?= ($_GET['status'] ?? '') === $s ? 'selected' : '' ?>><?= ucwords(str_replace('_', ' ', $s)) ?></option>
            <?php endforeach; ?>
        </select>
        <button type="submit" class="btn-rel btn-rel--ghost">Filter</button>
    </form>
    <a href="<?= APP_URL ?>/admin/releases/create" class="btn-rel btn-rel--primary">+ New Release</a>
</div>

<!-- Releases Table -->
<?php if (empty($releases)): ?>
<div class="rel-empty">
    <h3>No releases found</h3>
    <p>Create your first release draft to get started with the release management workflow.</p>
</div>
<?php else: ?>
<table class="rel-table">
    <thead>
        <tr>
            <th>Release</th>
            <th>Version</th>
            <th>Status</th>
            <th>QA</th>
            <th>Confidence</th>
            <th>Owner</th>
            <th>Updated</th>
            <th>Actions</th>
        </tr>
    </thead>
    <tbody>
        <?php foreach ($releases as $r): ?>
        <?php
        $confL = $releaseModel->computeConfidenceLetter($r['confidence_score']);
        $confColor = match($confL) { 'S' => '#f59e0b', 'A' => '#34d399', 'B' => '#60a5fa', 'C' => '#fbbf24', default => '#71717a' };
        ?>
        <tr>
            <td>
                <a href="<?= APP_URL ?>/admin/releases/<?= $r['id'] ?>" style="color:#f4f4f5;text-decoration:none;font-weight:500"><?= e($r['name']) ?></a>
                <?php if ($r['branch']): ?>
                <div style="font-size:12px;color:#71717a;margin-top:2px">&#128204; <?= e($r['branch']) ?></div>
                <?php endif; ?>
            </td>
            <td><span class="rel-version"><?= e($r['version']) ?></span></td>
            <td><span class="rel-badge rel-badge--<?= $r['status'] ?>"><?= ucwords(str_replace('_', ' ', $r['status'])) ?></span></td>
            <td>
                <?php if ($r['qa_score'] !== null): ?>
                <span style="font-size:12px;color:<?= $r['qa_pass'] ? '#34d399' : '#fca5a5' ?>">
                    <?= number_format($r['qa_score'],0) ?>%
                </span>
                <?php else: ?>
                <span style="font-size:12px;color:#71717a">—</span>
                <?php endif; ?>
            </td>
            <td>
                <?php if ($confL): ?>
                <span style="font-size:12px;font-weight:700;color:<?= $confColor ?>"><?= e($confL) ?></span>
                <?php else: ?>
                <span style="font-size:12px;color:#71717a">—</span>
                <?php endif; ?>
            </td>
            <td><span class="rel-owner"><?= e($r['owner_name'] ?? 'Unknown') ?></span></td>
            <td><span class="rel-date"><?= date('M j, Y', strtotime($r['updated_at'])) ?></span></td>
            <td>
                <div class="rel-actions">
                    <a href="<?= APP_URL ?>/admin/releases/<?= $r['id'] ?>" class="btn-rel btn-rel--ghost">View</a>
                    <?php if ($r['preview_url']): ?>
                    <a href="<?= e($r['preview_url']) ?>" target="_blank" class="btn-rel btn-rel--ghost">Preview</a>
                    <?php endif; ?>
                </div>
            </td>
        </tr>
        <?php endforeach; ?>
    </tbody>
</table>

<!-- Pagination -->
<?php
$totalPages = ceil($total / $limit);
if ($totalPages > 1):
?>
<div class="pagination">
    <?php for ($i = 1; $i <= $totalPages; $i++): ?>
        <?php
        $params = $_GET;
        $params['page'] = $i;
        $qs = http_build_query($params);
        ?>
        <?php if ($i === $page): ?>
            <span class="current"><?= $i ?></span>
        <?php else: ?>
            <a href="<?= APP_URL ?>/admin/releases?<?= $qs ?>"><?= $i ?></a>
        <?php endif; ?>
    <?php endfor; ?>
</div>
<?php endif; ?>
<?php endif; ?>

<!-- Version Details Modal (standalone include) -->
<?php
$modalRelease = $liveVersion;
include __DIR__ . '/version_details_modal.php';
?>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
