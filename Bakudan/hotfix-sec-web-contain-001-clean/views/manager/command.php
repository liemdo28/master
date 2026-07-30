<?php
/**
 * Manager Command Center
 */
$pageTitle = 'Manager Command Center';
?>
<?php
// Get current user data
$currentUserId = $_SESSION['user_id'] ?? 0;
$currentUserName = $_SESSION['user_name'] ?? '';

// Get team data — uses store_id relationship (multi-store aware)
$db = Database::getInstance();
$teamMembers = $db->fetchAll("
    SELECT u.id, u.name, u.email, u.avatar,
           COUNT(DISTINCT t.id) as total_tasks,
           SUM(CASE WHEN t.is_completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
           SUM(CASE WHEN t.due_date < CURDATE() AND t.is_completed = 0 THEN 1 ELSE 0 END) as overdue_tasks,
           SUM(CASE WHEN t.due_date = CURDATE() AND t.is_completed = 0 THEN 1 ELSE 0 END) as today_tasks
    FROM users u
    LEFT JOIN tasks t ON u.id = t.assignee_id
    WHERE u.store_id IN (SELECT store_id FROM users WHERE id = ? AND store_id IS NOT NULL)
       OR u.id = ?
    GROUP BY u.id
    ORDER BY u.name
", [$currentUserId, $currentUserId]);

// Get pending approvals
$pendingApprovals = $db->fetchAll("
    SELECT COUNT(*) as cnt FROM deadline_extensions WHERE status = 'pending'
");

// Get open incidents for team
$openIncidents = $db->tableExists('incidents')
    ? $db->fetchAll("
        SELECT COUNT(*) as cnt FROM incidents WHERE status IN ('open', 'acknowledged', 'investigating')
    ")
    : [['cnt' => 0]];

// Team scope: users in same store(s) as current user
$_teamScope = "u.store_id IN (SELECT store_id FROM users WHERE id = ? AND store_id IS NOT NULL) OR u.id = ?";

// Get team tasks by priority (hide tasks older than 2026-05-01)
$priorityTasks = $db->fetchAll("
    SELECT t.*, u.name as assignee_name,
           s.name as store_name, s.color as store_color
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN stores s ON p.store_id = s.id
    WHERE (t.assignee_id IN (SELECT id FROM users u WHERE {$_teamScope}) OR t.assignee_id = ?)
    AND t.is_completed = 0
    AND t.priority IN ('high','urgent')
    AND (t.due_date IS NULL OR t.due_date >= '2026-05-01')
    ORDER BY t.due_date ASC
    LIMIT 10
", [$currentUserId, $currentUserId, $currentUserId]);

// Get overdue tasks (hide tasks older than 2026-05-01)
$overdueTasks = $db->fetchAll("
    SELECT t.*, u.name as assignee_name,
           s.name as store_name, s.color as store_color
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN stores s ON p.store_id = s.id
    WHERE (t.assignee_id IN (SELECT id FROM users u WHERE {$_teamScope}) OR t.assignee_id = ?)
    AND t.is_completed = 0
    AND t.due_date < CURDATE()
    AND t.due_date >= '2026-05-01'
    ORDER BY t.due_date ASC
    LIMIT 10
", [$currentUserId, $currentUserId, $currentUserId]);

// Get today's tasks (hide tasks older than 2026-05-01)
$todayTasks = $db->fetchAll("
    SELECT t.*, u.name as assignee_name,
           s.name as store_name, s.color as store_color
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN stores s ON p.store_id = s.id
    WHERE (t.assignee_id IN (SELECT id FROM users u WHERE {$_teamScope}) OR t.assignee_id = ?)
    AND t.is_completed = 0
    AND t.due_date = CURDATE()
    AND (t.due_date IS NULL OR t.due_date >= '2026-05-01')
    ORDER BY t.priority DESC
    LIMIT 20
", [$currentUserId, $currentUserId, $currentUserId]);

// Get recent activity
$recentActivity = $db->fetchAll("
    SELECT 'task_completed' as type, t.title, t.due_date, u.name as actor_name, t.updated_at as action_time
    FROM tasks t
    JOIN users u ON t.assignee_id = u.id
    WHERE (t.assignee_id IN (SELECT id FROM users u2 WHERE u2.store_id IN (SELECT store_id FROM users WHERE id = ? AND store_id IS NOT NULL)) OR t.assignee_id = ?)
    AND t.is_completed = 1
    AND t.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    
    UNION ALL
    
    SELECT 'task_created' as type, t.title, t.due_date, u.name as creator_name, t.created_at as action_time
    FROM tasks t
    JOIN users u ON t.created_by = u.id
    WHERE (t.assignee_id IN (SELECT id FROM users u2 WHERE u2.store_id IN (SELECT store_id FROM users WHERE id = ? AND store_id IS NOT NULL)) OR t.assignee_id = ?)
    AND t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    
    ORDER BY action_time DESC
    LIMIT 15
", [$currentUserId, $currentUserId, $currentUserId, $currentUserId]);

// Stats
$stats = [
    'team_size' => count($teamMembers),
    'total_tasks' => array_sum(array_column($teamMembers, 'total_tasks')),
    'completed_tasks' => array_sum(array_column($teamMembers, 'completed_tasks')),
    'overdue_tasks' => array_sum(array_column($teamMembers, 'overdue_tasks')),
    'today_tasks' => array_sum(array_column($teamMembers, 'today_tasks')),
    'completion_rate' => count($teamMembers) > 0 ? round(array_sum(array_column($teamMembers, 'completed_tasks')) / max(1, array_sum(array_column($teamMembers, 'total_tasks'))) * 100) : 0
];
?>

<style>
.mc-page { padding: 28px 32px; max-width: 1680px; margin: 0 auto; color: #e2e8f0; }
.mc-page h1 { margin: 0; font-size: 1.9rem; line-height: 1.15; font-weight: 800; color: #f8fafc; letter-spacing: 0; }
.mc-page h2 { margin: 0; font-size: .95rem; font-weight: 800; color: #f8fafc; letter-spacing: 0; }
.mc-page a { color: #60a5fa; text-decoration: none; }
.mc-page a:hover { color: #93c5fd; text-decoration: underline; }
.mc-page .p-4 { padding: 16px; }
.mc-page .px-4 { padding-left: 16px; padding-right: 16px; }
.mc-page .py-3 { padding-top: 12px; padding-bottom: 12px; }
.mc-page .py-8 { padding-top: 32px; padding-bottom: 32px; }
.mc-page .mb-6 { margin-bottom: 24px; }
.mc-page .mt-1 { margin-top: 4px; }
.mc-page .mb-2 { margin-bottom: 8px; }
.mc-page .grid { display: grid; }
.mc-page .grid-cols-1 { grid-template-columns: minmax(0, 1fr); }
.mc-page .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.mc-page .gap-3 { gap: 12px; }
.mc-page .gap-4 { gap: 16px; }
.mc-page .gap-6 { gap: 24px; }
.mc-page .space-y-2 > * + * { margin-top: 8px; }
.mc-page .space-y-6 > * + * { margin-top: 24px; }
.mc-page .bg-white { background: #0f172a; border: 1px solid rgba(96,165,250,.18); box-shadow: 0 12px 28px rgba(0,0,0,.18); }
.mc-page .rounded-lg { border-radius: 10px; }
.mc-page .shadow { box-shadow: 0 14px 28px rgba(0,0,0,.22); }
.mc-page .border-b { border-bottom: 1px solid rgba(148,163,184,.16); }
.mc-page .divide-y > * + * { border-top: 1px solid rgba(148,163,184,.14); }
.mc-page .flex { display: flex; }
.mc-page .items-center { align-items: center; }
.mc-page .items-start { align-items: flex-start; }
.mc-page .justify-between { justify-content: space-between; }
.mc-page .flex-1 { flex: 1 1 0%; }
.mc-page .flex-col { flex-direction: column; }
.mc-page .flex-wrap { flex-wrap: wrap; }
.mc-page .shrink-0 { flex-shrink: 0; }
.mc-page .min-w-0 { min-width: 0; }
.mc-page .text-center { text-align: center; }
.mc-page .font-bold { font-weight: 800; }
.mc-page .font-semibold { font-weight: 700; }
.mc-page .font-medium { font-weight: 600; }
.mc-page .text-2xl { font-size: 1.6rem; line-height: 1.2; }
.mc-page .text-lg { font-size: 1rem; }
.mc-page .text-sm { font-size: .82rem; }
.mc-page .text-xs { font-size: .72rem; }
.mc-page .text-gray-900, .mc-page .text-gray-700 { color: #f1f5f9; }
.mc-page .text-gray-600, .mc-page .text-gray-500, .mc-page .text-gray-400 { color: #94a3b8; }
.mc-page .text-blue-600 { color: #60a5fa; }
.mc-page .text-green-600 { color: #34d399; }
.mc-page .text-orange-600, .mc-page .text-yellow-800 { color: #fbbf24; }
.mc-page .text-red-900, .mc-page .text-red-800, .mc-page .text-red-700, .mc-page .text-red-600, .mc-page .text-red-500, .mc-page .text-red-400 { color: #fca5a5; }
.mc-page .text-purple-600, .mc-page .text-purple-700 { color: #c4b5fd; }
.mc-page .bg-red-50, .mc-page .bg-red-100, .mc-page .bg-red-200 { background: rgba(239,68,68,.10); }
.mc-page .bg-yellow-50, .mc-page .bg-yellow-100 { background: rgba(245,158,11,.12); }
.mc-page .bg-green-100 { background: rgba(34,197,94,.12); }
.mc-page .bg-blue-100 { background: rgba(59,130,246,.14); }
.mc-page .bg-purple-100 { background: rgba(168,85,247,.14); }
.mc-page .bg-gray-50, .mc-page .hover\:bg-gray-50:hover { background: rgba(255,255,255,.035); }
.mc-page .bg-gray-100, .mc-page .bg-gray-200 { background: rgba(148,163,184,.12); }
.mc-page .bg-blue-600 { background: #2563eb; border: 1px solid rgba(96,165,250,.35); }
.mc-page .bg-red-600 { background: #dc2626; border: 1px solid rgba(252,165,165,.28); }
.mc-page .bg-green-500 { background: #16a34a; border: 1px solid rgba(134,239,172,.28); }
.mc-page .text-white { color: #fff; }
.mc-page .rounded-full { border-radius: 999px; }
.mc-page .rounded { border-radius: 6px; }
.mc-page .block { display: block; }
.mc-page .w-8 { width: 32px; }
.mc-page .h-8 { height: 32px; }
.mc-page .px-2 { padding-left: 8px; padding-right: 8px; }
.mc-page .px-3 { padding-left: 12px; padding-right: 12px; }
.mc-page .px-4 { padding-left: 16px; padding-right: 16px; }
.mc-page .py-0\.5 { padding-top: 2px; padding-bottom: 2px; }
.mc-page .py-1 { padding-top: 4px; padding-bottom: 4px; }
.mc-page .py-2 { padding-top: 8px; padding-bottom: 8px; }
.mc-page .mt-1 { margin-top: 4px; }
.mc-page .mt-2 { margin-top: 8px; }
.mc-page .task-complete { width: 17px; height: 17px; accent-color: #22c55e; }
.mc-page .rounded-full.bg-gray-200 { background: linear-gradient(135deg,#2563eb,#14b8a6); color: white; align-items: center; justify-content: center; }
.mc-page .lg\:col-span-2 { grid-column: span 2; }
@media (min-width: 768px) {
    .mc-page .md\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (min-width: 1024px) {
    .mc-page .lg\:grid-cols-3 { grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr); }
    .mc-page .lg\:grid-cols-6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
}
@media (max-width: 1023px) {
    .mc-page .lg\:col-span-2 { grid-column: auto; }
}
@media (max-width: 700px) {
    .mc-page { padding: 18px 14px; }
    .mc-page .grid-cols-2 { grid-template-columns: 1fr; }
}
</style>

<div class="mc-page p-6">
    <!-- Header -->
    <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Manager Command Center</h1>
        <p class="text-gray-600 mt-1">Welcome back, <?= htmlspecialchars($currentUserName) ?></p>
    </div>

    <!-- Quick Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4">
            <div class="text-sm text-gray-500">Team Size</div>
            <div class="text-2xl font-bold text-blue-600"><?= $stats['team_size'] ?></div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
            <div class="text-sm text-gray-500">Total Tasks</div>
            <div class="text-2xl font-bold text-gray-900"><?= $stats['total_tasks'] ?></div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
            <div class="text-sm text-gray-500">Completed</div>
            <div class="text-2xl font-bold text-green-600"><?= $stats['completed_tasks'] ?></div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
            <div class="text-sm text-gray-500">Due Today</div>
            <div class="text-2xl font-bold text-orange-600"><?= $stats['today_tasks'] ?></div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
            <div class="text-sm text-gray-500">Overdue</div>
            <div class="text-2xl font-bold text-red-600"><?= $stats['overdue_tasks'] ?></div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
            <div class="text-sm text-gray-500">Completion Rate</div>
            <div class="text-2xl font-bold text-purple-600"><?= $stats['completion_rate'] ?>%</div>
        </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main Column -->
        <div class="lg:col-span-2 space-y-6">
            <!-- Priority Tasks -->
            <div class="bg-white rounded-lg shadow">
                <div class="px-4 py-3 border-b flex justify-between items-center">
                    <h2 class="text-lg font-semibold text-gray-900">High Priority Tasks</h2>
                    <span class="text-xs text-gray-500">Priority 8+</span>
                </div>
                <div class="divide-y">
                    <?php if (empty($priorityTasks)): ?>
                        <div class="px-4 py-8 text-center text-gray-500">
                            No high priority tasks
                        </div>
                    <?php else: ?>
                        <?php foreach ($priorityTasks as $task): ?>
                            <?php
                                $priBg = ($task['priority'] === 'urgent') ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';
                                $stColor = !empty($task['store_color']) ? $task['store_color'] : '#6b7280';
                                $statusColors = ['todo'=>'bg-gray-100 text-gray-700','in_progress'=>'bg-blue-100 text-blue-700','review'=>'bg-purple-100 text-purple-700','completed'=>'bg-green-100 text-green-700'];
                                $stBadge = $statusColors[$task['status'] ?? 'todo'] ?? 'bg-gray-100 text-gray-700';
                            ?>
                            <div class="px-4 py-3 hover:bg-gray-50 flex items-start gap-4">
                                <div class="flex-1 min-w-0">
                                    <a href="/tasks/<?= $task['id'] ?>" class="font-medium text-gray-900 hover:text-blue-600">
                                        <?= htmlspecialchars($task['title']) ?>
                                    </a>
                                    <div class="flex flex-wrap items-center gap-2 mt-1">
                                        <?php if (!empty($task['store_name'])): ?>
                                        <span class="text-xs font-medium px-1.5 py-0.5 rounded" style="background:<?= htmlspecialchars($stColor) ?>22;color:<?= htmlspecialchars($stColor) ?>">
                                            🏪 <?= htmlspecialchars($task['store_name']) ?>
                                        </span>
                                        <?php endif; ?>
                                        <span class="text-xs text-gray-500">
                                            👤 <?= htmlspecialchars($task['assignee_name'] ?? 'Unassigned') ?>
                                        </span>
                                        <?php if (!empty($task['due_date'])): ?>
                                        <span class="text-xs text-gray-400">Due <?= date('M d', strtotime($task['due_date'])) ?></span>
                                        <?php endif; ?>
                                    </div>
                                </div>
                                <div class="flex flex-col items-end gap-1 shrink-0">
                                    <span class="px-2 py-0.5 text-xs font-semibold rounded-full <?= $priBg ?>">
                                        <?= ucfirst($task['priority'] ?? 'normal') ?>
                                    </span>
                                    <span class="px-2 py-0.5 text-xs rounded-full <?= $stBadge ?>">
                                        <?= ucfirst(str_replace('_',' ',$task['status'] ?? 'todo')) ?>
                                    </span>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Today's Tasks -->
            <div class="bg-white rounded-lg shadow">
                <div class="px-4 py-3 border-b flex justify-between items-center">
                    <h2 class="text-lg font-semibold text-gray-900">Today's Tasks</h2>
                    <a href="/tasks?filter=today" class="text-xs text-blue-600 hover:text-blue-800">View All</a>
                </div>
                <div class="divide-y">
                    <?php if (empty($todayTasks)): ?>
                        <div class="px-4 py-8 text-center text-gray-500">
                            No tasks due today
                        </div>
                    <?php else: ?>
                        <?php foreach ($todayTasks as $task): ?>
                            <?php
                                $priBg2 = ($task['priority'] === 'urgent') ? 'bg-red-100 text-red-800' : (($task['priority'] === 'high') ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600');
                                $stColor2 = !empty($task['store_color']) ? $task['store_color'] : '#6b7280';
                                $statusColors2 = ['todo'=>'bg-gray-100 text-gray-700','in_progress'=>'bg-blue-100 text-blue-700','review'=>'bg-purple-100 text-purple-700','completed'=>'bg-green-100 text-green-700'];
                                $stBadge2 = $statusColors2[$task['status'] ?? 'todo'] ?? 'bg-gray-100 text-gray-700';
                            ?>
                            <div class="px-4 py-3 hover:bg-gray-50 flex items-start gap-3">
                                <input type="checkbox" class="task-complete rounded border-gray-300 mt-1" data-id="<?= $task['id'] ?>">
                                <div class="flex-1 min-w-0">
                                    <a href="/tasks/<?= $task['id'] ?>" class="font-medium text-gray-900 hover:text-blue-600">
                                        <?= htmlspecialchars($task['title']) ?>
                                    </a>
                                    <div class="flex flex-wrap items-center gap-2 mt-1">
                                        <?php if (!empty($task['store_name'])): ?>
                                        <span class="text-xs font-medium px-1.5 py-0.5 rounded" style="background:<?= htmlspecialchars($stColor2) ?>22;color:<?= htmlspecialchars($stColor2) ?>">
                                            🏪 <?= htmlspecialchars($task['store_name']) ?>
                                        </span>
                                        <?php endif; ?>
                                        <span class="text-xs text-gray-500">👤 <?= htmlspecialchars($task['assignee_name'] ?? 'Unassigned') ?></span>
                                        <span class="px-2 py-0.5 text-xs font-semibold rounded-full <?= $priBg2 ?>"><?= ucfirst($task['priority'] ?? 'normal') ?></span>
                                        <span class="px-2 py-0.5 text-xs rounded-full <?= $stBadge2 ?>"><?= ucfirst(str_replace('_',' ',$task['status'] ?? 'todo')) ?></span>
                                    </div>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Overdue Tasks -->
            <div class="bg-white rounded-lg shadow">
                <div class="px-4 py-3 border-b bg-red-50">
                    <h2 class="text-lg font-semibold text-red-900">Overdue Tasks</h2>
                </div>
                <div class="divide-y">
                    <?php if (empty($overdueTasks)): ?>
                        <div class="px-4 py-8 text-center text-green-600">
                            No overdue tasks!
                        </div>
                    <?php else: ?>
                        <?php foreach ($overdueTasks as $task): ?>
                            <?php
                                $priBg3 = ($task['priority'] === 'urgent') ? 'bg-red-200 text-red-900' : (($task['priority'] === 'high') ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600');
                                $stColor3 = !empty($task['store_color']) ? $task['store_color'] : '#6b7280';
                                $statusColors3 = ['todo'=>'bg-gray-100 text-gray-700','in_progress'=>'bg-blue-100 text-blue-700','review'=>'bg-purple-100 text-purple-700','completed'=>'bg-green-100 text-green-700'];
                                $stBadge3 = $statusColors3[$task['status'] ?? 'todo'] ?? 'bg-gray-100 text-gray-700';
                            ?>
                            <div class="px-4 py-3 hover:bg-gray-50 flex items-start gap-4">
                                <div class="flex-1 min-w-0">
                                    <a href="/tasks/<?= $task['id'] ?>" class="font-medium text-red-700 hover:text-red-900">
                                        <?= htmlspecialchars($task['title']) ?>
                                    </a>
                                    <div class="flex flex-wrap items-center gap-2 mt-1">
                                        <?php if (!empty($task['store_name'])): ?>
                                        <span class="text-xs font-medium px-1.5 py-0.5 rounded" style="background:<?= htmlspecialchars($stColor3) ?>22;color:<?= htmlspecialchars($stColor3) ?>">
                                            🏪 <?= htmlspecialchars($task['store_name']) ?>
                                        </span>
                                        <?php endif; ?>
                                        <span class="text-xs text-red-500">👤 <?= htmlspecialchars($task['assignee_name'] ?? 'Unassigned') ?></span>
                                        <span class="text-xs text-red-400">Due <?= date('M d', strtotime($task['due_date'])) ?> (<?= floor((time() - strtotime($task['due_date'])) / 86400) ?> days ago)</span>
                                        <span class="px-2 py-0.5 text-xs font-semibold rounded-full <?= $priBg3 ?>"><?= ucfirst($task['priority'] ?? 'normal') ?></span>
                                        <span class="px-2 py-0.5 text-xs rounded-full <?= $stBadge3 ?>"><?= ucfirst(str_replace('_',' ',$task['status'] ?? 'todo')) ?></span>
                                    </div>
                                </div>
                                <a href="/tasks/<?= $task['id'] ?>/toggle" class="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 shrink-0">
                                    Complete
                                </a>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Recent Activity -->
            <div class="bg-white rounded-lg shadow">
                <div class="px-4 py-3 border-b">
                    <h2 class="text-lg font-semibold text-gray-900">Recent Activity (7 days)</h2>
                </div>
                <div class="divide-y">
                    <?php if (empty($recentActivity)): ?>
                        <div class="px-4 py-8 text-center text-gray-500">
                            No recent activity
                        </div>
                    <?php else: ?>
                        <?php foreach (array_slice($recentActivity, 0, 10) as $activity): ?>
                            <div class="px-4 py-3 flex items-center gap-3">
                                <span class="text-lg">
                                    <?= $activity['type'] === 'task_completed' ? '✅' : '📝' ?>
                                </span>
                                <div class="flex-1">
                                    <div class="text-sm text-gray-900">
                                        <?= $activity['type'] === 'task_completed' ? 'Completed' : 'Created' ?>
                                        <a href="#" class="font-medium hover:text-blue-600">
                                            <?= htmlspecialchars(substr($activity['title'], 0, 50)) ?>
                                        </a>
                                    </div>
                                    <div class="text-xs text-gray-500">
                                        by <?= htmlspecialchars($activity['actor_name'] ?? 'Unknown') ?>
                                        &bull; <?= timeAgo($activity['action_time']) ?>
                                    </div>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
            <!-- Quick Actions -->
            <div class="bg-white rounded-lg shadow">
                <div class="px-4 py-3 border-b">
                    <h2 class="text-lg font-semibold text-gray-900">Quick Actions</h2>
                </div>
                <div class="p-4 space-y-2">
                    <a href="/tasks/create" class="block px-4 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700">
                        + Create Task
                    </a>
                    <a href="/admin/incidents/create" class="block px-4 py-2 bg-red-600 text-white text-center rounded-lg hover:bg-red-700">
                        + Report Incident
                    </a>
                    <a href="/team" class="block px-4 py-2 bg-gray-100 text-gray-700 text-center rounded-lg hover:bg-gray-200">
                        Team Overview
                    </a>
                    <a href="/calendar" class="block px-4 py-2 bg-gray-100 text-gray-700 text-center rounded-lg hover:bg-gray-200">
                        Calendar View
                    </a>
                </div>
            </div>

            <!-- Alerts -->
            <div class="bg-white rounded-lg shadow">
                <div class="px-4 py-3 border-b">
                    <h2 class="text-lg font-semibold text-gray-900">Alerts</h2>
                </div>
                <div class="divide-y">
                    <?php if ($stats['overdue_tasks'] > 0): ?>
                        <div class="px-4 py-3 flex items-center gap-3 bg-red-50">
                            <span class="text-red-500">⚠️</span>
                            <div>
                                <div class="font-medium text-red-900"><?= $stats['overdue_tasks'] ?> Overdue Tasks</div>
                                <a href="/tasks?filter=overdue" class="text-xs text-red-600">View all</a>
                            </div>
                        </div>
                    <?php endif; ?>
                    <?php if (($pendingApprovals['cnt'] ?? 0) > 0): ?>
                        <div class="px-4 py-3 flex items-center gap-3 bg-yellow-50">
                            <span class="text-yellow-500">⏳</span>
                            <div>
                                <div class="font-medium text-yellow-900"><?= $pendingApprovals['cnt'] ?> Pending Approvals</div>
                                <a href="/deadline-extensions" class="text-xs text-yellow-600">Review</a>
                            </div>
                        </div>
                    <?php endif; ?>
                    <?php if (($openIncidents['cnt'] ?? 0) > 0): ?>
                        <div class="px-4 py-3 flex items-center gap-3 bg-orange-50">
                            <span class="text-orange-500">🚨</span>
                            <div>
                                <div class="font-medium text-orange-900"><?= $openIncidents['cnt'] ?> Open Incidents</div>
                                <a href="/admin/incidents" class="text-xs text-orange-600">View all</a>
                            </div>
                        </div>
                    <?php endif; ?>
                    <?php if ($stats['overdue_tasks'] == 0 && ($pendingApprovals['cnt'] ?? 0) == 0 && ($openIncidents['cnt'] ?? 0) == 0): ?>
                        <div class="px-4 py-8 text-center text-green-600">
                            <div class="text-3xl mb-2">✨</div>
                            <div>All clear!</div>
                        </div>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Team Overview -->
            <div class="bg-white rounded-lg shadow">
                <div class="px-4 py-3 border-b flex justify-between items-center">
                    <h2 class="text-lg font-semibold text-gray-900">Team</h2>
                    <a href="/team" class="text-xs text-blue-600 hover:text-blue-800">Manage</a>
                </div>
                <div class="divide-y">
                    <?php foreach ($teamMembers as $member): ?>
                        <div class="px-4 py-3 flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                                <?= strtoupper(substr($member['name'], 0, 1)) ?>
                            </div>
                            <div class="flex-1">
                                <div class="font-medium text-gray-900"><?= htmlspecialchars($member['name']) ?></div>
                                <div class="text-xs text-gray-500">
                                    <?= $member['completed_tasks'] ?>/<?= $member['total_tasks'] ?> completed
                                    <?php if ($member['overdue_tasks'] > 0): ?>
                                        <span class="text-red-500">(<?= $member['overdue_tasks'] ?> overdue)</span>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
// Task completion via AJAX
document.querySelectorAll('.task-complete').forEach(checkbox => {
    checkbox.addEventListener('change', async function() {
        const taskId = this.dataset.id;
        try {
            const response = await fetch(`/tasks/${taskId}/toggle`, {
                method: 'POST'
            });
            if (response.ok) {
                this.closest('tr, .divide-y > div').remove();
            }
        } catch (error) {
            console.error('Error:', error);
            this.checked = !this.checked;
        }
    });
});

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago';
    return date.toLocaleDateString();
}
</script>
