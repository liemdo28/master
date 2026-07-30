<?php
/**
 * Penalty Drill-Down View
 * Shows penalty data for the organization.
 * Variables: $penalties (array), $totalPoints (int), $pageTitle (string)
 */
$penalties = $penalties ?? [];
$totalPoints = $totalPoints ?? 0;
?>
<style>
.dd-penalty { max-width: 900px; margin: 0 auto; }
.dd-penalty-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.dd-penalty-stat { background: var(--bg-card); border: 1px solid var(--border-card); border-radius: var(--radius-card); padding: 20px 24px; text-align: center; min-width: 140px; }
.dd-penalty-stat-val { font-size: 32px; font-weight: 900; color: var(--accent-danger); }
.dd-penalty-stat-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--text-secondary); margin-top: 4px; }
.dd-penalty-list { display: flex; flex-direction: column; gap: 8px; }
.dd-penalty-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: var(--bg-card); border: 1px solid var(--border-card); border-radius: var(--radius-md); transition: background .15s; }
.dd-penalty-row:hover { background: var(--bg-card-raised); }
.dd-penalty-user { font-weight: 600; color: var(--text); font-size: 14px; min-width: 120px; }
.dd-penalty-rule { flex: 1; color: var(--text-secondary); font-size: 13px; }
.dd-penalty-points { font-weight: 800; font-size: 14px; color: var(--accent-danger); min-width: 40px; text-align: center; }
.dd-penalty-date { font-size: 11px; color: var(--text-muted); min-width: 80px; text-align: right; }
.dd-empty { text-align: center; padding: 48px 20px; color: var(--text-muted); }
.dd-empty svg { opacity: .3; margin-bottom: 12px; }
.dd-back { display: inline-flex; align-items: center; gap: 6px; color: var(--accent-primary); font-size: 13px; font-weight: 600; text-decoration: none; margin-bottom: 16px; padding: 6px 0; }
.dd-back:hover { opacity: .8; }
@media (max-width: 600px) {
    .dd-penalty-row { flex-wrap: wrap; gap: 6px; }
    .dd-penalty-user { min-width: auto; }
    .dd-penalty-date { min-width: auto; text-align: left; }
}
</style>

<div class="dd-penalty">
    <a href="<?= APP_URL ?>/overview" class="dd-back">
        <?= tf_icon('chevron-down', 14) ?> Back to Overview
    </a>

    <div class="dd-penalty-header">
        <h2 style="margin:0;font-size:20px;font-weight:800;color:var(--text)">⚠️ Penalties</h2>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
            <div class="dd-penalty-stat">
                <div class="dd-penalty-stat-val"><?= count($penalties) ?></div>
                <div class="dd-penalty-stat-label">Total Records</div>
            </div>
            <div class="dd-penalty-stat">
                <div class="dd-penalty-stat-val"><?= (int)$totalPoints ?></div>
                <div class="dd-penalty-stat-label">Total Points</div>
            </div>
        </div>
    </div>

    <?php if (empty($penalties)): ?>
    <div class="dd-empty">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <h3 style="margin:0 0 6px;font-size:16px;color:var(--text)">No Penalties</h3>
        <p style="margin:0;font-size:13px">No penalty records found.</p>
    </div>
    <?php else: ?>
    <div class="dd-penalty-list">
        <?php foreach ($penalties as $p): ?>
        <div class="dd-penalty-row">
            <div class="dd-penalty-user"><?= e($p['user_name'] ?? '—') ?></div>
            <div class="dd-penalty-rule"><?= e($p['rule_name'] ?? ($p['reason'] ?? '—')) ?></div>
            <div class="dd-penalty-points">-<?= (int)($p['points'] ?? $p['rule_points'] ?? 0) ?></div>
            <div class="dd-penalty-date"><?= e($p['penalized_at'] ?? ($p['created_at'] ?? '')) ?></div>
        </div>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>
</div>
