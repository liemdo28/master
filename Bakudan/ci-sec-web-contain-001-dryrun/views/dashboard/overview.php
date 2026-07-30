<?php
$pageTitle   = t('page.overview'); // Overview = Home for CEO/Manager
$currentPage = 'overview';

ob_start();

// ── Pre-compute helpers (preserved from original) ──────────────────────────────

$bizByStore = [];
foreach (($businessHealth ?? []) as $biz) {
    $bizByStore[$biz['id']] = $biz;
}

$tasksByProject = [];
foreach (($outstandingWork ?? []) as $ow) {
    $tasksByProject[$ow['project_id']][] = $ow;
}

// ── $commandCenter shortcuts ──────────────────────────────────────────────────
$cc          = $commandCenter ?? [];
$execSum     = $cc['exec_summary']  ?? [];
$topDecs     = $cc['top_decisions'] ?? [];
$ccFinance   = $cc['finance']       ?? [];
$ccOps       = $cc['operations']    ?? [];
$ccCompliance= $cc['compliance']    ?? [];

// Risk level → color
if (!function_exists('riskColor')) {
function riskColor(string $level): string {
    return match (strtolower($level)) {
        'critical' => '#dc2626',
        'high'     => '#f59e0b',
        'medium'   => '#3b82f6',
        'low'      => '#22c55e',
        default    => '#94a3b8',
    };
}
}

// Unified risk score display
$uRisk      = $execSum['unified_risk'] ?? ['score' => 0, 'level' => 'low', 'breakdown' => []];
$uRiskScore = (int)($uRisk['score'] ?? 0);
$uRiskLevel = strtoupper($uRisk['level'] ?? 'LOW');
$uRiskColor = riskColor($uRisk['level'] ?? 'low');
$uBreakdown = $uRisk['breakdown'] ?? ['finance' => 0, 'operations' => 0, 'compliance' => 0];

// Impact level → color
if (!function_exists('impactColor')) {
function impactColor(string $level): string {
    return match (strtoupper($level)) {
        'CRITICAL' => '#dc2626',
        'HIGH'     => '#f59e0b',
        'MEDIUM'   => '#3b82f6',
        default    => '#22c55e',
    };
}
}

// Action type → button color
if (!function_exists('actionBtnStyle')) {
function actionBtnStyle(string $type): string {
    return match ($type) {
        'pay_bill'   => 'background:#dc2626;color:#fff;border-color:#dc2626',
        'file_now'   => 'background:#f59e0b;color:#0f172a;border-color:#f59e0b',
        'rebalance'  => 'background:#3b82f6;color:#fff;border-color:#3b82f6',
        'assign_task'=> 'background:#6366f1;color:#fff;border-color:#6366f1',
        default      => 'background:rgba(255,255,255,.08);color:#f8fafc;border-color:rgba(255,255,255,.15)',
    };
}
}

$isManagerOrAdmin = canAdmin() || canManage();

// Category matrix for drill-down (preserved)
$categoryMatrix = $categoryMatrix ?? [];

// V4 decisions / focus items (preserved legacy path)
$impactLevelLabel = [
    'critical' => 'CRITICAL',
    'high'     => 'HIGH IMPACT',
    'medium'   => 'MEDIUM',
    'low'      => 'LOW',
];

$focusItems = array_map(function($d) use ($impactLevelLabel) {
    $confPct   = isset($d['confidence']) ? round($d['confidence'] * 100) : null;
    $impactLvl = $d['impact_level'] ?? $d['risk_level'] ?? 'high';
    return [
        'icon'          => $d['icon']            ?? 'alert-triangle',
        'type'          => $d['problem_type']    ?? 'task',
        'color'         => $d['color']           ?? '#f59e0b',
        'title'         => $d['title']           ?? '',
        'sub'           => $d['description']     ?? '',
        'impact'        => $impactLevelLabel[$impactLvl] ?? 'HIGH IMPACT',
        'ic'            => $d['color']           ?? '#f59e0b',
        'btn'           => $d['action_label']    ?? 'View',
        'url'           => $d['action_url']      ?? '#',
        'confidence'    => $d['confidence']      ?? null,
        'conf_pct'      => $confPct,
        'impact_score'  => $d['impact_score']    ?? 0,
        'impact_level'  => $impactLvl,
        'problem_type'  => $d['problem_type']    ?? '',
        'risk_level'    => $d['risk_level']      ?? $impactLvl,
        'plan_hint'     => $d['plan_hint']       ?? null,
        'if_ignored'    => $d['if_ignored']      ?? [],
        'urgency_label' => $d['urgency_label']   ?? null,
        'action_desc'   => $d['action_desc']     ?? null,
        'recommendation'=> $d['recommendation']  ?? null,
        'rec_color'     => $d['recommendation_color'] ?? $d['color'] ?? '#f59e0b',
        'autonomy_mode' => $d['autonomy_mode']   ?? null,
        'autonomy_reason'=> $d['autonomy_reason']?? null,
    ];
}, array_slice($rankedDecisions ?? [], 0, 3));

if (empty($focusItems) && !empty($rankedProblems)) {
    $focusItems = array_map(function($p) use ($impactLevelLabel) {
        $confPct = isset($p['confidence']) ? round($p['confidence'] * 100) : null;
        $lvl     = $p['risk_level'] ?? 'high';
        return [
            'icon'          => $p['icon']         ?? 'alert-triangle',
            'type'          => $p['problem_type'] ?? 'task',
            'color'         => $p['color']        ?? '#f59e0b',
            'title'         => $p['title']        ?? '',
            'sub'           => $p['description']  ?? '',
            'impact'        => $impactLevelLabel[$lvl] ?? 'HIGH IMPACT',
            'ic'            => $p['color']        ?? '#f59e0b',
            'btn'           => $p['action_label'] ?? 'View',
            'url'           => $p['action_url']   ?? '#',
            'confidence'    => $p['confidence']   ?? null,
            'conf_pct'      => $confPct,
            'impact_score'  => $p['impact_score'] ?? 0,
            'impact_level'  => $lvl,
            'problem_type'  => $p['problem_type'] ?? '',
            'risk_level'    => $lvl,
            'plan_hint'     => $p['plan_hint']    ?? null,
            'if_ignored'    => [],
            'urgency_label' => null,
            'action_desc'   => null,
            'recommendation'=> null,
            'rec_color'     => $p['color']        ?? '#f59e0b',
            'autonomy_mode' => null,
            'autonomy_reason'=> null,
        ];
    }, array_slice($rankedProblems ?? [], 0, 3));
}

$allClear = ($v4AllClear ?? true) && empty($focusItems) && empty($topDecs);

$ceoFocusDecisions = !empty($topDecs) ? $topDecs : $focusItems;
$ceoTopAction = $ceoFocusDecisions[0] ?? null;
$ceoTopActionTitle = $ceoTopAction['title'] ?? 'No urgent decision queued';
$ceoTopActionUrl = $ceoTopAction['action']['url'] ?? $ceoTopAction['url'] ?? '#cc-sec-decisions';
$ceoTopActionLabel = !empty($ceoTopAction) ? 'Review top decision' : 'Review dashboard';
$ceoCashRisk = (float)($execSum['total_cash_risk'] ?? 0);
$ceoOverdueBills = (int)($execSum['overdue_bills']['count'] ?? 0);
$ceoCriticalTasks = (int)($execSum['critical_tasks'] ?? 0);
$ceoComplianceCount = (int)($execSum['compliance_risk']['count'] ?? 0);
$ceoOverloaded = (int)($execSum['execution_risk']['overloaded_count'] ?? 0);
$ceoWatchCount = $ceoOverdueBills + $ceoCriticalTasks + $ceoComplianceCount + $ceoOverloaded;
$ceoFocusCards = [
    [
        'kicker' => '1. Decide',
        'title' => $ceoTopActionTitle,
        'meta' => !empty($ceoTopAction) ? 'Highest ranked action by risk and urgency' : 'Nothing urgent is ranked right now',
        'url' => $ceoTopActionUrl,
        'label' => $ceoTopActionLabel,
        'icon' => 'zap',
        'tone' => !empty($ceoTopAction) ? 'hot' : 'clear',
    ],
    [
        'kicker' => '2. Pay / File',
        'title' => $ceoOverdueBills . ' overdue bills, $' . number_format($ceoCashRisk, 0) . ' exposure',
        'meta' => 'Cash risk and compliance items that need action',
        'url' => APP_URL . '/overview/drilldown/overdue-bills',
        'label' => 'Open payment queue',
        'icon' => 'wallet',
        'tone' => $ceoOverdueBills > 0 || $ceoCashRisk > 0 ? 'warn' : 'clear',
    ],
    [
        'kicker' => '3. Follow Up',
        'title' => $ceoWatchCount . ' items need attention',
        'meta' => $ceoCriticalTasks . ' critical tasks, ' . $ceoComplianceCount . ' compliance, ' . $ceoOverloaded . ' overloaded',
        'url' => APP_URL . '/overview/drilldown/critical-tasks',
        'label' => 'Open work queue',
        'icon' => 'check-square',
        'tone' => $ceoWatchCount > 0 ? 'watch' : 'clear',
    ],
];

?>

<!-- ══════════════════════════════════════════════════════════════════════════════
     CEO + CFO EXECUTIVE COMMAND CENTER — V5
     ══════════════════════════════════════════════════════════════════════════════ -->

<style>
/* ── Drill-Down Clickability ─────────────────────────────────────────────── */
.dd-card-link { text-decoration: none; color: inherit; display: block; flex: 1; min-width: 160px; }
.dd-card-link:hover .cc-kpi-tile,
.dd-card-link:hover .cc-risk-panel {
  border-color: #3b82f6;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59,130,246,0.2);
  cursor: pointer;
}
.dd-hint { font-size: 11px; color: #3b82f6; margin-top: 4px; opacity: 0.8; }
.dd-card-link:hover .dd-hint { opacity: 1; }
.dd-risk-badge-link { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 6px; text-decoration: none; color: inherit; transition: all 0.2s; cursor: pointer; }
.dd-risk-badge-link:hover { background: rgba(255,255,255,0.05); transform: translateX(2px); }
.dd-arrow { color: #3b82f6; font-size: 12px; }
.dd-store-row-link { display: block; text-decoration: none; color: inherit; }
.dd-store-row-link:hover .cc-store-row { background: rgba(255,255,255,0.04); border-radius: 6px; }
.dd-member-row { display: block; text-decoration: none; color: inherit; }
.dd-member-row:hover { background: rgba(255,255,255,0.04); border-radius: 6px; }

/* ── Reset / base ──────────────────────────────────────────────────────────── */
.cc-root { display:flex; flex-direction:column; gap:20px; padding-bottom:48px; overflow-x:hidden; max-width:100%; }

/* CEO first screen */
.ceo-today-panel {
    background:linear-gradient(180deg, rgba(15,23,42,.98), rgba(15,23,42,.92));
    border:1px solid rgba(148,163,184,.16);
    border-radius:12px;
    padding:18px;
    display:grid;
    grid-template-columns:minmax(220px,.9fr) minmax(0,2fr);
    gap:16px;
}
.ceo-today-intro {
    display:flex;
    flex-direction:column;
    gap:8px;
    justify-content:center;
    min-width:0;
}
.ceo-today-eyebrow {
    display:inline-flex;
    align-items:center;
    gap:7px;
    width:fit-content;
    padding:4px 9px;
    border:1px solid rgba(96,165,250,.22);
    border-radius:999px;
    background:rgba(96,165,250,.08);
    color:#93c5fd;
    font-size:10px;
    font-weight:800;
    text-transform:uppercase;
    letter-spacing:.08em;
}
.ceo-today-title {
    color:#f8fafc;
    font-size:23px;
    line-height:1.15;
    font-weight:850;
}
.ceo-today-sub {
    color:#94a3b8;
    font-size:13px;
    line-height:1.45;
    max-width:440px;
}
.ceo-focus-grid {
    display:grid;
    grid-template-columns:repeat(3, minmax(0,1fr));
    gap:10px;
}
.ceo-focus-card {
    min-width:0;
    text-decoration:none;
    color:inherit;
    border:1px solid rgba(148,163,184,.14);
    border-radius:10px;
    background:rgba(2,6,23,.42);
    padding:13px;
    display:flex;
    flex-direction:column;
    gap:9px;
    min-height:154px;
    transition:border-color .15s, transform .15s, background .15s;
}
.ceo-focus-card:hover {
    border-color:rgba(96,165,250,.42);
    background:rgba(15,23,42,.78);
    transform:translateY(-1px);
}
.ceo-focus-top {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
}
.ceo-focus-kicker {
    color:#94a3b8;
    font-size:10px;
    font-weight:800;
    text-transform:uppercase;
    letter-spacing:.07em;
}
.ceo-focus-icon {
    display:flex;
    color:#94a3b8;
}
.ceo-focus-card[data-tone="hot"] .ceo-focus-icon,
.ceo-focus-card[data-tone="warn"] .ceo-focus-icon { color:#f59e0b; }
.ceo-focus-card[data-tone="watch"] .ceo-focus-icon { color:#60a5fa; }
.ceo-focus-card[data-tone="clear"] .ceo-focus-icon { color:#22c55e; }
.ceo-focus-title {
    color:#f8fafc;
    font-size:14px;
    font-weight:780;
    line-height:1.3;
    overflow-wrap:anywhere;
}
.ceo-focus-meta {
    color:#64748b;
    font-size:11px;
    line-height:1.45;
    flex:1;
}
.ceo-focus-action {
    display:flex;
    align-items:center;
    gap:5px;
    color:#93c5fd;
    font-size:11px;
    font-weight:750;
}

/* ══ SECTION 1: Executive Summary Strip ══════════════════════════════════════ */
.cc-exec-strip {
    display:flex; align-items:stretch; gap:12px; flex-wrap:wrap;
}
.cc-kpi-tile {
    flex:1; min-width:160px;
    background:var(--surface,#1E293B);
    border:1px solid var(--border,rgba(255,255,255,.08));
    border-radius:12px;
    padding:16px 18px;
    display:flex; flex-direction:column; gap:6px;
    cursor:default;
    transition:border-color .15s;
}
.cc-kpi-tile:hover { border-color:rgba(255,255,255,.16); }
.cc-kpi-tile-head {
    display:flex; align-items:center; gap:6px;
    font-size:10px; font-weight:700; color:#64748b;
    text-transform:uppercase; letter-spacing:.07em;
}
.cc-kpi-tile-num {
    font-size:26px; font-weight:800; color:var(--text-primary,#F8FAFC); line-height:1;
}
.cc-kpi-tile-sub {
    font-size:11px; color:#64748b; line-height:1.4;
}
.cc-kpi-tile-link {
    margin-left:auto; display:flex; align-items:center;
    color:#475569; text-decoration:none; opacity:0; transition:opacity 0.15s;
}
.cc-kpi-tile:hover .cc-kpi-tile-link { opacity:1; }
.pen-period-tabs {
    display:flex; gap:4px; margin:6px 0; flex-wrap:wrap;
}
.pen-tab-btn {
    padding:3px 9px; border-radius:6px;
    border:1px solid rgba(255,255,255,0.1);
    background:rgba(255,255,255,0.04);
    color:#94a3b8; font-size:10px; font-weight:600;
    cursor:pointer; transition:all 0.15s; font-family:inherit;
}
.pen-tab-btn:hover { border-color:rgba(96,165,250,0.3); color:#93c5fd; }
.pen-tab-btn.active {
    background:rgba(96,165,250,0.12);
    border-color:rgba(96,165,250,0.3);
    color:#93c5fd;
}
.pen-amount-row { display:flex; align-items:baseline; gap:5px; flex-wrap:wrap; }
.pen-amount { font-size:20px; font-weight:800; line-height:1; }
.pen-currency { font-size:11px; color:#64748b; font-weight:600; }
.pen-trend { font-size:10px; font-weight:700; padding:1px 5px; border-radius:4px; }
.pen-trend.trend-up   { color:#dc2626; background:rgba(220,38,38,0.1); }
.pen-trend.trend-down { color:#22c55e; background:rgba(34,197,94,0.1); }
.pen-meta-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.pen-cnt { font-size:11px; color:#64748b; }
.pen-vs  { font-size:10px; color:#475569; }
.pen-top-user {
    display:flex; align-items:center; gap:5px; margin-top:4px;
    padding:4px 7px; background:rgba(255,255,255,0.04);
    border-radius:6px; flex-wrap:wrap;
}

.cc-kpi-tile-badge {
    display:inline-flex; align-items:center; gap:4px;
    font-size:10px; font-weight:700; letter-spacing:.05em;
    padding:2px 7px; border-radius:999px; margin-top:2px;
    width:fit-content;
}

/* Unified Risk Score panel */
.cc-risk-panel {
    min-width:220px; max-width:300px;
    background:var(--surface,#1E293B);
    border:1px solid var(--border,rgba(255,255,255,.08));
    border-radius:12px; padding:16px 18px;
    display:flex; flex-direction:column; gap:10px;
}
.cc-risk-score-row {
    display:flex; align-items:baseline; gap:8px;
}
.cc-risk-score-num {
    font-size:40px; font-weight:900; line-height:1;
}
.cc-risk-score-label {
    font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
}
.cc-risk-bar-wrap { display:flex; flex-direction:column; gap:5px; }
.cc-risk-bar-row  { display:flex; align-items:center; gap:7px; font-size:10px; color:#94a3b8; }
.cc-risk-bar-track {
    flex:1; height:5px; background:rgba(255,255,255,.06); border-radius:3px; overflow:hidden;
}
.cc-risk-bar-fill { height:100%; border-radius:3px; }

/* ══ SECTION WRAPPER / COLLAPSIBLE ══════════════════════════════════════════ */
.cc-section {
    background:var(--surface,#1E293B);
    border:1px solid var(--border,rgba(255,255,255,.08));
    border-radius:12px; overflow:hidden;
}
.cc-section-header {
    display:flex; align-items:center; justify-content:space-between;
    padding:14px 20px; cursor:pointer; user-select:none;
    border-bottom:1px solid var(--border,rgba(255,255,255,.08));
    transition:background .15s;
}
.cc-section-header:hover { background:rgba(255,255,255,.03); }
.cc-section-title-wrap { display:flex; align-items:center; gap:10px; }
.cc-section-icon { color:#64748b; display:flex; flex-shrink:0; }
.cc-section-title {
    font-size:11px; font-weight:700; color:#94a3b8;
    text-transform:uppercase; letter-spacing:.09em;
}
.cc-section-badge {
    font-size:10px; font-weight:700; padding:2px 8px;
    border-radius:999px; background:rgba(255,255,255,.06);
    color:#64748b; border:1px solid rgba(255,255,255,.08);
}
.cc-section-toggle { color:#475569; display:flex; transition:transform .2s; }
.cc-section.collapsed .cc-section-toggle { transform:rotate(-90deg); }
.cc-section-body { padding:20px; }
.cc-section.collapsed .cc-section-body { display:none; }

/* ══ SECTION 2: Priority Decisions ══════════════════════════════════════════ */
.cc-decisions-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }

.cc-decision-card {
    background:#0f172a;
    border:1px solid rgba(255,255,255,.07);
    border-radius:12px; padding:18px;
    display:flex; flex-direction:column; gap:12px;
    position:relative; overflow:hidden;
}
.cc-decision-card::before {
    content:''; position:absolute; top:0; left:0; right:0; height:3px;
}
.cc-dec-rank {
    width:28px; height:28px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:13px; font-weight:800; color:#0f172a;
    flex-shrink:0;
}
.cc-dec-header { display:flex; align-items:flex-start; gap:10px; }
.cc-dec-header-right { flex:1; min-width:0; }
.cc-dec-title {
    font-size:14px; font-weight:700; color:#f1f5f9; line-height:1.3; margin-bottom:4px;
}
.cc-dec-badges { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.cc-dec-deadline-badge {
    font-size:10px; font-weight:600; padding:2px 7px; border-radius:5px;
    background:rgba(255,255,255,.07); color:#94a3b8;
    display:flex; align-items:center; gap:3px;
}
.cc-dec-impact-badge {
    font-size:10px; font-weight:800; padding:2px 8px; border-radius:5px;
    letter-spacing:.05em;
}
.cc-dec-consequence {
    font-size:12px; color:#64748b; font-style:italic; line-height:1.4;
}
.cc-dec-prediction {
    padding:8px 10px;
    background:rgba(239,68,68,.05);
    border-left:2px solid rgba(239,68,68,.3);
    border-radius:0 6px 6px 0;
}
.cc-dec-prediction-label {
    font-size:9px; font-weight:700; color:#64748b;
    text-transform:uppercase; letter-spacing:.07em; margin-bottom:3px;
}
.cc-dec-prediction-text { font-size:11px; color:#cbd5e1; line-height:1.4; }
.cc-dec-amount {
    font-size:20px; font-weight:800; color:#f1f5f9;
}
.cc-dec-footer {
    display:flex; align-items:center; justify-content:space-between;
    padding-top:10px; border-top:1px solid rgba(255,255,255,.06); margin-top:auto;
}
.cc-dec-action-btn {
    height:36px; padding:0 16px; border-radius:8px;
    border:1px solid;
    font-size:12px; font-weight:700; cursor:pointer;
    display:inline-flex; align-items:center; gap:6px;
    text-decoration:none; transition:opacity .15s;
    white-space:nowrap;
}
.cc-dec-action-btn:hover { opacity:.85; text-decoration:none; }

/* ══ SECTION 3: Finance ══════════════════════════════════════════════════════ */
.cc-finance-grid { display:grid; grid-template-columns:220px 1fr 1fr; gap:16px; }

/* Cash timeline */
.cc-cash-timeline { display:flex; flex-direction:column; gap:3px; }
.cc-cash-row {
    display:flex; align-items:center; gap:10px;
    padding:10px 0; border-bottom:1px solid rgba(255,255,255,.05);
}
.cc-cash-row:last-child { border-bottom:none; }
.cc-cash-label { font-size:11px; color:#94a3b8; width:80px; flex-shrink:0; }
.cc-cash-amount { font-size:14px; font-weight:700; color:#f1f5f9; min-width:70px; }
.cc-cash-count  { font-size:10px; color:#64748b; }
.cc-cash-bar-wrap { flex:1; }
.cc-cash-bar-track { height:5px; background:rgba(255,255,255,.05); border-radius:3px; overflow:hidden; }
.cc-cash-bar-fill  { height:100%; border-radius:3px; }

/* Risk board */
.cc-risk-board { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
.cc-risk-col {
    border-radius:10px; padding:12px; text-align:center; cursor:pointer;
    border:1px solid rgba(255,255,255,.07);
    transition:border-color .15s, background .15s;
}
.cc-risk-col:hover { border-color:rgba(255,255,255,.18); background:rgba(255,255,255,.03); }
.cc-risk-col-label {
    font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.08em;
    margin-bottom:8px;
}
.cc-risk-col-count {
    font-size:28px; font-weight:900; line-height:1; margin-bottom:4px;
}
.cc-risk-col-sub { font-size:10px; color:#64748b; }

/* Vendor cards */
.cc-vendor-list { display:flex; flex-direction:column; gap:8px; max-height:360px; overflow-y:auto; }
.cc-vendor-card {
    padding:12px 14px;
    background:rgba(255,255,255,.03);
    border:1px solid rgba(255,255,255,.06);
    border-radius:10px;
    display:flex; align-items:center; gap:12px;
}
.cc-vendor-info { flex:1; min-width:0; }
.cc-vendor-name { font-size:13px; font-weight:600; color:#e2e8f0; }
.cc-vendor-meta { font-size:10px; color:#64748b; margin-top:2px; }
.cc-vendor-status {
    font-size:10px; font-weight:800; letter-spacing:.05em;
    padding:3px 8px; border-radius:5px; white-space:nowrap;
}
.cc-vendor-amount { font-size:13px; font-weight:700; color:#f1f5f9; white-space:nowrap; }
.cc-vendor-action {
    font-size:11px; font-weight:600; padding:4px 10px;
    border-radius:6px; border:1px solid rgba(255,255,255,.12);
    background:transparent; color:#94a3b8; cursor:pointer;
    text-decoration:none; white-space:nowrap;
    transition:background .15s, color .15s;
}
.cc-vendor-action:hover { background:rgba(255,255,255,.07); color:#f1f5f9; text-decoration:none; }

/* ══ SECTION 4: Operations ════════════════════════════════════════════════════ */
.cc-ops-grid { display:grid; grid-template-columns:180px 1fr 1fr; gap:16px; }

/* Donut ring */
.cc-donut-wrap { display:flex; flex-direction:column; align-items:center; gap:14px; }
.cc-donut-svg  { width:140px; height:140px; }
.cc-donut-legend { display:flex; flex-direction:column; gap:6px; width:100%; }
.cc-donut-legend-row {
    display:flex; align-items:center; gap:7px; font-size:11px; color:#94a3b8;
}
.cc-donut-legend-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.cc-donut-legend-val { margin-left:auto; font-weight:700; color:#f1f5f9; }

/* Store risk map */
.cc-store-list { display:flex; flex-direction:column; gap:6px; }
.cc-store-row {
    display:flex; align-items:center; gap:10px; padding:10px 12px;
    border-radius:8px; cursor:pointer;
    border:1px solid rgba(255,255,255,.05);
    transition:background .15s;
}
.cc-store-row:hover { background:rgba(255,255,255,.04); }
.cc-store-name { font-size:13px; font-weight:600; color:#e2e8f0; flex:1; min-width:0; }
.cc-store-flag { font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; white-space:nowrap; }
.cc-store-status-badge {
    font-size:10px; font-weight:700; padding:2px 8px; border-radius:5px;
    white-space:nowrap; letter-spacing:.04em;
}

/* Team load */
.cc-team-list { display:flex; flex-direction:column; gap:6px; }
.cc-team-row {
    display:flex; align-items:center; gap:10px; padding:10px 12px;
    border-radius:8px; cursor:pointer;
    border:1px solid rgba(255,255,255,.05);
    text-decoration:none;
    transition:background .15s;
}
.cc-team-row:hover { background:rgba(255,255,255,.04); text-decoration:none; }
.cc-team-avatar {
    width:32px; height:32px; border-radius:50%;
    background:rgba(96,165,250,.15); color:#60a5fa;
    display:flex; align-items:center; justify-content:center;
    font-size:13px; font-weight:700; flex-shrink:0;
}
.cc-team-name { font-size:13px; font-weight:600; color:#e2e8f0; flex:1; min-width:0; }
.cc-team-stats { font-size:10px; color:#64748b; }
.cc-team-load-badge {
    font-size:10px; font-weight:800; padding:2px 8px; border-radius:5px;
    white-space:nowrap; letter-spacing:.04em;
}

/* ══ SECTION 5: Compliance ════════════════════════════════════════════════════ */
.cc-compliance-list { display:flex; flex-direction:column; gap:6px; }
.cc-comp-row {
    display:flex; flex-direction:column; gap:6px; padding:10px 14px;
    border-radius:8px;
    border:1px solid rgba(255,255,255,.05);
}
.cc-comp-row-top { display:flex; align-items:center; gap:8px; min-width:0; }
.cc-comp-row-bottom { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.cc-comp-title { font-size:13px; font-weight:600; color:#e2e8f0; flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cc-comp-vendor { font-size:11px; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cc-comp-due { font-size:11px; color:#94a3b8; white-space:nowrap; }
.cc-comp-days {
    font-size:10px; font-weight:700; padding:2px 7px; border-radius:5px;
    white-space:nowrap;
}
.cc-comp-risk {
    font-size:10px; font-weight:700; padding:2px 7px; border-radius:5px;
    letter-spacing:.04em; white-space:nowrap;
}
.cc-comp-actions { display:flex; gap:5px; margin-left:auto; }
.cc-comp-btn {
    font-size:11px; font-weight:600; padding:4px 10px; border-radius:6px;
    border:1px solid rgba(255,255,255,.12); background:transparent; color:#94a3b8;
    cursor:pointer; white-space:nowrap; text-decoration:none;
    transition:background .15s, color .15s;
}
.cc-comp-btn:hover { background:rgba(255,255,255,.07); color:#f1f5f9; text-decoration:none; }
.cc-comp-btn-danger {
    border-color:rgba(220,38,38,.3); color:#dc2626;
    background:rgba(220,38,38,.06);
}
.cc-comp-btn-danger:hover { background:rgba(220,38,38,.12); color:#ef4444; }

/* ══ Quick-Pay Modal ════════════════════════════════════════════════════════ */
.cc-modal-overlay {
    display:none; position:fixed; inset:0; z-index:9000;
    background:rgba(0,0,0,.7); align-items:center; justify-content:center;
}
.cc-modal-overlay.active { display:flex; }
.cc-modal {
    background:#1e293b; border:1px solid rgba(255,255,255,.1);
    border-radius:16px; padding:28px; width:380px; max-width:90vw;
}
.cc-modal-title { font-size:16px; font-weight:700; color:#f1f5f9; margin-bottom:4px; }
.cc-modal-sub   { font-size:13px; color:#64748b; margin-bottom:20px; }
.cc-modal-detail-row {
    display:flex; justify-content:space-between; align-items:center;
    padding:10px 0; border-bottom:1px solid rgba(255,255,255,.06);
    font-size:13px; color:#94a3b8;
}
.cc-modal-detail-row:last-of-type { border-bottom:none; }
.cc-modal-detail-val { font-weight:700; color:#f1f5f9; }
.cc-modal-footer { display:flex; gap:10px; margin-top:20px; justify-content:flex-end; }
.cc-modal-btn-cancel {
    height:38px; padding:0 16px; border-radius:8px;
    border:1px solid rgba(255,255,255,.12); background:transparent; color:#94a3b8;
    font-size:13px; font-weight:600; cursor:pointer;
}
.cc-modal-btn-confirm {
    height:38px; padding:0 20px; border-radius:8px;
    border:none; background:#dc2626; color:#fff;
    font-size:13px; font-weight:700; cursor:pointer;
    transition:background .15s;
}
.cc-modal-btn-confirm:hover   { background:#b91c1c; }
.cc-modal-btn-confirm:disabled { opacity:.5; cursor:not-allowed; }

/* Bill drawer */
.cc-drawer-overlay {
    display:none; position:fixed; inset:0; z-index:8000;
    background:rgba(0,0,0,.6);
}
.cc-drawer-overlay.active { display:block; }
.cc-drawer {
    position:fixed; top:0; right:0; bottom:0; width:400px; max-width:95vw;
    background:#1e293b; border-left:1px solid rgba(255,255,255,.1);
    display:flex; flex-direction:column; z-index:8001;
    transform:translateX(100%); transition:transform .25s ease;
}
.cc-drawer-overlay.active .cc-drawer { transform:none; }
.cc-drawer-header {
    display:flex; align-items:center; justify-content:space-between;
    padding:18px 20px; border-bottom:1px solid rgba(255,255,255,.08);
}
.cc-drawer-title { font-size:15px; font-weight:700; color:#f1f5f9; }
.cc-drawer-close {
    width:32px; height:32px; border-radius:8px; border:none;
    background:rgba(255,255,255,.06); color:#94a3b8; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
}
.cc-drawer-body { flex:1; overflow-y:auto; padding:16px 20px; }
.cc-drawer-bill-row {
    padding:12px 0; border-bottom:1px solid rgba(255,255,255,.05);
    display:flex; flex-direction:column; gap:4px;
}
.cc-drawer-bill-row:last-child { border-bottom:none; }
.cc-drawer-bill-title { font-size:13px; font-weight:600; color:#e2e8f0; }
.cc-drawer-bill-meta  { font-size:11px; color:#64748b; }
.cc-drawer-bill-amount { font-size:14px; font-weight:700; color:#f1f5f9; }
.cc-drawer-bill-footer {
    display:flex; align-items:center; justify-content:space-between; margin-top:4px;
}

/* Responsive */
@media (max-width:1100px) {
    .ceo-today-panel { grid-template-columns:1fr; }
    .cc-finance-grid { grid-template-columns:1fr 1fr; }
    .cc-ops-grid     { grid-template-columns:1fr 1fr; }
    .cc-decisions-grid { grid-template-columns:1fr 1fr; }
}
/* Tablet: iPad, large phones (768-900px) */
@media (max-width:900px) {
    .ceo-focus-grid { grid-template-columns:1fr 1fr; }
    .cc-risk-panel  { min-width:0; max-width:none; width:100%; }
    .cc-root        { overflow-x:hidden; }
}
/* Phone: < 640px */
@media (max-width:640px) {
    .ceo-focus-grid { grid-template-columns:1fr; }
    .ceo-today-panel { padding:14px; }
    .ceo-today-title { font-size:20px; }
    .ceo-today-sub  { font-size:12px; }
    .cc-finance-grid, .cc-ops-grid, .cc-decisions-grid,
    .cc-risk-board  { grid-template-columns:1fr; }
    .cc-exec-strip  { flex-direction:column; }
    .cc-risk-panel  { min-width:0; max-width:none; }
    .cc-kpi-tile    { min-width:0; }
    .dd-card-link   { min-width:0; }
    .cc-decisions-grid { grid-template-columns:1fr; }
    .cc-vendor-grid { grid-template-columns:1fr !important; }
    .cc-section     { padding:12px; }
}

/* ── Legacy exec zone styles (preserved for KPI micro-bar) ──────────────── */
.exec-kpi-bar {
    display:flex; align-items:center; gap:20px;
    padding:10px 0;
    border-top:1px solid rgba(255,255,255,.06);
    border-bottom:1px solid rgba(255,255,255,.06);
}
.exec-kpi-item { display:flex; align-items:baseline; gap:5px; color:inherit; text-decoration:none; }
.exec-kpi-val  { font-size:18px; font-weight:700; color:#e5e7eb; line-height:1; }
.exec-kpi-lbl  { font-size:11px; color:#6b7280; font-weight:500; }
.exec-kpi-sep  { width:1px; height:16px; background:rgba(255,255,255,.08); flex-shrink:0; }
.exec-kpi-toggle {
    margin-left:auto; height:30px; padding:0 12px;
    border:1px solid rgba(255,255,255,.1); border-radius:8px;
    background:transparent; font-size:12px; color:#6b7280;
    cursor:pointer; transition:background .15s, color .15s; white-space:nowrap;
}
.exec-kpi-toggle:hover { background:rgba(255,255,255,.05); color:#9ca3af; }

/* Drill-down drawer (legacy preserved) */
.ov-drawer-overlay {
    display:none; position:fixed; inset:0; z-index:9500;
    background:rgba(0,0,0,.6);
}
.ov-drawer-overlay.active { display:flex; align-items:flex-start; justify-content:flex-end; }
.ov-drawer {
    width:520px; max-width:96vw; height:100vh; overflow-y:auto;
    background:#1e293b; border-left:1px solid rgba(255,255,255,.1);
    display:flex; flex-direction:column;
}
.ov-drawer-header {
    display:flex; align-items:center; justify-content:space-between;
    padding:18px 22px; border-bottom:1px solid rgba(255,255,255,.08); flex-shrink:0;
}
.ov-drawer-title   { font-size:16px; font-weight:700; color:#f1f5f9; }
.ov-drawer-subtitle{ font-size:12px; color:#64748b; margin-top:2px; }
.ov-drawer-body    { flex:1; overflow-y:auto; padding:16px 22px; }
.ov-outstanding-table { width:100%; border-collapse:collapse; }
.ov-outstanding-table th {
    font-size:10px; text-transform:uppercase; letter-spacing:.07em;
    color:#64748b; padding:6px 8px; border-bottom:1px solid rgba(255,255,255,.08);
    text-align:left;
}
.ov-outstanding-table td { padding:10px 8px; vertical-align:middle; }
.ov-drill-row:hover  { background:rgba(255,255,255,.03); cursor:pointer; }
.row-overdue         { background:rgba(239,68,68,.04); }
.ov-task-link        { color:#60a5fa; text-decoration:none; font-size:13px; font-weight:500; }
.ov-task-link:hover  { text-decoration:underline; }
.due-overdue         { color:#ef4444; font-weight:600; }
.due-today           { color:#f59e0b; }
.text-muted          { color:#64748b; }
.text-sm             { font-size:11px; }
.badge               { font-size:10px; padding:2px 7px; border-radius:4px; font-weight:600; }
.badge-active        { background:rgba(34,197,94,.12); color:#22c55e; }
.badge-member        { background:rgba(96,165,250,.12); color:#60a5fa; }

/* ══ Gap 1: Decision Comparison Layer ═══════════════════════════════════════ */
.cc-dec-compare { margin-top:8px; border-radius:8px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); overflow:hidden; }
.cc-dec-compare-toggle { padding:8px 12px; font-size:10px; color:#475569; cursor:pointer; user-select:none; font-weight:600; letter-spacing:.04em; }
.cc-dec-compare-body { display:none; padding:10px 12px; border-top:1px solid rgba(255,255,255,.06); }
.cc-dec-compare.open .cc-dec-compare-toggle { color:#94a3b8; }
.cc-dec-compare.open .cc-dec-compare-body { display:block; }
.cc-dec-compare-score { font-size:11px; color:#64748b; margin-bottom:6px; display:flex; gap:12px; flex-wrap:wrap; }
.cc-dec-compare-reason { font-size:11px; color:#475569; line-height:1.5; font-style:italic; }

/* ══ Gap 2: Next Action Banner ═══════════════════════════════════════════════ */
.cc-next-action-banner { display:flex; align-items:center; gap:12px; padding:12px 14px; background:rgba(34,197,94,.06); border:1px solid rgba(34,197,94,.15); border-radius:8px; }

/* ══ Gap 7: All-Clear Panel ══════════════════════════════════════════════════ */
.cc-all-clear { display:flex; align-items:center; gap:24px; padding:32px; background:rgba(34,197,94,.04); border:1px solid rgba(34,197,94,.1); border-radius:12px; }
.cc-all-clear-icon { color:#22c55e; flex-shrink:0; }
.cc-all-clear-title { font-size:18px; font-weight:700; color:#f1f5f9; margin-bottom:4px; }
.cc-all-clear-sub { font-size:13px; color:#64748b; margin-bottom:16px; }
.cc-all-clear-stats { display:flex; gap:24px; flex-wrap:wrap; margin-bottom:14px; }
.cc-all-clear-stat { display:flex; flex-direction:column; gap:2px; }
.cc-all-clear-stat-num { font-size:22px; font-weight:800; color:#f1f5f9; line-height:1; }
.cc-all-clear-stat-lbl { font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:.06em; }
.cc-all-clear-next { font-size:11px; color:#475569; display:flex; align-items:center; gap:6px; }
</style>


<div class="cc-root">

<section class="ceo-today-panel" id="ceo-today" aria-label="CEO Today">
    <div class="ceo-today-intro">
        <span class="ceo-today-eyebrow"><?= tf_icon('target', 12) ?> CEO Focus</span>
        <div class="ceo-today-title">Start here. Three things matter today.</div>
        <div class="ceo-today-sub">
            The rest of the dashboard is detail. This panel tells you what to decide, what to pay or file, and what needs follow-up.
        </div>
    </div>
    <div class="ceo-focus-grid">
        <?php foreach ($ceoFocusCards as $focus): ?>
        <a class="ceo-focus-card" data-tone="<?= e($focus['tone']) ?>" href="<?= e($focus['url']) ?>">
            <div class="ceo-focus-top">
                <span class="ceo-focus-kicker"><?= e($focus['kicker']) ?></span>
                <span class="ceo-focus-icon"><?= tf_icon($focus['icon'], 17) ?></span>
            </div>
            <div class="ceo-focus-title"><?= e($focus['title']) ?></div>
            <div class="ceo-focus-meta"><?= e($focus['meta']) ?></div>
            <div class="ceo-focus-action"><?= e($focus['label']) ?> <?= tf_icon('chevron-right', 12) ?></div>
        </a>
        <?php endforeach; ?>
    </div>
</section>

<!-- ════════════════════════════════════════════════════════════════════════════
     SECTION 1 — EXECUTIVE SUMMARY STRIP
     ════════════════════════════════════════════════════════════════════════════ -->
<div class="cc-exec-strip">

    <!-- KPI: Total Cash Risk -->
    <?php
    $cashRisk      = (float)($execSum['total_cash_risk'] ?? 0);
    $cashRiskColor = $cashRisk > 10000 ? '#dc2626' : ($cashRisk > 2000 ? '#f59e0b' : '#22c55e');
    ?>
    <a href="<?= APP_URL ?>/overview/drilldown/cash-risk" class="dd-card-link">
    <div class="cc-kpi-tile">
        <div class="cc-kpi-tile-head">
            <span style="color:#64748b;display:flex"><?= tf_icon('wallet', 13) ?></span>
            <?= e(t('dashboard.kpi.cash_risk')) ?>
        </div>
        <div class="cc-kpi-tile-num" style="color:<?= $cashRiskColor ?>">
            $<?= number_format($cashRisk, 0) ?>
        </div>
        <div class="cc-kpi-tile-sub">Unpaid + overdue exposure</div>
        <span class="cc-kpi-tile-badge" style="background:<?= $cashRiskColor ?>18;color:<?= $cashRiskColor ?>">
            <?= $cashRisk > 10000 ? 'CRITICAL' : ($cashRisk > 2000 ? 'HIGH' : 'LOW') ?>
        </span>
        <div class="dd-hint">View details →</div>
    </div>
    </a>

    <!-- KPI: Overdue Bills -->
    <?php
    $ovBills      = $execSum['overdue_bills'] ?? ['count' => 0, 'amount' => 0];
    $ovBillsColor = ($ovBills['count'] ?? 0) > 5 ? '#dc2626' : (($ovBills['count'] ?? 0) > 1 ? '#f59e0b' : '#22c55e');
    ?>
    <a href="<?= APP_URL ?>/overview/drilldown/overdue-bills" class="dd-card-link">
    <div class="cc-kpi-tile">
        <div class="cc-kpi-tile-head">
            <span style="color:#64748b;display:flex"><?= tf_icon('alert-triangle', 13) ?></span>
            Overdue Bills
        </div>
        <div class="cc-kpi-tile-num" style="color:<?= $ovBillsColor ?>">
            <?= (int)($ovBills['count'] ?? 0) ?>
        </div>
        <div class="cc-kpi-tile-sub">$<?= number_format((float)($ovBills['amount'] ?? 0), 0) ?> outstanding</div>
        <span class="cc-kpi-tile-badge" style="background:<?= $ovBillsColor ?>18;color:<?= $ovBillsColor ?>">
            <?= ($ovBills['count'] ?? 0) > 0 ? 'ACTION NEEDED' : 'CLEAR' ?>
        </span>
        <div class="dd-hint">View details →</div>
    </div>
    </a>

    <!-- KPI: Critical Tasks -->
    <?php
    $critTasks      = (int)($execSum['critical_tasks'] ?? 0);
    $critTasksColor = $critTasks > 10 ? '#dc2626' : ($critTasks > 3 ? '#f59e0b' : '#22c55e');
    ?>
    <a href="<?= APP_URL ?>/overview/drilldown/critical-tasks" class="dd-card-link">
    <div class="cc-kpi-tile">
        <div class="cc-kpi-tile-head">
            <span style="color:#64748b;display:flex"><?= tf_icon('gauge', 13) ?></span>
            Critical Tasks
        </div>
        <div class="cc-kpi-tile-num" style="color:<?= $critTasksColor ?>"><?= $critTasks ?></div>
        <div class="cc-kpi-tile-sub">Overdue or blocked</div>
        <span class="cc-kpi-tile-badge" style="background:<?= $critTasksColor ?>18;color:<?= $critTasksColor ?>">
            <?= $critTasks > 10 ? 'CRITICAL' : ($critTasks > 3 ? 'HIGH' : 'LOW') ?>
        </span>
        <div class="dd-hint">View details →</div>
    </div>
    </a>

    <!-- KPI: Compliance Risk -->
    <?php
    $compRisk      = $execSum['compliance_risk'] ?? ['count' => 0, 'level' => 'low'];
    $compRiskColor = riskColor($compRisk['level'] ?? 'low');
    ?>
    <a href="<?= APP_URL ?>/overview/drilldown/compliance-risk" class="dd-card-link">
    <div class="cc-kpi-tile">
        <div class="cc-kpi-tile-head">
            <span style="color:#64748b;display:flex"><?= tf_icon('shield-alert', 13) ?></span>
            Compliance Risk
        </div>
        <div class="cc-kpi-tile-num" style="color:<?= $compRiskColor ?>">
            <?= (int)($compRisk['count'] ?? 0) ?>
        </div>
        <div class="cc-kpi-tile-sub">Items needing attention</div>
        <span class="cc-kpi-tile-badge" style="background:<?= $compRiskColor ?>18;color:<?= $compRiskColor ?>">
            <?= strtoupper($compRisk['level'] ?? 'LOW') ?>
        </span>
        <div class="dd-hint">View details →</div>
    </div>
    </a>

    <!-- KPI: Execution Risk -->
    <?php
    $execRisk      = $execSum['execution_risk'] ?? ['level' => 'low', 'overloaded_count' => 0];
    $execRiskColor = riskColor($execRisk['level'] ?? 'low');
    ?>
    <a href="<?= APP_URL ?>/overview/drilldown/execution-risk" class="dd-card-link">
    <div class="cc-kpi-tile">
        <div class="cc-kpi-tile-head">
            <span style="color:#64748b;display:flex"><?= tf_icon('users', 13) ?></span>
            Execution Risk
        </div>
        <div class="cc-kpi-tile-num" style="color:<?= $execRiskColor ?>">
            <?= (int)($execRisk['overloaded_count'] ?? 0) ?>
        </div>
        <div class="cc-kpi-tile-sub">Overloaded team members</div>
        <span class="cc-kpi-tile-badge" style="background:<?= $execRiskColor ?>18;color:<?= $execRiskColor ?>">
            <?= strtoupper($execRisk['level'] ?? 'LOW') ?>
        </span>
        <div class="dd-hint">View details →</div>
    </div>
    </a>

    <!-- KPI: Penalty Summary (Admin only) — this month vs last month -->
    <?php if (isAdmin() && !empty($penaltyKpis)): ?>
    <?php
    $pkThisMonth  = $penaltyKpis['month']     ?? ['cnt'=>0,'vnd'=>0];
    $pkLastMonth  = $penaltyKpis['last_month'] ?? ['cnt'=>0,'vnd'=>0];
    $pkWeek       = $penaltyKpis['week']       ?? ['cnt'=>0,'vnd'=>0];
    $pkYear       = $penaltyKpis['year']       ?? ['cnt'=>0,'vnd'=>0];
    $pkToday      = $penaltyKpis['today']      ?? ['cnt'=>0,'vnd'=>0];
    $pkTopUser    = $penaltyKpis['top_user']   ?? null;

    $pkColor      = (float)$pkThisMonth['vnd'] >= 2000000 ? '#dc2626' : ((float)$pkThisMonth['vnd'] >= 500000 ? '#f59e0b' : '#22c55e');
    $pkTrend      = (float)$pkLastMonth['vnd'] > 0
        ? round(((float)$pkThisMonth['vnd'] - (float)$pkLastMonth['vnd']) / max(1,(float)$pkLastMonth['vnd']) * 100)
        : 0;
    $pkTrendUp    = $pkTrend > 0;
    ?>
    <div class="cc-kpi-tile" id="penalty-kpi-tile" style="border-left:3px solid <?= $pkColor ?>">
        <div class="cc-kpi-tile-head">
            <span style="color:<?= $pkColor ?>;display:flex"><?= tf_icon('alert-octagon', 13) ?></span>
            Penalty Summary
            <a href="<?= APP_URL ?>/admin/penalties" class="cc-kpi-tile-link" title="Go to Penalty Management"><?= tf_icon('external-link', 11) ?></a>
        </div>

        <!-- Period toggle: Week / This Month / Year -->
        <div class="pen-period-tabs" id="pen-period-tabs">
            <button class="pen-tab-btn active" data-period="month" onclick="penSwitchPeriod('month')">Tháng này</button>
            <button class="pen-tab-btn" data-period="week"    onclick="penSwitchPeriod('week')">Tuần này</button>
            <button class="pen-tab-btn" data-period="year"    onclick="penSwitchPeriod('year')">Năm nay</button>
        </div>

        <!-- Period data panels -->
        <div id="pen-panel-month" class="pen-panel">
            <div class="pen-amount-row">
                <span class="pen-amount" style="color:<?= $pkColor ?>">
                    <?= number_format((float)$pkThisMonth['vnd'], 0, '.', ',') ?>
                </span>
                <span class="pen-currency">VND</span>
                <?php if ((float)$pkLastMonth['vnd'] > 0): ?>
                <span class="pen-trend <?= $pkTrendUp ? 'trend-up' : 'trend-down' ?>">
                    <?= $pkTrendUp ? '▲' : '▼' ?><?= abs($pkTrend) ?>%
                </span>
                <?php endif; ?>
            </div>
            <div class="pen-meta-row">
                <span class="pen-cnt"><?= (int)$pkThisMonth['cnt'] ?> lần phạt</span>
                <span class="pen-vs">vs tháng trước: <?= number_format((float)$pkLastMonth['vnd'], 0, '.', ',') ?> VND</span>
            </div>
        </div>

        <div id="pen-panel-week" class="pen-panel" style="display:none">
            <div class="pen-amount-row">
                <span class="pen-amount" style="color:#3b82f6">
                    <?= number_format((float)$pkWeek['vnd'], 0, '.', ',') ?>
                </span>
                <span class="pen-currency">VND</span>
            </div>
            <div class="pen-meta-row">
                <span class="pen-cnt"><?= (int)$pkWeek['cnt'] ?> lần phạt</span>
            </div>
        </div>

        <div id="pen-panel-year" class="pen-panel" style="display:none">
            <div class="pen-amount-row">
                <span class="pen-amount" style="color:#8b5cf6">
                    <?= number_format((float)$pkYear['vnd'], 0, '.', ',') ?>
                </span>
                <span class="pen-currency">VND</span>
            </div>
            <div class="pen-meta-row">
                <span class="pen-cnt"><?= (int)$pkYear['cnt'] ?> lần phạt</span>
            </div>
        </div>

        <!-- Top penalized user -->
        <?php if (!empty($pkTopUser)): ?>
        <div class="pen-top-user">
            <span style="color:#94a3b8;font-size:9px">Người bị phạt nhiều nhất:</span>
            <span style="color:#f1f5f9;font-size:11px;font-weight:600"><?= e($pkTopUser['name']) ?></span>
            <span style="color:#64748b;font-size:9px">(<?= (int)$pkTopUser['cnt'] ?> lần)</span>
        </div>
        <?php endif; ?>

        <a href="<?= APP_URL ?>/overview/drilldown/penalty" class="dd-hint" style="margin-top:6px">
            Xem chi tiết → ↗
        </a>
    </div>
    <?php endif; ?>

    <!-- Unified Risk Score -->
    <div class="cc-risk-panel">
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.09em;display:flex;align-items:center;gap:6px">
            <span style="display:flex"><?= tf_icon('cpu', 13) ?></span>
            Unified Risk Score
        </div>
        <div class="cc-risk-score-row">
            <span class="cc-risk-score-num" style="color:<?= $uRiskColor ?>"><?= $uRiskScore ?></span>
            <span class="cc-risk-score-label" style="color:<?= $uRiskColor ?>"><?= $uRiskLevel ?></span>
        </div>
        <div class="cc-risk-bar-wrap">
            <?php
            $bdTotal = max(1, array_sum($uBreakdown));
            foreach (['finance' => '#f59e0b', 'operations' => '#3b82f6', 'compliance' => '#dc2626'] as $bdKey => $bdColor):
                $bdVal = (int)($uBreakdown[$bdKey] ?? 0);
                $bdPct = round($bdVal / $bdTotal * 100);
            ?>
            <div class="cc-risk-bar-row">
                <span style="width:68px;text-transform:capitalize"><?= $bdKey ?></span>
                <div class="cc-risk-bar-track">
                    <div class="cc-risk-bar-fill" style="width:<?= $bdPct ?>%;background:<?= $bdColor ?>"></div>
                </div>
                <span style="width:24px;text-align:right;color:#f1f5f9;font-weight:700"><?= $bdVal ?></span>
            </div>
            <?php endforeach; ?>
        </div>
        <?php
        // Calculate expected risk reduction from top action
        $riskDelta = 0;
        if (!empty($topDecs)) {
            $topAction = $topDecs[0];
            // Estimate delta: bill payment reduces finance risk, compliance reduces compliance risk
            if (($topAction['type'] ?? '') === 'bill') {
                $riskDelta = min(25, (int)(($topAction['impact_score'] ?? 0) * 0.3));
            } elseif (($topAction['type'] ?? '') === 'compliance') {
                $riskDelta = min(30, (int)(($topAction['impact_score'] ?? 0) * 0.35));
            } elseif (($topAction['type'] ?? '') === 'team') {
                $riskDelta = min(20, (int)(($topAction['impact_score'] ?? 0) * 0.25));
            }
        }
        ?>
        <?php if ($riskDelta > 0): ?>
        <div style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.12);border-radius:6px;margin-top:4px">
            <span style="font-size:11px;color:#64748b">If top action taken:</span>
            <span style="font-size:13px;font-weight:800;color:#22c55e">−<?= $riskDelta ?></span>
            <span style="font-size:10px;color:#475569">risk points</span>
        </div>
        <?php endif; ?>
        <div style="font-size:10px;color:#475569;display:flex;align-items:center;gap:4px">
            <?= tf_icon('clock', 10) ?> Updated <?= date('H:i') ?>
        </div>
        <a href="<?= APP_URL ?>/overview/drilldown/unified-risk" class="dd-hint" style="display:flex;align-items:center;gap:4px;margin-top:4px">
            View all risk items →
        </a>
    </div>

</div><!-- /.cc-exec-strip -->

<?php if (!empty($oblKpis)): ?>
<div class="cc-section" id="cc-sec-obligations">
    <div class="cc-section-header" onclick="ccToggleSection('cc-sec-obligations')">
        <div class="cc-section-title-wrap">
            <span class="cc-section-icon"><?= tf_icon('wallet', 16) ?></span>
            <span class="cc-section-title">Compliance & Payment Operations</span>
            <span class="cc-section-badge">Obligation KPIs</span>
        </div>
        <span class="cc-section-toggle"><?= tf_icon('chevron-down', 16) ?></span>
    </div>
    <div class="cc-section-body">
        <?php require __DIR__ . '/../obligations/_dashboard_widget.php'; ?>
    </div>
</div>
<?php endif; ?>

<!-- KPI micro-bar (always visible — legacy compat) -->
<div class="exec-kpi-bar">
    <a href="<?= APP_URL ?>/projects" class="exec-kpi-item" style="text-decoration:none">
        <span class="exec-kpi-val"><?= (int)($activeProjects ?? 0) ?></span>
        <span class="exec-kpi-lbl">Projects</span>
    </a>
    <span class="exec-kpi-sep"></span>
    <div class="exec-kpi-item">
        <span class="exec-kpi-val"><?= (int)($completionRate ?? 0) ?>%</span>
        <span class="exec-kpi-lbl">Complete</span>
    </div>
    <?php if (!empty($totalOverdue) && $totalOverdue > 0): ?>
    <span class="exec-kpi-sep"></span>
    <a href="<?= APP_URL ?>/my-tasks?tab=overdue" class="exec-kpi-item" style="text-decoration:none;color:inherit">
        <span class="exec-kpi-val" style="color:#ef4444"><?= (int)$totalOverdue ?></span>
        <span class="exec-kpi-lbl" style="color:#ef4444">Overdue<?php
            $brkT = (int)($overdueTaskCount ?? 0);
            $brkB = (int)($overdueBillCount ?? 0);
            if ($brkT > 0 || $brkB > 0):
                $parts = [];
                if ($brkT > 0) $parts[] = $brkT . ' task' . ($brkT !== 1 ? 's' : '');
                if ($brkB > 0) $parts[] = $brkB . ' bill' . ($brkB !== 1 ? 's' : '');
                echo ' (' . implode(' + ', $parts) . ')';
            endif;
        ?></span>
    </a>
    <?php endif; ?>
    <span class="exec-kpi-sep"></span>
    <div class="exec-kpi-item">
        <span class="exec-kpi-val"><?= (int)($totalMembers ?? 0) ?></span>
        <span class="exec-kpi-lbl">Members</span>
    </div>
    <?php
    $roleTag = canAdmin() ? 'CEO' : (canManage() ? 'Manager' : 'Staff');
    ?>
    <span class="exec-kpi-sep"></span>
    <div class="exec-kpi-item">
        <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(96,165,250,.1);color:#60a5fa;border:1px solid rgba(96,165,250,.2);letter-spacing:.05em"><?= $roleTag ?> View</span>
    </div>
    <button class="exec-kpi-toggle" onclick="ccToggleSection('cc-sec-decisions')">
        <?= tf_icon('chevron-down', 12) ?> Decisions
    </button>
</div>


<!-- ════════════════════════════════════════════════════════════════════════════
     SECTION 2 — PRIORITY DECISIONS (Top 3 action cards)
     ════════════════════════════════════════════════════════════════════════════ -->
<div class="cc-section" id="cc-sec-decisions">
    <div class="cc-section-header" onclick="ccToggleSection('cc-sec-decisions')">
        <div class="cc-section-title-wrap">
            <span class="cc-section-icon"><?= tf_icon('zap', 16) ?></span>
            <span class="cc-section-title">Priority Decisions</span>
            <span class="cc-section-badge"><?= count($topDecs) ?: count($focusItems) ?> actions</span>
        </div>
        <span class="cc-section-toggle"><?= tf_icon('chevron-down', 16) ?></span>
    </div>
    <div class="cc-section-body">

    <?php
    // Use $topDecs from $commandCenter if available, else fall back to $focusItems
    $decisionsToShow = !empty($topDecs) ? $topDecs : [];
    ?>

    <?php if (!empty($decisionsToShow)): ?>
    <!-- commandCenter top_decisions path -->
    <div class="cc-decisions-grid">
    <?php foreach (array_slice($decisionsToShow, 0, 3) as $dec):
        $decRank      = (int)($dec['rank'] ?? 1);
        $decType      = $dec['type'] ?? 'task';
        $decTitle     = $dec['title'] ?? '';
        $decDeadline  = $dec['deadline'] ?? '';
        $decImpact    = strtoupper($dec['impact_level'] ?? 'HIGH');
        $decImpScore  = (int)($dec['impact_score'] ?? 0);
        $decConseq    = $dec['consequence'] ?? '';
        $decAmount    = $dec['amount'] ?? null;
        $decAction    = $dec['action'] ?? [];
        $decPred      = $dec['prediction'] ?? [];
        $decIfIgnored = $decPred['if_ignored'] ?? [];
        $decHorizon   = (int)($decPred['horizon_hours'] ?? 24);
        $decImpColor  = impactColor($decImpact);
        $decActStyle  = actionBtnStyle($decAction['type'] ?? '');
        $decIcon      = match($decType) {
            'bill'       => 'wallet',
            'compliance' => 'shield-alert',
            'team'       => 'users',
            default      => 'check-circle',
        };
    ?>
    <div class="cc-decision-card" style="border-top-color:<?= $decImpColor ?>">
        <div class="cc-dec-header">
            <div class="cc-dec-rank" style="background:<?= $decImpColor ?>"><?= $decRank ?></div>
            <div class="cc-dec-header-right">
                <div class="cc-dec-title">
                    <span style="display:inline-flex;vertical-align:middle;color:<?= $decImpColor ?>;margin-right:5px"><?= tf_icon($decIcon, 14) ?></span>
                    <?= e($decTitle) ?>
                </div>
                <div class="cc-dec-badges">
                    <?php if ($decDeadline): ?>
                    <span class="cc-dec-deadline-badge">
                        <?= tf_icon('clock', 11) ?> <?= e($decDeadline) ?>
                    </span>
                    <?php endif; ?>
                    <span class="cc-dec-impact-badge" style="background:<?= $decImpColor ?>18;color:<?= $decImpColor ?>">
                        <?= $decImpact ?>
                    </span>
                </div>
            </div>
        </div>

        <?php if ($decConseq): ?>
        <div class="cc-dec-consequence"><?= e($decConseq) ?></div>
        <?php endif; ?>

        <?php if (!empty($decIfIgnored)): ?>
        <div class="cc-dec-prediction">
            <div class="cc-dec-prediction-label">If ignored</div>
            <div class="cc-dec-prediction-text"><?= e($decIfIgnored[0]) ?><?php if ($decHorizon > 0): ?> within <?= $decHorizon ?>h<?php endif; ?></div>
        </div>
        <?php endif; ?>

        <div class="cc-dec-footer">
            <?php if ($decAmount !== null): ?>
            <div class="cc-dec-amount">$<?= number_format((float)$decAmount, 0) ?></div>
            <?php else: ?>
            <div style="font-size:11px;color:#475569">Impact score: <?= $decImpScore ?></div>
            <?php endif; ?>

            <?php if (!empty($decAction)): ?>
                <?php if (($decAction['type'] ?? '') === 'pay_bill' && !empty($decAction['data']['bill_id'])): ?>
                <button class="cc-dec-action-btn cc-pay-btn"
                        style="<?= $decActStyle ?>"
                        data-bill-id="<?= (int)$decAction['data']['bill_id'] ?>"
                        data-vendor="<?= e($decTitle) ?>"
                        data-amount="<?= e($decAmount ?? 0) ?>"
                        data-due="">
                    <?= tf_icon('wallet', 13) ?> <?= e($decAction['label'] ?? 'Pay Now') ?>
                </button>
                <?php else: ?>
                <a href="<?= e($decAction['url'] ?? '#') ?>" class="cc-dec-action-btn" style="<?= $decActStyle ?>">
                    <?= tf_icon($decIcon, 13) ?> <?= e($decAction['label'] ?? 'View') ?>
                </a>
                <?php endif; ?>
            <?php endif; ?>
        </div>
        <?php
        // Gap 1: Decision Comparison block (inside card to avoid extra grid cells)
        $otherScores = array_filter(array_map(function($d) use ($dec) {
            return ($d !== $dec) ? (int)($d['impact_score'] ?? 0) : null;
        }, array_slice($decisionsToShow, 0, 3)));
        $otherScoresFiltered = array_values(array_filter($otherScores, fn($v) => $v !== null));
        $compareReason = !empty($decIfIgnored) ? $decIfIgnored[0] : ($decConseq ?: 'Highest combined risk and time-sensitivity score');
        ?>
        <div class="cc-dec-compare" onclick="this.classList.toggle('open')">
            <div class="cc-dec-compare-toggle">Why ranked #<?= $decRank ?>? &#9662;</div>
            <div class="cc-dec-compare-body">
                <div class="cc-dec-compare-score">
                    <span>This action: <strong style="color:#f1f5f9"><?= $decImpScore ?></strong></span>
                    <?php if (!empty($otherScoresFiltered)): ?>
                    <span>vs next:
                        <?php foreach ($otherScoresFiltered as $osi => $osv): ?>
                        <strong style="color:#94a3b8"><?= $osv ?></strong><?= $osi < count($otherScoresFiltered) - 1 ? ' &middot; ' : '' ?>
                        <?php endforeach; ?>
                    </span>
                    <?php endif; ?>
                </div>
                <div class="cc-dec-compare-reason"><?= e($compareReason) ?></div>
            </div>
        </div>
    </div>
    <?php endforeach; ?>
    </div>

    <?php elseif (!empty($focusItems)): ?>
    <!-- Legacy V4/V3 decisions fallback -->
    <div class="cc-decisions-grid">
    <?php foreach ($focusItems as $fi_idx => $fi):
        $fiColor     = $fi['color'] ?? '#f59e0b';
        $fiImpScore  = (int)($fi['impact_score'] ?? 0);
        $fiIfIgnored = $fi['if_ignored'] ?? [];
        $fiRecLabel  = $fi['recommendation'] ?? null;
        $fiRecColor  = $fi['rec_color'] ?? $fiColor;
        $fiImpact    = $fi['impact'] ?? 'HIGH IMPACT';
        $aMode       = $fi['autonomy_mode'] ?? null;
        $aBadge      = match($aMode) {
            'auto'     => ['label'=>'AUTO',     'color'=>'#22c55e', 'bg'=>'rgba(34,197,94,.1)',  'icon'=>'check-circle'],
            'approval' => ['label'=>'APPROVAL', 'color'=>'#f59e0b', 'bg'=>'rgba(245,158,11,.1)', 'icon'=>'alert-triangle'],
            'blocked'  => ['label'=>'BLOCKED',  'color'=>'#ef4444', 'bg'=>'rgba(239,68,68,.1)',  'icon'=>'alert-triangle'],
            default    => null,
        };
    ?>
    <div class="cc-decision-card" style="border-top-color:<?= $fiColor ?>">
        <div class="cc-dec-header">
            <div class="cc-dec-rank" style="background:<?= $fiColor ?>"><?= $fi_idx + 1 ?></div>
            <div class="cc-dec-header-right">
                <div class="cc-dec-title">
                    <span style="display:inline-flex;vertical-align:middle;color:<?= $fiColor ?>;margin-right:5px"><?= tf_icon($fi['icon'] ?? 'alert-triangle', 14) ?></span>
                    <?= e($fi['title']) ?>
                </div>
                <div class="cc-dec-badges">
                    <span class="cc-dec-impact-badge" style="background:<?= $fiColor ?>18;color:<?= $fiColor ?>">
                        <?= e($fiImpact) ?>
                    </span>
                    <?php if ($aBadge): ?>
                    <span class="cc-dec-impact-badge" style="background:<?= $aBadge['bg'] ?>;color:<?= $aBadge['color'] ?>">
                        <?= $aBadge['label'] ?>
                    </span>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <?php if (!empty($fi['sub'])): ?>
        <div class="cc-dec-consequence"><?= e($fi['sub']) ?></div>
        <?php endif; ?>

        <?php if (!empty($fiIfIgnored)): ?>
        <div class="cc-dec-prediction">
            <div class="cc-dec-prediction-label">If ignored</div>
            <div class="cc-dec-prediction-text"><?= e($fiIfIgnored[0]) ?></div>
        </div>
        <?php endif; ?>

        <div class="cc-dec-footer">
            <div style="display:flex;flex-direction:column;gap:2px">
                <div style="display:flex;align-items:baseline;gap:4px">
                    <span style="font-size:20px;font-weight:800;color:<?= $fiColor ?>"><?= $fiImpScore ?></span>
                    <span style="font-size:9px;color:#475569">IMPACT</span>
                </div>
                <?php if ($fiRecLabel): ?>
                <span style="font-size:9px;font-weight:700;color:<?= $fiRecColor ?>"><?= e($fiRecLabel) ?></span>
                <?php endif; ?>
            </div>
            <a href="<?= e($fi['url']) ?>" class="cc-dec-action-btn" style="background:<?= $fiColor ?>18;color:<?= $fiColor ?>;border-color:<?= $fiColor ?>33">
                <?= e($fi['btn']) ?> <?= tf_icon('arrow-right-circle', 13) ?>
            </a>
        </div>
    <?php
    // Gap 1: Decision Comparison block (focusItems fallback)
    $fiOtherScores = array_filter(array_map(function($f) use ($fi) {
        return ($f !== $fi) ? (int)($f['impact_score'] ?? 0) : null;
    }, $focusItems));
    $fiOtherScoresFiltered = array_values(array_filter($fiOtherScores, fn($v) => $v !== null));
    $fiCompareReason = !empty($fi['if_ignored']) ? $fi['if_ignored'][0] : ($fi['sub'] ?: 'Highest combined risk and time-sensitivity score');
    ?>
    <div class="cc-dec-compare" onclick="this.classList.toggle('open')">
        <div class="cc-dec-compare-toggle">Why ranked #<?= $fi_idx + 1 ?>? &#9662;</div>
        <div class="cc-dec-compare-body">
            <div class="cc-dec-compare-score">
                <span>This action: <strong style="color:#f1f5f9"><?= $fiImpScore ?></strong></span>
                <?php if (!empty($fiOtherScoresFiltered)): ?>
                <span>vs next:
                    <?php foreach ($fiOtherScoresFiltered as $fosi => $fosv): ?>
                    <strong style="color:#94a3b8"><?= $fosv ?></strong><?= $fosi < count($fiOtherScoresFiltered) - 1 ? ' &middot; ' : '' ?>
                    <?php endforeach; ?>
                </span>
                <?php endif; ?>
            </div>
            <div class="cc-dec-compare-reason"><?= e($fiCompareReason) ?></div>
        </div>
    </div>
    </div>
    <?php endforeach; ?>
    </div>

    <?php else: ?>
    <!-- All clear — comprehensive panel -->
    <div class="cc-all-clear">
        <div class="cc-all-clear-icon"><?= tf_icon('check-circle', 40) ?></div>
        <div class="cc-all-clear-content">
            <div class="cc-all-clear-title">All systems operational</div>
            <div class="cc-all-clear-sub">No critical decisions required at this time</div>
            <div class="cc-all-clear-stats">
                <div class="cc-all-clear-stat">
                    <span class="cc-all-clear-stat-num"><?= (int)($activeProjects ?? 0) ?></span>
                    <span class="cc-all-clear-stat-lbl">Active Projects</span>
                </div>
                <div class="cc-all-clear-stat">
                    <span class="cc-all-clear-stat-num"><?= (int)($completionRate ?? 0) ?>%</span>
                    <span class="cc-all-clear-stat-lbl">Completion Rate</span>
                </div>
                <div class="cc-all-clear-stat">
                    <span class="cc-all-clear-stat-num" style="color:#22c55e">0</span>
                    <span class="cc-all-clear-stat-lbl">Overdue Bills</span>
                </div>
                <div class="cc-all-clear-stat">
                    <span class="cc-all-clear-stat-num" style="color:#22c55e">0</span>
                    <span class="cc-all-clear-stat-lbl">Compliance Risk</span>
                </div>
            </div>
            <div class="cc-all-clear-next">
                <?= tf_icon('trending-up', 13) ?> Monitor mode — next scheduled review in 24h
            </div>
        </div>
    </div>
    <?php endif; ?>

    </div><!-- /.cc-section-body decisions -->
</div><!-- /#cc-sec-decisions -->


<!-- ════════════════════════════════════════════════════════════════════════════
     SECTION 3 — FINANCE: CFO Panel
     ════════════════════════════════════════════════════════════════════════════ -->
<div class="cc-section" id="cc-sec-finance">
    <div class="cc-section-header" onclick="ccToggleSection('cc-sec-finance')">
        <div class="cc-section-title-wrap">
            <span class="cc-section-icon"><?= tf_icon('trending-up', 16) ?></span>
            <span class="cc-section-title">Finance — CFO Panel</span>
            <?php
            $ovCount = (int)(($ccFinance['cash_timeline']['overdue']['count'] ?? 0));
            if ($ovCount > 0):
            ?>
            <span class="cc-section-badge" style="background:rgba(220,38,38,.12);color:#dc2626;border-color:rgba(220,38,38,.2)">
                <?= $ovCount ?> overdue
            </span>
            <?php endif; ?>
        </div>
        <span class="cc-section-toggle"><?= tf_icon('chevron-down', 16) ?></span>
    </div>
    <div class="cc-section-body">
    <?php
    // Build "Pay This First" ordered list from risk buckets
    $payFirst = [];
    foreach (['critical','high','medium'] as $pLevel) {
        foreach (array_slice($ccFinance['risk_buckets'][$pLevel] ?? [], 0, 2) as $pb) {
            $payFirst[] = array_merge($pb, ['risk_level' => $pLevel]);
            if (count($payFirst) >= 3) break 2;
        }
    }
    ?>
    <?php if (!empty($payFirst)): ?>
    <div style="margin-bottom:20px;padding:14px 16px;background:rgba(220,38,38,.04);border:1px solid rgba(220,38,38,.1);border-radius:10px">
        <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;display:flex;align-items:center;gap:6px">
            <?= tf_icon('zap', 12) ?> Recommended Payment Order
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
        <?php foreach ($payFirst as $pfi => $pf):
            $pfColor = $pf['risk_level'] === 'critical' ? '#dc2626' : ($pf['risk_level'] === 'high' ? '#f59e0b' : '#3b82f6');
            $pfLabel = strtoupper($pf['risk_level']);
        ?>
        <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(255,255,255,.03);border-radius:7px;border:1px solid rgba(255,255,255,.05)">
            <span style="width:18px;height:18px;border-radius:50%;background:<?= $pfColor ?>;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0"><?= $pfi+1 ?></span>
            <div style="flex:1;min-width:0">
                <div style="font-size:12px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><?= e($pf['vendor'] ?: $pf['title']) ?></div>
                <div style="font-size:10px;color:#64748b"><?= e($pf['store_name'] ?? '') ?></div>
            </div>
            <?php if (!empty($pf['amount'])): ?>
            <div style="font-size:13px;font-weight:700;color:#f1f5f9">$<?= number_format((float)$pf['amount'], 0) ?></div>
            <?php endif; ?>
            <span style="font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;background:<?= $pfColor ?>18;color:<?= $pfColor ?>;letter-spacing:.05em"><?= $pfLabel ?></span>
        </div>
        <?php endforeach; ?>
        </div>
    </div>
    <?php endif; ?>
    <div class="cc-finance-grid">

        <!-- Sub-panel 1: Cash Timeline -->
        <div>
            <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;display:flex;align-items:center;gap:6px">
                <?= tf_icon('clock', 12) ?> Cash Timeline
            </div>
            <?php
            $timeline = $ccFinance['cash_timeline'] ?? [];
            $tlItems  = [
                'overdue' => ['label'=>'Overdue',    'color'=>'#dc2626'],
                'today'   => ['label'=>'Today',      'color'=>'#f59e0b'],
                'next7'   => ['label'=>'Next 7 Days','color'=>'#3b82f6'],
                'month'   => ['label'=>'This Month', 'color'=>'#22c55e'],
            ];
            $tlMax = 0;
            foreach ($tlItems as $tlKey => $tlMeta) {
                $v = (float)($timeline[$tlKey]['amount'] ?? 0);
                if ($v > $tlMax) $tlMax = $v;
            }
            ?>
            <div class="cc-cash-timeline">
            <?php foreach ($tlItems as $tlKey => $tlMeta):
                $tlAmt   = (float)($timeline[$tlKey]['amount'] ?? 0);
                $tlCnt   = (int)($timeline[$tlKey]['count']  ?? 0);
                $tlPct   = $tlMax > 0 ? round($tlAmt / $tlMax * 100) : 0;
            ?>
            <div class="cc-cash-row">
                <div class="cc-cash-label" style="color:<?= $tlMeta['color'] ?>"><?= $tlMeta['label'] ?></div>
                <div class="cc-cash-amount">$<?= number_format($tlAmt, 0) ?></div>
                <div class="cc-cash-bar-wrap">
                    <div class="cc-cash-bar-track">
                        <div class="cc-cash-bar-fill" style="width:<?= $tlPct ?>%;background:<?= $tlMeta['color'] ?>"></div>
                    </div>
                </div>
                <div class="cc-cash-count"><?= $tlCnt ?> bills</div>
            </div>
            <?php endforeach; ?>
            </div>
        </div>

        <!-- Sub-panel 2: Payment Risk Board -->
        <div>
            <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;display:flex;align-items:center;gap:6px">
                <?= tf_icon('alert-triangle', 12) ?> Payment Risk Board
            </div>
            <div class="cc-risk-board">
            <?php
            $riskBuckets = $ccFinance['risk_buckets'] ?? [];
            $riskCols    = [
                'critical' => ['color'=>'#dc2626','bg'=>'rgba(220,38,38,.06)'],
                'high'     => ['color'=>'#f59e0b','bg'=>'rgba(245,158,11,.06)'],
                'medium'   => ['color'=>'#3b82f6','bg'=>'rgba(59,130,246,.06)'],
                'low'      => ['color'=>'#22c55e','bg'=>'rgba(34,197,94,.06)'],
            ];
            foreach ($riskCols as $rk => $rStyle):
                $rkBills = $riskBuckets[$rk] ?? [];
                $rkCount = count($rkBills);
            ?>
            <a href="<?= APP_URL ?>/overview/drilldown/finance-bills?risk=<?= $rk ?>" class="dd-risk-badge-link"
               style="flex:1;flex-direction:column;background:<?= $rStyle['bg'] ?>;border:1px solid <?= $rStyle['color'] ?>22;border-radius:8px;padding:12px;text-align:center;min-width:70px">
                <div class="cc-risk-col-label" style="color:<?= $rStyle['color'] ?>"><?= strtoupper($rk) ?></div>
                <div class="cc-risk-col-count" style="color:<?= $rStyle['color'] ?>"><?= $rkCount ?></div>
                <div class="cc-risk-col-sub">bills</div>
                <?php if ($rkCount > 0): ?>
                <div style="margin-top:6px;font-size:9px;color:#3b82f6">View <span class="dd-arrow">→</span></div>
                <?php endif; ?>
            </a>
            <?php endforeach; ?>
            </div>
        </div>

        <!-- Sub-panel 3: Vendor Intelligence -->
        <div>
            <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;display:flex;align-items:center;gap:6px">
                <?= tf_icon('building', 12) ?> Vendor Intelligence
            </div>
            <div class="cc-vendor-list">
            <?php
            $vendors = $ccFinance['vendors'] ?? [];
            foreach (array_slice($vendors, 0, 8) as $vendor):
                $vBill    = $vendor['current_bill'] ?? [];
                $vStatus  = strtoupper($vBill['status'] ?? 'SCHEDULED');
                $vRisk    = $vendor['risk_level'] ?? 'low';
                $vColor   = riskColor($vRisk);
                $vHistory = $vendor['history'] ?? [];
                $vPaid    = (int)($vHistory['paid_count'] ?? 0);
                $vOnTime  = (int)($vHistory['on_time_count'] ?? 0);
                $vBillId  = (int)($vBill['id'] ?? 0);
                $vAmount  = (float)($vBill['amount'] ?? 0);
            ?>
            <div class="cc-vendor-card">
                <div class="cc-vendor-info">
                    <div class="cc-vendor-name"><?= e($vendor['vendor_name'] ?? '') ?></div>
                    <div class="cc-vendor-meta">
                        <?= e($vendor['category'] ?? '') ?> &middot; <?= e($vendor['cycle'] ?? '') ?>
                        &middot; <?= $vOnTime ?>/<?= $vPaid ?> on time
                        <?php if (!empty($vendor['store_name'])): ?>
                        &middot; <?= e($vendor['store_name']) ?>
                        <?php endif; ?>
                    </div>
                </div>
                <span class="cc-vendor-status" style="background:<?= $vColor ?>18;color:<?= $vColor ?>"><?= $vStatus ?></span>
                <?php if ($vAmount > 0): ?>
                <span class="cc-vendor-amount">$<?= number_format($vAmount, 0) ?></span>
                <?php endif; ?>
                <?php if ($vBillId > 0 && $vStatus === 'OVERDUE'): ?>
                <button class="cc-vendor-action cc-pay-btn" style="border-color:rgba(220,38,38,.3);color:#dc2626"
                        data-bill-id="<?= $vBillId ?>"
                        data-vendor="<?= e($vendor['vendor_name'] ?? '') ?>"
                        data-amount="<?= e($vAmount) ?>"
                        data-due="<?= e(date('Y-m-d', strtotime($vBill['due_date'] ?? 'now'))) ?>">
                    Pay Now
                </button>
                <?php elseif ($vBillId > 0): ?>
                <a href="<?= APP_URL ?>/bills/<?= $vBillId ?>" class="cc-vendor-action">View</a>
                <?php endif; ?>
            </div>
            <?php endforeach; ?>
            <?php if (empty($vendors)): ?>
            <div style="text-align:center;padding:24px;color:#475569;font-size:13px">No vendor data available</div>
            <?php endif; ?>
            </div>
        </div>

    </div><!-- /.cc-finance-grid -->
    </div><!-- /.cc-section-body finance -->
</div><!-- /#cc-sec-finance -->


<!-- ════════════════════════════════════════════════════════════════════════════
     SECTION 4 — OPERATIONS: CEO Panel
     ════════════════════════════════════════════════════════════════════════════ -->
<div class="cc-section" id="cc-sec-ops">
    <div class="cc-section-header" onclick="ccToggleSection('cc-sec-ops')">
        <div class="cc-section-title-wrap">
            <span class="cc-section-icon"><?= tf_icon('cpu', 16) ?></span>
            <span class="cc-section-title">Operations — CEO Panel</span>
            <?php
            $opsHealth = $ccOps['health'] ?? [];
            $critPct   = (int)($opsHealth['critical_pct'] ?? 0);
            if ($critPct > 0):
            ?>
            <span class="cc-section-badge" style="background:rgba(220,38,38,.12);color:#dc2626;border-color:rgba(220,38,38,.2)">
                <?= $critPct ?>% critical
            </span>
            <?php endif; ?>
        </div>
        <span class="cc-section-toggle"><?= tf_icon('chevron-down', 16) ?></span>
    </div>
    <div class="cc-section-body">
    <div class="cc-ops-grid">

        <!-- Sub-panel 1: Execution Health Donut -->
        <div>
            <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;display:flex;align-items:center;gap:6px">
                <?= tf_icon('gauge', 12) ?> Execution Health
            </div>
            <?php
            $onTrackPct = (int)($opsHealth['on_track_pct'] ?? 0);
            $atRiskPct  = (int)($opsHealth['at_risk_pct']  ?? 0);
            $critPct2   = (int)($opsHealth['critical_pct'] ?? 0);
            $totalTasks2= (int)($opsHealth['total_tasks']  ?? 0);

            // SVG donut: radius 52, stroke 14
            $r = 52; $sw = 14; $cx = 70; $cy = 70;
            $circ = round(2 * M_PI * $r, 2);
            // segments: on_track, at_risk, critical
            $segs = [
                ['pct'=>$onTrackPct,'color'=>'#22c55e'],
                ['pct'=>$atRiskPct, 'color'=>'#f59e0b'],
                ['pct'=>$critPct2,  'color'=>'#dc2626'],
            ];
            $offset = 0;
            $paths  = [];
            foreach ($segs as $seg) {
                $len = round($seg['pct'] / 100 * $circ, 2);
                $paths[] = [
                    'color'  => $seg['color'],
                    'dash'   => $len . ' ' . ($circ - $len),
                    'offset' => -$offset,
                    'len'    => $len,
                ];
                $offset += $len;
            }
            ?>
            <div class="cc-donut-wrap">
                <svg class="cc-donut-svg" viewBox="0 0 140 140">
                    <!-- Background ring -->
                    <circle cx="<?= $cx ?>" cy="<?= $cy ?>" r="<?= $r ?>"
                            fill="none" stroke="rgba(255,255,255,.06)" stroke-width="<?= $sw ?>"/>
                    <?php foreach ($paths as $path): if ($path['len'] <= 0) continue; ?>
                    <circle cx="<?= $cx ?>" cy="<?= $cy ?>" r="<?= $r ?>"
                            fill="none"
                            stroke="<?= $path['color'] ?>"
                            stroke-width="<?= $sw ?>"
                            stroke-dasharray="<?= $path['dash'] ?>"
                            stroke-dashoffset="<?= $path['offset'] ?>"
                            stroke-linecap="butt"
                            transform="rotate(-90 <?= $cx ?> <?= $cy ?>)"/>
                    <?php endforeach; ?>
                    <!-- Center text -->
                    <text x="<?= $cx ?>" y="<?= $cy - 6 ?>" text-anchor="middle"
                          fill="#f1f5f9" font-size="22" font-weight="800" font-family="inherit">
                        <?= $totalTasks2 ?>
                    </text>
                    <text x="<?= $cx ?>" y="<?= $cy + 10 ?>" text-anchor="middle"
                          fill="#64748b" font-size="10" font-family="inherit">
                        tasks
                    </text>
                </svg>
                <div class="cc-donut-legend">
                    <div class="cc-donut-legend-row">
                        <div class="cc-donut-legend-dot" style="background:#22c55e"></div>
                        On Track
                        <span class="cc-donut-legend-val"><?= $onTrackPct ?>%</span>
                    </div>
                    <div class="cc-donut-legend-row">
                        <div class="cc-donut-legend-dot" style="background:#f59e0b"></div>
                        At Risk
                        <span class="cc-donut-legend-val"><?= $atRiskPct ?>%</span>
                    </div>
                    <div class="cc-donut-legend-row">
                        <div class="cc-donut-legend-dot" style="background:#dc2626"></div>
                        Critical
                        <span class="cc-donut-legend-val"><?= $critPct2 ?>%</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Sub-panel 2: Store Risk Map -->
        <div>
            <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;display:flex;align-items:center;gap:6px">
                <?= tf_icon('building', 12) ?> Store Risk Map
            </div>
            <div class="cc-store-list">
            <?php
            $opsStores = $ccOps['stores'] ?? [];
            foreach ($opsStores as $opsStore):
                $stStatus     = $opsStore['status'] ?? 'on_track';
                $stColor      = match($stStatus) { 'critical'=>'#dc2626','at_risk'=>'#f59e0b',default=>'#22c55e' };
                $stLabel      = match($stStatus) { 'critical'=>'CRITICAL','at_risk'=>'AT RISK',default=>'ON TRACK' };
                $stStoreId    = (int)($opsStore['store_id'] ?? 0);
            ?>
            <div class="cc-store-row" onclick="window.location='<?= APP_URL ?>/overview/store/<?= $stStoreId ?>'">
                <span style="display:flex;color:<?= $stColor ?>"><?= tf_icon('building', 14) ?></span>
                <span class="cc-store-name"><?= e($opsStore['name'] ?? '') ?></span>
                <?php if ((int)($opsStore['overdue'] ?? 0) > 0): ?>
                <span class="cc-store-flag" style="background:rgba(220,38,38,.1);color:#dc2626">
                    <?= (int)$opsStore['overdue'] ?> overdue
                </span>
                <?php endif; ?>
                <?php
                // Revenue impact text based on store status
                $revImpact = '';
                if (($opsStore['status'] ?? '') === 'critical') {
                    $revImpact = 'Revenue delay risk · customer impact likely';
                } elseif (($opsStore['status'] ?? '') === 'at_risk') {
                    $revImpact = 'Revenue delay possible · monitor closely';
                } elseif (($opsStore['revenue_risk'] ?? false)) {
                    $revImpact = $opsStore['overdue'] . ' tasks may affect revenue';
                }
                ?>
                <?php if ($revImpact): ?>
                <div style="font-size:10px;color:#f59e0b;margin-top:2px;display:flex;align-items:center;gap:4px">
                    <?= tf_icon('trending-down', 10) ?> <?= e($revImpact) ?>
                </div>
                <?php endif; ?>
                <?php if (!empty($opsStore['revenue_risk'])): ?>
                <span class="cc-store-flag" style="background:rgba(245,158,11,.1);color:#f59e0b">
                    <?= tf_icon('trending-up', 10) ?> Rev risk
                </span>
                <?php endif; ?>
                <?php if (!empty($opsStore['overloaded'])): ?>
                <span class="cc-store-flag" style="background:rgba(99,102,241,.1);color:#818cf8">
                    <?= tf_icon('users', 10) ?> Overloaded
                </span>
                <?php endif; ?>
                <span class="cc-store-status-badge" style="background:<?= $stColor ?>18;color:<?= $stColor ?>">
                    <?= $stLabel ?>
                </span>
            </div>
            <?php endforeach; ?>
            <?php if (empty($opsStores)): ?>
            <div style="text-align:center;padding:24px;color:#475569;font-size:13px">No store data available</div>
            <?php endif; ?>
            </div>
        </div>

        <!-- Sub-panel 3: Team Load -->
        <div>
            <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;display:flex;align-items:center;gap:6px">
                <?= tf_icon('users', 12) ?> Team Load
            </div>
            <div class="cc-team-list">
            <?php
            $opsTeam = $ccOps['team'] ?? [];
            foreach ($opsTeam as $member):
                $mLoad    = strtoupper($member['load_level'] ?? 'STABLE');
                $mColor   = match($mLoad) { 'CRITICAL'=>'#dc2626','WATCH'=>'#f59e0b',default=>'#22c55e' };
                $mUserId  = (int)($member['user_id'] ?? 0);
                $mName    = $member['name'] ?? '';
                $mOpen    = (int)($member['open_tasks']   ?? 0);
                $mOverdue = (int)($member['overdue_tasks'] ?? 0);
            ?>
            <a class="cc-team-row" href="<?= APP_URL ?>/my-tasks?user=<?= $mUserId ?>">
                <div class="cc-team-avatar">
                    <?= strtoupper(mb_substr($mName, 0, 1)) ?>
                </div>
                <div style="flex:1;min-width:0">
                    <div class="cc-team-name"><?= e($mName) ?></div>
                    <div class="cc-team-stats"><?= $mOpen ?> open &middot; <?= $mOverdue ?> overdue</div>
                </div>
                <span class="cc-team-load-badge" style="background:<?= $mColor ?>18;color:<?= $mColor ?>">
                    <?= $mLoad ?>
                </span>
            </a>
            <?php endforeach; ?>
            <?php if (empty($opsTeam)): ?>
            <div style="text-align:center;padding:24px;color:#475569;font-size:13px">No team data available</div>
            <?php endif; ?>
            </div>
        </div>

    </div><!-- /.cc-ops-grid -->
    </div><!-- /.cc-section-body ops -->
</div><!-- /#cc-sec-ops -->


<!-- ════════════════════════════════════════════════════════════════════════════
     SECTION 5 — COMPLIANCE CALENDAR
     ════════════════════════════════════════════════════════════════════════════ -->
<div class="cc-section" id="cc-sec-compliance">
    <div class="cc-section-header" onclick="ccToggleSection('cc-sec-compliance')">
        <div class="cc-section-title-wrap">
            <span class="cc-section-icon"><?= tf_icon('shield-alert', 16) ?></span>
            <span class="cc-section-title">Compliance Calendar</span>
            <?php
            $compOverdueCount = count($ccCompliance['overdue'] ?? []);
            if ($compOverdueCount > 0):
            ?>
            <span class="cc-section-badge" style="background:rgba(220,38,38,.12);color:#dc2626;border-color:rgba(220,38,38,.2)">
                <?= $compOverdueCount ?> overdue
            </span>
            <?php endif; ?>
            <?php
            $compRiskScore = (int)($ccCompliance['risk_score'] ?? 0);
            $compRiskLevel = strtoupper($ccCompliance['risk_level'] ?? 'low');
            $compRiskColor2= riskColor(strtolower($compRiskLevel));
            ?>
            <span class="cc-section-badge" style="background:<?= $compRiskColor2 ?>18;color:<?= $compRiskColor2 ?>;border-color:<?= $compRiskColor2 ?>22">
                Risk: <?= $compRiskScore ?> <?= $compRiskLevel ?>
            </span>
        </div>
        <span class="cc-section-toggle"><?= tf_icon('chevron-down', 16) ?></span>
    </div>
    <div class="cc-section-body">

    <?php
    $compOverdue   = $ccCompliance['overdue']   ?? [];
    $compCalendar  = $ccCompliance['calendar']  ?? [];
    // Deduplicate: calendar already contains overdue items; merge by id to avoid doubles
    $compMerged = [];
    foreach (array_merge($compOverdue, $compCalendar) as $ci) {
        $compMerged[$ci['id']] = $ci;
    }
    $compAllItems = array_values($compMerged);
    // Sort: overdue first (days_until < 0), then ascending
    usort($compAllItems, fn($a,$b) => ($a['days_until'] ?? 0) <=> ($b['days_until'] ?? 0));
    ?>

    <?php if (empty($compAllItems)): ?>
    <div style="text-align:center;padding:32px;color:#475569;font-size:13px">
        <?= tf_icon('check-circle', 20) ?> No compliance items found
    </div>
    <?php else: ?>
    <?php
    // Map category → consequence (defined once before the loop)
    $compConsequences = [
        'tax'      => 'Penalty + interest if late · possible audit trigger',
        'payroll'  => 'Payroll tax penalty · employee withholding violation',
        'utilities'=> 'Service suspension · late reconnection fee',
        'insurance'=> 'Coverage lapse · legal liability exposure',
        'rent'     => 'Late fee · lease violation · eviction risk',
        'general'  => 'Vendor relationship risk · service disruption',
    ];
    ?>
    <div class="cc-compliance-list">
    <?php foreach ($compAllItems as $compItem):
        $ciId       = (int)($compItem['id']        ?? 0);
        $ciTitle    = $compItem['title']            ?? '';
        $ciVendor   = $compItem['vendor']           ?? '';
        $ciDueDate  = $compItem['due_date']         ?? '';
        $ciDaysUntil= (int)($compItem['days_until'] ?? 0);
        $ciStatus   = $compItem['status']           ?? '';
        $ciRisk     = $compItem['risk_level']       ?? 'low';
        $ciStore    = $compItem['store_name']       ?? '';
        $ciAmount   = $compItem['amount']           ?? null;
        $ciCategory = $compItem['category']         ?? '';
        $ciIsOverdue= $ciDaysUntil < 0 || strtolower($ciStatus) === 'overdue';
        $ciColor    = $ciIsOverdue ? '#dc2626' : riskColor($ciRisk);
        $ciDayLabel = $ciIsOverdue
            ? abs($ciDaysUntil) . 'd overdue'
            : ($ciDaysUntil === 0 ? 'Today' : 'in ' . $ciDaysUntil . 'd');
    ?>
    <div class="cc-comp-row" style="<?= $ciIsOverdue ? 'background:rgba(220,38,38,.03);border-color:rgba(220,38,38,.12)' : '' ?>">
        <div class="cc-comp-row-top">
            <span style="display:flex;flex-shrink:0;color:<?= $ciColor ?>"><?= tf_icon('shield-alert', 13) ?></span>
            <span class="cc-comp-title"><?= e($ciTitle) ?></span>
            <span class="cc-comp-vendor">
                <?= e($ciVendor) ?><?php if ($ciStore): ?> &middot; <?= e($ciStore) ?><?php endif; ?><?php if ($ciCategory): ?> &middot; <?= e($ciCategory) ?><?php endif; ?>
            </span>
        </div>
        <div class="cc-comp-row-bottom">
            <?php if ($ciDueDate): ?>
            <span class="cc-comp-due"><?= date('d M Y', strtotime($ciDueDate)) ?></span>
            <?php endif; ?>
            <span class="cc-comp-days" style="background:<?= $ciColor ?>18;color:<?= $ciColor ?>">
                <?= e($ciDayLabel) ?>
            </span>
            <span class="cc-comp-risk" style="background:<?= $ciColor ?>18;color:<?= $ciColor ?>">
                <?= strtoupper($ciRisk) ?>
            </span>
            <?php if ($ciAmount !== null && $ciAmount > 0): ?>
            <span style="font-size:12px;font-weight:700;color:#f1f5f9;white-space:nowrap">$<?= number_format((float)$ciAmount, 0) ?></span>
            <?php endif; ?>
            <?php
            $compConseq = $compConsequences[$ciCategory] ?? 'Penalty + compliance risk';
            ?>
            <span style="font-size:10px;color:#64748b;font-style:italic;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><?= e($compConseq) ?></span>
            <div class="cc-comp-actions">
                <?php if ($ciIsOverdue): ?>
                <button class="cc-comp-btn cc-comp-btn-danger cc-file-btn"
                        data-item-id="<?= $ciId ?>"
                        data-title="<?= e($ciTitle) ?>">
                    <?= tf_icon('zap', 11) ?> File Now
                </button>
                <?php endif; ?>
                <a href="<?= APP_URL ?>/bills" class="cc-comp-btn">Upload Docs</a>
            </div>
        </div>
    </div>
    <?php endforeach; ?>
    </div>
    <?php endif; ?>

    </div><!-- /.cc-section-body compliance -->
</div><!-- /#cc-sec-compliance -->


<!-- ════════════════════════════════════════════════════════════════════════════
     LEGACY: Decision Matrix (preserved if controller passes $comparedProblems)
     ════════════════════════════════════════════════════════════════════════════ -->
<?php if (!empty($comparedProblems) && count($comparedProblems) >= 2): ?>
<div class="cc-section" id="cc-sec-matrix">
    <div class="cc-section-header" onclick="ccToggleSection('cc-sec-matrix')">
        <div class="cc-section-title-wrap">
            <span class="cc-section-icon"><?= tf_icon('trending-up', 16) ?></span>
            <span class="cc-section-title">Decision Matrix</span>
            <span class="cc-section-badge"><?= count($comparedProblems) ?> items</span>
        </div>
        <span class="cc-section-toggle"><?= tf_icon('chevron-down', 16) ?></span>
    </div>
    <div class="cc-section-body" style="padding:0">
    <?php $topItem = $comparedProblems[0]; ?>
    <div style="display:flex;align-items:center;gap:10px;padding:14px 20px;background:rgba(34,197,94,.04);border-bottom:1px solid rgba(34,197,94,.08)">
        <span style="flex-shrink:0;color:<?= $topItem['color'] ?? '#22c55e' ?>;display:flex"><?= tf_icon($topItem['icon'] ?? 'arrow-right-circle', 20) ?></span>
        <div style="flex:1;min-width:0">
            <div style="font-size:11px;color:#86efac;font-weight:700;letter-spacing:.06em">DO THIS FIRST</div>
            <div style="font-size:13px;color:#f1f5f9;font-weight:600;margin-top:1px"><?= e($topItem['action_desc']) ?></div>
        </div>
        <div style="flex-shrink:0;text-align:right">
            <div style="font-size:18px;font-weight:800;color:#22c55e"><?= round($topItem['total_score'] * 100) ?><span style="font-size:11px;font-weight:500;color:#64748b">pts</span></div>
        </div>
        <a href="<?= e($topItem['action_url']) ?>" style="flex-shrink:0;font-size:11px;font-weight:700;color:#22c55e;text-decoration:none;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);padding:6px 14px;border-radius:7px;white-space:nowrap"><?= e($topItem['action_label']) ?> →</a>
    </div>
    <?php foreach ($comparedProblems as $ci => $cp):
        $recColor = $cp['recommendation_color'] ?? '#94a3b8';
        $isBest   = $ci === 0;
    ?>
    <div style="display:flex;align-items:center;gap:12px;padding:10px 20px;border-bottom:1px solid rgba(51,65,85,.35);background:<?= $isBest ? 'rgba(34,197,94,.03)' : 'transparent' ?>">
        <div style="width:22px;height:22px;border-radius:50%;background:<?= $recColor ?>;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#0f172a;flex-shrink:0"><?= $cp['priority_order'] ?></div>
        <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:<?= $isBest ? '#f1f5f9' : '#94a3b8' ?>"><?= e($cp['title']) ?></div>
            <div style="font-size:10px;color:#475569"><?= e($cp['action_desc']) ?></div>
        </div>
        <div style="font-size:15px;font-weight:800;color:<?= $recColor ?>"><?= round($cp['total_score'] * 100) ?><span style="font-size:9px;color:#475569">pts</span></div>
        <a href="<?= e($cp['action_url']) ?>" style="font-size:10px;color:#60a5fa;text-decoration:none;padding:3px 8px;border:1px solid rgba(96,165,250,.25);border-radius:5px">Go →</a>
    </div>
    <?php endforeach; ?>
    </div>
</div>
<?php endif; ?>


<!-- ════════════════════════════════════════════════════════════════════════════
     LEGACY: Quick Win strip
     ════════════════════════════════════════════════════════════════════════════ -->
<?php if (!empty($decisionQuickWin)): ?>
<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;background:rgba(34,197,94,.05);border:1px solid rgba(34,197,94,.15);border-radius:10px;font-size:12px">
    <span style="flex-shrink:0;color:#22c55e;display:flex"><?= tf_icon('zap', 15) ?></span>
    <div style="flex:1;min-width:0">
        <span style="color:#86efac;font-weight:700">Quick Win: </span>
        <span style="color:#d1d5db"><?= e($decisionQuickWin['title']) ?></span>
        <?php if (!empty($decisionQuickWin['confidence_pct'])): ?>
        <span style="margin-left:8px;font-size:10px;color:#22c55e;font-weight:700;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.2);padding:1px 6px;border-radius:10px"><?= (int)$decisionQuickWin['confidence_pct'] ?>% conf</span>
        <?php endif; ?>
    </div>
    <a href="<?= e($decisionQuickWin['url']) ?>" style="flex-shrink:0;font-size:11px;font-weight:700;color:#22c55e;text-decoration:none;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.2);padding:5px 12px;border-radius:6px;white-space:nowrap">Go →</a>
</div>
<?php endif; ?>

</div><!-- /.cc-root -->


<!-- ════════════════════════════════════════════════════════════════════════════
     QUICK-PAY MODAL
     ════════════════════════════════════════════════════════════════════════════ -->
<?php $ccPayVerifierUsers = (new User())->getActive(); ?>
<div class="cc-modal-overlay" id="ccPayModal">
    <div class="cc-modal">
        <div class="cc-modal-title"><?= tf_icon('wallet', 16) ?> Confirm Payment</div>
        <div class="cc-modal-sub">Review before submitting payment</div>
        <div class="cc-modal-detail-row">
            <span>Vendor / Bill</span>
            <span class="cc-modal-detail-val" id="ccPayModalVendor">—</span>
        </div>
        <div class="cc-modal-detail-row">
            <span>Amount</span>
            <span class="cc-modal-detail-val" id="ccPayModalAmount">—</span>
        </div>
        <div class="cc-modal-detail-row">
            <span>Due Date</span>
            <span class="cc-modal-detail-val" id="ccPayModalDue">—</span>
        </div>
        <label style="display:block;margin-top:12px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase">Verifier</label>
        <select id="ccPayVerifier" style="width:100%;margin-top:6px;background:#0f172a;color:#f8fafc;border:1px solid rgba(148,163,184,.3);border-radius:8px;padding:9px 10px;font-size:13px">
            <option value="">--</option>
            <?php foreach ($ccPayVerifierUsers as $u): ?>
                <option value="<?= (int)$u['id'] ?>"><?= e($u['name']) ?><?= !empty($u['role']) ? ' (' . e($u['role']) . ')' : '' ?></option>
            <?php endforeach; ?>
        </select>
        <div class="cc-modal-footer">
            <button class="cc-modal-btn-cancel" onclick="ccClosePayModal()">Cancel</button>
            <button class="cc-modal-btn-confirm" id="ccPayModalBtn" onclick="ccSubmitPay()">
                <?= tf_icon('wallet', 14) ?> Pay Now
            </button>
        </div>
        <div id="ccNextAction" style="display:none;margin-top:12px"></div>
    </div>
</div>


<!-- ════════════════════════════════════════════════════════════════════════════
     BILL RISK DRAWER
     ════════════════════════════════════════════════════════════════════════════ -->
<div class="cc-drawer-overlay" id="ccBillDrawerOverlay" onclick="if(event.target===this)ccCloseBillDrawer()">
    <div class="cc-drawer" id="ccBillDrawer">
        <div class="cc-drawer-header">
            <div class="cc-drawer-title" id="ccBillDrawerTitle">Bills</div>
            <button class="cc-drawer-close" onclick="ccCloseBillDrawer()"><?= tf_icon('x', 14) ?></button>
        </div>
        <div class="cc-drawer-body" id="ccBillDrawerBody">
            <p style="color:#64748b;text-align:center;padding:32px">Select a risk column to view bills</p>
        </div>
    </div>
</div>


<!-- ════════════════════════════════════════════════════════════════════════════
     LEGACY DRILL-DOWN DRAWER (category matrix)
     ════════════════════════════════════════════════════════════════════════════ -->
<?php if ($isManagerOrAdmin): ?>
<div class="ov-drawer-overlay" id="drillDownOverlay" onclick="if(event.target===this)closeDrillDown()">
    <div class="ov-drawer" id="drillDownPanel">
        <div class="ov-drawer-header">
            <div>
                <div class="ov-drawer-title"  id="drillDownTitle">Category Detail</div>
                <div class="ov-drawer-subtitle" id="drillDownSubtitle"></div>
            </div>
            <button class="btn-ghost" onclick="closeDrillDown()">&#10005;</button>
        </div>
        <div class="ov-drawer-body" id="drillDownBody">
            <p style="color:var(--text-muted);text-align:center;padding:32px"><?= e(t('common.loading')) ?></p>
        </div>
    </div>
</div>
<?php endif; ?>


<script>
// ── Command Center: section toggle ────────────────────────────────────────────
function ccToggleSection(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('collapsed');
    try { localStorage.setItem('cc_sec_' + id, el.classList.contains('collapsed') ? '0' : '1'); } catch(e){}
}
// Restore section state. CEO screen starts with the decision layer open and
// deeper analysis collapsed unless the user intentionally opens it.
(function() {
    ['cc-sec-finance','cc-sec-ops','cc-sec-compliance','cc-sec-matrix','cc-sec-obligations'].forEach(function(id) {
        try {
            var stored = localStorage.getItem('cc_sec_' + id);
            var el = document.getElementById(id);
            if (!el) return;
            if (stored === '1') el.classList.remove('collapsed');
            else el.classList.add('collapsed');
        } catch(e){}
    });
    try {
        var decStored = localStorage.getItem('cc_sec_cc-sec-decisions');
        var dec = document.getElementById('cc-sec-decisions');
        if (dec && decStored === '0') dec.classList.add('collapsed');
    } catch(e){}
})();

// ── Quick-Pay Modal ────────────────────────────────────────────────────────────
var _ccPayBillId    = null;
var _ccPayBillTitle = null;

function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function ccOpenPayModal(billId, vendor, amount, dueDate) {
    _ccPayBillId    = billId;
    _ccPayBillTitle = vendor || '';
    document.getElementById('ccPayModalVendor').textContent  = vendor || '\u2014';
    document.getElementById('ccPayModalAmount').textContent  = amount ? '$' + parseFloat(amount).toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2}) : '\u2014';
    document.getElementById('ccPayModalDue').textContent     = dueDate || '\u2014';
    var btn = document.getElementById('ccPayModalBtn');
    btn.disabled    = false;
    btn.textContent = 'Pay Now';
    // Reset next-action strip
    var na = document.getElementById('ccNextAction');
    if (na) { na.style.display = 'none'; na.innerHTML = ''; }
    var verifier = document.getElementById('ccPayVerifier');
    if (verifier) verifier.value = '';
    document.getElementById('ccPayModal').classList.add('active');
}

function ccClosePayModal() {
    document.getElementById('ccPayModal').classList.remove('active');
    _ccPayBillId    = null;
    _ccPayBillTitle = null;
}

function ccSubmitPay() {
    if (!_ccPayBillId) return;
    var btn       = document.getElementById('ccPayModalBtn');
    var paidTitle = _ccPayBillTitle || '';
    btn.disabled    = true;
    btn.textContent = 'Processing\u2026';

    fetch(window.APP_URL + '/bills/' + _ccPayBillId + '/pay', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-Token': window.CSRF_TOKEN || ''
        },
        credentials: 'same-origin',
        body: JSON.stringify({
            bill_id: _ccPayBillId,
            _token: window.CSRF_TOKEN,
            verifier_user_id: (document.getElementById('ccPayVerifier') || {}).value || ''
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data && data.success) {
            ccClosePayModal();
            ccShowNextAction(paidTitle);
            // Reload to refresh KPIs after a brief delay so banner is visible
            setTimeout(function() { window.location.reload(); }, 3500);
        } else {
            btn.disabled    = false;
            btn.textContent = 'Pay Now';
            alert(data && data.message ? data.message : 'Payment could not be processed. Please try again.');
        }
    })
    .catch(function() {
        btn.disabled    = false;
        btn.textContent = 'Pay Now';
        alert('Network error. Please try again.');
    });
}

// ── Gap 2: Next Decision Flow (post-payment) ──────────────────────────────────
async function ccShowNextAction(paidTitle) {
    try {
        var r = await fetch(window.APP_URL + '/api/decision/next', { credentials: 'same-origin' });
        var d = await r.json();
        if (d && d.decision) {
            var next = d.decision;
            var el   = document.getElementById('ccNextAction');
            if (!el) return;
            el.innerHTML =
                '<div class="cc-next-action-banner">'
                + '<span style="color:#22c55e;display:flex"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>'
                + '<div>'
                + '<div style="font-size:12px;font-weight:700;color:#22c55e">' + escHtml(paidTitle) + ' paid \u2014 Risk reduced</div>'
                + '<div style="font-size:11px;color:#94a3b8;margin-top:2px">'
                +   'Next: <strong style="color:#f1f5f9">' + escHtml(next.title || '') + '</strong>'
                +   '<span style="color:#64748b"> \u00b7 Impact ' + escHtml(String(next.impact_score || '')) + '</span>'
                + '</div>'
                + '</div>'
                + '<a href="' + escHtml(window.APP_URL + '/team') + '" class="cc-comp-btn" style="margin-left:auto">Review \u2192</a>'
                + '</div>';
            el.style.display = 'block';
        }
    } catch(e) {}
}

// Event delegation for Pay Now and File Now buttons
document.addEventListener('click', function(e) {
    var payBtn = e.target.closest('.cc-pay-btn');
    if (payBtn) {
        ccOpenPayModal(
            parseInt(payBtn.dataset.billId) || 0,
            payBtn.dataset.vendor || '',
            parseFloat(payBtn.dataset.amount) || 0,
            payBtn.dataset.due || ''
        );
        return;
    }
    var fileBtn = e.target.closest('.cc-file-btn');
    if (fileBtn) {
        ccComplianceFileNow(
            parseInt(fileBtn.dataset.itemId) || 0,
            fileBtn.dataset.title || ''
        );
        return;
    }
});

// Close modal on overlay click
var _ccPayModalEl = document.getElementById('ccPayModal');
if (_ccPayModalEl) {
    _ccPayModalEl.addEventListener('click', function(e) {
        if (e.target === this) ccClosePayModal();
    });
}

// ── Bill Risk Drawer ───────────────────────────────────────────────────────────
var _riskColorMap = {
    critical: '#dc2626',
    high:     '#f59e0b',
    medium:   '#3b82f6',
    low:      '#22c55e'
};

function ccOpenBillDrawer(riskLevel, bills) {
    var overlay = document.getElementById('ccBillDrawerOverlay');
    var title   = document.getElementById('ccBillDrawerTitle');
    var body    = document.getElementById('ccBillDrawerBody');
    var color   = _riskColorMap[riskLevel] || '#94a3b8';

    title.textContent = riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1) + ' Risk Bills (' + bills.length + ')';

    if (!bills || bills.length === 0) {
        body.innerHTML = '<p style="color:#64748b;text-align:center;padding:32px">No bills in this category</p>';
    } else {
        var html = '';
        bills.forEach(function(bill) {
            var daysOv = parseInt(bill.days_overdue) || 0;
            html += '<div class="cc-drawer-bill-row">'
                + '<div class="cc-drawer-bill-title">' + esc(bill.title || bill.vendor || 'Bill #' + bill.id) + '</div>'
                + '<div class="cc-drawer-bill-meta">'
                +   esc(bill.vendor || '') + (bill.store_name ? ' &middot; ' + esc(bill.store_name) : '')
                +   (bill.due_date ? ' &middot; Due: ' + bill.due_date : '')
                + '</div>'
                + '<div class="cc-drawer-bill-footer">'
                +   '<span class="cc-drawer-bill-amount" style="color:' + color + '">$' + parseFloat(bill.amount || 0).toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2}) + '</span>'
                +   (daysOv > 0 ? '<span style="font-size:10px;color:#dc2626;font-weight:700">' + daysOv + 'd overdue</span>' : '')
                +   '<div style="display:flex;gap:5px">'
                +     '<a href="' + window.APP_URL + '/bills/' + bill.id + '" style="font-size:11px;color:#60a5fa;text-decoration:none;padding:3px 8px;border:1px solid rgba(96,165,250,.25);border-radius:5px">View</a>'
                +     (bill.status !== 'paid' ? '<button onclick="ccOpenPayModal(' + bill.id + ',' + JSON.stringify(bill.vendor || '') + ',' + JSON.stringify(bill.amount || 0) + ',' + JSON.stringify(bill.due_date || '') + ')" style="font-size:11px;color:#dc2626;cursor:pointer;padding:3px 8px;border:1px solid rgba(220,38,38,.3);border-radius:5px;background:rgba(220,38,38,.06)">Pay</button>' : '')
                +   '</div>'
                + '</div>'
                + '</div>';
        });
        body.innerHTML = html;
    }

    overlay.classList.add('active');
}

function ccCloseBillDrawer() {
    document.getElementById('ccBillDrawerOverlay').classList.remove('active');
}

// ── Compliance: File Now ───────────────────────────────────────────────────────
// Marks the bill as completed via the bill workflow endpoint, then reloads.
function ccComplianceFileNow(itemId, title) {
    if (!confirm('Mark "' + title + '" as filed/completed?')) return;
    var csrfMeta = document.querySelector('meta[name="csrf-token"]');
    var csrf = (window.CSRF_TOKEN || (csrfMeta ? csrfMeta.getAttribute('content') : ''));
    fetch(window.APP_URL + '/bills/' + itemId + '/workflow/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
        body: 'csrf=' + encodeURIComponent(csrf) + '&note=Filed+via+Compliance+Calendar'
    })
    .then(function(r) { return r.json().catch(function() { return {success: r.ok}; }); })
    .then(function(d) {
        if (d && (d.success || d.workflow_status)) {
            window.location.reload();
        } else {
            // Fallback: open bills page so user can act manually
            window.location.href = window.APP_URL + '/bills';
        }
    })
    .catch(function() { window.location.href = window.APP_URL + '/bills'; });
}

// ── Rebalance signal (preserved) ──────────────────────────────────────────────
(function() {
    fetch(window.APP_URL + '/api/team/rebalance-status', {credentials: 'same-origin'})
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(sig) {
            if (!sig || !sig.has_rebalance) return;
            var section = document.querySelector('.cc-root');
            if (!section) return;
            var card = document.createElement('div');
            card.id  = 'rbRebalancedBanner';
            card.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 16px;background:rgba(34,197,94,.05);border:1px solid rgba(34,197,94,.15);border-radius:10px;font-size:12px;margin-bottom:8px';
            card.innerHTML =
                '<span style="flex-shrink:0;color:#22c55e;display:flex"><?= tf_icon('check-circle', 15) ?></span>'
                + '<div style="flex:1"><span style="color:#86efac;font-weight:700">Workload Rebalanced — </span>'
                + '<span style="color:#9ca3af">' + (sig.moved || 0) + ' tasks moved</span></div>'
                + '<button onclick="document.getElementById(\'rbRebalancedBanner\').remove()" style="background:none;border:none;color:#4b5563;cursor:pointer;font-size:14px"><?= tf_icon('x', 13) ?></button>';
            section.insertBefore(card, section.firstChild);
            setTimeout(function() {
                var b = document.getElementById('rbRebalancedBanner');
                if (b) { b.style.transition='opacity .5s'; b.style.opacity='0'; setTimeout(function(){ if(b&&b.parentNode)b.parentNode.removeChild(b); },550); }
            }, 20000);
        })
        .catch(function(){});
})();

// ── Legacy drill-down (category matrix) ──────────────────────────────────────
<?php if ($isManagerOrAdmin && !empty($categoryMatrix)): ?>
const DRILL_DATA = <?php
$drillAll = [];
foreach ($categoryMatrix as $row) {
    foreach (['recurring','payroll','tax','rent','receipts','other'] as $ck) {
        $cat = $row['cats'][$ck] ?? ['tasks'=>[]];
        $drillAll[$row['store_id'].'|'.$ck] = $cat['tasks'] ?? [];
    }
}
echo json_encode($drillAll, JSON_HEX_TAG | JSON_UNESCAPED_UNICODE);
?>;

function openDrillDown(storeId, catKey, storeName, catName) {
    var key   = storeId + '|' + catKey;
    var tasks = DRILL_DATA[key] || [];
    var today = '<?= $today ?>';
    document.getElementById('drillDownTitle').textContent    = catName;
    document.getElementById('drillDownSubtitle').textContent = storeName + ' · ' + tasks.length + ' tasks';
    if (tasks.length === 0) {
        document.getElementById('drillDownBody').innerHTML =
            '<div style="text-align:center;padding:32px;color:var(--text-muted)"><?= e(t('task.no_tasks')) ?></div>';
    } else {
        var priColors = {urgent:'#dc2626',high:'#f59e0b',medium:'#3b82f6',low:'#71717a'};
        var dueFmt2   = '<?= date('Y-m-d', strtotime('+2 days')) ?>';
        var rows = tasks.map(function(t) {
            var isOv       = !t.is_completed && t.due_date && t.due_date < today;
            var dueClass   = isOv ? 'due-overdue' : (t.due_date && t.due_date <= dueFmt2 && !t.is_completed ? 'due-today' : 'text-muted');
            var statusBadge= t.is_completed
                ? '<span class="badge badge-active"><?= e(t('task.status_done')) ?></span>'
                : (t.status === 'in_progress'
                    ? '<span class="badge badge-member"><?= e(t('task.status_in_progress')) ?></span>'
                    : '<span class="badge badge-active"><?= e(t('task.status_todo')) ?></span>');
            var taskUrl = '<?= APP_URL ?>/tasks/' + t.id;
            return '<tr class="ov-drill-row ' + (isOv ? 'row-overdue' : '') + '" onclick="window.location=\'' + taskUrl.replace(/'/g,"\\'") + '\'" style="cursor:pointer">'
                + '<td><div style="width:3px;height:30px;background:' + (priColors[t.priority]||'#3b82f6') + ';border-radius:2px"></div></td>'
                + '<td><a href="' + taskUrl + '" class="ov-task-link" onclick="event.stopPropagation()">' + esc(t.title || t.project_name || '(no title)') + '</a>'
                + (t.project_name ? '<br><span class="text-sm text-muted">' + esc(t.project_name) + '</span>' : '') + '</td>'
                + '<td class="text-sm text-muted">' + esc(t.assignee_name || '<?= e(t('task.unassigned')) ?>') + '</td>'
                + '<td class="text-sm ' + dueClass + '">' + (t.due_date ? t.due_date.split('-').reverse().join('/') : '—') + (isOv ? ' ⚠' : '') + '</td>'
                + '<td>' + statusBadge + '</td>'
                + '</tr>';
        }).join('');
        document.getElementById('drillDownBody').innerHTML =
            '<table class="ov-outstanding-table"><thead><tr>'
            + '<th style="width:4px"></th><th><?= e(t('tasks.task')) ?></th>'
            + '<th><?= e(t('task.assignee_label')) ?></th>'
            + '<th><?= e(t('tasks.due')) ?></th>'
            + '<th><?= e(t('tasks.status')) ?></th>'
            + '</tr></thead><tbody>' + rows + '</tbody></table>';
    }
    document.getElementById('drillDownOverlay').classList.add('active');
}

function closeDrillDown() {
    document.getElementById('drillDownOverlay').classList.remove('active');
}
<?php else: ?>
function openDrillDown() {}
function closeDrillDown() {}
<?php endif; ?>

function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Legacy toggle stubs (in case any old code calls these)
function toggleFullOverview() {}

// Penalty period toggle (Week / This Month / Year)
function penSwitchPeriod(period) {
    document.querySelectorAll('.pen-tab-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.period === period);
    });
    document.querySelectorAll('.pen-panel').forEach(function(p) { p.style.display = 'none'; });
    var panel = document.getElementById('pen-panel-' + period);
    if (panel) panel.style.display = 'block';
}
function toggleDecisionMatrix() {}
function filterStoreGroup() {}
function toggleStoreGroup() {}
</script>

<?php
$content = ob_get_clean(); // layout uses $content, not $pageContent
require __DIR__ . '/../layouts/main.php';
