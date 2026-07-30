<?php
$pageTitle = 'Organization Chart';
$currentPage = 'admin-org-chart';
ob_start();
?>
<style>
.oc-stats{display:flex;gap:20px;margin-bottom:24px;flex-wrap:wrap}
.oc-stats__item{background:#18181b;border:1px solid #27272a;border-radius:8px;padding:12px 20px;font-size:13px;color:#a1a1aa}
.oc-stats__item strong{color:#f4f4f5;font-size:20px;display:block;margin-bottom:2px}
.oc-tree{margin-bottom:32px}
.oc-node{padding:10px 16px;margin:4px 0;border-radius:8px;display:flex;align-items:center;gap:12px}
.oc-node--ceo{background:#1e3a5f;border:1px solid #2563eb}
.oc-node--admin{background:#2d2250;border:1px solid #7c3aed}
.oc-node--manager{background:#064e3b;border:1px solid #059669}
.oc-node--member{background:#18181b;border:1px solid #27272a}
.oc-node__avatar{width:32px;height:32px;border-radius:50%;background:#3b82f6;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:#fff}
.oc-node__info{flex:1}
.oc-node__name{font-size:14px;color:#f4f4f5;font-weight:500}
.oc-node__role{font-size:12px;color:#71717a}
.oc-children{margin-left:32px;border-left:2px solid #27272a;padding-left:16px}
.oc-hierarchy{margin-top:24px}
.oc-region{background:#18181b;border:1px solid #27272a;border-radius:10px;padding:16px;margin-bottom:12px}
.oc-region__header{font-size:15px;color:#f4f4f5;font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:8px}
.oc-district{margin-left:20px;padding:8px 12px;background:#09090b;border-radius:6px;margin-bottom:6px}
.oc-store-chip{display:inline-block;padding:3px 10px;background:#27272a;border-radius:4px;font-size:12px;color:#a1a1aa;margin:2px 4px 2px 0}
</style>

<div class="oc-stats">
    <div class="oc-stats__item"><strong><?= $stats['employees'] ?></strong>Employees</div>
    <div class="oc-stats__item"><strong><?= $stats['stores'] ?></strong>Stores</div>
    <div class="oc-stats__item"><strong><?= $stats['regions'] ?></strong>Regions</div>
    <div class="oc-stats__item"><strong><?= $stats['districts'] ?></strong>Districts</div>
</div>

<!-- Org Tree -->
<h3 style="color:#a1a1aa;font-size:14px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">Reporting Structure</h3>
<div class="oc-tree">
<?php
function renderOrgNode(array $node, int $depth = 0): void {
    $roleClass = match($node['role'] ?? 'member') {
        'ceo' => 'oc-node--ceo',
        'admin' => 'oc-node--admin',
        'manager' => 'oc-node--manager',
        default => 'oc-node--member',
    };
    $initial = strtoupper(mb_substr($node['name'], 0, 1));
    echo '<div class="oc-node ' . $roleClass . '">';
    echo '<div class="oc-node__avatar">' . $initial . '</div>';
    echo '<div class="oc-node__info">';
    echo '<div class="oc-node__name">' . e($node['name']) . '</div>';
    echo '<div class="oc-node__role">' . e($node['job_title'] ?? ucfirst($node['role'] ?? 'Member'));
    if (!empty($node['store_name'])) echo ' · ' . e($node['store_name']);
    echo '</div></div></div>';

    if (!empty($node['children'])) {
        echo '<div class="oc-children">';
        foreach ($node['children'] as $child) {
            renderOrgNode($child, $depth + 1);
        }
        echo '</div>';
    }
}
foreach ($orgTree as $root) { renderOrgNode($root); }
if (empty($orgTree)) echo '<p style="color:#71717a">No reporting structure configured. Assign "reports_to" relationships in user settings.</p>';
?>
</div>

<!-- Store Hierarchy -->
<h3 style="color:#a1a1aa;font-size:14px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">Store Hierarchy</h3>
<div class="oc-hierarchy">
<?php foreach ($hierarchy['regions'] as $region): ?>
<div class="oc-region">
    <div class="oc-region__header">🌐 <?= e($region['name']) ?> <span style="font-size:12px;color:#71717a;font-weight:400"><?= e($region['manager_name'] ?? '') ?></span></div>
    <?php foreach ($region['districts'] as $district): ?>
    <div class="oc-district">
        <div style="font-size:13px;color:#d4d4d8;margin-bottom:4px">📍 <?= e($district['name']) ?> <span style="color:#71717a"><?= e($district['manager_name'] ?? '') ?></span></div>
        <?php foreach ($district['stores'] as $store): ?>
        <span class="oc-store-chip">🏪 <?= e($store['name']) ?></span>
        <?php endforeach; ?>
        <?php if (empty($district['stores'])): ?><span style="font-size:12px;color:#52525b">No stores</span><?php endif; ?>
    </div>
    <?php endforeach; ?>
    <?php foreach ($region['stores'] as $store): ?>
    <span class="oc-store-chip" style="margin-left:20px">🏪 <?= e($store['name']) ?></span>
    <?php endforeach; ?>
</div>
<?php endforeach; ?>

<?php if (!empty($hierarchy['unassigned'])): ?>
<div class="oc-region" style="border-color:#451a03">
    <div class="oc-region__header" style="color:#fb923c">⚠ Unassigned Stores</div>
    <?php foreach ($hierarchy['unassigned'] as $store): ?>
    <span class="oc-store-chip">🏪 <?= e($store['name']) ?></span>
    <?php endforeach; ?>
</div>
<?php endif; ?>
</div>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
