<?php
// Phase 11 — Module 1: Daily Operations Center View
// Bakudan Business Execution Platform
?>
<style>
.operations-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    padding: 0 0 40px;
}
.operations-hero {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 16px;
    padding: 32px;
    margin-bottom: 28px;
    border: 1px solid #2a2a3e;
}
.operations-hero h2 {
    font-size: 28px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 8px;
}
.operations-hero .greeting {
    font-size: 14px;
    color: #9ca3af;
    margin-bottom: 24px;
}
.stat-row {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
}
.stat-card {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 16px 24px;
    text-align: center;
    min-width: 100px;
}
.stat-card .number {
    font-size: 32px;
    font-weight: 700;
    color: #fff;
    line-height: 1;
}
.stat-card .number.red { color: #ff4444; }
.stat-card .number.amber { color: #ffaa00; }
.stat-card .number.green { color: #00cc66; }
.stat-card .label {
    font-size: 11px;
    color: #9ca3af;
    margin-top: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.section-card {
    background: var(--card-bg, #18181b);
    border: 1px solid var(--border, #27272a);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
}
.section-card h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #e4e4e7);
    margin: 0 0 16px;
    display: flex;
    align-items: center;
    gap: 8px;
}
.section-card h3 .badge {
    background: #ff4444;
    color: white;
    border-radius: 20px;
    padding: 2px 10px;
    font-size: 11px;
    font-weight: 600;
}
.section-card h3 .badge.amber { background: #ffaa00; }
.section-card h3 .badge.green { background: #00cc66; }
.section-card h3 .badge.blue { background: #3b82f6; }

.task-list-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border, #27272a);
}
.task-list-item:last-child { border-bottom: none; }
.task-list-item .task-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}
.task-list-item .task-info { flex: 1; min-width: 0; }
.task-list-item .task-title {
    font-size: 13px;
    color: var(--text-primary, #e4e4e7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.task-list-item .task-meta {
    font-size: 11px;
    color: var(--text-muted, #71717a);
    margin-top: 2px;
}
.task-list-item .task-days {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 6px;
    flex-shrink: 0;
}
.task-days.overdue { background: rgba(255,68,68,0.15); color: #ff4444; }
.task-days.today { background: rgba(59,130,246,0.15); color: #3b82f6; }

.anomaly-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border, #27272a);
}
.anomaly-item:last-child { border-bottom: none; }
.anomaly-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.anomaly-icon.critical { background: rgba(255,68,68,0.15); color: #ff4444; }
.anomaly-icon.warning { background: rgba(255,170,0,0.15); color: #ffaa00; }
.anomaly-icon.info { background: rgba(59,130,246,0.15); color: #3b82f6; }
.anomaly-text { flex: 1; }
.anomaly-text strong { font-size: 13px; color: var(--text-primary); }
.anomaly-text p { font-size: 11px; color: var(--text-muted); margin: 2px 0 0; }

.person-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border, #27272a);
}
.person-row:last-child { border-bottom: none; }
.person-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
}
.person-info { flex: 1; }
.person-name { font-size: 13px; font-weight: 500; color: var(--text-primary); }
.person-meta { font-size: 11px; color: var(--text-muted); }
.person-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 6px;
}
.person-badge.red { background: rgba(255,68,68,0.15); color: #ff4444; }
.person-badge.amber { background: rgba(255,170,0,0.15); color: #ffaa00; }

.empty-state {
    text-align: center;
    padding: 24px;
    color: var(--text-muted, #71717a);
    font-size: 13px;
}
.empty-state .emoji { font-size: 32px; margin-bottom: 8px; }

.col-span-2 { grid-column: span 2; }
.two-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

@media (max-width: 900px) {
    .operations-grid { grid-template-columns: 1fr; }
    .col-span-2 { grid-column: span 1; }
    .two-cols { grid-template-columns: 1fr; }
}
</style>

<div class="operations-hero">
    <h2>Good <?= (int)date('H') < 12 ? 'Morning' : ((int)date('H') < 17 ? 'Afternoon' : 'Evening') ?>, <?= e($user['name']) ?></h2>
    <p class="greeting"><?= e($today) ?> &bull; <?= e($now) ?> &bull; Daily Operations Center</p>
    <div class="stat-row">
        <div class="stat-card">
            <div class="number <?= $totalOverdue > 0 ? 'red' : 'green' ?>"><?= $totalOverdue ?></div>
            <div class="label">Overdue</div>
        </div>
        <div class="stat-card">
            <div class="number"><?= $totalToday ?></div>
            <div class="label">Due Today</div>
        </div>
        <div class="stat-card">
            <div class="number <?= $urgentCount > 0 ? 'amber' : 'green' ?>"><?= $urgentCount ?></div>
            <div class="label">Need Action</div>
        </div>
        <div class="stat-card">
            <div class="number"><?= count($pendingReleases) ?></div>
            <div class="label">Releases</div>
        </div>
    </div>
</div>

<div class="operations-grid">
    <!-- LEFT: Workload -->
    <div>
        <!-- Overdue Tasks -->
        <div class="section-card">
            <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Tasks Overdue
                <?php if ($totalOverdue > 0): ?><span class="badge"><?= $totalOverdue ?></span><?php endif; ?>
            </h3>
            <?php if (empty($overdueTasks)): ?>
                <div class="empty-state"><div class="emoji">✅</div>No overdue tasks</div>
            <?php else: ?>
                <?php foreach (array_slice($overdueTasks, 0, 8) as $t): ?>
                    <div class="task-list-item">
                        <div class="task-dot" style="background:<?= e($t['project_color'] ?? '#3b82f6') ?>"></div>
                        <div class="task-info">
                            <div class="task-title"><?= e($t['title']) ?></div>
                            <div class="task-meta">
                                <?= e($t['project_name'] ?? '') ?><?= !empty($t['store_name']) ? ' · ' . e($t['store_name']) : '' ?>
                                <?php if (!empty($t['assignee_name'])): ?> · <?= e($t['assignee_name']) ?><?php endif; ?>
                            </div>
                        </div>
                        <span class="task-days overdue"><?= $t['days_overdue'] ?>d</span>
                    </div>
                <?php endforeach; ?>
                <?php if (count($overdueTasks) > 8): ?>
                    <div style="text-align:center;padding-top:12px">
                        <a href="/my-tasks?filter=overdue" class="btn btn-sm btn-secondary">View all <?= $totalOverdue ?> overdue →</a>
                    </div>
                <?php endif; ?>
            <?php endif; ?>
        </div>

        <!-- Today Tasks -->
        <div class="section-card">
            <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Due Today
                <?php if ($totalToday > 0): ?><span class="badge blue"><?= $totalToday ?></span><?php endif; ?>
            </h3>
            <?php if (empty($todayTasks)): ?>
                <div class="empty-state"><div class="emoji">📅</div>Nothing due today</div>
            <?php else: ?>
                <?php foreach (array_slice($todayTasks, 0, 8) as $t): ?>
                    <div class="task-list-item">
                        <div class="task-dot" style="background:<?= e($t['project_color'] ?? '#3b82f6') ?>"></div>
                        <div class="task-info">
                            <div class="task-title"><?= e($t['title']) ?></div>
                            <div class="task-meta">
                                <?= e($t['project_name'] ?? '') ?><?= !empty($t['store_name']) ? ' · ' . e($t['store_name']) : '' ?>
                            </div>
                        </div>
                        <span class="task-days today">Today</span>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <!-- Payroll & Audits -->
        <div class="two-cols">
            <div class="section-card">
                <h3>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffaa00" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                    Payroll
                    <?php if (!empty($pendingPayroll)): ?><span class="badge amber"><?= count($pendingPayroll) ?></span><?php endif; ?>
                </h3>
                <?php if (empty($pendingPayroll)): ?>
                    <div class="empty-state"><div class="emoji">💰</div>No pending payroll</div>
                <?php else: ?>
                    <?php foreach ($pendingPayroll as $b): ?>
                        <div class="task-list-item">
                            <div class="task-info">
                                <div class="task-title" style="font-size:12px"><?= e($b['vendor'] ?? $b['description'] ?? 'Payroll') ?></div>
                                <div class="task-meta"><?= e($b['store_name'] ?? '') ?></div>
                            </div>
                            <span style="font-size:12px;font-weight:600">$<?= number_format($b['amount'],0) ?></span>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
            <div class="section-card">
                <h3>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Audits
                    <?php if (!empty($pendingAudits)): ?><span class="badge blue"><?= count($pendingAudits) ?></span><?php endif; ?>
                </h3>
                <?php if (empty($pendingAudits)): ?>
                    <div class="empty-state"><div class="emoji">🔍</div>No pending audits</div>
                <?php else: ?>
                    <?php foreach (array_slice($pendingAudits, 0, 4) as $a): ?>
                        <div class="task-list-item">
                            <div class="task-info">
                                <div class="task-title" style="font-size:12px"><?= e($a['title']) ?></div>
                                <div class="task-meta"><?= e($a['store_name'] ?? '') ?></div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <!-- RIGHT: Anomalies & People -->
    <div>
        <!-- Store Health Issues -->
        <div class="section-card">
            <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" stroke-width="2"><path d="M3 9l1-4h16l1 4"/><path d="M3 9v1a3 3 0 0 0 6 0V9m0 1a3 3 0 0 0 6 0V9m0 1a3 3 0 0 0 6 0V9"/></svg>
                Store Health Issues
                <?php if (!empty($storeHealthIssues)): ?><span class="badge"><?= count($storeHealthIssues) ?></span><?php endif; ?>
            </h3>
            <?php if (empty($storeHealthIssues)): ?>
                <div class="empty-state"><div class="emoji">🏪</div>All stores healthy</div>
            <?php else: ?>
                <?php foreach ($storeHealthIssues as $issue): ?>
                    <div class="anomaly-item">
                        <div class="anomaly-icon <?= $issue['status'] ?>">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l1-4h16l1 4"/><path d="M3 9v1a3 3 0 0 0 6 0V9"/></svg>
                        </div>
                        <div class="anomaly-text">
                            <strong><?= e($issue['store']['name']) ?></strong>
                            <p><?= $issue['overdue'] ?> overdue task<?= $issue['overdue'] > 1 ? 's' : '' ?> &bull; Health: <?= $issue['health'] ?>%</p>
                        </div>
                        <div style="width:48px;height:48px;position:relative">
                            <svg viewBox="0 0 36 36" width="48" height="48">
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#27272a" stroke-width="3"/>
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="<?= $issue['status'] === 'critical' ? '#ff4444' : '#ffaa00' ?>" stroke-width="3" stroke-dasharray="<?= $issue['health'] ?>, 100"/>
                            </svg>
                        </div>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <!-- Incidents & Anomalies -->
        <div class="section-card">
            <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4444" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                Incidents & Alerts
                <?php if (!empty($newIncidents)): ?><span class="badge"><?= count($newIncidents) ?></span><?php endif; ?>
            </h3>
            <?php if (empty($newIncidents) && empty($recentAuditFails)): ?>
                <div class="empty-state"><div class="emoji">✅</div>No incidents in last 24h</div>
            <?php else: ?>
                <?php foreach ($newIncidents as $i): ?>
                    <div class="anomaly-item">
                        <div class="anomaly-icon critical">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                        </div>
                        <div class="anomaly-text">
                            <strong><?= e($i['title']) ?></strong>
                            <p><?= e($i['store_name'] ?? '') ?> · <?= e($i['assignee_name'] ?? 'Unassigned') ?></p>
                        </div>
                    </div>
                <?php endforeach; ?>
                <?php foreach ($recentAuditFails as $a): ?>
                    <div class="anomaly-item">
                        <div class="anomaly-icon warning">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                        </div>
                        <div class="anomaly-text">
                            <strong>Audit Failed: <?= e($a['title']) ?></strong>
                            <p><?= e($a['store_name'] ?? '') ?> · <?= timeAgo($a['created_at']) ?></p>
                        </div>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <!-- People needing attention -->
        <div class="section-card">
            <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffaa00" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                People Needing Attention
                <?php if (!empty($overloadedManagers) || !empty($lateEmployees)): ?><span class="badge amber"><?= count($overloadedManagers) + count($lateEmployees) ?></span><?php endif; ?>
            </h3>
            <?php if (empty($overloadedManagers) && empty($lateEmployees)): ?>
                <div class="empty-state"><div class="emoji">👥</div>Everyone on track</div>
            <?php else: ?>
                <?php foreach ($overloadedManagers as $m): ?>
                    <div class="person-row">
                        <div class="person-avatar" style="background:#7c3aed"><?= strtoupper(mb_substr($m['name'], 0, 1)) ?></div>
                        <div class="person-info">
                            <div class="person-name"><?= e($m['name']) ?></div>
                            <div class="person-meta"><?= e(ucfirst($m['role'])) ?></div>
                        </div>
                        <span class="person-badge red"><?= $m['overdue_count'] ?> overdue</span>
                    </div>
                <?php endforeach; ?>
                <?php foreach ($lateEmployees as $e): ?>
                    <div class="person-row">
                        <div class="person-avatar"><?= strtoupper(mb_substr($e['name'], 0, 1)) ?></div>
                        <div class="person-info">
                            <div class="person-name"><?= e($e['name']) ?></div>
                            <div class="person-meta"><?= $e['today_count'] ?> tasks due today</div>
                        </div>
                        <span class="person-badge amber"><?= $e['overdue_count'] ?> overdue</span>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <!-- Releases Waiting -->
        <?php if (!empty($pendingReleases)): ?>
        <div class="section-card">
            <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                Releases Waiting Approval
                <span class="badge blue"><?= count($pendingReleases) ?></span>
            </h3>
            <?php foreach ($pendingReleases as $r): ?>
                <div class="anomaly-item">
                    <div class="anomaly-icon info">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/></svg>
                    </div>
                    <div class="anomaly-text">
                        <strong><?= e($r['name'] ?? $r['title'] ?? 'Release') ?></strong>
                        <p><?= e($r['created_by_name'] ?? '') ?> · <?= e(ucfirst($r['status'] ?? '')) ?></p>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
        <?php endif; ?>
    </div>
</div>
