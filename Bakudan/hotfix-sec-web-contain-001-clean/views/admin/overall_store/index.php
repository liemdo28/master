<?php
/**
 * Overall Store Dashboard
 * CEO/Admin/Manager view of all store operational status.
 * Uses app CSS classes — NO Tailwind.
 */
$today = date('Y-m-d');
$baseUrl = APP_URL;

// t() is already defined in config/i18n.php — no fallback needed
?>

<style>
/* ── Overall Store — dark-theme aligned with site design tokens ── */
.os-wrap { padding: 0; }
.os-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
.os-header h1 { font-size: 1.5rem; font-weight: 700; margin: 0; color: #f1f5f9; }
.os-kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)); gap: 12px; margin-bottom: 24px; }
.os-kpi { background: #18181b; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 14px 16px; text-align: center; }
.os-kpi__value { font-size: 1.8rem; font-weight: 700; line-height: 1.2; color: #f1f5f9; }
.os-kpi__label { font-size: 0.78rem; color: #94a3b8; margin-top: 4px; }
.os-kpi--red .os-kpi__value { color: #f87171; }
.os-kpi--yellow .os-kpi__value { color: #fbbf24; }
.os-kpi--green .os-kpi__value { color: #4ade80; }
.os-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
.os-card { background: #18181b; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; overflow: hidden; cursor: pointer; transition: box-shadow .15s, transform .15s; }
.os-card:hover { box-shadow: 0 4px 24px rgba(0,0,0,.5); transform: translateY(-2px); border-color: rgba(255,255,255,.18); }
.os-card__bar { height: 5px; width: 100%; }
.os-card__bar--red { background: #ef4444; }
.os-card__bar--yellow { background: #f59e0b; }
.os-card__bar--green { background: #22c55e; }
.os-card__bar--gray { background: #4b5563; }
.os-card__body { padding: 16px; }
.os-card__row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.os-card__name { font-size: 1.05rem; font-weight: 600; color: #f1f5f9; margin: 0; }
.os-card__code { font-size: 0.75rem; color: #94a3b8; background: #27272a; padding: 2px 8px; border-radius: 4px; }
.os-card__manager { font-size: 0.82rem; color: #94a3b8; margin-bottom: 10px; }
.os-badge { display: inline-block; font-size: 0.72rem; font-weight: 600; padding: 3px 10px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.3px; }
.os-badge--red { background: rgba(239,68,68,.15); color: #f87171; border: 1px solid rgba(239,68,68,.3); }
.os-badge--yellow { background: rgba(245,158,11,.15); color: #fbbf24; border: 1px solid rgba(245,158,11,.3); }
.os-badge--green { background: rgba(34,197,94,.15); color: #4ade80; border: 1px solid rgba(34,197,94,.3); }
.os-badge--gray { background: rgba(107,114,128,.15); color: #9ca3af; border: 1px solid rgba(107,114,128,.3); }
.os-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; margin-top: 12px; font-size: 0.82rem; }
.os-metric { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
.os-metric__label { color: #94a3b8; }
.os-metric__val { font-weight: 600; color: #e2e8f0; cursor: pointer; text-decoration: none; }
.os-metric__val:hover { text-decoration: underline; }
.os-metric__val--red { color: #f87171; }
.os-metric__val--amber { color: #fbbf24; }
.os-divider { border: none; border-top: 1px solid rgba(255,255,255,.08); margin: 10px 0; }
.os-handler { font-size: 0.78rem; color: #94a3b8; margin-top: 8px; }
.os-handler strong { color: #cbd5e1; }
.os-activity { font-size: 0.72rem; color: #64748b; margin-top: 6px; }
.os-empty { text-align: center; padding: 60px 20px; color: #64748b; }
.os-empty__icon { font-size: 3rem; margin-bottom: 12px; }

/* Drawer */
.os-drawer-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,.6); z-index: 1000; }
.os-drawer-overlay.active { display: block; }
.os-drawer { position: fixed; top: 0; right: 0; width: 640px; max-width: 100%; height: 100vh; background: #18181b; z-index: 1001; overflow-y: auto; box-shadow: -4px 0 32px rgba(0,0,0,.6); transform: translateX(100%); transition: transform .25s ease; }
.os-drawer.active { transform: translateX(0); }
.os-drawer__header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,.1); background: #1e293b; }
.os-drawer__title { font-size: 1.2rem; font-weight: 700; margin: 0; color: #f1f5f9; }
.os-drawer__close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #94a3b8; padding: 4px 8px; border-radius: 6px; }
.os-drawer__close:hover { background: rgba(255,255,255,.08); color: #f1f5f9; }
.os-drawer__body { padding: 20px 24px; }
.os-tabs { display: flex; gap: 0; border-bottom: 2px solid rgba(255,255,255,.1); margin-bottom: 16px; overflow-x: auto; }
.os-tab { padding: 10px 14px; font-size: 0.85rem; font-weight: 500; color: #94a3b8; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; background: none; border-top: none; border-left: none; border-right: none; white-space: nowrap; }
.os-tab.active { color: #60a5fa; border-bottom-color: #60a5fa; font-weight: 600; }
.os-tab:hover { color: #e2e8f0; }
.os-tab-panel { display: none; }
.os-tab-panel.active { display: block; }
.os-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.os-table th { text-align: left; padding: 8px 10px; font-weight: 600; color: #64748b; border-bottom: 2px solid rgba(255,255,255,.1); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.3px; }
.os-table td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,.06); vertical-align: middle; color: #cbd5e1; }
.os-table tr:hover td { background: rgba(255,255,255,.04); }
.os-table tr.os-task-row--overdue td { background: rgba(239,68,68,.09); }
.os-table tr.os-task-row--due td { background: rgba(250,204,21,.10); }
.os-table tr.os-task-row--upcoming td { background: rgba(34,197,94,.08); }
.os-table tr.os-task-row--done td { background: rgba(148,163,184,.08); color: #94a3b8; }
.os-table tr.os-task-row--done .os-task-title-btn { color: #94a3b8; text-decoration: line-through; }
.os-task-title-btn { appearance: none; border: 0; background: transparent; color: #e2e8f0; font: inherit; font-weight: 600; padding: 0; text-align: left; cursor: pointer; }
.os-task-title-btn:hover { color: #93c5fd; text-decoration: underline; }
.os-action-cell { white-space: nowrap; }
.os-action-btn { border: 1px solid rgba(96,165,250,.28); background: rgba(96,165,250,.10); color: #bfdbfe; border-radius: 6px; padding: 4px 8px; font-size: .72rem; font-weight: 700; cursor: pointer; margin-right: 4px; }
.os-action-btn:hover { background: rgba(96,165,250,.18); color: #fff; }
.os-action-btn:disabled { opacity: .55; cursor: wait; }
.os-action-btn--done { border-color: rgba(34,197,94,.35); background: rgba(34,197,94,.12); color: #bbf7d0; }
.os-task-detail-card { border: 1px solid rgba(96,165,250,.28); background: #111827; border-radius: 10px; padding: 12px; margin: 0 0 14px; box-shadow: 0 12px 24px rgba(0,0,0,.22); }
.os-task-detail-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.os-task-detail-card__title { color: #f8fafc; font-weight: 700; line-height: 1.35; }
.os-task-detail-card__close { border: 0; background: transparent; color: #94a3b8; font-size: 1rem; cursor: pointer; }
.os-task-detail-card__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 10px 0; }
.os-task-detail-card__item { border: 1px solid rgba(255,255,255,.08); border-radius: 8px; padding: 8px; background: rgba(15,23,42,.7); }
.os-task-detail-card__label { display: block; color: #64748b; font-size: .68rem; text-transform: uppercase; letter-spacing: .3px; margin-bottom: 3px; }
.os-task-detail-card__value { color: #e2e8f0; font-size: .82rem; }
.os-task-detail-card__actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.os-p--urgent, .os-p--critical { color: #f87171; font-weight: 600; }
.os-p--high { color: #fb923c; font-weight: 500; }
.os-s--overdue { color: #f87171; font-weight: 600; }
.os-s--pending { color: #fbbf24; }
.os-s--completed { color: #4ade80; }
.os-s--due { color: #facc15; font-weight: 600; }
.os-s--upcoming { color: #86efac; font-weight: 600; }
.os-person { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid rgba(255,255,255,.08); border-radius: 8px; margin-bottom: 8px; }
.os-person__avatar { width: 36px; height: 36px; border-radius: 50%; background: #334155; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 600; color: #94a3b8; flex-shrink: 0; }
.os-person__info { flex: 1; min-width: 0; }
.os-person__name { font-size: 0.88rem; font-weight: 600; color: #f1f5f9; }
.os-person__role { font-size: 0.72rem; color: #64748b; }
.os-person__load { font-size: 0.78rem; color: #94a3b8; white-space: nowrap; }
.os-person__load strong { color: #e2e8f0; }
.os-drilldown-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.os-dd-card { background: #1e293b; border: 1px solid rgba(255,255,255,.1); border-radius: 8px; padding: 12px; text-align: center; cursor: pointer; transition: background .15s; }
.os-dd-card:hover { background: #334155; border-color: rgba(255,255,255,.16); }
.os-dd-card__num { font-size: 1.4rem; font-weight: 700; color: #f1f5f9; }
.os-dd-card__label { font-size: 0.72rem; color: #94a3b8; margin-top: 2px; }
.os-loading { text-align: center; padding: 40px; color: #64748b; }
.os-empty-tab { text-align: center; padding: 30px; color: #64748b; font-size: 0.88rem; }
.os-calendar-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.os-calendar-title { font-weight: 700; color: #f1f5f9; }
.os-cal-nav { width: 30px; height: 30px; border-radius: 6px; border: 1px solid rgba(255,255,255,.12); background: #0f172a; color: #cbd5e1; cursor: pointer; }
.os-cal-nav:hover { background: #1e293b; color: #fff; }
.os-calendar-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
.os-cal-stat { border: 1px solid rgba(255,255,255,.09); background: #111827; border-radius: 8px; padding: 8px; text-align: center; }
.os-cal-stat strong { display: block; color: #f8fafc; font-size: 1rem; }
.os-cal-stat span { display: block; color: #94a3b8; font-size: .68rem; margin-top: 2px; }
.os-calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
.os-cal-dow { color: #64748b; font-size: .68rem; text-align: center; font-weight: 700; padding: 4px 0; text-transform: uppercase; }
.os-cal-day { min-height: 76px; border: 1px solid rgba(255,255,255,.08); background: #0f172a; border-radius: 8px; padding: 6px; overflow: hidden; }
.os-cal-day--muted { opacity: .38; }
.os-cal-day--today { border-color: #60a5fa; box-shadow: inset 0 0 0 1px rgba(96,165,250,.35); }
.os-cal-num { color: #e2e8f0; font-size: .72rem; font-weight: 700; margin-bottom: 4px; }
.os-cal-chip { display: block; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-radius: 5px; padding: 2px 4px; margin-top: 3px; font-size: .66rem; color: #e5e7eb; background: rgba(96,165,250,.16); border: 1px solid rgba(96,165,250,.22); text-align: left; cursor: pointer; }
.os-cal-chip--done { background: rgba(148,163,184,.14); border-color: rgba(148,163,184,.24); color: #cbd5e1; text-decoration: line-through; }
.os-cal-chip--overdue { background: rgba(239,68,68,.20); border-color: rgba(239,68,68,.36); color: #fecaca; }
.os-cal-chip--due { background: rgba(250,204,21,.18); border-color: rgba(250,204,21,.34); color: #fef3c7; }
.os-cal-chip--upcoming { background: rgba(34,197,94,.16); border-color: rgba(34,197,94,.30); color: #bbf7d0; }
.os-cal-chip--bill { background: rgba(245,158,11,.14); border-color: rgba(245,158,11,.26); color: #fde68a; }
.os-cal-more { color: #94a3b8; font-size: .64rem; margin-top: 3px; }

@media (max-width: 768px) {
    .os-grid { grid-template-columns: 1fr; gap: 12px; }
    .os-kpis { grid-template-columns: repeat(2, 1fr); }
    .os-drawer { width: 100%; }
    .os-metrics { grid-template-columns: 1fr; }
    .os-drilldown-cards { grid-template-columns: 1fr 1fr; }
    .os-calendar-summary { grid-template-columns: repeat(2, 1fr); }
    .os-cal-day { min-height: 66px; padding: 4px; }
}
@media (max-width: 480px) {
    .os-kpis { grid-template-columns: 1fr 1fr; gap: 8px; }
    .os-kpi { padding: 10px 12px; }
    .os-kpi__value { font-size: 1.4rem; }
}
</style>

<div class="os-wrap">
    <div class="os-header">
        <h1><?= t('overall_store.title') ?></h1>
    </div>

    <div class="os-kpis">
        <div class="os-kpi"><div class="os-kpi__value"><?= $summary['total_stores'] ?></div><div class="os-kpi__label"><?= t('overall_store.total_stores') ?></div></div>
        <div class="os-kpi os-kpi--red"><div class="os-kpi__value"><?= $summary['red_count'] ?></div><div class="os-kpi__label"><?= t('overall_store.critical') ?></div></div>
        <div class="os-kpi os-kpi--yellow"><div class="os-kpi__value"><?= $summary['yellow_count'] ?></div><div class="os-kpi__label"><?= t('overall_store.needs_attention') ?></div></div>
        <div class="os-kpi os-kpi--green"><div class="os-kpi__value"><?= $summary['green_count'] ?></div><div class="os-kpi__label"><?= t('overall_store.healthy') ?></div></div>
        <?php if ($summary['gray_count'] > 0): ?>
        <div class="os-kpi" style="border-color:#d1d5db"><div class="os-kpi__value" style="color:#6b7280"><?= $summary['gray_count'] ?></div><div class="os-kpi__label"><?= t('overall_store.setup_incomplete') ?></div></div>
        <?php endif; ?>
        <div class="os-kpi os-kpi--red"><div class="os-kpi__value"><?= $summary['total_overdue_tasks'] ?></div><div class="os-kpi__label"><?= t('overall_store.overdue_tasks') ?></div></div>
        <div class="os-kpi os-kpi--red"><div class="os-kpi__value"><?= $summary['total_overdue_bills'] ?></div><div class="os-kpi__label"><?= t('overall_store.overdue_bills') ?></div></div>
        <div class="os-kpi"><div class="os-kpi__value"><?= $summary['total_open_tasks'] ?></div><div class="os-kpi__label"><?= t('overall_store.open_tasks') ?></div></div>
        <div class="os-kpi"><div class="os-kpi__value"><?= $summary['total_open_bills'] ?></div><div class="os-kpi__label"><?= t('overall_store.open_bills') ?></div></div>
    </div>

    <?php if (empty($stores)): ?>
        <div class="os-empty"><div class="os-empty__icon">🏪</div><p><?= t('overall_store.no_stores') ?></p></div>
    <?php else: ?>
        <div class="os-grid">
            <?php foreach ($stores as $store): ?>
            <div class="os-card" onclick="osOpenDrawer(<?= (int)$store['id'] ?>)">
                <div class="os-card__bar os-card__bar--<?= htmlspecialchars($store['health_color']) ?>"></div>
                <div class="os-card__body">
                    <div class="os-card__row">
                        <h3 class="os-card__name"><?= htmlspecialchars($store['name']) ?></h3>
                        <span class="os-badge os-badge--<?= htmlspecialchars($store['health_color']) ?>"><?= htmlspecialchars($store['health_label']) ?></span>
                    </div>
                    <?php if (!empty($store['store_code'])): ?>
                        <div style="margin-bottom:4px"><span class="os-card__code"><?= htmlspecialchars($store['store_code']) ?></span></div>
                    <?php endif; ?>
                    <?php if (!empty($store['manager_name'])): ?>
                        <div class="os-card__manager">👤 <strong><?= htmlspecialchars($store['manager_name']) ?></strong></div>
                    <?php else: ?>
                        <div class="os-card__manager" style="color:#9ca3af;font-style:italic">⚠️ <?= e(t('overall_store.manager_not_assigned')) ?></div>
                    <?php endif; ?>
                    <?php if (!empty($store['top_issue'])): ?>
                        <?php
                        $tiColors = [
                            'red'    => ['bg'=>'rgba(239,68,68,.12)',   'color'=>'#f87171'],
                            'yellow' => ['bg'=>'rgba(245,158,11,.12)',  'color'=>'#fbbf24'],
                            'green'  => ['bg'=>'rgba(34,197,94,.12)',   'color'=>'#4ade80'],
                            'gray'   => ['bg'=>'rgba(148,163,184,.08)', 'color'=>'#94a3b8'],
                        ];
                        $tic = $tiColors[$store['health_color']] ?? $tiColors['gray'];
                        ?>
                        <div class="os-card__top-issue" style="margin-top:6px;padding:6px 8px;background:<?= $tic['bg'] ?>;border-radius:6px;font-size:0.78rem;color:<?= $tic['color'] ?>">
                            <strong><?= e(t('overall_store.top_issue')) ?>:</strong> <?= htmlspecialchars($store['top_issue']) ?>
                        </div>
                    <?php endif; ?>
                    <hr class="os-divider">
                    <div class="os-metrics">
                        <div class="os-metric">
                            <span class="os-metric__label"><?= t('overall_store.open_tasks') ?></span>
                            <span class="os-metric__val"><?= (int)($store['open_tasks'] ?? 0) ?></span>
                        </div>
                        <div class="os-metric">
                            <span class="os-metric__label"><?= t('overall_store.completed_tasks') ?></span>
                            <span class="os-metric__val"><?= (int)($store['completed_tasks'] ?? 0) ?></span>
                        </div>
                        <div class="os-metric">
                            <span class="os-metric__label"><?= t('overall_store.overdue_tasks') ?></span>
                            <span class="os-metric__val <?= ($store['overdue_tasks'] ?? 0) > 0 ? 'os-metric__val--red' : '' ?>"><?= (int)($store['overdue_tasks'] ?? 0) ?></span>
                        </div>
                        <div class="os-metric">
                            <span class="os-metric__label"><?= t('overall_store.due_today') ?></span>
                            <span class="os-metric__val <?= ($store['due_today_tasks'] ?? 0) > 0 ? 'os-metric__val--amber' : '' ?>"><?= (int)($store['due_today_tasks'] ?? 0) ?></span>
                        </div>
                        <div class="os-metric">
                            <span class="os-metric__label"><?= t('overall_store.upcoming') ?></span>
                            <span class="os-metric__val"><?= (int)($store['upcoming_tasks'] ?? 0) ?></span>
                        </div>
                        <div class="os-metric">
                            <span class="os-metric__label"><?= t('overall_store.open_bills') ?></span>
                            <span class="os-metric__val <?= ($store['overdue_bills'] ?? 0) > 0 ? 'os-metric__val--red' : '' ?>"><?= (int)($store['open_bills'] ?? 0) ?></span>
                        </div>
                        <div class="os-metric">
                            <span class="os-metric__label"><?= t('overall_store.overdue_bills') ?></span>
                            <span class="os-metric__val <?= ($store['overdue_bills'] ?? 0) > 0 ? 'os-metric__val--red' : '' ?>"><?= (int)($store['overdue_bills'] ?? 0) ?></span>
                        </div>
                        <div class="os-metric">
                            <span class="os-metric__label"><?= t('overall_store.unpaid_bills') ?></span>
                            <span class="os-metric__val"><?= (int)($store['unpaid_bills'] ?? 0) ?></span>
                        </div>
                    </div>
                    <hr class="os-divider">
                    <?php if (!empty($store['current_handler']) && $store['current_handler'] !== 'All clear'): ?>
                        <div class="os-handler">🚨 <strong><?= htmlspecialchars($store['current_handler']) ?></strong></div>
                    <?php endif; ?>
                    <?php if (!empty($store['last_activity'])): ?>
                        <div class="os-activity">🕐 <?= t('overall_store.last_activity') ?>: <?= htmlspecialchars($store['last_activity']) ?></div>
                    <?php endif; ?>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</div>

<!-- Drawer Overlay -->
<div class="os-drawer-overlay" id="osDrawerOverlay" onclick="osCloseDrawer()"></div>

<!-- Drawer -->
<div class="os-drawer" id="osDrawer">
    <div class="os-drawer__header">
        <h2 class="os-drawer__title" id="osDrawerTitle">Loading...</h2>
        <button class="os-drawer__close" onclick="osCloseDrawer()">×</button>
    </div>
    <div class="os-drawer__body" id="osDrawerBody">
        <div class="os-loading">Loading store data...</div>
    </div>
</div>

<script>
(function(){
    const APP_URL = '<?= APP_URL ?>';
    const OS_CSRF_TOKEN = <?= json_encode(csrf_token()) ?>;
    let currentStoreId = null;
    let currentCalendarMonth = new Date().getMonth() + 1;
    let currentCalendarYear = new Date().getFullYear();
    let osTaskCache = {};

    window.osOpenDrawer = function(storeId) {
        currentStoreId = storeId;
        document.getElementById('osDrawerOverlay').classList.add('active');
        document.getElementById('osDrawer').classList.add('active');
        document.getElementById('osDrawerTitle').textContent = 'Loading...';
        document.getElementById('osDrawerBody').innerHTML = '<div class="os-loading">Loading store data...</div>';
        
        fetch(APP_URL + '/api/overall-store/' + storeId)
            .then(r => r.json())
            .then(json => {
                if (!json.success) { document.getElementById('osDrawerBody').innerHTML = '<div class="os-empty-tab">' + (json.error || 'Error') + '</div>'; return; }
                renderDrawer(json.data);
            })
            .catch(err => { document.getElementById('osDrawerBody').innerHTML = '<div class="os-empty-tab">Failed to load data</div>'; });
    };

    window.osCloseDrawer = function() {
        document.getElementById('osDrawerOverlay').classList.remove('active');
        document.getElementById('osDrawer').classList.remove('active');
        currentStoreId = null;
    };

    function renderDrawer(d) {
        document.getElementById('osDrawerTitle').textContent = d.name + ' — ' + d.health_label;
        const today = new Date().toISOString().slice(0,10);
        osTaskCache = {};
        cacheTasks(d.tasks);
        cacheTasks(d.completed_tasks_list);
        if (d.calendar) cacheTasks(d.calendar.tasks);
        
        let html = '';
        
        // Tabs
        html += '<div class="os-tabs">';
        html += '<button class="os-tab active" onclick="osTab(this,\'tab-overview\')"><?= t("overall_store.tab_overview") ?></button>';
        html += '<button class="os-tab" onclick="osTab(this,\'tab-calendar\')">Calendar</button>';
        html += '<button class="os-tab" onclick="osTab(this,\'tab-tasks\')"><?= t("overall_store.tab_tasks") ?> (' + d.open + ')</button>';
        html += '<button class="os-tab" onclick="osTab(this,\'tab-bills\')"><?= t("overall_store.tab_bills") ?> (' + d.open_bills + ')</button>';
        html += '<button class="os-tab" onclick="osTab(this,\'tab-completed\')"><?= t("overall_store.tab_completed") ?></button>';
        html += '<button class="os-tab" onclick="osTab(this,\'tab-people\')"><?= t("overall_store.tab_people") ?></button>';
        html += '</div>';
        html += '<div id="osTaskDetailCard" class="os-task-detail-card" style="display:none"></div>';

        // Tab: Overview
        html += '<div class="os-tab-panel active" id="tab-overview">';
        html += '<div class="os-drilldown-cards">';
        html += ddCard(d.open, 'Open Tasks', 'tab-tasks');
        html += ddCard(d.overdue, 'Overdue Tasks', 'tab-tasks');
        html += ddCard(d.due_today, 'Due Today', 'tab-tasks');
        html += ddCard(d.upcoming, 'Upcoming', 'tab-tasks');
        html += ddCard(d.open_bills, 'Open Bills', 'tab-bills');
        html += ddCard(d.overdue_bills, 'Overdue Bills', 'tab-bills');
        html += ddCard(d.unpaid, 'Unpaid Bills', 'tab-bills');
        html += ddCard(d.completed, 'Completed', 'tab-completed');
        html += '</div>';
        if (d.top_issue) {
            var tiColor = d.health_color==='red'?'#f87171':(d.health_color==='yellow'?'#fbbf24':(d.health_color==='gray'?'#94a3b8':'#4ade80'));
            var tiBg   = d.health_color==='red'?'rgba(239,68,68,.12)':(d.health_color==='yellow'?'rgba(245,158,11,.12)':(d.health_color==='gray'?'rgba(148,163,184,.08)':'rgba(34,197,94,.12)'));
            html += '<div style="margin-top:16px;padding:10px 12px;background:' + tiBg + ';border-left:3px solid ' + tiColor + ';border-radius:6px;font-size:0.85rem;color:' + tiColor + '"><strong>Top Issue:</strong> ' + esc(d.top_issue) + '</div>';
        }
        html += '<div style="margin-top:8px;font-size:0.85rem;color:#94a3b8"><strong style="color:#cbd5e1">Risk:</strong> ' + (d.risk_reason || 'All clear') + '</div>';
        if (d.manager_name) {
            html += '<div style="margin-top:6px;font-size:0.85rem;color:#94a3b8">👤 Manager: <strong style="color:#e2e8f0">' + esc(d.manager_name) + '</strong></div>';
        } else {
            html += '<div style="margin-top:6px;font-size:0.85rem;color:#64748b;font-style:italic">⚠️ Manager: Not Assigned</div>';
        }
        html += '</div>';

        // Tab: Calendar
        currentCalendarMonth = (d.calendar && d.calendar.month) ? parseInt(d.calendar.month, 10) : currentCalendarMonth;
        currentCalendarYear = (d.calendar && d.calendar.year) ? parseInt(d.calendar.year, 10) : currentCalendarYear;
        html += '<div class="os-tab-panel" id="tab-calendar">';
        html += renderCalendar(d.calendar || null);
        html += '</div>';

        // Tab: Tasks
        html += '<div class="os-tab-panel" id="tab-tasks">';
        if (d.tasks && d.tasks.length > 0) {
            html += '<table class="os-table"><thead><tr><th>Title</th><th>Status</th><th>Due</th><th>Priority</th><th>Assignee</th><th>Action</th></tr></thead><tbody>';
            d.tasks.forEach(t => {
                const progress = taskProgress(t, today);
                const pClass = 'os-p--' + (t.priority || '').toLowerCase();
                const sClass = statusClass(progress);
                html += '<tr class="' + rowClass(progress) + '"><td><button type="button" class="os-task-title-btn" onclick="osOpenTaskDetail(' + parseInt(t.id, 10) + ')">' + esc(t.title) + '</button></td>';
                html += '<td class="' + sClass + '">' + esc(statusLabel(t, progress)) + '</td>';
                html += '<td>' + (t.due_date || '-') + '</td>';
                html += '<td class="' + pClass + '">' + esc(t.priority || '-') + '</td>';
                html += '<td>' + esc(t.assignee_name || 'Needs owner') + '</td>';
                html += '<td class="os-action-cell"><button type="button" class="os-action-btn" onclick="osOpenTaskDetail(' + parseInt(t.id, 10) + ')">Details</button><button type="button" class="os-action-btn os-action-btn--done" onclick="osCompleteTask(' + parseInt(t.id, 10) + ', this)">Done</button></td></tr>';
            });
            html += '</tbody></table>';
        } else {
            html += '<div class="os-empty-tab">No open tasks</div>';
        }
        html += '</div>';

        // Tab: Bills
        html += '<div class="os-tab-panel" id="tab-bills">';
        if (d.bills && d.bills.length > 0) {
            html += '<table class="os-table"><thead><tr><th>Name</th><th>Category</th><th>Vendor</th><th>Due</th><th>Amount</th><th>Status</th><th>Owner</th></tr></thead><tbody>';
            d.bills.forEach(b => {
                const sClass = 'os-s--' + (b.status || '').toLowerCase();
                html += '<tr><td>' + esc(b.title || '-') + '</td>';
                html += '<td>' + esc(b.category || '-') + '</td>';
                html += '<td>' + esc(b.vendor_name || '-') + '</td>';
                html += '<td>' + (b.due_date || '-') + '</td>';
                html += '<td>' + (b.amount ? '$' + parseFloat(b.amount).toFixed(2) : '-') + '</td>';
                html += '<td class="' + sClass + '">' + esc(b.status || '-') + '</td>';
                html += '<td>' + esc(b.owner_name || 'Needs owner') + '</td></tr>';
            });
            html += '</tbody></table>';
        } else {
            html += '<div class="os-empty-tab">No bills</div>';
        }
        html += '</div>';

        // Tab: Completed
        html += '<div class="os-tab-panel" id="tab-completed">';
        if (d.completed_tasks_list && d.completed_tasks_list.length > 0) {
            html += '<table class="os-table"><thead><tr><th>Title</th><th>Completed</th><th>By</th><th>Reviewer</th></tr></thead><tbody>';
            d.completed_tasks_list.forEach(t => {
                html += '<tr class="os-task-row--done"><td><button type="button" class="os-task-title-btn" onclick="osOpenTaskDetail(' + parseInt(t.id, 10) + ')">' + esc(t.title || '-') + '</button></td>';
                html += '<td>' + (t.completed_at || '-') + '</td>';
                html += '<td>' + esc(t.completed_by || '-') + '</td>';
                html += '<td>' + esc(t.reviewer_name || '-') + '</td></tr>';
            });
            html += '</tbody></table>';
        } else {
            html += '<div class="os-empty-tab">No completed tasks</div>';
        }
        html += '</div>';

        // Tab: People
        html += '<div class="os-tab-panel" id="tab-people">';
        if (d.people && d.people.length > 0) {
            d.people.forEach(p => {
                const initials = (p.name || '?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
                const isManager = p.role === 'manager';
                html += '<div class="os-person">';
                html += '<div class="os-person__avatar">' + initials + '</div>';
                html += '<div class="os-person__info">';
                html += '<div class="os-person__name">' + esc(p.name || '') + (isManager ? ' <span style="color:#2563eb;font-size:0.72rem">MANAGER</span>' : '') + '</div>';
                html += '<div class="os-person__role">' + esc(p.email || '') + '</div></div>';
                html += '<div class="os-person__load">Open: <strong>' + (p.open_task_count || 0) + '</strong> | Done: <strong>' + (p.completed_task_count || 0) + '</strong></div>';
                html += '</div>';
            });
        } else {
            html += '<div class="os-empty-tab">No team members</div>';
        }
        html += '</div>';

        document.getElementById('osDrawerBody').innerHTML = html;
    }

    window.osTab = function(btn, tabId) {
        btn.closest('.os-tabs').querySelectorAll('.os-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        const body = document.getElementById('osDrawerBody');
        body.querySelectorAll('.os-tab-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById(tabId);
        if (panel) panel.classList.add('active');
        if (tabId === 'tab-calendar') loadStoreCalendar(currentCalendarMonth, currentCalendarYear);
    };

    function ddCard(num, label, tabId) {
        return '<div class="os-dd-card" onclick="var b=document.querySelector(\'#osDrawerBody .os-tab-panel.active\');if(b)b.id=\''+tabId+'\';document.querySelectorAll(\'#osDrawerBody .os-tab\').forEach(function(t){if(t.textContent.toLowerCase().indexOf(label.toLowerCase().split(\' \')[0].toLowerCase())>=0||(\''+tabId+'\'.indexOf(\'task\')>=0&&t.textContent.indexOf(\'Tasks\')>=0)||(\''+tabId+'\'.indexOf(\'bill\')>=0&&t.textContent.indexOf(\'Bills\')>=0)||(\''+tabId+'\'.indexOf(\'complete\')>=0&&t.textContent.indexOf(\'Completed\')>=0))t.click();});"><div class="os-dd-card__num">' + (num || 0) + '</div><div class="os-dd-card__label">' + label + '</div></div>';
    }

    window.osCalendarMove = function(delta) {
        let month = currentCalendarMonth + delta;
        let year = currentCalendarYear;
        if (month < 1) { month = 12; year--; }
        if (month > 12) { month = 1; year++; }
        loadStoreCalendar(month, year);
    };

    function loadStoreCalendar(month, year) {
        const panel = document.getElementById('tab-calendar');
        if (!panel || !currentStoreId) return;
        currentCalendarMonth = month;
        currentCalendarYear = year;
        panel.innerHTML = '<div class="os-loading">Loading calendar...</div>';
        fetch(APP_URL + '/api/overall-store/' + currentStoreId + '/calendar?month=' + month + '&year=' + year)
            .then(r => r.json())
            .then(json => {
                if (json.success) cacheTasks(json.data.tasks);
                panel.innerHTML = json.success ? renderCalendar(json.data) : '<div class="os-empty-tab">' + esc(json.error || 'Calendar unavailable') + '</div>';
            })
            .catch(() => { panel.innerHTML = '<div class="os-empty-tab">Failed to load calendar</div>'; });
    }

    function renderCalendar(cal) {
        if (!cal) return '<div class="os-empty-tab">No calendar data</div>';
        const month = parseInt(cal.month, 10);
        const year = parseInt(cal.year, 10);
        const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' });
        const tasks = Array.isArray(cal.tasks) ? cal.tasks : [];
        const bills = Array.isArray(cal.bills) ? cal.bills : [];
        const byDay = {};
        tasks.forEach(t => {
            const day = parseInt((t.due_date || '').slice(8, 10), 10);
            if (!day) return;
            cacheTask(t);
            byDay[day] = byDay[day] || [];
            byDay[day].push({ type: 'task', id: t.id, title: t.title || '-', status: t.calendar_status || 'upcoming' });
        });
        bills.forEach(b => {
            const day = parseInt((b.due_date || '').slice(8, 10), 10);
            if (!day) return;
            byDay[day] = byDay[day] || [];
            byDay[day].push({ type: 'bill', title: b.title || '-', status: b.status || 'pending' });
        });

        const firstDow = new Date(year, month - 1, 1).getDay();
        const daysInMonth = new Date(year, month, 0).getDate();
        const today = cal.today || new Date().toISOString().slice(0, 10);
        let html = '<div class="os-calendar-head">';
        html += '<button class="os-cal-nav" onclick="osCalendarMove(-1)">‹</button>';
        html += '<div class="os-calendar-title">' + monthName + ' ' + year + '</div>';
        html += '<button class="os-cal-nav" onclick="osCalendarMove(1)">›</button>';
        html += '</div>';
        html += '<div class="os-calendar-summary">';
        html += '<div class="os-cal-stat"><strong>' + (cal.summary?.total || 0) + '</strong><span>Total</span></div>';
        html += '<div class="os-cal-stat"><strong>' + (cal.summary?.open || 0) + '</strong><span>Open</span></div>';
        html += '<div class="os-cal-stat"><strong>' + (cal.summary?.done || 0) + '</strong><span>Done</span></div>';
        html += '<div class="os-cal-stat"><strong>' + (cal.summary?.overdue || 0) + '</strong><span>Overdue</span></div>';
        html += '</div>';
        html += '<div class="os-calendar-grid">';
        ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => html += '<div class="os-cal-dow">' + d + '</div>');
        for (let i = 0; i < firstDow; i++) html += '<div class="os-cal-day os-cal-day--muted"></div>';
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
            const events = byDay[day] || [];
            html += '<div class="os-cal-day' + (dateKey === today ? ' os-cal-day--today' : '') + '">';
            html += '<div class="os-cal-num">' + day + '</div>';
            events.slice(0, 3).forEach(ev => {
                const cls = ev.type === 'bill' ? 'os-cal-chip--bill' : chipClass(ev.status);
                const prefix = ev.type === 'bill' ? '$ ' : '';
                if (ev.type === 'task' && ev.id) {
                    html += '<button type="button" class="os-cal-chip ' + cls + '" title="' + esc(ev.title) + '" onclick="osOpenTaskDetail(' + parseInt(ev.id, 10) + ')">' + prefix + esc(ev.title) + '</button>';
                } else {
                    html += '<span class="os-cal-chip ' + cls + '" title="' + esc(ev.title) + '">' + prefix + esc(ev.title) + '</span>';
                }
            });
            if (events.length > 3) html += '<div class="os-cal-more">+' + (events.length - 3) + ' more</div>';
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    function cacheTasks(tasks) {
        if (!Array.isArray(tasks)) return;
        tasks.forEach(cacheTask);
    }

    function cacheTask(task) {
        if (!task || !task.id) return;
        osTaskCache[task.id] = Object.assign({}, osTaskCache[task.id] || {}, task);
    }

    function taskProgress(task, today) {
        if (!task) return 'upcoming';
        if (String(task.is_completed) === '1' || task.status === 'completed' || task.calendar_status === 'done' || task.completed_at) return 'done';
        const due = task.due_date || '';
        const baseToday = today || new Date().toISOString().slice(0,10);
        if (due && due < baseToday) return 'overdue';
        if (due) {
            const dueDate = new Date(due + 'T00:00:00');
            const todayDate = new Date(baseToday + 'T00:00:00');
            const diffDays = Math.round((dueDate - todayDate) / 86400000);
            if (diffDays <= 7) return 'due';
        }
        return 'upcoming';
    }

    function rowClass(progress) {
        return 'os-task-row--' + progress;
    }

    function chipClass(progress) {
        return 'os-cal-chip--' + (progress || 'upcoming');
    }

    function statusClass(progress) {
        if (progress === 'done') return 'os-s--completed';
        if (progress === 'overdue') return 'os-s--overdue';
        if (progress === 'due') return 'os-s--due';
        return 'os-s--upcoming';
    }

    function statusLabel(task, progress) {
        if (progress === 'done') return 'Done';
        if (progress === 'overdue') return 'Overdue';
        if (progress === 'due') return 'Due soon';
        return task.status || 'Upcoming';
    }

    window.osOpenTaskDetail = function(taskId) {
        const task = osTaskCache[taskId];
        const card = document.getElementById('osTaskDetailCard');
        if (!task || !card) return;
        const progress = taskProgress(task);
        const canComplete = progress !== 'done';
        card.innerHTML = ''
            + '<div class="os-task-detail-card__head">'
            + '<div class="os-task-detail-card__title">' + esc(task.title || '-') + '</div>'
            + '<button type="button" class="os-task-detail-card__close" onclick="osCloseTaskDetail()">×</button>'
            + '</div>'
            + '<div class="os-task-detail-card__grid">'
            + detailItem('Status', statusLabel(task, progress))
            + detailItem('Due', task.due_date || '-')
            + detailItem('Priority', task.priority || '-')
            + detailItem('Assignee', task.assignee_name || task.completed_by || 'Needs owner')
            + detailItem('Project', task.project_name || 'Finance')
            + detailItem('Progress', progress.replace('-', ' '))
            + '</div>'
            + '<div class="os-task-detail-card__actions">'
            + '<a class="os-action-btn" href="' + APP_URL + '/tasks/' + parseInt(taskId, 10) + '" data-detail-drawer>Open full detail</a>'
            + (canComplete ? '<button type="button" class="os-action-btn os-action-btn--done" onclick="osCompleteTask(' + parseInt(taskId, 10) + ', this)">Mark Complete</button>' : '')
            + '</div>';
        card.style.display = 'block';
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    window.osCloseTaskDetail = function() {
        const card = document.getElementById('osTaskDetailCard');
        if (card) card.style.display = 'none';
    };

    window.osCompleteTask = function(taskId, btn) {
        if (!taskId) return;
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Saving...';
        }
        fetch(APP_URL + '/api/tasks/' + parseInt(taskId, 10) + '/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': OS_CSRF_TOKEN },
            body: JSON.stringify({ csrf_token: OS_CSRF_TOKEN })
        })
            .then(r => r.json().then(json => ({ ok: r.ok, json })))
            .then(({ok, json}) => {
                if (!ok || json.error) throw new Error(json.message || json.error || 'Failed to complete task');
                if (currentStoreId) osOpenDrawer(currentStoreId);
            })
            .catch(err => {
                alert(err.message || 'Failed to complete task');
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Done';
                }
            });
    };

    function detailItem(label, value) {
        return '<div class="os-task-detail-card__item"><span class="os-task-detail-card__label">' + esc(label) + '</span><span class="os-task-detail-card__value">' + esc(value || '-') + '</span></div>';
    }

    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    // Close on Escape
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') osCloseDrawer(); });
})();
</script>
