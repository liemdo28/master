<?php
/**
 * Shift Management - Index
 */
$currentPage = 'admin-shifts';
$pageTitle = 'Shift Management';
ob_start();
?>
<div class="p-6">
    <div class="flex justify-between items-center mb-6">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">Shift Management</h1>
            <p class="text-gray-600 mt-1">Schedule and manage employee shifts</p>
        </div>
        <button onclick="document.getElementById('create-shift-form').classList.toggle('hidden')" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Shift</button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div class="text-2xl font-bold text-blue-600"><?= $stats['total'] ?></div>
            <div class="text-sm text-gray-500">Total Shifts</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div class="text-2xl font-bold text-green-600"><?= $stats['today'] ?></div>
            <div class="text-sm text-gray-500">Today</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div class="text-2xl font-bold text-purple-600"><?= $stats['this_week'] ?></div>
            <div class="text-sm text-gray-500">This Week</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div class="text-2xl font-bold text-yellow-600"><?= $stats['scheduled'] ?></div>
            <div class="text-sm text-gray-500">Upcoming</div>
        </div>
    </div>

    <!-- Create Form (hidden) -->
    <div id="create-shift-form" class="hidden bg-white rounded-lg shadow p-6 mb-6">
        <h3 class="text-lg font-semibold mb-4">Create New Shift</h3>
        <form method="POST" action="/admin/shifts" class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Store</label>
                <select name="store_id" class="w-full px-3 py-2 border rounded-lg">
                    <option value="">— Select Store —</option>
                    <?php foreach ($stores as $s): ?><option value="<?= $s['id'] ?>"><?= e($s['name']) ?></option><?php endforeach; ?>
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                <select name="user_id" class="w-full px-3 py-2 border rounded-lg">
                    <option value="">— Select Employee —</option>
                    <?php foreach ($users as $u): ?><option value="<?= $u['id'] ?>"><?= e($u['name']) ?></option><?php endforeach; ?>
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" name="shift_date" value="<?= date('Y-m-d') ?>" class="w-full px-3 py-2 border rounded-lg" required>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input type="time" name="start_time" value="09:00" class="w-full px-3 py-2 border rounded-lg" required>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input type="time" name="end_time" value="17:00" class="w-full px-3 py-2 border rounded-lg" required>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <input type="text" name="role" placeholder="e.g. Cashier, Cook" class="w-full px-3 py-2 border rounded-lg">
            </div>
            <div class="md:col-span-3">
                <button type="submit" class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Create Shift</button>
            </div>
        </form>
    </div>

    <!-- Shifts Table -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
                <?php if (empty($shifts)): ?>
                    <tr><td colspan="7" class="px-4 py-8 text-center text-gray-500">No shifts found</td></tr>
                <?php else: ?>
                    <?php foreach ($shifts as $shift):
                        $statusColors = ['scheduled'=>'bg-blue-100 text-blue-700','confirmed'=>'bg-green-100 text-green-700','completed'=>'bg-gray-100 text-gray-700','absent'=>'bg-red-100 text-red-700','cancelled'=>'bg-yellow-100 text-yellow-700'];
                        $sc = $statusColors[$shift['status']] ?? 'bg-gray-100 text-gray-700';
                    ?>
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-3 text-sm"><?= date('M d, Y', strtotime($shift['shift_date'])) ?></td>
                            <td class="px-4 py-3 text-sm"><?= substr($shift['start_time'],0,5) ?> - <?= substr($shift['end_time'],0,5) ?></td>
                            <td class="px-4 py-3 text-sm font-medium"><?= e($shift['user_name'] ?? '—') ?></td>
                            <td class="px-4 py-3 text-sm"><?= e($shift['store_name'] ?? '—') ?></td>
                            <td class="px-4 py-3 text-sm"><?= e($shift['role'] ?? '—') ?></td>
                            <td class="px-4 py-3"><span class="px-2 py-1 text-xs font-semibold rounded-full <?= $sc ?>"><?= ucfirst($shift['status']) ?></span></td>
                            <td class="px-4 py-3 text-sm">
                                <a href="/admin/shifts/<?= $shift['id'] ?>/delete" class="text-red-600 hover:text-red-800" onclick="return confirm('Delete?')">Delete</a>
                            </td>
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
