<?php
/**
 * Admin Payroll - Show/Detail Page
 */
$pageTitle = $run['name'];
$statusColors = [
    'draft' => 'bg-gray-100 text-gray-800',
    'processing' => 'bg-yellow-100 text-yellow-800',
    'completed' => 'bg-green-100 text-green-800',
    'cancelled' => 'bg-red-100 text-red-800'
];
?>

<div class="p-6">
    <!-- Breadcrumb -->
    <div class="mb-4">
        <a href="/admin/payroll" class="text-blue-600 hover:text-blue-800">&larr; Back to Payroll</a>
    </div>

    <!-- Header -->
    <div class="bg-white rounded-lg shadow mb-6 p-6">
        <div class="flex justify-between items-start">
            <div>
                <div class="flex items-center gap-3 mb-2">
                    <h1 class="text-2xl font-bold text-gray-900"><?= htmlspecialchars($run['name']) ?></h1>
                    <span class="px-3 py-1 text-sm font-semibold rounded-full <?= $statusColors[$run['status']] ?? '' ?>">
                        <?= ucfirst($run['status']) ?>
                    </span>
                </div>
                <div class="text-sm text-gray-500">
                    Period: <?= date('M d', strtotime($run['period_start'])) ?> - <?= date('M d, Y', strtotime($run['period_end'])) ?>
                    &bull; Created by <?= htmlspecialchars($run['created_by_name'] ?? 'Unknown') ?>
                    <?php if ($run['processed_by']): ?>
                        &bull; Processed by <?= htmlspecialchars($run['processed_by_name'] ?? 'Unknown') ?>
                    <?php endif; ?>
                </div>
            </div>
            <div class="flex gap-2">
                <?php if ($run['status'] === 'draft'): ?>
                    <a href="/admin/payroll/<?= $run['id'] ?>/process" 
                       class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                        Process Payroll
                    </a>
                <?php elseif ($run['status'] === 'processing'): ?>
                    <a href="/admin/payroll/<?= $run['id'] ?>/complete" 
                       class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Complete Payroll
                    </a>
                <?php endif; ?>
                <?php if ($run['status'] !== 'completed'): ?>
                    <a href="/admin/payroll/<?= $run['id'] ?>/cancel" 
                       class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                        Cancel
                    </a>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <!-- Summary -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4">
            <div class="text-sm text-gray-500">Employees</div>
            <div class="text-2xl font-bold text-gray-900"><?= count($employees) ?></div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
            <div class="text-sm text-gray-500">Total Gross</div>
            <div class="text-2xl font-bold text-gray-900"><?= number_format($run['total_gross'], 0) ?> VND</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
            <div class="text-sm text-gray-500">Total Deductions</div>
            <div class="text-2xl font-bold text-red-600"><?= number_format($run['total_deductions'], 0) ?> VND</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
            <div class="text-sm text-gray-500">Total Net</div>
            <div class="text-2xl font-bold text-green-600"><?= number_format($run['total_net'], 0) ?> VND</div>
        </div>
    </div>

    <!-- Variances -->
    <?php if (!empty($variances) && $run['status'] !== 'draft'): ?>
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 class="font-medium text-yellow-900 mb-2">Variance Alerts</h3>
            <p class="text-sm text-yellow-700 mb-3">The following employees have significant changes compared to the previous payroll:</p>
            <div class="overflow-x-auto">
                <table class="min-w-full text-sm">
                    <thead>
                        <tr class="text-left">
                            <th class="pr-4 py-2">Employee</th>
                            <th class="pr-4 py-2">Previous Net</th>
                            <th class="pr-4 py-2">Current Net</th>
                            <th class="pr-4 py-2">Change</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach (array_slice($variances, 0, 5) as $v): ?>
                            <tr class="border-t border-yellow-200">
                                <td class="pr-4 py-2"><?= htmlspecialchars($v['employee_name']) ?></td>
                                <td class="pr-4 py-2"><?= number_format($v['previous_net'], 0) ?> VND</td>
                                <td class="pr-4 py-2"><?= number_format($v['current_net'], 0) ?> VND</td>
                                <td class="pr-4 py-2 <?= $v['net_change'] > 0 ? 'text-green-600' : 'text-red-600' ?>">
                                    <?= $v['net_change'] > 0 ? '+' : '' ?><?= number_format($v['net_change'], 0) ?> VND
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    <?php endif; ?>

    <!-- Employees Table -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
        <div class="px-4 py-3 border-b flex justify-between items-center">
            <h2 class="text-lg font-semibold text-gray-900">Employee Payments</h2>
            <?php if ($run['status'] === 'processing'): ?>
                <form action="/admin/payroll/mark-paid" method="POST" class="flex gap-2">
                    <button type="submit" class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                        Mark Selected as Paid
                    </button>
                </form>
            <?php endif; ?>
        </div>

        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <?php if ($run['status'] === 'processing'): ?>
                        <th class="px-4 py-3 w-12"><input type="checkbox" id="select-all"></th>
                    <?php endif; ?>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Base</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">OT</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bonus</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gross</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tax</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Insurance</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
                <?php if (empty($employees)): ?>
                    <tr>
                        <td colspan="11" class="px-4 py-8 text-center text-gray-500">
                            No employees processed yet.
                            <?php if ($run['status'] === 'draft'): ?>
                                <a href="/admin/payroll/<?= $run['id'] ?>/process" class="text-blue-600">Process payroll</a>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php else: ?>
                    <?php foreach ($employees as $emp): ?>
                        <tr class="hover:bg-gray-50">
                            <?php if ($run['status'] === 'processing'): ?>
                                <td class="px-4 py-3">
                                    <input type="checkbox" name="ids[]" value="<?= $emp['id'] ?>" class="row-checkbox">
                                </td>
                            <?php endif; ?>
                            <td class="px-4 py-3">
                                <div class="font-medium text-gray-900"><?= htmlspecialchars($emp['employee_name']) ?></div>
                                <div class="text-xs text-gray-500"><?= htmlspecialchars($emp['email']) ?></div>
                            </td>
                            <td class="px-4 py-3 text-sm text-gray-600">
                                <?= $emp['store_name'] ? htmlspecialchars($emp['store_name']) : '-' ?>
                            </td>
                            <td class="px-4 py-3 text-right text-sm text-gray-900"><?= number_format($emp['base_salary'], 0) ?></td>
                            <td class="px-4 py-3 text-right text-sm text-gray-600"><?= number_format($emp['overtime_hours'] * $emp['overtime_rate'], 0) ?></td>
                            <td class="px-4 py-3 text-right text-sm text-green-600"><?= number_format($emp['bonus'], 0) ?></td>
                            <td class="px-4 py-3 text-right text-sm font-medium text-gray-900"><?= number_format($emp['gross_pay'], 0) ?></td>
                            <td class="px-4 py-3 text-right text-sm text-red-600"><?= number_format($emp['tax_deduction'], 0) ?></td>
                            <td class="px-4 py-3 text-right text-sm text-red-600"><?= number_format($emp['insurance_deduction'], 0) ?></td>
                            <td class="px-4 py-3 text-right text-sm font-bold text-green-600"><?= number_format($emp['net_pay'], 0) ?></td>
                            <td class="px-4 py-3 text-center">
                                <?php
                                $empStatusColors = [
                                    'pending' => 'bg-yellow-100 text-yellow-800',
                                    'approved' => 'bg-blue-100 text-blue-800',
                                    'paid' => 'bg-green-100 text-green-800'
                                ];
                                ?>
                                <span class="px-2 py-1 text-xs font-semibold rounded-full <?= $empStatusColors[$emp['status']] ?? '' ?>">
                                    <?= ucfirst($emp['status']) ?>
                                </span>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
</div>

<script>
document.getElementById('select-all')?.addEventListener('change', function() {
    document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = this.checked);
});
</script>
