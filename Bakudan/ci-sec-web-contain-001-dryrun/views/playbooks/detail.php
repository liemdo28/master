<?php
// Phase 11 — Module 9: Playbook Detail View
$runDate = function($ts) { return date('M d, Y', strtotime($ts)); };
$statusLabel = function($r) { return ucfirst($r['status'] ?? ($r['is_completed'] ? 'done' : 'todo')); };
?>
<style>
.pb-hero {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 16px; padding: 28px; margin-bottom: 24px; border: 1px solid #2a2a3e;
    display: flex; align-items: center; justify-content: space-between;
}
.pb-hero h2 { font-size: 24px; font-weight: 700; color: #fff; margin: 0 0 6px; }
.pb-hero p { font-size: 13px; color: #9ca3af; margin: 0; }
.pb-badge { font-size: 12px; padding: 4px 12px; border-radius: 20px; font-weight: 600; }
.step-list { list-style: none; padding: 0; margin: 0; }
.step-item { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--border, #27272a); }
.step-item:last-child { border-bottom: none; }
.step-num { width: 28px; height: 28px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
.step-body { flex: 1; }
.step-name { font-size: 14px; font-weight: 500; color: var(--text-primary); }
.step-pri { font-size: 11px; padding: 2px 8px; border-radius: 6px; margin-left: 8px; }
.step-pri.high { background: rgba(255,68,68,0.15); color: #ff4444; }
.step-pri.medium { background: rgba(255,170,0,0.15); color: #ffaa00; }
.step-pri.low { background: rgba(59,130,246,0.15); color: #3b82f6; }
.run-form { background: var(--card-bg, #18181b); border: 1px solid var(--border, #27272a); border-radius: 12px; padding: 20px; margin-top: 20px; }
.run-form h3 { font-size: 14px; font-weight: 600; color: var(--text-primary); margin: 0 0 14px; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 12px; font-weight: 500; color: var(--text-muted); margin-bottom: 6px; }
.form-control { width: 100%; padding: 9px 12px; background: var(--input-bg, #1f1f23); border: 1px solid var(--border, #27272a); border-radius: 8px; color: var(--text-primary); font-size: 13px; box-sizing: border-box; }
.form-control:focus { outline: none; border-color: #3b82f6; }
.recent-runs { margin-top: 28px; }
.recent-runs h3 { font-size: 13px; font-weight: 600; color: var(--text-muted); margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.5px; }
.run-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border, #27272a); }
.run-row:last-child { border-bottom: none; }
.run-info { flex: 1; }
.run-title { font-size: 13px; color: var(--text-primary); }
.run-meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.run-status { font-size: 11px; padding: 2px 8px; border-radius: 6px; }
.run-status.done { background: rgba(0,204,102,0.15); color: #00cc66; }
.run-status.todo { background: rgba(59,130,246,0.15); color: #3b82f6; }
</style>

<div class="pb-hero" style="border-left: 4px solid <?= e($playbook['color']) ?>">
    <div>
        <h2><?= e($playbook['title']) ?></h2>
        <p><?= e($playbook['description']) ?></p>
    </div>
    <span class="pb-badge" style="background:<?= e($playbook['color']) ?>20;color:<?= e($playbook['color']) ?>">
        <?= count($playbook['steps']) ?> steps
    </span>
</div>

<div style="display:grid;grid-template-columns:1fr 300px;gap:24px;align-items:start">
    <div>
        <h3 style="font-size:13px;font-weight:600;color:var(--text-muted);margin:0 0 14px;text-transform:uppercase;letter-spacing:0.5px">Procedure Steps</h3>
        <ul class="step-list">
            <?php foreach ($playbook['steps'] as $i => $step): ?>
                <li class="step-item">
                    <div class="step-num" style="background:<?= e($playbook['color']) ?>"><?= $i + 1 ?></div>
                    <div class="step-body">
                        <div class="step-name">
                            <?= e($step['name']) ?>
                            <span class="step-pri <?= e($step['priority'] ?? 'medium') ?>"><?= e(ucfirst($step['priority'] ?? 'medium')) ?></span>
                        </div>
                    </div>
                </li>
            <?php endforeach; ?>
        </ul>

        <?php if (!empty($recentRuns)): ?>
        <div class="recent-runs">
            <h3>Recent Runs (last 30 days)</h3>
            <?php foreach (array_slice($recentRuns, 0, 8) as $r): ?>
                <div class="run-row">
                    <div class="run-info">
                        <div class="run-title"><?= e($r['title']) ?></div>
                        <div class="run-meta">
                            <?= e($r['assignee_name'] ?? 'Unassigned') ?> &bull; <?= e($runDate($r['created_at'])) ?>
                        </div>
                    </div>
                    <span class="run-status <?= e($r['is_completed'] ? 'done' : 'todo') ?>">
                        <?= e($statusLabel($r)) ?>
                    </span>
                </div>
            <?php endforeach; ?>
        </div>
        <?php endif; ?>
    </div>

    <div>
        <div class="run-form">
            <h3>Run This Playbook</h3>
            <form method="POST" action="/playbooks/<?= e($playbook['key']) ?>/run">
                <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                <div class="form-group">
                    <label>Assign to</label>
                    <select name="assignee_id" class="form-control">
                        <?php foreach ((new User())->getActive() as $u): ?>
                            <option value="<?= $u['id'] ?>" <?= $u['id'] == $_SESSION['user_id'] ? 'selected' : '' ?>>
                                <?= e($u['name']) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="form-group">
                    <label>Due Date</label>
                    <input type="date" name="due_date" class="form-control" value="<?= e(DateService::today()) ?>">
                </div>
                <button type="submit" style="width:100%;padding:12px;background:<?= e($playbook['color']) ?>;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">
                    Start Playbook (<?= count($playbook['steps']) ?> tasks)
                </button>
            </form>
        </div>
    </div>
</div>
