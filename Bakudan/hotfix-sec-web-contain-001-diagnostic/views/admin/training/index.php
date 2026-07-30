<?php
/**
 * Training Center - Index
 */
?>
<div class="p-6">
    <div class="flex justify-between items-center mb-6">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">Training Center</h1>
            <p class="text-gray-600 mt-1">Manage training modules and track progress</p>
        </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div class="text-2xl font-bold text-blue-600"><?= $trainingStats['total_modules'] ?></div>
            <div class="text-sm text-gray-500">Modules</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div class="text-2xl font-bold text-green-600"><?= $trainingStats['published'] ?></div>
            <div class="text-sm text-gray-500">Published</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div class="text-2xl font-bold text-purple-600"><?= $trainingStats['enrolled'] ?></div>
            <div class="text-sm text-gray-500">Enrolled</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div class="text-2xl font-bold text-yellow-600"><?= $trainingStats['in_progress'] ?></div>
            <div class="text-sm text-gray-500">In Progress</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-600">
            <div class="text-2xl font-bold text-green-700"><?= $trainingStats['completed'] ?></div>
            <div class="text-sm text-gray-500">Completed</div>
        </div>
    </div>

    <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Module</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Difficulty</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
                <?php if (empty($modules)): ?>
                    <tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">No training modules yet</td></tr>
                <?php else: ?>
                    <?php foreach ($modules as $mod):
                        $sc = match($mod['status']) { 'published'=>'bg-green-100 text-green-700', 'draft'=>'bg-gray-100 text-gray-700', default=>'bg-yellow-100 text-yellow-700' };
                        $dc = match($mod['difficulty']) { 'beginner'=>'text-green-600', 'intermediate'=>'text-yellow-600', 'advanced'=>'text-red-600', default=>'text-gray-600' };
                    ?>
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-3 text-sm font-medium"><?= e($mod['title']) ?></td>
                            <td class="px-4 py-3 text-sm"><?= e($mod['category'] ?? '—') ?></td>
                            <td class="px-4 py-3 text-sm <?= $dc ?>"><?= ucfirst($mod['difficulty'] ?? 'beginner') ?></td>
                            <td class="px-4 py-3 text-sm"><?= $mod['duration_hours'] ? $mod['duration_hours'] . 'h' : '—' ?></td>
                            <td class="px-4 py-3"><span class="px-2 py-1 text-xs rounded-full <?= $sc ?>"><?= ucfirst($mod['status']) ?></span></td>
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
