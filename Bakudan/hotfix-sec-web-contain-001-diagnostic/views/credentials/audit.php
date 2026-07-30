<?php
$pageTitle   = $pageTitle   ?? 'Credential Audit Logs';
$currentPage = $currentPage ?? 'credentials-audit';

$actionLabels = [
    'credential_created'   => ['icon' => '✅', 'label' => 'Created',              'color' => '#4ade80'],
    'credential_updated'   => ['icon' => '✏️', 'label' => 'Updated',              'color' => '#60a5fa'],
    'password_viewed'      => ['icon' => '👁',  'label' => 'Password Viewed',      'color' => '#fbbf24'],
    'password_copied'      => ['icon' => '📋', 'label' => 'Password Copied',      'color' => '#fb923c'],
    'password_changed'     => ['icon' => '🔑', 'label' => 'Password Changed',     'color' => '#a78bfa'],
    'access_granted'       => ['icon' => '🔓', 'label' => 'Access Granted',       'color' => '#34d399'],
    'access_revoked'       => ['icon' => '🔒', 'label' => 'Access Revoked',       'color' => '#f87171'],
    'access_updated'       => ['icon' => '⚙️', 'label' => 'Access Updated',       'color' => '#60a5fa'],
    'credential_deleted'   => ['icon' => '🗑',  'label' => 'Deleted',              'color' => '#f87171'],
    'rotation_task_created'=> ['icon' => '🔄', 'label' => 'Rotation Task Created','color' => '#38bdf8'],
    'rotation_completed'   => ['icon' => '✅', 'label' => 'Rotation Completed',   'color' => '#4ade80'],
    'rotation_task_cancelled'=>['icon'=> '❌', 'label' => 'Rotation Cancelled',   'color' => '#71717a'],
];

ob_start();
?>
<style>
.audit-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px}
.audit-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;margin-bottom:20px}
.stat-card{background:#18181b;border:1px solid #27272a;border-radius:10px;padding:14px;text-align:center}
.stat-card__val{font-size:24px;font-weight:700;margin-bottom:2px}
.stat-card__lbl{font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.04em}

.audit-filters{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center}
.audit-filters input,.audit-filters select{background:#18181b;border:1px solid #27272a;color:#e4e4e7;border-radius:8px;padding:8px 12px;font-size:13px;outline:none}
.audit-filters input:focus,.audit-filters select:focus{border-color:#3b82f6}

.audit-table-wrap{background:#18181b;border:1px solid #27272a;border-radius:12px;overflow:hidden}
.audit-table{width:100%;border-collapse:collapse}
.audit-table th{background:#1c1c1f;padding:10px 14px;font-size:11px;color:#71717a;font-weight:600;text-transform:uppercase;letter-spacing:.05em;text-align:left;white-space:nowrap}
.audit-table td{padding:11px 14px;border-top:1px solid #27272a;font-size:12px;color:#d4d4d8;vertical-align:middle}
.audit-table tr:hover td{background:#1c1c1f}
.audit-table a{color:#60a5fa;text-decoration:none}
.audit-table a:hover{text-decoration:underline}

.action-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
.success-dot{color:#4ade80;font-size:10px}
.fail-dot{color:#f87171;font-size:10px}
.detail-toggle{background:none;border:none;color:#52525b;cursor:pointer;font-size:11px;padding:2px 6px}
.detail-toggle:hover{color:#a1a1aa}
.detail-json{background:#0f172a;border:1px solid #1e293b;border-radius:6px;padding:8px 10px;font-size:11px;color:#94a3b8;font-family:monospace;white-space:pre-wrap;margin-top:4px;display:none}
</style>

<div class="audit-header">
    <div>
        <h2 style="font-size:20px;font-weight:700;color:#f4f4f5;margin-bottom:4px">📋 Credential Audit Logs</h2>
        <div style="font-size:13px;color:#71717a">All sensitive credential actions are logged permanently</div>
    </div>
    <a href="<?= APP_URL ?>/security/credentials" style="font-size:13px;color:#60a5fa;text-decoration:none">← Back to Vault</a>
</div>

<!-- Stats (last 30 days) -->
<div class="audit-stats">
    <div class="stat-card">
        <div class="stat-card__val" style="color:#60a5fa"><?= (int)($auditStats['total_events'] ?? 0) ?></div>
        <div class="stat-card__lbl">Events (30d)</div>
    </div>
    <div class="stat-card">
        <div class="stat-card__val" style="color:#fbbf24"><?= (int)($auditStats['password_views'] ?? 0) ?></div>
        <div class="stat-card__lbl">Pwd Views</div>
    </div>
    <div class="stat-card">
        <div class="stat-card__val" style="color:#fb923c"><?= (int)($auditStats['password_copies'] ?? 0) ?></div>
        <div class="stat-card__lbl">Pwd Copies</div>
    </div>
    <div class="stat-card">
        <div class="stat-card__val" style="color:#4ade80"><?= (int)($auditStats['credentials_created'] ?? 0) ?></div>
        <div class="stat-card__lbl">Created</div>
    </div>
    <div class="stat-card">
        <div class="stat-card__val" style="color:#f87171"><?= (int)($auditStats['failed_actions'] ?? 0) ?></div>
        <div class="stat-card__lbl">Failed</div>
    </div>
</div>

<!-- Filters -->
<div class="audit-filters">
    <input type="text" id="auditSearch" placeholder="🔍 Search actor, credential…" style="flex:1;min-width:200px">
    <select id="auditActionFilter">
        <option value="">All Actions</option>
        <?php foreach ($actionTypes as $at): ?>
        <option value="<?= e($at['action']) ?>" <?= ($_GET['action'] ?? '') === $at['action'] ? 'selected' : '' ?>>
            <?= e($actionLabels[$at['action']]['label'] ?? $at['action']) ?> (<?= $at['cnt'] ?>)
        </option>
        <?php endforeach; ?>
    </select>
    <select id="auditSuccessFilter">
        <option value="">All Results</option>
        <option value="1">Success</option>
        <option value="0">Failed</option>
    </select>
    <div style="font-size:12px;color:#52525b">Showing <?= count($logs) ?> records</div>
</div>

<!-- Table -->
<div class="audit-table-wrap">
<?php if (empty($logs)): ?>
<div style="padding:40px;text-align:center;color:#52525b;font-size:13px">No audit events found</div>
<?php else: ?>
<table class="audit-table" id="auditTable">
    <thead>
        <tr>
            <th>Time</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Credential</th>
            <th>IP Address</th>
            <th>Result</th>
            <th>Details</th>
        </tr>
    </thead>
    <tbody>
    <?php foreach ($logs as $log):
        $al = $actionLabels[$log['action']] ?? ['icon' => '●', 'label' => $log['action'], 'color' => '#71717a'];
        $details = $log['details_json'] ? json_decode($log['details_json'], true) : null;
    ?>
    <tr class="audit-row"
        data-search="<?= strtolower(e($log['actor_name'] ?? '')) . ' ' . strtolower(e($log['credential_name'] ?? '')) ?>"
        data-action="<?= e($log['action']) ?>"
        data-success="<?= $log['success'] ? '1' : '0' ?>">
        <td style="white-space:nowrap;font-size:11px;color:#71717a">
            <?= date('M j, Y', strtotime($log['created_at'])) ?><br>
            <span style="color:#52525b"><?= date('g:ia', strtotime($log['created_at'])) ?></span>
        </td>
        <td>
            <div style="font-weight:600;color:#e4e4e7"><?= e($log['actor_name'] ?? 'Unknown') ?></div>
        </td>
        <td>
            <span class="action-badge" style="background:<?= $al['color'] ?>18;color:<?= $al['color'] ?>;border:1px solid <?= $al['color'] ?>30">
                <?= $al['icon'] ?> <?= $al['label'] ?>
            </span>
        </td>
        <td>
            <?php if ($log['credential_id'] && $log['credential_name']): ?>
            <a href="<?= APP_URL ?>/security/credentials/<?= $log['credential_id'] ?>"><?= e($log['credential_name']) ?></a>
            <?php else: ?>
            <span style="color:#52525b">—</span>
            <?php endif; ?>
        </td>
        <td style="font-family:monospace;font-size:11px;color:#71717a"><?= e($log['ip_address'] ?? '—') ?></td>
        <td>
            <?php if ($log['success']): ?>
            <span class="success-dot">✅</span>
            <?php else: ?>
            <span class="fail-dot">❌ Failed</span>
            <?php endif; ?>
        </td>
        <td>
            <?php if ($details): ?>
            <button class="detail-toggle" onclick="toggleDetails(this)">Details ▾</button>
            <div class="detail-json"><?= e(json_encode($details, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) ?></div>
            <?php else: ?>
            <span style="color:#3f3f46">—</span>
            <?php endif; ?>
        </td>
    </tr>
    <?php endforeach; ?>
    </tbody>
</table>
<?php endif; ?>
</div>

<!-- Pagination hint -->
<?php if (count($logs) >= ($limit ?? 100)): ?>
<div style="text-align:center;margin-top:16px;font-size:12px;color:#52525b">
    Showing first <?= count($logs) ?> records.
    <a href="?offset=<?= ($offset ?? 0) + count($logs) ?>&limit=<?= $limit ?>" style="color:#60a5fa">Load next →</a>
</div>
<?php endif; ?>

<script>
function toggleDetails(btn) {
    var detail = btn.nextElementSibling;
    var visible = detail.style.display !== 'none' && detail.style.display !== '';
    detail.style.display = visible ? 'none' : 'block';
    btn.textContent = visible ? 'Details ▾' : 'Details ▴';
}

(function(){
    var searchEl = document.getElementById('auditSearch');
    var actionEl = document.getElementById('auditActionFilter');
    var successEl = document.getElementById('auditSuccessFilter');
    function filter() {
        var q = searchEl.value.toLowerCase();
        var a = actionEl.value;
        var s = successEl.value;
        document.querySelectorAll('.audit-row').forEach(function(row) {
            var mQ = !q || row.dataset.search.includes(q);
            var mA = !a || row.dataset.action === a;
            var mS = s === '' || row.dataset.success === s;
            row.style.display = (mQ && mA && mS) ? '' : 'none';
        });
    }
    if (searchEl) searchEl.addEventListener('input', filter);
    if (actionEl) actionEl.addEventListener('change', function(){
        var v = this.value;
        var url = new URL(window.location.href);
        if (v) url.searchParams.set('action', v);
        else url.searchParams.delete('action');
        window.location.href = url.toString();
    });
    if (successEl) successEl.addEventListener('change', filter);
})();
</script>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
