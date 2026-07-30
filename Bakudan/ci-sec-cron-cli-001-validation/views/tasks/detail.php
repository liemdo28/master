<?php
$pageTitle = e($task['title'] ?? 'Task');
$currentPage = 'projects';
$taskModel = new Task();
$watchers  = is_array($taskModel->getWatchers($task['id'] ?? 0)) ? $taskModel->getWatchers($task['id']) : [];
$children  = is_array($taskModel->getChildren($task['id'] ?? 0))  ? $taskModel->getChildren($task['id'])  : [];
$parentTask = !empty($task['parent_task_id']) ? $taskModel->findById($task['parent_task_id']) : null;
$projectMembers = (new Project())->getMembers($task['project_id'] ?? 0);
ob_start();

$visibility      = $task['visibility'] ?? 'private';
$visibilityLabel = $visibility === 'public' ? 'Public' : 'Private';
$visibilityIcon  = $visibility === 'public' ? 'globe' : 'lock';
$rc              = json_decode($task['repeat_config'] ?? '{}', true) ?: [];
$reviewChecklist = json_decode($task['review_checklist'] ?? '[]', true) ?: [];
$requiredEvidence= json_decode($task['required_evidence'] ?? '[]', true) ?: [];
$requiredFiles   = json_decode($task['required_files'] ?? '[]', true) ?: [];
$taskStoreIds    = $taskStoreIds ?? [];
$taskCategoryOptions = [
    'tax' => 'Tax',
    'rent' => 'Rent',
    'electronic' => 'Electronic',
    'water' => 'Water',
    'trash' => 'Trash',
    'phone' => 'Phone',
    'insurance' => 'Insurance',
    'payment' => 'Payment',
    'bill' => 'Bill',
    'payroll' => 'Payroll',
    'sale_receipt' => 'Sale Receipt',
    'store_operation' => 'Store Operation',
    'admin' => 'Admin',
    'review' => 'Review',
    'other' => 'Other',
];
$selectedTaskCategories = $taskModel->getCategories((int)($task['id'] ?? 0));
if (empty($selectedTaskCategories) && !empty($task['task_category'])) {
    $selectedTaskCategories = [(string)$task['task_category']];
}

if (!function_exists('taskDetailDateLabel')) {
    function taskDetailDateLabel($date): string {
        if (empty($date)) return '-';
        return date('M j, Y', strtotime((string)$date));
    }
}

// Approval context
$approvalRequired = !empty($task['approval_required']);
$taskStatus       = $task['status'] ?? '';
$currentUid       = (int)($_SESSION['user_id'] ?? 0);
$isAssignee       = $currentUid === (int)($task['assignee_id'] ?? 0);
$isReviewer       = $currentUid === (int)($task['reviewer_id']  ?? 0);
$isApprover       = $currentUid === (int)($task['approver_id']  ?? 0);

// Status colors
$statusColors = [
    'todo'                 => ['c'=>'#9faab8', 'bg'=>'rgba(159,170,184,.1)',  'label'=>'To Do'],
    'in_progress'          => ['c'=>'#60a5fa', 'bg'=>'rgba(96,165,250,.12)',  'label'=>'In Progress'],
    'review'               => ['c'=>'#f59e0b', 'bg'=>'rgba(245,158,11,.12)',  'label'=>'In Review'],
    'done'                 => ['c'=>'#4ade80', 'bg'=>'rgba(74,222,128,.12)',  'label'=>'Done'],
    'pending_review'       => ['c'=>'#fbbf24', 'bg'=>'rgba(251,191,36,.12)',  'label'=>'Pending Review'],
    'pending_acceptance'   => ['c'=>'#a78bfa', 'bg'=>'rgba(167,139,250,.12)', 'label'=>'Pending Acceptance'],
    'review_rejected'      => ['c'=>'#f87171', 'bg'=>'rgba(248,113,113,.12)', 'label'=>'Review Rejected'],
    'acceptance_rejected'  => ['c'=>'#f87171', 'bg'=>'rgba(248,113,113,.12)', 'label'=>'Acceptance Rejected'],
    'accepted'             => ['c'=>'#4ade80', 'bg'=>'rgba(74,222,128,.12)',  'label'=>'Accepted'],
];
$sc = $statusColors[$taskStatus] ?? ['c'=>'#9faab8','bg'=>'rgba(159,170,184,.1)','label'=>ucfirst($taskStatus)];
?>
<style>
/* ── Task Detail Layout ────────────────────────────────────── */
.td-wrap { max-width: 1400px; margin: 0 auto; }

/* Top bar */
.td-topbar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:20px; }
.td-topbar-left { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.td-topbar-right { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }

/* 2-column main layout */
.td-layout {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 20px;
    align-items: start;
}
@media (max-width: 1100px) { .td-layout { grid-template-columns: 1fr; } }

/* ── Tabs ──────────────────────────────────────────────────── */
.td-tabs {
    display: flex;
    gap: 2px;
    background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.07);
    border-radius: 12px;
    padding: 4px;
    margin-bottom: 16px;
    flex-wrap: wrap;
}
.td-tab {
    flex: 1;
    min-width: 80px;
    padding: 8px 12px;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 600;
    color: #6b7f94;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all .15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    white-space: nowrap;
}
.td-tab:hover { color: #b8c0cc; background: rgba(255,255,255,.04); }
.td-tab.active {
    background: #1a2434;
    color: #eef2f7;
    box-shadow: 0 1px 3px rgba(0,0,0,.4);
}
.td-tab .td-tab-badge {
    background: #c0392b;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 999px;
    min-width: 16px;
    text-align: center;
}
.td-pane { display: none; }
.td-pane.active { display: block; }

/* ── Sidebar ───────────────────────────────────────────────── */
.td-sidebar {
    position: sticky;
    top: 80px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.td-sidebar-card {
    background: #111827;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 14px;
    padding: 16px;
}
.td-sidebar-label {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .1em;
    color: #5d6d7e;
    margin-bottom: 10px;
}
.td-people-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    border-bottom: 1px solid rgba(255,255,255,.04);
}
.td-people-row:last-child { border-bottom: none; }
.td-people-role { font-size: 11px; color: #5d6d7e; min-width: 72px; }
.td-people-name { font-size: 13px; font-weight: 600; color: #c8d6e0; }
.td-avatar {
    width: 28px; height: 28px;
    border-radius: 50%;
    background: #1a2434;
    border: 1px solid rgba(255,255,255,.1);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700;
    color: #9faab8;
    flex-shrink: 0;
}

/* ── Workspace panels ──────────────────────────────────────── */
.workspace-panel {
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 20px;
    border: 1px solid;
}
.workspace-panel.reviewer-ws {
    border-color: rgba(251,191,36,.25);
    background: #0f1820;
}
.workspace-panel.approver-ws {
    border-color: rgba(167,139,250,.25);
    background: #0f1820;
}
.ws-header {
    padding: 14px 20px;
    border-bottom: 1px solid rgba(255,255,255,.07);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}
.ws-title { font-size: 14px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
.ws-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
}
@media (max-width: 900px) { .ws-grid { grid-template-columns: 1fr; } }
.ws-left {
    padding: 20px;
    border-right: 1px solid rgba(255,255,255,.06);
}
.ws-right { padding: 20px; }
.ws-footer {
    padding: 14px 20px;
    border-top: 1px solid rgba(255,255,255,.07);
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

/* Checklist */
.ws-checklist { list-style: none; display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.ws-checklist-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 13px;
    color: #b8c0cc;
    line-height: 1.5;
}
.ws-checklist-item input[type=checkbox] { margin-top: 2px; accent-color: #27ae60; flex-shrink: 0; }

/* Evidence list */
.ws-evidence-list { list-style: none; display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.ws-evidence-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(255,255,255,.04);
    border-radius: 8px;
    font-size: 13px;
    color: #b8c0cc;
}
.ws-evidence-item .ws-ev-icon { font-size: 14px; flex-shrink: 0; }

/* Approval chain mini */
.approval-chain-mini { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.chain-mini-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    min-width: 80px;
    flex: 1;
}
.chain-mini-dot {
    width: 32px; height: 32px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px;
    border: 2px solid;
    transition: all .2s;
}
.chain-mini-dot.done   { background: rgba(74,222,128,.12); border-color: #4ade80; color: #4ade80; }
.chain-mini-dot.active { background: rgba(251,191,36,.12); border-color: #fbbf24; color: #fbbf24; box-shadow: 0 0 0 3px rgba(251,191,36,.2); }
.chain-mini-dot.waiting{ background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.1); color: #5d6d7e; }
.chain-mini-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #5d6d7e; }
.chain-mini-name  { font-size: 11px; color: #9faab8; text-align: center; }
.chain-mini-arrow { color: #3d4f5e; font-size: 14px; margin-bottom: 12px; flex-shrink: 0; }

/* Section sub-header in tabs */
.td-section-head {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .1em;
    color: #5d6d7e;
    margin: 18px 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255,255,255,.05);
}
.td-section-head:first-child { margin-top: 0; }
</style>

<div class="td-wrap">

<!-- ═══════════════════════════════════════════════════════════
     TOP BAR
═══════════════════════════════════════════════════════════ -->
<div class="td-topbar">
    <div class="td-topbar-left">
        <a href="<?= APP_URL ?>/projects/<?= $task['project_id'] ?>" class="btn btn-outline btn-sm"><?= tf_icon('chevron-left', 14) ?> <?= e($task['project_name']) ?></a>
        <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;background:<?= $sc['bg'] ?>;color:<?= $sc['c'] ?>;border:1px solid <?= $sc['c'] ?>33">
            <?= $sc['label'] ?>
        </span>
        <?php if ($task['is_completed']): ?>
        <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:#4ade80">✓ Completed</span>
        <?php endif; ?>
    </div>
    <div class="td-topbar-right">
        <?php if (!empty($canEditTask)): ?>
        <a href="<?= APP_URL ?>/tasks/<?= $task['id'] ?>/duplicate" class="btn btn-outline btn-sm"><?= tf_icon('copy', 14) ?> Duplicate</a>
        <?php if (!$task['is_completed']): ?>
        <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('rescheduleModal').classList.add('open')"><?= tf_icon('calendar', 14) ?> Reschedule</button>
        <?php endif; ?>
        <?php if (!$task['is_completed'] && $task['due_date']): ?>
        <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('extendModal').classList.add('open')"><?= tf_icon('calendar-clock', 14) ?> Extend</button>
        <?php endif; ?>
        <?php
        if ($task['is_completed']): ?>
        <a href="<?= APP_URL ?>/tasks/<?= $task['id'] ?>/toggle" class="btn btn-secondary btn-sm"><?= tf_icon('refresh-cw', 14) ?> Reopen</a>
        <?php elseif ($approvalRequired):
            if (($isAssignee || canAdmin()) && in_array($taskStatus, ['in_progress','todo','review_rejected','acceptance_rejected'])): ?>
            <form method="POST" action="<?= APP_URL ?>/tasks/<?= $task['id'] ?>/submit" style="display:inline">
                <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                <button type="submit" class="btn btn-primary btn-sm" onclick="return confirm('Submit for review?')"><?= tf_icon('send', 14) ?> Submit for Review</button>
            </form>
            <?php elseif ($taskStatus === 'pending_review'): ?>
            <span class="btn btn-outline btn-sm" style="opacity:.6;cursor:default">⏳ Pending Review</span>
            <?php elseif ($taskStatus === 'pending_acceptance'): ?>
            <span class="btn btn-outline btn-sm" style="opacity:.6;cursor:default">⏳ Pending Acceptance</span>
            <?php elseif ($taskStatus === 'done'): ?>
            <span class="btn btn-outline btn-sm" style="color:#4ade80;cursor:default">✓ Done</span>
            <?php endif; ?>
        <?php else: ?>
        <a href="<?= APP_URL ?>/tasks/<?= $task['id'] ?>/toggle" class="btn btn-primary btn-sm"><?= tf_icon('check', 14) ?> Complete</a>
        <?php endif; ?>
        <a href="<?= APP_URL ?>/tasks/<?= $task['id'] ?>/delete" class="btn btn-danger btn-sm" onclick="return confirm('Delete this task?')"><?= tf_icon('trash-2', 14) ?></a>
        <?php endif; ?>
    </div>
</div>

<!-- Task title (prominent) -->
<div style="margin-bottom:20px">
    <h1 style="font-size:22px;font-weight:800;color:#eef2f7;line-height:1.3;margin-bottom:6px"><?= e($task['title']) ?></h1>
    <div style="display:flex;align-items:center;gap:12px;font-size:13px;color:#5d6d7e;flex-wrap:wrap">
        <?php if ($task['due_date']): ?>
        <?php $daysLeft = (int)ceil((strtotime($task['due_date']) - time()) / 86400); ?>
        <span style="color:<?= $daysLeft < 0 ? '#f87171' : ($daysLeft <= 3 ? '#fbbf24' : '#9faab8') ?>;font-weight:600">
            <?= tf_icon('calendar', 13) ?>
            <?= $daysLeft < 0 ? abs($daysLeft).' days overdue' : ($daysLeft === 0 ? 'Due today' : 'Due in '.$daysLeft.' days') ?>
            (<?= e(taskDetailDateLabel($task['due_date'])) ?>)
        </span>
        <?php endif; ?>
        <?php if ($task['priority'] !== 'low'): ?>
        <?php $pc = ['urgent'=>['#f87171','🔴'],'high'=>['#fbbf24','🟡'],'medium'=>['#60a5fa','🔵']]; $pp = $pc[$task['priority']] ?? ['#9faab8','⚪']; ?>
        <span style="color:<?= $pp[0] ?>;font-weight:600"><?= $pp[1] ?> <?= ucfirst($task['priority']) ?></span>
        <?php endif; ?>
        <?php if ($parentTask): ?>
        <span><?= tf_icon('link', 13) ?> Rescheduled from <a href="<?= APP_URL ?>/tasks/<?= $parentTask['id'] ?>" style="color:#60a5fa"><?= e($parentTask['title']) ?></a></span>
        <?php endif; ?>
    </div>
</div>

<!-- Alerts -->

<?php if (!empty($task['penalty_applied']) && (int)$task['penalty_applied'] === 1): ?>
<div style="background:rgba(229,80,57,.08);border:1px solid rgba(229,80,57,.25);border-radius:12px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:flex-start;gap:12px">
    <span style="font-size:18px;flex-shrink:0">⚠️</span>
    <div>
        <div style="font-size:13px;font-weight:700;color:#fca5a5;margin-bottom:4px">Penalty Applied</div>
        <div style="font-size:13px;color:#94a3b8">Amount: <strong style="color:#fca5a5"><?= number_format((float)$task['penalty_amount'], 0, '.', ',') ?> <?= e($task['penalty_currency'] ?? 'VND') ?></strong> · <?= !empty($task['penalty_applied_at']) ? date('Y-m-d H:i', strtotime($task['penalty_applied_at'])) : '—' ?></div>
    </div>
</div>
<?php endif; ?>

<!-- ═══════════════════════════════════════════════════════════
     REVIEWER WORKSPACE (shows when current user is active reviewer)
═══════════════════════════════════════════════════════════ -->
<?php if ($approvalRequired && $isReviewer && $taskStatus === 'pending_review'): ?>
<div class="workspace-panel reviewer-ws">
    <div class="ws-header">
        <div class="ws-title" style="color:#fbbf24"><?= tf_icon('eye', 16) ?> Reviewer Workspace — Your Action Required</div>
        <span style="font-size:12px;color:#fbbf24;background:rgba(251,191,36,.12);padding:4px 10px;border-radius:999px;font-weight:700">PENDING REVIEW</span>
    </div>
    <div class="ws-grid">
        <!-- LEFT: Instructions + Checklist -->
        <div class="ws-left">
            <?php if (!empty($task['review_instructions'])): ?>
            <div class="td-section-head">📋 Review Instructions</div>
            <div style="font-size:13px;color:#b8c0cc;line-height:1.6;white-space:pre-wrap;background:rgba(255,255,255,.03);border-radius:8px;padding:12px"><?= e($task['review_instructions']) ?></div>
            <?php endif; ?>

            <?php if (!empty($reviewChecklist)): ?>
            <div class="td-section-head">✅ Review Checklist</div>
            <ul class="ws-checklist">
                <?php foreach ($reviewChecklist as $i => $item): ?>
                <li class="ws-checklist-item">
                    <input type="checkbox" id="rcl-<?= $i ?>">
                    <label for="rcl-<?= $i ?>"><?= e(is_array($item) ? ($item['text'] ?? '') : $item) ?></label>
                </li>
                <?php endforeach; ?>
            </ul>
            <?php else: ?>
            <div class="td-section-head">✅ Review Checklist</div>
            <p style="font-size:13px;color:#5d6d7e">No checklist defined for this task.</p>
            <?php endif; ?>
        </div>
        <!-- RIGHT: Evidence + Attachments -->
        <div class="ws-right">
            <?php if (!empty($requiredEvidence)): ?>
            <div class="td-section-head">🔍 Required Evidence</div>
            <ul class="ws-evidence-list">
                <?php foreach ($requiredEvidence as $ev): ?>
                <li class="ws-evidence-item"><span class="ws-ev-icon">📎</span><?= e($ev) ?></li>
                <?php endforeach; ?>
            </ul>
            <?php endif; ?>

            <?php if (!empty($requiredFiles)): ?>
            <div class="td-section-head">📁 Required Files</div>
            <ul class="ws-evidence-list">
                <?php foreach ($requiredFiles as $rf): ?>
                <li class="ws-evidence-item"><span class="ws-ev-icon">📄</span><?= e($rf) ?></li>
                <?php endforeach; ?>
            </ul>
            <?php endif; ?>

            <div class="td-section-head">📎 Uploaded Attachments (<?= count($attachments) ?>)</div>
            <?php if (!empty($attachments)): ?>
            <ul class="ws-evidence-list">
                <?php foreach ($attachments as $a): ?>
                <li class="ws-evidence-item">
                    <span class="ws-ev-icon">📄</span>
                    <a href="<?= APP_URL ?>/attachments/<?= $a['id'] ?>/download" style="color:#60a5fa;flex:1"><?= e($a['original_name']) ?></a>
                    <span style="font-size:11px;color:#5d6d7e"><?= number_format($a['file_size']/1024, 1) ?> KB</span>
                </li>
                <?php endforeach; ?>
            </ul>
            <?php else: ?>
            <p style="font-size:13px;color:#5d6d7e">No files uploaded yet.</p>
            <?php endif; ?>
        </div>
    </div>
    <!-- Reviewer actions -->
    <div class="ws-footer">
        <form method="POST" action="<?= APP_URL ?>/tasks/<?= $task['id'] ?>/review/approve" style="flex:1">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
                <div style="flex:1;min-width:200px">
                    <textarea name="comment" class="form-control" rows="2" placeholder="Review comment (optional for approval)…" style="font-size:13px;resize:none"></textarea>
                </div>
                <button type="submit" class="btn btn-approve" style="background:rgba(39,174,96,.15);border:1px solid rgba(39,174,96,.4);color:#6ee7b7;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap">
                    ✓ Approve &amp; Pass to Approver
                </button>
            </div>
        </form>
        <form method="POST" action="<?= APP_URL ?>/tasks/<?= $task['id'] ?>/review/reject">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
                <div style="flex:1;min-width:200px">
                    <textarea name="comment" class="form-control" rows="2" placeholder="Reason for rejection (required)…" required style="font-size:13px;resize:none"></textarea>
                </div>
                <button type="submit" class="btn btn-reject" style="background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.35);color:#fca5a5;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap">
                    ✕ Reject
                </button>
            </div>
        </form>
    </div>
</div>
<?php endif; ?>

<!-- ═══════════════════════════════════════════════════════════
     APPROVER WORKSPACE (shows when current user is active approver)
═══════════════════════════════════════════════════════════ -->
<?php if ($approvalRequired && $isApprover && $taskStatus === 'pending_acceptance'): ?>
<div class="workspace-panel approver-ws">
    <div class="ws-header">
        <div class="ws-title" style="color:#a78bfa"><?= tf_icon('shield-check', 16) ?> Approver Workspace — Your Action Required</div>
        <span style="font-size:12px;color:#a78bfa;background:rgba(167,139,250,.12);padding:4px 10px;border-radius:999px;font-weight:700">PENDING ACCEPTANCE</span>
    </div>

    <!-- Reviewer result — shown first -->
    <?php
    $lastReviewEvent = null;
    if (!empty($approvalHistory)) {
        foreach (array_reverse($approvalHistory) as $ev) {
            if ($ev['action_type'] === 'review_approved') { $lastReviewEvent = $ev; break; }
        }
    }
    ?>
    <?php if ($lastReviewEvent): ?>
    <div style="padding:16px 20px;background:rgba(74,222,128,.06);border-bottom:1px solid rgba(74,222,128,.15)">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#5d6d7e;margin-bottom:8px">Reviewer Decision</div>
        <div style="display:flex;align-items:flex-start;gap:12px">
            <span style="font-size:20px">✅</span>
            <div>
                <div style="font-size:14px;font-weight:700;color:#6ee7b7">Review Approved by <?= e($lastReviewEvent['actor_name'] ?? 'Reviewer') ?></div>
                <div style="font-size:12px;color:#9faab8;margin-top:2px"><?= date('d/m/Y H:i', strtotime($lastReviewEvent['created_at'])) ?></div>
                <?php if (!empty($lastReviewEvent['comment'])): ?>
                <div style="font-size:13px;color:#b8c0cc;margin-top:8px;background:rgba(255,255,255,.04);border-radius:8px;padding:10px"><?= e($lastReviewEvent['comment']) ?></div>
                <?php endif; ?>
            </div>
        </div>
    </div>
    <?php endif; ?>

    <div class="ws-grid">
        <div class="ws-left">
            <div class="td-section-head">📋 Task Summary</div>
            <div style="font-size:14px;font-weight:700;color:#d4dde8;margin-bottom:6px"><?= e($task['title']) ?></div>
            <?php if (!empty($task['description'])): ?>
            <div style="font-size:13px;color:#9faab8;line-height:1.5"><?= nl2br(e($task['description'])) ?></div>
            <?php endif; ?>

            <?php if (!empty($requiredEvidence) || !empty($requiredFiles)): ?>
            <div class="td-section-head">🔍 Evidence Required</div>
            <ul class="ws-evidence-list">
                <?php foreach ($requiredEvidence as $ev): ?>
                <li class="ws-evidence-item"><span class="ws-ev-icon">📎</span><?= e($ev) ?></li>
                <?php endforeach; ?>
                <?php foreach ($requiredFiles as $rf): ?>
                <li class="ws-evidence-item"><span class="ws-ev-icon">📄</span><?= e($rf) ?></li>
                <?php endforeach; ?>
            </ul>
            <?php endif; ?>
        </div>
        <div class="ws-right">
            <div class="td-section-head">📎 Attachments (<?= count($attachments) ?>)</div>
            <?php if (!empty($attachments)): ?>
            <ul class="ws-evidence-list">
                <?php foreach ($attachments as $a): ?>
                <li class="ws-evidence-item">
                    <span class="ws-ev-icon">📄</span>
                    <a href="<?= APP_URL ?>/attachments/<?= $a['id'] ?>/download" style="color:#60a5fa;flex:1"><?= e($a['original_name']) ?></a>
                    <span style="font-size:11px;color:#5d6d7e"><?= number_format($a['file_size']/1024, 1) ?> KB</span>
                </li>
                <?php endforeach; ?>
            </ul>
            <?php else: ?>
            <p style="font-size:13px;color:#5d6d7e">No attachments.</p>
            <?php endif; ?>
        </div>
    </div>

    <!-- Approver actions -->
    <div class="ws-footer">
        <form method="POST" action="<?= APP_URL ?>/tasks/<?= $task['id'] ?>/accept" style="flex:1">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
                <div style="flex:1;min-width:200px">
                    <textarea name="comment" class="form-control" rows="2" placeholder="Acceptance note (optional)…" style="font-size:13px;resize:none"></textarea>
                </div>
                <button type="submit" class="btn" style="background:rgba(39,174,96,.15);border:1px solid rgba(39,174,96,.4);color:#6ee7b7;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap">
                    🎉 Accept &amp; Close Task
                </button>
            </div>
        </form>
        <form method="POST" action="<?= APP_URL ?>/tasks/<?= $task['id'] ?>/acceptance/reject">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
                <div style="flex:1;min-width:200px">
                    <textarea name="comment" class="form-control" rows="2" placeholder="Reason for rejection (required)…" required style="font-size:13px;resize:none"></textarea>
                </div>
                <button type="submit" class="btn" style="background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.35);color:#fca5a5;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap">
                    ✕ Reject
                </button>
            </div>
        </form>
    </div>
</div>
<?php endif; ?>

<!-- ═══════════════════════════════════════════════════════════
     MAIN 2-COLUMN LAYOUT
═══════════════════════════════════════════════════════════ -->
<div class="td-layout">

<!-- ── LEFT: Tabbed content ───────────────────────────────── -->
<div class="td-main">

    <!-- Tab nav -->
    <div class="td-tabs">
        <button type="button" class="td-tab active" data-td-tab="general" onclick="tdTab(event,'general')"><?= tf_icon('file-text', 13) ?> General</button>
        <?php if ($approvalRequired || canAdmin()): ?>
        <button type="button" class="td-tab" data-td-tab="workflow" onclick="tdTab(event,'workflow')"><?= tf_icon('git-branch', 13) ?> Workflow</button>
        <?php endif; ?>
        <button type="button" class="td-tab" data-td-tab="evidence" onclick="tdTab(event,'evidence')"><?= tf_icon('paperclip', 13) ?> Evidence
            <?php if (!empty($attachments)): ?><span class="td-tab-badge"><?= count($attachments) ?></span><?php endif; ?>
        </button>
        <button type="button" class="td-tab" data-td-tab="comments" onclick="tdTab(event,'comments')"><?= tf_icon('message-square', 13) ?> Comments
            <?php $totalComms = count($taskComments ?? []) + count($reviewerNotes ?? []) + count($approvalNotes ?? []); ?>
            <?php if ($totalComms > 0): ?><span class="td-tab-badge"><?= $totalComms ?></span><?php endif; ?>
        </button>
        <button type="button" class="td-tab" data-td-tab="history" onclick="tdTab(event,'history')"><?= tf_icon('clock', 13) ?> History</button>
    </div>

    <!-- ── TAB: GENERAL ─────────────────────────────────────── -->
    <div id="td-general" class="td-pane active">
        <form method="POST" action="<?= APP_URL ?>/tasks/<?= $task['id'] ?>" class="task-edit-form">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">

            <div class="form-group">
                <label><?= e(t('task.title_label')) ?></label>
                <input type="text" name="title" class="form-control" value="<?= e($task['title']) ?>" style="font-size:16px;font-weight:700">
            </div>
            <div class="form-group">
                <label><?= e(t('task.description_label')) ?></label>
                <textarea name="description" class="form-control" rows="9"><?= e($task['description']) ?></textarea>
            </div>

            <div class="grid grid-2">
                <div class="form-group">
                    <label><?= e(t('task.status_label')) ?></label>
                    <select name="status" class="form-control">
                        <?php foreach(['todo'=>t('task.status_todo'),'in_progress'=>t('task.status_in_progress'),'review'=>t('task.status_review'),'done'=>t('task.status_done')] as $k=>$v): ?>
                        <option value="<?= $k ?>" <?= $task['status']===$k?'selected':'' ?>><?= e($v) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="form-group">
                    <label><?= e(t('task.priority_label')) ?></label>
                    <select name="priority" class="form-control">
                        <?php foreach(['low'=>t('task.priority_low'),'medium'=>t('task.priority_medium'),'high'=>t('task.priority_high'),'urgent'=>t('task.priority_urgent')] as $k=>$v): ?>
                        <option value="<?= $k ?>" <?= $task['priority']===$k?'selected':'' ?>><?= e($v) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
            </div>

            <div class="grid grid-2">
                <div class="form-group">
                    <label><?= e(t('task.assignee_label')) ?></label>
                    <select name="assignee_id" class="form-control">
                        <option value=""><?= e(t('task.unassigned')) ?></option>
                        <?php foreach($users as $u): ?>
                        <option value="<?= $u['id'] ?>" <?= $task['assignee_id']==$u['id']?'selected':'' ?>><?= e($u['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="form-group">
                    <label><?= e(t('task.deadline')) ?></label>
                    <div style="position:relative;display:flex;align-items:center">
                        <input type="date" name="due_date" id="editDueDate" class="form-control" value="<?= $task['due_date'] ?>" style="padding-right:34px">
                        <span style="position:absolute;right:10px;cursor:pointer;font-size:15px;color:#71717a;z-index:1" onclick="var d=document.getElementById('editDueDate');if(d.showPicker)d.showPicker();else d.focus()">📅</span>
                    </div>
                </div>
            </div>

            <div class="grid grid-2">
                <div class="form-group">
                    <label>Category</label>
                    <select name="task_categories[]" class="form-control" multiple size="5">
                        <?php foreach ($taskCategoryOptions as $value => $label): ?>
                        <option value="<?= e($value) ?>" <?= in_array($value, $selectedTaskCategories, true) ? 'selected' : '' ?>><?= e($label) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="form-group">
                    <label>Visibility</label>
                    <select name="visibility" class="form-control">
                        <option value="private" <?= $visibility==='private'?'selected':'' ?>>Private — assignee, creator, admin</option>
                        <option value="public"  <?= $visibility==='public' ?'selected':'' ?>>Public — all project members</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Board Column</label>
                    <select name="section_id" class="form-control">
                        <option value="">— No column —</option>
                        <?php
                        $selectedSectionId = (int)($task['section_id'] ?? 0);
                        $selectedSectionKey = null;
                        foreach ($sections as $sectionForKey) {
                            if ((int)($sectionForKey['id'] ?? 0) === $selectedSectionId) {
                                $selectedSectionName = trim((string)($sectionForKey['name'] ?? ''));
                                $selectedSectionKey = $selectedSectionName !== ''
                                    ? strtolower(preg_replace('/\s+/', ' ', $selectedSectionName))
                                    : null;
                                break;
                            }
                        }
                        $renderedSectionNames = [];
                        foreach($sections as $s): ?>
                        <?php
                            $sectionName = trim((string)($s['name'] ?? ''));
                            if ($sectionName === '') continue;
                            $sectionKey = strtolower(preg_replace('/\s+/', ' ', $sectionName));
                            $sectionId = (int)($s['id'] ?? 0);
                            if ($selectedSectionKey === $sectionKey && $sectionId !== $selectedSectionId) continue;
                            if (isset($renderedSectionNames[$sectionKey])) continue;
                            $renderedSectionNames[$sectionKey] = true;
                        ?>
                        <option value="<?= $sectionId ?>" <?= $selectedSectionId===$sectionId?'selected':'' ?>><?= e($sectionName) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
            </div>

            <!-- Stores -->
            <div class="form-group">
                <label style="display:flex;align-items:center;justify-content:space-between">
                    <span><?= tf_icon('store', 14) ?> Stores</span>
                    <span style="display:flex;gap:6px">
                        <button type="button" class="ct-chip-action" onclick="editSelectAllStores(this)">All</button>
                        <button type="button" class="ct-chip-action" onclick="editClearStores(this)">Clear</button>
                    </span>
                </label>
                <?php if (!empty($allStores)): ?>
                <input type="hidden" name="store_ids[]" value="">
                <div class="ct-store-chips" id="editStoreChips">
                    <?php foreach ($allStores as $st):
                        $checked = in_array((int)$st['id'], $taskStoreIds); ?>
                    <div class="ct-store-chip <?= $checked?'selected':'' ?>" onclick="ctToggleChip(this)">
                        <input type="checkbox" name="store_ids[]" value="<?= (int)$st['id'] ?>" <?= $checked?'checked':'' ?>>
                        <?php if (!empty($st['color'])): ?><span class="chip-dot" style="background:<?= e($st['color']) ?>"></span><?php endif; ?>
                        <?= e($st['name']) ?>
                    </div>
                    <?php endforeach; ?>
                </div>
                <div id="editStoreHelper" style="font-size:11px;color:#52525b;margin-top:5px">
                    <?php $selCount=count(array_filter($allStores,fn($s)=>in_array((int)$s['id'],$taskStoreIds)));
                    echo $selCount>0 ? $selCount.' store'.($selCount>1?'s':'').' selected' : 'No store selected = general task'; ?>
                </div>
                <?php endif; ?>
            </div>

            <!-- Repeat -->
            <div class="form-group repeat-section">
                <label><?= tf_icon('refresh-cw', 14) ?> <?= e(t('task.repeat')) ?></label>
                <div class="repeat-controls">
                    <select name="repeat_type" id="repeatType" class="form-control" onchange="toggleRepeatOptions()" style="max-width:160px">
                        <?php foreach(['none'=>t('task.repeat_none'),'daily'=>t('task.repeat_daily'),'weekly'=>t('task.repeat_weekly'),'monthly'=>t('task.repeat_monthly'),'yearly'=>t('task.repeat_yearly')] as $k=>$v): ?>
                        <option value="<?= $k ?>" <?= ($task['repeat_type']??'none')===$k?'selected':'' ?>><?= e($v) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <div class="repeat-opt" id="repeatDaily" style="display:none">
                        <div style="display:flex;align-items:center;gap:6px"><span class="text-sm text-muted"><?= e(t('task.every')) ?></span>
                        <select name="repeat_interval_daily" class="form-control" style="width:70px"><?php for($i=1;$i<=30;$i++):?><option value="<?=$i?>" <?=($rc['interval']??1)==$i&&($task['repeat_type']??'')==='daily'?'selected':''?>><?=$i?></option><?php endfor;?></select>
                        <span class="text-sm text-muted"><?= e(t('task.repeat_days')) ?></span></div>
                    </div>
                    <div class="repeat-opt" id="repeatWeekly" style="display:none">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px"><span class="text-sm text-muted"><?= e(t('task.every')) ?></span>
                        <select name="repeat_interval_weekly" class="form-control" style="width:70px"><?php for($i=1;$i<=5;$i++):?><option value="<?=$i?>" <?=($rc['interval']??1)==$i&&($task['repeat_type']??'')==='weekly'?'selected':''?>><?=$i?></option><?php endfor;?></select>
                        <span class="text-sm text-muted"><?= e(t('task.repeat_weeks')) ?></span></div>
                        <div class="repeat-days-picker"><?php $dayNames=[t('task.day_mon'),t('task.day_tue'),t('task.day_wed'),t('task.day_thu'),t('task.day_fri'),t('task.day_sat'),t('task.day_sun')];$selectedDays=$rc['days']??[];for($d=1;$d<=7;$d++):?><div class="repeat-day-chip <?=in_array($d,$selectedDays)?'active':''?>" data-day="<?=$d?>" onclick="toggleRepeatDayChip(this)"><?=e($dayNames[$d-1])?></div><?php endfor;?></div>
                    </div>
                    <div class="repeat-opt" id="repeatMonthly" style="display:none">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px"><span class="text-sm text-muted"><?= e(t('task.every')) ?></span>
                        <select name="repeat_interval_monthly" class="form-control" style="width:70px"><?php for($i=1;$i<=11;$i++):?><option value="<?=$i?>" <?=($rc['interval']??1)==$i&&($task['repeat_type']??'')==='monthly'?'selected':''?>><?=$i?></option><?php endfor;?></select>
                        <span class="text-sm text-muted"><?= e(t('task.repeat_months')) ?></span></div>
                        <div style="display:flex;align-items:center;gap:6px"><span class="text-sm text-muted"><?= e(t('task.on_day')) ?></span>
                        <select name="repeat_day_of_month" class="form-control" style="width:70px"><?php for($i=1;$i<=31;$i++):?><option value="<?=$i?>" <?=($rc['day_of_month']??1)==$i?'selected':''?>><?=$i?></option><?php endfor;?></select></div>
                    </div>
                    <div class="repeat-opt" id="repeatYearly" style="display:none">
                        <div style="display:flex;align-items:center;gap:6px"><span class="text-sm text-muted"><?= e(t('task.every')) ?></span>
                        <select name="repeat_interval_yearly" class="form-control" style="width:70px"><?php for($i=1;$i<=5;$i++):?><option value="<?=$i?>" <?=($rc['interval']??1)==$i&&($task['repeat_type']??'')==='yearly'?'selected':''?>><?=$i?></option><?php endfor;?></select>
                        <span class="text-sm text-muted"><?= e(t('task.repeat_years')) ?></span></div>
                    </div>
                </div>
                <div class="repeat-advanced" id="repeatAdvanced" style="margin-top:12px;display:none">
                    <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start">
                        <div class="form-group" style="margin:0"><label class="text-sm text-muted"><?= e(t('task.repeat_from')) ?></label>
                        <select name="repeat_from_mode" id="repeatFromMode" class="form-control" style="max-width:200px"><option value="due_date" <?=($task['repeat_from_mode']??'due_date')==='due_date'?'selected':''?>><?=e(t('task.repeat_from_due_date'))?></option><option value="completion_date" <?=($task['repeat_from_mode']??'due_date')==='completion_date'?'selected':''?>><?=e(t('task.repeat_from_completion'))?></option></select></div>
                        <div class="form-group" style="margin:0"><label class="text-sm text-muted"><?= e(t('task.repeat_end')) ?></label>
                        <select name="repeat_end_type" id="repeatEndType" class="form-control" style="max-width:160px" onchange="toggleRepeatEndOptions()"><option value="never" <?=($task['repeat_end_type']??'never')==='never'?'selected':''?>>Never</option><option value="date" <?=($task['repeat_end_type']??'never')==='date'?'selected':''?>>On Date</option><option value="count" <?=($task['repeat_end_type']??'never')==='count'?'selected':''?>>After N</option></select></div>
                        <div class="form-group repeat-end-opt" id="repeatEndDateOpt" style="margin:0;display:none"><label class="text-sm text-muted">End date</label><input type="date" name="repeat_end_date" id="repeatEndDate" class="form-control" style="max-width:160px" value="<?=e($task['repeat_end_date']??'')?>"></div>
                        <div class="form-group repeat-end-opt" id="repeatEndCountOpt" style="margin:0;display:none"><label class="text-sm text-muted">After N times</label><input type="number" name="repeat_end_count" id="repeatEndCount" class="form-control" style="max-width:80px" min="1" max="999" value="<?=(int)($task['repeat_end_count']??10)?>"></div>
                    </div>
                    <div id="repeatFromHint" style="margin-top:8px;font-size:11px;color:var(--text-muted);display:none"><span id="repeatFromHintText"></span></div>
                </div>
                <input type="hidden" name="repeat_config" id="repeatConfigInput" value="<?= e($task['repeat_config'] ?? '') ?>">
            </div>

            <div style="display:flex;gap:8px;margin-top:8px">
                <button type="submit" class="btn btn-primary"><?= tf_icon('save', 14) ?> <?= e(t('common.save')) ?></button>
            </div>
        </form>
    </div><!-- /td-general -->

    <!-- ── TAB: WORKFLOW ────────────────────────────────────── -->
    <div id="td-workflow" class="td-pane">
        <?php if ($approvalRequired): ?>
        <!-- Approval chain visual -->
        <?php
        $chainSteps = [
            ['label'=>'Assignee', 'name'=>$task['assignee_name']??'—', 'role'=>'Do the work',
             'state'=> in_array($taskStatus,['pending_review','pending_acceptance','done','accepted'])?'done':(in_array($taskStatus,['in_progress','todo','review_rejected','acceptance_rejected'])?'active':'waiting')],
            ['label'=>'Reviewer', 'name'=>$task['reviewer_name']??'—', 'role'=>'Check quality',
             'state'=> in_array($taskStatus,['pending_acceptance','done','accepted'])?'done':($taskStatus==='pending_review'?'active':'waiting')],
            ['label'=>'Approver', 'name'=>$task['approver_name']??'—', 'role'=>'Final sign-off',
             'state'=> in_array($taskStatus,['done','accepted'])?'done':($taskStatus==='pending_acceptance'?'active':'waiting')],
        ];
        $stateIcons = ['done'=>'✓','active'=>'●','waiting'=>'○'];
        ?>
        <div class="td-section-head">Approval Chain</div>
        <div class="approval-chain-mini">
            <?php foreach($chainSteps as $i => $step): ?>
            <?php if($i>0): ?><span class="chain-mini-arrow">→</span><?php endif; ?>
            <div class="chain-mini-step">
                <div class="chain-mini-dot <?= $step['state'] ?>"><?= $stateIcons[$step['state']] ?></div>
                <div class="chain-mini-label"><?= $step['label'] ?></div>
                <div class="chain-mini-name"><?= e($step['name']) ?></div>
            </div>
            <?php endforeach; ?>
        </div>

        <!-- Rejection history -->
        <?php
        $lastRejection = null;
        if (!empty($approvalHistory)) {
            foreach (array_reverse($approvalHistory) as $ev) {
                if (in_array($ev['action_type'], ['review_rejected','acceptance_rejected'])) { $lastRejection = $ev; break; }
            }
        }
        ?>
        <?php if ($lastRejection): ?>
        <div style="margin-top:16px;background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.25);border-radius:10px;padding:14px 16px">
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#f87171;margin-bottom:6px">
                <?= $lastRejection['action_type']==='review_rejected' ? '🔴 Rejected by Reviewer' : '🔴 Rejected by Approver' ?>
            </div>
            <div style="font-size:13px;color:#fca5a5"><?= e($lastRejection['comment'] ?? 'No reason given') ?></div>
            <div style="font-size:11px;color:#5d6d7e;margin-top:4px"><?= e($lastRejection['actor_name']??'') ?> · <?= date('d/m/Y H:i', strtotime($lastRejection['created_at'])) ?></div>
        </div>
        <?php endif; ?>
        <?php endif; ?>

        <?php if (canAdmin()): ?>
        <form method="POST" action="<?= APP_URL ?>/tasks/<?= $task['id'] ?>">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <div class="td-section-head" style="margin-top:20px">Approval Workflow Config</div>
            <div style="background:rgba(96,165,250,.06);border:1px solid rgba(96,165,250,.2);border-radius:10px;padding:16px">
                <label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer;margin-bottom:12px">
                    <input type="checkbox" name="approval_required" value="1" id="editApprovalCheck"
                           <?= !empty($task['approval_required'])?'checked':'' ?>
                           style="accent-color:#3b82f6"
                           onchange="document.getElementById('editApprovalFields').style.display=this.checked?'grid':'none'">
                    Require approval chain for this task
                </label>
                <div id="editApprovalFields" style="display:<?= !empty($task['approval_required'])?'grid':'none' ?>;grid-template-columns:1fr 1fr;gap:12px">
                    <div class="form-group" style="margin:0">
                        <label style="font-size:12px;color:#71717a">Reviewer (Stage 2)</label>
                        <select name="reviewer_id" class="form-control">
                            <option value="">— None —</option>
                            <?php foreach($users as $u): ?><option value="<?=$u['id']?>" <?=($task['reviewer_id']??'')==$u['id']?'selected':''?>><?=e($u['name'])?> (<?=ucfirst($u['role'])?>)</option><?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group" style="margin:0">
                        <label style="font-size:12px;color:#71717a">Approver (Stage 3)</label>
                        <select name="approver_id" class="form-control">
                            <option value="">— None —</option>
                            <?php foreach($users as $u): ?><option value="<?=$u['id']?>" <?=($task['approver_id']??'')==$u['id']?'selected':''?>><?=e($u['name'])?> (<?=ucfirst($u['role'])?>)</option><?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group" style="margin:0">
                        <label style="font-size:12px;color:#71717a">Reviewer Deadline</label>
                        <input type="date" name="reviewer_due_date" class="form-control" value="<?= e(!empty($task['reviewer_due_date']) ? substr($task['reviewer_due_date'], 0, 10) : '') ?>">
                    </div>
                    <div class="form-group" style="margin:0">
                        <label style="font-size:12px;color:#71717a">Review Instructions</label>
                        <textarea name="review_instructions" class="form-control" rows="3" placeholder="What should the reviewer verify?"><?= e($task['review_instructions'] ?? '') ?></textarea>
                    </div>
                    <div class="form-group" style="margin:0">
                        <label style="font-size:12px;color:#71717a">Review Checklist (one per line)</label>
                        <textarea name="review_checklist" class="form-control" rows="3" placeholder="Item 1&#10;Item 2&#10;Item 3"><?php echo e(implode("\n", array_map(fn($item) => $item['text'] ?? $item, $reviewChecklist))); ?></textarea>
                    </div>
                </div>
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top:12px"><?= tf_icon('save', 14) ?> Save Workflow</button>
        </form>
        <?php endif; ?>
    </div><!-- /td-workflow -->

    <!-- ── TAB: EVIDENCE ────────────────────────────────────── -->
    <div id="td-evidence" class="td-pane">
        <?php if (canAdmin()): ?>
        <form method="POST" action="<?= APP_URL ?>/tasks/<?= $task['id'] ?>">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <div class="td-section-head">Required Evidence &amp; Files</div>
            <div class="grid grid-2" style="gap:14px">
                <div class="form-group">
                    <label>Required Evidence <span style="font-size:11px;color:#5d6d7e">(one per line)</span></label>
                    <textarea name="required_evidence" class="form-control" rows="5" placeholder="Evidence item 1&#10;Evidence item 2"><?= e(implode("\n", $requiredEvidence)) ?></textarea>
                </div>
                <div class="form-group">
                    <label>Required Files <span style="font-size:11px;color:#5d6d7e">(one per line)</span></label>
                    <textarea name="required_files" class="form-control" rows="5" placeholder="File/doc/image 1&#10;File/doc/image 2"><?= e(implode("\n", $requiredFiles)) ?></textarea>
                </div>
            </div>
            <button type="submit" class="btn btn-primary btn-sm"><?= tf_icon('save', 14) ?> Save Requirements</button>
        </form>
        <div style="margin: 20px 0 0; border-top: 1px solid rgba(255,255,255,.06); padding-top: 20px"></div>
        <?php endif; ?>

        <!-- Uploaded attachments -->
        <div class="td-section-head">Uploaded Files (<?= count($attachments) ?>)</div>
        <?php if($attachments): ?>
        <ul class="ws-evidence-list">
            <?php foreach($attachments as $a): ?>
            <li class="ws-evidence-item" style="padding:10px 14px">
                <span class="ws-ev-icon">📄</span>
                <a href="<?= APP_URL ?>/attachments/<?= $a['id'] ?>/download" style="color:#60a5fa;flex:1;font-weight:500"><?= e($a['original_name']) ?></a>
                <span style="font-size:12px;color:#5d6d7e"><?= number_format($a['file_size']/1024, 1) ?> KB</span>
                <span style="font-size:12px;color:#5d6d7e"><?= e($a['user_name']) ?></span>
                <a href="<?= APP_URL ?>/attachments/<?= $a['id'] ?>/delete" class="btn-ghost" style="padding:4px;color:#5d6d7e" onclick="return confirm('Delete?')"><?= tf_icon('trash-2', 13) ?></a>
            </li>
            <?php endforeach; ?>
        </ul>
        <?php else: ?>
        <div style="text-align:center;padding:32px;color:#3d4f5e">
            <div style="font-size:32px;margin-bottom:8px">📎</div>
            <div style="font-size:14px">No files uploaded yet</div>
        </div>
        <?php endif; ?>

        <!-- Upload zone -->
        <div style="margin-top:16px;padding:16px;background:rgba(255,255,255,.03);border:2px dashed rgba(255,255,255,.1);border-radius:12px;text-align:center">
            <label style="cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:#60a5fa">
                <?= tf_icon('upload-cloud', 18) ?> Click to upload file
                <input type="file" id="taskFileInput-<?= $task['id'] ?>" style="display:none" onchange="taskUploadFile(this, <?= $task['id'] ?>)">
            </label>
            <span id="taskUploadStatus-<?= $task['id'] ?>" style="display:block;font-size:13px;margin-top:6px;color:var(--text-muted)"></span>
        </div>
    </div><!-- /td-evidence -->

    <!-- ── TAB: COMMENTS ────────────────────────────────────── -->
    <div id="td-comments" class="td-pane">
        <div class="task-tabs" style="margin-bottom:14px">
            <button type="button" class="task-tab-btn active" data-tab="comm-comments" onclick="switchTaskTab(event,'comm-comments')"><?= tf_icon('hash', 14) ?> Comments (<?= count($taskComments ?? []) ?>)</button>
            <button type="button" class="task-tab-btn" data-tab="comm-reviewer" onclick="switchTaskTab(event,'comm-reviewer')"><?= tf_icon('bookmark', 14) ?> Reviewer Notes<?= !empty($pendingCount)?' ('.$pendingCount.')':'' ?></button>
            <button type="button" class="task-tab-btn" data-tab="comm-approval" onclick="switchTaskTab(event,'comm-approval')"><?= tf_icon('check-square', 14) ?> Approval Notes (<?= count($approvalNotes ?? []) ?>)</button>
        </div>
        <div id="tab-comm-comments" class="task-tab-pane active"><?php require __DIR__ . '/partials/tab-comments.php'; ?></div>
        <div id="tab-comm-reviewer" class="task-tab-pane"><?php require __DIR__ . '/partials/tab-reviewer-notes.php'; ?></div>
        <div id="tab-comm-approval" class="task-tab-pane"><?php require __DIR__ . '/partials/tab-approval-notes.php'; ?></div>
    </div><!-- /td-comments -->

    <!-- ── TAB: HISTORY ─────────────────────────────────────── -->
    <div id="td-history" class="td-pane">
        <?php if (!empty($approvalHistory)): ?>
        <div class="td-section-head">Approval History</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#5d6d7e;font-weight:700;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.06)">Time</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#5d6d7e;font-weight:700;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.06)">Actor</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#5d6d7e;font-weight:700;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.06)">Action</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#5d6d7e;font-weight:700;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.06)">Status Change</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#5d6d7e;font-weight:700;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.06)">Comment</th>
            </tr></thead>
            <tbody>
            <?php foreach ($approvalHistory as $ev): ?>
            <tr style="border-bottom:1px solid rgba(255,255,255,.04)">
                <td style="padding:10px 12px;color:#5d6d7e;white-space:nowrap"><?= date('d/m/Y H:i', strtotime($ev['created_at'])) ?></td>
                <td style="padding:10px 12px;color:#b8c0cc;font-weight:600"><?= e($ev['actor_name'] ?? 'System') ?></td>
                <td style="padding:10px 12px"><span style="font-size:12px;font-weight:700;text-transform:uppercase"><?= e(str_replace('_',' ',$ev['action_type'])) ?></span></td>
                <td style="padding:10px 12px;font-size:12px;color:#5d6d7e"><?= e(($ev['from_status']??'—').' → '.($ev['to_status']??'—')) ?></td>
                <td style="padding:10px 12px;color:#9faab8"><?= e($ev['comment'] ?? '—') ?></td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php else: ?>
        <div style="text-align:center;padding:32px;color:#3d4f5e"><div style="font-size:32px;margin-bottom:8px">📋</div><div>No workflow history yet.</div></div>
        <?php endif; ?>

        <?php if (!empty($extensionHistory)): ?>
        <div class="td-section-head" style="margin-top:24px">Deadline Extension History</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#5d6d7e;font-weight:700;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.06)">Date</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#5d6d7e;font-weight:700;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.06)">Old Deadline</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#5d6d7e;font-weight:700;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.06)">New Deadline</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#5d6d7e;font-weight:700;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.06)">Status</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;color:#5d6d7e;font-weight:700;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,.06)">By</th>
            </tr></thead>
            <tbody>
            <?php foreach ($extensionHistory as $eh): ?>
            <tr style="border-bottom:1px solid rgba(255,255,255,.04)">
                <td style="padding:10px 12px;color:#5d6d7e"><?= date('d/m/Y', strtotime($eh['created_at'])) ?></td>
                <td style="padding:10px 12px;color:#9faab8"><?= $eh['old_deadline']?date('d/m/Y',strtotime($eh['old_deadline'])):'—' ?></td>
                <td style="padding:10px 12px;font-weight:700;color:#d4dde8"><?= date('d/m/Y', strtotime($eh['new_deadline'])) ?></td>
                <td style="padding:10px 12px"><?php
                    $ehColors=['auto_approved'=>['#818cf8','rgba(99,102,241,.15)'],'approved'=>['#4ade80','rgba(34,197,94,.15)'],'rejected'=>['#f87171','rgba(239,68,68,.15)']];
                    $ehC=$ehColors[$eh['status']]??['#fbbf24','rgba(251,191,36,.15)'];
                    echo '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:'.$ehC[1].';color:'.$ehC[0].'">'.str_replace('_',' ',$eh['status']).'</span>';
                ?></td>
                <td style="padding:10px 12px;color:#5d6d7e"><?= e($eh['approver_name']??'—') ?></td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php endif; ?>

        <?php if (!empty($children)): ?>
        <div class="td-section-head" style="margin-top:24px">Reschedule History</div>
        <div style="display:flex;flex-direction:column;gap:6px">
            <?php foreach ($children as $child): ?>
            <a href="<?= APP_URL ?>/tasks/<?= $child['id'] ?>" class="reschedule-link" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:9px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);color:#b8c0cc;text-decoration:none">
                <span style="color:#f59e0b"><?= tf_icon('calendar', 14) ?></span>
                <span style="flex:1"><?= e($child['title']) ?></span>
                <?php if ($child['due_date']): ?><span class="text-muted text-sm">→ <?= e(taskDetailDateLabel($child['due_date'])) ?></span><?php endif; ?>
                <?php if ($child['is_completed']): ?><span style="font-size:11px;color:#4ade80;font-weight:700">✓ Done</span><?php endif; ?>
            </a>
            <?php endforeach; ?>
        </div>
        <?php endif; ?>
    </div><!-- /td-history -->

</div><!-- /td-main -->

<!-- ── RIGHT: Sidebar ─────────────────────────────────────── -->
<div class="td-sidebar">
    <!-- Status -->
    <div class="td-sidebar-card">
        <div class="td-sidebar-label">Status</div>
        <div style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:10px;font-size:14px;font-weight:700;background:<?= $sc['bg'] ?>;color:<?= $sc['c'] ?>;border:1px solid <?= $sc['c'] ?>33;width:100%">
            <?= $sc['label'] ?>
        </div>
    </div>

    <!-- People -->
    <div class="td-sidebar-card">
        <div class="td-sidebar-label">People</div>
        <?php
        $people = [
            'Assignee'  => $task['assignee_name'] ?? null,
            'Reviewer'  => $task['reviewer_name']  ?? null,
            'Approver'  => $task['approver_name']  ?? null,
            'Created by'=> $task['creator_name']   ?? null,
        ];
        foreach ($people as $role => $name):
            if (!$name && in_array($role, ['Reviewer','Approver'])) continue;
        ?>
        <div class="td-people-row">
            <div class="td-avatar"><?= strtoupper(mb_substr($name ?? '?', 0, 1)) ?></div>
            <div>
                <div class="td-people-role"><?= $role ?></div>
                <div class="td-people-name"><?= e($name ?? 'Unassigned') ?></div>
            </div>
        </div>
        <?php endforeach; ?>
    </div>

    <!-- Due date -->
    <?php if ($task['due_date']): ?>
    <div class="td-sidebar-card">
        <div class="td-sidebar-label">Due Date</div>
        <?php $daysLeft = (int)ceil((strtotime($task['due_date']) - time()) / 86400); ?>
        <div style="font-size:20px;font-weight:800;color:<?= $daysLeft < 0?'#f87171':($daysLeft<=3?'#fbbf24':'#d4dde8') ?>"><?= e(taskDetailDateLabel($task['due_date'])) ?></div>
        <div style="font-size:12px;font-weight:600;margin-top:4px;color:<?= $daysLeft<0?'#f87171':($daysLeft<=3?'#fbbf24':'#5d6d7e') ?>">
            <?= $daysLeft<0 ? abs($daysLeft).' days overdue' : ($daysLeft===0?'Due today':'In '.$daysLeft.' days') ?>
        </div>
    </div>
    <?php endif; ?>

    <!-- Stores -->
    <?php if (!empty($taskStores)): ?>
    <div class="td-sidebar-card">
        <div class="td-sidebar-label">Stores</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
            <?php foreach ($taskStores as $ts): ?>
            <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;background:rgba(255,255,255,.06);color:#b8c0cc;border:1px solid rgba(255,255,255,.09)">
                <?php if (!empty($ts['color'])): ?><span style="width:7px;height:7px;border-radius:50%;background:<?= e($ts['color']) ?>"></span><?php endif; ?>
                <?= e($ts['name']) ?>
            </span>
            <?php endforeach; ?>
        </div>
    </div>
    <?php endif; ?>

    <!-- Watchers -->
    <?php if (!empty($watchers)): ?>
    <div class="td-sidebar-card">
        <div class="td-sidebar-label">Watchers (<?= count($watchers) ?>)</div>
        <div class="watcher-list">
            <?php foreach ($watchers as $w): ?>
            <span class="watcher-chip">
                <span class="watcher-avatar"><?= strtoupper(mb_substr($w['name'], 0, 1)) ?></span>
                <?= e($w['name']) ?>
            </span>
            <?php endforeach; ?>
        </div>
        <form method="POST" action="<?= APP_URL ?>/tasks/<?= $task['id'] ?>/watchers" style="margin-top:10px;display:flex;gap:6px;align-items:center">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <select name="watcher_ids[]" class="form-control" multiple style="min-height:36px">
                <?php $watcherIds=is_array($watchers)?array_column($watchers,'id'):[];
                foreach($projectMembers as $pm): ?>
                <option value="<?= $pm['id'] ?>" <?= in_array($pm['id'],$watcherIds)?'selected':'' ?>><?= e($pm['name']) ?></option>
                <?php endforeach; ?>
            </select>
            <button type="submit" class="btn btn-secondary btn-sm">Save</button>
        </form>
    </div>
    <?php endif; ?>

    <!-- Penalty (if any) -->
    <?php if (!empty($task['penalty_applied']) && (int)$task['penalty_applied'] === 1): ?>
    <div class="td-sidebar-card" style="border-color:rgba(248,113,113,.3);background:rgba(248,113,113,.05)">
        <div class="td-sidebar-label" style="color:#f87171">⚠️ Penalty</div>
        <div style="font-size:18px;font-weight:800;color:#f87171"><?= number_format((float)$task['penalty_amount'], 0, '.', ',') ?> <?= e($task['penalty_currency']??'VND') ?></div>
        <div style="font-size:12px;color:#5d6d7e;margin-top:2px"><?= !empty($task['penalty_applied_at'])?date('d/m/Y',strtotime($task['penalty_applied_at'])):'—' ?></div>
    </div>
    <?php endif; ?>
</div><!-- /td-sidebar -->

</div><!-- /td-layout -->

</div><!-- /td-wrap -->

<!-- ═══ MODALS & SCRIPTS (unchanged) ═════════════════════════ -->

<!-- Reschedule Modal -->
<div class="modal-overlay" id="rescheduleModal">
    <div class="modal-box" style="width:400px">
        <div class="modal-header"><h3><?= e(t('task.reschedule')) ?></h3><button class="modal-close" onclick="document.getElementById('rescheduleModal').classList.remove('open')">&times;</button></div>
        <form method="POST" action="<?= APP_URL ?>/tasks/<?= $task['id'] ?>/reschedule">
            <div class="modal-body">
                <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                <p class="text-muted text-sm" style="margin-bottom:12px"><?= e($task['title']) ?></p>
                <?php if ($task['due_date']): ?><p class="text-sm" style="margin-bottom:12px">Current: <strong><?= e(taskDetailDateLabel($task['due_date'])) ?></strong></p><?php endif; ?>
                <div class="form-group"><label><?= e(t('task.reschedule_to')) ?></label><input type="date" name="new_due_date" class="form-control" required min="<?= date('Y-m-d') ?>"></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('rescheduleModal').classList.remove('open')">Cancel</button>
                <button type="submit" class="btn btn-primary btn-sm"><?= e(t('task.reschedule_confirm')) ?></button>
            </div>
        </form>
    </div>
</div>

<!-- Extend Deadline Modal -->
<?php if (!$task['is_completed'] && $task['due_date']): ?>
<div class="modal-overlay" id="extendModal">
    <div class="modal-box" style="width:440px">
        <div class="modal-header"><h3><?= tf_icon('calendar-clock', 16) ?> Extend Deadline</h3><button class="modal-close" onclick="document.getElementById('extendModal').classList.remove('open')">&times;</button></div>
        <div class="modal-body">
            <p class="text-muted text-sm" style="margin-bottom:10px"><?= e($task['title']) ?></p>
            <p class="text-sm" style="margin-bottom:4px">Current: <strong><?= e(taskDetailDateLabel($task['due_date'])) ?></strong></p>
            <p class="text-sm" style="margin-bottom:14px">Self-extend up to: <strong><?= e(taskDetailDateLabel($task['due_date'].' +3 days')) ?></strong></p>
            <div style="margin-bottom:16px;padding:8px 12px;background:rgba(99,102,241,.08);border-radius:8px;border:1px solid rgba(99,102,241,.2);font-size:13px">
                Extensions this month: <strong><?= (int)($extensionUsage['used']??0) ?> / <?= (int)($extensionUsage['limit']??5) ?></strong>
                <?php if(($extensionUsage['remaining']??5)===0):?><span style="color:#EF4444"> — limit reached</span><?php endif;?>
            </div>
            <div class="form-group"><label>New deadline</label><input type="date" id="extendDate" class="form-control" min="<?= date('Y-m-d', strtotime($task['due_date'].' +1 day')) ?>" onchange="onExtendDateChange(this.value)"></div>
            <div id="extendTypeNote" style="display:none;font-size:12px;padding:6px 10px;border-radius:6px;margin-bottom:10px"></div>
            <div class="form-group" id="extendReasonGroup" style="display:none"><label>Reason <span style="color:#EF4444">*</span></label><textarea id="extendReason" class="form-control" rows="3" placeholder="Explain why…"></textarea></div>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('extendModal').classList.remove('open')">Cancel</button>
            <button type="button" id="extendSubmitBtn" class="btn btn-primary btn-sm" onclick="submitExtend()">Extend</button>
        </div>
    </div>
</div>
<?php endif; ?>

<script>
// ── Tab switching ──────────────────────────────────────────────
function tdTab(e, tab) {
    var root = (e && e.currentTarget && e.currentTarget.closest('.td-main')) || document.querySelector('.td-main') || document;
    root.querySelectorAll('.td-tab').forEach(function(b){ b.classList.remove('active'); });
    root.querySelectorAll('.td-pane').forEach(function(p){ p.classList.remove('active'); });
    if (e && e.currentTarget) e.currentTarget.classList.add('active');
    var pane = root.querySelector('#td-' + tab);
    if (pane) pane.classList.add('active');
}
function switchTaskTab(e, tab) {
    var parent = e.currentTarget.closest('.td-pane') || e.currentTarget.closest('.card-body') || document.querySelector('.td-pane.active');
    parent.querySelectorAll('.task-tab-btn').forEach(function(b){ b.classList.remove('active'); });
    parent.querySelectorAll('.task-tab-pane').forEach(function(p){ p.classList.remove('active'); });
    if (e.currentTarget) e.currentTarget.classList.add('active');
    var pane = parent.querySelector('#tab-' + tab);
    if (pane) pane.classList.add('active');
}

document.addEventListener('click', function(e) {
    var mainTab = e.target.closest('[data-td-tab]');
    if (mainTab) {
        e.preventDefault();
        tdTab({ currentTarget: mainTab }, mainTab.dataset.tdTab);
        return;
    }
    var nestedTab = e.target.closest('.task-tab-btn[data-tab]');
    if (nestedTab) {
        e.preventDefault();
        switchTaskTab({ currentTarget: nestedTab }, nestedTab.dataset.tab);
    }
});

// ── File upload ───────────────────────────────────────────────
function taskUploadFile(input, taskId) {
    if (!input.files[0]) return;
    var statusEl = document.getElementById('taskUploadStatus-' + taskId);
    statusEl.textContent = 'Uploading…';
    var fd = new FormData();
    fd.append('file', input.files[0]);
    fetch(window.APP_URL + '/tasks/' + taskId + '/upload', { method:'POST', body:fd, credentials:'same-origin' })
    .then(function(r){ return r.json(); })
    .then(function(d){
        if (d.success) { statusEl.style.color='#22c55e'; statusEl.textContent='✓ '+d.filename; setTimeout(function(){ location.reload(); }, 800); }
        else { statusEl.style.color='#ef4444'; statusEl.textContent=d.error||'Upload failed'; input.value=''; }
    })
    .catch(function(){ statusEl.style.color='#ef4444'; statusEl.textContent='Upload failed'; input.value=''; });
}

// ── Extend deadline ───────────────────────────────────────────
<?php if (!$task['is_completed'] && $task['due_date']): ?>
(function(){
    var TASK_DEADLINE='<?= $task['due_date'] ?>';
    var TASK_ID=<?= (int)$task['id'] ?>;
    var EXT_USED=<?= (int)($extensionUsage['used']??0) ?>;
    var EXT_LIMIT=<?= (int)($extensionUsage['limit']??5) ?>;
    window.onExtendDateChange=function(val){
        if(!val||!TASK_DEADLINE)return;
        var maxSelf=new Date(TASK_DEADLINE); maxSelf.setDate(maxSelf.getDate()+3);
        var sel=new Date(val);
        var note=document.getElementById('extendTypeNote'), grp=document.getElementById('extendReasonGroup');
        note.style.display='block';
        if(sel<=maxSelf){note.style.background='rgba(34,197,94,.1)';note.style.color='#22C55E';note.textContent='✓ Self-extend — auto-approved';grp.style.display='none';}
        else{note.style.background='rgba(251,191,36,.1)';note.style.color='#FBB724';note.textContent='⏳ Requires manager approval';grp.style.display='block';}
    };
    window.submitExtend=function(){
        var val=document.getElementById('extendDate').value;
        if(!val){alert('Please select a date.');return;}
        if(EXT_USED>=EXT_LIMIT){alert('Monthly limit reached.');return;}
        var maxSelf=new Date(TASK_DEADLINE); maxSelf.setDate(maxSelf.getDate()+3);
        var isSelf=new Date(val)<=maxSelf;
        if(!isSelf){var reason=document.getElementById('extendReason').value.trim();if(!reason){alert('Please provide a reason.');return;}}
        var btn=document.getElementById('extendSubmitBtn'); btn.disabled=true; btn.textContent='Submitting…';
        var endpoint=isSelf?window.APP_URL+'/api/tasks/'+TASK_ID+'/extend':window.APP_URL+'/api/tasks/'+TASK_ID+'/extend-request';
        var body=new URLSearchParams({csrf_token:window.CSRF_TOKEN||'',new_deadline:val});
        if(!isSelf)body.append('reason',document.getElementById('extendReason').value.trim());
        fetch(endpoint,{method:'POST',body:body})
        .then(function(r){return r.json();})
        .then(function(d){
            if(d.ok){
                document.getElementById('extendModal').classList.remove('open');
                var msg=isSelf?'✓ Extended to '+new Date(val).toLocaleDateString('vi-VN'):'⏳ Request submitted';
                var t=document.createElement('div'); t.textContent=msg;
                t.style.cssText='position:fixed;bottom:24px;right:24px;padding:10px 20px;border-radius:8px;font-weight:600;font-size:13px;z-index:99999;background:#22C55E;color:#fff';
                document.body.appendChild(t); setTimeout(function(){t.remove();location.reload();},1600);
            } else {btn.disabled=false;btn.textContent='Extend';alert('Error: '+(d.error||'Unknown error'));}
        })
        .catch(function(){btn.disabled=false;btn.textContent='Extend';alert('Network error.');});
    };
})();
<?php endif; ?>

// ── Repeat config ─────────────────────────────────────────────
function toggleRepeatOptions(){
    var type=document.getElementById('repeatType')?document.getElementById('repeatType').value:'none';
    document.querySelectorAll('.repeat-opt').forEach(function(el){el.style.display='none';});
    var advEl=document.getElementById('repeatAdvanced');
    if(type!=='none'){
        var map={daily:'repeatDaily',weekly:'repeatWeekly',monthly:'repeatMonthly',yearly:'repeatYearly'};
        var el=document.getElementById(map[type]); if(el)el.style.display='block';
        if(advEl)advEl.style.display='block';
        updateRepeatFromHint();
    } else { if(advEl)advEl.style.display='none'; }
}
function toggleRepeatEndOptions(){
    var type=document.getElementById('repeatEndType')?document.getElementById('repeatEndType').value:'never';
    document.querySelectorAll('.repeat-end-opt').forEach(function(el){el.style.display='none';});
    if(type==='date'&&document.getElementById('repeatEndDateOpt'))document.getElementById('repeatEndDateOpt').style.display='block';
    if(type==='count'&&document.getElementById('repeatEndCountOpt'))document.getElementById('repeatEndCountOpt').style.display='block';
}
function updateRepeatFromHint(){
    var mode=document.getElementById('repeatFromMode')?document.getElementById('repeatFromMode').value:'due_date';
    var hint=document.getElementById('repeatFromHint'), txt=document.getElementById('repeatFromHintText');
    if(!hint||!txt)return;
    if(mode==='completion_date'){hint.style.display='block';txt.textContent='Next occurrence will be calculated from the completion date';}
    else{hint.style.display='none';}
}
function toggleRepeatDayChip(chip){
    chip.classList.toggle('active');
    var container=chip.closest('.repeat-days-picker');
    if(!container)return;
    var stillActive=container.querySelectorAll('.repeat-day-chip.active');
    if(stillActive.length===0){chip.classList.add('active');return;}
    buildRepeatConfig();
}
function buildRepeatConfig(){
    var type=document.getElementById('repeatType')?document.getElementById('repeatType').value:'none';
    var configInput=document.getElementById('repeatConfigInput');
    if(!configInput)return;
    if(type==='none'){configInput.value='';return;}
    var cfg={};
    if(type==='daily'){var sel=document.querySelector('select[name="repeat_interval_daily"]');cfg.interval=sel?parseInt(sel.value,10):1;}
    else if(type==='weekly'){var sel=document.querySelector('select[name="repeat_interval_weekly"]');cfg.interval=sel?parseInt(sel.value,10):1;var activeDays=[];document.querySelectorAll('.repeat-day-chip.active').forEach(function(chip){var d=parseInt(chip.getAttribute('data-day'),10);if(!isNaN(d)&&d>=1&&d<=7)activeDays.push(d);});cfg.days=activeDays;}
    else if(type==='monthly'){var sel=document.querySelector('select[name="repeat_interval_monthly"]');cfg.interval=sel?parseInt(sel.value,10):1;var daySel=document.querySelector('select[name="repeat_day_of_month"]');cfg.day_of_month=daySel?parseInt(daySel.value,10):1;}
    else if(type==='yearly'){var sel=document.querySelector('select[name="repeat_interval_yearly"]');cfg.interval=sel?parseInt(sel.value,10):1;}
    configInput.value=JSON.stringify(cfg);
}
document.addEventListener('DOMContentLoaded',function(){
    var form=document.querySelector('form.task-edit-form');
    if(form)form.addEventListener('submit',function(){buildRepeatConfig();});
    toggleRepeatOptions(); toggleRepeatEndOptions();
});

// ── Store chips ───────────────────────────────────────────────
function ctToggleChip(chip){
    var input=chip.querySelector('input'); if(!input)return;
    input.checked=!input.checked; chip.classList.toggle('selected',input.checked);
    var container=chip.closest('[id$="StoreChips"]');
    if(container){var helperId=container.id.replace('StoreChips','StoreHelper');var helper=document.getElementById(helperId);if(helper){var n=container.querySelectorAll('input:checked').length;helper.textContent=n===0?'No store selected = general task':n+' store'+(n>1?'s':'')+' selected';}}
}
function editSelectAllStores(){document.querySelectorAll('#editStoreChips .ct-store-chip').forEach(function(c){c.querySelector('input').checked=true;c.classList.add('selected');});var h=document.getElementById('editStoreHelper');var n=document.querySelectorAll('#editStoreChips input:checked').length;if(h)h.textContent=n+' store'+(n>1?'s':'')+' selected';}
function editClearStores(){document.querySelectorAll('#editStoreChips .ct-store-chip').forEach(function(c){c.querySelector('input').checked=false;c.classList.remove('selected');});var h=document.getElementById('editStoreHelper');if(h)h.textContent='No store selected = general task';}
</script>
<?php $content = ob_get_clean(); require __DIR__ . '/../layouts/main.php'; ?>
