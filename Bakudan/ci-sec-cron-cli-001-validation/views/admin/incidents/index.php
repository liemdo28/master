<?php
/**
 * Admin Incidents - Index Page
 */
$pageTitle = 'Incident Management';
?>

<div class="p-6">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">Incident Management</h1>
            <p class="text-gray-600 mt-1">Track and manage operational incidents</p>
        </div>
        <a href="/admin/incidents/create" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            + Report Incident
        </a>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <div class="text-2xl font-bold text-red-600"><?= $stats['total'] ?? 0 ?></div>
            <div class="text-sm text-gray-500">Total</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <div class="text-2xl font-bold text-orange-600"><?= $stats['open'] ?? 0 ?></div>
            <div class="text-sm text-gray-500">Open</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div class="text-2xl font-bold text-yellow-600"><?= $stats['acknowledged'] ?? 0 ?></div>
            <div class="text-sm text-gray-500">Acknowledged</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div class="text-2xl font-bold text-blue-600"><?= $stats['investigating'] ?? 0 ?></div>
            <div class="text-sm text-gray-500">Investigating</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div class="text-2xl font-bold text-green-600"><?= $stats['resolved'] ?? 0 ?></div>
            <div class="text-sm text-gray-500">Resolved</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div class="text-2xl font-bold text-purple-600"><?= $stats['critical'] ?? 0 ?></div>
            <div class="text-sm text-gray-500">Critical</div>
        </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-lg shadow mb-6 p-4">
        <form method="GET" action="/admin/incidents" class="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input type="text" name="search" value="<?= htmlspecialchars($filters['search']) ?>" 
                       placeholder="Search incidents..." 
                       class="w-full px-3 py-2 border rounded-lg">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select name="status" class="w-full px-3 py-2 border rounded-lg">
                    <option value="">All Status</option>
                    <option value="open" <?= $filters['status'] === 'open' ? 'selected' : '' ?>>Open</option>
                    <option value="acknowledged" <?= $filters['status'] === 'acknowledged' ? 'selected' : '' ?>>Acknowledged</option>
                    <option value="investigating" <?= $filters['status'] === 'investigating' ? 'selected' : '' ?>>Investigating</option>
                    <option value="resolved" <?= $filters['status'] === 'resolved' ? 'selected' : '' ?>>Resolved</option>
                    <option value="closed" <?= $filters['status'] === 'closed' ? 'selected' : '' ?>>Closed</option>
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                <select name="severity" class="w-full px-3 py-2 border rounded-lg">
                    <option value="">All Severity</option>
                    <option value="critical" <?= $filters['severity'] === 'critical' ? 'selected' : '' ?>>Critical</option>
                    <option value="high" <?= $filters['severity'] === 'high' ? 'selected' : '' ?>>High</option>
                    <option value="medium" <?= $filters['severity'] === 'medium' ? 'selected' : '' ?>>Medium</option>
                    <option value="low" <?= $filters['severity'] === 'low' ? 'selected' : '' ?>>Low</option>
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Store</label>
                <select name="store_id" class="w-full px-3 py-2 border rounded-lg">
                    <option value="">All Stores</option>
                    <?php foreach ($stores as $store): ?>
                        <option value="<?= $store['id'] ?>" <?= $filters['store_id'] == $store['id'] ? 'selected' : '' ?>>
                            <?= htmlspecialchars($store['name']) ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input type="date" name="from_date" value="<?= $filters['from_date'] ?>" 
                       class="w-full px-3 py-2 border rounded-lg">
            </div>
            <div class="flex items-end gap-2">
                <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Filter
                </button>
                <a href="/admin/incidents" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                    Clear
                </a>
            </div>
        </form>
    </div>

    <!-- Incidents Table -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
                <?php if (empty($incidents)): ?>
                    <tr>
                        <td colspan="8" class="px-4 py-8 text-center text-gray-500">
                            No incidents found
                        </td>
                    </tr>
                <?php else: ?>
                    <?php foreach ($incidents as $incident): ?>
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-3 text-sm text-gray-500">#<?= $incident['id'] ?></td>
                            <td class="px-4 py-3">
                                <span class="px-2 py-1 text-xs font-semibold rounded-full 
                                    <?php
                                    $severityColors = [
                                        'critical' => 'bg-red-100 text-red-800',
                                        'high' => 'bg-orange-100 text-orange-800',
                                        'medium' => 'bg-yellow-100 text-yellow-800',
                                        'low' => 'bg-green-100 text-green-800'
                                    ];
                                    echo $severityColors[$incident['severity']] ?? 'bg-gray-100 text-gray-800';
                                    ?>">
                                    <?= ucfirst($incident['severity']) ?>
                                </span>
                            </td>
                            <td class="px-4 py-3">
                                <a href="/admin/incidents/<?= $incident['id'] ?>" class="text-blue-600 hover:text-blue-800 font-medium">
                                    <?= htmlspecialchars($incident['title']) ?>
                                </a>
                                <?php if ($incident['category']): ?>
                                    <div class="text-xs text-gray-500"><?= htmlspecialchars($incident['category']) ?></div>
                                <?php endif; ?>
                            </td>
                            <td class="px-4 py-3">
                                <span class="px-2 py-1 text-xs font-semibold rounded-full 
                                    <?php
                                    $statusColors = [
                                        'open' => 'bg-gray-100 text-gray-800',
                                        'acknowledged' => 'bg-yellow-100 text-yellow-800',
                                        'investigating' => 'bg-blue-100 text-blue-800',
                                        'resolved' => 'bg-green-100 text-green-800',
                                        'closed' => 'bg-purple-100 text-purple-800',
                                        'cancelled' => 'bg-red-100 text-red-800'
                                    ];
                                    echo $statusColors[$incident['status']] ?? 'bg-gray-100 text-gray-800';
                                    ?>">
                                    <?= ucfirst($incident['status']) ?>
                                </span>
                            </td>
                            <td class="px-4 py-3 text-sm text-gray-600">
                                <?= $incident['store_name'] ? htmlspecialchars($incident['store_name']) : '-' ?>
                            </td>
                            <td class="px-4 py-3 text-sm text-gray-600">
                                <?= $incident['assigned_to_name'] ? htmlspecialchars($incident['assigned_to_name']) : '-' ?>
                            </td>
                            <td class="px-4 py-3 text-sm text-gray-500">
                                <?= date('M d, Y', strtotime($incident['created_at'])) ?>
                            </td>
                            <td class="px-4 py-3">
                                <a href="/admin/incidents/<?= $incident['id'] ?>" 
                                   class="text-blue-600 hover:text-blue-800 text-sm">
                                    View
                                </a>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>

        <!-- Pagination -->
        <?php if ($pagination['total_pages'] > 1): ?>
            <div class="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <div class="text-sm text-gray-500">
                    Showing <?= (($pagination['page'] - 1) * $pagination['limit']) + 1 ?> to 
                    <?= min($pagination['page'] * $pagination['limit'], $pagination['total']) ?> of 
                    <?= $pagination['total'] ?> results
                </div>
                <div class="flex gap-2">
                    <?php if ($pagination['page'] > 1): ?>
                        <a href="?page=<?= $pagination['page'] - 1 ?>&status=<?= urlencode($filters['status']) ?>&severity=<?= urlencode($filters['severity']) ?>&search=<?= urlencode($filters['search']) ?>" 
                           class="px-3 py-1 bg-white border rounded hover:bg-gray-50">Previous</a>
                    <?php endif; ?>
                    <?php if ($pagination['page'] < $pagination['total_pages']): ?>
                        <a href="?page=<?= $pagination['page'] + 1 ?>&status=<?= urlencode($filters['status']) ?>&severity=<?= urlencode($filters['severity']) ?>&search=<?= urlencode($filters['search']) ?>" 
                           class="px-3 py-1 bg-white border rounded hover:bg-gray-50">Next</a>
                    <?php endif; ?>
                </div>
            </div>
        <?php endif; ?>
    </div>
</div>
