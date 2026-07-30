<?php
/**
 * Master Obligation Registry — Management Page
 * CEO Compliance & Payment Operations — Phase 1
 *
 * Shows ALL obligations + a "Generate Now" button (admin only).
 */
$pageTitle   = 'Master Obligation Registry';
$currentPage = 'obligations';
ob_start();
?>

<style>
.ob-wrap { max-width: 1440px; margin: 0 auto; padding: 24px; color: #F1F5F9; }
.ob-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; flex-wrap:wrap; gap:12px; }
.ob-header h1 { font-size:24px; font-weight:800; margin:0; }
.ob-header p  { color:#94A3B8; font-size:13px; margin:4px 0 0; }
.ob-actions { display:flex; gap:8px; flex-wrap:wrap; }
.ob-btn { padding:8px 16px; border-radius:8px; font-size:13px; font-weight:600; text-decoration:none; border:none; cursor:pointer; }
.ob-btn-primary { background:#2563EB; color:#fff; }
.ob-btn-ghost   { background:rgba(255,255,255,.06); color:#F1F5F9; border:1px solid rgba(255,255,255,.08); }
.ob-btn-danger  { background:#DC2626; color:#fff; }

.ob-tabs { display:flex; gap:4px; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,.08); padding-bottom:4px; flex-wrap:wrap; }
.ob-tab { padding:8px 14px; font-size:13px; color:#94A3B8; border-radius:8px 8px 0 0; text-decoration:none; }
.ob-tab.active { background:rgba(99,102,241,.15); color:#A5B4FC; }

.ob-card { background:#1E293B; border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:20px; margin-bottom:16px; }
.ob-card h2 { font-size:16px; font-weight:700; margin:0 0 14px; color:#F1F5F9; }

.ob-table { width:100%; border-collapse:collapse; font-size:13px; }
.ob-table th { text-align:left; font-size:10px; color:#94A3B8; text-transform:uppercase; letter-spacing:.06em; padding:10px 8px; border-bottom:1px solid rgba(255,255,255,.08); }
.ob-table td { padding:14px 8px; border-bottom:1px solid rgba(255,255,255,.05); vertical-align:middle; }
.ob-table tr:last-child td { border-bottom:none; }

.ob-pill { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; }
.ob-pill-cat-rent        { background:rgba(59,130,246,.2); color:#93C5FD; }
.ob-pill-cat-utility     { background:rgba(245,158,11,.2); color:#FCD34D; }
.ob-pill-cat-insurance   { background:rgba(168,85,247,.2); color:#D8B4FE; }
.ob-pill-cat-tax         { background:rgba(239,68,68,.2);  color:#FCA5A5; }
.ob-pill-cat-license     { background:rgba(34,197,94,.2);  color:#86EFAC; }
.ob-pill-cat-compliance  { background:rgba(148,163,184,.2); color:#CBD5E1; }
.ob-pill-freq-monthly   { background:rgba(34,197,94,.15); color:#86EFAC; }
.ob-pill-freq-quarterly { background:rgba(245,158,11,.15); color:#FCD34D; }
.ob-pill-freq-annual    { background:rgba(239,68,68,.15); color:#FCA5A5; }

.ob-priority-urgent { color:#EF4444; font-weight:700; }
.ob-priority-high   { color:#F59E0B; font-weight:700; }
.ob-priority-medium { color:#94A3B8; }
.ob-priority-low    { color:#64748B; }

.ob-grid { display:grid; grid-template-columns: 1fr; gap:16px; }
@media (min-width: 1024px) { .ob-grid { grid-template-columns: 1fr 1fr; } }

.ob-form-grid { display:grid; grid-template-columns: 1fr 1fr; gap:14px; }
.ob-form-grid .full { grid-column: 1 / -1; }
.ob-form-grid label { font-size:11px; color:#94A3B8; text-transform:uppercase; letter-spacing:.06em; font-weight:700; display:block; margin-bottom:4px; }
.ob-form-grid input, .ob-form-grid select, .ob-form-grid textarea {
    width:100%; padding:8px 10px; background:#0F172A; border:1px solid rgba(255,255,255,.08); border-radius:8px;
    color:#F1F5F9; font-size:13px; box-sizing:border-box;
}
.ob-form-grid textarea { resize:vertical; min-height:60px; }

.flash { padding:10px 14px; border-radius:8px; margin-bottom:16px; font-size:13px; }
.flash-success { background:rgba(34,197,94,.15); color:#86EFAC; border:1px solid rgba(34,197,94,.3); }
.flash-error   { background:rgba(239,68,68,.15); color:#FCA5A5; border:1px solid rgba(239,68,68,.3); }

.ob-link { color:#60A5FA; text-decoration:none; }
.ob-link:hover { text-decoration:underline; }
</style>

<div class="ob-wrap">

    <?php if ($s = flash('success')): ?><div class="flash flash-success"><?= e($s) ?></div><?php endif; ?>
    <?php if ($e = flash('error')):   ?><div class="flash flash-error"><?= e($e) ?></div><?php endif; ?>

    <div class="ob-header">
        <div>
            <h1>📒 Master Obligation Registry</h1>
            <p>CEO Compliance &amp; Payment Operations · <?= count($obligations) ?> obligation<?= count($obligations) === 1 ? '' : 's' ?> registered</p>
        </div>
        <div class="ob-actions">
            <a class="ob-btn ob-btn-ghost" href="<?= APP_URL ?>/overview">← Back to Dashboard</a>
            <a class="ob-btn ob-btn-ghost" href="<?= APP_URL ?>/obligations/reviewer">Reviewer Queue →</a>
            <a class="ob-btn ob-btn-ghost" href="<?= APP_URL ?>/obligations/approver">Approver Queue →</a>
            <form method="POST" action="<?= APP_URL ?>/obligations/generate" style="display:inline">
                <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
                <button type="submit" class="ob-btn ob-btn-primary">⚡ Generate Due Tasks</button>
            </form>
        </div>
    </div>

    <div class="ob-tabs">
        <?php foreach ($categories as $cat): ?>
        <a class="ob-tab" href="#cat-<?= (int)$cat['id'] ?>">
            <?= e($cat['name']) ?> (<?= count(array_filter($obligations, fn($o) => (int)$o['category_id'] === (int)$cat['id'])) ?>)
        </a>
        <?php endforeach; ?>
    </div>

    <div class="ob-card">
        <h2>All Obligations</h2>
        <table class="ob-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Store</th>
                    <th>Frequency</th>
                    <th>Next Due</th>
                    <th>Reviewer</th>
                    <th>Approver</th>
                    <th>Active</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
            <?php if (empty($obligations)): ?>
                <tr><td colspan="9" style="color:#94A3B8; text-align:center; padding:32px;">No obligations yet. Run <code>php seed_obligations.php</code>.</td></tr>
            <?php else: foreach ($obligations as $o): ?>
                <tr>
                    <td>
                        <strong><?= e($o['name']) ?></strong>
                        <?php if (!empty($o['vendor'])): ?>
                        <br><span style="color:#94A3B8; font-size:11px;"><?= e($o['vendor']) ?></span>
                        <?php endif; ?>
                    </td>
                    <td>
                        <span class="ob-pill ob-pill-cat-<?= e(strtolower($o['category_name'] ?? 'compliance')) ?>">
                            <?= e($o['category_name'] ?? '—') ?>
                        </span>
                    </td>
                    <td><?= e($o['store_label'] ?? '—') ?></td>
                    <td>
                        <span class="ob-pill ob-pill-freq-<?= e($o['frequency']) ?>">
                            <?= e(ucfirst(str_replace('_', '-', $o['frequency']))) ?>
                        </span>
                    </td>
                    <td><?= $o['next_due_date'] ? e(date('M j, Y', strtotime($o['next_due_date']))) : '<span style="color:#94A3B8">—</span>' ?></td>
                    <td><?= e($o['reviewer_name'] ?? '—') ?></td>
                    <td><?= e($o['approver_name'] ?? '—') ?></td>
                    <td>
                        <?php if ($o['active']): ?>
                            <span style="color:#22C55E">●</span> Active
                        <?php else: ?>
                            <span style="color:#64748B">●</span> Inactive
                        <?php endif; ?>
                    </td>
                    <td>
                        <a class="ob-link" href="<?= APP_URL ?>/obligations/<?= (int)$o['id'] ?>" data-detail-drawer>View →</a>
                    </td>
                </tr>
            <?php endforeach; endif; ?>
            </tbody>
        </table>
    </div>

    <div class="ob-card">
        <h2>+ Add New Obligation</h2>
        <form method="POST" action="<?= APP_URL ?>/obligations">
            <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
            <div class="ob-form-grid">
                <div class="full">
                    <label>Name *</label>
                    <input name="name" required placeholder="e.g. Monthly Rent - Bakudan Bandera">
                </div>
                <div>
                    <label>Category *</label>
                    <select name="category_id" required>
                        <?php foreach ($categories as $c): ?>
                        <option value="<?= (int)$c['id'] ?>"><?= e($c['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div>
                    <label>Store</label>
                    <select name="store_id">
                        <option value="">— None —</option>
                        <?php foreach ($stores as $s): ?>
                        <option value="<?= (int)$s['id'] ?>"><?= e($s['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div>
                    <label>Vendor</label>
                    <input name="vendor" placeholder="e.g. PG&E, CDTFA, Amtrust">
                </div>
                <div>
                    <label>Frequency *</label>
                    <select name="frequency" required>
                        <option value="weekly">Weekly</option>
                        <option value="monthly" selected>Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="semi_annual">Semi-Annual</option>
                        <option value="annual">Annual</option>
                    </select>
                </div>
                <div>
                    <label>Due Day (1-31)</label>
                    <input name="due_day" type="number" min="1" max="31" placeholder="e.g. 1">
                </div>
                <div>
                    <label>Due Month (1-12, for annual/semi)</label>
                    <input name="due_month" type="number" min="1" max="12" placeholder="e.g. 4">
                </div>
                <div>
                    <label>Grace Days</label>
                    <input name="grace_days" type="number" min="0" max="60" value="3">
                </div>
                <div>
                    <label>Amount (USD)</label>
                    <input name="amount" type="number" step="0.01" placeholder="Optional">
                </div>
                <div>
                    <label>Priority</label>
                    <select name="priority">
                        <option value="urgent">Urgent</option>
                        <option value="high" selected>High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </div>
                <div>
                    <label>Reviewer</label>
                    <select name="reviewer_id">
                        <option value="">— Default (Admin) —</option>
                        <?php foreach ($users as $u): ?>
                        <option value="<?= (int)$u['id'] ?>"><?= e($u['name']) ?> (<?= e($u['role']) ?>)</option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div>
                    <label>Approver</label>
                    <select name="approver_id">
                        <option value="">— Default (Admin) —</option>
                        <?php foreach ($users as $u): ?>
                        <option value="<?= (int)$u['id'] ?>"><?= e($u['name']) ?> (<?= e($u['role']) ?>)</option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="full">
                    <label>Account / Login Info</label>
                    <textarea name="account_info" placeholder="Login credentials, payment portal URL, account numbers…"></textarea>
                </div>
                <div class="full">
                    <label>Compliance Notes</label>
                    <textarea name="compliance_note" placeholder="Regulatory notes, special checks, deadlines…"></textarea>
                </div>
                <div class="full">
                    <label>
                        <input type="checkbox" name="active" value="1" checked> Active (immediately starts generating tasks)
                    </label>
                </div>
            </div>
            <div style="margin-top:16px; display:flex; gap:8px;">
                <button type="submit" class="ob-btn ob-btn-primary">+ Create Obligation</button>
                <a href="<?= APP_URL ?>/obligations" class="ob-btn ob-btn-ghost">Cancel</a>
            </div>
        </form>
    </div>

</div>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
