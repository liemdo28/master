<?php
/**
 * Admin Payroll - Index Page
 */
$pageTitle = 'Payroll Center';
?>

<div class="p-6">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">Payroll Center</h1>
            <p class="text-gray-600 mt-1">Manage employee payroll runs and payments</p>
        </div>
        <a href="/admin/payroll/create" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            + New Payroll Run
        </a>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4">
            <div class="text-sm text-gray-500">This Month Gross</div>
            <div class="text-2xl font-bold text-gray-900"><?= number_format($stats['this_month']['gross'], 0) ?> VND</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
            <div class="text-sm text-gray-500">This Month Net</div>
            <div class="text-2xl font-bold text-green-600"><?= number_format($stats['this_month']['net'], 0) ?> VND</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
            <div class="text-sm text-gray-500">YTD Total</div>
            <div class="text-2xl font-bold text-blue-600"><?= number_format($stats['ytd']['net'], 0) ?> VND</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
            <div class="text-sm text-gray-500">Pending Payments</div>
            <div class="text-2xl font-bold text-orange-600"><?= $stats['pending']['count'] ?></div>
            <div class="text-xs text-gray-500"><?= number_format($stats['pending']['total'], 0) ?> VND</div>
        </div>
    </div>

    <!-- Payroll Runs Table -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
        <div class="px-4 py-3 border-b">
            <h2 class="text-lg font-semibold text-gray-900">Payroll Runs</h2>
        </div>
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employees</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Net</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
                <?php if (empty($runs)): ?>
                    <tr>
                        <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                            No payroll runs found. <a href="/admin/payroll/create" class="text-blue-600">Create one</a>
                        </td>
                    </tr>
                <?php else: ?>
                    <?php foreach ($runs as $run): ?>
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-3">
                                <a href="/admin/payroll/<?= $run['id'] ?>" class="text-blue-600 hover:text-blue-800 font-medium">
                                    <?= htmlspecialchars($run['name']) ?>
                                </a>
                                <div class="text-xs text-gray-500">
                                    By <?= htmlspecialchars($run['created_by_name'] ?? 'Unknown') ?>
                                </div>
                            </td>
                            <td class="px-4 py-3 text-sm text-gray-600">
                                <?= date('M d', strtotime($run['period_start'])) ?> - <?= date('M d, Y', strtotime($run['period_end'])) ?>
                            </td>
                            <td class="px-4 py-3">
                                <?php
                                $statusColors = [
                                    'draft' => 'bg-gray-100 text-gray-800',
                                    'processing' => 'bg-yellow-100 text-yellow-800',
                                    'completed' => 'bg-green-100 text-green-800',
                                    'cancelled' => 'bg-red-100 text-red-800'
                                ];
                                ?>
                                <span class="px-2 py-1 text-xs font-semibold rounded-full <?= $statusColors[$run['status']] ?? '' ?>">
                                    <?= ucfirst($run['status']) ?>
                                </span>
                            </td>
                            <td class="px-4 py-3 text-sm text-gray-600"><?= $run['employee_count'] ?></td>
                            <td class="px-4 py-3 text-sm font-medium text-gray-900"><?= number_format($run['total_net'], 0) ?> VND</td>
                            <td class="px-4 py-3">
                                <a href="/admin/payroll/<?= $run['id'] ?>" class="text-blue-600 hover:text-blue-800 text-sm">View</a>
                                <?php if ($run['status'] === 'draft'): ?>
                                    | <a href="/admin/payroll/<?= $run['id'] ?>/process" class="text-green-600 hover:text-green-800 text-sm">Process</a>
                                <?php elseif ($run['status'] === 'processing'): ?>
                                    | <a href="/admin/payroll/<?= $run['id'] ?>/complete" class="text-green-600 hover:text-green-800 text-sm">Complete</a>
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>

        <?php if ($pagination['total_pages'] > 1): ?>
            <div class="px-4 py-3 bg-gray-50 border-t flex justify-between items-center">
                <div class="text-sm text-gray-500">
                    Page <?= $pagination['page'] ?> of <?= $pagination['total_pages'] ?>
                </div>
                <div class="flex gap-2">
                    <?php if ($pagination['page'] > 1): ?>
                        <a href="?page=<?= $pagination['page'] - 1 ?>" class="px-3 py-1 bg-white border rounded hover:bg-gray-50">Previous</a>
                    <?php endif; ?>
                    <?php if ($pagination['page'] < $pagination['total_pages']): ?>
                        <a href="?page=<?= $pagination['page'] + 1 ?>" class="px-3 py-1 bg-white border rounded hover:bg-gray-50">Next</a>
                    <?php endif; ?>
                </div>
            </div>
        <?php endif; ?>
    </div>
</div>
