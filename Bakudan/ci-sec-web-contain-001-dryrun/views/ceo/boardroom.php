<?php
/**
 * CEO Boardroom - strategic snapshot for board-ready operations.
 */
$currentPage = 'ceo-boardroom';
$pageTitle   = 'CEO Boardroom';
ob_start();

$db = Database::getInstance();
$today = DateService::today();
$monthStart = date('Y-m-01');

$totalTasks = $completedTasks = $overdueTasks = $openIncidents = $totalStores = $totalUsers = 0;
$totalBills = $paidThisMonth = 0.0;
$completionRate = 0.0;

try {
    $totalTasks = (int)($db->fetch("SELECT COUNT(*) as cnt FROM tasks")['cnt'] ?? 0);
    $completedTasks = (int)($db->fetch("SELECT COUNT(*) as cnt FROM tasks WHERE is_completed = 1 OR status IN ('completed','done')")['cnt'] ?? 0);
    $completionRate = $totalTasks > 0 ? round(($completedTasks / $totalTasks) * 100, 1) : 0;
    $overdueTasks = (int)($db->fetch("SELECT COUNT(*) as cnt FROM tasks WHERE due_date < ? AND is_completed = 0 AND status NOT IN ('completed','done','cancelled')", [$today])['cnt'] ?? 0);
    $totalBills = (float)($db->fetch("SELECT COALESCE(SUM(amount),0) as total FROM bills WHERE status IN ('pending','overdue')")['total'] ?? 0);
    $paidThisMonth = (float)($db->fetch("SELECT COALESCE(SUM(amount),0) as total FROM bills WHERE status = 'paid' AND updated_at >= ?", [$monthStart])['total'] ?? 0);
    $totalStores = (int)($db->fetch("SELECT COUNT(*) as cnt FROM stores")['cnt'] ?? 0);
    $totalUsers = (int)($db->fetch("SELECT COUNT(*) as cnt FROM users WHERE is_active = 1")['cnt'] ?? 0);
    if ($db->tableExists('incidents')) {
        $openIncidents = (int)($db->fetch("SELECT COUNT(*) as cnt FROM incidents WHERE status NOT IN ('resolved','closed','cancelled')")['cnt'] ?? 0);
    }
} catch (\Throwable $e) {
}

$storePerformance = [];
try {
    $storePerformance = $db->fetchAll("
        SELECT s.id, s.name, s.color,
               COUNT(DISTINCT rt.id) as total_tasks,
               COALESCE(SUM(CASE WHEN rt.is_completed = 1 OR rt.status IN ('completed','done') THEN 1 ELSE 0 END),0) as completed,
               COALESCE(SUM(CASE WHEN rt.due_date < ? AND rt.is_completed = 0 AND rt.status NOT IN ('completed','done','cancelled') THEN 1 ELSE 0 END),0) as overdue
        FROM stores s
        LEFT JOIN (
            SELECT t.id, t.is_completed, t.status, t.due_date,
                   COALESCE(t.direct_store_id, p.store_id) as resolved_store_id
            FROM tasks t
            LEFT JOIN projects p ON p.id = t.project_id
        ) rt ON rt.resolved_store_id = s.id
        GROUP BY s.id, s.name, s.color
        ORDER BY overdue DESC, total_tasks DESC, s.name
        LIMIT 20
    ", [$today]);
} catch (\Throwable $e) {
}

$riskLabel = $overdueTasks > 20 ? 'Needs attention' : ($overdueTasks > 0 ? 'Watch closely' : 'Healthy');
$riskClass = $overdueTasks > 20 ? 'danger' : ($overdueTasks > 0 ? 'warn' : 'good');
?>
<style>
.boardroom{max-width:1500px;margin:0 auto;padding:6px 0 36px;color:#e5e7eb}
.br-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:end;padding:22px 24px;margin-bottom:20px;border:1px solid #1f3b57;border-radius:12px;background:linear-gradient(135deg,#101a2b 0%,#111827 52%,#0b1220 100%)}
.br-eyebrow{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7dd3fc;font-weight:800;margin-bottom:8px}
.br-title{font-size:32px;line-height:1.05;margin:0 0 8px;font-weight:900;color:#f8fafc;letter-spacing:0}
.br-subtitle{margin:0;color:#9ca3af;font-size:14px}
.br-status{min-width:180px;text-align:right}
.br-status-num{font-size:42px;line-height:1;font-weight:900}
.br-status-pill{display:inline-flex;margin-top:8px;padding:5px 10px;border-radius:999px;font-size:12px;font-weight:800;border:1px solid}
.br-status-pill.good{color:#22c55e;background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.35)}
.br-status-pill.warn{color:#fbbf24;background:rgba(251,191,36,.12);border-color:rgba(251,191,36,.35)}
.br-status-pill.danger{color:#fb7185;background:rgba(251,113,133,.12);border-color:rgba(251,113,133,.35)}
.br-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}
.br-card{border:1px solid #244466;border-radius:10px;background:#111827;padding:17px 18px;min-height:112px}
.br-card.blue{border-left:4px solid #38bdf8}.br-card.red{border-left:4px solid #fb7185}.br-card.green{border-left:4px solid #22c55e}.br-card.purple{border-left:4px solid #a78bfa}
.br-card-label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:800}
.br-card-value{font-size:31px;line-height:1.1;margin-top:10px;font-weight:900;color:#f8fafc}
.br-card-note{font-size:12px;color:#9ca3af;margin-top:7px}
.br-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px}
.br-panel{border:1px solid #244466;border-radius:10px;background:#101827;overflow:hidden}
.br-panel-head{display:flex;align-items:center;justify-content:space-between;padding:15px 18px;border-bottom:1px solid #1f3b57}
.br-panel-title{font-size:15px;font-weight:900;color:#f8fafc}
.br-panel-meta{font-size:12px;color:#94a3b8}
.br-table{width:100%;border-collapse:collapse}
.br-table th{padding:11px 18px;text-align:left;font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:#8ea7c2;background:#0f172a;border-bottom:1px solid #1f3b57}
.br-table td{padding:13px 18px;border-bottom:1px solid rgba(148,163,184,.14);font-size:13px;color:#dbeafe}
.br-table tr:last-child td{border-bottom:0}
.br-store{display:flex;align-items:center;gap:9px;font-weight:800;color:#f8fafc;text-decoration:none}
.br-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto;background:#64748b}
.br-rate{display:inline-flex;min-width:52px;justify-content:center;padding:4px 8px;border-radius:8px;font-weight:900;font-size:12px}
.br-rate.good{background:rgba(34,197,94,.13);color:#4ade80}.br-rate.warn{background:rgba(251,191,36,.13);color:#fbbf24}.br-rate.danger{background:rgba(251,113,133,.13);color:#fb7185}
.br-side{display:grid;gap:16px;align-content:start}
.br-actions{display:grid;gap:9px;padding:14px}
.br-action{display:flex;align-items:center;justify-content:space-between;padding:12px 13px;border:1px solid #31506f;border-radius:8px;color:#e5e7eb;text-decoration:none;font-weight:800;background:#121a2a}
.br-action:hover{border-color:#60a5fa;background:#132036}
.br-empty{padding:32px;text-align:center;color:#94a3b8}
@media (max-width:1100px){.br-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.br-layout{grid-template-columns:1fr}.br-status{text-align:left}}
@media (max-width:700px){.br-hero{grid-template-columns:1fr;padding:18px}.br-kpis{grid-template-columns:1fr}.br-title{font-size:26px}.br-table th:nth-child(3),.br-table td:nth-child(3){display:none}}
</style>

<div class="boardroom">
    <section class="br-hero">
        <div>
            <div class="br-eyebrow">Executive Snapshot</div>
            <h1 class="br-title">CEO Boardroom</h1>
            <p class="br-subtitle">Strategic overview for <?= e(date('F j, Y')) ?> across <?= (int)$totalStores ?> stores and <?= (int)$totalUsers ?> active team members.</p>
        </div>
        <div class="br-status">
            <div class="br-status-num"><?= e((string)$completionRate) ?>%</div>
            <span class="br-status-pill <?= e($riskClass) ?>"><?= e($riskLabel) ?></span>
        </div>
    </section>

    <section class="br-kpis" aria-label="Boardroom KPIs">
        <div class="br-card blue">
            <div class="br-card-label">Task Completion</div>
            <div class="br-card-value"><?= e((string)$completionRate) ?>%</div>
            <div class="br-card-note"><?= number_format($completedTasks) ?> of <?= number_format($totalTasks) ?> tasks complete</div>
        </div>
        <div class="br-card red">
            <div class="br-card-label">Overdue Tasks</div>
            <div class="br-card-value" style="color:<?= $overdueTasks > 0 ? '#fb7185' : '#4ade80' ?>"><?= number_format($overdueTasks) ?></div>
            <div class="br-card-note"><?= $overdueTasks > 0 ? 'Requires follow-up' : 'All clear' ?></div>
        </div>
        <div class="br-card green">
            <div class="br-card-label">Paid This Month</div>
            <div class="br-card-value">$<?= number_format($paidThisMonth, 0) ?></div>
            <div class="br-card-note">$<?= number_format($totalBills, 0) ?> still outstanding</div>
        </div>
        <div class="br-card purple">
            <div class="br-card-label">Open Incidents</div>
            <div class="br-card-value" style="color:<?= $openIncidents > 0 ? '#fbbf24' : '#4ade80' ?>"><?= number_format($openIncidents) ?></div>
            <div class="br-card-note"><?= number_format($totalStores) ?> stores monitored</div>
        </div>
    </section>

    <div class="br-layout">
        <section class="br-panel">
            <div class="br-panel-head">
                <div class="br-panel-title">Store Performance</div>
                <div class="br-panel-meta">Resolved by assigned store</div>
            </div>
            <?php if (empty($storePerformance)): ?>
                <div class="br-empty">No store performance data available.</div>
            <?php else: ?>
                <table class="br-table">
                    <thead>
                        <tr>
                            <th>Store</th>
                            <th>Tasks</th>
                            <th>Completed</th>
                            <th>Overdue</th>
                            <th>Rate</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($storePerformance as $sp):
                            $total = (int)($sp['total_tasks'] ?? 0);
                            $done = (int)($sp['completed'] ?? 0);
                            $over = (int)($sp['overdue'] ?? 0);
                            $rate = $total > 0 ? (int)round(($done / $total) * 100) : 0;
                            $rateCls = $rate >= 80 ? 'good' : ($rate >= 50 ? 'warn' : 'danger');
                        ?>
                        <tr>
                            <td>
                                <a class="br-store" href="<?= APP_URL ?>/admin/stores/<?= (int)$sp['id'] ?>">
                                    <span class="br-dot" style="background:<?= e($sp['color'] ?: '#64748b') ?>"></span>
                                    <?= e($sp['name']) ?>
                                </a>
                            </td>
                            <td><?= number_format($total) ?></td>
                            <td style="color:#4ade80;font-weight:800"><?= number_format($done) ?></td>
                            <td style="color:<?= $over > 0 ? '#fb7185' : '#94a3b8' ?>;font-weight:800"><?= number_format($over) ?></td>
                            <td><span class="br-rate <?= e($rateCls) ?>"><?= $rate ?>%</span></td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </section>

        <aside class="br-side">
            <section class="br-panel">
                <div class="br-panel-head">
                    <div class="br-panel-title">Board Actions</div>
                    <div class="br-panel-meta">Live views</div>
                </div>
                <div class="br-actions">
                    <a class="br-action" href="<?= APP_URL ?>/overview"><span>Operations Overview</span><span>View</span></a>
                    <a class="br-action" href="<?= APP_URL ?>/control-tower"><span>Control Tower</span><span>View</span></a>
                    <a class="br-action" href="<?= APP_URL ?>/manager/command"><span>Manager Command</span><span>View</span></a>
                    <a class="br-action" href="<?= APP_URL ?>/bills"><span>Payment Schedule</span><span>View</span></a>
                </div>
            </section>

            <section class="br-panel">
                <div class="br-panel-head">
                    <div class="br-panel-title">Current Risk</div>
                    <div class="br-panel-meta"><?= e($riskLabel) ?></div>
                </div>
                <div style="padding:16px 18px;color:#cbd5e1;font-size:13px;line-height:1.55">
                    <?= $overdueTasks > 0
                        ? 'Overdue work is still visible in the operating views and should be handled from the task and exception queues.'
                        : 'No overdue task risk is currently counted in the board snapshot.' ?>
                </div>
            </section>
        </aside>
    </div>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
