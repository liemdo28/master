<?php
/**
 * Release Dashboard - Stats & Freeze Management
 */
$currentPage = 'admin-releases';
$pageTitle = 'Release Dashboard';
ob_start();

$db = Database::getInstance();
$releaseModel = new Release();

// Stats
$totalReleases = (int)($db->fetch("SELECT COUNT(*) as cnt FROM releases")['cnt'] ?? 0);
$pendingReviews = (int)($db->fetch("SELECT COUNT(*) as cnt FROM releases WHERE status IN ('review','staging')")['cnt'] ?? 0);
$deployedThisMonth = (int)($db->fetch("SELECT COUNT(*) as cnt FROM releases WHERE status='published' AND published_at >= ?", [date('Y-m-01')])['cnt'] ?? 0);
$draftCount = (int)($db->fetch("SELECT COUNT(*) as cnt FROM releases WHERE status='draft'")['cnt'] ?? 0);

// Active freeze
$activeFreeze = $db->fetch(
    "SELECT * FROM deploy_freezes
     WHERE is_active = 1 AND (ends_at IS NULL OR ends_at >= NOW())
     ORDER BY created_at DESC
     LIMIT 1"
);

// Recent releases
$recentReleases = $db->fetchAll("SELECT id, version, title, status, created_at, published_at FROM releases ORDER BY created_at DESC LIMIT 10");
?>
<div class="p-6">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">Release Dashboard</h1>
            <p class="text-gray-600 mt-1">Release management overview & freeze control</p>
        </div>
        <a href="/admin/releases/create" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            + New Release
        </a>
    </div>

    <?php if ($activeFreeze): ?>
    <!-- Freeze Banner -->
    <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center justify-between">
        <div class="flex items-center gap-3">
            <span class="text-2xl">🧊</span>
            <div>
                <h3 class="font-semibold text-red-800">Deploy Freeze Active</h3>
                <p class="text-sm text-red-600">
                    <?= e($activeFreeze['reason'] ?? 'No deployments allowed') ?> 
                    — Until <?= !empty($activeFreeze['ends_at']) ? date('M d, Y H:i', strtotime($activeFreeze['ends_at'])) : 'manual release' ?>
                </p>
            </div>
        </div>
        <form method="POST" action="/api/admin/releases/freeze/<?= $activeFreeze['id'] ?>/end">
            <button type="submit" class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">
                End Freeze
            </button>
        </form>
    </div>
    <?php endif; ?>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div class="text-2xl font-bold text-blue-600"><?= $totalReleases ?></div>
            <div class="text-sm text-gray-500">Total Releases</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div class="text-2xl font-bold text-yellow-600"><?= $pendingReviews ?></div>
            <div class="text-sm text-gray-500">Pending Review</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div class="text-2xl font-bold text-green-600"><?= $deployedThisMonth ?></div>
            <div class="text-sm text-gray-500">Deployed This Month</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-gray-500">
            <div class="text-2xl font-bold text-gray-600"><?= $draftCount ?></div>
            <div class="text-sm text-gray-500">Drafts</div>
        </div>
    </div>

    <!-- Recent Releases -->
    <div class="bg-white rounded-lg shadow">
        <div class="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 class="text-lg font-semibold text-gray-900">Recent Releases</h2>
            <a href="/admin/releases" class="text-sm text-blue-600 hover:text-blue-800">View All →</a>
        </div>
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
                <?php if (empty($recentReleases)): ?>
                    <tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">No releases yet</td></tr>
                <?php else: ?>
                    <?php foreach ($recentReleases as $rel):
                        $statusColors = [
                            'draft' => 'bg-gray-100 text-gray-700',
                            'review' => 'bg-yellow-100 text-yellow-700',
                            'staging' => 'bg-blue-100 text-blue-700',
                            'published' => 'bg-green-100 text-green-700',
                            'rollback' => 'bg-red-100 text-red-700',
                        ];
                        $sc = $statusColors[$rel['status']] ?? 'bg-gray-100 text-gray-700';
                    ?>
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-3 text-sm font-mono"><?= e($rel['version'] ?? '-') ?></td>
                            <td class="px-4 py-3 text-sm">
                                <a href="/admin/releases/<?= $rel['id'] ?>" class="text-blue-600 hover:text-blue-800">
                                    <?= e($rel['title'] ?? 'Untitled') ?>
                                </a>
                            </td>
                            <td class="px-4 py-3">
                                <span class="px-2 py-1 text-xs font-semibold rounded-full <?= $sc ?>">
                                    <?= ucfirst($rel['status']) ?>
                                </span>
                            </td>
                            <td class="px-4 py-3 text-sm text-gray-500">
                                <?= date('M d, Y', strtotime($rel['published_at'] ?? $rel['created_at'])) ?>
                            </td>
                            <td class="px-4 py-3">
                                <a href="/admin/releases/<?= $rel['id'] ?>" class="text-blue-600 hover:text-blue-800 text-sm">View</a>
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
require __DIR__ . '/../layouts/main.php';
