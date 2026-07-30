<?php
$pageTitle   = 'Accountability';
$currentPage = 'ceo-accountability';
ob_start();
?>
<style>
:root {
    --acc-red:    #EF4444;
    --acc-amber:  #F59E0B;
    --acc-green:  #22C55E;
    --acc-blue:   #3B82F6;
    --acc-surface:#1E293B;
    --acc-border: rgba(255,255,255,.08);
    --acc-text:   #F1F5F9;
    --acc-muted:  #94A3B8;
}
.acc-wrap { max-width: 1300px; margin: 0 auto; padding: 0 0 60px; }
.acc-header { padding: 24px 0 20px; border-bottom: 1px solid var(--acc-border); margin-bottom: 28px; display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.acc-header h1 { font-size: 26px; font-weight: 800; margin: 0 0 4px; color: var(--acc-text); }
.acc-header p  { font-size: 13px; color: var(--acc-muted); margin: 0; }
.acc-badge-readonly { background:rgba(59,130,246,.12); color:#60A5FA; border:1px solid rgba(59,130,246,.25); border-radius:100px; padding:4px 12px; font-size:12px; font-weight:700; }

/* Score card */
.acc-score-card { background: var(--acc-surface); border: 1px solid var(--acc-border); border-radius: 20px; padding: 28px 32px; margin-bottom: 24px; display: flex; align-items: center; gap: 32px; flex-wrap: wrap; }
.acc-score-circle { width: 120px; height: 120px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-direction: column; flex-shrink: 0; }
.acc-score-number { font-size: 36px; font-weight: 900; line-height: 1; }
.acc-score-label  { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--acc-muted); margin-top: 4px; }
.acc-score-meta { flex: 1; min-width: 200px; }
.acc-score-meta h2 { font-size: 20px; font-weight: 800; margin: 0 0 8px; }
.acc-score-meta p  { font-size: 13px; color: var(--acc-muted); margin: 0; line-height: 1.6; }
.acc-score-kpis { display: flex; gap: 24px; flex-wrap: wrap; }
.acc-score-kpi .k  { font-size: 22px; font-weight: 800; }
.acc-score-kpi .kl { font-size: 11px; font-weight: 700; color: var(--acc-muted); text-transform: uppercase; letter-spacing: .06em; }

/* KPI grid */
.acc-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 24px; }
.acc-kpi { background: var(--acc-surface); border: 1px solid var(--acc-border); border-radius: 14px; padding: 18px; border-left: 3px solid transparent; }
.acc-kpi.red    { border-left-color: var(--acc-red); }
.acc-kpi.amber  { border-left-color: var(--acc-amber); }
.acc-kpi.green  { border-left-color: var(--acc-green); }
.acc-kpi.blue   { border-left-color: var(--acc-blue); }
.acc-kpi .label { font-size: 11px; font-weight: 700; color: var(--acc-muted); text-transform: uppercase; letter-spacing: .07em; margin-bottom: 6px; }
.acc-kpi .val   { font-size: 28px; font-weight: 800; line-height: 1; }
.acc-kpi .sub   { font-size: 11px; color: var(--acc-muted); margin-top: 4px; }
.acc-kpi.red   .val { color: var(--acc-red); }
.acc-kpi.amber .val { color: var(--acc-amber); }
.acc-kpi.green .val { color: var(--acc-green); }
.acc-kpi.blue  .val { color: var(--acc-blue); }

/* Cards */
.acc-card { background: var(--acc-surface); border: 1px solid var(--acc-border); border-radius: 14px; overflow: hidden; margin-bottom: 20px; }
.acc-card-head { padding: 14px 18px; border-bottom: 1px solid var(--acc-border); display: flex; align-items: center; justify-content: space-between; }
.acc-card-head h2 { font-size: 14px; font-weight: 700; margin: 0; }

.acc-table { width: 100%; border-collapse: collapse; }
.acc-table th { text-align: left; font-size: 11px; font-weight: 700; color: var(--acc-muted); text-transform: uppercase; letter-spacing: .06em; padding: 10px 16px; background: rgba(255,255,255,.03); border-bottom: 1px solid rgba(255,255,255,.06); }
.acc-table td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,.04); vertical-align: middle; }
.acc-table tr:last-child td { border-bottom: none; }

.risk-pill { border-radius: 100px; padding: 3px 10px; font-size: 11px; font-weight: 700; }
.risk-high   { background: rgba(239,68,68,.15);  color: #EF4444; border: 1px solid rgba(239,68,68,.3);  }
.risk-medium { background: rgba(245,158,11,.15); color: #F59E0B; border: 1px solid rgba(245,158,11,.3); }
.risk-low    { background: rgba(59,130,246,.12); color: #60A5FA; border: 1px solid rgba(59,130,246,.25); }

/* Trend chart */
.acc-trend { display: flex; align-items: flex-end; gap: 6px; height: 60px; padding: 0 18px 14px; }
.acc-trend-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.acc-trend-bar { width: 100%; border-radius: 4px 4px 0 0; background: rgba(239,68,68,.5); min-height: 3px; transition: height .3s; }
.acc-trend-label { font-size: 10px; color: var(--acc-muted); white-space: nowrap; }

.acc-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media(max-width:800px){ .acc-two-col { grid-template-columns: 1fr; } }

.acc-empty { text-align:center; padding:32px; color:var(--acc-muted); font-size:13px; }

/* Active rules list */
.rule-chip { display:inline-flex; align-items:center; gap:6px; background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.25); border-radius:8px; padding:6px 12px; font-size:12px; font-weight:600; color:#4ADE80; margin:4px; }
.rule-chip.inactive { background:rgba(255,255,255,.05); border-color:rgba(255,255,255,.1); color:var(--acc-muted); }
</style>

<?php
// Compute score color
$score = (int)$data['accountability_score'];
$scoreColor = $score >= 85 ? '#22C55E' : ($score >= 65 ? '#F59E0B' : '#EF4444');
$scoreLabel = $score >= 85 ? 'Excellent' : ($score >= 65 ? 'Needs Attention' : 'Critical');
$maxTrend   = max(array_column($data['trend'], 'cnt') ?: [1]);
?>

<div class="acc-wrap">
    <!-- Header -->
    <div class="acc-header">
        <div>
            <h1>Accountability Dashboard</h1>
            <p>Organization-wide penalty & accountability overview · Read-only</p>
        </div>
        <span class="acc-badge-readonly">Read Only</span>
    </div>

    <!-- Accountability Score -->
    <div class="acc-score-card">
        <div class="acc-score-circle" style="background: conic-gradient(<?= $scoreColor ?> <?= $score ?>%, rgba(255,255,255,.06) 0); outline: 4px solid rgba(255,255,255,.04); outline-offset: 4px;">
            <div class="acc-score-number" style="color:<?= $scoreColor ?>"><?= $score ?></div>
            <div class="acc-score-label">Score</div>
        </div>
        <div class="acc-score-meta">
            <h2>Accountability Score: <span style="color:<?= $scoreColor ?>"><?= $scoreLabel ?></span></h2>
            <p>Percentage of active users with zero penalties in the last 30 days.<br>
               <?= (int)$data['penalized_30d'] ?> of <?= (int)$data['total_users'] ?> active users have received a penalty this month.</p>
        </div>
        <div class="acc-score-kpis">
            <div class="acc-score-kpi">
                <div class="k" style="color:var(--acc-red)"><?= (int)$data['penalized_30d'] ?></div>
                <div class="kl">Penalized (30d)</div>
            </div>
            <div class="acc-score-kpi">
                <div class="k" style="color:var(--acc-blue)"><?= (int)$data['total_users'] ?></div>
                <div class="kl">Active Users</div>
            </div>
            <div class="acc-score-kpi">
                <div class="k"><?= count($data['repeated_violations']) ?></div>
                <div class="kl">Repeat Offenders</div>
            </div>
        </div>
    </div>

    <!-- Penalty trend -->
    <div class="acc-card" style="margin-bottom:24px">
        <div class="acc-card-head">
            <h2>6-Month Penalty Trend</h2>
            <span style="font-size:12px;color:var(--acc-muted)"><?= array_sum(array_column($data['trend'],'cnt')) ?> total penalties</span>
        </div>
        <?php if (empty($data['trend'])): ?>
        <div class="acc-empty">No penalty data in the last 6 months.</div>
        <?php else: ?>
        <div style="padding:18px 18px 0">
            <div class="acc-trend">
                <?php foreach ($data['trend'] as $t):
                    $h = $maxTrend > 0 ? max(3, round($t['cnt'] / $maxTrend * 54)) : 3;
                ?>
                <div class="acc-trend-bar-wrap">
                    <div style="font-size:11px;font-weight:700;color:var(--acc-muted);text-align:center"><?= $t['cnt'] ?></div>
                    <div class="acc-trend-bar" style="height:<?= $h ?>px"></div>
                    <div class="acc-trend-label"><?= substr($t['month'], 5) ?>/<?= substr($t['month'], 2, 2) ?></div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
        <div style="padding:0 18px 14px;display:flex;gap:20px;flex-wrap:wrap">
            <?php foreach ($data['trend'] as $t): ?>
            <span style="font-size:12px;color:var(--acc-muted)"><?= $t['month'] ?>: <?= Penalty::format((float)$t['vnd']) ?></span>
            <?php endforeach; ?>
        </div>
        <?php endif; ?>
    </div>

    <div class="acc-two-col">
        <!-- High Risk Users -->
        <div class="acc-card">
            <div class="acc-card-head">
                <h2>High Risk Users</h2>
                <span style="font-size:12px;color:var(--acc-muted)">3+ penalties in 90 days</span>
            </div>
            <?php if (empty($data['high_risk_users'])): ?>
            <div class="acc-empty">No high-risk users.</div>
            <?php else: ?>
            <table class="acc-table">
                <thead><tr><th>User</th><th>Store</th><th>Penalties</th><th>Max Late</th><th>Total</th></tr></thead>
                <tbody>
                <?php foreach ($data['high_risk_users'] as $u):
                    $risk = $u['cnt'] >= 5 ? 'high' : 'medium';
                ?>
                <tr>
                    <td style="font-weight:600"><?= e($u['name']) ?></td>
                    <td style="color:var(--acc-muted)"><?= e($u['store_name'] ?? '—') ?></td>
                    <td><span class="risk-pill risk-<?= $risk ?>"><?= (int)$u['cnt'] ?></span></td>
                    <td style="color:var(--acc-amber)"><?= (int)$u['max_late'] ?>d</td>
                    <td style="font-weight:700;color:var(--acc-red)"><?= Penalty::format((float)$u['total_vnd']) ?></td>
                </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
            <?php endif; ?>
        </div>

        <!-- High Risk Stores -->
        <div class="acc-card">
            <div class="acc-card-head">
                <h2>High Risk Stores</h2>
                <span style="font-size:12px;color:var(--acc-muted)">3+ penalties in 90 days</span>
            </div>
            <?php if (empty($data['high_risk_stores'])): ?>
            <div class="acc-empty">No high-risk stores.</div>
            <?php else: ?>
            <table class="acc-table">
                <thead><tr><th>Store</th><th>Penalties</th><th>Total Fine</th></tr></thead>
                <tbody>
                <?php foreach ($data['high_risk_stores'] as $s):
                    $risk = $s['cnt'] >= 5 ? 'high' : 'medium';
                ?>
                <tr>
                    <td style="font-weight:600"><?= e($s['name'] ?? '—') ?></td>
                    <td><span class="risk-pill risk-<?= $risk ?>"><?= (int)$s['cnt'] ?></span></td>
                    <td style="font-weight:700;color:var(--acc-red)"><?= Penalty::format((float)$s['total_vnd']) ?></td>
                </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
            <?php endif; ?>
        </div>
    </div>

    <!-- Repeated Violations -->
    <div class="acc-card">
        <div class="acc-card-head">
            <h2>Repeated Violations</h2>
            <span style="font-size:12px;color:var(--acc-muted)">Users with 2+ penalty events (all time)</span>
        </div>
        <?php if (empty($data['repeated_violations'])): ?>
        <div class="acc-empty">No repeated violations recorded.</div>
        <?php else: ?>
        <table class="acc-table">
            <thead><tr><th>User</th><th>Store</th><th>Violations</th><th>Last Event</th><th>Coaching Opportunity</th></tr></thead>
            <tbody>
            <?php foreach ($data['repeated_violations'] as $r): ?>
            <tr>
                <td style="font-weight:600"><?= e($r['name']) ?></td>
                <td style="color:var(--acc-muted)"><?= e($r['store_name'] ?? '—') ?></td>
                <td><span class="risk-pill <?= $r['violations'] >= 5 ? 'risk-high' : 'risk-medium' ?>"><?= (int)$r['violations'] ?></span></td>
                <td style="color:var(--acc-muted)"><?= $r['last_at'] ? date('d/m/Y', strtotime($r['last_at'])) : '—' ?></td>
                <td>
                    <?php if ($r['violations'] >= 3): ?>
                    <span style="font-size:11px;padding:3px 8px;border-radius:6px;background:rgba(245,158,11,.12);color:#F59E0B;border:1px solid rgba(245,158,11,.25)">1:1 recommended</span>
                    <?php else: ?>
                    <span style="font-size:11px;color:var(--acc-muted)">Monitor</span>
                    <?php endif; ?>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php endif; ?>
    </div>

    <!-- Active Penalty Rules (read-only) -->
    <div class="acc-card">
        <div class="acc-card-head">
            <h2>Active Penalty Rules</h2>
            <span style="font-size:12px;color:var(--acc-muted)">Configured by Admin</span>
        </div>
        <div style="padding:16px 18px">
            <?php if (empty($rules)): ?>
            <p style="color:var(--acc-muted);font-size:13px;margin:0">No active rules configured.</p>
            <?php else: ?>
            <?php foreach ($rules as $r): ?>
            <span class="rule-chip">
                <?= e($r['name']) ?> — <?= Penalty::format((float)$r['suggested_amount'], $r['currency']) ?>
            </span>
            <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </div>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
