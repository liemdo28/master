<?php
$pageTitle  = 'Penalty Center';
$currentPage = 'admin-penalties';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtAmt($amount, $cur) { return Penalty::format($amount, $cur); }
function riskBadge(int $score): string {
    return match($score) {
        3 => '<span class="badge" style="background:rgba(255,23,68,.18);color:#ff1744;border:1px solid rgba(255,23,68,.35)">High Risk</span>',
        2 => '<span class="badge" style="background:rgba(255,160,0,.18);color:#ffa000;border:1px solid rgba(255,160,0,.35)">Med Risk</span>',
        1 => '<span class="badge" style="background:rgba(33,150,243,.12);color:#64b5f6;border:1px solid rgba(33,150,243,.25)">Low Risk</span>',
        default => '',
    };
}
function colAmt($vnd, $usd) {
    $parts = [];
    if ($vnd > 0) $parts[] = '<span style="color:#e3e3e3">'.fmtAmt($vnd,'VND').'</span>';
    if ($usd > 0) $parts[] = '<span style="color:#69e069">'.fmtAmt($usd,'USD').'</span>';
    return $parts ? implode('<br>', $parts) : '—';
}

// Active tab
$tab = $_GET['tab'] ?? 'log';
// Build query string without tab for filter links
$qsCurrent = http_build_query(array_filter(array_merge($_GET, ['tab' => $tab])));
// Period label
$periodLabels = ['today'=>'Today','week'=>'This Week','month'=>'This Month','year'=>'This Year','custom'=>'Custom'];
$curPeriod = $periodLabels[$filters['period']] ?? 'This Month';

ob_start();
?>

<style>
.penalty-kpi { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:22px }
.penalty-kpi-card { background:var(--bg-card); border:1px solid var(--border); border-radius:14px; padding:18px 20px }
.penalty-kpi-card .label { font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--text-muted); margin-bottom:6px }
.penalty-kpi-card .val { font-size:22px; font-weight:800; letter-spacing:-.04em; color:var(--text); line-height:1.1 }
.penalty-kpi-card .sub { font-size:12px; color:var(--text-muted); margin-top:4px }
.penalty-tabs { display:flex; gap:4px; margin-bottom:18px; border-bottom:1px solid var(--border); padding-bottom:0 }
.penalty-tab { padding:8px 18px; font-size:13px; font-weight:600; color:var(--text-muted); text-decoration:none; border-bottom:2px solid transparent; margin-bottom:-1px; transition:.15s }
.penalty-tab.active { color:var(--text); border-color:var(--accent) }
.penalty-tab:hover { color:var(--text) }
.filter-bar { background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:14px 16px; margin-bottom:18px; display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end }
.filter-bar select, .filter-bar input { background:var(--bg-secondary); border:1px solid var(--border); border-radius:8px; color:var(--text); padding:7px 11px; font-size:13px }
.filter-bar label { font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--text-muted); display:block; margin-bottom:4px }
.analytics-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:18px }
.analytics-table { width:100%; border-collapse:collapse }
.analytics-table th { text-align:left; padding:8px 12px; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--text-muted); border-bottom:1px solid var(--border) }
.analytics-table td { padding:10px 12px; font-size:13px; border-bottom:1px solid rgba(255,255,255,.04); vertical-align:middle }
.analytics-table tr:last-child td { border:0 }
.risk-bar { height:5px; border-radius:3px; background:var(--bg-tertiary); position:relative; min-width:60px }
.risk-bar-fill { height:100%; border-radius:3px; background:linear-gradient(90deg,#ff304f,#ff6b35); transition:width .4s }
.config-panel { background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:18px; margin-bottom:18px }
.sort-link { color:var(--text-muted); text-decoration:none; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; display:flex; align-items:center; gap:4px }
.sort-link:hover { color:var(--text) }
.sort-link.active { color:var(--accent) }
.penalty-amount-cell { font-weight:700; font-family:'Space Grotesk','Inter',sans-serif }
@media(max-width:900px) {
    .penalty-kpi { grid-template-columns:repeat(2,1fr) }
    .analytics-grid { grid-template-columns:1fr }
}
@media(max-width:600px) {
    .penalty-kpi { grid-template-columns:1fr }
}
</style>

<!-- ── KPI Strip ──────────────────────────────────────────────────────────── -->
<div class="penalty-kpi">
    <div class="penalty-kpi-card">
        <div class="label">Today</div>
        <div class="val"><?= (int)($summary['today']['cnt'] ?? 0) ?></div>
        <div class="sub"><?= colAmt($summary['today']['vnd']??0, $summary['today']['usd']??0) ?: 'No penalties' ?></div>
    </div>
    <div class="penalty-kpi-card">
        <div class="label">This Week</div>
        <div class="val"><?= (int)($summary['week']['cnt'] ?? 0) ?></div>
        <div class="sub"><?= colAmt($summary['week']['vnd']??0, $summary['week']['usd']??0) ?: 'No penalties' ?></div>
    </div>
    <div class="penalty-kpi-card">
        <div class="label">This Month</div>
        <div class="val"><?= (int)($summary['month']['cnt'] ?? 0) ?></div>
        <div class="sub"><?= colAmt($summary['month']['vnd']??0, $summary['month']['usd']??0) ?: 'No penalties' ?></div>
    </div>
    <div class="penalty-kpi-card" style="border-color:rgba(255,48,79,.3)">
        <div class="label" style="color:#ff6b89">Top Offender (Month)</div>
        <?php if ($summary['top_user']): ?>
        <div class="val" style="font-size:16px"><?= e($summary['top_user']['name']) ?></div>
        <div class="sub"><?= (int)$summary['top_user']['cnt'] ?> penalties this month</div>
        <?php else: ?>
        <div class="val" style="font-size:16px;color:var(--text-muted)">—</div>
        <div class="sub">No data</div>
        <?php endif; ?>
    </div>
</div>

<!-- ── Config Panel ──────────────────────────────────────────────────────── -->
<details class="config-panel" <?= flash('success') || flash('error') ? 'open' : '' ?>>
    <summary style="cursor:pointer;font-weight:700;font-size:13px;list-style:none;display:flex;align-items:center;gap:8px">
        <?= tf_icon('settings', 16) ?> Penalty Config
        <span style="margin-left:auto;font-size:12px;font-weight:400;color:var(--text-muted)">
            Current: <?= e(Penalty::format($config['penalty_amount'], $config['currency'])) ?> per overdue task
        </span>
    </summary>
    <div style="margin-top:14px">
        <?php if ($msg = flash('success')): ?><div class="alert alert-success" style="margin-bottom:12px"><?= e($msg) ?></div><?php endif; ?>
        <?php if ($msg = flash('error')): ?><div class="alert alert-error" style="margin-bottom:12px"><?= e($msg) ?></div><?php endif; ?>
        <form method="POST" action="<?= APP_URL ?>/admin/penalties/config" style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <div>
                <label style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);display:block;margin-bottom:6px">Amount</label>
                <input type="number" name="penalty_amount" value="<?= e($config['penalty_amount']) ?>" min="1" step="0.01"
                       class="form-control" style="width:160px" required>
            </div>
            <div>
                <label style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);display:block;margin-bottom:6px">Currency</label>
                <select name="currency" class="form-control" style="width:100px">
                    <option value="VND" <?= $config['currency']==='VND'?'selected':'' ?>>VND</option>
                    <option value="USD" <?= $config['currency']==='USD'?'selected':'' ?>>USD</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Save Config</button>
        </form>
    </div>
</details>

<!-- ── Filter Bar ────────────────────────────────────────────────────────── -->
<form method="GET" action="<?= APP_URL ?>/admin/penalties" class="filter-bar">
    <input type="hidden" name="tab" value="<?= e($tab) ?>">
    <div>
        <label>Period</label>
        <select name="period" onchange="this.form.submit()">
            <?php foreach ($periodLabels as $v => $l): ?>
            <option value="<?= $v ?>" <?= $filters['period']===$v?'selected':'' ?>><?= $l ?></option>
            <?php endforeach; ?>
        </select>
    </div>
    <?php if ($filters['period'] === 'custom'): ?>
    <div>
        <label>From</label>
        <input type="date" name="date_from" value="<?= e($filters['date_from']) ?>">
    </div>
    <div>
        <label>To</label>
        <input type="date" name="date_to" value="<?= e($filters['date_to']) ?>">
    </div>
    <?php endif; ?>
    <div>
        <label>Currency</label>
        <select name="currency">
            <option value="">All</option>
            <option value="VND" <?= $filters['currency']==='VND'?'selected':'' ?>>VND</option>
            <option value="USD" <?= $filters['currency']==='USD'?'selected':'' ?>>USD</option>
        </select>
    </div>
    <div>
        <label>Store</label>
        <select name="store_id">
            <option value="">All Stores</option>
            <?php foreach ($allStores as $st): ?>
            <option value="<?= $st['id'] ?>" <?= $filters['store_id']==$st['id']?'selected':'' ?>><?= e($st['name']) ?></option>
            <?php endforeach; ?>
        </select>
    </div>
    <div>
        <label>Project</label>
        <select name="project_id">
            <option value="">All Projects</option>
            <?php foreach ($allProjects as $pr): ?>
            <option value="<?= $pr['id'] ?>" <?= $filters['project_id']==$pr['id']?'selected':'' ?>><?= e($pr['name']) ?></option>
            <?php endforeach; ?>
        </select>
    </div>
    <div>
        <label>User</label>
        <select name="user_id">
            <option value="">All Users</option>
            <?php foreach ($allUsers as $u): ?>
            <option value="<?= $u['id'] ?>" <?= $filters['user_id']==$u['id']?'selected':'' ?>><?= e($u['name']) ?></option>
            <?php endforeach; ?>
        </select>
    </div>
    <div>
        <label>Min Overdue Days</label>
        <input type="number" name="min_days" value="<?= e($filters['min_days']) ?>" min="1" style="width:80px" placeholder="Any">
    </div>
    <div>
        <label>Search</label>
        <input type="text" name="search" value="<?= e($filters['search']) ?>" placeholder="Task / user / store…" style="width:160px">
    </div>
    <div style="display:flex;gap:8px">
        <button type="submit" class="btn btn-primary btn-sm"><?= tf_icon('filter',14) ?> Filter</button>
        <a href="<?= APP_URL ?>/admin/penalties" class="btn btn-secondary btn-sm">Reset</a>
        <a href="<?= APP_URL ?>/admin/penalties/export?<?= $qsCurrent ?>" class="btn btn-secondary btn-sm"><?= tf_icon('download',14) ?> CSV</a>
    </div>
</form>

<!-- ── Tabs ──────────────────────────────────────────────────────────────── -->
<div class="penalty-tabs">
    <a href="?<?= http_build_query(array_merge($_GET, ['tab'=>'log'])) ?>" class="penalty-tab <?= $tab==='log'?'active':'' ?>">Penalty Log</a>
    <a href="?<?= http_build_query(array_merge($_GET, ['tab'=>'user'])) ?>" class="penalty-tab <?= $tab==='user'?'active':'' ?>">By User</a>
    <a href="?<?= http_build_query(array_merge($_GET, ['tab'=>'project'])) ?>" class="penalty-tab <?= $tab==='project'?'active':'' ?>">By Project</a>
    <a href="?<?= http_build_query(array_merge($_GET, ['tab'=>'store'])) ?>" class="penalty-tab <?= $tab==='store'?'active':'' ?>">By Store</a>
</div>

<?php if ($tab === 'log'): ?>
<!-- ── Penalty Log ───────────────────────────────────────────────────────── -->
<?php
function sortLink($label, $col, $filters, $url) {
    $active  = ($filters['sort'] === $col);
    $newDir  = ($active && $filters['dir'] === 'asc') ? 'desc' : 'asc';
    $arrow   = $active ? ($filters['dir'] === 'asc' ? '↑' : '↓') : '↕';
    $qs      = http_build_query(array_merge($_GET, ['sort' => $col, 'dir' => $newDir, 'page' => 1]));
    return "<a href=\"{$url}/admin/penalties?{$qs}\" class=\"sort-link ".($active?'active':'')."\">$label <span>$arrow</span></a>";
}
?>
<div class="card" style="overflow:hidden">
    <div class="card-header" style="padding:14px 18px">
        <span style="font-size:13px;color:var(--text-muted)"><?= $total ?> penalties · <?= $curPeriod ?></span>
    </div>
    <?php if (empty($penalties)): ?>
    <div class="empty-state"><?= tf_icon('check-circle',40) ?><h3>No penalties</h3><p>No overdue penalties match the current filters.</p></div>
    <?php else: ?>
    <div style="overflow-x:auto">
    <table class="data-table" style="min-width:900px">
        <thead>
        <tr>
            <th><?= sortLink('Date', 'created_at', $filters, APP_URL) ?></th>
            <th><?= sortLink('User', 'user', $filters, APP_URL) ?></th>
            <th><?= sortLink('Store', 'store', $filters, APP_URL) ?></th>
            <th>Project</th>
            <th>Task</th>
            <th><?= sortLink('Overdue', 'overdue_days', $filters, APP_URL) ?></th>
            <th><?= sortLink('Amount', 'penalty_amount', $filters, APP_URL) ?></th>
            <th>Reason</th>
        </tr>
        </thead>
        <tbody>
        <?php foreach ($penalties as $p):
            $isHighRisk = $p['overdue_days'] >= 7;
        ?>
        <tr data-dd-inline data-dd-title="<?= e($p['task_title'] ?? 'Penalty') ?>" data-dd-key="penalty-<?= (int)($p['id'] ?? 0) ?>" <?= $isHighRisk ? 'style="background:rgba(255,23,68,.04)"' : '' ?>>
            <td class="text-sm text-muted"><?= date('d/m/Y', strtotime($p['created_at'])) ?></td>
            <td>
                <div style="font-weight:600"><?= e($p['user_name'] ?? '—') ?></div>
            </td>
            <td class="text-sm"><?= e($p['store_name'] ?? '—') ?></td>
            <td class="text-sm"><?= e($p['project_name'] ?? '—') ?></td>
            <td>
                <?php if ($p['task_id']): ?>
                <a href="<?= APP_URL ?>/tasks/<?= $p['task_id'] ?>" data-detail-drawer style="color:var(--text);text-decoration:none;font-size:13px" class="hover-accent">
                    <?= e(mb_strimwidth($p['task_title'] ?? '', 0, 40, '…')) ?>
                </a>
                <?php else: ?>
                <span class="text-muted text-sm">—</span>
                <?php endif; ?>
            </td>
            <td>
                <span class="badge" style="background:<?= $isHighRisk ? 'rgba(255,23,68,.15);color:#ff5252' : 'rgba(255,152,0,.12);color:#ffb74d' ?>;border:1px solid <?= $isHighRisk ? 'rgba(255,23,68,.3)' : 'rgba(255,152,0,.3)' ?>">
                    <?= $p['overdue_days'] ?>d
                </span>
            </td>
            <td class="penalty-amount-cell"><?= e(fmtAmt($p['penalty_amount'], $p['penalty_currency'])) ?></td>
            <td class="text-sm text-muted"><?= e($p['reason']) ?></td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    </div>
    <?php if ($totalPages > 1): ?>
    <div style="display:flex;justify-content:center;align-items:center;gap:12px;padding:16px;border-top:1px solid var(--border)">
        <?php if ($page > 1): ?>
        <a href="?<?= http_build_query(array_merge($_GET, ['page' => $page - 1])) ?>" class="btn btn-secondary btn-sm">← Prev</a>
        <?php endif; ?>
        <span style="font-size:13px;color:var(--text-muted)"><?= $page ?> / <?= $totalPages ?></span>
        <?php if ($page < $totalPages): ?>
        <a href="?<?= http_build_query(array_merge($_GET, ['page' => $page + 1])) ?>" class="btn btn-secondary btn-sm">Next →</a>
        <?php endif; ?>
    </div>
    <?php endif; ?>
    <?php endif; ?>
</div>

<?php elseif ($tab === 'user'): ?>
<!-- ── By User ───────────────────────────────────────────────────────────── -->
<div class="card">
    <div class="card-header"><h3>Penalty by User · <?= $curPeriod ?></h3></div>
    <?php if (empty($byUser)): ?>
    <div class="empty-state"><?= tf_icon('users',40) ?><h3>No data</h3></div>
    <?php else:
        $maxCount = max(array_column($byUser, 'penalty_count'));
    ?>
    <table class="analytics-table">
        <thead><tr><th>User</th><th>Penalties</th><th>VND Total</th><th>USD Total</th><th>Max Overdue</th><th>Risk</th><th>Last</th></tr></thead>
        <tbody>
        <?php foreach ($byUser as $row):
            $risk = new Penalty();
            $rs   = $risk->getUserRiskScore((int)$row['id']);
            $pct  = $maxCount > 0 ? round($row['penalty_count'] / $maxCount * 100) : 0;
        ?>
        <tr>
            <td>
                <div style="display:flex;align-items:center;gap:10px">
                    <div class="user-avatar" style="width:28px;height:28px;font-size:11px"><?= strtoupper(substr($row['name'],0,1)) ?></div>
                    <span style="font-weight:600"><?= e($row['name']) ?></span>
                </div>
            </td>
            <td>
                <div style="display:flex;align-items:center;gap:10px">
                    <strong><?= $row['penalty_count'] ?></strong>
                    <div class="risk-bar" style="width:80px"><div class="risk-bar-fill" style="width:<?= $pct ?>%"></div></div>
                </div>
            </td>
            <td class="penalty-amount-cell"><?= $row['total_vnd'] > 0 ? e(fmtAmt($row['total_vnd'],'VND')) : '—' ?></td>
            <td class="penalty-amount-cell" style="color:var(--green)"><?= $row['total_usd'] > 0 ? e(fmtAmt($row['total_usd'],'USD')) : '—' ?></td>
            <td><span class="badge badge-<?= $row['max_overdue']>=7?'overdue':'pending' ?>"><?= $row['max_overdue'] ?>d</span></td>
            <td><?= riskBadge($rs) ?></td>
            <td class="text-sm text-muted"><?= $row['last_penalty_at'] ? date('d/m/Y', strtotime($row['last_penalty_at'])) : '—' ?></td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php endif; ?>
</div>

<?php elseif ($tab === 'project'): ?>
<!-- ── By Project ────────────────────────────────────────────────────────── -->
<div class="card">
    <div class="card-header"><h3>Penalty by Project · <?= $curPeriod ?></h3></div>
    <?php if (empty($byProject)): ?>
    <div class="empty-state"><?= tf_icon('folder',40) ?><h3>No data</h3></div>
    <?php else:
        $maxCount = max(array_column($byProject, 'penalty_count'));
    ?>
    <table class="analytics-table">
        <thead><tr><th>Project</th><th>Penalties</th><th>VND Total</th><th>USD Total</th></tr></thead>
        <tbody>
        <?php foreach ($byProject as $row):
            $pct = $maxCount > 0 ? round($row['penalty_count'] / $maxCount * 100) : 0;
        ?>
        <tr>
            <td>
                <div style="display:flex;align-items:center;gap:10px">
                    <div style="width:10px;height:10px;border-radius:50%;background:<?= e($row['color'] ?? '#666') ?>"></div>
                    <span style="font-weight:600"><?= e($row['name']) ?></span>
                </div>
            </td>
            <td>
                <div style="display:flex;align-items:center;gap:10px">
                    <strong><?= $row['penalty_count'] ?></strong>
                    <div class="risk-bar" style="width:80px"><div class="risk-bar-fill" style="width:<?= $pct ?>%"></div></div>
                </div>
            </td>
            <td class="penalty-amount-cell"><?= $row['total_vnd'] > 0 ? e(fmtAmt($row['total_vnd'],'VND')) : '—' ?></td>
            <td class="penalty-amount-cell" style="color:var(--green)"><?= $row['total_usd'] > 0 ? e(fmtAmt($row['total_usd'],'USD')) : '—' ?></td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php endif; ?>
</div>

<?php elseif ($tab === 'store'): ?>
<!-- ── By Store ──────────────────────────────────────────────────────────── -->
<div class="card">
    <div class="card-header"><h3>Penalty by Store · <?= $curPeriod ?></h3></div>
    <?php if (empty($byStore)): ?>
    <div class="empty-state"><?= tf_icon('store',40) ?><h3>No data</h3></div>
    <?php else:
        $maxCount = max(array_column($byStore, 'penalty_count'));
    ?>
    <table class="analytics-table">
        <thead><tr><th>Store</th><th>Penalties</th><th>VND Total</th><th>USD Total</th></tr></thead>
        <tbody>
        <?php foreach ($byStore as $row):
            $pct = $maxCount > 0 ? round($row['penalty_count'] / $maxCount * 100) : 0;
            $execHealth = $row['penalty_count'] >= 5 ? 'Declining' : ($row['penalty_count'] >= 3 ? 'Watch' : 'OK');
            $healthColor = $row['penalty_count'] >= 5 ? '#ff5252' : ($row['penalty_count'] >= 3 ? '#ffa000' : '#69e069');
        ?>
        <tr>
            <td>
                <div style="display:flex;align-items:center;gap:10px">
                    <div style="width:10px;height:10px;border-radius:50%;background:<?= e($row['color'] ?? '#666') ?>"></div>
                    <span style="font-weight:600"><?= e($row['name']) ?></span>
                </div>
            </td>
            <td>
                <div style="display:flex;align-items:center;gap:10px">
                    <strong><?= $row['penalty_count'] ?></strong>
                    <div class="risk-bar" style="width:80px"><div class="risk-bar-fill" style="width:<?= $pct ?>%"></div></div>
                </div>
                <div style="font-size:11px;color:<?= $healthColor ?>;margin-top:2px">Execution: <?= $execHealth ?></div>
            </td>
            <td class="penalty-amount-cell"><?= $row['total_vnd'] > 0 ? e(fmtAmt($row['total_vnd'],'VND')) : '—' ?></td>
            <td class="penalty-amount-cell" style="color:var(--green)"><?= $row['total_usd'] > 0 ? e(fmtAmt($row['total_usd'],'USD')) : '—' ?></td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php endif; ?>
</div>

<?php endif; ?>

<?php
$content = ob_get_clean();
require __DIR__ . '/../../layouts/main.php';
