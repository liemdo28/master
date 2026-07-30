<?php
/**
 * Phase 11.5 — Module 6: Executive Digest
 * Auto-generated morning briefing shown in Control Tower
 */
$digestDb = Database::getInstance();
$digestToday = function_exists('app_today') ? app_today() : date('Y-m-d');

// Gather digest data
$digestData = [];

// Risks: overdue tasks
try {
    $overdueCount = $digestDb->fetch("SELECT COUNT(*) as cnt FROM tasks WHERE is_completed=0 AND due_date < ? AND status != 'completed'", [$digestToday]);
    $digestData['risks'] = (int)($overdueCount['cnt'] ?? 0);
} catch (\Throwable $e) { $digestData['risks'] = 0; }

// Incidents: open
try {
    $openIncidents = $digestDb->fetch("SELECT COUNT(*) as cnt FROM incidents WHERE status IN ('open','reported','investigating')");
    $digestData['incidents'] = (int)($openIncidents['cnt'] ?? 0);
} catch (\Throwable $e) { $digestData['incidents'] = 0; }

// Releases: pending
try {
    $pendingReleases = $digestDb->fetch("SELECT COUNT(*) as cnt FROM releases WHERE status IN ('draft','preview','review','ready_for_review','qa_running','qa_passed','approved','scheduled','changes_requested')");
    $digestData['releases'] = (int)($pendingReleases['cnt'] ?? 0);
} catch (\Throwable $e) { $digestData['releases'] = 0; }

// Store health: checklists today
try {
    $checklistsToday = $digestDb->fetch("SELECT COUNT(*) as cnt FROM store_checklists WHERE DATE(created_at) = ?", [$digestToday]);
    $digestData['store_health'] = (int)($checklistsToday['cnt'] ?? 0);
} catch (\Throwable $e) { $digestData['store_health'] = 0; }

// Tasks due today
try {
    $dueToday = $digestDb->fetch("SELECT COUNT(*) as cnt FROM tasks WHERE is_completed=0 AND due_date = ?", [$digestToday]);
    $digestData['action_required'] = (int)($dueToday['cnt'] ?? 0);
} catch (\Throwable $e) { $digestData['action_required'] = 0; }

$digestLists = [
    'risks' => [],
    'incidents' => [],
    'releases' => [],
    'store_health' => [],
    'action_required' => [],
];

try {
    $digestLists['risks'] = $digestDb->fetchAll(
        "SELECT t.id, t.title, t.due_date, t.priority, t.status,
                COALESCE(u.name, 'Needs owner') AS assignee_name,
                COALESCE(p.name, 'No project') AS project_name,
                COALESCE(s.name, '') AS store_name
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN stores s ON s.id = COALESCE(t.direct_store_id, p.store_id)
         WHERE t.is_completed=0 AND t.due_date < ? AND t.status NOT IN ('completed','cancelled')
         ORDER BY t.due_date ASC, FIELD(t.priority,'urgent','critical','high','medium','low'), t.title ASC
         LIMIT 80",
        [$digestToday]
    ) ?: [];
} catch (\Throwable $e) { $digestLists['risks'] = []; }

try {
    $digestLists['action_required'] = $digestDb->fetchAll(
        "SELECT t.id, t.title, t.due_date, t.priority, t.status,
                COALESCE(u.name, 'Needs owner') AS assignee_name,
                COALESCE(p.name, 'No project') AS project_name,
                COALESCE(s.name, '') AS store_name
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN stores s ON s.id = COALESCE(t.direct_store_id, p.store_id)
         WHERE t.is_completed=0 AND t.due_date = ? AND t.status NOT IN ('completed','cancelled')
         ORDER BY FIELD(t.priority,'urgent','critical','high','medium','low'), t.title ASC
         LIMIT 80",
        [$digestToday]
    ) ?: [];
} catch (\Throwable $e) { $digestLists['action_required'] = []; }

try {
    if ($digestDb->tableExists('incidents')) {
        $digestLists['incidents'] = $digestDb->fetchAll(
            "SELECT i.id, i.title, i.status, i.severity, i.category, i.created_at,
                    COALESCE(s.name, '') AS store_name
             FROM incidents i
             LEFT JOIN stores s ON s.id = i.store_id
             WHERE i.status IN ('open','reported','investigating')
             ORDER BY FIELD(i.severity,'critical','high','medium','low'), i.created_at DESC
             LIMIT 50"
        ) ?: [];
    }
} catch (\Throwable $e) { $digestLists['incidents'] = []; }

try {
    if ($digestDb->tableExists('releases')) {
        $digestLists['releases'] = $digestDb->fetchAll(
            "SELECT id, name, version, status, scheduled_at, created_at
             FROM releases
             WHERE status IN ('draft','preview','review','ready_for_review','qa_running','qa_passed','approved','scheduled','changes_requested')
             ORDER BY created_at DESC
             LIMIT 50"
        ) ?: [];
    }
} catch (\Throwable $e) { $digestLists['releases'] = []; }

try {
    if ($digestDb->tableExists('store_checklists')) {
        $digestLists['store_health'] = $digestDb->fetchAll(
            "SELECT sc.id, sc.type, sc.opened_at, sc.closed_at, sc.created_at,
                    COALESCE(s.name, '') AS store_name,
                    COALESCE(uo.name, uc.name, 'Unknown') AS user_name
             FROM store_checklists sc
             LEFT JOIN stores s ON s.id = sc.store_id
             LEFT JOIN users uo ON uo.id = sc.opened_by
             LEFT JOIN users uc ON uc.id = sc.closed_by
             WHERE DATE(sc.created_at) = ?
             ORDER BY sc.created_at DESC
             LIMIT 50",
            [$digestToday]
        ) ?: [];
    }
} catch (\Throwable $e) { $digestLists['store_health'] = []; }

$digestItems = [
    'risks' => ['label' => 'Overdue Tasks (Risks)', 'value' => $digestData['risks'], 'color' => $digestData['risks'] > 0 ? '#f87171' : '#34d399', 'icon' => '⚠️'],
    'incidents' => ['label' => 'Open Incidents', 'value' => $digestData['incidents'], 'color' => $digestData['incidents'] > 0 ? '#fb923c' : '#34d399', 'icon' => '🚨'],
    'releases' => ['label' => 'Pending Releases', 'value' => $digestData['releases'], 'color' => '#60a5fa', 'icon' => '📦'],
    'store_health' => ['label' => 'Store Checklists Today', 'value' => $digestData['store_health'], 'color' => '#4ade80', 'icon' => '🏪'],
    'action_required' => ['label' => 'Tasks Due Today', 'value' => $digestData['action_required'], 'color' => $digestData['action_required'] > 5 ? '#fbbf24' : '#34d399', 'icon' => '📋'],
];
$digestTabs = [
    'risks' => ['title' => 'Overdue Tasks', 'empty' => 'No overdue tasks.'],
    'incidents' => ['title' => 'Open Incidents', 'empty' => 'No open incidents.'],
    'releases' => ['title' => 'Pending Releases', 'empty' => 'No pending releases.'],
    'store_health' => ['title' => 'Store Checklists Today', 'empty' => 'No checklists submitted today.'],
    'action_required' => ['title' => 'Tasks Due Today', 'empty' => 'No tasks due today.'],
];
$activeDigestTab = $digestData['risks'] > 0 ? 'risks' : ($digestData['action_required'] > 0 ? 'action_required' : 'incidents');

function renderDigestTaskRows(array $rows, string $today): void {
    foreach ($rows as $row):
        $due = $row['due_date'] ?? '';
        $days = $due ? (int)floor((strtotime($today) - strtotime($due)) / 86400) : 0;
        $lateText = $due && $due < $today ? $days . 'd late' : 'Due today';
?>
        <a class="digest-row digest-row--task" href="<?= APP_URL ?>/tasks/<?= (int)$row['id'] ?>" data-detail-drawer>
            <span class="digest-row__main">
                <strong><?= e($row['title'] ?? '-') ?></strong>
                <small><?= e($row['project_name'] ?? '-') ?><?= !empty($row['store_name']) ? ' · ' . e($row['store_name']) : '' ?> · <?= e($row['assignee_name'] ?? 'Needs owner') ?></small>
            </span>
            <span class="digest-row__meta <?= $due && $due < $today ? 'danger' : 'warn' ?>"><?= e($lateText) ?></span>
        </a>
<?php
    endforeach;
}
?>

<!-- Executive Digest Section -->
<style>
.digest-card-btn { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 16px; text-align: center; cursor: pointer; color: inherit; transition: border-color .15s, background .15s; }
.digest-card-btn:hover, .digest-card-btn.active { border-color: #60a5fa; background: rgba(96,165,250,.08); }
.digest-drilldown { margin-top: 14px; border: 1px solid var(--border); border-radius: 12px; background: rgba(15,23,42,.62); overflow: hidden; }
.digest-panel { display: none; }
.digest-panel.active { display: block; }
.digest-panel__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--border); }
.digest-panel__head strong { font-size: 13px; color: var(--text-primary); }
.digest-panel__head span { font-size: 12px; color: var(--text-muted); }
.digest-list { max-height: 310px; overflow: auto; }
.digest-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--border); text-decoration: none; color: inherit; }
.digest-row:last-child { border-bottom: 0; }
.digest-row:hover { background: rgba(255,255,255,.04); }
.digest-row__main { min-width: 0; }
.digest-row__main strong { display: block; color: var(--text-primary); font-size: 13px; line-height: 1.25; }
.digest-row__main small { display: block; color: var(--text-muted); font-size: 11px; margin-top: 3px; }
.digest-row__meta { flex-shrink: 0; border-radius: 999px; padding: 3px 8px; font-size: 11px; font-weight: 700; color: #cbd5e1; background: rgba(148,163,184,.12); }
.digest-row__meta.danger { color: #fecaca; background: rgba(239,68,68,.14); }
.digest-row__meta.warn { color: #fde68a; background: rgba(245,158,11,.14); }
.digest-empty { padding: 18px 14px; color: var(--text-muted); font-size: 13px; text-align: center; }
</style>
<div class="executive-digest" style="margin-bottom:32px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="font-size:16px;font-weight:700;margin:0">☀️ Morning Digest</h3>
        <span style="font-size:12px;color:var(--text-muted)"><?= date('l, M j') ?></span>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">
        <?php foreach ($digestItems as $key => $item): ?>
        <button type="button" class="digest-card-btn <?= $key === $activeDigestTab ? 'active' : '' ?>" data-digest-tab="<?= e($key) ?>">
            <div style="font-size:24px;margin-bottom:4px"><?= $item['icon'] ?></div>
            <div style="font-size:28px;font-weight:700;color:<?= $item['color'] ?>"><?= $item['value'] ?></div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px"><?= $item['label'] ?></div>
        </button>
        <?php endforeach; ?>
    </div>

    <div class="digest-drilldown">
        <?php foreach ($digestTabs as $key => $tab): ?>
            <?php $rows = $digestLists[$key] ?? []; ?>
            <div class="digest-panel <?= $key === $activeDigestTab ? 'active' : '' ?>" data-digest-panel="<?= e($key) ?>">
                <div class="digest-panel__head">
                    <strong><?= e($tab['title']) ?></strong>
                    <span><?= count($rows) ?> shown</span>
                </div>
                <div class="digest-list">
                    <?php if (empty($rows)): ?>
                        <div class="digest-empty"><?= e($tab['empty']) ?></div>
                    <?php elseif ($key === 'risks' || $key === 'action_required'): ?>
                        <?php renderDigestTaskRows($rows, $digestToday); ?>
                    <?php elseif ($key === 'incidents'): ?>
                        <?php foreach ($rows as $row): ?>
                            <div class="digest-row">
                                <span class="digest-row__main">
                                    <strong><?= e($row['title'] ?? '-') ?></strong>
                                    <small><?= e($row['store_name'] ?? '-') ?> · <?= e($row['category'] ?? '-') ?> · <?= e($row['status'] ?? '-') ?></small>
                                </span>
                                <span class="digest-row__meta <?= in_array($row['severity'] ?? '', ['critical','high'], true) ? 'danger' : 'warn' ?>"><?= e($row['severity'] ?? '-') ?></span>
                            </div>
                        <?php endforeach; ?>
                    <?php elseif ($key === 'releases'): ?>
                        <?php foreach ($rows as $row): ?>
                            <a class="digest-row" href="<?= APP_URL ?>/admin/releases">
                                <span class="digest-row__main">
                                    <strong><?= e($row['name'] ?? '-') ?></strong>
                                    <small>Version <?= e($row['version'] ?? '-') ?> · <?= e($row['status'] ?? '-') ?></small>
                                </span>
                                <span class="digest-row__meta"><?= e($row['scheduled_at'] ?? 'No schedule') ?></span>
                            </a>
                        <?php endforeach; ?>
                    <?php else: ?>
                        <?php foreach ($rows as $row): ?>
                            <div class="digest-row">
                                <span class="digest-row__main">
                                    <strong><?= e(($row['store_name'] ?? '') ?: 'Store checklist') ?></strong>
                                    <small><?= e(ucfirst($row['type'] ?? '-')) ?> · <?= e($row['user_name'] ?? 'Unknown') ?></small>
                                </span>
                                <span class="digest-row__meta"><?= e($row['created_at'] ?? '-') ?></span>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>
        <?php endforeach; ?>
    </div>

    <?php if ($digestData['risks'] > 0 || $digestData['incidents'] > 0): ?>
    <div style="margin-top:12px;padding:10px 14px;background:#f8717110;border:1px solid #f8717130;border-radius:8px;font-size:13px;color:#f87171">
        ⚡ <strong>Action Required:</strong>
        <?php if ($digestData['risks'] > 0): ?><?= $digestData['risks'] ?> overdue task<?= $digestData['risks'] > 1 ? 's' : '' ?> need attention. <?php endif; ?>
        <?php if ($digestData['incidents'] > 0): ?><?= $digestData['incidents'] ?> open incident<?= $digestData['incidents'] > 1 ? 's' : '' ?> to resolve. <?php endif; ?>
    </div>
    <?php endif; ?>
</div>

<script>
document.addEventListener('click', function (event) {
    const card = event.target.closest('[data-digest-tab]');
    if (!card) return;
    const root = card.closest('.executive-digest');
    const tab = card.getAttribute('data-digest-tab');
    root.querySelectorAll('[data-digest-tab]').forEach(btn => btn.classList.toggle('active', btn === card));
    root.querySelectorAll('[data-digest-panel]').forEach(panel => panel.classList.toggle('active', panel.getAttribute('data-digest-panel') === tab));
});
</script>
