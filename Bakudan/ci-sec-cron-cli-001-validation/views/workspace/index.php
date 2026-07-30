<?php
/**
 * Phase 11.5 — Module 5: My Workspace View
 */
?>
<div class="workspace-page">
    <!-- Favorites / Pinned -->
    <?php if (!empty($favorites)): ?>
    <div class="workspace-section" style="margin-bottom:32px">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">📌 Pinned</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">
            <?php foreach ($favorites as $fav): ?>
            <a href="<?= APP_URL . e($fav['url']) ?>" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;text-decoration:none;color:inherit">
                <span style="font-size:14px"><?= e($fav['title']) ?></span>
            </a>
            <?php endforeach; ?>
        </div>
    </div>
    <?php endif; ?>

    <!-- Grid Layout -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:24px">
        <!-- My Tasks -->
        <div class="workspace-card" style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <h3 style="font-size:15px;font-weight:600;margin:0">My Tasks</h3>
                <a href="<?= APP_URL ?>/my-tasks" style="font-size:12px;color:var(--blue);text-decoration:none">View all →</a>
            </div>
            <?php if (!empty($myTasks)): ?>
            <div style="display:flex;flex-direction:column;gap:6px">
                <?php foreach (array_slice($myTasks, 0, 8) as $task):
                    $pColors = ['critical'=>'#f87171','high'=>'#fb923c','medium'=>'#fbbf24','low'=>'#71717a'];
                    $pColor = $pColors[$task['priority'] ?? 'medium'] ?? '#71717a';
                ?>
                <a href="<?= APP_URL ?>/tasks/<?= $task['id'] ?>" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;text-decoration:none;color:inherit;background:var(--bg-secondary)">
                    <span style="width:6px;height:6px;border-radius:50%;background:<?= $pColor ?>;flex-shrink:0"></span>
                    <span style="flex:1;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><?= e($task['title']) ?></span>
                    <?php if ($task['due_date']): ?>
                    <span style="font-size:11px;color:var(--text-muted)"><?= date('M j', strtotime($task['due_date'])) ?></span>
                    <?php endif; ?>
                </a>
                <?php endforeach; ?>
            </div>
            <?php else: ?>
            <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">No active tasks 🎉</div>
            <?php endif; ?>
        </div>

        <!-- My Calendar (This Week) -->
        <div class="workspace-card" style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <h3 style="font-size:15px;font-weight:600;margin:0">This Week</h3>
                <a href="<?= APP_URL ?>/calendar" style="font-size:12px;color:var(--blue);text-decoration:none">Calendar →</a>
            </div>
            <?php if (!empty($myCalendar)): ?>
            <div style="display:flex;flex-direction:column;gap:6px">
                <?php foreach ($myCalendar as $item): ?>
                <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;background:var(--bg-secondary)">
                    <span style="font-size:11px;font-weight:600;color:var(--blue);min-width:40px"><?= date('D', strtotime($item['due_date'])) ?></span>
                    <span style="flex:1;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><?= e($item['title']) ?></span>
                    <span style="font-size:11px;color:var(--text-muted)"><?= date('M j', strtotime($item['due_date'])) ?></span>
                </div>
                <?php endforeach; ?>
            </div>
            <?php else: ?>
            <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">Nothing due this week</div>
            <?php endif; ?>
        </div>

        <!-- My Reviews -->
        <div class="workspace-card" style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <h3 style="font-size:15px;font-weight:600;margin:0">My Reviews</h3>
                <span style="font-size:12px;color:var(--text-muted)"><?= count($myReviews) ?> pending</span>
            </div>
            <?php if (!empty($myReviews)): ?>
            <div style="display:flex;flex-direction:column;gap:6px">
                <?php foreach (array_slice($myReviews, 0, 6) as $review): ?>
                <a href="<?= APP_URL ?>/tasks/<?= $review['id'] ?>" data-detail-drawer style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;text-decoration:none;color:inherit;background:var(--bg-secondary)">
                    <span style="flex:1;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><?= e($review['title']) ?></span>
                    <span style="font-size:11px;color:var(--text-muted)"><?= e($review['assignee_name'] ?? 'Unassigned') ?></span>
                </a>
                <?php endforeach; ?>
            </div>
            <?php else: ?>
            <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">No pending reviews</div>
            <?php endif; ?>
        </div>

        <!-- My Approvals -->
        <?php if (canAdmin() || canManage()): ?>
        <div class="workspace-card" style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <h3 style="font-size:15px;font-weight:600;margin:0">Approvals</h3>
                <a href="<?= APP_URL ?>/admin/releases" style="font-size:12px;color:var(--blue);text-decoration:none">Releases →</a>
            </div>
            <?php if (!empty($myApprovals)): ?>
            <div style="display:flex;flex-direction:column;gap:6px">
                <?php foreach ($myApprovals as $approval): ?>
                <a href="<?= APP_URL ?>/admin/releases/<?= $approval['id'] ?>" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;text-decoration:none;color:inherit;background:var(--bg-secondary)">
                    <span style="font-size:13px"><?= tf_icon('layers', 14) ?></span>
                    <span style="flex:1;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><?= e($approval['title']) ?></span>
                    <span style="font-size:11px;padding:1px 6px;border-radius:3px;background:var(--amber-bg);color:var(--amber)"><?= e(ucfirst($approval['status'])) ?></span>
                </a>
                <?php endforeach; ?>
            </div>
            <?php else: ?>
            <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">No pending approvals</div>
            <?php endif; ?>
        </div>
        <?php endif; ?>

        <!-- My Incidents -->
        <?php if (!empty($myIncidents)): ?>
        <div class="workspace-card" style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <h3 style="font-size:15px;font-weight:600;margin:0">My Incidents</h3>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px">
                <?php foreach ($myIncidents as $incident):
                    $sevColors = ['critical'=>'#f87171','high'=>'#fb923c','medium'=>'#fbbf24','low'=>'#71717a'];
                ?>
                <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:6px;background:var(--bg-secondary)">
                    <span style="width:6px;height:6px;border-radius:50%;background:<?= $sevColors[$incident['severity'] ?? 'medium'] ?? '#71717a' ?>"></span>
                    <span style="flex:1;font-size:13px"><?= e($incident['title']) ?></span>
                    <span style="font-size:11px;color:var(--text-muted)"><?= e(ucfirst($incident['status'])) ?></span>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
        <?php endif; ?>
    </div>
</div>
