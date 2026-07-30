<?php
/**
 * Phase 11.6 — Adoption Metrics View
 */
$featureKPIs = [
    ['name' => 'Search Usage', 'value' => $kpis['search_usage'] ?? 0, 'target' => 'Regular use', 'icon' => '🔍'],
    ['name' => 'Workspace Views', 'value' => $kpis['workspace_views'] ?? 0, 'target' => 'Primary entry', 'icon' => '🏠'],
    ['name' => 'Quick Action (FAB)', 'value' => $kpis['fab_creations'] ?? 0, 'target' => '>50% creations', 'icon' => '⚡'],
    ['name' => 'Notification Actions', 'value' => $kpis['notification_interactions'] ?? 0, 'target' => 'Replace email', 'icon' => '🔔'],
    ['name' => 'Control Tower', 'value' => $kpis['control_tower_visits'] ?? 0, 'target' => 'Daily CEO use', 'icon' => '🗼'],
    ['name' => 'Release Artifacts', 'value' => $kpis['release_artifact_views'] ?? 0, 'target' => 'No dev dependency', 'icon' => '📦'],
    ['name' => 'Health Monitor', 'value' => $kpis['health_monitor_views'] ?? 0, 'target' => 'Admin checks', 'icon' => '💚'],
    ['name' => 'Activity Feed', 'value' => $kpis['activity_feed_views'] ?? 0, 'target' => 'Awareness', 'icon' => '📋'],
];
?>

<div class="adoption-metrics-page">
    <!-- Date Range Filter -->
    <form method="GET" action="<?= APP_URL ?>/admin/adoption-metrics" style="display:flex;gap:12px;align-items:center;margin-bottom:24px;flex-wrap:wrap">
        <label style="font-size:13px;color:var(--text-muted)">From:</label>
        <input type="date" name="from" value="<?= e($from) ?>" class="form-control" style="width:auto">
        <label style="font-size:13px;color:var(--text-muted)">To:</label>
        <input type="date" name="to" value="<?= e($to) ?>" class="form-control" style="width:auto">
        <button type="submit" class="btn btn-primary btn-sm">Filter</button>
    </form>

    <!-- Summary Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:32px">
        <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:700;color:var(--blue)"><?= $summary['total_events'] ?? 0 ?></div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Total Events</div>
        </div>
        <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:700;color:#34d399"><?= $summary['unique_users'] ?? 0 ?></div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Unique Users</div>
        </div>
        <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:700;color:#fbbf24"><?= $kpis['avg_events_per_day'] ?? 0 ?></div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Avg/Day</div>
        </div>
        <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:700;color:#a78bfa"><?= $kpis['daily_active_users'] ?? 0 ?></div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">DAU</div>
        </div>
    </div>

    <!-- Feature KPIs -->
    <h3 style="font-size:16px;font-weight:600;margin-bottom:16px">Feature Adoption</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-bottom:32px">
        <?php foreach ($featureKPIs as $kpi): ?>
        <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:16px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span style="font-size:20px"><?= $kpi['icon'] ?></span>
                <span style="font-size:24px;font-weight:700;color:<?= $kpi['value'] > 0 ? '#34d399' : '#71717a' ?>"><?= $kpi['value'] ?></span>
            </div>
            <div style="font-size:13px;font-weight:500"><?= $kpi['name'] ?></div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Target: <?= $kpi['target'] ?></div>
        </div>
        <?php endforeach; ?>
    </div>

    <!-- Event Breakdown -->
    <?php if (!empty($summary['events'])): ?>
    <h3 style="font-size:16px;font-weight:600;margin-bottom:16px">Event Breakdown</h3>
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:32px">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
                <tr style="border-bottom:1px solid var(--border)">
                    <th style="padding:12px 16px;text-align:left;color:var(--text-muted);font-weight:500">Event</th>
                    <th style="padding:12px 16px;text-align:right;color:var(--text-muted);font-weight:500">Count</th>
                    <th style="padding:12px 16px;text-align:right;color:var(--text-muted);font-weight:500">Users</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($summary['events'] as $evt): ?>
                <tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:10px 16px;font-weight:500"><?= e($evt['event']) ?></td>
                    <td style="padding:10px 16px;text-align:right"><?= (int)$evt['count'] ?></td>
                    <td style="padding:10px 16px;text-align:right;color:var(--text-muted)"><?= (int)$evt['unique_users'] ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php endif; ?>

    <!-- Top Users -->
    <?php if (!empty($summary['top_users'])): ?>
    <h3 style="font-size:16px;font-weight:600;margin-bottom:16px">Most Active Users</h3>
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:32px">
        <?php foreach ($summary['top_users'] as $u): ?>
        <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:600"><?= strtoupper(mb_substr($u['name'] ?? '?', 0, 1)) ?></div>
            <div style="flex:1">
                <div style="font-size:13px;font-weight:500"><?= e($u['name'] ?? 'Unknown') ?></div>
                <div style="font-size:11px;color:var(--text-muted)"><?= e(ucfirst($u['role'] ?? '')) ?></div>
            </div>
            <div style="font-size:14px;font-weight:600"><?= (int)$u['event_count'] ?> events</div>
        </div>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>

    <!-- Adoption Status -->
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:20px;margin-top:24px">
        <h3 style="font-size:15px;font-weight:600;margin:0 0 12px">Adoption Status</h3>
        <div style="font-size:13px;color:var(--text-muted);line-height:1.8">
            <p>Phase 11.5 is considered adopted when:</p>
            <ul style="margin:8px 0;padding-left:20px">
                <li>CEO uses Control Tower daily</li>
                <li>Managers use Command Center daily</li>
                <li>Workspace becomes primary entry point</li>
                <li>Search used regularly (>5x/day)</li>
                <li>Notifications reduce missed work</li>
                <li>Release Artifacts remove dependency on dev</li>
            </ul>
            <p style="margin-top:12px"><a href="<?= APP_URL ?>/reports/PHASE11_5_ADOPTION_REPORT.md" style="color:var(--blue)">View Full Adoption Report →</a></p>
        </div>
    </div>
</div>
