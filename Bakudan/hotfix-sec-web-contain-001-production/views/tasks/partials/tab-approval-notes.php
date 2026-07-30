<?php
/**
 * Tab: Approval Notes — Approver notes section
 * Variables: $task, $approvalNotes, $canAddApprovalNote
 */
$currentUid = (int)($_SESSION['user_id'] ?? 0);

$actionConfig = [
    'approved'          => ['icon' => 'check-circle', 'color' => '#4ade80', 'bg' => 'rgba(74,222,128,.12)',  'label' => '✅ Approved'],
    'rejected'          => ['icon' => 'x-circle',    'color' => '#f87171', 'bg' => 'rgba(248,113,113,.12)', 'label' => '❌ Rejected'],
    'requested_changes' => ['icon' => 'refresh-cw',  'color' => '#fbbf24', 'bg' => 'rgba(251,191,36,.12)', 'label' => '🔁 Requested Changes'],
    'info_requested'    => ['icon' => 'help-circle', 'color' => '#a78bfa', 'bg' => 'rgba(167,139,250,.12)', 'label' => '❓ Info Requested'],
];
?>

<style>
.an-card{background:#0d1117;border:1px solid #21262d;border-radius:10px;padding:14px 16px;margin-bottom:12px}
.an-card:last-child{margin-bottom:0}
.an-card.approved{border-left:3px solid #4ade80}
.an-card.rejected{border-left:3px solid #f87171}
.an-card.requested_changes{border-left:3px solid #fbbf24}
.an-card.info_requested{border-left:3px solid #a78bfa}
.an-header{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.an-badge{font-size:11px;padding:3px 10px;border-radius:20px;font-weight:700;display:inline-flex;align-items:center;gap:5px}
.an-body{font-size:13px;color:#c9d1d9;line-height:1.6;margin-bottom:8px}
.an-meta{display:flex;align-items:center;gap:8px}
.an-avatar{width:20px;height:20px;border-radius:50%;background:rgba(96,165,250,.2);display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#60a5fa;text-transform:uppercase;flex-shrink:0}
.an-time{font-size:11px;color:#484f58}
.an-final-badge{font-size:10px;padding:2px 7px;border-radius:10px;background:rgba(251,191,36,.15);color:#fbbf24;font-weight:700}
.an-delete-btn{font-size:11px;color:#484f58;cursor:pointer;background:none;border:none;padding:2px 4px;border-radius:4px;margin-left:auto;transition:color .1s}
.an-delete-btn:hover{color:#f87171}

/* Add note form */
.add-approval-card{background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:16px;margin-top:12px}
.action-btn{padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid;transition:all .15s}
.action-btn.approve{background:rgba(74,222,128,.15);border-color:rgba(74,222,128,.4);color:#4ade80}
.action-btn.approve:hover{background:rgba(74,222,128,.25)}
.action-btn.reject{background:rgba(248,113,113,.12);border-color:rgba(248,113,113,.35);color:#f87171}
.action-btn.reject:hover{background:rgba(248,113,113,.22)}
.action-btn.changes{background:rgba(251,191,36,.12);border-color:rgba(251,191,36,.35);color:#fbbf24}
.action-btn.changes:hover{background:rgba(251,191,36,.22)}
.action-btn.info{background:rgba(167,139,250,.12);border-color:rgba(167,139,250,.35);color:#a78bfa}
.action-btn.info:hover{background:rgba(167,139,250,.22)}
</style>

<!-- Approval Notes List -->
<?php if (empty($approvalNotes)): ?>
<div style="text-align:center;padding:24px 0;color:#3f3f46">
    <div style="font-size:2rem;margin-bottom:8px">📝</div>
    <div style="font-size:13px">No approval notes yet.</div>
</div>
<?php else: ?>
<?php foreach ($approvalNotes as $note):
    $cfg = $actionConfig[$note['action']] ?? ['icon' => 'file-text', 'color' => '#71717a', 'bg' => 'rgba(113,113,122,.1)', 'label' => ucfirst($note['action'])];
?>
<div class="an-card <?= e($note['action']) ?>">
    <div class="an-header">
        <span class="an-badge" style="background:<?= $cfg['bg'] ?>;color:<?= $cfg['color'] ?>">
            <?= tf_icon($cfg['icon'], 13) ?> <?= e($cfg['label']) ?>
        </span>
        <?php if (!empty($note['is_final'])): ?>
        <span class="an-final-badge">Final</span>
        <?php endif; ?>
        <span class="an-time" style="margin-left:auto"><?= timeAgo($note['created_at']) ?></span>
        <?php if ((int)$note['user_id'] === $currentUid || canAdmin()): ?>
        <button class="an-delete-btn" onclick="deleteApprovalNote(<?= (int)$note['id'] ?>)">
            <?= tf_icon('trash-2', 12) ?>
        </button>
        <?php endif; ?>
    </div>

    <div class="an-body"><?= nl2br(e($note['content'])) ?></div>

    <div class="an-meta">
        <span class="an-avatar"><?= strtoupper(mb_substr($note['approver_name'] ?? 'A', 0, 1)) ?></span>
        <span style="font-size:11px;color:#6e7681">
            <?= e($note['approver_name'] ?? '') ?>
            <?php if (!empty($note['approver_role'])): ?>
            · <?= e(ucfirst($note['approver_role'])) ?>
            <?php endif; ?>
        </span>
    </div>
</div>
<?php endforeach; ?>
<?php endif; ?>

<!-- Add Approval Note Form -->
<?php if (!empty($canAddApprovalNote)): ?>
<div class="add-approval-card">
    <div style="font-size:12px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">
        Add Approval Note
    </div>

    <form method="POST" action="<?= APP_URL ?>/tasks/<?= (int)$task['id'] ?>/approval-notes" onsubmit="return handleApprovalNoteSubmit()">
        <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
        <input type="hidden" name="action" id="selectedApprovalAction" value="">

        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
            <button type="button" class="action-btn approve" onclick="selectApprovalAction('approved', this)">
                <?= tf_icon('check-circle', 14) ?> Approve
            </button>
            <button type="button" class="action-btn reject" onclick="selectApprovalAction('rejected', this)">
                <?= tf_icon('x-circle', 14) ?> Reject
            </button>
            <button type="button" class="action-btn changes" onclick="selectApprovalAction('requested_changes', this)">
                <?= tf_icon('refresh-cw', 14) ?> Request Changes
            </button>
            <button type="button" class="action-btn info" onclick="selectApprovalAction('info_requested', this)">
                <?= tf_icon('help-circle', 14) ?> Info Request
            </button>
        </div>

        <textarea name="content" id="approvalNoteContent" class="note-textarea"
                  placeholder="Enter your approval note or rejection reason…"
                  rows="4" required></textarea>

        <div style="display:flex;align-items:center;gap:12px;margin-top:10px">
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#71717a;cursor:pointer">
                <input type="checkbox" name="is_final" value="1" style="accent-color:#fbbf24">
                Mark as final note
            </label>
            <button type="submit" class="btn btn-primary btn-sm" style="margin-left:auto" id="approvalNoteSubmitBtn">
                <?= tf_icon('send', 14) ?> Submit Note
            </button>
        </div>
    </form>
</div>
<?php endif; ?>

<script>
var selectedAction = null;

function selectApprovalAction(action, btn) {
    document.querySelectorAll('.action-btn').forEach(function(b) {
        b.style.opacity = '0.6';
    });
    btn.style.opacity = '1';
    selectedAction = action;
    document.getElementById('selectedApprovalAction').value = action;

    var contentEl = document.getElementById('approvalNoteContent');
    var placeholders = {
        'approved': 'Explain why you approved this task (compliance requirements met, quality checks passed, etc.)…',
        'rejected': 'Provide the rejection reason and what needs to be corrected…',
        'requested_changes': 'Describe what changes are needed before approval…',
        'info_requested': 'Ask specific questions or request additional information…',
    };
    contentEl.placeholder = placeholders[action] || 'Enter your note…';
}

function handleApprovalNoteSubmit() {
    if (!selectedAction) {
        alert('Please select an action (Approve, Reject, Request Changes, or Info Request).');
        return false;
    }
    var content = document.getElementById('approvalNoteContent').value.trim();
    if (!content) {
        alert('Please enter a note or reason.');
        return false;
    }
    return true;
}

function deleteApprovalNote(id) {
    if (!confirm('Delete this approval note?')) return;
    fetch('<?= APP_URL ?>/approval-notes/' + id, {
        method: 'DELETE',
        credentials: 'same-origin'
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
        if (d.success) location.reload();
    })
    .catch(function() {});
}
</script>
