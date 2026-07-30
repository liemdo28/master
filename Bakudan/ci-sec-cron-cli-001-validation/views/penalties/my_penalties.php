<?php
$pageTitle   = 'My Penalties';
$currentPage = 'my-penalties';
ob_start();
?>
<style>
.mp-wrap { max-width: 960px; margin: 0 auto; padding: 0 0 60px; }
.mp-header { padding: 24px 0 20px; border-bottom: 1px solid var(--border,rgba(255,255,255,.08)); margin-bottom: 28px; }
.mp-header h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
.mp-header p  { font-size: 13px; color: var(--text-muted,#94A3B8); margin: 0; }

.mp-kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 28px; }
@media(max-width:600px){ .mp-kpi-row { grid-template-columns: 1fr 1fr; } }

.mp-kpi { background: var(--surface,#1E293B); border: 1px solid var(--border,rgba(255,255,255,.08)); border-radius: 14px; padding: 18px; }
.mp-kpi-label { font-size: 11px; font-weight: 700; color: var(--text-muted,#94A3B8); text-transform: uppercase; letter-spacing: .07em; }
.mp-kpi-value { font-size: 26px; font-weight: 800; margin: 6px 0 2px; color: #F1F5F9; }
.mp-kpi-value.red { color: #EF4444; }
.mp-kpi-sub   { font-size: 11px; color: var(--text-muted,#94A3B8); }

.mp-card { background: var(--surface,#1E293B); border: 1px solid var(--border,rgba(255,255,255,.08)); border-radius: 14px; overflow: hidden; margin-bottom: 20px; }
.mp-card-head { padding: 14px 18px; border-bottom: 1px solid var(--border,rgba(255,255,255,.08)); display: flex; align-items: center; justify-content: space-between; }
.mp-card-head h2 { font-size: 14px; font-weight: 700; margin: 0; }
.mp-card-head .badge { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 100px; }
.badge-red    { background: rgba(239,68,68,.15); color: #EF4444; border: 1px solid rgba(239,68,68,.3); }
.badge-amber  { background: rgba(245,158,11,.15); color: #F59E0B; border: 1px solid rgba(245,158,11,.3); }
.badge-green  { background: rgba(34,197,94,.15);  color: #22C55E; border: 1px solid rgba(34,197,94,.3); }
.badge-blue   { background: rgba(59,130,246,.12); color: #60A5FA; border: 1px solid rgba(59,130,246,.25); }

.mp-table { width: 100%; border-collapse: collapse; }
.mp-table th { text-align: left; font-size: 11px; font-weight: 700; color: var(--text-muted,#94A3B8); text-transform: uppercase; letter-spacing: .06em; padding: 10px 16px; background: rgba(255,255,255,.03); border-bottom: 1px solid var(--border,rgba(255,255,255,.06)); }
.mp-table td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,.04); vertical-align: middle; }
.mp-table tr:last-child td { border-bottom: none; }
.mp-table .task-link { color: var(--text,#F1F5F9); text-decoration: none; font-weight: 600; }
.mp-table .task-link:hover { color: #60A5FA; }

.mp-empty { text-align: center; padding: 40px 20px; color: var(--text-muted,#94A3B8); font-size: 13px; }
.mp-empty svg { margin-bottom: 10px; opacity: .4; }

.appeal-form-wrap { padding: 14px 18px; border-top: 1px solid var(--border,rgba(255,255,255,.08)); }
.appeal-form-wrap textarea { width: 100%; background: var(--bg,#0F172A); border: 1px solid var(--border,rgba(255,255,255,.1)); border-radius: 8px; color: #F1F5F9; padding: 10px 12px; font-size: 13px; resize: vertical; min-height: 80px; }
.mp-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; border: none; cursor: pointer; transition: .15s; }
.mp-btn-primary { background: #2563EB; color: #fff; }
.mp-btn-primary:hover { background: #1D4ED8; }
.mp-btn-ghost { background: rgba(255,255,255,.06); color: #F1F5F9; border: 1px solid rgba(255,255,255,.1); }
.mp-btn-ghost:hover { background: rgba(255,255,255,.1); }

.appeal-status-pending  { color: #F59E0B; }
.appeal-status-approved { color: #22C55E; }
.appeal-status-rejected { color: #EF4444; }
</style>

<div class="mp-wrap">
    <!-- Header -->
    <div class="mp-header">
        <h1>My Penalties</h1>
        <p>Your personal penalty history and accountability record.</p>
    </div>

    <!-- KPI strip: 30d / 90d / 12m -->
    <div class="mp-kpi-row">
        <div class="mp-kpi">
            <div class="mp-kpi-label">Last 30 Days</div>
            <div class="mp-kpi-value <?= $data['points_30d'] > 0 ? 'red' : '' ?>">
                <?= Penalty::format($data['points_30d']) ?>
            </div>
            <div class="mp-kpi-sub">Accumulated fines</div>
        </div>
        <div class="mp-kpi">
            <div class="mp-kpi-label">Last 90 Days</div>
            <div class="mp-kpi-value <?= $data['points_90d'] > 0 ? 'red' : '' ?>">
                <?= Penalty::format($data['points_90d']) ?>
            </div>
            <div class="mp-kpi-sub">Accumulated fines</div>
        </div>
        <div class="mp-kpi">
            <div class="mp-kpi-label">Last 12 Months</div>
            <div class="mp-kpi-value <?= $data['points_12m'] > 0 ? 'red' : '' ?>">
                <?= Penalty::format($data['points_12m']) ?>
            </div>
            <div class="mp-kpi-sub">Accumulated fines</div>
        </div>
    </div>

    <!-- Open Penalties (currently late tasks) -->
    <div class="mp-card">
        <div class="mp-card-head">
            <h2>Open Penalties</h2>
            <?php $openCount = count($data['open']); ?>
            <span class="badge <?= $openCount > 0 ? 'badge-red' : 'badge-green' ?>"><?= $openCount ?> active</span>
        </div>
        <?php if (empty($data['open'])): ?>
        <div class="mp-empty">
            <?= tf_icon('check-circle', 32) ?>
            <p>No open penalties. Keep it up!</p>
        </div>
        <?php else: ?>
        <table class="mp-table">
            <thead>
                <tr>
                    <th>Task</th>
                    <th>Project</th>
                    <th>Due Date</th>
                    <th>Days Late</th>
                    <th>Fine</th>
                </tr>
            </thead>
            <tbody>
            <?php foreach ($data['open'] as $t): ?>
            <tr>
                <td><a href="<?= APP_URL ?>/tasks/<?= $t['id'] ?>" class="task-link"><?= e($t['title']) ?></a></td>
                <td style="color:var(--text-muted,#94A3B8)"><?= e($t['project_name'] ?? '—') ?></td>
                <td style="color:#EF4444"><?= $t['due_date'] ? date('d/m/Y', strtotime($t['due_date'])) : '—' ?></td>
                <td><span class="badge badge-red"><?= (int)$t['late_days'] ?>d</span></td>
                <td style="font-weight:700;color:#EF4444">
                    <?php
                    // Find per-task amount from penalty_config
                    static $penaltyModel = null;
                    if (!$penaltyModel) $penaltyModel = new Penalty();
                    $cfg = $penaltyModel->getConfigByUser($_SESSION['user_id']);
                    $amt = $cfg ? (float)$cfg['amount_per_late_task'] : 0;
                    echo Penalty::format($amt);
                    ?>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php endif; ?>
    </div>

    <!-- Penalty History -->
    <div class="mp-card">
        <div class="mp-card-head">
            <h2>Penalty History</h2>
            <span class="badge badge-blue"><?= count($data['history']) ?> records</span>
        </div>
        <?php if (empty($data['history'])): ?>
        <div class="mp-empty">
            <?= tf_icon('clock', 32) ?>
            <p>No penalty history.</p>
        </div>
        <?php else: ?>
        <table class="mp-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Task</th>
                    <th>Project</th>
                    <th>Days Late</th>
                    <th>Fine</th>
                    <th>Appeal</th>
                </tr>
            </thead>
            <tbody>
            <?php foreach ($data['history'] as $h):
                $appealForThisLog = null;
                foreach ($appeals as $a) {
                    if ((int)$a['penalty_log_id'] === (int)$h['id']) { $appealForThisLog = $a; break; }
                }
            ?>
            <tr>
                <td style="color:var(--text-muted,#94A3B8)"><?= date('d/m/Y', strtotime($h['calculated_at'])) ?></td>
                <td><a href="<?= APP_URL ?>/tasks/<?= $h['task_id'] ?>" class="task-link"><?= e($h['task_title']) ?></a></td>
                <td style="color:var(--text-muted,#94A3B8)"><?= e($h['project_name'] ?? '—') ?></td>
                <td><span class="badge badge-amber"><?= (int)$h['late_days'] ?>d</span></td>
                <td style="font-weight:700"><?= Penalty::format((float)$h['amount']) ?></td>
                <td>
                    <?php if ($appealForThisLog): ?>
                        <span class="appeal-status-<?= e($appealForThisLog['status']) ?>" style="font-size:12px;font-weight:600;text-transform:capitalize">
                            <?= e($appealForThisLog['status']) ?>
                        </span>
                    <?php else: ?>
                        <button class="mp-btn mp-btn-ghost" style="padding:4px 10px;font-size:11px"
                                onclick="openAppealModal(<?= $h['id'] ?>, '<?= e(addslashes($h['task_title'])) ?>')">
                            Appeal
                        </button>
                    <?php endif; ?>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php endif; ?>
    </div>

    <!-- Appeals -->
    <?php if (!empty($appeals)): ?>
    <div class="mp-card">
        <div class="mp-card-head">
            <h2>My Appeals</h2>
            <span class="badge badge-amber"><?= count($appeals) ?> total</span>
        </div>
        <table class="mp-table">
            <thead>
                <tr><th>Task</th><th>Submitted</th><th>Status</th><th>Admin Note</th></tr>
            </thead>
            <tbody>
            <?php foreach ($appeals as $ap): ?>
            <tr>
                <td><a href="<?= APP_URL ?>/tasks/<?= $ap['task_id'] ?>" class="task-link"><?= e($ap['task_title']) ?></a></td>
                <td style="color:var(--text-muted,#94A3B8)"><?= date('d/m/Y', strtotime($ap['created_at'])) ?></td>
                <td><span class="appeal-status-<?= e($ap['status']) ?>" style="font-size:12px;font-weight:700;text-transform:capitalize"><?= e($ap['status']) ?></span></td>
                <td style="color:var(--text-muted,#94A3B8)"><?= e($ap['admin_note'] ?? '—') ?></td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php endif; ?>
</div>

<!-- Appeal modal -->
<div id="appealModal" style="display:none;position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center" class="hidden">
    <div style="background:var(--surface,#1E293B);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:16px;padding:24px;width:460px;max-width:95vw">
        <h3 style="margin:0 0 4px;font-size:16px;font-weight:700">Submit Appeal</h3>
        <p id="appealTaskLabel" style="margin:0 0 16px;font-size:13px;color:var(--text-muted,#94A3B8)"></p>
        <form id="appealForm" onsubmit="submitAppeal(event)">
            <input type="hidden" id="appealLogId" name="penalty_log_id" value="">
            <input type="hidden" name="csrf_token" value="<?= csrf_token() ?>">
            <textarea name="reason" id="appealReason" placeholder="Explain why you believe this penalty should be removed or reduced…" style="width:100%;background:rgba(0,0,0,.3);border:1px solid var(--border,rgba(255,255,255,.1));border-radius:8px;color:#F1F5F9;padding:10px 12px;font-size:13px;resize:vertical;min-height:100px;box-sizing:border-box" required></textarea>
            <div style="display:flex;gap:10px;margin-top:14px;justify-content:flex-end">
                <button type="button" class="mp-btn mp-btn-ghost" onclick="closeAppealModal()">Cancel</button>
                <button type="submit" class="mp-btn mp-btn-primary">Submit Appeal</button>
            </div>
        </form>
    </div>
</div>

<script>
function openAppealModal(logId, taskTitle) {
    document.getElementById('appealLogId').value = logId;
    document.getElementById('appealTaskLabel').textContent = 'Task: ' + taskTitle;
    document.getElementById('appealReason').value = '';
    const modal = document.getElementById('appealModal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}
function closeAppealModal() {
    const modal = document.getElementById('appealModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}
async function submitAppeal(e) {
    e.preventDefault();
    const form = e.target;
    const fd   = new FormData(form);
    try {
        const r = await fetch('<?= APP_URL ?>/penalties/appeal', { method: 'POST', body: fd });
        const j = await r.json();
        if (j.ok) { location.reload(); }
        else { alert(j.error || 'Error submitting appeal.'); }
    } catch(err) { alert('Network error.'); }
}
</script>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
