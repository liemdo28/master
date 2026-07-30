<?php
$pageTitle = t('asana.import_title');
$currentPage = 'asana-import';
ob_start();
$isConnected = !empty($asanaSettings);
?>

<div style="max-width:700px;margin:0 auto">

    <?php if ($isConnected): ?>
    <!-- Connected State -->
    <div class="card">
        <div class="card-header">
            <h3><?= e(t('asana.sync_title')) ?></h3>
            <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#16a34a;font-weight:600">
                <span style="width:8px;height:8px;background:#16a34a;border-radius:50%;display:inline-block"></span>
                <?= e(t('asana.connected')) ?>
            </span>
        </div>
        <div class="card-body">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
                <div>
                    <div class="text-sm text-muted"><?= e(t('asana.workspace')) ?></div>
                    <div style="font-weight:600;margin-top:2px"><?= e($asanaSettings['workspace_name'] ?: $asanaSettings['workspace_id']) ?></div>
                </div>
                <div>
                    <div class="text-sm text-muted"><?= e(t('asana.last_sync')) ?></div>
                    <div style="font-weight:600;margin-top:2px">
                        <?= $asanaSettings['last_sync_at'] ? date('d/m/Y H:i', strtotime($asanaSettings['last_sync_at'])) : e(t('asana.never')) ?>
                    </div>
                </div>
            </div>

            <!-- Target project setting -->
            <div style="background:var(--bg-secondary);border-radius:8px;padding:14px;margin-bottom:16px">
                <div style="font-weight:600;font-size:13px;margin-bottom:8px">📁 Import Into Project</div>
                <div style="display:flex;gap:10px;align-items:center">
                    <select id="targetProjectSelect" class="form-control" style="flex:1">
                        <option value="">-- Create new project (default) --</option>
                        <?php foreach ($activeProjects as $p): ?>
                        <option value="<?= (int)$p['id'] ?>"
                            <?= (int)($asanaSettings['sync_target_project_id'] ?? 0) === (int)$p['id'] ? 'selected' : '' ?>>
                            <?= e($p['name']) ?>
                        </option>
                        <?php endforeach; ?>
                    </select>
                    <button class="btn btn-secondary btn-sm" onclick="saveTargetProject(this)">Save</button>
                </div>
                <p class="text-sm text-muted" style="margin-top:6px;margin-bottom:0">
                    When selected, each Asana project becomes a section and its tasks are placed inside the chosen project. No new standalone projects will be created.
                </p>
            </div>

            <div style="display:flex;gap:12px;align-items:center;padding:16px;background:var(--bg-secondary);border-radius:8px;margin-bottom:16px">
                <div style="font-size:24px">🔄</div>
                <div style="flex:1">
                    <div style="font-weight:600;font-size:14px"><?= e(t('asana.auto_sync')) ?></div>
                    <div class="text-sm text-muted"><?= e(t('asana.auto_sync_desc')) ?></div>
                </div>
                <span style="font-size:12px;color:#16a34a;font-weight:600"><?= e(t('asana.active')) ?></span>
            </div>

            <div style="display:flex;gap:10px">
                <button class="btn btn-primary" id="syncBtn" onclick="syncNow()"><?= e(t('asana.sync_now')) ?></button>
                <a href="<?= APP_URL ?>/projects" class="btn btn-secondary"><?= e(t('asana.view_projects')) ?></a>
                <button class="btn btn-outline btn-sm" style="margin-left:auto" onclick="disconnectAsana()"><?= e(t('asana.disconnect')) ?></button>
            </div>

            <!-- Sync Results -->
            <div id="sync-results" style="display:none;margin-top:16px"></div>
        </div>
    </div>

    <!-- Fix: auto-assign store_id to ungrouped projects -->
    <?php if (isAdmin()): ?>
    <div class="card" style="margin-top:20px">
        <div class="card-header">
            <h3>🏷️ Assign Stores to Ungrouped Projects</h3>
        </div>
        <div class="card-body">
            <p class="text-sm text-muted" style="margin-bottom:14px">
                Automatically assign stores to all projects without a store, based on project name keywords.
                Example: "Raw PGE" → Raw Stockton, "Bakudan Rim" → Bakudan Rim. Safe — only updates projects without an existing store_id.
            </p>
            <form method="POST" action="<?= APP_URL ?>/admin/projects/assign-stores">
                <button class="btn btn-primary" type="submit">🏷️ Auto-assign Stores</button>
            </form>
        </div>
    </div>
    <?php endif; ?>

    <!-- Migrate existing Asana projects into one project -->
    <?php if (isAdmin()): ?>
    <div class="card" style="margin-top:20px">
        <div class="card-header">
            <h3>🔀 Migrate Asana projects → 1 project</h3>
        </div>
        <div class="card-body">
            <p class="text-sm text-muted" style="margin-bottom:14px">
                Move all tasks from Asana-created projects (those with <code>asana_gid</code>) into a single destination project, then archive the sources.
            </p>
            <form method="POST" action="<?= APP_URL ?>/asana/migrate"
                  onsubmit="return confirm('Migrate and archive all Asana projects into the selected project?')">
                <div style="display:flex;gap:10px;align-items:center">
                    <select name="target_id" class="form-control" required style="flex:1">
                        <option value="">-- Select destination project --</option>
                        <?php foreach ($activeProjects as $p): ?>
                        <option value="<?= (int)$p['id'] ?>"><?= e($p['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <button class="btn btn-primary" type="submit">🔀 Migrate Now</button>
                </div>
            </form>
        </div>
    </div>
    <?php endif; ?>

    <!-- Quick seed: Raw Stockton recurring bills -->
    <?php if (isAdmin()): ?>
    <div class="card" style="margin-top:20px">
        <div class="card-header">
            <h3>💳 Create Recurring Bills — Raw Stockton</h3>
        </div>
        <div class="card-body">
            <p class="text-sm text-muted" style="margin-bottom:14px">
                Creates 5 monthly recurring bills for the Raw Stockton store: PG&amp;E (20th), QuickBooks Tax (20th), Sales Tax (20th), Lease Prepayment (1st), and General Expenses (1st). Safe to run multiple times — skips bills that already exist.
            </p>
            <form method="POST" action="<?= APP_URL ?>/bills/seed-raw-stockton"
                  onsubmit="return confirm('Create recurring bills for Raw Stockton?')">
                <button class="btn btn-primary" type="submit">💳 Create Bills Now</button>
            </form>
        </div>
    </div>
    <?php endif; ?>

    <?php else: ?>
    <!-- Not Connected State -->
    <div class="card">
        <div class="card-header"><h3><?= e(t('asana.import_title')) ?></h3></div>
        <div class="card-body">
            <p class="text-sm text-muted mb-3"><?= e(t('asana.import_desc')) ?></p>

            <!-- Step 1: Token -->
            <div id="step-token">
                <div class="form-group">
                    <label><?= e(t('asana.token_label')) ?></label>
                    <input type="password" id="asana-token" class="form-control" placeholder="0/123456789...">
                    <p class="text-sm text-muted" style="margin-top:6px">
                        <?= t('asana.token_help') ?>
                    </p>
                </div>
                <button class="btn btn-primary" onclick="fetchWorkspaces()"><?= e(t('asana.connect')) ?></button>
            </div>

            <!-- Step 2: Workspace -->
            <div id="step-workspace" style="display:none">
                <div class="form-group">
                    <label><?= e(t('asana.select_workspace')) ?></label>
                    <select id="workspace-select" class="form-control"></select>
                </div>
                <button class="btn btn-primary" onclick="saveAndSync()"><?= e(t('asana.connect_and_sync')) ?></button>
                <button class="btn btn-secondary ml-2" onclick="resetSetup()"><?= e(t('common.cancel')) ?></button>
            </div>

            <!-- Progress -->
            <div id="step-progress" style="display:none">
                <div style="text-align:center;padding:40px 0">
                    <div class="spinner" style="margin:0 auto 16px"></div>
                    <p style="font-size:14px;color:var(--text-secondary)"><?= e(t('asana.importing')) ?></p>
                </div>
            </div>

            <!-- Error -->
            <div id="step-error" style="display:none">
                <div class="alert alert-danger" id="error-text"></div>
                <button class="btn btn-secondary" onclick="resetSetup()"><?= e(t('common.back')) ?></button>
            </div>
        </div>
    </div>
    <?php endif; ?>
</div>

<style>
.spinner{width:36px;height:36px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.result-card{background:var(--bg-secondary);border-radius:10px;padding:16px;text-align:center}
.result-val{font-size:24px;font-weight:800;color:var(--accent)}
.result-label{font-size:12px;color:var(--text-muted);margin-top:4px}
.result-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.alert-danger{background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.3);color:#dc2626;padding:14px 18px;border-radius:8px;font-size:14px}
.alert-success{background:rgba(22,163,74,.1);border:1px solid rgba(22,163,74,.3);color:#16a34a;padding:14px 18px;border-radius:8px;font-size:14px}
</style>

<script>
const APP = '<?= APP_URL ?>';
let token = '';

<?php if ($isConnected): ?>
// --- Connected mode ---
async function syncNow() {
    const btn = document.getElementById('syncBtn');
    btn.disabled = true;
    btn.textContent = '<?= e(t('asana.syncing')) ?>';
    document.getElementById('sync-results').style.display = 'none';

    try {
        const res = await fetch(APP + '/asana/sync', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: '_=1'
        });
        const data = await res.json();
        const el = document.getElementById('sync-results');
        el.style.display = 'block';

        if (data.error) {
            el.innerHTML = '<div class="alert-danger">' + data.error + '</div>';
            return;
        }

        const modeLabel = data.mode === 'target' ? ' (target project mode)' : ' (standalone mode)';
        let html = '<div class="alert-success" style="margin-bottom:12px"><?= e(t('asana.sync_complete')) ?>' + modeLabel + '</div>';
        html += '<div class="result-grid">';
        const p1Label = data.mode === 'target' ? 'Asana projects xử lý' : '<?= e(t('asana.new_projects')) ?>';
        html += '<div class="result-card"><div class="result-val">' + data.created_projects + '</div><div class="result-label">' + p1Label + '</div></div>';
        html += '<div class="result-card"><div class="result-val">' + data.updated_projects + '</div><div class="result-label"><?= e(t('asana.updated_projects')) ?></div></div>';
        html += '<div class="result-card"><div class="result-val">' + data.created_tasks + '</div><div class="result-label"><?= e(t('asana.new_tasks')) ?></div></div>';
        html += '<div class="result-card"><div class="result-val">' + data.updated_tasks + '</div><div class="result-label"><?= e(t('asana.updated_tasks')) ?></div></div>';
        html += '</div>';

        if (data.errors && data.errors.length > 0) {
            html += '<div class="alert-danger" style="margin-top:10px">' + data.errors.join('<br>') + '</div>';
        }
        el.innerHTML = html;
    } catch (e) {
        document.getElementById('sync-results').innerHTML = '<div class="alert-danger">' + e.message + '</div>';
        document.getElementById('sync-results').style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = '<?= e(t('asana.sync_now')) ?>';
    }
}

async function saveTargetProject(btn) {
    const sel = document.getElementById('targetProjectSelect');
    const val = sel.value;
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = '...';
    try {
        const res = await fetch(APP + '/asana/settings', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: 'sync_target_project_id=' + encodeURIComponent(val)
        });
        const data = await res.json();
        if (data.success) {
            btn.textContent = '✓';
            setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1500);
        } else {
            alert(data.error || 'Error saving');
            btn.textContent = orig; btn.disabled = false;
        }
    } catch(e) {
        alert(e.message);
        btn.textContent = orig; btn.disabled = false;
    }
}

async function disconnectAsana() {
    if (!confirm('<?= e(t('asana.disconnect_confirm')) ?>')) return;
    await fetch(APP + '/asana/disconnect', {method: 'POST'});
    location.reload();
}

<?php else: ?>
// --- Setup mode ---
function showStep(step) {
    ['token','workspace','progress','error'].forEach(s => {
        const el = document.getElementById('step-'+s);
        if (el) el.style.display = s === step ? 'block' : 'none';
    });
}

function showError(msg) {
    document.getElementById('error-text').textContent = msg;
    showStep('error');
}

async function fetchWorkspaces() {
    token = document.getElementById('asana-token').value.trim();
    if (!token) return;

    const btn = event.target;
    btn.disabled = true; btn.textContent = '...';

    try {
        const res = await fetch(APP + '/asana/workspaces', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: 'token=' + encodeURIComponent(token)
        });
        const data = await res.json();
        if (data.error) { showError(data.error); return; }

        const sel = document.getElementById('workspace-select');
        sel.innerHTML = '';
        (data.data || []).forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.gid;
            opt.textContent = w.name;
            opt.dataset.name = w.name;
            sel.appendChild(opt);
        });

        if (sel.options.length === 0) { showError('<?= e(t('asana.no_workspaces')) ?>'); return; }
        showStep('workspace');
    } catch (e) { showError(e.message); }
    finally { btn.disabled = false; btn.textContent = '<?= e(t('asana.connect')) ?>'; }
}

async function saveAndSync() {
    const sel = document.getElementById('workspace-select');
    const workspaceId = sel.value;
    const workspaceName = sel.options[sel.selectedIndex].textContent;
    if (!workspaceId) return;

    showStep('progress');

    try {
        // Save settings
        const saveRes = await fetch(APP + '/asana/save', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: 'token=' + encodeURIComponent(token) + '&workspace_id=' + encodeURIComponent(workspaceId) + '&workspace_name=' + encodeURIComponent(workspaceName)
        });
        const saveData = await saveRes.json();
        if (saveData.error) { showError(saveData.error); return; }

        // Trigger sync
        const syncRes = await fetch(APP + '/asana/sync', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: '_=1'
        });
        await syncRes.json();

        // Reload to show connected state
        location.reload();
    } catch (e) { showError(e.message); }
}

function resetSetup() {
    token = '';
    document.getElementById('asana-token').value = '';
    showStep('token');
}
<?php endif; ?>
</script>

<?php $content = ob_get_clean(); require __DIR__ . '/../layouts/main.php'; ?>
