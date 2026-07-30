<?php
$pageTitle   = 'Team Penalties';
$currentPage = 'manager-penalties';
ob_start();
?>
<style>
.mgr-wrap { max-width: 1100px; margin: 0 auto; padding: 0 0 60px; }
.mgr-header { padding: 24px 0 20px; border-bottom: 1px solid var(--border,rgba(255,255,255,.08)); margin-bottom: 28px; }
.mgr-header h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
.mgr-header p  { font-size: 13px; color: var(--text-muted,#94A3B8); margin: 0; }

.mgr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-bottom: 28px; }
.mgr-kpi { background: var(--surface,#1E293B); border: 1px solid var(--border,rgba(255,255,255,.08)); border-radius: 14px; padding: 18px; }
.mgr-kpi .label { font-size: 11px; font-weight: 700; color: var(--text-muted,#94A3B8); text-transform: uppercase; letter-spacing: .07em; }
.mgr-kpi .val   { font-size: 26px; font-weight: 800; margin: 6px 0 2px; }
.mgr-kpi .sub   { font-size: 11px; color: var(--text-muted,#94A3B8); }
.mgr-kpi.red  .val { color: #EF4444; }
.mgr-kpi.blue .val { color: #3B82F6; }

.mgr-card { background: var(--surface,#1E293B); border: 1px solid var(--border,rgba(255,255,255,.08)); border-radius: 14px; overflow: hidden; margin-bottom: 20px; }
.mgr-card-head { padding: 14px 18px; border-bottom: 1px solid var(--border,rgba(255,255,255,.08)); display: flex; align-items: center; justify-content: space-between; }
.mgr-card-head h2 { font-size: 14px; font-weight: 700; margin: 0; }

.mgr-table { width: 100%; border-collapse: collapse; }
.mgr-table th { text-align: left; font-size: 11px; font-weight: 700; color: var(--text-muted,#94A3B8); text-transform: uppercase; letter-spacing: .06em; padding: 10px 16px; background: rgba(255,255,255,.03); border-bottom: 1px solid var(--border,rgba(255,255,255,.06)); }
.mgr-table td { padding: 11px 16px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,.04); vertical-align: middle; }
.mgr-table tr:last-child td { border-bottom: none; }

.badge-red   { background:rgba(239,68,68,.15);  color:#EF4444; border:1px solid rgba(239,68,68,.3);  border-radius:100px; padding:2px 8px; font-size:11px; font-weight:700; }
.badge-amber { background:rgba(245,158,11,.15); color:#F59E0B; border:1px solid rgba(245,158,11,.3); border-radius:100px; padding:2px 8px; font-size:11px; font-weight:700; }
.badge-green { background:rgba(34,197,94,.15);  color:#22C55E; border:1px solid rgba(34,197,94,.3);  border-radius:100px; padding:2px 8px; font-size:11px; font-weight:700; }

.mgr-empty { text-align:center; padding:40px 20px; color:var(--text-muted,#94A3B8); font-size:13px; }

.coaching-tag { font-size:11px; padding:3px 8px; border-radius:6px; background:rgba(245,158,11,.12); color:#F59E0B; border:1px solid rgba(245,158,11,.25); }
</style>

<div class="mgr-wrap">
    <div class="mgr-header">
        <h1>Team Penalties</h1>
        <p>Penalty status for your store(s) this month.</p>
    </div>

    <?php if (empty($data['stores'])): ?>
    <div style="background:var(--surface,#1E293B);border:1px solid var(--border,rgba(255,255,255,.08));border-radius:14px;padding:40px;text-align:center;color:var(--text-muted,#94A3B8)">
        <p>No stores assigned to your account. Contact an administrator.</p>
    </div>
    <?php else: ?>

    <!-- Store summaries -->
    <div class="mgr-grid">
        <?php foreach ($data['store_summaries'] as $ss):
            $hasPenalties = $ss['penalty_count'] > 0;
        ?>
        <div class="mgr-kpi <?= $hasPenalties ? 'red' : '' ?>">
            <div class="label"><?= e($ss['store_name']) ?></div>
            <div class="val"><?= (int)$ss['penalty_count'] ?></div>
            <div class="sub"><?= Penalty::format((float)$ss['total_vnd']) ?> · <?= (int)$ss['members'] ?> members</div>
        </div>
        <?php endforeach; ?>
    </div>

    <!-- Member penalties table -->
    <div class="mgr-card">
        <div class="mgr-card-head">
            <h2>Member Penalties (This Month)</h2>
            <span style="font-size:12px;color:var(--text-muted,#94A3B8)"><?= count($data['members']) ?> members</span>
        </div>
        <?php if (empty($data['members'])): ?>
        <div class="mgr-empty">No member penalty data available.</div>
        <?php else: ?>
        <table class="mgr-table">
            <thead>
                <tr>
                    <th>Member</th>
                    <th>Store</th>
                    <th>Penalties</th>
                    <th>Total Fine</th>
                    <th>Max Overdue</th>
                    <th>Coaching</th>
                </tr>
            </thead>
            <tbody>
            <?php foreach ($data['members'] as $m):
                $needsCoaching = (int)$m['penalty_count'] >= 2 || (int)$m['max_overdue'] >= 7;
            ?>
            <tr>
                <td>
                    <div style="display:flex;align-items:center;gap:10px">
                        <div style="width:28px;height:28px;border-radius:50%;background:var(--accent,#3B82F6);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700"><?= strtoupper(substr($m['name'],0,1)) ?></div>
                        <span style="font-weight:600"><?= e($m['name']) ?></span>
                    </div>
                </td>
                <td style="color:var(--text-muted,#94A3B8)"><?= e($m['store_name'] ?? '—') ?></td>
                <td>
                    <?php if ((int)$m['penalty_count'] > 0): ?>
                    <span class="badge-red"><?= (int)$m['penalty_count'] ?></span>
                    <?php else: ?>
                    <span class="badge-green">0</span>
                    <?php endif; ?>
                </td>
                <td style="font-weight:700<?= (float)$m['total_vnd'] > 0 ? ';color:#EF4444' : '' ?>">
                    <?= (float)$m['total_vnd'] > 0 ? Penalty::format((float)$m['total_vnd']) : '—' ?>
                </td>
                <td>
                    <?php if ((int)$m['max_overdue'] > 0): ?>
                    <span class="badge-amber"><?= (int)$m['max_overdue'] ?>d</span>
                    <?php else: ?>
                    <span style="color:var(--text-muted,#94A3B8)">—</span>
                    <?php endif; ?>
                </td>
                <td>
                    <?php if ($needsCoaching): ?>
                    <span class="coaching-tag">Coaching needed</span>
                    <?php else: ?>
                    <span style="color:var(--text-muted,#94A3B8);font-size:12px">—</span>
                    <?php endif; ?>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php endif; ?>
    </div>

    <!-- Open Appeals -->
    <?php $myAppeals = array_filter($appeals, function($a) use ($data) {
        // Show appeals from users in this manager's stores
        return true; // All pending shown (controller scoped to store already)
    });
    ?>
    <div class="mgr-card">
        <div class="mgr-card-head">
            <h2>Open Appeals</h2>
            <span style="font-size:12px;color:var(--text-muted,#94A3B8)"><?= count($appeals) ?> pending</span>
        </div>
        <?php if (empty($appeals)): ?>
        <div class="mgr-empty">No pending appeals.</div>
        <?php else: ?>
        <table class="mgr-table">
            <thead>
                <tr><th>User</th><th>Task</th><th>Fine</th><th>Reason</th><th>Submitted</th></tr>
            </thead>
            <tbody>
            <?php foreach ($appeals as $ap): ?>
            <tr>
                <td style="font-weight:600"><?= e($ap['user_name']) ?></td>
                <td><a href="<?= APP_URL ?>/tasks/<?= $ap['task_id'] ?>" style="color:var(--text,#F1F5F9);text-decoration:none;font-size:13px"><?= e(mb_strimwidth($ap['task_title'],0,40,'…')) ?></a></td>
                <td style="font-weight:700"><?= Penalty::format((float)$ap['amount']) ?></td>
                <td style="color:var(--text-muted,#94A3B8);font-size:12px"><?= e(mb_strimwidth($ap['reason'],0,60,'…')) ?></td>
                <td style="color:var(--text-muted,#94A3B8)"><?= date('d/m/Y', strtotime($ap['created_at'])) ?></td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <div style="padding:12px 18px;font-size:12px;color:var(--text-muted,#94A3B8);border-top:1px solid var(--border,rgba(255,255,255,.06))">
            Appeals are reviewed by Admin. Contact admin to expedite.
        </div>
        <?php endif; ?>
    </div>

    <?php endif; ?>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
