<?php
/**
 * Employee Center - Index
 */
?>
<div class="p-6">
    <div class="flex justify-between items-center mb-6">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">Employee Center</h1>
            <p class="text-gray-600 mt-1">Manage employee profiles and records</p>
        </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div class="text-2xl font-bold text-blue-600"><?= $empStats['total'] ?></div>
            <div class="text-sm text-gray-500">Total</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div class="text-2xl font-bold text-green-600"><?= $empStats['active'] ?></div>
            <div class="text-sm text-gray-500">Active</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div class="text-2xl font-bold text-yellow-600"><?= $empStats['on_leave'] ?></div>
            <div class="text-sm text-gray-500">On Leave</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <div class="text-2xl font-bold text-red-600"><?= $empStats['inactive'] ?></div>
            <div class="text-sm text-gray-500">Inactive</div>
        </div>
    </div>

    <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hire Date</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
                <?php if (empty($employees)): ?>
                    <tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">No employees found</td></tr>
                <?php else: ?>
                    <?php foreach ($employees as $emp):
                        $sc = match($emp['status']) { 'active'=>'bg-green-100 text-green-700', 'on_leave'=>'bg-yellow-100 text-yellow-700', default=>'bg-gray-100 text-gray-700' };
                    ?>
                        <tr class="hover:bg-gray-50" data-dd-inline data-dd-title="<?= e($emp['name'] ?? 'Employee') ?>" data-dd-key="employee-<?= (int)($emp['id'] ?? 0) ?>">
                            <td class="px-4 py-3 text-sm font-medium"><?= e($emp['name'] ?? '—') ?></td>
                            <td class="px-4 py-3 text-sm"><?= e($emp['position'] ?? '—') ?></td>
                            <td class="px-4 py-3 text-sm"><?= e($emp['store_name'] ?? '—') ?></td>
                            <td class="px-4 py-3"><span class="px-2 py-1 text-xs rounded-full <?= $sc ?>"><?= ucfirst($emp['status']) ?></span></td>
                            <td class="px-4 py-3 text-sm text-gray-500"><?= $emp['hire_date'] ? date('M d, Y', strtotime($emp['hire_date'])) : '—' ?></td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../../layouts/main.php';
