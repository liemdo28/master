<?php
/**
 * Procurement - Index
 */
?>
<div class="p-6">
    <div class="flex justify-between items-center mb-6">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">Procurement</h1>
            <p class="text-gray-600 mt-1">Purchase orders and vendor management</p>
        </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div class="text-2xl font-bold text-blue-600"><?= $procStats['total'] ?></div>
            <div class="text-sm text-gray-500">Total Orders</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div class="text-2xl font-bold text-yellow-600"><?= $procStats['pending'] ?></div>
            <div class="text-sm text-gray-500">Pending</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div class="text-2xl font-bold text-green-600"><?= $procStats['approved'] ?></div>
            <div class="text-sm text-gray-500">Approved</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div class="text-2xl font-bold text-purple-600">$<?= number_format($procStats['total_spend'], 0) ?></div>
            <div class="text-sm text-gray-500">Total Spend</div>
        </div>
    </div>

    <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
                <?php if (empty($procurements)): ?>
                    <tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">No procurement orders</td></tr>
                <?php else: ?>
                    <?php foreach ($procurements as $p):
                        $sc = match($p['status']) { 'approved'=>'bg-green-100 text-green-700', 'pending'=>'bg-yellow-100 text-yellow-700', 'received'=>'bg-blue-100 text-blue-700', default=>'bg-gray-100 text-gray-700' };
                    ?>
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-3 text-sm font-medium"><?= e($p['title']) ?></td>
                            <td class="px-4 py-3 text-sm"><?= e($p['vendor'] ?? '—') ?></td>
                            <td class="px-4 py-3 text-sm"><?= e($p['store_name'] ?? '—') ?></td>
                            <td class="px-4 py-3 text-sm">$<?= number_format($p['total_amount'], 2) ?></td>
                            <td class="px-4 py-3"><span class="px-2 py-1 text-xs rounded-full <?= $sc ?>"><?= ucfirst($p['status']) ?></span></td>
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
