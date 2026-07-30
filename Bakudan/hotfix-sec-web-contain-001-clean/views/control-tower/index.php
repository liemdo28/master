<?php
// Phase 11 — Module 12: Control Tower View
// CEO sees the whole company in 30 seconds
?>

<?php // Phase 11.5 — Executive Digest (Morning Briefing)
include __DIR__ . '/../partials/executive_digest.php';
?>

<style>
.ct-hero {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 16px; padding: 40px; margin-bottom: 28px;
    border: 1px solid #2a2a3e; text-align: center;
}
.ct-hero .score-ring { position: relative; width: 120px; height: 120px; margin: 0 auto 16px; }
.ct-hero h2 { font-size: 24px; font-weight: 700; color: #fff; margin: 0 0 8px; }
.ct-hero .message { font-size: 14px; color: #9ca3af; }
.ct-hero .score-label { font-size: 40px; font-weight: 700; color: #fff; line-height: 120px; }

.ct-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.ct-card {
    background: var(--card-bg, #18181b); border: 1px solid var(--border, #27272a);
    border-radius: 12px; padding: 20px;
}
.ct-card h3 { font-size: 12px; font-weight: 600; color: var(--text-muted); margin: 0 0 14px; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px; }
.ct-card h3 .dot { width: 8px; height: 8px; border-radius: 50%; }
.ct-card h3 .dot.healthy { background: #00cc66; } .ct-card h3 .dot.warning { background: #ffaa00; }
.ct-card h3 .dot.critical { background: #ff4444; animation: pulse 2s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

.ct-metric { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border, #27272a); font-size: 12px; }
.ct-metric:last-child { border-bottom: none; }
.ct-metric .label { color: var(--text-muted); }
.ct-metric .value { font-weight: 600; color: var(--text-primary); }
.ct-metric .value.danger { color: #ff4444; } .ct-metric .value.warn { color: #ffaa00; }

.store-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border, #27272a); }
.store-row:last-child { border-bottom: none; }
.store-color { width: 4px; height: 24px; border-radius: 3px; flex-shrink: 0; }
.store-name { flex: 1; font-size: 12px; color: var(--text-primary); }
.store-health { display: flex; align-items: center; gap: 6px; }
.store-bar { width: 48px; height: 4px; background: #27272a; border-radius: 4px; overflow: hidden; }
.store-bar-fill { height: 100%; border-radius: 4px; }
.store-bar-fill.healthy { background: #00cc66; } .store-bar-fill.warning { background: #ffaa00; } .store-bar-fill.critical { background: #ff4444; }
.store-pct { font-size: 11px; font-weight: 600; min-width: 30px; text-align: right; }
.store-pct.healthy { color: #00cc66; } .store-pct.warning { color: #ffaa00; } .store-pct.critical { color: #ff4444; }

.emp-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border, #27272a); }
.emp-row:last-child { border-bottom: none; }
.emp-avatar { width: 28px; height: 28px; border-radius: 50%; background: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: white; flex-shrink: 0; }
.emp-info { flex: 1; }
.emp-name { font-size: 12px; font-weight: 500; color: var(--text-primary); }
.emp-meta { font-size: 10px; color: var(--text-muted); }
.exec-score { font-size: 13px; font-weight: 700; }
.exec-score.good { color: #00cc66; } .exec-score.ok { color: #ffaa00; } .exec-score.bad { color: #ff4444; }

.col-span-2 { grid-column: span 2; }

@media (max-width: 1000px) { .ct-grid { grid-template-columns: 1fr 1fr; } .col-span-2 { grid-column: span 1; } }
@media (max-width: 700px) { .ct-grid { grid-template-columns: 1fr; } }
</style>

<?php
$healthColor = $overallHealth['status'] === 'healthy' ? '#00cc66' : ($overallHealth['status'] === 'warning' ? '#ffaa00' : '#ff4444');
$healthRingColor = $overallHealth['status'] === 'healthy' ? '#00cc66' : ($overallHealth['status'] === 'warning' ? '#ffaa00' : '#ff4444');
$circumference = 2 * pi() * 48;
$dashOffset = $circumference * (1 - $overallHealth['score'] / 100);
?>

<div class="ct-hero">
    <div class="score-ring">
        <svg viewBox="0 0 120 120" width="120" height="120">
            <circle cx="60" cy="60" r="48" fill="none" stroke="#27272a" stroke-width="8"/>
            <circle cx="60" cy="60" r="48" fill="none" stroke="<?= $healthRingColor ?>" stroke-width="8"
                    stroke-dasharray="<?= $circumference ?>" stroke-dashoffset="<?= $dashOffset ?>"
                    stroke-linecap="round" transform="rotate(-90 60 60)"
                    style="transition: stroke-dashoffset 1s"/>
        </svg>
        <div class="score-label" style="position:absolute;top:0;left:0;right:0;text-align:center;line-height:120px;color:<?= $healthColor ?>">
            <?= $overallHealth['score'] ?>
        </div>
    </div>
    <h2>Control Tower</h2>
    <p class="message"><?= e($overallHealth['message']) ?></p>
</div>

<div class="ct-grid">
    <!-- STORES -->
    <div class="ct-card">
        <h3><span class="dot <?= !empty(array_filter($stores, fn($s) => $s['status'] === 'critical')) ? 'critical' : (!empty(array_filter($stores, fn($s) => $s['status'] === 'warning')) ? 'warning' : 'healthy') ?>"></span> Stores</h3>
        <?php if (empty($stores)): ?>
            <p style="font-size:12px;color:var(--text-muted)">No stores</p>
        <?php else: ?>
            <?php foreach (array_slice($stores, 0, 6) as $s): ?>
                <div class="store-row">
                    <div class="store-color" style="background:<?= e($s['color'] ?? '#3b82f6') ?>"></div>
                    <div class="store-name"><?= e($s['name']) ?></div>
                    <div class="store-health">
                        <div class="store-bar">
                            <div class="store-bar-fill <?= e($s['status']) ?>" style="width:<?= $s['health'] ?>%"></div>
                        </div>
                        <span class="store-pct <?= e($s['status']) ?>"><?= $s['health'] ?>%</span>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>

    <!-- EMPLOYEES -->
    <div class="ct-card">
        <h3><span class="dot healthy"></span> Employees</h3>
        <?php if (empty($employees)): ?>
            <p style="font-size:12px;color:var(--text-muted)">No employees</p>
        <?php else: ?>
            <?php foreach (array_slice($employees, 0, 8) as $e): ?>
                <div class="emp-row">
                    <div class="emp-avatar"><?= strtoupper(mb_substr($e['name'],0,1)) ?></div>
                    <div class="emp-info">
                        <div class="emp-name"><?= e($e['name']) ?></div>
                        <div class="emp-meta"><?= $e['overdue'] ?> overdue · <?= $e['completed'] ?> done</div>
                    </div>
                    <span class="exec-score <?= $e['exec_score'] >= 80 ? 'good' : ($e['exec_score'] >= 50 ? 'ok' : 'bad') ?>">
                        <?= $e['exec_score'] ?>
                    </span>
                </div>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>

    <!-- PAYROLL -->
    <div class="ct-card">
        <h3><span class="dot <?= $payroll['status'] ?>"></span> Payroll</h3>
        <div class="ct-metric">
            <span class="label">Pending</span>
            <span class="value <?= $payroll['overdue'] > 0 ? 'danger' : '' ?>"><?= $payroll['pending'] ?></span>
        </div>
        <div class="ct-metric">
            <span class="label">Overdue</span>
            <span class="value <?= $payroll['overdue'] > 0 ? 'danger' : '' ?>"><?= $payroll['overdue'] ?></span>
        </div>
        <div class="ct-metric">
            <span class="label">Status</span>
            <span class="value"><?= ucfirst($payroll['status']) ?></span>
        </div>
    </div>

    <!-- RELEASES -->
    <div class="ct-card">
        <h3><span class="dot <?= $releases['status'] ?>"></span> Releases</h3>
        <div class="ct-metric"><span class="label">Draft</span><span class="value"><?= $releases['draft'] ?></span></div>
        <div class="ct-metric"><span class="label">Testing</span><span class="value"><?= $releases['testing'] ?></span></div>
        <div class="ct-metric"><span class="label">In Review</span><span class="value <?= $releases['review'] > 0 ? 'warn' : '' ?>"><?= $releases['review'] ?></span></div>
    </div>

    <!-- INCIDENTS -->
    <div class="ct-card">
        <h3><span class="dot <?= $incidents['status'] ?>"></span> Incidents</h3>
        <div class="ct-metric"><span class="label">Today</span><span class="value <?= $incidents['today'] > 0 ? 'danger' : '' ?>"><?= $incidents['today'] ?></span></div>
        <div class="ct-metric"><span class="label">This week</span><span class="value"><?= $incidents['week'] ?></span></div>
    </div>

    <!-- AUDITS -->
    <div class="ct-card">
        <h3><span class="dot <?= $audits['status'] ?>"></span> Audits</h3>
        <div class="ct-metric"><span class="label">Pending</span><span class="value <?= $audits['pending'] > 3 ? 'warn' : '' ?>"><?= $audits['pending'] ?></span></div>
    </div>
</div>
