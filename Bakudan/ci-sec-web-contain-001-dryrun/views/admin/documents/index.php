<?php
/**
 * Document Center - Index
 */
?>
<div class="p-6">
    <div class="flex justify-between items-center mb-6">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">Document Center</h1>
            <p class="text-gray-600 mt-1">Upload, organize, and manage documents</p>
        </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div class="text-2xl font-bold text-blue-600"><?= $docStats['total'] ?></div>
            <div class="text-sm text-gray-500">Active Documents</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-gray-500">
            <div class="text-2xl font-bold text-gray-600"><?= $docStats['archived'] ?></div>
            <div class="text-sm text-gray-500">Archived</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div class="text-2xl font-bold text-purple-600"><?= count($docStats['categories'] ?? []) ?></div>
            <div class="text-sm text-gray-500">Categories</div>
        </div>
    </div>

    <?php if (!empty($docStats['categories'])): ?>
    <div class="bg-white rounded-lg shadow p-4 mb-6">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Categories</h3>
        <div class="flex flex-wrap gap-2">
            <?php foreach ($docStats['categories'] as $cat): ?>
                <span class="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full">
                    <?= e($cat['category'] ?? 'Uncategorized') ?> (<?= $cat['cnt'] ?>)
                </span>
            <?php endforeach; ?>
        </div>
    </div>
    <?php endif; ?>

    <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
                <?php if (empty($documents)): ?>
                    <tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">No documents yet</td></tr>
                <?php else: ?>
                    <?php foreach ($documents as $doc): ?>
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-3 text-sm font-medium"><?= e($doc['title']) ?></td>
                            <td class="px-4 py-3 text-sm"><?= e($doc['category'] ?? '—') ?></td>
                            <td class="px-4 py-3 text-sm"><?= e($doc['store_name'] ?? '—') ?></td>
                            <td class="px-4 py-3 text-sm text-gray-500"><?= e($doc['file_type'] ?? '—') ?></td>
                            <td class="px-4 py-3 text-sm text-gray-500"><?= date('M d, Y', strtotime($doc['created_at'])) ?></td>
                            <td class="px-4 py-3"><span class="px-2 py-1 text-xs rounded-full <?= $doc['status'] === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700' ?>"><?= ucfirst($doc['status']) ?></span></td>
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
