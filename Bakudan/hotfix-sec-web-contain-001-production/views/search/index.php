<?php
/**
 * Phase 11.5 — Module 1: Global Search View
 */
$typeFilters = [
    'all' => 'All',
    'tasks' => 'Tasks',
    'employees' => 'Employees',
    'stores' => 'Stores',
    'incidents' => 'Incidents',
    'releases' => 'Releases',
    'bills' => 'Bills',
    'projects' => 'Projects',
];

$typeIcons = [
    'task' => 'check-square',
    'employee' => 'user',
    'store' => 'store',
    'incident' => 'alert-triangle',
    'release' => 'layers',
    'bill' => 'credit-card',
    'project' => 'folder',
];
?>

<div class="search-page">
    <!-- Search Header -->
    <div class="search-header" style="margin-bottom:24px">
        <form method="GET" action="<?= APP_URL ?>/search" class="search-form" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <div style="flex:1;min-width:300px;position:relative">
                <input type="text" name="q" value="<?= e($searchQuery) ?>" placeholder="Search tasks, employees, stores, incidents, releases..."
                       class="form-control" style="padding-left:40px;font-size:16px;height:48px" autofocus>
                <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);opacity:.5">🔍</span>
            </div>
            <select name="type" class="form-control" style="width:auto;height:48px" onchange="this.form.submit()">
                <?php foreach ($typeFilters as $key => $label): ?>
                <option value="<?= $key ?>" <?= $searchType === $key ? 'selected' : '' ?>><?= $label ?></option>
                <?php endforeach; ?>
            </select>
            <button type="submit" class="btn btn-primary" style="height:48px;padding:0 24px">Search</button>
        </form>
    </div>

    <!-- Results -->
    <?php if ($searchQuery && !empty($searchResults)): ?>
    <div class="search-results">
        <div style="margin-bottom:16px;color:var(--text-muted);font-size:13px">
            Found <?= count($searchResults) ?> result<?= count($searchResults) !== 1 ? 's' : '' ?> for "<?= e($searchQuery) ?>"
        </div>

        <div class="search-results-list" style="display:flex;flex-direction:column;gap:8px">
            <?php foreach ($searchResults as $result): ?>
            <a href="<?= APP_URL . $result['url'] ?>" class="search-result-item" style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;text-decoration:none;color:inherit;transition:border-color .15s">
                <div class="search-result-icon" style="width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--blue-bg);color:var(--blue);flex-shrink:0">
                    <?= tf_icon($typeIcons[$result['type']] ?? 'file', 18) ?>
                </div>
                <div style="flex:1;min-width:0">
                    <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><?= e($result['title']) ?></div>
                    <div style="font-size:12px;color:var(--text-muted);margin-top:2px"><?= e($result['subtitle'] ?? '') ?></div>
                </div>
                <span class="search-result-type" style="font-size:11px;padding:2px 8px;border-radius:4px;background:var(--bg-secondary);color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px">
                    <?= e($result['type']) ?>
                </span>
            </a>
            <?php endforeach; ?>
        </div>
    </div>

    <?php elseif ($searchQuery): ?>
    <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <div style="font-size:48px;margin-bottom:16px">🔍</div>
        <div style="font-size:16px;font-weight:500;margin-bottom:8px">No results found</div>
        <div style="font-size:13px">Try different keywords or change the filter type</div>
    </div>

    <?php else: ?>
    <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <div style="font-size:48px;margin-bottom:16px">🔍</div>
        <div style="font-size:16px;font-weight:500;margin-bottom:8px">Search across everything</div>
        <div style="font-size:13px">Tasks, employees, stores, incidents, releases, bills, and projects</div>
        <div style="margin-top:24px;font-size:12px;color:var(--text-muted)">
            <kbd style="padding:2px 6px;background:var(--bg-secondary);border-radius:4px;border:1px solid var(--border)">Ctrl</kbd> +
            <kbd style="padding:2px 6px;background:var(--bg-secondary);border-radius:4px;border:1px solid var(--border)">K</kbd>
            for quick search anywhere
        </div>
    </div>
    <?php endif; ?>
</div>

<style>
.search-result-item:hover { border-color: var(--blue); }
</style>
