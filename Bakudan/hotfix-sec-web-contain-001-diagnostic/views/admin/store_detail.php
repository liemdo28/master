<?php
/**
 * Store Command Center - Store Detail Page
 */
$pageTitle = $store['name'] . ' - Command Center';
?>

<div class="p-6">
    <!-- Breadcrumb -->
    <div class="mb-4">
        <a href="/admin/stores" class="text-blue-600 hover:text-blue-800">&larr; All Stores</a>
    </div>

    <!-- Header -->
    <div class="bg-white rounded-lg shadow mb-6 p-6">
        <div class="flex justify-between items-start">
            <div>
                <div class="flex items-center gap-3 mb-2">
                    <h1 class="text-2xl font-bold text-gray-900"><?= htmlspecialchars($store['name']) ?></h1>
                    <span class="px-3 py-1 text-sm font-semibold rounded-full 
                        <?= ($store['is_active'] ?? 1) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' ?>">
                        <?= ($store['is_active'] ?? 1) ? 'Active' : 'Inactive' ?>
                    </span>
                </div>
                <div class="text-sm text-gray-500">
                    <?= htmlspecialchars($store['address'] ?? 'No address') ?>
                    <?php if (!empty($store['region_name'])): ?>
                        &bull; Region: <?= htmlspecialchars($store['region_name']) ?>
                    <?php endif; ?>
                    <?php if (!empty($store['district_name'])): ?>
                        &bull; District: <?= htmlspecialchars($store['district_name']) ?>
                    <?php endif; ?>
                </div>
            </div>
            <div class="flex gap-2">
                <a href="/admin/stores/<?= $storeId ?>/edit" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                    Edit Store
                </a>
                <a href="/admin/incidents/create?store_id=<?= $storeId ?>" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                    + Report Issue
                </a>
            </div>
        </div>
    </div>

    <!-- Health Score -->
    <div class="bg-white rounded-lg shadow mb-6 p-6">
        <div class="flex items-center gap-6">
            <div class="relative w-32 h-32">
                <svg class="w-32 h-32 transform -rotate-90">
                    <circle cx="64" cy="64" r="58" stroke="#e5e7eb" stroke-width="8" fill="none" />
                    <circle cx="64" cy="64" r="58" stroke="<?= $healthScore >= 70 ? '#10b981' : ($healthScore >= 40 ? '#f59e0b' : '#ef4444') ?>" 
                            stroke-width="8" fill="none"
                            stroke-dasharray="<?= $healthScore * 3.64 ?> 364"
                            stroke-linecap="round" />
                </svg>
                <div class="absolute inset-0 flex items-center justify-center">
                    <span class="text-3xl font-bold <?= $healthScore >= 70 ? 'text-green-600' : ($healthScore >= 40 ? 'text-yellow-600' : 'text-red-600') ?>">
                        <?= $healthScore ?>
                    </span>
                </div>
            </div>
            <div>
                <div class="text-lg font-semibold text-gray-900">Store Health Score</div>
                <div class="text-sm text-gray-500">
                    <?= $healthScore >= 70 ? 'Excellent - All systems operational' : ($healthScore >= 40 ? 'Warning - Some issues need attention' : 'Critical - Immediate action required') ?>
                </div>
                <div class="mt-2 flex gap-2">
                    <span class="px-2 py-1 text-xs rounded bg-gray-100">Tasks: <?= $metrics['task_completion'] ?>%</span>
                    <span class="px-2 py-1 text-xs rounded bg-gray-100">Incidents: <?= $metrics['open_incidents'] ?></span>
                    <span class="px-2 py-1 text-xs rounded bg-gray-100">Compliance: <?= $metrics['compliance_score'] ?>%</span>
                </div>
            </div>
        </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main Column -->
        <div class="lg:col-span-2 space-y-6">
            <!-- Quick Stats -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="text-sm text-gray-500">Active Tasks</div>
                    <div class="text-2xl font-bold text-blue-600"><?= $metrics['active_tasks'] ?></div>
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="text-sm text-gray-500">Overdue Tasks</div>
                    <div class="text-2xl font-bold text-red-600"><?= $metrics['overdue_tasks'] ?></div>
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="text-sm text-gray-500">Open Incidents</div>
                    <div class="text-2xl font-bold text-orange-600"><?= $metrics['open_incidents'] ?></div>
                </div>
                <div class="bg-white rounded-lg shadow p-4">
                    <div class="text-sm text-gray-500">Staff Count</div>
                    <div class="text-2xl font-bold text-purple-600"><?= $metrics['staff_count'] ?></div>
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
                            No overdue tasks
                        </div>
                    <?php else: ?>
                        <?php foreach (array_slice($overdueTasks, 0, 5) as $task): ?>
                            <div class="px-4 py-3 flex items-center gap-4 hover:bg-gray-50">
                                <div class="flex-1">
                                    <a href="/tasks/<?= $task['id'] ?>" class="font-medium text-red-700 hover:text-red-900">
                                        <?= htmlspecialchars($task['title']) ?>
                                    </a>
                                    <div class="text-xs text-red-500">
                                        Due <?= date('M d', strtotime($task['due_date'])) ?>
                                        (<?= floor((time() - strtotime($task['due_date'])) / 86400) ?> days overdue)
                                    </div>
                                </div>
                                <a href="/tasks/<?= $task['id'] ?>/toggle" class="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600">
                                    Complete
                                </a>
                            </div>
                        <?php endforeach; ?>
                        <?php if (count($overdueTasks) > 5): ?>
                            <div class="px-4 py-2 text-center">
                                <a href="/tasks?store_id=<?= $storeId ?>&filter=overdue" class="text-sm text-red-600 hover:text-red-800">
                                    View all <?= count($overdueTasks) ?> overdue tasks
                                </a>
                            </div>
                        <?php endif; ?>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Today's Tasks -->
            <div class="bg-white rounded-lg shadow">
                <div class="px-4 py-3 border-b">
                    <h2 class="text-lg font-semibold text-gray-900">Today's Tasks</h2>
                </div>
                <div class="divide-y">
                    <?php if (empty($todayTasks)): ?>
                        <div class="px-4 py-8 text-center text-gray-500">
                            No tasks due today
                        </div>
                    <?php else: ?>
                        <?php foreach (array_slice($todayTasks, 0, 10) as $task): ?>
                            <div class="px-4 py-3 flex items-center gap-4 hover:bg-gray-50">
                                <input type="checkbox" class="task-toggle rounded" data-id="<?= $task['id'] ?>">
                                <div class="flex-1">
                                    <a href="/tasks/<?= $task['id'] ?>" class="font-medium text-gray-900 hover:text-blue-600">
                                        <?= htmlspecialchars($task['title']) ?>
                                    </a>
                                    <div class="text-xs text-gray-500">
                                        <?= htmlspecialchars($task['assignee_name'] ?? 'Unassigned') ?>
                                    </div>
                                </div>
                                <?php if ($task['priority'] >= 8): ?>
                                    <span class="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-800">
                                        P<?= $task['priority'] ?>
                                    </span>
                                <?php endif; ?>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Recent Incidents -->
            <div class="bg-white rounded-lg shadow">
                <div class="px-4 py-3 border-b flex justify-between items-center">
                    <h2 class="text-lg font-semibold text-gray-900">Recent Incidents</h2>
                    <a href="/admin/incidents?store_id=<?= $storeId ?>" class="text-sm text-blue-600 hover:text-blue-800">View all</a>
                </div>
                <div class="divide-y">
                    <?php if (empty($incidents)): ?>
                        <div class="px-4 py-8 text-center text-gray-500">
                            No incidents at this store
                        </div>
                    <?php else: ?>
                        <?php foreach (array_slice($incidents, 0, 5) as $incident): ?>
                            <div class="px-4 py-3 hover:bg-gray-50">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="px-2 py-0.5 text-xs font-semibold rounded 
                                        <?= $incident['severity'] === 'critical' ? 'bg-red-100 text-red-800' : ($incident['severity'] === 'high' ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800') ?>">
                                        <?= ucfirst($incident['severity']) ?>
                                    </span>
                                    <span class="px-2 py-0.5 text-xs font-semibold rounded 
                                        <?= $incident['status'] === 'open' ? 'bg-gray-100 text-gray-800' : ($incident['status'] === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800') ?>">
                                        <?= ucfirst($incident['status']) ?>
                                    </span>
                                </div>
                                <a href="/admin/incidents/<?= $incident['id'] ?>" class="font-medium text-gray-900 hover:text-blue-600">
                                    <?= htmlspecialchars($incident['title']) ?>
                                </a>
                                <div class="text-xs text-gray-500 mt-1">
                                    Created <?= date('M d, Y', strtotime($incident['created_at'])) ?>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Bills Summary -->
            <div class="bg-white rounded-lg shadow">
                <div class="px-4 py-3 border-b flex justify-between items-center">
                    <h2 class="text-lg font-semibold text-gray-900">Bills This Month</h2>
                    <a href="/bills/store/<?= $storeId ?>" class="text-sm text-blue-600 hover:text-blue-800">View all</a>
                </div>
                <div class="grid grid-cols-3 divide-x">
                    <div class="px-4 py-3 text-center">
                        <div class="text-sm text-gray-500">Pending</div>
                        <div class="text-xl font-bold text-orange-600"><?= number_format($billsSummary['pending_amount'], 0) ?></div>
                        <div class="text-xs text-gray-500"><?= $billsSummary['pending_count'] ?> bills</div>
                    </div>
                    <div class="px-4 py-3 text-center">
                        <div class="text-sm text-gray-500">Paid</div>
                        <div class="text-xl font-bold text-green-600"><?= number_format($billsSummary['paid_amount'], 0) ?></div>
                        <div class="text-xs text-gray-500"><?= $billsSummary['paid_count'] ?> bills</div>
                    </div>
                    <div class="px-4 py-3 text-center">
                        <div class="text-sm text-gray-500">Overdue</div>
                        <div class="text-xl font-bold text-red-600"><?= number_format($billsSummary['overdue_amount'], 0) ?></div>
                        <div class="text-xs text-gray-500"><?= $billsSummary['overdue_count'] ?> bills</div>
                    </div>
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
                    <a href="/tasks/create?store_id=<?= $storeId ?>" class="block px-4 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700">
                        + Create Task
                    </a>
                    <a href="/admin/incidents/create?store_id=<?= $storeId ?>" class="block px-4 py-2 bg-red-600 text-white text-center rounded-lg hover:bg-red-700">
                        + Report Incident
                    </a>
                    <a href="/store/checklist/open?store_id=<?= $storeId ?>" class="block px-4 py-2 bg-green-600 text-white text-center rounded-lg hover:bg-green-700">
                        Open Store
                    </a>
                    <a href="/store/checklist/close?store_id=<?= $storeId ?>" class="block px-4 py-2 bg-purple-600 text-white text-center rounded-lg hover:bg-purple-700">
                        Close Store
                    </a>
                </div>
            </div>

            <!-- Store Info -->
            <div class="bg-white rounded-lg shadow">
                <div class="px-4 py-3 border-b">
                    <h2 class="text-lg font-semibold text-gray-900">Store Info</h2>
                </div>
                <div class="p-4 space-y-3">
                    <?php if (!empty($store['address'])): ?>
                        <div>
                            <div class="text-xs text-gray-500">Address</div>
                            <div class="text-sm"><?= htmlspecialchars($store['address']) ?></div>
                        </div>
                    <?php endif; ?>
                    <?php if (!empty($store['phone'])): ?>
                        <div>
                            <div class="text-xs text-gray-500">Phone</div>
                            <div class="text-sm"><?= htmlspecialchars($store['phone']) ?></div>
                        </div>
                    <?php endif; ?>
                    <?php if (!empty($store['manager_name'])): ?>
                        <div>
                            <div class="text-xs text-gray-500">Manager</div>
                            <div class="text-sm"><?= htmlspecialchars($store['manager_name']) ?></div>
                        </div>
                    <?php endif; ?>
                    <?php if (!empty($store['region_name'])): ?>
                        <div>
                            <div class="text-xs text-gray-500">Region</div>
                            <div class="text-sm"><?= htmlspecialchars($store['region_name']) ?></div>
                        </div>
                    <?php endif; ?>
                    <?php if (!empty($store['district_name'])): ?>
                        <div>
                            <div class="text-xs text-gray-500">District</div>
                            <div class="text-sm"><?= htmlspecialchars($store['district_name']) ?></div>
                        </div>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Staff List -->
            <div class="bg-white rounded-lg shadow">
                <div class="px-4 py-3 border-b flex justify-between items-center">
                    <h2 class="text-lg font-semibold text-gray-900">Staff</h2>
                    <span class="text-sm text-gray-500"><?= $metrics['staff_count'] ?></span>
                </div>
                <div class="divide-y max-h-64 overflow-y-auto">
                    <?php if (empty($staff)): ?>
                        <div class="px-4 py-4 text-center text-gray-500">
                            No staff assigned
                        </div>
                    <?php else: ?>
                        <?php foreach ($staff as $member): ?>
                            <div class="px-4 py-3 flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                                    <?= strtoupper(substr($member['name'], 0, 1)) ?>
                                </div>
                                <div class="flex-1">
                                    <div class="font-medium text-gray-900"><?= htmlspecialchars($member['name']) ?></div>
                                    <div class="text-xs text-gray-500"><?= htmlspecialchars($member['role']) ?></div>
                                </div>
                                <div class="text-xs text-gray-500">
                                    <?= $member['completed_tasks'] ?>/<?= $member['total_tasks'] ?>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>

            <!-- Recent Activity -->
            <div class="bg-white rounded-lg shadow">
                <div class="px-4 py-3 border-b">
                    <h2 class="text-lg font-semibold text-gray-900">Recent Activity</h2>
                </div>
                <div class="divide-y max-h-64 overflow-y-auto">
                    <?php if (empty($recentActivity)): ?>
                        <div class="px-4 py-4 text-center text-gray-500">
                            No recent activity
                        </div>
                    <?php else: ?>
                        <?php foreach (array_slice($recentActivity, 0, 10) as $activity): ?>
                            <div class="px-4 py-2 text-sm">
                                <div class="text-gray-900"><?= htmlspecialchars($activity['description']) ?></div>
                                <div class="text-xs text-gray-500"><?= timeAgo($activity['created_at']) ?></div>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
document.querySelectorAll('.task-toggle').forEach(checkbox => {
    checkbox.addEventListener('change', async function() {
        const id = this.dataset.id;
        try {
            await fetch(`/tasks/${id}/toggle`, { method: 'POST' });
            this.closest('.divide-y > div').remove();
        } catch (e) {
            this.checked = !this.checked;
        }
    });
});

function timeAgo(dateString) {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
}
</script>
