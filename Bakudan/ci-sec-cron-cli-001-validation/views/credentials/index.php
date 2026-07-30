<?php
$pageTitle   = $pageTitle   ?? 'Credential Library';
$currentPage = $currentPage ?? 'credentials';
$user        = currentUser();

$typeInfo = [
    'login'    => ['icon' => '🔑', 'label' => 'Login',    'color' => '#60a5fa', 'bg' => 'rgba(96,165,250,.12)'],
    'card'     => ['icon' => '💳', 'label' => 'Card',     'color' => '#a78bfa', 'bg' => 'rgba(167,139,250,.12)'],
    'identity' => ['icon' => '🪪', 'label' => 'ID',       'color' => '#34d399', 'bg' => 'rgba(52,211,153,.12)'],
    'link'     => ['icon' => '🔗', 'label' => 'Link',     'color' => '#fb923c', 'bg' => 'rgba(251,146,60,.12)'],
];

// Group by store
$grouped = ['__general__' => []];
$storeMap = [];
foreach ($stores as $s) $storeMap[(int)$s['id']] = $s['name'];

foreach ($credentials as $c) {
    $sid = $c['store_id'] ? (int)$c['store_id'] : null;
    if ($sid && isset($storeMap[$sid])) {
        $grouped[$sid][] = $c;
    } else {
        $grouped['__general__'][] = $c;
    }
}

// Sort: real stores first (alpha by name), General last
$sortedGroups = [];
$storesSorted = $stores; // already ordered by name from controller
foreach ($storesSorted as $s) {
    $sid = (int)$s['id'];
    if (!empty($grouped[$sid])) $sortedGroups[$sid] = $grouped[$sid];
}
if (!empty($grouped['__general__'])) $sortedGroups['__general__'] = $grouped['__general__'];

ob_start();
?>
<style>
.lib-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px}
.lib-title{font-size:22px;font-weight:700;color:#f4f4f5;display:flex;align-items:center;gap:10px}
.lib-stats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px}
.lib-stat{background:#18181b;border:1px solid #27272a;border-radius:10px;padding:10px 18px;display:flex;flex-direction:column;align-items:center;min-width:80px}
.lib-stat__val{font-size:22px;font-weight:700}
.lib-stat__lbl{font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:.06em;margin-top:2px}
.ls-total .lib-stat__val{color:#a1a1aa}
.ls-login .lib-stat__val{color:#60a5fa}
.ls-card  .lib-stat__val{color:#a78bfa}
.ls-id    .lib-stat__val{color:#34d399}
.ls-link  .lib-stat__val{color:#fb923c}

.lib-search{display:flex;gap:8px;margin-bottom:22px;flex-wrap:wrap}
.lib-search input,.lib-search select{background:#18181b;border:1px solid #27272a;color:#e4e4e7;border-radius:8px;padding:8px 12px;font-size:13px;outline:none}
.lib-search input:focus,.lib-search select:focus{border-color:#3b82f6}
.lib-search input{flex:1;min-width:200px}

.store-section{margin-bottom:28px}
.store-section-header{display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #27272a}
.store-section-title{font-size:12px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:.08em}
.store-section-count{font-size:11px;background:#27272a;color:#71717a;border-radius:20px;padding:2px 8px}

.cred-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px}
@media(max-width:600px){.cred-grid{grid-template-columns:1fr}}

.cred-card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px;transition:border-color .15s}
.cred-card:hover{border-color:#3f3f46}
.cred-card.s-compromised{border-color:rgba(248,113,113,.4)}
.cred-card.s-inactive{opacity:.6}

.cred-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.cred-icon{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.cred-name{font-size:14px;font-weight:600;color:#f4f4f5;line-height:1.3}
.cred-url{font-size:11px;color:#52525b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px;margin-top:2px}
.type-pill{font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap;flex-shrink:0}

.cred-meta{display:flex;flex-direction:column;gap:4px}
.meta-row{display:flex;align-items:center;gap:6px;font-size:12px;color:#71717a}
.meta-val{color:#a1a1aa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px}

.cred-footer{display:flex;align-items:center;justify-content:space-between;padding-top:8px;border-top:1px solid #27272a;margin-top:auto}
.status-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.dot-active{background:#4ade80}.dot-inactive{background:#52525b}.dot-compromised{background:#f87171}

.btn-micro{padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid #27272a;background:transparent;color:#a1a1aa;text-decoration:none;display:inline-flex;align-items:center;gap:3px}
.btn-micro:hover{background:#27272a;color:#f4f4f5}
.btn-micro-blue{border-color:#2563eb;background:rgba(37,99,235,.12);color:#60a5fa}
.btn-micro-blue:hover{background:rgba(37,99,235,.25)}

.compromised-banner{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);border-radius:10px;padding:10px 16px;color:#f87171;font-size:12px;display:flex;align-items:center;gap:8px;margin-bottom:16px}
.lib-empty{padding:80px 20px;text-align:center;color:#52525b}
</style>

<?php if ($msg = flash('success')): ?><div class="alert alert-success"><?= e($msg) ?></div><?php endif; ?>
<?php if ($msg = flash('error')): ?><div class="alert alert-error"><?= e($msg) ?></div><?php endif; ?>

<div class="lib-header">
    <div class="lib-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M19 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2z"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Credential Library
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
        <?php if (canAdmin()): ?>
        <a href="<?= APP_URL ?>/security/credentials/create" class="btn btn-primary" style="font-size:13px">+ Add</a>
        <a href="<?= APP_URL ?>/security/rotation" class="btn btn-secondary" style="font-size:13px">Rotation</a>
        <a href="<?= APP_URL ?>/security/audit-logs" class="btn btn-ghost" style="font-size:13px">Audit Log</a>
        <?php endif; ?>
    </div>
</div>

<?php
$byType = ['login'=>0,'card'=>0,'identity'=>0,'link'=>0];
$compromisedCount = 0;
foreach ($credentials as $c) {
    $t = $c['credential_type'] ?? 'login';
    if (isset($byType[$t])) $byType[$t]++;
    if (($c['status']??'') === 'compromised') $compromisedCount++;
}
?>
<div class="lib-stats">
    <div class="lib-stat ls-total"><div class="lib-stat__val"><?= count($credentials) ?></div><div class="lib-stat__lbl">Total</div></div>
    <div class="lib-stat ls-login"><div class="lib-stat__val"><?= $byType['login'] ?></div><div class="lib-stat__lbl">Login</div></div>
    <div class="lib-stat ls-card"><div class="lib-stat__val"><?= $byType['card'] ?></div><div class="lib-stat__lbl">Card</div></div>
    <div class="lib-stat ls-id"><div class="lib-stat__val"><?= $byType['identity'] ?></div><div class="lib-stat__lbl">ID Doc</div></div>
    <div class="lib-stat ls-link"><div class="lib-stat__val"><?= $byType['link'] ?></div><div class="lib-stat__lbl">Link</div></div>
</div>

<?php if ($compromisedCount > 0): ?>
<div class="compromised-banner">⚠️ <strong><?= $compromisedCount ?> credential<?= $compromisedCount>1?'s':'' ?> COMPROMISED</strong> — immediate action required.</div>
<?php endif; ?>

<div class="lib-search">
    <input type="text" id="libSearch" placeholder="🔍 Search name, username, email…">
    <select id="libTypeFilter">
        <option value="">All Types</option>
        <option value="login">🔑 Login</option>
        <option value="card">💳 Card</option>
        <option value="identity">🪪 ID Document</option>
        <option value="link">🔗 Link</option>
    </select>
    <select id="libStatusFilter">
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="compromised">Compromised</option>
    </select>
</div>

<?php if (empty($credentials)): ?>
<div class="lib-empty">
    <div style="font-size:48px;margin-bottom:12px">🔒</div>
    <p style="font-size:16px;color:#71717a;font-weight:600;margin:0">No credentials</p>
    <?php if (canAdmin()): ?>
    <p style="margin-top:8px"><a href="<?= APP_URL ?>/security/credentials/create" style="color:#60a5fa;font-size:13px">Add the first credential</a></p>
    <?php else: ?>
    <p style="font-size:13px;color:#52525b;margin-top:8px">Ask an admin to grant you access.</p>
    <?php endif; ?>
</div>
<?php else: ?>

<div id="libContainer">
<?php foreach ($sortedGroups as $groupKey => $groupCreds):
    $groupName = $groupKey === '__general__' ? 'General' : ($storeMap[$groupKey] ?? 'Unknown');
    $groupIcon = $groupKey === '__general__' ? '🗂️' : '🏪';
?>
<div class="store-section" data-group="<?= e($groupName) ?>">
    <div class="store-section-header">
        <?= $groupIcon ?>
        <span class="store-section-title"><?= e($groupName) ?></span>
        <span class="store-section-count"><?= count($groupCreds) ?></span>
    </div>
    <div class="cred-grid">
    <?php foreach ($groupCreds as $c):
        $ctype  = $c['credential_type'] ?? 'login';
        $tm     = $typeInfo[$ctype] ?? $typeInfo['login'];
        $url    = $c['login_url'] ?: ($c['website'] ?? '');
        $status = $c['status'] ?? 'active';
        $dot    = match($status){'active'=>'dot-active','inactive'=>'dot-inactive',default=>'dot-compromised'};
        $cc     = match($status){'compromised'=>' s-compromised','inactive'=>' s-inactive',default=>''};
    ?>
    <div class="cred-card<?= $cc ?>"
         data-name="<?= strtolower(e($c['service_name'])) ?>"
         data-user="<?= strtolower(e($c['username']??'')).' '.strtolower(e($c['email']??'')) ?>"
         data-type="<?= e($ctype) ?>"
         data-status="<?= e($status) ?>">

        <div class="cred-card-top">
            <div style="display:flex;align-items:center;gap:10px;min-width:0">
                <div class="cred-icon" style="background:<?= $tm['bg'] ?>"><?= $tm['icon'] ?></div>
                <div style="min-width:0">
                    <div class="cred-name"><?= e($c['service_name']) ?></div>
                    <?php if ($url): ?>
                    <div class="cred-url" title="<?= e($url) ?>"><?= e(preg_replace('#^https?://#','', $url)) ?></div>
                    <?php endif; ?>
                </div>
            </div>
            <span class="type-pill" style="background:<?= $tm['bg'] ?>;color:<?= $tm['color'] ?>"><?= $tm['label'] ?></span>
        </div>

        <div class="cred-meta">
            <?php if ($c['username'] || $c['email']): ?>
            <div class="meta-row">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"/><path d="M5.5 20a8.38 8.38 0 0 1 13 0"/></svg>
                <span class="meta-val"><?= e($c['username'] ?: $c['email']) ?></span>
            </div>
            <?php endif; ?>
            <?php if (!empty($c['encrypted_password'])): ?>
            <div class="meta-row">
                <svg width="12" height="12" fill="none" stroke="#4ade80" stroke-width="2" viewBox="0 0 24 24"><path d="M19 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2z"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span style="font-size:11px;color:#4ade80">Password encrypted ✓</span>
            </div>
            <?php endif; ?>
            <?php if (!empty($c['owner_name'])): ?>
            <div class="meta-row">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"/><path d="M5.5 20a8.38 8.38 0 0 1 13 0"/></svg>
                <span class="meta-val"><?= e($c['owner_name']) ?></span>
            </div>
            <?php endif; ?>
        </div>

        <div class="cred-footer">
            <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#52525b">
                <div class="status-dot <?= $dot ?>"></div>
                <?= ucfirst($status) ?>
                <?php if ($status==='compromised'): ?><span style="color:#f87171;font-weight:700">⚠️</span><?php endif; ?>
            </div>
            <div style="display:flex;gap:6px">
                <a href="<?= APP_URL ?>/security/credentials/<?= $c['id'] ?>" class="btn-micro btn-micro-blue">View</a>
                <?php if (canAdmin()): ?>
                <a href="<?= APP_URL ?>/security/credentials/<?= $c['id'] ?>/edit" class="btn-micro">Edit</a>
                <?php endif; ?>
            </div>
        </div>
    </div>
    <?php endforeach; ?>
    </div>
</div>
<?php endforeach; ?>
</div>

<div id="libNoResults" style="display:none" class="lib-empty">
    <div style="font-size:36px;margin-bottom:8px">🔍</div>
    <p style="color:#71717a">No credentials match your filter.</p>
</div>

<script>
(function(){
    var searchEl = document.getElementById('libSearch');
    var typeEl   = document.getElementById('libTypeFilter');
    var statusEl = document.getElementById('libStatusFilter');
    function filter() {
        var q   = searchEl ? searchEl.value.toLowerCase().trim() : '';
        var typ = typeEl ? typeEl.value : '';
        var sta = statusEl ? statusEl.value : '';
        var vis = 0;
        document.querySelectorAll('.cred-card').forEach(function(card) {
            var ok = true;
            if (q   && !card.dataset.name.includes(q) && !card.dataset.user.includes(q)) ok = false;
            if (typ && card.dataset.type   !== typ) ok = false;
            if (sta && card.dataset.status !== sta)  ok = false;
            card.style.display = ok ? '' : 'none';
            if (ok) vis++;
        });
        document.querySelectorAll('.store-section').forEach(function(sec) {
            var any = sec.querySelectorAll('.cred-card:not([style*="none"])').length;
            sec.style.display = any ? '' : 'none';
        });
        var container = document.getElementById('libContainer');
        var noRes     = document.getElementById('libNoResults');
        if (container) container.style.display = vis ? '' : 'none';
        if (noRes) noRes.style.display = vis ? 'none' : '';
    }
    if (searchEl) searchEl.addEventListener('input', filter);
    if (typeEl)   typeEl.addEventListener('change', filter);
    if (statusEl) statusEl.addEventListener('change', filter);
})();
</script>

<?php endif; ?>
<?php $content = ob_get_clean(); require __DIR__ . '/../layouts/main.php'; ?>
