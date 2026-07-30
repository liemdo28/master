<?php
/**
 * Phase 11.5 — Module 2: Activity Feed View
 */
$eventIcons = [
    'task_completed' => ['icon' => 'check-circle', 'color' => '#34d399', 'bg' => '#34d39920'],
    'release_published' => ['icon' => 'layers', 'color' => '#60a5fa', 'bg' => '#60a5fa20'],
    'release_approved' => ['icon' => 'shield-check', 'color' => '#4ade80', 'bg' => '#4ade8020'],
    'release_updated' => ['icon' => 'layers', 'color' => '#a78bfa', 'bg' => '#a78bfa20'],
    'incident_opened' => ['icon' => 'alert-triangle', 'color' => '#f87171', 'bg' => '#f8717120'],
    'checklist_completed' => ['icon' => 'clipboard-list', 'color' => '#fbbf24', 'bg' => '#fbbf2420'],
    'payment_completed' => ['icon' => 'dollar-sign', 'color' => '#34d399', 'bg' => '#34d39920'],
    'bill_created' => ['icon' => 'receipt', 'color' => '#fb923c', 'bg' => '#fb923c20'],
];

$filterOptions = [
    'all' => 'All Activity',
    'tasks' => 'Tasks',
    'releases' => 'Releases',
    'incidents' => 'Incidents',
    'checklists' => 'Checklists',
    'payments' => 'Payments',
];
?>

<div class="activity-page">
    <!-- Filter Bar -->
    <div style="display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap">
        <?php foreach ($filterOptions as $key => $label): ?>
        <a href="<?= APP_URL ?>/activity?filter=<?= $key ?>"
           class="btn btn-sm <?= $filter === $key ? 'btn-primary' : 'btn-secondary' ?>"
           style="border-radius:20px;padding:6px 16px;font-size:13px">
            <?= $label ?>
        </a>
        <?php endforeach; ?>
    </div>

    <!-- Timeline -->
    <?php if (!empty($activities)): ?>
    <div class="activity-timeline" style="position:relative;padding-left:24px">
        <!-- Timeline line -->
        <div style="position:absolute;left:11px;top:0;bottom:0;width:2px;background:var(--border)"></div>

        <?php
        $lastDate = '';
        foreach ($activities as $activity):
            $eventDate = date('Y-m-d', strtotime($activity['event_time'] ?? 'now'));
            $eventConfig = $eventIcons[$activity['event_type'] ?? ''] ?? ['icon' => 'activity', 'color' => '#71717a', 'bg' => '#71717a20'];

            if ($eventDate !== $lastDate):
                $lastDate = $eventDate;
        ?>
        <div style="margin:20px 0 12px -24px;padding-left:24px;font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">
            <?= $eventDate === date('Y-m-d') ? 'Today' : ($eventDate === date('Y-m-d', strtotime('-1 day')) ? 'Yesterday' : date('M j, Y', strtotime($eventDate))) ?>
        </div>
        <?php endif; ?>

        <div class="activity-item" data-dd-inline data-dd-title="<?= e($activity['title'] ?? 'Activity') ?>" data-dd-key="activity-<?= (int)($activity['id'] ?? 0) ?>" style="display:flex;gap:12px;margin-bottom:16px;position:relative">
            <!-- Dot -->
            <div style="width:22px;height:22px;border-radius:50%;background:<?= $eventConfig['bg'] ?>;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:-35px;z-index:1;border:2px solid var(--card-bg)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="<?= $eventConfig['color'] ?>" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <?= tf_icon($eventConfig['icon'], 12) ?>
                </svg>
            </div>

            <!-- Content -->
            <div style="flex:1;padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px">
                <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
                    <div>
                        <span style="font-weight:500;font-size:14px"><?= e($activity['title'] ?? 'Unknown') ?></span>
                        <?php if (!empty($activity['actor_name'])): ?>
                        <span style="color:var(--text-muted);font-size:12px;margin-left:6px">by <?= e($activity['actor_name']) ?></span>
                        <?php endif; ?>
                    </div>
                    <span style="font-size:11px;color:var(--text-muted);white-space:nowrap">
                        <?= date('g:i A', strtotime($activity['event_time'] ?? 'now')) ?>
                    </span>
                </div>
                <div style="margin-top:4px;font-size:12px;color:var(--text-muted)">
                    <?= ucwords(str_replace('_', ' ', $activity['event_type'] ?? '')) ?>
                </div>
            </div>
        </div>
        <?php endforeach; ?>
    </div>

    <!-- Pagination -->
    <?php if ($totalPages > 1): ?>
    <div style="display:flex;justify-content:center;gap:8px;margin-top:32px">
        <?php if ($page > 1): ?>
        <a href="<?= APP_URL ?>/activity?page=<?= $page - 1 ?>&filter=<?= $filter ?>" class="btn btn-sm btn-secondary">← Previous</a>
        <?php endif; ?>
        <span style="padding:6px 12px;font-size:13px;color:var(--text-muted)">Page <?= $page ?> of <?= $totalPages ?></span>
        <?php if ($page < $totalPages): ?>
        <a href="<?= APP_URL ?>/activity?page=<?= $page + 1 ?>&filter=<?= $filter ?>" class="btn btn-sm btn-secondary">Next →</a>
        <?php endif; ?>
    </div>
    <?php endif; ?>

    <?php else: ?>
    <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <div style="font-size:48px;margin-bottom:16px">📋</div>
        <div style="font-size:16px;font-weight:500;margin-bottom:8px">No activity yet</div>
        <div style="font-size:13px">Activity will appear here as tasks are completed, releases published, and incidents resolved.</div>
    </div>
    <?php endif; ?>
</div>
