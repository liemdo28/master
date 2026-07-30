<?php
$pageTitle = t('page.stores');
$currentPage = 'admin-stores';

ob_start();
?>

<div class="grid grid-2 mb-4">
    <!-- Store List -->
    <div class="card">
        <div class="card-header"><h3><?= e(t('store.list')) ?> (<?= count($stores) ?>)</h3></div>
        <div class="card-body" style="padding:0">
            <?php if (empty($stores)): ?>
                <div class="empty-state" style="padding:48px 20px">
                    <div class="icon">🏪</div>
                    <h3><?= e(t('store.empty')) ?></h3>
                    <p><?= e(t('store.empty_desc')) ?></p>
                </div>
            <?php else: ?>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th><?= e(t('store.name')) ?></th>
                            <th>Manager</th>
                            <th>Status</th>
                            <th>Health</th>
                            <th>Tasks</th>
                            <th><?= e(t('store.bills_count')) ?></th>
                            <th><?= e(t('store.unpaid')) ?></th>
                            <th><?= e(t('common.actions')) ?></th>
                        </tr>
                    </thead>
                    <tbody>
                    <?php
                    // Pre-fetch enriched data — with try-catch per store to prevent full-page crash
                    $scModel = new StoreCommand();
                    $enriched = [];
                    $enrichErrors = [];
                    foreach ($stores as $s) {
                        $sid = (int)$s['id'];
                        $ts = ['total' => 0, 'overdue' => 0, 'due_today' => 0, 'completed_this_week' => 0, 'critical' => 0, 'active_employees' => 0];
                        $bs = ['total_bills' => 0, 'overdue_bills' => 0, 'total_due' => 0];
                        $hs = null; // null until successfully computed

                        try {
                            $ts = $scModel->getTaskStats($sid);
                        } catch (\Throwable $e) {
                            $enrichErrors[] = "store={$sid}:getTaskStats: " . $e->getMessage();
                            error_log('[STORE-ADMIN] getTaskStats failed for store ' . $sid . ': ' . $e->getMessage());
                        }

                        try {
                            $bs = $scModel->getBillStats($sid);
                        } catch (\Throwable $e) {
                            $enrichErrors[] = "store={$sid}:getBillStats: " . $e->getMessage();
                            error_log('[STORE-ADMIN] getBillStats failed for store ' . $sid . ': ' . $e->getMessage());
                        }

                        try {
                            $hs = $scModel->calculateHealthScore($sid);
                        } catch (\Throwable $e) {
                            $enrichErrors[] = "store={$sid}:calculateHealthScore: " . $e->getMessage();
                            error_log('[STORE-ADMIN] calculateHealthScore failed for store ' . $sid . ': ' . $e->getMessage());
                            $hs = null;
                        }

                        $enriched[$sid] = [
                            'tasks_open'     => (int)($ts['total'] ?? 0),
                            'tasks_overdue'  => (int)($ts['overdue'] ?? 0),
                            'tasks_critical' => (int)($ts['critical'] ?? 0),
                            'employees'      => (int)($ts['active_employees'] ?? 0),
                            'bill_total'     => (int)($bs['total_bills'] ?? 0),
                            'bill_unpaid'    => (int)($bs['overdue_bills'] ?? 0),
                            'health_score'   => $hs !== null ? (float)($hs['score'] ?? 0) : null,
                            'health_grade'   => $hs['grade'] ?? 'F',
                            'health_ok'      => $hs !== null,
                        ];
                    }
                    ?>
                    <?php foreach ($stores as $s):
                        $sid = (int)$s['id'];
                        $en = $enriched[$sid] ?? [];
                        $totalBills = (int)($en['bill_total'] ?? 0);
                        $unpaidBills = (int)($en['bill_unpaid'] ?? 0);
                        $hScore = (float)($en['health_score'] ?? 0);
                        $hGrade = (string)($en['health_grade'] ?? 'F');
                        $hOk = $en['health_ok'] ?? false;
                        $hColor = $hOk ? ($hScore >= 80 ? '#22c55e' : ($hScore >= 60 ? '#eab308' : '#ef4444')) : 'var(--text-muted)';
                        $storeStatus = $s['status'] ?? 'active';
                    ?>
                        <tr class="store-summary-row" data-dd-inline data-dd-target="#store-body-<?= $sid ?>" data-dd-title="<?= e($s['name']) ?>" data-dd-key="store-<?= $sid ?>">
                            <td>
                                <div style="display:flex;align-items:center;gap:8px">
                                    <span class="store-dot" style="background:<?= e($s['color'] ?: 'var(--neon-cyan)') ?>"></span>
                                    <a href="<?= APP_URL ?>/admin/stores/<?= $sid ?>" style="color:inherit;text-decoration:none;font-weight:700" title="Xem chi tiết cửa hàng">
                                        <?= e($s['name']) ?> <span style="opacity:.4;font-size:11px">↗</span>
                                    </a>
                                </div>
                            </td>
                            <td>
                                <?php if (!empty($s['manager_name'])): ?>
                                    <span style="font-size:12px;font-weight:600;color:var(--text)"><?= e($s['manager_name']) ?></span>
                                <?php else: ?>
                                    <span class="text-muted" style="font-size:12px">—</span>
                                <?php endif; ?>
                            </td>
                            <td>
                                <span style="font-size:11px;padding:2px 8px;border-radius:4px;font-weight:600;<?php if ($storeStatus === 'active'): ?>background:rgba(34,197,94,.12);color:#22c55e<?php elseif ($storeStatus === 'inactive'): ?>background:rgba(239,68,68,.12);color:#ef4444<?php else: ?>background:rgba(100,116,139,.12);color:#94a3b8<?php endif; ?>">
                                    <?= ucfirst($storeStatus) ?>
                                </span>
                            </td>
                            <td>
                                <?php if ($hOk): ?>
                                <span onclick="event.preventDefault();openHealthDrawer(<?= $sid ?>,<?= number_format($hScore,1) ?>,'<?= $hGrade ?>')" style="cursor:pointer;font-weight:800;font-size:14px;color:<?= $hColor ?>" title="Click to view health detail">
                                    <?= number_format($hScore, 0) ?>
                                    <span style="font-size:10px;opacity:.7">(<?= $hGrade ?>)</span>
                                </span>
                                <?php else: ?>
                                <span style="font-weight:800;font-size:14px;color:var(--text-muted)">N/A</span>
                                <?php endif; ?>
                            </td>
                            <td>
                                <span style="font-size:12px;<?= ($en['tasks_overdue'] ?? 0) > 0 ? 'color:#f97316' : 'color:var(--text-muted)' ?>">
                                    <?= $en['tasks_overdue'] ?? 0 ?> / <?= $en['tasks_open'] ?? 0 ?>
                                </span>
                                <?php if (($en['tasks_critical'] ?? 0) > 0): ?>
                                    <span style="font-size:10px;color:#ef4444;font-weight:700;margin-left:4px">⚠ <?= $en['tasks_critical'] ?></span>
                                <?php endif; ?>
                            </td>
                            <td>
                                <?php if ($totalBills > 0): ?>
                                    <span class="badge" style="background:var(--bg-tertiary);color:var(--text-muted);font-size:10px"><?= $totalBills ?></span>
                                <?php else: ?>
                                    <span class="text-muted">0</span>
                                <?php endif; ?>
                            </td>
                            <td>
                                <?php if ($unpaidBills > 0): ?>
                                    <span class="badge-overdue" style="font-size:10px"><?= $unpaidBills ?></span>
                                <?php else: ?>
                                    <span class="text-muted">0</span>
                                <?php endif; ?>
                            </td>
                            <td>
                                <div style="display:flex;gap:4px">
                                    <a class="btn-ghost btn-sm" href="<?= APP_URL ?>/admin/stores/<?= $sid ?>" title="Command Center" style="font-size:14px;padding:4px 6px">📊</a>
                                    <button class="btn-ghost btn-sm" type="button" onclick="event.stopPropagation(); openStoreEditModal(<?= $sid ?>, <?= e(json_encode($s['name'])) ?>, <?= e(json_encode($s['address'] ?? '')) ?>, <?= e(json_encode($s['color'] ?? '')) ?>)" title="Edit" style="font-size:14px;padding:4px 6px">✏️</button>
                                    <a class="btn-ghost btn-sm" href="<?= APP_URL ?>/bills/store/<?= $sid ?>" title="<?= e(t('store.view_bills')) ?>" style="font-size:14px;padding:4px 6px">📋</a>
                                    <a class="btn-ghost btn-sm" href="<?= APP_URL ?>/admin/stores/<?= $sid ?>/delete" onclick="return confirm('<?= e(t('store.delete_confirm')) ?>')" title="<?= e(t('store.delete')) ?>" style="font-size:14px;padding:4px 6px;color:var(--neon-pink)">🗑️</a>
                                </div>
                            </td>
                        </tr>
                        <tr class="store-detail-row" id="store-body-<?= $sid ?>" style="display:none">
                            <td colspan="8">
                                <div class="vendor-detail-panel">
                                    <form method="POST" action="<?= APP_URL ?>/admin/stores/<?= $s['id'] ?>/update" class="mb-3">
                                        <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                                        <div class="form-group">
                                            <label><?= e(t('store.name_label')) ?></label>
                                            <input class="form-control" name="name" value="<?= e($s['name']) ?>" required>
                                        </div>
                                        <div class="form-group">
                                            <label><?= e(t('store.address_label')) ?></label>
                                            <input class="form-control" name="address" value="<?= e($s['address'] ?? '') ?>">
                                        </div>
                                        <div class="form-group">
                                            <label><?= e(t('store.color_label')) ?></label>
                                            <div style="display:flex;gap:8px;align-items:center">
                                                <input type="color" name="color" value="<?= e($s['color'] ?: '#00f5ff') ?>" style="width:50px;height:38px;padding:2px;border:1px solid var(--border);border-radius:6px;background:var(--bg-tertiary);cursor:pointer">
                                            </div>
                                        </div>
                                        <div style="display:flex;gap:8px;flex-wrap:wrap">
                                            <button type="submit" class="btn btn-primary btn-sm"><?= e(t('store.update')) ?></button>
                                            <a href="<?= APP_URL ?>/admin/stores/<?= $s['id'] ?>/delete" class="btn btn-ghost btn-sm" onclick="return confirm('<?= e(t('store.delete_confirm')) ?>')" style="color:var(--neon-pink)"><?= e(t('store.delete')) ?></a>
                                        </div>
                                    </form>
                                </div>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>
    </div>

    <!-- Create Store Form -->
    <div class="card">
        <div class="card-header"><h3>➕ <?= e(t('store.add')) ?></h3></div>
        <div class="card-body">
            <form method="POST" action="<?= APP_URL ?>/admin/stores">
                <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                <div class="form-group">
                    <label><?= e(t('store.name_label')) ?></label>
                    <input class="form-control" name="name" required placeholder="<?= e(t('store.name_placeholder')) ?>">
                </div>
                <div class="form-group">
                    <label><?= e(t('store.address_label')) ?></label>
                    <input class="form-control" name="address" placeholder="...">
                </div>
                <div class="form-group">
                    <label><?= e(t('store.color_label')) ?></label>
                    <div style="display:flex;gap:8px;align-items:center">
                        <input type="color" name="color" value="#00f5ff" style="width:50px;height:38px;padding:2px;border:1px solid var(--border);border-radius:6px;background:var(--bg-tertiary);cursor:pointer" id="create-color-picker">
                        <input type="text" class="form-control" id="create-color-text" value="#00f5ff" style="flex:1" oninput="document.getElementById('create-color-picker').value=this.value" placeholder="#00f5ff">
                    </div>
                </div>
                <button type="submit" class="btn btn-primary"><?= e(t('store.create')) ?></button>
            </form>
        </div>
    </div>
</div>

<!-- Store Edit Modal -->
<div class="modal-overlay" id="storeEditModal" style="display:none" onclick="if(event.target===this)this.style.display='none'">
    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:16px;width:100%;max-width:440px;box-shadow:var(--shadow-lg)">
        <div class="modal-header">
            <h3><?= e(t('store.edit')) ?></h3>
            <button class="btn-ghost" onclick="document.getElementById('storeEditModal').style.display='none'" style="font-size:18px">✕</button>
        </div>
        <form method="POST" id="storeEditForm">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <div style="padding:22px">
                <div class="form-group">
                    <label><?= e(t('store.name_label')) ?></label>
                    <input class="form-control" name="name" id="store-edit-name" required>
                </div>
                <div class="form-group">
                    <label><?= e(t('store.address_label')) ?></label>
                    <input class="form-control" name="address" id="store-edit-address">
                </div>
                <div class="form-group">
                    <label><?= e(t('store.color_label')) ?></label>
                    <div style="display:flex;gap:8px;align-items:center">
                        <input type="color" name="color" id="store-edit-color" value="#00f5ff" style="width:50px;height:38px;padding:2px;border:1px solid var(--border);border-radius:6px;background:var(--bg-tertiary);cursor:pointer">
                        <input type="text" class="form-control" id="store-edit-color-text" value="#00f5ff" style="flex:1" oninput="document.getElementById('store-edit-color').value=this.value" placeholder="#00f5ff">
                    </div>
                </div>
            </div>
            <div style="padding:14px 22px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('storeEditModal').style.display='none'"><?= e(t('store.cancel')) ?></button>
                <button type="submit" class="btn btn-primary"><?= e(t('store.save')) ?></button>
            </div>
        </form>
    </div>
</div>

<script>
function toggleStore(id) {
    const body = document.getElementById('store-body-' + id);
    if (body.style.display === 'none') {
        body.style.display = 'block';
    } else {
        body.style.display = 'none';
    }
}

function openStoreEditModal(id, name, address, color) {
    document.getElementById('storeEditForm').action = '<?= APP_URL ?>/admin/stores/' + id + '/update';
    document.getElementById('store-edit-name').value = name || '';
    document.getElementById('store-edit-address').value = address || '';
    const c = color || '#00f5ff';
    document.getElementById('store-edit-color').value = c;
    document.getElementById('store-edit-color-text').value = c;
    document.getElementById('storeEditModal').style.display = 'flex';
}

// Sync color pickers with text inputs
document.getElementById('create-color-picker').addEventListener('input', function() {
    document.getElementById('create-color-text').value = this.value;
});
document.getElementById('store-edit-color').addEventListener('input', function() {
    document.getElementById('store-edit-color-text').value = this.value;
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.getElementById('storeEditModal').style.display = 'none';
});

// ── i18n translations for JS drawer ─────────────────────────────
var HEALTH_I18N = {
    loading:          <?= json_encode(t('store.loading')) ?>,
    grade:            <?= json_encode(t('store.grade')) ?>,
    health_breakdown: <?= json_encode(t('store.health_breakdown')) ?>,
    score_bar:        <?= json_encode(t('store.score_bar')) ?>,
    task_completion:  <?= json_encode(t('store.task_completion')) ?>,
    tasks_total:      <?= json_encode(t('store.tasks_total')) ?>,
    tasks_overdue:    <?= json_encode(t('store.tasks_overdue')) ?>,
    tasks_critical:   <?= json_encode(t('store.tasks_critical')) ?>,
    tasks_due_today:  <?= json_encode(t('store.tasks_due_today')) ?>,
    financial:        <?= json_encode(t('store.financial')) ?>,
    bills_total:      <?= json_encode(t('store.bills_total')) ?>,
    bills_overdue:    <?= json_encode(t('store.bills_overdue')) ?>,
    amount_due:       <?= json_encode(t('store.amount_due')) ?>,
    incidents:        <?= json_encode(t('store.incidents')) ?>,
    open_incidents:   <?= json_encode(t('store.open_incidents')) ?>,
    critical_incidents: <?= json_encode(t('store.critical_incidents')) ?>,
    score_formula:    <?= json_encode(t('store.score_formula')) ?>,
    view_command_center: <?= json_encode(t('store.view_command_center')) ?>,
    error_loading:    <?= json_encode(t('store.error_loading')) ?>,
};

// ── Health Score Drawer ─────────────────────────────────────────
function openHealthDrawer(storeId, score, grade) {
    var T = HEALTH_I18N;
    var overlay = document.getElementById('health-drawer-overlay');
    var drawer = document.getElementById('health-drawer');
    var content = document.getElementById('health-drawer-content');
    content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">' + T.loading + '</div>';
    overlay.style.display = 'block';
    setTimeout(function() { drawer.style.open = 'true'; drawer.style.right = '0'; }, 10);

    fetch(APP_URL + '/admin/store-command/' + storeId + '/stats')
        .then(function(r) { return r.json(); })
        .then(function(res) {
            if (!res.success) throw new Error(res.error);
            var d = res.data;
            var barColor = score >= 80 ? '#22c55e' : (score >= 60 ? '#eab308' : '#ef4444');
            content.innerHTML =
                '<div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">' +
                    '<div style="width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:' + barColor + ';border:3px solid ' + barColor + '">' + Math.round(score) + '</div>' +
                    '<div><div style="font-size:16px;font-weight:800;color:var(--text)">' + T.grade + ' ' + grade + '</div>' +
                    '<div style="font-size:12px;color:var(--text-muted)">' + T.health_breakdown + '</div></div>' +
                '</div>' +
                '<div style="margin-bottom:16px">' +
                    '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:var(--text-muted)">' + T.score_bar + '</span><span style="font-weight:700;color:' + barColor + '">' + Math.round(score) + '%</span></div>' +
                    '<div style="height:8px;border-radius:4px;background:var(--bg-tertiary);overflow:hidden"><div style="height:100%;width:' + score + '%;background:' + barColor + ';border-radius:4px"></div></div>' +
                '</div>' +
                healthSectionHeader(T.task_completion) +
                healthMetricBar(T.tasks_total, d.tasks.total, '#3b82f6') +
                healthMetricBar(T.tasks_overdue, d.tasks.overdue, d.tasks.overdue > 0 ? '#f97316' : '#22c55e') +
                healthMetricBar(T.tasks_critical, d.tasks.critical, d.tasks.critical > 0 ? '#ef4444' : '#22c55e') +
                healthMetricBar(T.tasks_due_today, d.tasks.due_today, '#60a5fa') +
                healthSectionHeader(T.financial) +
                healthMetricBar(T.bills_total, d.bills.total_bills, '#a855f7') +
                healthMetricBar(T.bills_overdue, d.bills.overdue_bills, d.bills.overdue_bills > 0 ? '#ef4444' : '#22c55e') +
                '<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">' + T.amount_due + ': $' + (d.bills.total_due || 0).toLocaleString() + '</div>' +
                healthSectionHeader(T.incidents) +
                healthMetricBar(T.open_incidents, d.incidents.open, d.incidents.open > 0 ? '#f97316' : '#22c55e') +
                healthMetricBar(T.critical_incidents, d.incidents.critical, d.incidents.critical > 0 ? '#ef4444' : '#22c55e') +
                '<div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin:16px 0 10px;border-top:1px solid var(--border);padding-top:14px">' + T.score_formula + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);padding:10px;background:var(--bg-tertiary);border-radius:8px;line-height:1.6">' +
                    '<strong style="color:var(--text)">100</strong> − ' +
                    '(Overdue Rate × <strong>30</strong>) − ' +
                    '(Overdue Bills × <strong>5</strong>) − ' +
                    '(Open Incidents × <strong>5</strong>) − ' +
                    '(Critical × <strong>10</strong>) − ' +
                    '(Penalties × <strong>2</strong>)' +
                '</div>' +
                '<div style="margin-top:14px"><a href="' + APP_URL + '/admin/store-command/' + storeId + '" style="font-size:13px;font-weight:600;color:#3b82f6;text-decoration:none">' + T.view_command_center + ' →</a></div>';
        })
        .catch(function(err) {
            content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--neon-pink)">' + T.error_loading + ': ' + err.message + '</div>';
        });
}

function healthSectionHeader(title) {
    return '<div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin:14px 0 8px;border-top:1px solid var(--border);padding-top:12px">' + title + '</div>';
}

function healthMetricBar(label, value, color) {
    return '<div style="margin-bottom:10px">' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">' +
            '<span style="color:var(--text-muted)">' + label + '</span>' +
            '<span style="font-weight:700;color:' + color + '">' + value + '</span>' +
        '</div>' +
        '<div style="height:4px;border-radius:2px;background:var(--bg-tertiary)"><div style="height:100%;width:' + Math.min(100, value * 10) + '%;background:' + color + ';border-radius:2px"></div></div>' +
    '</div>';
}

function closeHealthDrawer() {
    document.getElementById('health-drawer-overlay').style.display = 'none';
    document.getElementById('health-drawer').style.right = '-500px';
}
</script>

<!-- Health Drawer Overlay -->
<div id="health-drawer-overlay" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:999" onclick="closeHealthDrawer()"></div>
<div id="health-drawer" style="position:fixed;top:0;right:-500px;width:460px;max-width:95vw;height:100vh;background:var(--bg-primary);border-left:1px solid var(--border);z-index:1000;transition:right .25s ease;overflow-y:auto;box-shadow:-4px 0 24px rgba(0,0,0,.3)">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border)">
        <span style="font-size:15px;font-weight:800;color:var(--text)"><?= e(t('store.health_score')) ?></span>
        <button onclick="closeHealthDrawer()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;padding:4px">✕</button>
    </div>
    <div id="health-drawer-content" style="padding:20px"></div>
</div>

<?php $content = ob_get_clean(); require __DIR__ . '/../layouts/main.php'; ?>
