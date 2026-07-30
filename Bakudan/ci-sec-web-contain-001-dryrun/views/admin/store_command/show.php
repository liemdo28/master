<?php
/**
 * Store Command Center — Show (Single Store Detail)
 * Uses app CSS classes — NO Tailwind
 */
$storeName  = $store['name'] ?? 'Store';
$storeColor = $store['color'] ?? '#6b7280';
$score      = (float)($health['score'] ?? 0);
$scoreColor = $score >= 80 ? '#22c55e' : ($score >= 60 ? '#eab308' : '#ef4444');
$grade      = $health['grade'] ?? 'F';
$gradeStyles = [
    'A' => 'background:rgba(34,197,94,.15);color:#22c55e;border-color:rgba(34,197,94,.3)',
    'B' => 'background:rgba(59,130,246,.15);color:#3b82f6;border-color:rgba(59,130,246,.3)',
    'C' => 'background:rgba(234,179,8,.15);color:#eab308;border-color:rgba(234,179,8,.3)',
    'D' => 'background:rgba(249,115,22,.15);color:#f97316;border-color:rgba(249,115,22,.3)',
    'F' => 'background:rgba(239,68,68,.15);color:#ef4444;border-color:rgba(239,68,68,.3)',
];
$gradeStyle = $gradeStyles[$grade] ?? $gradeStyles['F'];
?>
<style>
.scs-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px}
.scs-stat-card{
    background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);
    padding:16px 18px;border-left:4px solid var(--border);
}
.scs-stat-card--blue{border-left-color:#3b82f6}
.scs-stat-card--green{border-left-color:#22c55e}
.scs-stat-card--purple{border-left-color:#a855f7}
.scs-stat-card--red{border-left-color:#ef4444}
.scs-stat__val{font-size:26px;font-weight:900;line-height:1}
.scs-stat__label{font-size:12px;color:var(--text-muted);margin-top:4px}
.scs-stat__sub{font-size:11px;color:var(--text-muted);margin-top:2px;opacity:.7}
.scs-main{display:grid;grid-template-columns:2fr 1fr;gap:20px}
.scs-panel{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden}
.scs-panel__head{padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
.scs-panel__title{font-size:14px;font-weight:700;color:var(--text)}
.scs-panel__body{padding:14px 18px}
.scs-task-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)}
.scs-task-row:last-child{border-bottom:none}
.scs-task__pri{width:4px;height:28px;border-radius:2px;flex-shrink:0}
.scs-task__pri--urgent{background:#ef4444}
.scs-task__pri--high{background:#f97316}
.scs-task__pri--medium{background:#eab308}
.scs-task__pri--low{background:#6b7280}
.scs-task__title{font-size:13px;font-weight:600;color:var(--text);flex:1;min-width:0}
.scs-task__title a{color:inherit;text-decoration:none}
.scs-task__title a:hover{color:var(--accent)}
.scs-task__assignee{font-size:11px;color:var(--text-muted);white-space:nowrap}
.scs-task__status{font-size:10px;padding:2px 8px;border-radius:6px;font-weight:600;background:var(--bg-tertiary);color:var(--text-muted)}
.scs-member{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)}
.scs-member:last-child{border-bottom:none}
.scs-member__avatar{width:28px;height:28px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--text-muted)}
.scs-member__name{font-size:13px;font-weight:600;color:var(--text);flex:1}
.scs-member__badge{font-size:10px;padding:1px 6px;border-radius:4px;font-weight:700;background:rgba(59,130,246,.15);color:#3b82f6}
.scs-health-bar{height:6px;border-radius:3px;background:var(--bg-tertiary);overflow:hidden;margin-top:6px}
.scs-health-bar__fill{height:100%;border-radius:3px;transition:width .5s ease}
.scs-metric{margin-bottom:12px}
.scs-metric:last-child{margin-bottom:0}
.scs-metric__head{display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:4px}
.scs-metric__val{font-weight:700;color:var(--text)}
.scs-activity{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)}
.scs-activity:last-child{border-bottom:none}
.scs-activity__icon{width:24px;height:24px;border-radius:50%;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0}
.scs-activity__text{font-size:12px;color:var(--text-muted);flex:1;min-width:0}
.scs-activity__text a{color:var(--text);font-weight:600;text-decoration:none}
.scs-activity__text a:hover{color:var(--accent)}
.scs-actions{display:flex;flex-direction:column;gap:8px}
.scs-action-btn{display:block;padding:10px 14px;font-size:13px;font-weight:600;border-radius:var(--radius-md);text-decoration:none;text-align:center;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-muted);transition:all .12s}
.scs-action-btn:hover{background:var(--bg-tertiary);color:var(--text);border-color:var(--border-hover)}
.scs-action-btn--blue{background:rgba(59,130,246,.08);color:#3b82f6;border-color:rgba(59,130,246,.2)}
.scs-action-btn--red{background:rgba(239,68,68,.08);color:#ef4444;border-color:rgba(239,68,68,.2)}
.scs-action-btn--purple{background:rgba(168,85,247,.08);color:#a855f7;border-color:rgba(168,85,247,.2)}
.scs-empty{text-align:center;padding:32px;color:var(--text-muted);font-size:13px}
@media(max-width:1100px){.scs-stats{grid-template-columns:repeat(2,1fr)}.scs-main{grid-template-columns:1fr}}
@media(max-width:600px){.scs-stats{grid-template-columns:1fr}}
</style>

<div style="padding:24px">
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:12px">
            <a href="<?php echo APP_URL ?>/admin/store-command" style="color:var(--text-muted);text-decoration:none;font-size:18px" title="<?= e(t('common.back')) ?>">←</a>
            <div>
                <div style="display:flex;align-items:center;gap:8px">
                    <span style="width:12px;height:12px;border-radius:50%;background:<?php echo e($storeColor) ?>;display:inline-block"></span>
                    <h1 style="font-size:20px;font-weight:900;color:var(--text);margin:0"><?php echo e($storeName) ?></h1>
                </div>
                <?php if (!empty($store['address'])): ?>
                    <p style="font-size:12px;color:var(--text-muted);margin:3px 0 0"><?php echo e($store['address']) ?></p>
                <?php endif; ?>
            </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
            <div style="text-align:right">
                <div style="font-size:36px;font-weight:900;color:<?php echo $scoreColor ?>;line-height:1"><?php echo number_format($score, 0) ?></div>
                <span style="display:inline-block;margin-top:4px;padding:3px 10px;font-size:11px;font-weight:700;border-radius:6px;border:1px solid;<?php echo $gradeStyle ?>"><?php echo e(t('store.grade')) ?> <?php echo $grade ?></span>
            </div>
            <a href="<?php echo APP_URL ?>/admin/store-command/<?php echo $store['id'] ?>/health" class="scs-action-btn" style="padding:8px 14px;font-size:12px" title="Refresh Score">
                ↻ <?php echo e(t('store.refresh_score')); ?>
            </a>
        </div>
    </div>

    <!-- Quick Stats -->
    <div class="scs-stats">
        <div class="scs-stat-card scs-stat-card--blue">
            <div class="scs-stat__val" style="color:#3b82f6"><?php echo $taskStats['total'] ?></div>
            <div class="scs-stat__label"><?php echo e(t('store.total_tasks')); ?></div>
            <div class="scs-stat__sub"><?php echo $taskStats['overdue'] ?> <?php echo e(t('store.overdue')); ?> · <?php echo $taskStats['due_today'] ?> <?php echo e(t('store.due_today')); ?></div>
        </div>
        <div class="scs-stat-card scs-stat-card--green">
            <div class="scs-stat__val" style="color:#22c55e"><?php echo $taskStats['completed_this_week'] ?></div>
            <div class="scs-stat__label"><?php echo e(t('store.completed_week')); ?></div>
        </div>
        <div class="scs-stat-card scs-stat-card--purple">
            <div class="scs-stat__val" style="color:<?php echo $billStats['overdue_bills'] > 0 ? '#ef4444' : '#a855f7' ?>"><?php echo $billStats['total_bills'] ?></div>
            <div class="scs-stat__label"><?php echo e(t('store.bills')); ?></div>
            <div class="scs-stat__sub"><?php echo $billStats['overdue_bills'] ?> <?php echo e(t('store.overdue')); ?> · $<?php echo number_format($billStats['total_due'], 0) ?> <?php echo e(t('store.due')); ?></div>
        </div>
        <div class="scs-stat-card scs-stat-card--red">
            <div class="scs-stat__val" style="color:<?php echo $incidentStats['critical'] > 0 ? '#ef4444' : ($incidentStats['open'] > 0 ? '#f97316' : '#22c55e') ?>"><?php echo $incidentStats['open'] ?></div>
            <div class="scs-stat__label"><?php echo e(t('store.open_incidents')); ?></div>
            <?php if ($incidentStats['critical'] > 0): ?>
                <div class="scs-stat__sub" style="color:#ef4444">⚠ <?php echo $incidentStats['critical'] ?> <?php echo e(t('store.critical')); ?></div>
            <?php endif; ?>
        </div>
    </div>

    <!-- Main 2-column layout -->
    <div class="scs-main">
        <!-- Left Column -->
        <div style="display:flex;flex-direction:column;gap:20px">
            <!-- Today's Tasks -->
            <div class="scs-panel">
                <div class="scs-panel__head">
                    <span class="scs-panel__title"><?php echo e(t('store.today_tasks')); ?></span>
                    <span style="font-size:12px;color:var(--text-muted)"><?php echo count($todayTasks) ?> <?php echo e(t('store.remaining')); ?></span>
                </div>
                <div class="scs-panel__body">
                    <?php if (empty($todayTasks)): ?>
                        <div class="scs-empty">
                            <div style="font-size:28px;margin-bottom:6px">✅</div>
                            <?php echo e(t('store.no_tasks_today')); ?>
                        </div>
                    <?php else: ?>
                        <?php foreach ($todayTasks as $task): ?>
                            <div class="scs-task-row">
                                <div class="scs-task__pri scs-task__pri--<?php echo e($task['priority']) ?>"></div>
                                <div class="scs-task__title">
                                    <a href="<?php echo APP_URL ?>/tasks/<?php echo $task['id'] ?>"><?php echo e($task['title']) ?></a>
                                </div>
                                <?php if (!empty($task['assignee_name'])): ?>
                                    <span class="scs-task__assignee">→ <?php echo e($task['assignee_name']) ?></span>
                                <?php endif; ?>
                                <span class="scs-task__status"><?php echo ucfirst(str_replace('_', ' ', $task['status'])) ?></span>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Recent Activity -->
            <div class="scs-panel">
                <div class="scs-panel__head">
                    <span class="scs-panel__title"><?php echo e(t('store.recent_activity')); ?></span>
                </div>
                <div class="scs-panel__body">
                    <?php if (empty($recentActivity)): ?>
                        <div class="scs-empty"><?php echo e(t('store.no_recent_activity')); ?></div>
                    <?php else: ?>
                        <?php foreach ($recentActivity as $activity): ?>
                            <div class="scs-activity">
                                <div class="scs-activity__icon">
                                    <?php if ($activity['is_completed']): ?>✓<?php else: ?><?php echo strtoupper(substr($activity['assignee_name'] ?? '?', 0, 1)) ?><?php endif; ?>
                                </div>
                                <div class="scs-activity__text">
                                    <a href="<?php echo APP_URL ?>/tasks/<?php echo $activity['id'] ?>"><?php echo e($activity['title']) ?></a>
                                    <div style="margin-top:2px;font-size:11px;color:var(--text-muted)">
                                        <?php echo e($activity['project_name'] ?? '') ?> · <?php echo timeAgo($activity['updated_at']) ?>
                                    </div>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <!-- Right Column -->
        <div style="display:flex;flex-direction:column;gap:20px">
            <!-- Manager Info -->
            <?php if (!empty($store['manager_name'])): ?>
                <div class="scs-panel">
                    <div class="scs-panel__head">
                        <span class="scs-panel__title"><?php echo e(t('store.store_manager')); ?></span>
                    </div>
                    <div class="scs-panel__body">
                        <div style="display:flex;align-items:center;gap:10px">
                            <div style="width:36px;height:36px;border-radius:50%;background:rgba(59,130,246,.12);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#3b82f6">
                                <?php echo strtoupper(substr($store['manager_name'], 0, 1)) ?>
                            </div>
                            <div>
                                <div style="font-size:14px;font-weight:700;color:var(--text)"><?php echo e($store['manager_name']) ?></div>
                                <div style="font-size:11px;color:var(--text-muted)"><?php echo e($store['manager_email'] ?? '') ?></div>
                            </div>
                        </div>
                    </div>
                </div>
            <?php endif; ?>

            <!-- Team Members -->
            <div class="scs-panel">
                <div class="scs-panel__head">
                    <span class="scs-panel__title"><?php echo e(t('store.team')); ?> (<?php echo count($teamMembers) ?>)</span>
                </div>
                <div class="scs-panel__body">
                    <?php if (empty($teamMembers)): ?>
                        <div class="scs-empty"><?php echo e(t('store.no_team_members')); ?></div>
                    <?php else: ?>
                        <?php foreach ($teamMembers as $member): ?>
                            <div class="scs-member">
                                <div class="scs-member__avatar">
                                    <?php if (!empty($member['avatar'])): ?>
                                        <img src="<?php echo e($member['avatar']) ?>" style="width:26px;height:26px;border-radius:50%">
                                    <?php else: ?>
                                        <?php echo strtoupper(substr($member['name'], 0, 1)) ?>
                                    <?php endif; ?>
                                </div>
                                <span class="scs-member__name"><?php echo e($member['name']) ?></span>
                                <?php if ($member['role'] === 'manager'): ?>
                                    <span class="scs-member__badge">Mgr</span>
                                <?php endif; ?>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Health Metrics -->
            <div class="scs-panel">
                <div class="scs-panel__head">
                    <span class="scs-panel__title"><?php echo e(t('store.health_metrics')); ?></span>
                </div>
                <div class="scs-panel__body">
                    <?php
                    $metrics = $health['metrics'] ?? [];
                    $metricItems = [
                        'task_overdue_rate' => [e(t('store.metric_overdue_rate')), '%', $metrics['task_overdue_rate'] ?? 0, 20],
                        'task_due_today'    => [e(t('store.metric_due_today')), '', $metrics['task_due_today'] ?? 0, 10],
                        'bill_overdue'      => [e(t('store.metric_overdue_bills')), '', $metrics['bill_overdue'] ?? 0, 5],
                        'incident_open'     => [e(t('store.metric_open_incidents')), '', $metrics['incident_open'] ?? 0, 5],
                        'penalty_total'     => [e(t('store.metric_penalties')), '', $metrics['penalty_total'] ?? 0, 5],
                    ];
                    foreach ($metricItems as $key => $info):
                        [$label, $unit, $value, $max] = $info;
                        $pct = $max > 0 ? min(100, ($value / $max) * 100) : 0;
                        $barColor = $pct > 80 ? '#ef4444' : ($pct > 50 ? '#eab308' : '#22c55e');
                    ?>
                        <div class="scs-metric">
                            <div class="scs-metric__head">
                                <span><?php echo $label ?></span>
                                <span class="scs-metric__val"><?php echo $value ?><?php echo $unit ?></span>
                            </div>
                            <div class="scs-health-bar">
                                <div class="scs-health-bar__fill" style="width:<?php echo $pct ?>%;background:<?php echo $barColor ?>"></div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="scs-panel">
                <div class="scs-panel__head">
                    <span class="scs-panel__title"><?php echo e(t('store.quick_actions')); ?></span>
                </div>
                <div class="scs-panel__body">
                    <div class="scs-actions">
                        <a href="<?php echo APP_URL ?>/admin/stores/<?php echo $store['id'] ?>/edit" class="scs-action-btn scs-action-btn--blue">✏ <?php echo e(t('store.edit_store')); ?></a>
                        <a href="<?php echo APP_URL ?>/admin/incidents?store_id=<?php echo $store['id'] ?>" class="scs-action-btn scs-action-btn--red">🚨 <?php echo e(t('store.view_incidents')); ?></a>
                        <a href="<?php echo APP_URL ?>/bills/store/<?php echo $store['id'] ?>" class="scs-action-btn scs-action-btn--purple">📋 <?php echo e(t('store.manage_bills')); ?></a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
