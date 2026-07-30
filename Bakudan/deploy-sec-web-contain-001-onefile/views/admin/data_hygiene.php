<?php
$pageTitle = 'Data Hygiene';
$currentPage = 'admin';
ob_start();

$catColors = [
    'utilities'  => '#3b82f6',
    'tax'        => '#f59e0b',
    'insurance'  => '#8b5cf6',
    'rent'       => '#10b981',
    'payroll'    => '#ec4899',
    'general'    => '#6b7280',
];
$catLabels = [
    'utilities'  => 'Utilities',
    'tax'        => 'Tax',
    'insurance'  => 'Insurance',
    'rent'       => 'Rent / Lease',
    'payroll'    => 'Payroll',
    'general'    => 'General',
];

function guessCategory($name) {
    $n = strtolower($name);
    if (strpos($n, 'pge') !== false || strpos($n, 'pg&e') !== false) return 'utilities';
    if (strpos($n, 'sale tax') !== false || strpos($n, 'sales tax') !== false || strpos($n, 'qb tax') !== false) return 'tax';
    if (strpos($n, 'quickbooks') !== false) return 'tax';
    if (strpos($n, 'amtrust') !== false || strpos($n, 'insurance') !== false) return 'insurance';
    if (strpos($n, 'prepayment') !== false || strpos($n, 'rent') !== false || strpos($n, 'lease') !== false) return 'rent';
    if (strpos($n, 'payroll') !== false || strpos($n, 'salary') !== false) return 'payroll';
    return 'general';
}
?>

<div style="max-width:900px;margin:0 auto">
<h1 style="font-size:22px;font-weight:800;margin-bottom:6px">🧹 Data Hygiene</h1>
<p class="text-sm text-muted" style="margin-bottom:28px">
    Fix structural issues: convert finance projects to recurring bills, merge duplicate businesses, assign stores to ungrouped projects.
</p>

<!-- ══════════════════════════════════════════
     SECTION 1: Finance Projects → Bills
     ══════════════════════════════════════════ -->
<div class="card" style="margin-bottom:24px">
    <div class="card-header" style="border-left:4px solid #f59e0b">
        <div>
            <h3 style="margin:0">⚠️ Finance Projects — Convert to Recurring Bills</h3>
            <p class="text-sm text-muted" style="margin:4px 0 0">
                These projects are actually <strong>recurring financial obligations</strong> (bills), not project work.
                Converting them removes them from the project dashboard and adds them to the Bills module.
            </p>
        </div>
        <span class="badge" style="background:rgba(245,158,11,.15);color:#f59e0b;font-size:12px"><?= count($financeProjects) ?> detected</span>
    </div>
    <div class="card-body" style="padding:0">
        <?php if (empty($financeProjects)): ?>
        <div style="text-align:center;padding:32px;color:var(--text-muted)">
            ✅ No finance-pattern projects found. All clean.
        </div>
        <?php else: ?>
        <form method="POST" action="<?= APP_URL ?>/admin/bills/convert-projects"
              onsubmit="return confirm('Convert selected projects to recurring bills and archive them?')">
            <table style="width:100%;border-collapse:collapse">
                <thead>
                    <tr style="border-bottom:1px solid var(--border)">
                        <th style="padding:10px 16px;text-align:left;width:36px">
                            <input type="checkbox" id="selectAll" onchange="document.querySelectorAll('.proj-check').forEach(c=>c.checked=this.checked)">
                        </th>
                        <th style="padding:10px 16px;text-align:left;font-size:12px;color:var(--text-muted)">Project Name</th>
                        <th style="padding:10px 16px;text-align:left;font-size:12px;color:var(--text-muted)">Business</th>
                        <th style="padding:10px 16px;text-align:left;font-size:12px;color:var(--text-muted)">Detected Category</th>
                        <th style="padding:10px 16px;text-align:center;font-size:12px;color:var(--text-muted)">Tasks</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($financeProjects as $fp):
                        $cat      = guessCategory($fp['name']);
                        $catColor = $catColors[$cat] ?? '#6b7280';
                        $catLabel = $catLabels[$cat] ?? 'General';
                    ?>
                    <tr style="border-bottom:1px solid var(--border)">
                        <td style="padding:10px 16px">
                            <input type="checkbox" class="proj-check" name="project_ids[]" value="<?= $fp['id'] ?>" checked>
                        </td>
                        <td style="padding:10px 16px">
                            <div style="display:flex;align-items:center;gap:8px">
                                <span style="width:10px;height:10px;border-radius:50%;background:<?= e($fp['color'] ?? '#3b82f6') ?>;flex-shrink:0"></span>
                                <span style="font-weight:600;font-size:14px"><?= e($fp['name']) ?></span>
                                <?php if ($fp['asana_gid']): ?>
                                <span style="font-size:10px;color:var(--text-muted);background:var(--bg-secondary);padding:1px 5px;border-radius:3px">Asana</span>
                                <?php endif; ?>
                            </div>
                        </td>
                        <td style="padding:10px 16px">
                            <?php if ($fp['store_name']): ?>
                            <span style="display:inline-flex;align-items:center;gap:5px;font-size:13px">
                                <span style="width:8px;height:8px;border-radius:50%;background:<?= e($fp['store_color'] ?? '#3b82f6') ?>"></span>
                                <?= e($fp['store_name']) ?>
                            </span>
                            <?php else: ?>
                            <span style="color:var(--neon-pink);font-size:12px">⚠ No store — will be skipped</span>
                            <?php endif; ?>
                        </td>
                        <td style="padding:10px 16px">
                            <span style="background:<?= $catColor ?>22;color:<?= $catColor ?>;padding:3px 8px;border-radius:4px;font-size:12px;font-weight:600">
                                <?= e($catLabel) ?>
                            </span>
                        </td>
                        <td style="padding:10px 16px;text-align:center;font-size:13px;color:var(--text-muted)"><?= (int)$fp['task_count'] ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <div style="padding:16px;display:flex;align-items:center;gap:12px;border-top:1px solid var(--border)">
                <button class="btn btn-primary" type="submit">🔄 Convert Selected → Bills</button>
                <span class="text-sm text-muted">Projects will be archived. Recurring bills will be created under the detected store.</span>
            </div>
        </form>
        <?php endif; ?>
    </div>
</div>

<!-- ══════════════════════════════════════════
     SECTION 2: Duplicate Businesses
     ══════════════════════════════════════════ -->
<div class="card" style="margin-bottom:24px">
    <div class="card-header" style="border-left:4px solid #ef4444">
        <div>
            <h3 style="margin:0">🔴 Duplicate Businesses — Merge</h3>
            <p class="text-sm text-muted" style="margin:4px 0 0">
                Detected business name overlaps. Merging moves all projects and bills from the source into the target, then deactivates the source.
            </p>
        </div>
        <span class="badge" style="background:rgba(239,68,68,.15);color:#ef4444;font-size:12px"><?= count($duplicatePairs) ?> pairs</span>
    </div>
    <div class="card-body" style="padding:16px;display:flex;flex-direction:column;gap:14px">
        <?php if (empty($duplicatePairs)): ?>
        <div style="text-align:center;padding:20px;color:var(--text-muted)">✅ No duplicate businesses detected.</div>
        <?php endif; ?>

        <?php foreach ($duplicatePairs as $pair):
            $a = $pair['a'];
            $b = $pair['b'];
        ?>
        <div style="background:var(--bg-secondary);border-radius:10px;padding:14px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
                <span style="background:rgba(239,68,68,.1);color:#ef4444;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700">DUPLICATE DETECTED</span>
                <span style="font-size:13px;color:var(--text-muted)"><?= $pair['overlap'] ?> word(s) overlap</span>
            </div>
            <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
                <div style="flex:1;min-width:180px;background:var(--bg-primary);border-radius:8px;padding:10px 14px">
                    <div style="font-weight:700;font-size:14px"><?= e($a['name']) ?></div>
                    <div class="text-sm text-muted"><?= (int)$a['project_count'] ?> projects · <?= (int)$a['bill_count'] ?> bills</div>
                </div>
                <div style="color:var(--text-muted);font-size:18px">→</div>
                <div style="flex:1;min-width:180px;background:var(--bg-primary);border-radius:8px;padding:10px 14px">
                    <div style="font-weight:700;font-size:14px"><?= e($b['name']) ?></div>
                    <div class="text-sm text-muted"><?= (int)$b['project_count'] ?> projects · <?= (int)$b['bill_count'] ?> bills</div>
                </div>
            </div>
            <form method="POST" action="<?= APP_URL ?>/admin/stores/merge"
                  onsubmit="return confirm('Merge these two businesses? This cannot be undone.')">
                <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                    <div class="form-group" style="margin:0;flex:1;min-width:160px">
                        <label style="font-size:11px;color:var(--text-muted)">Merge FROM (will be deactivated)</label>
                        <select name="source_id" class="form-control" style="font-size:13px">
                            <option value="<?= $a['id'] ?>"><?= e($a['name']) ?></option>
                            <option value="<?= $b['id'] ?>"><?= e($b['name']) ?></option>
                        </select>
                    </div>
                    <div style="font-size:20px;margin-top:20px;color:var(--text-muted)">→</div>
                    <div class="form-group" style="margin:0;flex:1;min-width:160px">
                        <label style="font-size:11px;color:var(--text-muted)">Merge INTO (kept)</label>
                        <select name="target_id" class="form-control" style="font-size:13px">
                            <option value="<?= $b['id'] ?>"><?= e($b['name']) ?></option>
                            <option value="<?= $a['id'] ?>"><?= e($a['name']) ?></option>
                        </select>
                    </div>
                    <div style="margin-top:20px">
                        <button class="btn btn-primary" type="submit">🔀 Merge</button>
                    </div>
                </div>
            </form>
        </div>
        <?php endforeach; ?>

        <!-- Manual merge for any two stores -->
        <div style="background:var(--bg-secondary);border-radius:10px;padding:14px">
            <div style="font-size:13px;font-weight:600;margin-bottom:10px">Manual merge (any two stores)</div>
            <form method="POST" action="<?= APP_URL ?>/admin/stores/merge"
                  onsubmit="return confirm('Merge these stores? This cannot be undone.')">
                <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
                    <div class="form-group" style="margin:0;flex:1;min-width:140px">
                        <label style="font-size:11px;color:var(--text-muted)">Merge FROM</label>
                        <select name="source_id" class="form-control" style="font-size:13px">
                            <?php foreach ($allStores as $s): ?>
                            <option value="<?= $s['id'] ?>"><?= e($s['name']) ?> (<?= $s['project_count'] ?> proj)</option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div style="font-size:18px;margin-bottom:8px;color:var(--text-muted)">→</div>
                    <div class="form-group" style="margin:0;flex:1;min-width:140px">
                        <label style="font-size:11px;color:var(--text-muted)">Merge INTO</label>
                        <select name="target_id" class="form-control" style="font-size:13px">
                            <?php foreach ($allStores as $s): ?>
                            <option value="<?= $s['id'] ?>"><?= e($s['name']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <button class="btn btn-secondary" type="submit" style="margin-bottom:0">🔀 Merge</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- ══════════════════════════════════════════
     SECTION 3: Ungrouped Projects
     ══════════════════════════════════════════ -->
<div class="card" style="margin-bottom:24px">
    <div class="card-header" style="border-left:4px solid #3b82f6">
        <div>
            <h3 style="margin:0">🔵 Ungrouped Projects — Assign Store</h3>
            <p class="text-sm text-muted" style="margin:4px 0 0">
                Projects with tasks but no business (store) assigned. They are invisible in the business dashboard.
            </p>
        </div>
        <span class="badge" style="background:rgba(59,130,246,.15);color:#3b82f6;font-size:12px"><?= count($ungroupedProjects) ?> projects</span>
    </div>
    <div class="card-body">
        <?php if (empty($ungroupedProjects)): ?>
        <div style="text-align:center;padding:20px;color:var(--text-muted)">✅ All projects have a business assigned.</div>
        <?php else: ?>
        <p class="text-sm text-muted" style="margin-bottom:14px">
            Use <strong>Auto-assign</strong> for name-pattern matching, or visit each project's settings to manually assign.
        </p>
        <div style="display:flex;gap:10px;margin-bottom:16px">
            <form method="POST" action="<?= APP_URL ?>/admin/projects/assign-stores">
                <button class="btn btn-primary" type="submit" onclick="return confirm('Auto-assign stores to all ungrouped projects by name matching?')">
                    🏷️ Auto-assign Stores
                </button>
            </form>
        </div>
        <table style="width:100%;border-collapse:collapse">
            <thead>
                <tr style="border-bottom:1px solid var(--border)">
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:var(--text-muted)">Project</th>
                    <th style="padding:8px 12px;text-align:center;font-size:12px;color:var(--text-muted)">Tasks</th>
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:var(--text-muted)">Action</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($ungroupedProjects as $up): ?>
                <tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:8px 12px">
                        <span style="width:8px;height:8px;border-radius:50%;background:<?= e($up['color'] ?? '#3b82f6') ?>;display:inline-block;margin-right:6px"></span>
                        <?= e($up['name']) ?>
                        <?php if ($up['asana_gid']): ?>
                        <span style="font-size:10px;color:var(--text-muted);margin-left:4px">Asana</span>
                        <?php endif; ?>
                    </td>
                    <td style="padding:8px 12px;text-align:center;font-size:13px"><?= (int)$up['task_count'] ?></td>
                    <td style="padding:8px 12px">
                        <a href="<?= APP_URL ?>/projects/<?= $up['id'] ?>/edit" class="btn btn-secondary btn-sm">Edit →</a>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php endif; ?>
    </div>
</div>

<!-- All stores reference -->
<div class="card">
    <div class="card-header">
        <h3 style="margin:0">🏢 All Businesses</h3>
        <a href="<?= APP_URL ?>/admin/stores" class="btn btn-secondary btn-sm">Manage →</a>
    </div>
    <div class="card-body" style="padding:0">
        <table style="width:100%;border-collapse:collapse">
            <tbody>
                <?php foreach ($allStores as $s): ?>
                <tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:10px 16px">
                        <span style="width:10px;height:10px;border-radius:50%;background:<?= e($s['color'] ?? '#3b82f6') ?>;display:inline-block;margin-right:8px"></span>
                        <a href="<?= APP_URL ?>/overview/store/<?= $s['id'] ?>" style="font-weight:600;color:inherit"><?= e($s['name']) ?></a>
                    </td>
                    <td style="padding:10px 16px;font-size:13px;color:var(--text-muted)"><?= (int)$s['project_count'] ?> categories</td>
                    <td style="padding:10px 16px;font-size:13px;color:var(--text-muted)"><?= (int)$s['bill_count'] ?> bills</td>
                    <td style="padding:10px 16px;text-align:right">
                        <a href="<?= APP_URL ?>/admin/stores/<?= $s['id'] ?>" class="btn btn-secondary btn-sm">Settings</a>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>

</div><!-- max-width wrapper -->

<?php $content = ob_get_clean(); require __DIR__ . '/../layouts/main.php'; ?>
