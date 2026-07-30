<?php
$pageTitle = 'Merge Projects';
$currentPage = 'admin-projects';
ob_start();

$activeProjects = array_filter($projects, fn($p) => ($p['status'] ?? 'active') === 'active');
?>
<style>
.pm-wrap{max-width:960px;margin:0 auto}
.pm-hero{padding:18px 20px;border:1px solid var(--border);border-radius:14px;background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(168,85,247,.04));margin-bottom:18px}
.pm-hero h2{margin:0 0 4px;font-size:20px;font-weight:700}
.pm-hero p{margin:0;color:var(--text-muted);font-size:13px}
.pm-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media (max-width:800px){.pm-grid{grid-template-columns:1fr}}
.pm-card{border:1px solid var(--border);border-radius:14px;background:var(--bg-secondary);overflow:hidden}
.pm-card-head{padding:12px 14px;border-bottom:1px solid var(--border);font-weight:600;display:flex;justify-content:space-between;align-items:center}
.pm-card-body{padding:12px;max-height:520px;overflow-y:auto}
.pm-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;transition:background .1s;border:1px solid transparent}
.pm-row:hover{background:rgba(99,102,241,.08)}
.pm-row.pm-row-checked{background:rgba(99,102,241,.15);border-color:rgba(99,102,241,.5)}
.pm-row.pm-row-disabled{opacity:.4;cursor:not-allowed}
.pm-row-dot{width:10px;height:10px;border-radius:3px;flex-shrink:0}
.pm-row-main{flex:1;min-width:0}
.pm-row-name{font-weight:500;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pm-row-meta{font-size:11px;color:var(--text-muted);margin-top:2px}
.pm-row-badge{background:rgba(255,255,255,.06);padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600}
.pm-row-badge.pm-badge-archived{background:rgba(234,179,8,.2);color:#fde68a}
.pm-row-radio,.pm-row-check{flex-shrink:0}
.pm-actions{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:18px;padding:16px;border:1px solid var(--border);border-radius:12px;background:var(--bg-secondary);flex-wrap:wrap}
.pm-preview{font-size:13px}
.pm-preview b{color:#a5b4fc}
.pm-danger-zone{margin-top:18px;padding:12px 14px;border:1px dashed rgba(239,68,68,.3);border-radius:10px;background:rgba(239,68,68,.04);font-size:12px;color:var(--text-muted)}
</style>

<div class="pm-wrap">
    <div class="pm-hero">
        <h2>🔀 Merge Projects</h2>
        <p>Select one or more source projects on the left, then select a destination project on the right. All <b>tasks</b> and <b>sections</b> from source projects will be moved to the destination. Optionally archive source projects after merging (can be restored later).</p>
    </div>

    <?php if ($m = flash('error')): ?><div class="alert alert-danger"><?= e($m) ?></div><?php endif; ?>
    <?php if ($m = flash('success')): ?><div class="alert alert-success"><?= e($m) ?></div><?php endif; ?>

    <form method="POST" action="<?= APP_URL ?>/admin/projects/merge" id="pm-form">
        <input type="hidden" name="csrf_token" value="<?= csrf_token() ?>">
        <input type="hidden" name="target_id" id="pm-target" value="">

        <div class="pm-grid">
            <!-- Source projects (multi-select) -->
            <div class="pm-card">
                <div class="pm-card-head">
                    <span>📤 Source Projects <span style="font-weight:400;opacity:.6">(select multiple)</span></span>
                    <span id="pm-source-count" class="pm-row-badge">0</span>
                </div>
                <div class="pm-card-body">
                    <?php foreach ($projects as $p):
                        $isArchived = ($p['status'] ?? 'active') !== 'active';
                    ?>
                    <label class="pm-row <?= $isArchived ? 'pm-row-disabled' : '' ?>" data-pm-row data-pid="<?= (int)$p['id'] ?>">
                        <input type="checkbox" class="pm-row-check" name="source_ids[]" value="<?= (int)$p['id'] ?>" <?= $isArchived ? 'disabled' : '' ?>>
                        <span class="pm-row-dot" style="background:<?= e($p['color'] ?: '#6366f1') ?>"></span>
                        <div class="pm-row-main">
                            <div class="pm-row-name"><?= e($p['name']) ?></div>
                            <div class="pm-row-meta">
                                <?= (int)$p['task_count'] ?> task · <?= (int)$p['section_count'] ?> section
                                <?= $p['store_name'] ? ' · 🏪 ' . e($p['store_name']) : '' ?>
                                <?php if ($isArchived): ?> · <span class="pm-row-badge pm-badge-archived">archived</span><?php endif; ?>
                            </div>
                        </div>
                    </label>
                    <?php endforeach; ?>
                </div>
            </div>

            <!-- Target project (single-select) -->
            <div class="pm-card">
                <div class="pm-card-head">
                    <span>📥 Destination Project <span style="font-weight:400;opacity:.6">(select one)</span></span>
                    <span id="pm-target-name" class="pm-row-badge" style="background:rgba(34,197,94,.2);color:#bbf7d0">not selected</span>
                </div>
                <div class="pm-card-body">
                    <?php foreach ($activeProjects as $p): ?>
                    <label class="pm-row" data-pm-target-row data-pid="<?= (int)$p['id'] ?>" data-pname="<?= e($p['name']) ?>">
                        <input type="radio" class="pm-row-radio" name="__target_radio" value="<?= (int)$p['id'] ?>">
                        <span class="pm-row-dot" style="background:<?= e($p['color'] ?: '#6366f1') ?>"></span>
                        <div class="pm-row-main">
                            <div class="pm-row-name"><?= e($p['name']) ?></div>
                            <div class="pm-row-meta">
                                <?= (int)$p['task_count'] ?> task · <?= (int)$p['section_count'] ?> section
                                <?= $p['store_name'] ? ' · 🏪 ' . e($p['store_name']) : '' ?>
                            </div>
                        </div>
                    </label>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>

        <div class="pm-actions">
            <div class="pm-preview">
                <div>Will merge <b id="pm-sum-src">0</b> project → <b id="pm-sum-tgt">—</b></div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">➡ move <b id="pm-sum-tasks">0</b> task and <b id="pm-sum-sections">0</b> section</div>
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap">
                <label style="display:flex;align-items:center;gap:6px;font-size:12px">
                    <input type="checkbox" name="archive_sources" value="1" checked> Archive source after merge
                </label>
                <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#fca5a5">
                    <input type="checkbox" name="hard_delete_sources" value="1"> ⚠️ Delete source (cannot undo)
                </label>
            </div>
            <button type="submit" class="btn btn-primary" id="pm-submit" disabled>
                🔀 Merge Now
            </button>
        </div>

        <div class="pm-danger-zone">
            ⚠️ Tasks will get a new <code>project_id</code>. Archive = reversible; Delete = permanent. Mistake: select the old target as source to reverse the merge (as long as it wasn't deleted).
        </div>
    </form>

    <!-- TKT-402 · Standalone delete for empty / to-be-removed projects -->
    <div class="pm-card" style="margin-top:24px">
        <div class="pm-card-head"><span>🗑 Delete Single Project</span></div>
        <div class="pm-card-body">
            <form method="POST" action="<?= APP_URL ?>/admin/projects/0/delete" id="pm-del-form" onsubmit="return pmConfirmDelete(event)">
                <input type="hidden" name="csrf_token" value="<?= csrf_token() ?>">
                <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
                    <div style="flex:1;min-width:220px">
                        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Select project to delete</label>
                        <select name="pm-del-pid" id="pm-del-pid" class="form-control" required>
                            <option value="">— select project —</option>
                            <?php foreach ($projects as $p): ?>
                                <option value="<?= (int)$p['id'] ?>" data-count="<?= (int)$p['task_count'] ?>"><?= e($p['name']) ?> (<?= (int)$p['task_count'] ?> task)</option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#fca5a5">
                        <input type="checkbox" name="confirm_delete_all" value="1"> Also delete tasks (if any)
                    </label>
                    <button type="submit" class="btn btn-outline" style="border-color:rgba(239,68,68,.4);color:#fca5a5">🗑 Delete</button>
                </div>
            </form>
        </div>
    </div>

    <!-- TKT-403 · Bulk mark-complete by date threshold -->
    <div class="pm-card" style="margin-top:16px">
        <div class="pm-card-head"><span>✓ Bulk Mark Completed by Date</span></div>
        <div class="pm-card-body">
            <form method="POST" action="<?= APP_URL ?>/admin/tasks/bulk-complete" onsubmit="return confirm('Mark ALL tasks with due_date ≤ selected date as done?')">
                <input type="hidden" name="csrf_token" value="<?= csrf_token() ?>">
                <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
                    <div>
                        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Due date ≤</label>
                        <input type="date" name="threshold" value="2026-02-28" class="form-control" required>
                    </div>
                    <div style="flex:1;min-width:220px">
                        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Scope</label>
                        <select name="scope" class="form-control" onchange="document.getElementById('pm-bc-pid').style.display=this.value==='project'?'block':'none'">
                            <option value="all">All Projects</option>
                            <option value="project">Single Project</option>
                        </select>
                    </div>
                    <div id="pm-bc-pid" style="display:none;flex:1;min-width:220px">
                        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Project</label>
                        <select name="project_id" class="form-control">
                            <option value="">—</option>
                            <?php foreach ($projects as $p): ?>
                                <option value="<?= (int)$p['id'] ?>"><?= e($p['name']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary">✓ Mark done</button>
                </div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:8px">Example: clean up tasks ≤ <code>2026-02-28</code> as done to reduce backlog noise.</div>
            </form>
        </div>
    </div>

    <!-- TKT-404 · Auto-classify tasks to stores by content -->
    <div class="pm-card" style="margin-top:16px">
        <div class="pm-card-head"><span>🏷 Auto-classify Tasks by Store (keyword match)</span></div>
        <div class="pm-card-body">
            <form method="POST" action="<?= APP_URL ?>/admin/tasks/classify-by-store" onsubmit="return confirm('Auto-move tasks to the store project that matches task content?')">
                <input type="hidden" name="csrf_token" value="<?= csrf_token() ?>">
                <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
                    <div style="flex:1;min-width:220px">
                        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Scope</label>
                        <select name="scope" class="form-control" onchange="document.getElementById('pm-cl-pid').style.display=this.value==='project'?'block':'none'">
                            <option value="all">All Tasks</option>
                            <option value="project">Single Source Project</option>
                        </select>
                    </div>
                    <div id="pm-cl-pid" style="display:none;flex:1;min-width:220px">
                        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Source Project</label>
                        <select name="project_id" class="form-control">
                            <option value="">—</option>
                            <?php foreach ($projects as $p): ?>
                                <option value="<?= (int)$p['id'] ?>"><?= e($p['name']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary">🏷 Classify</button>
                </div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:8px">Matches title/description against store names to assign the right project.</div>
            </form>
        </div>
    </div>
</div>

<script>
function pmConfirmDelete(e) {
    const sel = document.getElementById('pm-del-pid');
    const pid = sel.value;
    if (!pid) { e.preventDefault(); return false; }
    const opt = sel.options[sel.selectedIndex];
    const count = +opt.dataset.count || 0;
    if (!confirm(`Delete project "${opt.text}"${count > 0 ? ' along with '+count+' task(s)' : ''}?`)) { e.preventDefault(); return false; }
    // route must be admin/projects/{id}/delete — swap URL
    e.target.action = e.target.action.replace(/projects\/\d+\//, 'projects/' + pid + '/');
    return true;
}
</script>

<script>
(function(){
    const form = document.getElementById('pm-form');
    const srcRows = Array.from(document.querySelectorAll('[data-pm-row]'));
    const tgtRows = Array.from(document.querySelectorAll('[data-pm-target-row]'));
    const submit = document.getElementById('pm-submit');
    const srcCountBadge = document.getElementById('pm-source-count');
    const tgtBadge = document.getElementById('pm-target-name');
    const sumSrc = document.getElementById('pm-sum-src');
    const sumTgt = document.getElementById('pm-sum-tgt');
    const sumTasks = document.getElementById('pm-sum-tasks');
    const sumSections = document.getElementById('pm-sum-sections');
    const targetField = document.getElementById('pm-target');

    const counts = {};
    srcRows.forEach(r => {
        counts[r.dataset.pid] = {
            tasks: parseInt(r.querySelector('.pm-row-meta').textContent.match(/(\d+) task/)?.[1] || '0', 10),
            sections: parseInt(r.querySelector('.pm-row-meta').textContent.match(/(\d+) section/)?.[1] || '0', 10),
        };
    });

    let targetId = null;

    function update() {
        const selectedSrcs = srcRows.filter(r => {
            const cb = r.querySelector('.pm-row-check'); return cb && cb.checked;
        });
        const totalTasks = selectedSrcs.reduce((s, r) => s + (counts[r.dataset.pid]?.tasks || 0), 0);
        const totalSecs  = selectedSrcs.reduce((s, r) => s + (counts[r.dataset.pid]?.sections || 0), 0);
        srcCountBadge.textContent = selectedSrcs.length;
        sumSrc.textContent = selectedSrcs.length;
        sumTasks.textContent = totalTasks;
        sumSections.textContent = totalSecs;

        srcRows.forEach(r => {
            const cb = r.querySelector('.pm-row-check');
            r.classList.toggle('pm-row-checked', cb && cb.checked);
        });

        // forbid target == any source
        const srcIds = new Set(selectedSrcs.map(r => r.dataset.pid));
        tgtRows.forEach(r => {
            const isSrc = srcIds.has(r.dataset.pid);
            const radio = r.querySelector('.pm-row-radio');
            radio.disabled = isSrc;
            r.classList.toggle('pm-row-disabled', isSrc);
            if (isSrc && radio.checked) { radio.checked = false; targetId = null; }
        });

        // reflect target
        const chosen = tgtRows.find(r => r.querySelector('.pm-row-radio').checked);
        targetId = chosen ? chosen.dataset.pid : null;
        targetField.value = targetId || '';
        tgtBadge.textContent = chosen ? chosen.dataset.pname : 'not selected';
        sumTgt.textContent = chosen ? chosen.dataset.pname : '—';
        tgtRows.forEach(r => r.classList.toggle('pm-row-checked', r === chosen));

        submit.disabled = !(selectedSrcs.length && targetId);
    }

    srcRows.forEach(r => r.addEventListener('change', update));
    tgtRows.forEach(r => r.addEventListener('change', update));

    form.addEventListener('submit', (e) => {
        const n = srcRows.filter(r => r.querySelector('.pm-row-check')?.checked).length;
        const chosen = tgtRows.find(r => r.querySelector('.pm-row-radio').checked);
        if (!confirm(`Merge ${n} project(s) into "${chosen?.dataset.pname}"?`)) {
            e.preventDefault();
        }
    });
})();
</script>

<?php $content = ob_get_clean(); require __DIR__ . '/../layouts/main.php'; ?>
