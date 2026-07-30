<?php
$pageTitle   = 'Penalty Rules';
$currentPage = 'penalty-rules';
ob_start();
?>
<style>
.pr-wrap { max-width: 960px; margin: 0 auto; padding: 0 0 60px; }
.pr-header { padding: 20px 0 24px; border-bottom: 1px solid var(--border,rgba(255,255,255,.08)); margin-bottom: 28px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.pr-header h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
.pr-header p  { font-size: 13px; color: var(--text-muted,#94A3B8); margin: 0; }
.pr-btn { display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:8px;font-size:13px;font-weight:600;border:none;cursor:pointer;transition:.15s; text-decoration:none; }
.pr-btn-primary { background:#2563EB;color:#fff; }
.pr-btn-primary:hover { background:#1D4ED8; }

.pr-card { background:var(--surface,#1E293B);border:1px solid var(--border,rgba(255,255,255,.08));border-radius:14px;overflow:hidden;margin-bottom:20px; }
.pr-card-head { padding:14px 18px;border-bottom:1px solid var(--border,rgba(255,255,255,.08));display:flex;align-items:center;justify-content:space-between; }
.pr-card-head h2 { font-size:14px;font-weight:700;margin:0; }

.pr-table { width:100%;border-collapse:collapse; }
.pr-table th { text-align:left;font-size:11px;font-weight:700;color:var(--text-muted,#94A3B8);text-transform:uppercase;letter-spacing:.06em;padding:10px 16px;background:rgba(255,255,255,.03);border-bottom:1px solid rgba(255,255,255,.06); }
.pr-table td { padding:12px 16px;font-size:13px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle; }
.pr-table tr:last-child td { border-bottom:none; }
.pr-table tr:hover td { background:rgba(255,255,255,.02); }

.badge-active   { background:rgba(34,197,94,.12);color:#22C55E;border:1px solid rgba(34,197,94,.25);border-radius:100px;padding:2px 9px;font-size:11px;font-weight:700; }
.badge-inactive { background:rgba(255,255,255,.06);color:var(--text-muted,#94A3B8);border:1px solid rgba(255,255,255,.1);border-radius:100px;padding:2px 9px;font-size:11px;font-weight:700; }
.type-chip { border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600;background:rgba(59,130,246,.12);color:#60A5FA;border:1px solid rgba(59,130,246,.2); }

/* Modal */
.pr-modal-overlay { display:none;position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.65);align-items:center;justify-content:center; }
.pr-modal-overlay.open { display:flex; }
.pr-modal { background:var(--surface,#1E293B);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:16px;padding:24px;width:500px;max-width:95vw; }
.pr-modal h3 { font-size:16px;font-weight:700;margin:0 0 16px; }
.pr-field { margin-bottom:14px; }
.pr-field label { display:block;font-size:11px;font-weight:700;color:var(--text-muted,#94A3B8);text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px; }
.pr-field input, .pr-field select, .pr-field textarea { width:100%;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#F1F5F9;padding:9px 12px;font-size:13px;box-sizing:border-box; }
.pr-field textarea { resize:vertical;min-height:70px; }
.pr-row { display:flex;gap:12px; }
.pr-row .pr-field { flex:1; }
.pr-actions { display:flex;gap:10px;justify-content:flex-end;margin-top:18px; }
.pr-btn-ghost { background:rgba(255,255,255,.06);color:#F1F5F9;border:1px solid rgba(255,255,255,.1); }
.pr-btn-ghost:hover { background:rgba(255,255,255,.1); }
.pr-btn-danger { background:rgba(239,68,68,.12);color:#EF4444;border:1px solid rgba(239,68,68,.25); }
.pr-btn-danger:hover { background:rgba(239,68,68,.2); }

.notice { background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:12px 16px;font-size:13px;color:#F59E0B;margin-bottom:24px; }
</style>

<div class="pr-wrap">
    <div class="pr-header">
        <div>
            <h1>Penalty Rules</h1>
            <p>Configure rule types and suggested fine amounts. No penalties are applied automatically.</p>
        </div>
        <button class="pr-btn pr-btn-primary" onclick="openModal()">
            <?= tf_icon('plus', 14) ?> Add Rule
        </button>
    </div>

    <div class="notice">
        <?= tf_icon('alert-triangle', 14) ?>
        Rules define suggested amounts only. Penalties are applied per-user by Admin action — no user is charged automatically.
    </div>

    <div class="pr-card">
        <div class="pr-card-head">
            <h2>Configured Rules</h2>
            <span style="font-size:12px;color:var(--text-muted,#94A3B8)"><?= count($rules) ?> rules</span>
        </div>
        <?php if (empty($rules)): ?>
        <div style="text-align:center;padding:40px;color:var(--text-muted,#94A3B8)">No rules defined yet.</div>
        <?php else: ?>
        <table class="pr-table">
            <thead>
                <tr>
                    <th>Rule Name</th>
                    <th>Type</th>
                    <th>Suggested Fine</th>
                    <th>Effective Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
            <?php foreach ($rules as $rule): ?>
            <tr data-id="<?= $rule['id'] ?>">
                <td>
                    <div style="font-weight:600"><?= e($rule['name']) ?></div>
                    <?php if ($rule['description']): ?>
                    <div style="font-size:11px;color:var(--text-muted,#94A3B8);margin-top:2px"><?= e(mb_strimwidth($rule['description'],0,60,'…')) ?></div>
                    <?php endif; ?>
                </td>
                <td><span class="type-chip"><?= e($rule['rule_type']) ?></span></td>
                <td style="font-weight:700"><?= Penalty::format((float)$rule['suggested_amount'], $rule['currency']) ?></td>
                <td style="color:var(--text-muted,#94A3B8)"><?= $rule['effective_date'] ?></td>
                <td>
                    <span class="<?= $rule['is_active'] ? 'badge-active' : 'badge-inactive' ?>">
                        <?= $rule['is_active'] ? 'Active' : 'Inactive' ?>
                    </span>
                </td>
                <td>
                    <div style="display:flex;gap:6px">
                        <button class="pr-btn pr-btn-ghost" style="padding:4px 10px;font-size:11px"
                                onclick="editRule(<?= htmlspecialchars(json_encode($rule), ENT_QUOTES) ?>)">
                            Edit
                        </button>
                        <button class="pr-btn pr-btn-ghost" style="padding:4px 10px;font-size:11px"
                                onclick="toggleRule(<?= $rule['id'] ?>, <?= $rule['is_active'] ? 0 : 1 ?>, this)">
                            <?= $rule['is_active'] ? 'Disable' : 'Enable' ?>
                        </button>
                    </div>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php endif; ?>
    </div>
</div>

<!-- Rule modal -->
<div id="ruleModal" class="pr-modal-overlay">
    <div class="pr-modal">
        <h3 id="modalTitle">Add Penalty Rule</h3>
        <form id="ruleForm" onsubmit="saveRule(event)">
            <input type="hidden" id="ruleId" name="id" value="0">
            <input type="hidden" name="csrf_token" value="<?= csrf_token() ?>">

            <div class="pr-field">
                <label>Rule Name *</label>
                <input type="text" name="name" id="ruleName" required placeholder="e.g. Task Overdue">
            </div>
            <div class="pr-field">
                <label>Description</label>
                <textarea name="description" id="ruleDesc" placeholder="Optional description…"></textarea>
            </div>
            <div class="pr-row">
                <div class="pr-field">
                    <label>Rule Type</label>
                    <select name="rule_type" id="ruleType">
                        <option value="task_overdue">Task Overdue</option>
                        <option value="verification_missed">Verification Missed</option>
                        <option value="checklist_missed">Checklist Missed</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>
                <div class="pr-field">
                    <label>Effective Date</label>
                    <input type="date" name="effective_date" id="ruleDate" value="<?= date('Y-m-d') ?>">
                </div>
            </div>
            <div class="pr-row">
                <div class="pr-field">
                    <label>Suggested Amount</label>
                    <input type="number" name="suggested_amount" id="ruleAmount" min="0" step="1000" value="500000">
                </div>
                <div class="pr-field">
                    <label>Currency</label>
                    <select name="currency" id="ruleCurrency">
                        <option value="VND">VND</option>
                        <option value="USD">USD</option>
                    </select>
                </div>
            </div>
            <div class="pr-field">
                <label>
                    <input type="checkbox" name="is_active" id="ruleActive" value="1" checked style="width:auto;margin-right:6px">
                    Active
                </label>
            </div>
            <div class="pr-actions">
                <button type="button" class="pr-btn pr-btn-ghost" onclick="closeModal()">Cancel</button>
                <button type="submit" class="pr-btn pr-btn-primary">Save Rule</button>
            </div>
        </form>
    </div>
</div>

<script>
const CSRF = '<?= csrf_token() ?>';

function openModal(data = null) {
    document.getElementById('modalTitle').textContent = data ? 'Edit Penalty Rule' : 'Add Penalty Rule';
    document.getElementById('ruleId').value       = data ? data.id : 0;
    document.getElementById('ruleName').value     = data ? data.name : '';
    document.getElementById('ruleDesc').value     = data ? (data.description || '') : '';
    document.getElementById('ruleType').value     = data ? data.rule_type : 'task_overdue';
    document.getElementById('ruleDate').value     = data ? data.effective_date : '<?= date('Y-m-d') ?>';
    document.getElementById('ruleAmount').value   = data ? data.suggested_amount : 500000;
    document.getElementById('ruleCurrency').value = data ? data.currency : 'VND';
    document.getElementById('ruleActive').checked = data ? !!parseInt(data.is_active) : true;
    document.getElementById('ruleModal').classList.add('open');
}
function editRule(data) { openModal(data); }
function closeModal() { document.getElementById('ruleModal').classList.remove('open'); }

async function saveRule(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (!document.getElementById('ruleActive').checked) fd.set('is_active', '0');
    try {
        const r = await fetch('<?= APP_URL ?>/admin/penalty-rules/save', { method: 'POST', body: fd });
        const j = await r.json();
        if (j.ok) { location.reload(); } else { alert(j.error || 'Error saving rule.'); }
    } catch { alert('Network error.'); }
}

async function toggleRule(id, newActive, btn) {
    const fd = new FormData();
    fd.append('id', id);
    fd.append('active', newActive);
    fd.append('csrf_token', CSRF);
    try {
        const r = await fetch('<?= APP_URL ?>/admin/penalty-rules/toggle', { method: 'POST', body: fd });
        const j = await r.json();
        if (j.ok) { location.reload(); } else { alert(j.error || 'Error.'); }
    } catch { alert('Network error.'); }
}
</script>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
