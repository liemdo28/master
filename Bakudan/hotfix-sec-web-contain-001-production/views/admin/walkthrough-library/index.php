<?php
/** @var array $releases */
/** @var array $allReleases */
/** @var array $stats */
/** @var array $filters */
$releaseModel = new Release();
?>
<style>
.wtl-page { max-width: 1200px; margin: 0 auto; padding: 24px 20px; }
.wtl-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 28px; flex-wrap: wrap; }
.wtl-header h1 { margin: 0; font-size: 22px; font-weight: 600; color: #f4f4f5; }
.wtl-header p { margin: 4px 0 0; color: #71717a; font-size: 13px; }

/* Summary Cards */
.wtl-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 28px; }
.wtl-stat { background: #18181b; border: 1px solid #27272a; border-radius: 10px; padding: 16px; text-align: center; }
.wtl-stat__value { font-size: 28px; font-weight: 700; line-height: 1; }
.wtl-stat__label { font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: .5px; margin-top: 6px; }
.wtl-stat--pass .wtl-stat__value { color: #4ade80; }
.wtl-stat--fail .wtl-stat__value { color: #f87171; }
.wtl-stat--pending .wtl-stat__value { color: #fbbf24; }
.wtl-stat--total .wtl-stat__value { color: #60a5fa; }

/* Filters */
.wtl-filters { background: #18181b; border: 1px solid #27272a; border-radius: 10px; padding: 16px; margin-bottom: 20px; display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
.wtl-filter-group { display: flex; flex-direction: column; gap: 4px; }
.wtl-filter-group label { font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: .5px; }
.wtl-filter-group select, .wtl-filter-group input { background: #09090b; border: 1px solid #27272a; color: #f4f4f5; padding: 7px 12px; border-radius: 6px; font-size: 13px; min-width: 140px; }
.wtl-filter-group select option { background: #18181b; }
.wtl-filter-actions { display: flex; gap: 8px; margin-left: auto; align-self: flex-end; }
.btn-sm { padding: 7px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; border: none; font-weight: 500; }
.btn-primary-sm { background: #1d4ed8; color: #fff; }
.btn-secondary-sm { background: #27272a; color: #a1a1aa; }

/* Table */
.wtl-table-wrap { background: #18181b; border: 1px solid #27272a; border-radius: 10px; overflow: hidden; }
.wtl-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.wtl-table th { background: #1f1f23; padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #71717a; border-bottom: 1px solid #27272a; white-space: nowrap; }
.wtl-table td { padding: 12px 14px; border-bottom: 1px solid #27272a; color: #d4d4d8; vertical-align: middle; }
.wtl-table tr:last-child td { border-bottom: none; }
.wtl-table tr:hover td { background: #1f1f23; }
.wtl-version { font-family: monospace; font-size: 13px; color: #a78bfa; font-weight: 600; }
.wtl-release-link { color: #60a5fa; text-decoration: none; }
.wtl-release-link:hover { text-decoration: underline; }
.wtl-badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; min-width: 52px; text-align: center; }
.wtl-badge--pass { background: #052e16; color: #4ade80; }
.wtl-badge--fail { background: #450a0a; color: #f87171; }
.wtl-badge--pending { background: #18181b; color: #71717a; border: 1px solid #27272a; }
.wtl-status-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px; }
.wtl-status-dot--live { background: #4ade80; }
.wtl-status-dot--draft { background: #fbbf24; }
.wtl-status-dot--review { background: #60a5fa; }
.wtl-empty { padding: 60px 20px; text-align: center; color: #52525b; font-size: 14px; }
</style>

<div class="wtl-page">
    <div class="wtl-header">
        <div>
            <h1>Walkthrough Library</h1>
            <p>Review walkthrough status across all releases and roles</p>
        </div>
        <div style="font-size:12px;color:#52525b">
            Generated: <?= date('M j, Y g:i A') ?>
        </div>
    </div>

    <!-- Summary Stats -->
    <?php
    $totalPass = (int)($stats['ceo_pass'] ?? 0) + (int)($stats['manager_pass'] ?? 0)
               + (int)($stats['member_pass'] ?? 0) + (int)($stats['admin_pass'] ?? 0)
               + (int)($stats['qa_pass'] ?? 0);
    $totalFail = (int)($stats['ceo_fail'] ?? 0) + (int)($stats['manager_fail'] ?? 0)
               + (int)($stats['member_fail'] ?? 0) + (int)($stats['admin_fail'] ?? 0)
               + (int)($stats['qa_fail'] ?? 0);
    $totalPending = (int)($stats['ceo_pending'] ?? 0) + (int)($stats['manager_pending'] ?? 0)
                  + (int)($stats['member_pending'] ?? 0) + (int)($stats['admin_pending'] ?? 0)
                  + (int)($stats['qa_pending'] ?? 0);
    ?>
    <div class="wtl-stats">
        <div class="wtl-stat wtl-stat--pass">
            <div class="wtl-stat__value"><?= $totalPass ?></div>
            <div class="wtl-stat__label">Total Pass</div>
        </div>
        <div class="wtl-stat wtl-stat--fail">
            <div class="wtl-stat__value"><?= $totalFail ?></div>
            <div class="wtl-stat__label">Total Fail</div>
        </div>
        <div class="wtl-stat wtl-stat--pending">
            <div class="wtl-stat__value"><?= $totalPending ?></div>
            <div class="wtl-stat__label">Total Pending</div>
        </div>
        <div class="wtl-stat wtl-stat--pass">
            <div class="wtl-stat__value"><?= (int)($stats['ceo_pass'] ?? 0) ?></div>
            <div class="wtl-stat__label">CEO Pass</div>
        </div>
        <div class="wtl-stat wtl-stat--pass">
            <div class="wtl-stat__value"><?= (int)($stats['manager_pass'] ?? 0) ?></div>
            <div class="wtl-stat__label">Manager Pass</div>
        </div>
        <div class="wtl-stat wtl-stat--total">
            <div class="wtl-stat__value"><?= (int)($stats['total_releases'] ?? 0) ?></div>
            <div class="wtl-stat__label">Releases</div>
        </div>
    </div>

    <!-- Filters -->
    <form class="wtl-filters" method="GET" action="/admin/walkthrough-library">
        <div class="wtl-filter-group">
            <label>Role</label>
            <select name="role">
                <option value="">All Roles</option>
                <?php foreach (['ceo','manager','member','admin','release_qa'] as $r): ?>
                    <option value="<?= $r ?>" <?= $filters['role'] === $r ? 'selected' : '' ?>><?= ucfirst(str_replace('_',' ',$r)) ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="wtl-filter-group">
            <label>Result</label>
            <select name="result">
                <option value="">All Results</option>
                <option value="pass" <?= $filters['result'] === 'pass' ? 'selected' : '' ?>>Pass</option>
                <option value="fail" <?= $filters['result'] === 'fail' ? 'selected' : '' ?>>Fail</option>
                <option value="pending" <?= $filters['result'] === 'pending' ? 'selected' : '' ?>>Pending</option>
            </select>
        </div>
        <div class="wtl-filter-group">
            <label>Release</label>
            <select name="release_id">
                <option value="">All Releases</option>
                <?php foreach ($allReleases as $r): ?>
                    <option value="<?= $r['id'] ?>" <?= $filters['release_id'] == $r['id'] ? 'selected' : '' ?>><?= e($r['version']) ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="wtl-filter-actions">
            <button type="submit" class="btn-sm btn-primary-sm">Filter</button>
            <a href="/admin/walkthrough-library" class="btn-sm btn-secondary-sm">Clear</a>
        </div>
    </form>

    <!-- Table -->
    <div class="wtl-table-wrap">
        <?php if (empty($releases)): ?>
            <div class="wtl-empty">
                <div style="font-size:32px;margin-bottom:12px">📋</div>
                No walkthrough records found. Walkthrough status is recorded on release detail pages.
            </div>
        <?php else: ?>
        <table class="wtl-table">
            <thead>
                <tr>
                    <th>Release</th>
                    <th>Status</th>
                    <th>CEO</th>
                    <th>Manager</th>
                    <th>Member</th>
                    <th>Admin</th>
                    <th>Release QA</th>
                    <th>Published</th>
                </tr>
            </thead>
            <tbody>
            <?php foreach ($releases as $rel): ?>
                <?php
                $publishedAt = $rel['published_at'] ? date('M j, Y', strtotime($rel['published_at'])) : ($rel['scheduled_at'] ? 'Scheduled' : '—');
                ?>
                <tr>
                    <td>
                        <a href="/admin/releases/<?= $rel['id'] ?>" class="wtl-release-link">
                            <span class="wtl-version"><?= e($rel['version']) ?></span>
                        </a>
                        <?php if ($rel['owner_name']): ?>
                            <div style="font-size:11px;color:#52525b;margin-top:2px">by <?= e($rel['owner_name']) ?></div>
                        <?php endif; ?>
                    </td>
                    <td>
                        <span class="wtl-status-dot wtl-status-dot--<?= e($rel['status']) ?>"></span>
                        <?= ucfirst($rel['status']) ?>
                    </td>
                    <?php foreach (['ceo','manager','member','admin','release_qa'] as $role): ?>
                        <?php $val = $rel["walkthrough_{$role}"]; ?>
                        <td style="text-align:center">
                            <?php if ($val): ?>
                                <span class="wtl-badge wtl-badge--<?= e($val) ?>"><?= strtoupper($val) ?></span>
                            <?php else: ?>
                                <span class="wtl-badge wtl-badge--pending">—</span>
                            <?php endif; ?>
                        </td>
                    <?php endforeach; ?>
                    <td style="color:#52525b;font-size:12px;white-space:nowrap"><?= $publishedAt ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php endif; ?>
    </div>
</div>
