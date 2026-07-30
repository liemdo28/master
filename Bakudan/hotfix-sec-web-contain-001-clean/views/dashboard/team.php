<?php
$isLoadMode = $isLoadMode ?? false;
$pageTitle   = $pageTitle ?? ($isLoadMode ? 'Team Load' : 'Team Control Center');
$currentPage = $currentPage ?? ($isLoadMode ? 'team-load' : 'team');
ob_start();

$avatarColors = ['#7C3AED','#2563EB','#059669','#D97706','#DC2626','#0891B2','#C026D3','#0F766E'];
$riskLabels = ['critical'=>'Critical','behind'=>'Behind','watch'=>'Watch','stable'=>'Stable'];
$riskColors = ['critical'=>'#EF4444','behind'=>'#F97316','watch'=>'#F59E0B','stable'=>'#22C55E'];
$riskBg     = ['critical'=>'rgba(239,68,68,.15)','behind'=>'rgba(249,115,22,.15)','watch'=>'rgba(245,158,11,.15)','stable'=>'rgba(34,197,94,.15)'];
?>
<style>
/* ═══════════════════════════════════════════════════════
   TEAM CONTROL CENTER
   ═══════════════════════════════════════════════════════ */
.team-wrap { max-width: 1280px; margin: 0 auto; padding: 0 0 48px; }

/* Header */
.team-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding: 20px 0 22px;
    border-bottom: 1px solid var(--border,rgba(255,255,255,.08));
    margin-bottom: 24px; flex-wrap: wrap; gap: 12px;
}
.team-header h1 { font-size: 24px; font-weight: 800; margin: 0; }
.team-header p   { font-size: 13px; color: var(--text-muted,#94A3B8); margin: 4px 0 0; }
.team-header-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

/* ── KPI Strip (5 cards) ── */
.team-kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 12px;
    margin-bottom: 20px;
}
@media(max-width:900px) { .team-kpi-strip { grid-template-columns: repeat(3,1fr); } }
@media(max-width:600px) { .team-kpi-strip { grid-template-columns: repeat(2,1fr); } }

.team-kpi-card {
    background: var(--surface,#1E293B);
    border: 1px solid var(--border,rgba(255,255,255,.08));
    border-radius: 14px; padding: 16px 18px;
    cursor: pointer; transition: .15s; text-align: center;
    position: relative; overflow: hidden;
}
.team-kpi-card:hover { border-color: rgba(255,255,255,.18); transform: translateY(-1px); }
.team-kpi-card.active { border-color: var(--kpi-color,#3B82F6); background: rgba(59,130,246,.06); }
.team-kpi-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: var(--kpi-color,#3B82F6); border-radius: 14px 14px 0 0;
    opacity: 0; transition: opacity .2s;
}
.team-kpi-card:hover::before, .team-kpi-card.active::before { opacity: 1; }
.team-kpi-num  { font-size: 30px; font-weight: 800; line-height: 1; }
.team-kpi-lbl  { font-size: 11px; color: var(--text-muted,#94A3B8); text-transform: uppercase; letter-spacing: .07em; margin-top: 4px; }
.team-kpi-sub  { font-size: 11px; color: var(--text-muted,#94A3B8); margin-top: 2px; }

/* ── Smart Recommendations Strip ── */
.team-smart-strip {
    background: var(--surface,#1E293B);
    border: 1px solid rgba(124,58,237,.25);
    border-radius: 16px;
    margin-bottom: 20px;
    overflow: hidden;
}
.team-smart-header {
    padding: 14px 20px 12px;
    border-bottom: 1px solid rgba(255,255,255,.06);
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; font-weight: 700; color: #C4B5FD;
}
.team-smart-items { display: flex; flex-direction: column; }
.team-smart-item {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 20px;
    border-bottom: 1px solid rgba(255,255,255,.04);
    font-size: 13px;
}
.team-smart-item:last-child { border-bottom: none; }
.team-smart-icon { font-size: 18px; flex-shrink: 0; }
.team-smart-text { flex: 1; color: var(--text,#F1F5F9); }
.team-smart-btn {
    font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: 7px;
    border: none; cursor: pointer; white-space: nowrap; transition: .15s;
    text-decoration: none; display: inline-flex; align-items: center; gap: 4px;
}
.tsb-reassign { background: rgba(124,58,237,.2); color: #C4B5FD; }
.tsb-reassign:hover { background: rgba(124,58,237,.35); }
.tsb-view     { background: rgba(59,130,246,.15); color: #93C5FD; }
.tsb-view:hover { background: rgba(59,130,246,.28); }

/* ── Filter bar ── */
.team-filter-bar {
    display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
    margin-bottom: 16px;
}
.team-search {
    padding: 7px 12px 7px 32px;
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 9px; color: #F1F5F9; font-size: 13px;
    width: 200px; position: relative;
}
.team-search:focus { outline: none; border-color: #7C3AED; }
.team-search-wrap { position: relative; }
.team-search-wrap::before { content: ''; position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 12px; }
.team-filter-select {
    padding: 7px 10px; border-radius: 9px;
    background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
    color: #F1F5F9; font-size: 12px; cursor: pointer;
}
.team-filter-select:focus { outline: none; border-color: #7C3AED; }
.team-filter-select option { background: #1E293B; }
.team-filter-chip {
    font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 7px;
    background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
    color: #94A3B8; cursor: pointer; transition: .15s;
}
.team-filter-chip.active { background: rgba(59,130,246,.15); border-color: rgba(59,130,246,.3); color: #93C5FD; }
.team-filter-chip:hover { background: rgba(255,255,255,.1); }

/* Sort bar */
.team-sort-bar {
    display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap;
}
.team-sort-btn {
    font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 7px;
    background: rgba(255,255,255,.06); border: 1px solid var(--border,rgba(255,255,255,.1));
    color: var(--text-muted,#94A3B8); cursor: pointer; transition: .15s; text-decoration: none;
}
.team-sort-btn.active, .team-sort-btn:hover { background: rgba(59,130,246,.15); border-color: rgba(59,130,246,.3); color: #93C5FD; }

/* Member cards grid */
.team-grid { display: flex; flex-direction: column; gap: 10px; }

.team-member-card {
    background: var(--surface,#1E293B);
    border: 1px solid var(--border,rgba(255,255,255,.08));
    border-radius: 14px;
    padding: 16px 20px;
    display: grid;
    grid-template-columns: 220px repeat(4,1fr) 100px 100px 160px;
    gap: 12px;
    align-items: center;
    transition: .15s;
    cursor: default;
}
.team-member-card:hover { border-color: rgba(255,255,255,.14); background: rgba(255,255,255,.015); }
.team-member-card[data-filtered="hidden"] { display: none; }

@media(max-width:1200px) { .team-member-card { grid-template-columns: 1fr 1fr 1fr; } }
@media(max-width:700px)  { .team-member-card { grid-template-columns: 1fr 1fr; } }

/* Left: member identity */
.team-member-id { display: flex; align-items: center; gap: 12px; }
.team-avatar {
    width: 42px; height: 42px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 17px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.team-member-name { font-size: 14px; font-weight: 700; }
.team-member-role { font-size: 11px; color: var(--text-muted,#94A3B8); margin-top: 2px; }

/* Stats cells */
.team-stat { text-align: center; }
.team-stat .val { font-size: 20px; font-weight: 800; line-height: 1; }
.team-stat .lbl { font-size: 10px; color: var(--text-muted,#94A3B8); text-transform: uppercase; letter-spacing: .06em; margin-top: 3px; }

/* Workload bar */
.team-workload { }
.team-workload .lbl { font-size: 10px; color: var(--text-muted,#94A3B8); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 5px; }
.team-workload-bar {
    height: 8px; border-radius: 999px; background: rgba(255,255,255,.08);
    overflow: hidden; position: relative;
}
.team-workload-fill { height: 100%; border-radius: 999px; transition: width .4s ease; }
.team-workload-num  { font-size: 11px; color: var(--text-muted,#94A3B8); margin-top: 4px; text-align: center; }

/* Risk pill */
.team-risk {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 11px; font-weight: 700; padding: 5px 10px; border-radius: 999px;
    white-space: nowrap; justify-content: center;
}

/* Business tags */
.team-biz-list { display: flex; flex-wrap: wrap; gap: 3px; }
.team-biz-tag {
    font-size: 10px; font-weight: 700; padding: 2px 7px;
    border-radius: 5px; background: rgba(255,255,255,.07);
    color: var(--text-muted,#94A3B8); white-space: nowrap;
}

/* Actions */
.team-actions { display: flex; gap: 5px; justify-content: flex-end; flex-wrap: wrap; }
.team-action-btn {
    font-size: 11px; font-weight: 600; padding: 5px 10px; border-radius: 7px;
    text-decoration: none; transition: .15s; white-space: nowrap; border: none; cursor: pointer;
}
.tab-view    { background: rgba(59,130,246,.15);  color: #93C5FD; }
.tab-view:hover { background: rgba(59,130,246,.28); }
.tab-overdue { background: rgba(239,68,68,.15);   color: #FCA5A5; }
.tab-overdue:hover { background: rgba(239,68,68,.28); }
.tab-reassign { background: rgba(124,58,237,.15); color: #C4B5FD; }
.tab-reassign:hover { background: rgba(124,58,237,.28); }

/* Table header */
.team-table-header {
    display: grid;
    grid-template-columns: 220px repeat(4,1fr) 100px 100px 160px;
    gap: 12px;
    padding: 0 20px 8px;
    font-size: 11px; font-weight: 700; color: var(--text-muted,#94A3B8);
    text-transform: uppercase; letter-spacing: .07em;
}
@media(max-width:1200px) { .team-table-header { display: none; } }

/* Overdue task chip */
.team-overdue-chip {
    font-size: 10px; color: #FCA5A5; background: rgba(239,68,68,.1);
    border-radius: 5px; padding: 2px 7px; margin-top: 4px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 170px; display: block;
}

/* Member Drawer */
#memberDrawer {
    position: fixed; right: 0; top: 0; bottom: 0; z-index: 8000;
    width: 360px; max-width: 95vw;
    background: #1E293B;
    border-left: 1px solid rgba(255,255,255,.1);
    display: flex; flex-direction: column;
    transform: translateX(110%); transition: transform .28s cubic-bezier(.4,0,.2,1);
    box-shadow: -8px 0 32px rgba(0,0,0,.4);
}
#memberDrawer.open { transform: translateX(0); }
.mdr-header {
    padding: 20px 20px 16px;
    border-bottom: 1px solid rgba(255,255,255,.08);
    display: flex; justify-content: space-between; align-items: flex-start;
    flex-shrink: 0;
}
.mdr-close {
    width: 30px; height: 30px; border-radius: 7px;
    background: rgba(255,255,255,.07); border: none; color: #94A3B8;
    font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.mdr-body { flex: 1; overflow-y: auto; padding: 16px 20px; }
.mdr-stat-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-bottom: 16px; }
.mdr-stat { background: rgba(255,255,255,.04); border-radius: 10px; padding: 10px; text-align: center; }
.mdr-stat .val { font-size: 20px; font-weight: 800; }
.mdr-stat .lbl { font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: .06em; margin-top: 2px; }
.mdr-section { font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .07em; margin: 14px 0 6px; }
.mdr-task-item { font-size: 12px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,.05); color: #F1F5F9; }
.mdr-task-item:last-child { border-bottom: none; }
.mdr-actions { padding: 16px 20px; border-top: 1px solid rgba(255,255,255,.08); display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
.mdr-btn {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    padding: 10px; border-radius: 10px; font-size: 13px; font-weight: 600;
    border: none; cursor: pointer; text-decoration: none; transition: .15s;
}
.mdr-btn-primary { background: #7C3AED; color: #fff; }
.mdr-btn-primary:hover { background: #6D28D9; }
.mdr-btn-ghost { background: rgba(255,255,255,.07); color: #F1F5F9; border: 1px solid rgba(255,255,255,.1); }
.mdr-btn-ghost:hover { background: rgba(255,255,255,.12); }

/* Global btns */
.team-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
    text-decoration: none; border: 1px solid var(--border,rgba(255,255,255,.1));
    background: rgba(255,255,255,.06); color: var(--text,#F1F5F9); transition: .15s;
    cursor: pointer;
}
.team-btn:hover { background: rgba(255,255,255,.1); }

/* ── Reassign Modal ── */
#reassignModal {
    display: none;
    position: fixed; inset: 0; z-index: 9000;
    background: rgba(0,0,0,.6); backdrop-filter: blur(4px);
    align-items: center; justify-content: center; padding: 16px;
}
#reassignModal.open { display: flex; }
.rm-panel {
    background: #1E293B; border: 1px solid rgba(255,255,255,.12);
    border-radius: 20px; width: 100%; max-width: 720px; max-height: 90vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 24px 64px rgba(0,0,0,.6);
}
.rm-header {
    padding: 20px 24px 16px; border-bottom: 1px solid rgba(255,255,255,.08);
    display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
}
.rm-header h2 { font-size: 18px; font-weight: 800; margin: 0; }
.rm-close {
    width: 32px; height: 32px; border-radius: 8px;
    background: rgba(255,255,255,.07); border: none; color: #94A3B8;
    font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.rm-close:hover { background: rgba(255,255,255,.14); }
.rm-body { flex: 1; overflow-y: auto; padding: 20px 24px; }
.rm-footer {
    padding: 16px 24px; border-top: 1px solid rgba(255,255,255,.08);
    display: flex; gap: 10px; justify-content: flex-end; flex-shrink: 0;
}
.rm-users { display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: end; margin-bottom: 20px; }
.rm-user-arrow { font-size: 24px; color: #7C3AED; padding-bottom: 6px; text-align: center; }
.rm-label { font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .06em; display: block; margin-bottom: 6px; }
.rm-select {
    width: 100%; padding: 10px 12px; background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.1); border-radius: 10px; color: #F1F5F9; font-size: 14px;
    appearance: none; cursor: pointer;
}
.rm-select:focus { outline: none; border-color: #7C3AED; }
.rm-select option { background: #1E293B; }
.rm-mode { display: flex; gap: 8px; margin-bottom: 16px; }
.rm-mode-btn {
    flex: 1; padding: 10px; border-radius: 10px; text-align: center;
    border: 2px solid transparent; background: rgba(255,255,255,.05);
    cursor: pointer; font-size: 13px; font-weight: 600; color: #94A3B8; transition: .15s;
}
.rm-mode-btn.active { border-color: #7C3AED; background: rgba(124,58,237,.1); color: #C4B5FD; }
#rmTaskList { display: none; margin-bottom: 16px; max-height: 200px; overflow-y: auto; }
.rm-task-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; border-radius: 8px; cursor: pointer; transition: .1s;
}
.rm-task-item:hover { background: rgba(255,255,255,.04); }
.rm-task-item input[type=checkbox] { accent-color: #7C3AED; width: 16px; height: 16px; flex-shrink: 0; }
.rm-task-name { flex: 1; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rm-task-badge {
    font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 5px; white-space: nowrap;
}
.badge-urgent { background: rgba(220,38,38,.2);  color: #FCA5A5; }
.badge-high   { background: rgba(245,158,11,.2); color: #FCD34D; }
.badge-medium { background: rgba(59,130,246,.15);color: #93C5FD; }
.badge-low    { background: rgba(148,163,184,.1);color: #94A3B8; }
.rm-task-due  { font-size: 11px; color: #94A3B8; white-space: nowrap; }
#rmPreviewBox {
    display: none; background: rgba(124,58,237,.07); border: 1px solid rgba(124,58,237,.25);
    border-radius: 12px; padding: 16px; margin-bottom: 16px;
}
.rm-preview-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 12px; }
.rm-preview-stat { text-align: center; }
.rm-preview-stat .val { font-size: 22px; font-weight: 800; }
.rm-preview-stat .lbl { font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: .06em; margin-top: 2px; }
.rm-transfer-row { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 8px; }
.rm-transfer-row .cnt { font-weight: 800; }
.rm-arrow { color: #7C3AED; font-size: 18px; }
#rmWarnings { margin-top: 10px; }
.rm-warning-item { font-size: 12px; color: #FCD34D; background: rgba(245,158,11,.1); border-radius: 7px; padding: 5px 10px; margin-top: 4px; }
.rm-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 9px 18px; border-radius: 9px; font-size: 13px; font-weight: 700;
    border: none; cursor: pointer; transition: .15s;
}
.rm-btn-preview  { background: rgba(124,58,237,.2); color: #C4B5FD; }
.rm-btn-preview:hover { background: rgba(124,58,237,.35); }
.rm-btn-confirm  { background: #7C3AED; color: #fff; }
.rm-btn-confirm:hover { background: #6D28D9; }
.rm-btn-confirm:disabled { opacity: .45; cursor: not-allowed; }
.rm-btn-cancel   { background: rgba(255,255,255,.07); color: #94A3B8; border: 1px solid rgba(255,255,255,.1); }
.rm-btn-cancel:hover { background: rgba(255,255,255,.12); }

/* ── Critical / Behind row pulse animation ── */
@keyframes criticalPulse {
    0%   { box-shadow: 0 0 0 0 rgba(239,68,68,.4); }
    50%  { box-shadow: 0 0 0 5px rgba(239,68,68,.0); }
    100% { box-shadow: 0 0 0 0 rgba(239,68,68,.0); }
}
@keyframes behindPulse {
    0%   { box-shadow: 0 0 0 0 rgba(249,115,22,.35); }
    50%  { box-shadow: 0 0 0 5px rgba(249,115,22,.0); }
    100% { box-shadow: 0 0 0 0 rgba(249,115,22,.0); }
}
.team-member-card[data-risk="critical"] {
    animation: criticalPulse 2.8s ease-in-out infinite;
}
.team-member-card[data-risk="behind"] {
    animation: behindPulse 3.5s ease-in-out infinite;
}

/* Stronger emphasis for critical row */
.team-member-card[data-risk="critical"] {
    background: linear-gradient(90deg, rgba(239,68,68,.06) 0%, var(--surface,#1E293B) 40%);
}
.team-member-card[data-risk="behind"] {
    background: linear-gradient(90deg, rgba(249,115,22,.05) 0%, var(--surface,#1E293B) 40%);
}

/* KPI refresh flash */
@keyframes kpiFlash {
    0%   { transform: scale(1); }
    25%  { transform: scale(1.12); }
    60%  { transform: scale(.97); }
    100% { transform: scale(1); }
}
.kpi-updated { animation: kpiFlash .45s ease; }

/* Load band badge */
.load-band {
    display: inline-flex; align-items: center; gap: 3px;
    font-size: 10px; font-weight: 700; padding: 2px 7px;
    border-radius: 999px; white-space: nowrap;
}

/* Toast */
.team-toast {
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    background: #1E293B; border: 1px solid rgba(255,255,255,.12);
    border-radius: 12px; padding: 14px 20px; font-size: 14px; font-weight: 600; color: #F1F5F9;
    box-shadow: 0 8px 32px rgba(0,0,0,.4); display: none; align-items: center; gap: 10px;
}
</style>

<div class="team-wrap">

    <!-- ── Header ── -->
    <div class="team-header">
        <div>
            <h1><?= tf_icon($isLoadMode ? 'bar-chart-3' : 'users') ?> <?= $isLoadMode ? 'Team Load' : 'Team Control Center' ?></h1>
            <p><?= $isLoadMode ? 'Workload by person · Overdue pressure · Rebalancing' : 'Workload · Accountability · Rebalancing' ?> — <?= date('l, F j, Y') ?></p>
        </div>
        <div class="team-header-actions">
            <?php if (isAdmin() || isManager()): ?>
            <button onclick="openRebalanceModal()" class="team-btn" id="rebalanceBtn" style="background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.3);color:#FCA5A5"><?= tf_icon('cpu') ?> Rebalance Workload</button>
            <button onclick="openReassignModal(0)" class="team-btn" style="background:rgba(124,58,237,.15);border-color:rgba(124,58,237,.3);color:#C4B5FD">⇄ Reassign Tasks</button>
            <?php endif; ?>
            <a href="<?= APP_URL ?>/overview" class="team-btn"><?= tf_icon('trending-up') ?> Executive View</a>
        </div>
    </div>

    <!-- ── KPI Strip (5 cards) ── -->
    <div class="team-kpi-strip" id="teamKpiStrip">
        <div class="team-kpi-card" style="--kpi-color:#EF4444" onclick="filterByKpi('critical')" title="Filter overloaded members">
            <div class="team-kpi-num" style="color:#EF4444" id="kpiOverloaded"><?= (int)$teamTotals['overloaded'] ?></div>
            <div class="team-kpi-lbl">Overloaded</div>
            <div class="team-kpi-sub">Critical + Behind</div>
        </div>
        <div class="team-kpi-card" style="--kpi-color:#F59E0B" onclick="filterByKpi('overdue')" title="Filter by overdue">
            <div class="team-kpi-num" style="color:#F59E0B" id="kpiOverdue"><?= (int)$teamTotals['overdue'] ?></div>
            <div class="team-kpi-lbl">Total Overdue</div>
            <div class="team-kpi-sub">Across team</div>
        </div>
        <div class="team-kpi-card" style="--kpi-color:#F97316">
            <div class="team-kpi-num" style="color:#F97316" id="kpiBizImpact"><?= (int)$teamTotals['biz_impact'] ?></div>
            <div class="team-kpi-lbl">Biz Impacted</div>
            <div class="team-kpi-sub">Stores with overdue</div>
        </div>
        <div class="team-kpi-card" style="--kpi-color:#7C3AED" onclick="filterByKpi('rebalance')" title="Show rebalance candidates">
            <div class="team-kpi-num" style="color:#C4B5FD" id="kpiRebalance"><?= (int)$teamTotals['rebalance'] ?></div>
            <div class="team-kpi-lbl">Need Rebalance</div>
            <div class="team-kpi-sub">High load users</div>
        </div>
        <div class="team-kpi-card" style="--kpi-color:#22C55E">
            <div class="team-kpi-num" id="kpiOnTime" style="color:<?= $teamTotals['on_time_pct'] >= 70 ? '#22C55E' : ($teamTotals['on_time_pct'] >= 50 ? '#F59E0B' : '#EF4444') ?>"><?= (int)$teamTotals['on_time_pct'] ?>%</div>
            <div class="team-kpi-lbl">On-time Rate</div>
            <div class="team-kpi-sub" id="kpiDoneWeek"><?= (int)$teamTotals['done_week'] ?> done this week</div>
        </div>
    </div>

    <?php if (!empty($smartRecs)): ?>
    <!-- ── Smart Recommendations ── -->
    <div class="team-smart-strip" id="smartRecStrip">
        <div class="team-smart-header" onclick="toggleSmartStrip()" style="cursor:pointer;user-select:none" title="Click to collapse">
            <?= tf_icon('zap') ?> Recommended Actions
            <span style="font-size:11px;color:#7C3AED;font-weight:400;margin-left:auto" id="smartRecCount"><?= count($smartRecs) ?> items</span>
            <span id="smartRecToggleIcon" style="font-size:11px;color:#4B5563;margin-left:8px">▲</span>
        </div>
        <div class="team-smart-items" id="smartRecItems">
            <?php foreach ($smartRecs as $rec):
                $sugIp = IconPresenter::forSuggestion($rec['type'] ?? 'insight');
            ?>
            <div class="team-smart-item" style="border-left:3px solid <?= $sugIp['color'] ?>">
                <span class="team-smart-icon" style="color:<?= $sugIp['color'] ?>"><?= $rec['icon'] ?></span>
                <div style="flex:1">
                    <div class="team-smart-text"><?= e($rec['title'] ?? $rec['text'] ?? '') ?></div>
                    <?php if (!empty($rec['reason'])): ?>
                    <div style="font-size:11px;color:#94A3B8;margin-top:2px"><?= e($rec['reason']) ?></div>
                    <?php endif; ?>
                </div>
                <?php if ($rec['action'] === 'reassign' && !empty($rec['from_user_id'])): ?>
                <button class="team-smart-btn tsb-reassign" onclick="openReassignModal(<?= (int)$rec['from_user_id'] ?>)">⇄ <?= e($rec['label']) ?></button>
                <?php elseif ($rec['action'] === 'reassign_to' && !empty($rec['to_user_id'])): ?>
                <button class="team-smart-btn tsb-reassign" onclick="openReassignModal(0, <?= (int)$rec['to_user_id'] ?>)">⇄ <?= e($rec['label']) ?></button>
                <?php elseif ($rec['action'] === 'overview' && !empty($rec['label'])): ?>
                <a href="<?= APP_URL ?>/overview" class="team-smart-btn tsb-view"><?= e($rec['label']) ?></a>
                <?php endif; ?>
            </div>
            <?php endforeach; ?>
        </div>
    </div>
    <?php endif; ?>

    <!-- ══════════════════════════════════════════════════════
         V5 AUTONOMY CONTROL PANEL
         ══════════════════════════════════════════════════════ -->
    <?php if (isAdmin() || isManager()): ?>
    <div id="autonomyPanel" class="team-smart-strip" style="border-color:rgba(59,130,246,.25);margin-bottom:20px">
        <div class="team-smart-header" onclick="toggleAutonomyPanel()" style="cursor:pointer;user-select:none" title="Click to collapse/expand">
            <?= tf_icon("cpu", 16) ?>
            <span style="color:#93C5FD">V5 Autonomy Queue</span>
            <span id="autonomyCount" style="margin-left:auto;background:rgba(59,130,246,.2);color:#93C5FD;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:600;line-height:1.4">Loading&hellip;</span>
            <span id="autonomyToggleIcon" style="font-size:11px;color:#4B5563;margin-left:8px">&#9650;</span>
        </div>
        <div id="autonomyBody">
            <div id="autonomyAutoSection" style="display:none">
                <div style="padding:10px 20px 6px;font-size:10px;font-weight:700;color:#60A5FA;text-transform:uppercase;letter-spacing:.08em;display:flex;align-items:center;gap:6px;border-bottom:1px solid rgba(255,255,255,.04)">
                    <?= tf_icon("cpu", 13) ?> Auto Queue
                    <span id="autonomyAutoCount" style="background:rgba(59,130,246,.15);color:#93C5FD;border-radius:20px;padding:1px 8px;font-size:10px">0</span>
                </div>
                <div id="autonomyAutoItems" class="team-smart-items"></div>
            </div>
            <div id="autonomyApprovalSection" style="display:none">
                <div style="padding:10px 20px 6px;font-size:10px;font-weight:700;color:#86EFAC;text-transform:uppercase;letter-spacing:.08em;display:flex;align-items:center;gap:6px;border-bottom:1px solid rgba(255,255,255,.04)">
                    <?= tf_icon("check-circle", 13) ?> Approval Queue
                    <span id="autonomyApprovalCount" style="background:rgba(34,197,94,.12);color:#86EFAC;border-radius:20px;padding:1px 8px;font-size:10px">0</span>
                </div>
                <div id="autonomyApprovalItems" class="team-smart-items"></div>
            </div>
            <div id="autonomyBlockedSection" style="display:none">
                <div style="padding:10px 20px 6px;font-size:10px;font-weight:700;color:#FCA5A5;text-transform:uppercase;letter-spacing:.08em;display:flex;align-items:center;gap:6px;border-bottom:1px solid rgba(255,255,255,.04)">
                    <?= tf_icon("shield-alert", 13) ?> Blocked
                    <span id="autonomyBlockedCount" style="background:rgba(239,68,68,.12);color:#FCA5A5;border-radius:20px;padding:1px 8px;font-size:10px">0</span>
                </div>
                <div id="autonomyBlockedItems" class="team-smart-items"></div>
            </div>
            <div id="autonomyLoading" style="padding:20px;text-align:center;color:#475569;font-size:13px">Loading autonomy queue&hellip;</div>
            <div id="autonomyEmpty"   style="display:none;padding:20px;text-align:center;color:#475569;font-size:13px">No pending decisions in the autonomy queue.</div>
            <div id="autonomyError"   style="display:none;padding:20px;text-align:center;color:#FCA5A5;font-size:13px">Failed to load autonomy queue.</div>
        </div>
    </div>
    <?php endif; ?>

    <!-- ── Filter + Sort Bar ── -->
    <div id="rebalance"></div>
    <div class="team-filter-bar" id="teamLoadFilters">
        <div class="team-search-wrap">
            <input type="text" id="teamSearch" class="team-search" placeholder="Search member…" oninput="applyFilters()">
        </div>
        <select id="teamFilterBiz" class="team-filter-select" onchange="applyFilters()">
            <option value="">All Businesses</option>
            <?php foreach ($allStoresFilter as $sf): ?>
            <option value="<?= e($sf['name']) ?>"><?= e($sf['name']) ?></option>
            <?php endforeach; ?>
        </select>
        <select id="teamFilterRisk" class="team-filter-select" onchange="applyFilters()">
            <option value="">All Risk Levels</option>
            <option value="critical">Critical</option>
            <option value="behind">Behind</option>
            <option value="watch">Watch</option>
            <option value="stable">Stable</option>
        </select>
        <button class="team-filter-chip" id="chipOverdue" onclick="toggleChip('overdue')"><?= tf_icon('alert-triangle') ?> Overdue only</button>
        <button class="team-filter-chip" id="chipHighLoad" onclick="toggleChip('highload')"><?= tf_icon('gauge') ?> High load only</button>
        <button class="team-filter-chip" id="chipReset" onclick="resetFilters()" style="color:#EF4444;border-color:rgba(239,68,68,.2)"><?= tf_icon('x') ?> Reset</button>
    </div>

    <div class="team-sort-bar">
        <span style="font-size:12px;color:var(--text-muted)">Sort:</span>
        <a href="?sort=overdue" class="team-sort-btn <?= ($_GET['sort']??'overdue')==='overdue'?'active':'' ?>"><?= tf_icon('alert-triangle') ?> Overdue</a>
        <a href="?sort=open"    class="team-sort-btn <?= ($_GET['sort']??'')==='open'?'active':'' ?>"><?= tf_icon('clipboard-list') ?> Open</a>
        <a href="?sort=rate"    class="team-sort-btn <?= ($_GET['sort']??'')==='rate'?'active':'' ?>"><?= tf_icon('trending-up') ?> On-time</a>
        <a href="?sort=risk"    class="team-sort-btn <?= ($_GET['sort']??'')==='risk'?'active':'' ?>"><?= tf_icon('alert-circle') ?> Risk</a>
    </div>

    <?php
    // Apply sort
    $sort = $_GET['sort'] ?? 'overdue';
    usort($members, function($a, $b) use ($sort) {
        switch ($sort) {
            case 'open': return (int)$b['open'] - (int)$a['open'];
            case 'rate': return (int)$a['on_time_pct'] - (int)$b['on_time_pct'];
            case 'risk':
                $riskRank = ['critical'=>0,'behind'=>1,'watch'=>2,'stable'=>3];
                return ($riskRank[$a['risk']]??3) - ($riskRank[$b['risk']]??3);
            default:
                if ((int)$b['overdue'] !== (int)$a['overdue']) return (int)$b['overdue'] - (int)$a['overdue'];
                return (int)$b['open'] - (int)$a['open'];
        }
    });

    // Pass member data as JSON for JS drawer
    $membersJson = json_encode(array_map(function($m) {
        return [
            'id'          => (int)$m['id'],
            'name'        => $m['name'],
            'role'        => $m['role'] ?? 'member',
            'open'        => (int)$m['open'],
            'overdue'     => (int)$m['overdue'],
            'due_week'    => (int)$m['due_week'],
            'on_time_pct' => (int)$m['on_time_pct'],
            'risk'        => $m['risk'],
            'businesses'  => array_map(fn($b) => $b['name'], $m['businesses'] ?? []),
            'top_overdue' => !empty($m['top_overdue_task']) ? $m['top_overdue_task']['title'] : null,
        ];
    }, $members));
    ?>

    <!-- Table Header -->
    <div class="team-table-header">
        <span>Member</span>
        <span style="text-align:center">Open</span>
        <span style="text-align:center">Overdue</span>
        <span style="text-align:center">This Week</span>
        <span style="text-align:center">On-time %</span>
        <span style="text-align:center">Workload</span>
        <span style="text-align:center">Risk</span>
        <span style="text-align:right">Actions</span>
    </div>

    <!-- Member Cards -->
    <div class="team-grid" id="teamGrid">
        <?php foreach ($members as $i => $m): ?>
        <?php
            $avatarBg  = $avatarColors[$i % count($avatarColors)];
            $risk      = $m['risk'];
            $riskColor = $riskColors[$risk] ?? '#94A3B8';
            $riskBgC   = $riskBg[$risk] ?? 'rgba(148,163,184,.1)';
            $progPct   = (int)$m['on_time_pct'];
            $progColor = $progPct >= 70 ? '#22C55E' : ($progPct >= 40 ? '#F59E0B' : '#EF4444');
            $loadPct   = $maxOpen > 0 ? min(100, round((int)$m['open'] / $maxOpen * 100)) : 0;
            $loadColor = (int)$m['open'] > ($avgOpen * 1.5) ? '#EF4444' : ((int)$m['open'] > $avgOpen ? '#F59E0B' : '#22C55E');
            $bizNames  = implode(',', array_column($m['businesses'], 'name'));
            $memberSt  = StatePresenter::forMember($m);
        ?>
        <div class="team-member-card"
             style="<?= StatePresenter::cardStyle($memberSt) ?>"
             data-name="<?= e(strtolower($m['name'])) ?>"
             data-risk="<?= e($risk) ?>"
             data-overdue="<?= (int)$m['overdue'] ?>"
             data-open="<?= (int)$m['open'] ?>"
             data-biz="<?= e(strtolower($bizNames)) ?>"
             data-userid="<?= (int)$m['id'] ?>"
             onclick="openDrawer(<?= (int)$m['id'] ?>)">

            <!-- Identity -->
            <div class="team-member-id" onclick="openDrawer(<?= (int)$m['id'] ?>); event.stopPropagation()">
                <div class="team-avatar" style="background:<?= $avatarBg ?>">
                    <?= strtoupper(mb_substr($m['name'], 0, 1)) ?>
                </div>
                <div>
                    <div class="team-member-name"><?= e($m['name']) ?></div>
                    <div class="team-member-role"><?= ucfirst($m['role'] ?? 'member') ?></div>
                    <?php if (!empty($m['top_overdue_task'])): ?>
                    <span class="team-overdue-chip" title="<?= e($m['top_overdue_task']['title']) ?>">
                        <?= tf_icon('alert-triangle') ?> <?= e(mb_strimwidth($m['top_overdue_task']['title'], 0, 28, '…')) ?>
                    </span>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Open -->
            <div class="team-stat">
                <div class="val"><?= (int)$m['open'] ?></div>
                <div class="lbl">Open</div>
            </div>

            <!-- Overdue -->
            <div class="team-stat">
                <div class="val" style="color:<?= (int)$m['overdue'] > 0 ? '#EF4444' : 'inherit' ?>"><?= (int)$m['overdue'] ?></div>
                <div class="lbl">Overdue</div>
            </div>

            <!-- Due this week -->
            <div class="team-stat">
                <div class="val" style="color:<?= (int)$m['due_week'] > 0 ? '#F59E0B' : 'inherit' ?>"><?= (int)$m['due_week'] ?></div>
                <div class="lbl">This Week</div>
            </div>

            <!-- On-time % -->
            <div class="team-stat">
                <div class="val" style="color:<?= $progColor ?>"><?= $progPct ?>%</div>
                <div class="lbl">On-time</div>
            </div>

            <!-- Workload bar -->
            <div class="team-workload" onclick="event.stopPropagation()">
                <div class="lbl">Load</div>
                <div class="team-workload-bar">
                    <div class="team-workload-fill" style="width:<?= $loadPct ?>%;background:<?= $loadColor ?>"></div>
                </div>
                <div class="team-workload-num"><?= (int)$m['open'] ?> tasks</div>
            </div>

            <!-- Risk -->
            <div onclick="event.stopPropagation()">
                <?= IconPresenter::chip(IconPresenter::forUserRisk($risk)) ?>
                <!-- Business tags -->
                <?php if (!empty($m['businesses'])): ?>
                <div class="team-biz-list" style="margin-top:5px">
                    <?php foreach (array_slice($m['businesses'], 0, 2) as $biz): ?>
                    <span class="team-biz-tag" style="border-left:2px solid <?= e($biz['color'] ?? '#6B7280') ?>"><?= e($biz['name']) ?></span>
                    <?php endforeach; ?>
                    <?php if (count($m['businesses']) > 2): ?>
                    <span class="team-biz-tag">+<?= count($m['businesses'])-2 ?></span>
                    <?php endif; ?>
                </div>
                <?php endif; ?>
            </div>

            <!-- Actions -->
            <div class="team-actions" onclick="event.stopPropagation()">
                <a href="<?= APP_URL ?>/overview/member/<?= (int)$m['id'] ?>" class="team-action-btn tab-view">Portfolio</a>
                <?php if ((int)$m['overdue'] > 0): ?>
                <a href="<?= APP_URL ?>/my-tasks?user=<?= (int)$m['id'] ?>" class="team-action-btn tab-overdue"><?= (int)$m['overdue'] ?> OD</a>
                <?php endif; ?>
                <?php if (isAdmin() || isManager()): ?>
                <button onclick="openReassignModal(<?= (int)$m['id'] ?>)"
                        class="team-action-btn tab-reassign"
                        title="Reassign <?= e($m['name']) ?>'s tasks">⇄</button>
                <?php endif; ?>
            </div>

        </div>
        <?php endforeach; ?>

        <?php if (empty($members)): ?>
        <div style="text-align:center;padding:48px 0;color:var(--text-muted)">
            <div style="margin-bottom:8px"><?= tf_icon('users', 36) ?></div>
            <div>No team members found.</div>
        </div>
        <?php endif; ?>
    </div>

    <!-- No results message -->
    <div id="teamNoResults" style="display:none;text-align:center;padding:40px 0;color:#94A3B8;font-size:14px">
        No matching team members
    </div>

</div><!-- /.team-wrap -->

<!-- ══════════════════════════════════════════════════════
     MEMBER QUICK DRAWER
     ══════════════════════════════════════════════════════ -->
<div id="memberDrawer">
    <div class="mdr-header">
        <div>
            <div id="mdrName" style="font-size:18px;font-weight:800"></div>
            <div id="mdrRole" style="font-size:12px;color:#94A3B8;margin-top:2px"></div>
        </div>
        <button class="mdr-close" onclick="closeDrawer()"><?= tf_icon('x') ?></button>
    </div>
    <div class="mdr-body">
        <div class="mdr-stat-row">
            <div class="mdr-stat"><div class="val" id="mdrOpen">—</div><div class="lbl">Open</div></div>
            <div class="mdr-stat"><div class="val" id="mdrOverdue" style="color:#EF4444">—</div><div class="lbl">Overdue</div></div>
            <div class="mdr-stat"><div class="val" id="mdrWeek" style="color:#F59E0B">—</div><div class="lbl">Due Week</div></div>
        </div>
        <div class="mdr-stat-row">
            <div class="mdr-stat" style="grid-column:1/3"><div class="val" id="mdrPct" style="color:#22C55E">—%</div><div class="lbl">On-time Rate</div></div>
            <div class="mdr-stat"><div class="val" id="mdrRisk">—</div><div class="lbl">Risk</div></div>
        </div>
        <div class="mdr-section">Businesses</div>
        <div id="mdrBiz" style="font-size:13px;color:#94A3B8">—</div>
        <div class="mdr-section">Top Overdue Task</div>
        <div id="mdrTopTask" style="font-size:13px;color:#FCA5A5">—</div>
    </div>
    <div class="mdr-actions" id="mdrActions"></div>
</div>
<div id="drawerOverlay" onclick="closeDrawer()" style="display:none;position:fixed;inset:0;z-index:7999;background:rgba(0,0,0,.3)"></div>

<!-- ══════════════════════════════════════════════════════
     REASSIGN MODAL
     ══════════════════════════════════════════════════════ -->
<div id="reassignModal" role="dialog" aria-modal="true">
    <div class="rm-panel">
        <div class="rm-header">
            <h2>⇄ Reassign Tasks</h2>
            <button class="rm-close" onclick="closeReassignModal()"><?= tf_icon('x') ?></button>
        </div>
        <div class="rm-body">
            <div class="rm-users">
                <div>
                    <span class="rm-label">From (Source)</span>
                    <select id="rmFromUser" class="rm-select" onchange="onUserChange()">
                        <option value="">— Select user —</option>
                        <?php foreach ($members as $mu): ?>
                        <option value="<?= (int)$mu['id'] ?>" data-open="<?= (int)$mu['open'] ?>"><?= e($mu['name']) ?> (<?= (int)$mu['open'] ?> open)</option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="rm-user-arrow"><?= tf_icon('arrow-right-circle') ?></div>
                <div>
                    <span class="rm-label">To (Destination)</span>
                    <select id="rmToUser" class="rm-select" onchange="resetPreview()">
                        <option value="">— Select user —</option>
                        <?php foreach ($members as $mu): ?>
                        <option value="<?= (int)$mu['id'] ?>" data-open="<?= (int)$mu['open'] ?>"><?= e($mu['name']) ?> (<?= (int)$mu['open'] ?> open)</option>
                        <?php endforeach; ?>
                    </select>
                </div>
            </div>
            <span class="rm-label" style="margin-bottom:6px">What to move</span>
            <div class="rm-mode">
                <div class="rm-mode-btn active" id="rmModeAll" onclick="setMode('all')"><?= tf_icon('package') ?> Move ALL open tasks</div>
                <div class="rm-mode-btn" id="rmModeSelect" onclick="setMode('select')"><?= tf_icon('check-square') ?> Select specific tasks</div>
            </div>
            <div id="rmTaskList">
                <span class="rm-label" style="margin-bottom:8px">Select tasks to move</span>
                <div id="rmTaskItems"><div style="color:#94A3B8;font-size:13px;padding:8px 0">Select a source user…</div></div>
            </div>
            <div id="rmPreviewBox">
                <div style="font-size:12px;font-weight:700;color:#C4B5FD;text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">Impact Preview</div>
                <div class="rm-preview-grid">
                    <div class="rm-preview-stat"><div class="val" id="rmPreviewCount" style="color:#C4B5FD">—</div><div class="lbl">Tasks Moving</div></div>
                    <div class="rm-preview-stat"><div class="val" id="rmPreviewUrgent" style="color:#FCA5A5">—</div><div class="lbl">Urgent/High</div></div>
                    <div class="rm-preview-stat"><div class="val" id="rmPreviewOverdue" style="color:#FCD34D">—</div><div class="lbl">Overdue</div></div>
                </div>
                <!-- Load bar comparison: From user -->
                <div style="margin-bottom:10px">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                        <span id="rmFromName" style="font-weight:700;font-size:13px">—</span>
                        <span style="display:flex;align-items:center;gap:6px;font-size:12px">
                            <span class="cnt" id="rmFromBefore" style="color:#94A3B8">—</span>
                            <span class="rm-arrow" style="font-size:14px">→</span>
                            <span class="cnt" id="rmFromAfter" style="color:#22C55E;font-weight:800">—</span>
                            <span style="color:#94A3B8">open</span>
                            <span id="rmFromBandAfter" class="load-band" style="display:none"></span>
                        </span>
                    </div>
                    <div style="height:6px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden">
                        <div id="rmFromBarBefore" style="height:100%;border-radius:999px;background:#EF4444;width:0%;transition:width .4s ease;opacity:.4"></div>
                    </div>
                    <div style="height:6px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden;margin-top:3px">
                        <div id="rmFromBarAfter"  style="height:100%;border-radius:999px;background:#22C55E;width:0%;transition:width .4s ease"></div>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:10px;color:#475569;margin-top:2px"><span>Before</span><span>After</span></div>
                </div>
                <!-- Load bar comparison: To user -->
                <div>
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                        <span id="rmToName" style="font-weight:700;font-size:13px">—</span>
                        <span style="display:flex;align-items:center;gap:6px;font-size:12px">
                            <span class="cnt" id="rmToBefore" style="color:#94A3B8">—</span>
                            <span class="rm-arrow" style="font-size:14px">→</span>
                            <span class="cnt" id="rmToAfter" style="color:#F59E0B;font-weight:800">—</span>
                            <span style="color:#94A3B8">open</span>
                            <span id="rmToBandAfter" class="load-band" style="display:none"></span>
                        </span>
                    </div>
                    <div style="height:6px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden">
                        <div id="rmToBarBefore" style="height:100%;border-radius:999px;background:#3B82F6;width:0%;transition:width .4s ease;opacity:.4"></div>
                    </div>
                    <div style="height:6px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden;margin-top:3px">
                        <div id="rmToBarAfter"  style="height:100%;border-radius:999px;background:#F59E0B;width:0%;transition:width .4s ease"></div>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:10px;color:#475569;margin-top:2px"><span>Before</span><span>After</span></div>
                </div>
                <div id="rmWarnings"></div>
            </div>
            <div id="rmEmptyState" style="text-align:center;padding:20px 0;color:#94A3B8;font-size:13px;display:none">This user has no open tasks to reassign.</div>
        </div>
        <div class="rm-footer">
            <button class="rm-btn rm-btn-cancel" onclick="closeReassignModal()">Cancel</button>
            <button class="rm-btn rm-btn-preview" id="rmPreviewBtn" onclick="previewReassign()"><?= tf_icon('eye') ?> Preview Impact</button>
            <button class="rm-btn rm-btn-confirm" id="rmConfirmBtn" disabled onclick="confirmReassign()">⇄ Confirm Reassign</button>
        </div>
    </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     AUTO-REBALANCE PLAN MODAL
     ══════════════════════════════════════════════════════════ -->
<div id="rebalanceModal" style="display:none;position:fixed;inset:0;z-index:9100;align-items:center;justify-content:center;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);padding:16px">
  <div style="background:#111827;border:1px solid #1F2937;border-radius:14px;width:100%;max-width:780px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.6)">

    <!-- Modal header -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px 16px;border-bottom:1px solid #1F2937;flex-shrink:0">
      <div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:20px"><?= tf_icon('cpu', 20) ?></span>
          <h2 style="margin:0;font-size:17px;font-weight:700;color:#F9FAFB">Auto-Rebalance Workload</h2>
          <span id="rbConfBadge" style="display:none;font-size:10px;font-weight:700;letter-spacing:.06em;padding:2px 8px;border-radius:20px;background:rgba(34,197,94,.15);color:#22C55E;border:1px solid rgba(34,197,94,.25)"></span>
        </div>
        <p id="rbSubtitle" style="margin:4px 0 0 30px;font-size:12px;color:#6B7280">Analysing team workload…</p>
      </div>
      <button onclick="closeRebalanceModal()" style="background:none;border:none;color:#6B7280;font-size:20px;cursor:pointer;line-height:1;padding:4px 6px;border-radius:6px" title="Close"><?= tf_icon('x') ?></button>
    </div>

    <!-- Plan tabs (shown once plan loaded) -->
    <div id="rbPlanTabs" style="display:none;border-bottom:1px solid #1F2937;flex-shrink:0">
      <div style="display:flex;gap:0">
        <button id="rbTabSafe" onclick="switchPlanTab('safe')" class="rb-plan-tab rb-plan-tab-active">
          Plan A &nbsp;·&nbsp; <span style="opacity:.8">Safe</span>
          <span id="rbTabSafeRec" style="display:none;font-size:9px;font-weight:700;letter-spacing:.06em;padding:1px 6px;border-radius:10px;background:rgba(34,197,94,.15);color:#22C55E;border:1px solid rgba(34,197,94,.25);margin-left:6px">★ RECOMMENDED</span>
        </button>
        <button id="rbTabAggressive" onclick="switchPlanTab('aggressive')" class="rb-plan-tab">
          Plan B &nbsp;·&nbsp; <span style="opacity:.8">Aggressive</span>
          <span id="rbTabAggrRec" style="display:none;font-size:9px;font-weight:700;letter-spacing:.06em;padding:1px 6px;border-radius:10px;background:rgba(34,197,94,.15);color:#22C55E;border:1px solid rgba(34,197,94,.25);margin-left:6px">★ RECOMMENDED</span>
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div id="rbLoading" style="padding:48px 24px;text-align:center;color:#6B7280;font-size:14px">
      <div style="margin-bottom:12px;animation:rbSpin 1s linear infinite;display:inline-block"><?= tf_icon('settings', 32) ?></div>
      <div>Generating rebalance plan…</div>
    </div>

    <!-- Error / no-plan state -->
    <div id="rbNoPlan" style="display:none;padding:40px 24px;text-align:center">
      <div style="margin-bottom:12px"><?= tf_icon('check-circle', 40) ?></div>
      <div id="rbNoPlanMsg" style="font-size:14px;color:#9CA3AF">Team workload is balanced — no action needed.</div>
    </div>

    <!-- Plan body (scrollable) -->
    <div id="rbPlanBody" style="display:none;overflow-y:auto;flex:1;padding:0 24px 8px">

      <!-- ── Plan Intelligence: collapsed by default — click to expand ── -->
      <div id="rbIntelBox" style="margin:14px 0 0;border:1px solid rgba(124,58,237,.2);border-radius:10px;background:rgba(124,58,237,.04);overflow:hidden">
        <div onclick="toggleRbIntel()" style="padding:9px 14px;display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none" title="Click to expand reasoning">
          <span style="font-size:12px;color:#A78BFA;font-weight:700;letter-spacing:.05em"><?= tf_icon('brain', 12) ?> WHY THIS PLAN</span>
          <span id="rbIntelSignalCount" style="font-size:11px;color:#6B7280">3 signals</span>
          <span style="flex:1"></span>
          <span id="rbIntelToggleIcon" style="font-size:11px;color:#4B5563">▼ expand</span>
        </div>
        <div id="rbIntelItems" style="display:none;padding:10px 14px 12px;display:none;flex-direction:column;gap:8px;font-size:12px;color:#D1D5DB;border-top:1px solid rgba(124,58,237,.1)"></div>
      </div>

      <!-- ── Impact metrics ── -->
      <div id="rbRiskRow" style="margin:10px 0 12px;padding:11px 14px;background:#0F172A;border-radius:8px;border:1px solid #1F2937;display:flex;align-items:center;gap:0;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:6px;padding:4px 18px 4px 0;border-right:1px solid #1F2937;margin-right:18px">
          <span style="font-size:22px;font-weight:800;color:#EF4444;line-height:1" id="rbOverdueReduced"></span>
          <div><div style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:.07em">Overdue</div><div style="font-size:10px;color:#6B7280">tasks moved first</div></div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;padding:4px 18px 4px 0;border-right:1px solid #1F2937;margin-right:18px">
          <span style="font-size:22px;font-weight:800;color:#F59E0B;line-height:1" id="rbTotalMoving"></span>
          <div><div style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:.07em">Total tasks</div><div style="font-size:10px;color:#6B7280">redistributed</div></div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;padding:4px 0">
          <span style="font-size:22px;font-weight:800;color:#22C55E;line-height:1" id="rbBizRisk"></span>
          <div><div style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:.07em">Business risk</div><div style="font-size:10px;color:#6B7280">reduction</div></div>
        </div>
      </div>

      <!-- Action groups -->
      <div id="rbActions"></div>

      <!-- Next action panel (shown post-apply) -->
      <div id="rbNextActions" style="display:none;margin:12px 0 0;padding:12px 14px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.15);border-radius:8px">
        <div style="font-size:11px;color:#22C55E;font-weight:700;letter-spacing:.06em;margin-bottom:8px"><?= tf_icon('check-circle') ?> APPLIED · NEXT BEST ACTIONS</div>
        <div id="rbNextActionItems" style="display:flex;flex-direction:column;gap:6px"></div>
      </div>

    </div>

    <!-- Footer -->
    <div id="rbFooter" style="display:none;padding:16px 24px;border-top:1px solid #1F2937;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0;flex-wrap:wrap">
      <div style="font-size:12px;color:#6B7280" id="rbFooterNote">SmartEngine V2 · Review each move before applying.</div>
      <div style="display:flex;gap:10px">
        <button onclick="closeRebalanceModal()" style="padding:8px 18px;background:transparent;border:1px solid #374151;border-radius:8px;color:#9CA3AF;font-size:13px;cursor:pointer">Cancel</button>
        <button id="rbApplyBtn" onclick="applyRebalancePlan()" style="padding:8px 20px;background:linear-gradient(135deg,#3B82F6,#2563EB);border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px">
          <?= tf_icon('zap') ?> Apply Plan
        </button>
      </div>
    </div>

  </div>
</div>

<style>
@keyframes rbSpin { to { transform:rotate(360deg); } }

/* Plan tabs */
.rb-plan-tab {
  background:none;
  border:none;
  border-bottom:2px solid transparent;
  padding:11px 20px;
  font-size:12px;
  font-weight:600;
  color:#6B7280;
  cursor:pointer;
  transition:.15s;
  white-space:nowrap;
}
.rb-plan-tab:hover { color:#D1D5DB; }
.rb-plan-tab-active {
  color:#F9FAFB;
  border-bottom-color:#3B82F6;
  background:rgba(59,130,246,.05);
}

.rb-action-group {
  border:1px solid #1F2937;
  border-radius:10px;
  margin-bottom:12px;
  overflow:hidden;
}
.rb-action-head {
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:12px 16px;
  background:#0B0F14;
  gap:12px;
  flex-wrap:wrap;
}
.rb-action-from { font-size:13px; font-weight:700; color:#FCA5A5; }
.rb-action-arrow { color:#6B7280; font-size:14px; }
.rb-action-to   { font-size:13px; font-weight:700; color:#86EFAC; }
.rb-load-pill {
  font-size:11px;
  padding:2px 8px;
  border-radius:20px;
  background:rgba(245,158,11,.12);
  color:#F59E0B;
  border:1px solid rgba(245,158,11,.2);
  white-space:nowrap;
}
.rb-task-list { padding:8px 0; }
.rb-task-row {
  display:flex;
  align-items:center;
  gap:10px;
  padding:7px 16px;
  border-bottom:1px solid rgba(31,41,55,.6);
  font-size:12px;
  color:#D1D5DB;
}
.rb-task-row:last-child { border-bottom:none; }
.rb-task-row.rb-overdue { border-left:3px solid #EF4444; background:rgba(239,68,68,.03); }
.rb-task-name { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rb-task-due  { color:#6B7280; white-space:nowrap; font-size:11px; }
.rb-task-pri  { font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px; text-transform:uppercase; letter-spacing:.05em; white-space:nowrap; }
.rb-pri-urgent { background:rgba(239,68,68,.15);  color:#EF4444; }
.rb-pri-high   { background:rgba(245,158,11,.15); color:#F59E0B; }
.rb-pri-medium { background:rgba(96,165,250,.12); color:#60A5FA; }
.rb-pri-low    { background:rgba(107,114,128,.12); color:#6B7280; }
.rb-remove-btn {
  background:none;
  border:1px solid #374151;
  border-radius:5px;
  color:#6B7280;
  font-size:10px;
  padding:2px 7px;
  cursor:pointer;
  white-space:nowrap;
}
.rb-remove-btn:hover { border-color:#EF4444; color:#EF4444; }
.rb-member-stat {
  display:flex;
  align-items:center;
  gap:6px;
  padding:8px 16px;
  background:#0F172A;
  font-size:12px;
  color:#6B7280;
  border-top:1px solid #1F2937;
  flex-wrap:wrap;
}
.rb-stat-val { font-weight:700; color:#F9FAFB; }
.rb-stat-arrow { color:#22C55E; }
</style>

<div id="teamToast" class="team-toast"></div>

<script>
// ────────────────────────────────────────────────────────────
// DATA
// ────────────────────────────────────────────────────────────
var TEAM_DATA = <?= $membersJson ?>;
var CSRF = '<?= csrf_token() ?>';
var APP_URL = '<?= APP_URL ?>';
var avgOpen = <?= round($avgOpen, 2) ?>;

// ────────────────────────────────────────────────────────────
// FILTERS
// ────────────────────────────────────────────────────────────
var activeChips = {};

function toggleChip(type) {
    activeChips[type] = !activeChips[type];
    document.getElementById('chip' + type.charAt(0).toUpperCase() + type.slice(1)).classList.toggle('active', !!activeChips[type]);
    applyFilters();
}

function filterByKpi(type) {
    if (type === 'critical') { document.getElementById('teamFilterRisk').value = ''; }
    if (type === 'overdue') { activeChips['overdue'] = true; document.getElementById('chipOverdue').classList.add('active'); }
    if (type === 'rebalance') { activeChips['highload'] = true; document.getElementById('chipHighLoad').classList.add('active'); }
    applyFilters();
}

function resetFilters() {
    document.getElementById('teamSearch').value = '';
    document.getElementById('teamFilterBiz').value = '';
    document.getElementById('teamFilterRisk').value = '';
    activeChips = {};
    document.querySelectorAll('.team-filter-chip').forEach(function(c) { c.classList.remove('active'); });
    applyFilters();
}

function applyFilters() {
    var search  = document.getElementById('teamSearch').value.toLowerCase().trim();
    var biz     = document.getElementById('teamFilterBiz').value.toLowerCase();
    var risk    = document.getElementById('teamFilterRisk').value;
    var cards   = document.querySelectorAll('#teamGrid .team-member-card');
    var visible = 0;

    cards.forEach(function(card) {
        var name    = card.dataset.name || '';
        var cardRisk = card.dataset.risk || '';
        var overdue = parseInt(card.dataset.overdue) || 0;
        var open    = parseInt(card.dataset.open) || 0;
        var cardBiz = card.dataset.biz || '';

        var show = true;
        if (search && name.indexOf(search) === -1) show = false;
        if (risk && cardRisk !== risk) show = false;
        if (biz && cardBiz.indexOf(biz) === -1) show = false;
        if (activeChips['overdue'] && overdue === 0) show = false;
        if (activeChips['highload'] && open <= avgOpen * 1.5) show = false;

        card.style.display = show ? '' : 'none';
        if (show) visible++;
    });

    document.getElementById('teamNoResults').style.display = visible === 0 ? 'block' : 'none';
}

// ────────────────────────────────────────────────────────────
// MEMBER DRAWER
// ────────────────────────────────────────────────────────────
function openDrawer(userId) {
    var m = TEAM_DATA.find(function(x) { return x.id === userId; });
    if (!m) return;

    document.getElementById('mdrName').textContent   = m.name;
    document.getElementById('mdrRole').textContent   = m.role.charAt(0).toUpperCase() + m.role.slice(1);
    document.getElementById('mdrOpen').textContent   = m.open;
    document.getElementById('mdrOverdue').textContent = m.overdue;
    document.getElementById('mdrWeek').textContent   = m.due_week;
    document.getElementById('mdrPct').textContent    = m.on_time_pct + '%';
    document.getElementById('mdrRisk').textContent   = m.risk.charAt(0).toUpperCase() + m.risk.slice(1);
    document.getElementById('mdrBiz').textContent    = m.businesses.length ? m.businesses.join(', ') : 'None';
    document.getElementById('mdrTopTask').textContent = m.top_overdue ? m.top_overdue : 'No overdue tasks';

    var actions = '<a href="' + APP_URL + '/overview/member/' + userId + '" class="mdr-btn mdr-btn-ghost">📋 Full Portfolio</a>';
    if (m.overdue > 0) {
        actions += '<a href="' + APP_URL + '/my-tasks?user=' + userId + '" class="mdr-btn mdr-btn-ghost" style="color:#FCA5A5">⚠ View Overdue Tasks</a>';
    }
    actions += '<button class="mdr-btn mdr-btn-primary" onclick="closeDrawer(); openReassignModal(' + userId + ')">⇄ Reassign Tasks</button>';
    document.getElementById('mdrActions').innerHTML = actions;

    document.getElementById('memberDrawer').classList.add('open');
    document.getElementById('drawerOverlay').style.display = 'block';
}

function closeDrawer() {
    document.getElementById('memberDrawer').classList.remove('open');
    document.getElementById('drawerOverlay').style.display = 'none';
}

// ────────────────────────────────────────────────────────────
// REASSIGN MODAL
// ────────────────────────────────────────────────────────────
var rmMode = 'all';
var rmLastPreview = null;

function openReassignModal(fromUserId, toUserId) {
    document.getElementById('reassignModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    closeDrawer();

    if (fromUserId) { document.getElementById('rmFromUser').value = fromUserId; onUserChange(); }
    else { document.getElementById('rmFromUser').value = ''; document.getElementById('rmTaskItems').innerHTML = '<div style="color:#94A3B8;font-size:13px;padding:8px 0">Select a source user…</div>'; }
    document.getElementById('rmToUser').value = toUserId || '';
    resetPreview(); setMode('all');
}

function closeReassignModal() {
    document.getElementById('reassignModal').style.display = 'none';
    document.body.style.overflow = '';
    rmLastPreview = null;
}

document.getElementById('reassignModal').addEventListener('click', function(e) {
    if (e.target === this) closeReassignModal();
});

function setMode(mode) {
    rmMode = mode;
    document.getElementById('rmModeAll').classList.toggle('active', mode === 'all');
    document.getElementById('rmModeSelect').classList.toggle('active', mode === 'select');
    document.getElementById('rmTaskList').style.display = mode === 'select' ? 'block' : 'none';
    resetPreview();
}

function onUserChange() {
    resetPreview();
    var fromId = document.getElementById('rmFromUser').value;
    if (!fromId) return;
    document.getElementById('rmTaskItems').innerHTML = '<div style="color:#94A3B8;font-size:13px;padding:8px 0">Loading…</div>';

    fetch(APP_URL + '/api/tasks/reassign/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': CSRF },
        body: 'from_user_id=' + fromId + '&to_user_id=0'
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (!data.tasks || data.tasks.length === 0) {
            document.getElementById('rmTaskItems').innerHTML = '<div style="color:#94A3B8;font-size:13px;padding:8px 0">No open tasks.</div>';
            document.getElementById('rmEmptyState').style.display = 'block';
            return;
        }
        document.getElementById('rmEmptyState').style.display = 'none';
        renderTaskList(data.tasks);
    })
    .catch(function() { document.getElementById('rmTaskItems').innerHTML = '<div style="color:#FCA5A5;font-size:13px;padding:8px 0">Failed to load.</div>'; });
}

function renderTaskList(tasks) {
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var html = tasks.map(function(t) {
        var dueTxt = '';
        if (t.due_date) { var d = new Date(t.due_date); dueTxt = months[d.getUTCMonth()] + ' ' + d.getUTCDate(); }
        return '<label class="rm-task-item">' +
            '<input type="checkbox" class="rm-task-check" value="' + t.id + '" checked>' +
            '<span class="rm-task-name" title="' + escHtml(t.title) + '">' + escHtml(t.title) + '</span>' +
            '<span class="rm-task-badge badge-' + (t.priority||'medium') + '">' + (t.priority||'medium') + '</span>' +
            (dueTxt ? '<span class="rm-task-due">' + dueTxt + '</span>' : '') +
        '</label>';
    }).join('');
    document.getElementById('rmTaskItems').innerHTML = html || '<div style="color:#94A3B8">No tasks.</div>';
}

function escHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function getSelectedTaskIds() {
    return Array.from(document.querySelectorAll('.rm-task-check:checked')).map(function(c) { return c.value; });
}

function buildFormBody() {
    var fromId = document.getElementById('rmFromUser').value;
    var toId   = document.getElementById('rmToUser').value;
    var body   = 'from_user_id=' + encodeURIComponent(fromId) + '&to_user_id=' + encodeURIComponent(toId);
    if (rmMode === 'select') {
        getSelectedTaskIds().forEach(function(id) { body += '&task_ids[]=' + encodeURIComponent(id); });
    }
    return body;
}

function resetPreview() {
    document.getElementById('rmPreviewBox').style.display = 'none';
    document.getElementById('rmConfirmBtn').disabled = true;
    rmLastPreview = null;
}

async function previewReassign() {
    var fromId = document.getElementById('rmFromUser').value;
    var toId   = document.getElementById('rmToUser').value;
    if (!fromId || !toId) { showTeamToast('Select both users first', '#F59E0B'); return; }
    if (fromId === toId)  { showTeamToast('Source and destination must differ', '#EF4444'); return; }

    var btn = document.getElementById('rmPreviewBtn');
    btn.textContent = '⏳'; btn.disabled = true;
    try {
        var res  = await fetch(APP_URL + '/api/tasks/reassign/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': CSRF },
            body: buildFormBody()
        });
        var data = await res.json();
        if (!data.success) { showTeamToast('⚠ ' + (data.error || 'Preview failed'), '#EF4444'); return; }
        rmLastPreview = data; renderPreview(data);
    } catch(e) { showTeamToast('Network error', '#EF4444'); }
    finally { btn.textContent = '👁 Preview Impact'; btn.disabled = false; }
}

var LOAD_BAND_COLORS = {
    stable:   { bg:'rgba(34,197,94,.15)',  color:'#22C55E', icon:'✅' },
    watch:    { bg:'rgba(245,158,11,.15)', color:'#F59E0B', icon:'👀' },
    behind:   { bg:'rgba(249,115,22,.15)', color:'#F97316', icon:'⚠️' },
    critical: { bg:'rgba(239,68,68,.15)',  color:'#EF4444', icon:'🔥' },
};

function renderLoadBand(elId, band) {
    var el = document.getElementById(elId);
    if (!el || !band) return;
    var bc = LOAD_BAND_COLORS[band] || LOAD_BAND_COLORS.stable;
    el.textContent = bc.icon + ' ' + band.charAt(0).toUpperCase() + band.slice(1);
    el.style.background = bc.bg;
    el.style.color = bc.color;
    el.style.display = 'inline-flex';
}

function renderLoadBar(barId, pct, color) {
    var el = document.getElementById(barId);
    if (el) { el.style.width = Math.min(100, Math.max(0, pct)) + '%'; if (color) el.style.background = color; }
}

function renderPreview(data) {
    document.getElementById('rmPreviewCount').textContent   = data.moving_count;
    document.getElementById('rmPreviewUrgent').textContent  = data.urgent_count;
    document.getElementById('rmPreviewOverdue').textContent = data.overdue_count;

    // From user
    var fu = data.from_user;
    document.getElementById('rmFromName').textContent   = fu.name;
    document.getElementById('rmFromBefore').textContent = fu.before;
    document.getElementById('rmFromAfter').textContent  = fu.after;

    // Load bars for from user (before=before load_score, after=after load_score, cap at 100)
    var fromScoreBefore = fu.load_before ? fu.load_before.load_score : 0;
    var fromScoreAfter  = fu.load_after  ? fu.load_after.load_score  : 0;
    var maxScore = Math.max(100, fromScoreBefore);
    renderLoadBar('rmFromBarBefore', fromScoreBefore / maxScore * 100);
    renderLoadBar('rmFromBarAfter',  fromScoreAfter  / maxScore * 100);
    if (fu.load_after && fu.load_after.band) renderLoadBand('rmFromBandAfter', fu.load_after.band);

    // To user
    var tu = data.to_user;
    document.getElementById('rmToName').textContent   = tu.name;
    document.getElementById('rmToBefore').textContent = tu.before;
    document.getElementById('rmToAfter').textContent  = tu.after;

    var toScoreBefore = tu.load_before ? tu.load_before.load_score : 0;
    var toScoreAfter  = tu.load_after  ? tu.load_after.load_score  : 0;
    var toMaxScore = Math.max(100, toScoreAfter);
    renderLoadBar('rmToBarBefore', toScoreBefore / toMaxScore * 100);
    renderLoadBar('rmToBarAfter',  toScoreAfter  / toMaxScore * 100);
    if (tu.load_after && tu.load_after.band) renderLoadBand('rmToBandAfter', tu.load_after.band);

    document.getElementById('rmWarnings').innerHTML = (data.warnings||[]).map(function(w) {
        return '<div class="rm-warning-item">⚠ ' + escHtml(w) + '</div>';
    }).join('');
    document.getElementById('rmPreviewBox').style.display = 'block';
    document.getElementById('rmConfirmBtn').disabled = (data.moving_count === 0);
}

async function confirmReassign() {
    var fromId = document.getElementById('rmFromUser').value;
    var toId   = document.getElementById('rmToUser').value;
    if (!fromId || !toId || fromId === toId) return;

    var btn = document.getElementById('rmConfirmBtn');
    btn.textContent = '⏳ Moving…'; btn.disabled = true;
    try {
        var res  = await fetch(APP_URL + '/api/tasks/reassign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': CSRF },
            body: buildFormBody()
        });
        var data = await res.json();
        if (!data.success) { showTeamToast('⚠ ' + (data.error||'Failed'), '#EF4444'); return; }

        // Update in-page open counts
        updateMemberCard(data.from_user.id, data.from_user.open_tasks);
        updateMemberCard(data.to_user.id,   data.to_user.open_tasks);

        showTeamToast('✅ ' + data.moved + ' tasks → ' + data.to_user.name, '#22C55E');
        closeReassignModal();

        // Refresh KPI strip from server
        refreshTeamKpis();
    } catch(e) { showTeamToast('Network error', '#EF4444'); }
    finally { btn.textContent = '⇄ Confirm Reassign'; btn.disabled = false; }
}

function updateMemberCard(userId, newCount) {
    var card = document.querySelector('.team-member-card[data-userid="' + userId + '"]');
    if (!card) return;
    card.dataset.open = newCount;
    var stats = card.querySelectorAll('.team-stat .val');
    if (stats[0]) stats[0].textContent = newCount;
    // Update workload bar
    var fill = card.querySelector('.team-workload-fill');
    var numEl = card.querySelector('.team-workload-num');
    if (fill) fill.style.width = Math.min(100, Math.round(newCount / Math.max(1, avgOpen * 2) * 100)) + '%';
    if (numEl) numEl.textContent = newCount + ' tasks';
    // Update TEAM_DATA
    var m = TEAM_DATA.find(function(x) { return x.id === userId; });
    if (m) m.open = newCount;
    // Update modal dropdowns
    ['rmFromUser','rmToUser'].forEach(function(selId) {
        var opt = document.querySelector('#' + selId + ' option[value="' + userId + '"]');
        if (opt) opt.textContent = opt.textContent.replace(/\(\d+ open\)/, '(' + newCount + ' open)');
    });
}

// ────────────────────────────────────────────────────────────
// TOAST
// ────────────────────────────────────────────────────────────
var _toastTimer;
function showTeamToast(msg, color) {
    var el = document.getElementById('teamToast');
    el.innerHTML = '<span>' + (color==='#22C55E'?'✅':'⚠') + '</span> ' + escHtml(msg);
    el.style.borderColor = color || '#3B82F6';
    el.style.display = 'flex';
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function() { el.style.display = 'none'; }, 4500);
}

// ────────────────────────────────────────────────────────────
// KPI CHAIN REFRESH — called after every meaningful action
// ────────────────────────────────────────────────────────────
function refreshTeamKpis() {
    fetch(APP_URL + '/api/team/summary', {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (!d.kpi) return;
        var map = {
            kpiOverloaded: d.kpi.overloaded,
            kpiOverdue:    d.kpi.total_overdue,
            kpiBizImpact:  d.kpi.biz_impact,
            kpiRebalance:  d.kpi.rebalance,
            kpiOnTime:     (d.kpi.on_time_pct !== undefined ? d.kpi.on_time_pct + '%' : null),
            kpiDoneWeek:   null, // not returned by summary — skip
        };
        Object.keys(map).forEach(function(id) {
            var val = map[id];
            if (val === null || val === undefined) return;
            var el = document.getElementById(id);
            if (!el) return;
            el.textContent = val;
            el.classList.remove('kpi-updated');
            void el.offsetWidth; // reflow to restart animation
            el.classList.add('kpi-updated');
        });
    })
    .catch(function() {}); // silent — KPI refresh is best-effort
}

// ────────────────────────────────────────────────────────────
// SMART STRIP — collapse toggle + live refresh
// ────────────────────────────────────────────────────────────
var _smartStripOpen = true;

function toggleSmartStrip() {
    _smartStripOpen = !_smartStripOpen;
    var items = document.getElementById('smartRecItems');
    var icon  = document.getElementById('smartRecToggleIcon');
    if (items) items.style.display = _smartStripOpen ? '' : 'none';
    if (icon)  icon.textContent    = _smartStripOpen ? '▲' : '▼';
}

function refreshSmartRecs() {
    fetch(APP_URL + '/api/team/summary', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        var recs  = d.smart_suggestions || [];
        var strip = document.getElementById('smartRecStrip');
        var items = document.getElementById('smartRecItems');
        var count = document.getElementById('smartRecCount');
        if (!strip || !items) return;

        if (recs.length === 0) {
            // All recommendations resolved — fade out strip
            strip.style.transition = 'opacity .4s';
            strip.style.opacity = '0';
            setTimeout(function() { strip.style.display = 'none'; }, 450);
            return;
        }

        // Re-render recommendations
        var BAND_COLOR = { critical: '#EF4444', behind: '#F97316', watch: '#F59E0B', stable: '#22C55E',
                           overload: '#EF4444', rebalance: '#7C3AED', insight: '#60A5FA' };
        var html = recs.map(function(rec) {
            var typeColor = BAND_COLOR[rec.type] || '#60A5FA';
            var actionBtn = '';
            if (rec.action === 'reassign' && rec.from_user_id) {
                actionBtn = '<button class="team-smart-btn tsb-reassign" onclick="openReassignModal(' + (parseInt(rec.from_user_id)||0) + ')">⇄ ' + escHtml(rec.label||'Reassign') + '</button>';
            } else if (rec.action === 'rebalance') {
                actionBtn = '<button class="team-smart-btn tsb-reassign" onclick="openRebalanceModal()">🤖 Review Plan</button>';
            }
            return '<div class="team-smart-item" style="border-left:3px solid ' + typeColor + '">' +
                '<span class="team-smart-icon" style="color:' + typeColor + '">' + escHtml(rec.icon||'💡') + '</span>' +
                '<div style="flex:1">' +
                    '<div class="team-smart-text">' + escHtml(rec.title || rec.text || '') + '</div>' +
                    (rec.reason ? '<div style="font-size:11px;color:#94A3B8;margin-top:2px">' + escHtml(rec.reason) + '</div>' : '') +
                '</div>' +
                actionBtn +
            '</div>';
        }).join('');

        items.innerHTML = html;
        if (count) count.textContent = recs.length + ' items';
        // Ensure strip is visible and re-open
        strip.style.display = '';
        strip.style.opacity = '1';
        _smartStripOpen = true;
        var toggleIcon = document.getElementById('smartRecToggleIcon');
        if (toggleIcon) toggleIcon.textContent = '▲';
        if (items) items.style.display = '';
    })
    .catch(function() {}); // silent
}

// ────────────────────────────────────────────────────────────
// AUTO-REBALANCE AI
// ────────────────────────────────────────────────────────────
var _rbBothPlans    = null;   // { plans:{safe,aggressive}, recommended }
var _rbActiveMode   = 'safe'; // currently displayed plan tab
var _rbPlan         = null;   // the active plan object (shortcut)
var _rbRemovedTaskIds = {};   // task IDs the manager removed before applying

function openRebalanceModal() {
    _rbBothPlans   = null;
    _rbPlan        = null;
    _rbRemovedTaskIds = {};
    _rbActiveMode  = 'safe';

    var modal = document.getElementById('rebalanceModal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Reset UI
    document.getElementById('rbLoading').style.display    = 'block';
    document.getElementById('rbNoPlan').style.display     = 'none';
    document.getElementById('rbPlanBody').style.display   = 'none';
    document.getElementById('rbFooter').style.display     = 'none';
    document.getElementById('rbPlanTabs').style.display   = 'none';
    document.getElementById('rbNextActions').style.display= 'none';
    document.getElementById('rbConfBadge').style.display  = 'none';
    document.getElementById('rbSubtitle').textContent     = 'Analysing team workload…';
    document.getElementById('rbIntelItems').innerHTML     = '';
    document.getElementById('rbIntelItems').style.display = 'none';
    document.getElementById('rbIntelToggleIcon').textContent = '▼ expand';
    document.getElementById('rbActions').innerHTML        = '';

    fetchRebalancePlan();
}

function closeRebalanceModal() {
    document.getElementById('rebalanceModal').style.display = 'none';
    document.body.style.overflow = '';
    _rbPlan = null;
}

document.getElementById('rebalanceModal').addEventListener('click', function(e) {
    if (e.target === this) closeRebalanceModal();
});

async function fetchRebalancePlan() {
    try {
        var res  = await fetch(APP_URL + '/api/team/rebalance-plan', {
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-Token': CSRF }
        });
        var data = await res.json();
        document.getElementById('rbLoading').style.display = 'none';

        if (!data.has_plan) {
            var msg = data.reason || 'Team workload is balanced — no action needed.';
            if (data.candidates > 0) {
                msg = '⚡ ' + data.candidates + ' overloaded member' + (data.candidates > 1 ? 's' : '') +
                      ' detected, but no suitable destinations found. Try reassigning manually.';
            }
            document.getElementById('rbNoPlanMsg').textContent = msg;
            document.getElementById('rbNoPlan').style.display  = 'block';
            return;
        }

        _rbBothPlans = data;

        // Activate the recommended tab
        _rbActiveMode = data.recommended || 'safe';
        _rbPlan       = (data.plans || {})[_rbActiveMode] || null;
        if (!_rbPlan || !_rbPlan.has_plan) {
            // Fallback: try the other plan
            _rbActiveMode = _rbActiveMode === 'safe' ? 'aggressive' : 'safe';
            _rbPlan       = (data.plans || {})[_rbActiveMode] || null;
        }
        if (!_rbPlan || !_rbPlan.has_plan) {
            document.getElementById('rbNoPlanMsg').textContent = 'No actionable plan could be generated.';
            document.getElementById('rbNoPlan').style.display  = 'block';
            return;
        }

        // Show plan tabs
        document.getElementById('rbPlanTabs').style.display = '';
        // Mark the recommended tab
        var rec = data.recommended || 'safe';
        document.getElementById('rbTabSafeRec').style.display   = rec === 'safe'       ? 'inline-flex' : 'none';
        document.getElementById('rbTabAggrRec').style.display   = rec === 'aggressive' ? 'inline-flex' : 'none';
        // Update tab active state
        document.getElementById('rbTabSafe').className       = 'rb-plan-tab' + (_rbActiveMode === 'safe'       ? ' rb-plan-tab-active' : '');
        document.getElementById('rbTabAggressive').className  = 'rb-plan-tab' + (_rbActiveMode === 'aggressive' ? ' rb-plan-tab-active' : '');

        renderRebalancePlan(_rbPlan);
    } catch(e) {
        document.getElementById('rbLoading').style.display = 'none';
        document.getElementById('rbNoPlanMsg').textContent = '⚠ Failed to load plan. Please try again.';
        document.getElementById('rbNoPlan').style.display  = 'block';
    }
}

function switchPlanTab(mode) {
    if (!_rbBothPlans) return;
    var plan = (_rbBothPlans.plans || {})[mode];
    if (!plan || !plan.has_plan) {
        showTeamToast('Plan ' + (mode === 'safe' ? 'A' : 'B') + ' not available', '#F59E0B');
        return;
    }
    _rbActiveMode     = mode;
    _rbPlan           = plan;
    _rbRemovedTaskIds = {};

    document.getElementById('rbTabSafe').className       = 'rb-plan-tab' + (mode === 'safe'       ? ' rb-plan-tab-active' : '');
    document.getElementById('rbTabAggressive').className  = 'rb-plan-tab' + (mode === 'aggressive' ? ' rb-plan-tab-active' : '');

    // Reset intel collapse
    document.getElementById('rbIntelItems').style.display    = 'none';
    document.getElementById('rbIntelToggleIcon').textContent = '▼ expand';
    document.getElementById('rbNextActions').style.display   = 'none';

    renderRebalancePlan(plan);
}

var _rbIntelOpen = false;
function toggleRbIntel() {
    _rbIntelOpen = !_rbIntelOpen;
    var items = document.getElementById('rbIntelItems');
    var icon  = document.getElementById('rbIntelToggleIcon');
    items.style.display = _rbIntelOpen ? 'flex' : 'none';
    icon.textContent    = _rbIntelOpen ? '▲ collapse' : '▼ expand';
}

function renderRebalancePlan(plan) {
    // ── Confidence badge ──
    var confBadge  = document.getElementById('rbConfBadge');
    var confColors = { High:   ['rgba(34,197,94,.15)',  '#22C55E', 'rgba(34,197,94,.25)'],
                       Medium: ['rgba(245,158,11,.15)', '#F59E0B', 'rgba(245,158,11,.25)'],
                       Low:    ['rgba(239,68,68,.12)',  '#EF4444', 'rgba(239,68,68,.2)'] };
    var cc = confColors[plan.confidence_label] || confColors.Medium;
    confBadge.textContent = plan.confidence_label + ' Confidence';
    confBadge.style.background  = cc[0];
    confBadge.style.color       = cc[1];
    confBadge.style.borderColor = cc[2];
    confBadge.style.display     = 'inline-flex';

    var modeLabel = plan.mode === 'aggressive' ? 'Plan B (Aggressive)' : 'Plan A (Safe)';
    document.getElementById('rbSubtitle').textContent =
        modeLabel + ' · ' + plan.sources + ' overloaded member' + (plan.sources > 1 ? 's' : '') +
        ' · generated ' + (plan.generated_at || '');

    // ── Impact metrics ──
    document.getElementById('rbOverdueReduced').textContent = plan.overdue_reduced;
    document.getElementById('rbTotalMoving').textContent    = plan.total_moving;
    var rr = plan.risk_reduction || {};
    document.getElementById('rbBizRisk').textContent =
        (typeof rr.business_risk_reduction === 'number')
            ? Math.round(rr.business_risk_reduction) + '%' : '—';

    // ── Plan Intelligence box (collapsed) ──
    var breakdown  = plan.confidence_breakdown || [];
    var signalCount = breakdown.length;
    document.getElementById('rbIntelSignalCount').textContent = 'based on ' + signalCount + ' signal' + (signalCount !== 1 ? 's' : '');

    var intelItems = document.getElementById('rbIntelItems');
    intelItems.innerHTML = '';

    // Build confidence signal rows
    breakdown.forEach(function(sig) {
        var pct   = Math.round((sig.score || 0) * 100);
        var color = pct >= 70 ? '#22C55E' : pct >= 45 ? '#F59E0B' : '#EF4444';
        var el    = document.createElement('div');
        el.style.cssText = 'display:flex;gap:10px;align-items:flex-start;padding:4px 0;border-bottom:1px solid rgba(124,58,237,.08)';
        el.innerHTML =
            '<div style="flex:0 0 140px;font-size:11px;font-weight:700;color:#C4B5FD;padding-top:1px">' + escHtml(sig.signal) + '</div>' +
            '<div style="flex:1;min-width:0">' +
                '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">' +
                    '<div style="flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,.06);overflow:hidden">' +
                        '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:2px;transition:width .4s"></div>' +
                    '</div>' +
                    '<span style="font-size:11px;font-weight:700;color:' + color + ';min-width:30px">' + pct + '%</span>' +
                '</div>' +
                '<div style="font-size:11px;color:#6B7280;line-height:1.4">' + escHtml(sig.note) + '</div>' +
            '</div>';
        intelItems.appendChild(el);
    });

    // ── Predicted outcome bullets ──
    var riskAfterSafe = rr.destinations_safe !== false;
    var outcomeEl = document.createElement('div');
    outcomeEl.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid rgba(124,58,237,.1)';
    outcomeEl.innerHTML = '<div style="font-size:10px;color:#7C3AED;font-weight:700;letter-spacing:.06em;margin-bottom:6px">PREDICTED OUTCOME</div>' +
        (plan.overdue_reduced > 0
            ? '<div style="font-size:11px;color:#86EFAC;margin-bottom:3px">✓ ' + plan.overdue_reduced + ' overdue task' + (plan.overdue_reduced !== 1 ? 's' : '') + ' redistributed — source risk drops</div>'
            : '') +
        '<div style="font-size:11px;color:' + (riskAfterSafe ? '#86EFAC' : '#FCD34D') + ';margin-bottom:3px">' +
            (riskAfterSafe ? '✓ All destination members remain in safe load bands' : '⚠ One or more destinations near capacity — monitor after applying') +
        '</div>' +
        (typeof rr.business_risk_reduction === 'number' && rr.business_risk_reduction > 0
            ? '<div style="font-size:11px;color:#6EE7B7">✓ ~' + Math.round(rr.business_risk_reduction) + '% business risk reduction projected</div>'
            : '');
    intelItems.appendChild(outcomeEl);

    // ── Action groups ──
    var container = document.getElementById('rbActions');
    container.innerHTML = '';
    (plan.actions || []).forEach(function(action, ai) {
        container.appendChild(buildActionGroup(action, ai));
    });

    // ── Footer ──
    document.getElementById('rbFooterNote').textContent =
        'SmartEngine V2 · ' + (plan.plan_id || '') + ' · Review before applying.';
    document.getElementById('rbApplyBtn').disabled = false;

    document.getElementById('rbPlanBody').style.display = 'block';
    document.getElementById('rbFooter').style.display   = 'flex';
}

var TODAY_ISO    = '<?= date('Y-m-d') ?>';
var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function buildActionGroup(action, actionIdx) {
    var wrap = document.createElement('div');
    wrap.className = 'rb-action-group';
    wrap.id = 'rbGroup_' + actionIdx;

    // Head
    var head = document.createElement('div');
    head.className = 'rb-action-head';

    var fromLoad  = action.from_load_before || {};
    var toLoad    = action.to_load_before   || {};
    var fromScore = fromLoad.load_score !== undefined ? Math.round(fromLoad.load_score) : '?';
    var toScore   = toLoad.load_score   !== undefined ? Math.round(toLoad.load_score)   : '?';
    var fromBand  = fromLoad.band || 'critical';
    var toBand    = toLoad.band   || 'stable';

    // Overload band colors
    var bandColor = { stable:'#22C55E', watch:'#F59E0B', behind:'#F97316', critical:'#EF4444' };
    var fromCol = bandColor[fromBand] || '#EF4444';
    var toCol   = bandColor[toBand]   || '#22C55E';

    // Reason: why source is overloaded
    var overduePhrase = action.overdue_count > 0
        ? action.overdue_count + ' overdue task' + (action.overdue_count !== 1 ? 's' : '') + ' · '
        : '';
    var fromReason = overduePhrase + 'load score ' + fromScore + ' · classified ' + fromBand;

    // Reason: why this destination was chosen
    var toReason = action.reason || ('load score ' + toScore + ' · has capacity');

    head.innerHTML =
        '<div style="flex:1;min-width:0">' +
            // Route line: FROM → TO
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">' +
                '<span class="rb-action-from">' + escHtml(action.from_user_name) + '</span>' +
                '<span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(239,68,68,.1);color:' + fromCol + ';border:1px solid ' + fromCol + '33">' + fromBand.toUpperCase() + '</span>' +
                '<span class="rb-action-arrow">→</span>' +
                '<span class="rb-action-to">' + escHtml(action.to_user_name) + '</span>' +
                '<span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(34,197,94,.08);color:' + toCol + ';border:1px solid ' + toCol + '33">' + toBand.toUpperCase() + '</span>' +
            '</div>' +
            // Rationale line
            '<div style="display:flex;gap:12px;flex-wrap:wrap">' +
                '<span style="font-size:11px;color:#6B7280">🔴 Overloaded: <span style="color:#FCA5A5">' + escHtml(fromReason) + '</span></span>' +
                '<span style="font-size:11px;color:#6B7280">✅ Destination: <span style="color:#86EFAC">' + escHtml(toReason) + '</span></span>' +
            '</div>' +
        '</div>' +
        '<div style="font-size:12px;color:#6B7280;white-space:nowrap;padding-left:12px">' +
            action.task_count + ' task' + (action.task_count !== 1 ? 's' : '') +
        '</div>';
    wrap.appendChild(head);

    // Task list
    var taskList = document.createElement('div');
    taskList.className = 'rb-task-list';
    taskList.id = 'rbTaskList_' + actionIdx;
    (action.tasks || []).forEach(function(task) {
        taskList.appendChild(buildTaskRow(task, actionIdx));
    });
    wrap.appendChild(taskList);

    // Member after-stats row — show before→after open counts
    var fromLoadBefore = action.from_load_before || {};
    var toLoadBefore   = action.to_load_before   || {};
    var fromOpenBefore = fromLoadBefore.open !== undefined ? fromLoadBefore.open : '?';
    var toOpenBefore   = toLoadBefore.open   !== undefined ? toLoadBefore.open   : '?';
    var fromOpenAfter  = fromOpenBefore !== '?' ? Math.max(0, fromOpenBefore - action.task_count) : '?';
    var toOpenAfter    = toOpenBefore   !== '?' ? (toOpenBefore + action.task_count)               : '?';

    var statRow = document.createElement('div');
    statRow.className = 'rb-member-stat';
    statRow.id = 'rbStatRow_' + actionIdx;
    statRow.innerHTML =
        '<span style="font-size:11px;color:#4B5563;text-transform:uppercase;letter-spacing:.06em;margin-right:8px">After apply</span>' +
        '<span style="color:#FCA5A5;font-weight:700">' + escHtml(action.from_user_name) + '</span>' +
        '<span> ' + fromOpenBefore + ' → </span>' +
        '<span style="font-weight:700;color:#22C55E">' + fromOpenAfter + ' open</span>' +
        '<span style="margin:0 10px;color:#374151">·</span>' +
        '<span style="color:#86EFAC;font-weight:700">' + escHtml(action.to_user_name) + '</span>' +
        '<span> ' + toOpenBefore + ' → </span>' +
        '<span style="font-weight:700;color:#F59E0B">' + toOpenAfter + ' open</span>';
    wrap.appendChild(statRow);

    return wrap;
}

function buildTaskRow(task, actionIdx) {
    var row = document.createElement('div');
    row.className = 'rb-task-row' + (task.due_date && task.due_date < TODAY_ISO ? ' rb-overdue' : '');
    row.id = 'rbTask_' + task.id;

    var dueTxt = '';
    if (task.due_date) {
        var d = new Date(task.due_date + 'T00:00:00');
        dueTxt = MONTHS_SHORT[d.getUTCMonth()] + ' ' + d.getUTCDate();
        if (task.due_date < TODAY_ISO) dueTxt = '⚠ ' + dueTxt;
    }

    var priClass = 'rb-pri-' + (task.priority || 'medium');
    var projTxt  = (task.store_name ? task.store_name + ' › ' : '') + (task.project_name || '');

    row.innerHTML =
        '<span class="rb-task-name" title="' + escHtml(task.title) + '">' + escHtml(task.title) + '</span>' +
        (projTxt ? '<span class="rb-task-due" style="max-width:140px;overflow:hidden;text-overflow:ellipsis" title="' + escHtml(projTxt) + '">' + escHtml(projTxt) + '</span>' : '') +
        '<span class="rb-task-pri ' + priClass + '">' + (task.priority || 'medium') + '</span>' +
        (dueTxt ? '<span class="rb-task-due">' + dueTxt + '</span>' : '') +
        '<button class="rb-remove-btn" onclick="removeTaskFromPlan(' + task.id + ',' + actionIdx + ')" title="Remove from plan">✕</button>';

    return row;
}

function removeTaskFromPlan(taskId, actionIdx) {
    // Mark as removed
    _rbRemovedTaskIds[taskId] = true;

    // Hide the row
    var row = document.getElementById('rbTask_' + taskId);
    if (row) row.style.display = 'none';

    // Update the action group count
    if (_rbPlan && _rbPlan.actions && _rbPlan.actions[actionIdx]) {
        var action = _rbPlan.actions[actionIdx];
        // Remove from task_ids
        action.task_ids = (action.task_ids || []).filter(function(id) { return id != taskId; });
        var removedTask = (action.tasks || []).find(function(t) { return t.id == taskId; });
        if (removedTask) {
            if (removedTask.due_date && removedTask.due_date < TODAY_ISO) action.overdue_count = Math.max(0, (action.overdue_count||0) - 1);
            action.tasks = action.tasks.filter(function(t) { return t.id != taskId; });
        }
        action.task_count = action.task_ids.length;

        // Update group header count
        var head = document.querySelector('#rbGroup_' + actionIdx + ' .rb-action-head > div:last-child');
        if (head) head.textContent = action.task_count + ' task' + (action.task_count!==1?'s':'') + ' · ' + action.overdue_count + ' overdue';

        // If no tasks remain, dim the group
        if (action.task_count === 0) {
            var group = document.getElementById('rbGroup_' + actionIdx);
            if (group) group.style.opacity = '0.4';
        }
    }

    // Recount totals
    var stillMoving = 0, stillOverdue = 0;
    (_rbPlan.actions || []).forEach(function(a) {
        stillMoving  += a.task_count  || 0;
        stillOverdue += a.overdue_count || 0;
    });
    document.getElementById('rbTotalMoving').textContent    = stillMoving;
    document.getElementById('rbOverdueReduced').textContent = stillOverdue;

    // Disable Apply if nothing left
    var totalLeft = Object.values(_rbPlan.actions||[]).reduce(function(s,a){ return s + (a.task_count||0); }, 0);
    document.getElementById('rbApplyBtn').disabled = totalLeft === 0;
}

async function applyRebalancePlan() {
    if (!_rbPlan || !_rbPlan.actions) return;

    // Build payload: only actions with remaining tasks, only non-removed task_ids
    var payload = (_rbPlan.actions || []).filter(function(a) {
        return a.task_ids && a.task_ids.length > 0;
    }).map(function(a) {
        return {
            to_user_id: a.to_user_id,
            task_ids:   a.task_ids.filter(function(id) { return !_rbRemovedTaskIds[id]; })
        };
    }).filter(function(a) { return a.task_ids.length > 0; });

    if (payload.length === 0) {
        showTeamToast('Nothing to apply.', '#F59E0B');
        return;
    }

    var btn = document.getElementById('rbApplyBtn');
    btn.textContent = '⏳ Applying…';
    btn.disabled = true;

    try {
        var res = await fetch(APP_URL + '/api/team/rebalance-apply', {
            method: 'POST',
            headers: {
                'Content-Type':       'application/json',
                'X-CSRF-Token':       CSRF,
                'X-Requested-With':   'XMLHttpRequest'
            },
            body: JSON.stringify({ actions: payload })
        });

        var data = await res.json();

        if (!data.success) {
            showTeamToast('⚠ ' + (data.error || 'Apply failed'), '#EF4444');
            btn.textContent = '⚡ Apply Plan';
            btn.disabled = false;
            return;
        }

        showTeamToast('✅ ' + data.moved + ' tasks rebalanced across the team', '#22C55E');

        // ── Show next-action panel inside modal before closing ──
        if (data.next_actions && data.next_actions.length) {
            var naItems = document.getElementById('rbNextActionItems');
            if (naItems) {
                naItems.innerHTML = data.next_actions.map(function(na) {
                    var link = na.url
                        ? '<a href="' + escHtml(na.url) + '" style="font-size:11px;color:#93C5FD;text-decoration:none;white-space:nowrap">Go →</a>'
                        : '';
                    return '<div style="display:flex;align-items:flex-start;gap:8px">' +
                        '<span style="font-size:13px;flex-shrink:0">' + escHtml(na.icon || '→') + '</span>' +
                        '<div style="flex:1;min-width:0">' +
                            '<div style="font-size:12px;color:#D1D5DB;font-weight:600">' + escHtml(na.title) + '</div>' +
                            (na.reason ? '<div style="font-size:11px;color:#6B7280;margin-top:1px">' + escHtml(na.reason) + '</div>' : '') +
                        '</div>' + link +
                    '</div>';
                }).join('');
                document.getElementById('rbNextActions').style.display = '';
            }
            // Delay modal close so manager sees the next actions
            setTimeout(function() { closeRebalanceModal(); }, 4500);
        } else {
            closeRebalanceModal();
        }

        // ── Chain 1: patch KPI strip immediately from response
        if (data.kpi) {
            var kpiEl;
            if ((kpiEl = document.getElementById('kpiOverloaded'))) { kpiEl.textContent = data.kpi.overloaded;    kpiEl.classList.remove('kpi-updated'); void kpiEl.offsetWidth; kpiEl.classList.add('kpi-updated'); }
            if ((kpiEl = document.getElementById('kpiOverdue')))    { kpiEl.textContent = data.kpi.total_overdue; kpiEl.classList.remove('kpi-updated'); void kpiEl.offsetWidth; kpiEl.classList.add('kpi-updated'); }
            if ((kpiEl = document.getElementById('kpiRebalance')))  { kpiEl.textContent = data.kpi.rebalance;     kpiEl.classList.remove('kpi-updated'); void kpiEl.offsetWidth; kpiEl.classList.add('kpi-updated'); }
        }

        // ── Chain 2: update member cards for affected users
        if (data.member_updates && Array.isArray(data.member_updates)) {
            data.member_updates.forEach(function(mu) { updateMemberCard(mu.user_id, mu.open_tasks); });
        }

        // ── Chain 3: refresh smart recommendations strip
        refreshSmartRecs();

        // ── Chain 4: full KPI re-sync from server (catches anything the response missed)
        refreshTeamKpis();

        // ── Chain 5: rebalance result is persisted server-side in session by apiRebalanceApply();
        //    overview.php reads it via GET /api/team/rebalance-status on next page load.

    } catch(e) {
        showTeamToast('Network error', '#EF4444');
        btn.textContent = '⚡ Apply Plan';
        btn.disabled = false;
    }
}

// Keyboard
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { closeReassignModal(); closeDrawer(); closeRebalanceModal(); }
});

// ────────────────────────────────────────────────────────────
// V5 AUTONOMY PANEL
// ────────────────────────────────────────────────────────────
var autonomyPanelOpen = true;

function toggleAutonomyPanel() {
    autonomyPanelOpen = !autonomyPanelOpen;
    document.getElementById('autonomyBody').style.display = autonomyPanelOpen ? '' : 'none';
    document.getElementById('autonomyToggleIcon').textContent = autonomyPanelOpen ? '\u25b2' : '\u25bc';
}

function escAuto(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function impactLabel(score) {
    if (score === undefined || score === null) return '';
    var n = parseFloat(score);
    // Normalise: scores > 1 are on 0-100 scale, scores <= 1 are already 0-1
    if (n > 1) n = n / 100;
    if (n >= 0.8) return '<span style="color:#EF4444;font-weight:700">High</span>';
    if (n >= 0.5) return '<span style="color:#F59E0B;font-weight:700">Med</span>';
    return '<span style="color:#6B7280">Low</span>';
}

function loadAutonomyQueue() {
    fetch(APP_URL + '/api/autonomy/decisions', {
        headers: { 'X-CSRF-Token': CSRF }
    })
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(data) {
        document.getElementById('autonomyLoading').style.display = 'none';

        var autoQ     = data.auto_queue     || [];
        var approvalQ = data.approval_queue || [];
        var blockedQ  = data.blocked        || [];
        var total     = autoQ.length + approvalQ.length + blockedQ.length;

        if (total === 0) {
            document.getElementById('autonomyEmpty').style.display = '';
            document.getElementById('autonomyCount').textContent = '0 items';
            return;
        }

        document.getElementById('autonomyCount').textContent = total + (total === 1 ? ' item' : ' items');

        if (autoQ.length > 0) {
            document.getElementById('autonomyAutoSection').style.display = '';
            document.getElementById('autonomyAutoCount').textContent = autoQ.length;
            var autoHtml = autoQ.map(function(d) {
                var decisionId = (d.approval_payload && d.approval_payload.decision_id) ? d.approval_payload.decision_id : '';
                var confidence = (d.approval_payload && d.approval_payload.confidence !== undefined)
                    ? d.approval_payload.confidence : null;
                var safeDecId = JSON.stringify(decisionId).replace(/'/g, "&#39;");
                var confText = confidence !== null
                    ? ' &middot; Confidence: ' + Math.round(parseFloat(confidence) * 100) + '%'
                    : '';
                return '<div class="team-smart-item" style="border-left:3px solid #3B82F6">' +
                    '<div style="flex:1">' +
                        '<div class="team-smart-text">' + escAuto(d.title) + '</div>' +
                        '<div style="font-size:11px;color:#94A3B8;margin-top:2px">' +
                            (d.autonomy_reason ? escAuto(d.autonomy_reason) : '') +
                            (d.impact_score !== undefined ? ' &middot; Impact: ' + impactLabel(d.impact_score) : '') +
                            confText +
                        '</div>' +
                    '</div>' +
                    '<button class="team-smart-btn" style="background:rgba(59,130,246,.2);color:#93C5FD" ' +
                        'onclick="executeAutoDecision(' + safeDecId + ')">&#9654; Execute Now</button>' +
                '</div>';
            }).join('');
            document.getElementById('autonomyAutoItems').innerHTML = autoHtml;
        }

        if (approvalQ.length > 0) {
            document.getElementById('autonomyApprovalSection').style.display = '';
            document.getElementById('autonomyApprovalCount').textContent = approvalQ.length;
            var approvalHtml = approvalQ.map(function(d) {
                var planId = (d.approval_payload && d.approval_payload.plan_id) ? d.approval_payload.plan_id : '';
                var safePlanId = JSON.stringify(planId).replace(/'/g, "&#39;");
                return '<div class="team-smart-item" style="border-left:3px solid #22C55E">' +
                    '<div style="flex:1">' +
                        '<div class="team-smart-text">' + escAuto(d.title) + '</div>' +
                        '<div style="font-size:11px;color:#94A3B8;margin-top:2px">' +
                            (d.autonomy_reason ? escAuto(d.autonomy_reason) : '') +
                            (d.impact_score !== undefined ? ' &middot; Impact: ' + impactLabel(d.impact_score) : '') +
                        '</div>' +
                    '</div>' +
                    '<div style="display:flex;gap:6px">' +
                        '<button class="team-smart-btn" style="background:rgba(34,197,94,.2);color:#86EFAC" onclick="approveDecision(' + safePlanId + ')">&#10003; Approve</button>' +
                        '<button class="team-smart-btn" style="background:rgba(239,68,68,.15);color:#FCA5A5" onclick="rejectDecision(' + safePlanId + ')">&#10007; Reject</button>' +
                    '</div>' +
                '</div>';
            }).join('');
            document.getElementById('autonomyApprovalItems').innerHTML = approvalHtml;
        }

        if (blockedQ.length > 0) {
            document.getElementById('autonomyBlockedSection').style.display = '';
            document.getElementById('autonomyBlockedCount').textContent = blockedQ.length;
            var blockedHtml = blockedQ.map(function(d) {
                // Prefer autonomy_reasons array; fall back to autonomy_reason string
                var reasons = '';
                if (Array.isArray(d.autonomy_reasons) && d.autonomy_reasons.length > 0) {
                    reasons = d.autonomy_reasons.map(function(r) { return escAuto(r); }).join('; ');
                } else if (d.autonomy_reason) {
                    reasons = escAuto(d.autonomy_reason);
                } else {
                    reasons = 'Blocked \u2014 reason unavailable';
                }
                return '<div class="team-smart-item" style="border-left:3px solid #EF4444;opacity:.8">' +
                    '<div style="flex:1">' +
                        '<div class="team-smart-text">' + escAuto(d.title) + '</div>' +
                        '<div style="font-size:11px;color:#FCA5A5;margin-top:2px">' + reasons + '</div>' +
                    '</div>' +
                '</div>';
            }).join('');
            document.getElementById('autonomyBlockedItems').innerHTML = blockedHtml;
        }
    })
    .catch(function(err) {
        document.getElementById('autonomyLoading').style.display = 'none';
        document.getElementById('autonomyError').style.display = '';
        document.getElementById('autonomyCount').textContent = 'Error';
        console.error('Autonomy queue load error:', err);
    });
}

function executeAutoDecision(decisionId) {
    if (!decisionId) { showTeamToast('No decision ID \u2014 cannot execute', '#EF4444'); return; }
    if (!confirm('Execute this decision automatically?\n\nDecision ID: ' + decisionId + '\n\nThis action cannot be undone.')) return;
    fetch(APP_URL + '/api/autonomy/execute-safe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
        body: JSON.stringify({ decision_id: decisionId })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success || data.ok) {
            showTeamToast('Decision executed successfully', '#22C55E');
            loadAutonomyQueue();
        } else {
            showTeamToast(data.message || 'Execution failed', '#EF4444');
        }
    })
    .catch(function() { showTeamToast('Network error \u2014 execution failed', '#EF4444'); });
}

function approveDecision(planId) {
    if (!planId) { showTeamToast('No plan ID \u2014 cannot approve', '#EF4444'); return; }
    if (!confirm('Approve this decision?\n\nPlan ID: ' + planId)) return;
    fetch(APP_URL + '/api/autonomy/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
        body: JSON.stringify({ plan_id: planId })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success || data.ok) {
            showTeamToast('Decision approved', '#22C55E');
            loadAutonomyQueue();
        } else {
            showTeamToast(data.message || 'Approval failed', '#EF4444');
        }
    })
    .catch(function() { showTeamToast('Network error \u2014 approval failed', '#EF4444'); });
}

function rejectDecision(planId) {
    if (!planId) { showTeamToast('No plan ID \u2014 cannot reject', '#EF4444'); return; }
    if (!confirm('Reject this decision?\n\nPlan ID: ' + planId)) return;
    fetch(APP_URL + '/api/autonomy/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
        body: JSON.stringify({ plan_id: planId })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.success || data.ok) {
            showTeamToast('Decision rejected', '#F59E0B');
            loadAutonomyQueue();
        } else {
            showTeamToast(data.message || 'Rejection failed', '#EF4444');
        }
    })
    .catch(function() { showTeamToast('Network error \u2014 rejection failed', '#EF4444'); });
}

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('autonomyPanel')) {
        loadAutonomyQueue();
    }
});
</script>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
